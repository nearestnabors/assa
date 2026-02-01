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
import { useAuthPoller } from "@/hooks/use-auth-poller";
import { useMcpApp } from "@/hooks/use-mcp-app";
import { type AuthRequiredResponse, isAuthRequired } from "@/hooks/utils";

interface ConversationsData {
  conversations: ConversationItem[];
  username: string;
  totalCount: number;
  hasMore: boolean;
}

type AppState = "loading" | "auth-required" | "loaded" | "error";

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

  // Use ref to track offset for callback stability
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
        // Use ref for stable offset calculation
        const currentOffset = offsetRef.current;
        const newOffset = loadMore ? currentOffset + PAGE_SIZE : 0;
        const result = await callTool("x_get_conversations", {
          offset: newOffset,
          limit: PAGE_SIZE,
        });

        const data = parseResult<ConversationsData>(result);

        // Skip if we got a string instead of object
        if (typeof data === "string" || !data) {
          return;
        }

        if ("conversations" in data) {
          console.log("[ASSA UI] fetchConversations response:", {
            loadMore,
            newConversations: data.conversations.length,
            totalCount: data.totalCount,
            hasMore: data.hasMore,
            newOffset,
          });

          if (loadMore) {
            setConversations((prev) => {
              const updated = [...prev, ...data.conversations];
              console.log(
                "[ASSA UI] Updated conversations:",
                prev.length,
                "->",
                updated.length
              );
              return updated;
            });
          } else {
            setConversations(data.conversations);
          }
          setUsername(data.username);
          setTotalCount(data.totalCount);
          setHasMore(data.hasMore);
          // Update both ref and state
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

    // Handle string messages (e.g., "10 conversations awaiting...")
    if (typeof initialData === "string") {
      // Only fetch once to prevent re-render loop
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

  // Handle connect
  const handleConnect = async () => {
    if (authData?.authUrl) {
      await authPoller.startAuth(authData.authUrl);
    }
  };

  // Handle load more
  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    await fetchConversations(true);
    setIsLoadingMore(false);
  };

  // Handle dismiss
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

  // Handle reply
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

  // Handle view tweet
  const handleViewTweet = (tweetId: string, authorUsername: string) => {
    openLink(`https://x.com/${authorUsername}/status/${tweetId}`);
  };

  // Render loading
  if (appState === "loading") {
    return (
      <div
        className="container flex flex-col items-center justify-center gap-4"
        style={{ padding: 40 }}
      >
        <div className="loading loading-lg" />
        <p className="text-muted">Loading conversations...</p>
      </div>
    );
  }

  // Render auth required
  if (appState === "auth-required") {
    return (
      <div
        className="container flex flex-col items-center gap-4"
        style={{ padding: 40 }}
      >
        <h2>Connect to X</h2>
        <p className="text-center text-muted">
          Connect your X account to view your conversations.
        </p>

        {authPoller.isPolling ? (
          <div className="flex flex-col items-center gap-2">
            <div className="loading" />
            <p className="text-muted">{authPoller.status}</p>
          </div>
        ) : (
          <Button onClick={handleConnect} size="lg" variant="primary">
            Connect {authData?.service || "X"}
          </Button>
        )}

        {authPoller.error && (
          <p style={{ color: "var(--color-error)" }}>
            Error: {authPoller.error.message}
          </p>
        )}
      </div>
    );
  }

  // Render error state
  if (appState === "error") {
    return (
      <div
        className="container flex flex-col items-center gap-4"
        style={{ padding: 40 }}
      >
        <h2>Something went wrong</h2>
        <p className="text-center text-muted">
          {errorMessage || "Failed to load conversations"}
        </p>
        <Button
          onClick={() => {
            setAppState("loading");
            setErrorMessage(null);
            hasFetchedInitial.current = false;
            fetchConversations(false);
          }}
          size="lg"
          variant="primary"
        >
          Try Again
        </Button>
      </div>
    );
  }

  // Render conversations
  const displayedCount = conversations.length;
  const remaining = totalCount - displayedCount;

  console.log("[ASSA UI] Render:", {
    displayedCount,
    totalCount,
    remaining,
    hasMore,
  });

  return (
    <div className="loaded container">
      <div
        style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>Conversations</h2>
        <p className="text-muted" style={{ fontSize: "var(--font-size-sm)" }}>
          @{username} ·{" "}
          {displayedCount === 0 ? "All caught up!" : `${totalCount} total`}
        </p>
      </div>

      <div style={{ padding: 16 }}>
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
