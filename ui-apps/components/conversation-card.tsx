/**
 * Conversation card component for displaying tweets/mentions
 */

import { type ReactNode, useState } from "react";
import { formatTimeFromSnowflake, getCharCountStatus } from "@/hooks/utils";
import { Avatar } from "./avatar";
import { Button } from "./button";

export interface ConversationItem {
  tweet_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url?: string;
  text: string;
  created_at: string;
  reply_count: number;
  like_count?: number;
  retweet_count?: number;
}

interface ConversationCardProps {
  conversation: ConversationItem;
  onDismiss: (tweetId: string, replyCount: number) => Promise<void>;
  onReply: (tweetId: string, replyCount: number, text: string) => Promise<void>;
  onViewTweet?: (tweetId: string, username: string) => void;
  onOpenLink?: (url: string) => void;
}

// URL regex pattern
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

// Parse text and make URLs clickable
function renderTextWithLinks(
  text: string,
  onOpenLink?: (url: string) => void
): ReactNode {
  if (!onOpenLink) {
    return text;
  }

  const parts = text.split(URL_PATTERN);
  const elements: ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (URL_PATTERN.test(part)) {
      // Reset regex lastIndex
      URL_PATTERN.lastIndex = 0;
      elements.push(
        <button
          className="tweet-link"
          key={`url-${part}`}
          onClick={() => onOpenLink(part)}
          type="button"
        >
          {part}
        </button>
      );
    } else if (part) {
      // Plain text - use fragment with position-based key
      elements.push(<span key={`text-${i}`}>{part}</span>);
    }
  }

  return elements;
}

export function ConversationCard({
  conversation,
  onDismiss,
  onReply,
  onViewTweet,
  onOpenLink,
}: ConversationCardProps) {
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const charCount = replyText.length;
  const charStatus = getCharCountStatus(charCount);
  const canSubmit = charCount > 0 && charCount <= 280;

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      await onDismiss(conversation.tweet_id, conversation.reply_count);
    } catch (error) {
      console.error("Failed to dismiss:", error);
    }
    setIsDismissing(false);
  };

  const handleReply = async () => {
    if (!canSubmit) {
      return;
    }

    setIsReplying(true);
    try {
      await onReply(conversation.tweet_id, conversation.reply_count, replyText);
      setStatus("success");
      setStatusMessage("Reply posted!");
      setReplyText("");
      setShowReplyBox(false);

      // Auto-dismiss after success
      setTimeout(() => {
        onDismiss(conversation.tweet_id, conversation.reply_count + 1);
      }, 2000);
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to post reply"
      );
    }
    setIsReplying(false);
  };

  const handleViewTweet = () => {
    if (onViewTweet) {
      onViewTweet(conversation.tweet_id, conversation.author_username);
    }
  };

  const relativeTime = formatTimeFromSnowflake(conversation.tweet_id);

  return (
    <div className="conversation-card">
      <Avatar
        name={conversation.author_display_name}
        src={conversation.author_avatar_url}
      />

      <div className="card-content">
        <div className="author-info">
          <span className="display-name">
            {conversation.author_display_name}
          </span>
          <span className="handle">@{conversation.author_username}</span>
          <span className="timestamp">{relativeTime}</span>
        </div>

        <p className="tweet-text">
          {renderTextWithLinks(conversation.text, onOpenLink)}
        </p>

        {status !== "idle" && (
          <div className={`status show ${status}`}>
            {statusMessage}
            {status === "success" && onViewTweet && (
              <>
                {" "}
                <button
                  onClick={handleViewTweet}
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                    font: "inherit",
                  }}
                  type="button"
                >
                  View on X
                </button>
              </>
            )}
          </div>
        )}

        {!showReplyBox && status === "idle" && (
          <div className="actions">
            <Button
              onClick={() => setShowReplyBox(true)}
              size="sm"
              variant="ghost"
            >
              Reply
            </Button>
            <Button
              loading={isDismissing}
              onClick={handleDismiss}
              size="sm"
              variant="ghost"
            >
              Dismiss
            </Button>
          </div>
        )}

        {showReplyBox && status === "idle" && (
          <div className="reply-box">
            <textarea
              disabled={isReplying}
              maxLength={300}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to @${conversation.author_username}...`}
              value={replyText}
            />
            <div
              className="button-group"
              style={{ justifyContent: "space-between" }}
            >
              <div className={`char-count ${charStatus}`}>{charCount}/280</div>
              <div className="button-group">
                <Button
                  disabled={isReplying}
                  onClick={() => {
                    setShowReplyBox(false);
                    setReplyText("");
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  disabled={!canSubmit}
                  loading={isReplying}
                  onClick={handleReply}
                  size="sm"
                  variant="primary"
                >
                  Reply
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
