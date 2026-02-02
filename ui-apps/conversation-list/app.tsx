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
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [username, setUsername] = useState<string>("");
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [_offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const hasFetchedInitial = useRef(false);

  const { initialData, callTool, openLink, parseResult } = useMcpApp<
    ConversationsData | AuthRequiredResponse
  >({
    name: "ASSA Conversations",
    version: "1.0.0",
  });

  // Fetch conversations
  const fetchConversations = useCallback(
    async (loadMore = false) => {
      try {
        const currentOffset = offsetRef.current;
        const newOffset = loadMore ? currentOffset + PAGE_SIZE : 0;
        const result = await callTool("x_get_conversations", {
          offset: newOffset,
          limit: PAGE_SIZE,
        });

        const data = parseResult<ConversationsData>(result);
        if (typeof data === "string" || !data) {
          return;
        }

        if ("conversations" in data) {
          if (loadMore) {
            setConversations((prev) => [...prev, ...data.conversations]);
          } else {
            setConversations(data.conversations);
          }
          setUsername(data.username);
          setTotalCount(data.totalCount);
          setHasMore(data.hasMore);
          offsetRef.current = newOffset;
          setOffset(newOffset);
          setAppState("loaded");
        }
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load conversations"
        );
        setAppState("error");
      }
    },
    [callTool, parseResult]
  );

  // Auth poller
  const authPoller = useAuthPoller({
    callTool,
    openLink,
    onAuthComplete: () => fetchConversations(false),
  });

  // Handle initial data
  useEffect(() => {
    if (!initialData) {
      return;
    }

    if (typeof initialData === "string") {
      if (!hasFetchedInitial.current) {
        hasFetchedInitial.current = true;
        fetchConversations(false);
      }
      return;
    }

    if (isAuthRequired(initialData)) {
      setAuthData(initialData);
      setAppState("auth-required");
    } else if (
      typeof initialData === "object" &&
      initialData !== null &&
      "conversations" in initialData
    ) {
      setConversations(initialData.conversations);
      setUsername(initialData.username);
      setTotalCount(initialData.totalCount);
      setHasMore(initialData.hasMore);
      setAppState("loaded");
    }
  }, [initialData, fetchConversations]);

  const handleConnect = async () => {
    if (authData?.authUrl) {
      await authPoller.startAuth(authData.authUrl);
    }
  };

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    await fetchConversations(true);
    setIsLoadingMore(false);
  };

  const handleDismiss = async (tweetId: string, replyCount: number) => {
    try {
      await callTool("x_dismiss_conversation", {
        tweet_id: tweetId,
        reply_count: replyCount,
      });
      setConversations((prev) => prev.filter((c) => c.tweet_id !== tweetId));
      setTotalCount((prev) => prev - 1);
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
    fetchConversations(false);
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

  // Render conversations
  const displayedCount = conversations.length;
  const remaining = totalCount - displayedCount;

  return (
    <div className="loaded container">
      <div
        className="p-16"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <h2 className="heading-flush">Conversations</h2>
        <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
          @{username} ·{" "}
          {displayedCount === 0 ? "All caught up!" : `${totalCount} total`}
        </p>
      </div>

      <div className="p-16">
        {displayedCount === 0 ? (
          <div className="empty-state">
            <div className="icon">✨</div>
            <h3>All caught up!</h3>
            <p>No conversations need your attention right now.</p>
          </div>
        ) : (
          <>
            {conversations.map((conv) => (
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
                <Button
                  loading={isLoadingMore}
                  onClick={handleLoadMore}
                  variant="secondary"
                >
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
