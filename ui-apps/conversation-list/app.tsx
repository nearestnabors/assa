/**
 * Conversation List React App
 *
 * Displays X mentions awaiting reply with pagination support.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import {
  ConversationCard,
  type ConversationItem,
} from "@/components/conversation-card";
import { type AppState, StateContainer } from "@/components/state-container";
import { useAuthPoller } from "@/hooks/use-auth-poller";
import { useMcpApp } from "@/hooks/use-mcp-app";
import { type AuthRequiredResponse, isAuthRequired } from "@/hooks/utils";

interface ConversationsData {
  conversations: ConversationItem[];
  username: string;
  totalCount: number;
  hasMore: boolean;
}

const PAGE_SIZE = 10;

export function ConversationListApp() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [authData, setAuthData] = useState<AuthRequiredResponse | null>(null);
  // All conversations from server
  const [allConversations, setAllConversations] = useState<ConversationItem[]>(
    []
  );
  // Number of conversations to display (for client-side pagination)
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [username, setUsername] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasFetchedInitial = useRef(false);

  const { initialData, callTool, openLink, parseResult } = useMcpApp<
    ConversationsData | AuthRequiredResponse
  >({
    name: "ASSA Conversations",
    version: "1.0.0",
  });

  // Handle auth error by fetching auth status
  const handleAuthError = useCallback(
    async (errorMessage: string) => {
      const authResult = await callTool("x_auth_status", {});
      const authResponseData = parseResult<AuthRequiredResponse>(authResult);
      if (authResponseData && isAuthRequired(authResponseData)) {
        setAuthData(authResponseData);
        setAppState("auth-required");
      } else {
        setErrorMessage(errorMessage || "Authentication required");
        setAppState("error");
      }
    },
    [callTool, parseResult]
  );

  // Fetch all conversations from server
  const fetchConversations = useCallback(async () => {
    try {
      const result = await callTool("x_get_conversations", {});

      const data = parseResult<
        ConversationsData | { error: boolean; message: string }
      >(result);
      if (typeof data === "string" || !data) {
        return;
      }

      // Check for auth error - tool returns error when username not set
      if ("error" in data && data.error) {
        await handleAuthError((data as { message?: string }).message || "");
        return;
      }

      if ("conversations" in data) {
        setAllConversations(data.conversations);
        setUsername(data.username);
        setDisplayCount(PAGE_SIZE); // Reset display count on fresh fetch
        setAppState("loaded");
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load conversations"
      );
      setAppState("error");
    }
  }, [callTool, parseResult, handleAuthError]);

  // Auth poller
  const authPoller = useAuthPoller({
    callTool,
    openLink,
    onAuthComplete: () => fetchConversations(),
  });

  // Handle initial data
  useEffect(() => {
    if (!initialData) {
      return;
    }

    // Try to parse string as JSON (tool may return AuthRequiredResponse as JSON string)
    let parsedData = initialData;
    if (typeof initialData === "string") {
      try {
        parsedData = JSON.parse(initialData);
      } catch {
        // Not JSON - treat as text message, fetch conversations
        if (!hasFetchedInitial.current) {
          hasFetchedInitial.current = true;
          fetchConversations();
        }
        return;
      }
    }

    if (isAuthRequired(parsedData)) {
      setAuthData(parsedData);
      setAppState("auth-required");
    } else if (
      typeof parsedData === "object" &&
      parsedData !== null &&
      "conversations" in parsedData
    ) {
      setAllConversations(parsedData.conversations);
      setUsername(parsedData.username);
      setDisplayCount(PAGE_SIZE);
      setAppState("loaded");
    } else if (!hasFetchedInitial.current) {
      // Unknown format - try fetching
      hasFetchedInitial.current = true;
      fetchConversations();
    }
  }, [initialData, fetchConversations]);

  const handleConnect = async () => {
    if (authData?.authUrl) {
      await authPoller.startAuth(authData.authUrl);
    }
  };

  // Client-side pagination - just show more items
  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  };

  const handleDismiss = async (tweetId: string, replyCount: number) => {
    try {
      await callTool("x_dismiss_conversation", {
        tweet_id: tweetId,
        reply_count: replyCount,
      });
      setAllConversations((prev) => prev.filter((c) => c.tweet_id !== tweetId));
    } catch (error) {
      console.error("Failed to dismiss:", error);
    }
  };

  const handleReply = async (
    tweetId: string,
    _replyCount: number,
    text: string
  ) => {
    const result = await callTool("x_post_tweet", {
      text,
      reply_to_id: tweetId,
    });
    const data = parseResult<{ success?: boolean; error?: string }>(result);
    if (data?.error) {
      throw new Error(data.error);
    }
  };

  const handleViewTweet = (tweetId: string, authorUsername: string) => {
    openLink(`https://x.com/${authorUsername}/status/${tweetId}`);
  };

  const handleRetry = () => {
    setAppState("loading");
    setErrorMessage(null);
    hasFetchedInitial.current = false;
    fetchConversations();
  };

  // Use StateContainer for loading, auth, and error states
  if (appState !== "loaded") {
    return (
      <StateContainer
        authData={authData}
        authDescription="Connect your X account to view your conversations."
        authPoller={authPoller}
        errorMessage={errorMessage || "Failed to load conversations"}
        loadingMessage="Loading conversations..."
        onConnect={handleConnect}
        onRetry={handleRetry}
        state={appState}
      />
    );
  }

  // Client-side pagination - slice all conversations to display count
  const visibleConversations = allConversations.slice(0, displayCount);
  const totalCount = allConversations.length;
  const hasMore = displayCount < totalCount;
  const remaining = totalCount - visibleConversations.length;

  return (
    <div className="loaded container">
      <div
        className="p-16"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <h2 className="heading-flush">Conversations</h2>
        <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
          @{username} ·{" "}
          {totalCount === 0 ? "All caught up!" : `${totalCount} total`}
        </p>
      </div>

      <div className="p-16">
        {totalCount === 0 ? (
          <div className="empty-state">
            <div className="icon">✨</div>
            <h3>All caught up!</h3>
            <p>No conversations need your attention right now.</p>
          </div>
        ) : (
          <>
            {visibleConversations.map((conv) => (
              <ConversationCard
                conversation={conv}
                key={conv.tweet_id}
                onDismiss={handleDismiss}
                onOpenLink={openLink}
                onReply={handleReply}
                onViewTweet={handleViewTweet}
              />
            ))}

            {hasMore && (
              <div className="mt-4 text-center">
                <Button onClick={handleLoadMore} variant="secondary">
                  Load more ({remaining} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
