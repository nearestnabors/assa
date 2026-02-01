/**
 * Timeline Digest App
 *
 * Displays a summary of tweets from the Following timeline
 * with expandable cards for replying.
 */

import { useCallback, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import {
  ConversationCard,
  type ConversationItem,
} from "@/components/conversation-card";
import { useMcpApp } from "@/hooks/use-mcp-app";

// Tweet data from timeline-digest tool
interface TimelineTweet {
  id: string;
  text: string;
  authorUsername: string;
  authorDisplayName: string;
  timestamp: string; // ISO string
  likes: number;
  retweets: number;
  replies: number;
  isRetweet: boolean;
  isQuote: boolean;
  quotedTweetText?: string;
}

interface DigestData {
  tweets: TimelineTweet[];
  summary?: string;
  totalCount: number;
}

type AppState = "loading" | "error" | "empty" | "loaded";

export function TimelineDigestApp() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [tweets, setTweets] = useState<TimelineTweet[]>([]);
  const [expandedTweetId, setExpandedTweetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { callTool, openLink, sendPrompt } = useMcpApp<DigestData | string>({
    name: "ASSA Timeline Digest",
    onData: (data) => {
      if (typeof data === "string") {
        // Error or message
        setErrorMessage(data);
        setAppState("error");
        return;
      }

      if (data.tweets && data.tweets.length > 0) {
        setTweets(data.tweets);
        setAppState("loaded");
      } else {
        setAppState("empty");
      }
    },
    onError: (error) => {
      setErrorMessage(error.message);
      setAppState("error");
    },
  });

  // Convert TimelineTweet to ConversationItem for the card
  const toConversationItem = (tweet: TimelineTweet): ConversationItem => ({
    tweet_id: tweet.id,
    author_username: tweet.authorUsername,
    author_display_name: tweet.authorDisplayName,
    text: tweet.text,
    created_at: tweet.timestamp,
    reply_count: tweet.replies,
    like_count: tweet.likes,
    retweet_count: tweet.retweets,
  });

  // Handle dismiss (just collapse the expanded view)
  const handleDismiss = useCallback((_tweetId: string) => {
    setExpandedTweetId(null);
  }, []);

  // Handle reply via x_post_tweet
  const handleReply = useCallback(
    async (tweetId: string, _replyCount: number, text: string) => {
      const result = await callTool("x_post_tweet", {
        text,
        reply_to_id: tweetId,
      });

      if (result && typeof result === "object" && "isError" in result) {
        throw new Error("Failed to post reply");
      }
    },
    [callTool]
  );

  // Open tweet on X
  const handleViewTweet = useCallback(
    (tweetId: string, username: string) => {
      openLink(`https://x.com/${username}/status/${tweetId}`);
    },
    [openLink]
  );

  // Open link
  const handleOpenLink = useCallback(
    (url: string) => {
      openLink(url);
    },
    [openLink]
  );

  // Format relative time
  const formatTimeAgo = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) {
      return `${diffMins}m`;
    }
    return `${diffHours}h`;
  };

  // Render loading state
  if (appState === "loading") {
    return (
      <div
        className="container flex flex-col items-center gap-4"
        style={{ padding: 40 }}
      >
        <div className="spinner" />
        <p className="text-muted">Fetching your timeline...</p>
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
          {errorMessage || "Failed to load timeline"}
        </p>
        <Button
          onClick={() => sendPrompt("Show me my Twitter timeline digest")}
          size="lg"
          variant="primary"
        >
          Try Again
        </Button>
      </div>
    );
  }

  // Render empty state
  if (appState === "empty") {
    return (
      <div
        className="container flex flex-col items-center gap-4"
        style={{ padding: 40 }}
      >
        <h2>No tweets found</h2>
        <p className="text-center text-muted">
          Your Following timeline is empty for the past 24 hours.
        </p>
      </div>
    );
  }

  // Render digest
  return (
    <div className="container" style={{ padding: 16 }}>
      <div className="digest-header" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Timeline Digest</h2>
        <p className="text-muted" style={{ margin: "4px 0 0 0" }}>
          {tweets.length} tweets from the past 24 hours
        </p>
      </div>

      <div
        className="tweet-list"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        {tweets.map((tweet) => {
          const isExpanded = expandedTweetId === tweet.id;

          if (isExpanded) {
            // Show full conversation card
            return (
              <ConversationCard
                conversation={toConversationItem(tweet)}
                key={tweet.id}
                onDismiss={handleDismiss}
                onOpenLink={handleOpenLink}
                onReply={handleReply}
                onViewTweet={handleViewTweet}
              />
            );
          }

          // Show compact tweet chip
          return (
            <TweetChip
              key={tweet.id}
              onClick={() => setExpandedTweetId(tweet.id)}
              onViewOnX={() => handleViewTweet(tweet.id, tweet.authorUsername)}
              timeAgo={formatTimeAgo(tweet.timestamp)}
              tweet={tweet}
            />
          );
        })}
      </div>
    </div>
  );
}

// Compact tweet chip component
interface TweetChipProps {
  tweet: TimelineTweet;
  timeAgo: string;
  onClick: () => void;
  onViewOnX: () => void;
}

function TweetChip({ tweet, timeAgo, onClick, onViewOnX }: TweetChipProps) {
  // Truncate text for chip view
  const maxLength = 100;
  const truncatedText =
    tweet.text.length > maxLength
      ? `${tweet.text.substring(0, maxLength)}...`
      : tweet.text;

  // Determine prefix for retweets/quotes
  let prefix = "";
  if (tweet.isRetweet) {
    prefix = "RT ";
  } else if (tweet.isQuote) {
    prefix = "QT ";
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: div needed for layout with nested interactive buttons
    <div
      className="tweet-chip"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <Avatar name={tweet.authorDisplayName} size="sm" />

      <div className="chip-content">
        <div className="chip-header">
          <span className="chip-author">
            {prefix}@{tweet.authorUsername}
          </span>
          <span className="chip-time">{timeAgo}</span>
        </div>
        <p className="chip-text">{truncatedText}</p>
        <div className="chip-stats">
          <span>{tweet.likes} likes</span>
          <span>{tweet.retweets} RTs</span>
          <span>{tweet.replies} replies</span>
        </div>
      </div>

      <div className="chip-actions">
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          size="sm"
          variant="ghost"
        >
          Reply
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onViewOnX();
          }}
          size="sm"
          variant="ghost"
        >
          View
        </Button>
      </div>
    </div>
  );
}
