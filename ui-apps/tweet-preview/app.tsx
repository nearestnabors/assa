/**
 * Tweet Preview React App
 *
 * Displays draft tweet with Post/Edit/Cancel actions.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/button";
import { useAuthPoller } from "@/hooks/use-auth-poller";
import { useMcpApp } from "@/hooks/use-mcp-app";
import {
  type AuthRequiredResponse,
  getCharCountStatus,
  isAuthRequired,
  truncate,
} from "@/hooks/utils";

interface TweetDraft {
  text: string;
  charCount: number;
  replyTo?: {
    id: string;
    author: string;
    text: string;
  };
  quoteTweet?: {
    id: string;
    author: string;
    text: string;
  };
}

type AppState = "loading" | "auth-required" | "preview" | "success" | "error";

export function TweetPreviewApp() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [authData, setAuthData] = useState<AuthRequiredResponse | null>(null);
  const [draft, setDraft] = useState<TweetDraft | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { initialData, callTool, openLink, updateContext, parseResult } =
    useMcpApp<TweetDraft | AuthRequiredResponse>({
      name: "ASSA Tweet Preview",
      version: "1.0.0",
      autoResize: true,
    });

  // Post the tweet
  const postTweet = useCallback(async () => {
    if (!draft) {
      return;
    }

    setIsPosting(true);
    setErrorMessage("");

    try {
      const params: Record<string, unknown> = { text: draft.text };
      if (draft.replyTo?.id) {
        params.reply_to_id = draft.replyTo.id;
      }
      if (draft.quoteTweet?.id) {
        params.quote_tweet_id = draft.quoteTweet.id;
      }

      const result = await callTool("x_post_tweet", params);
      const data = parseResult<{
        success?: boolean;
        error?: string;
        tweet_id?: string;
      }>(result);

      if (data?.error) {
        // Check if it's an auth error
        if (isAuthRequired(data)) {
          setAuthData(data as unknown as AuthRequiredResponse);
          setAppState("auth-required");
          return;
        }
        throw new Error(data.error);
      }

      setAppState("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to post tweet"
      );
      setAppState("error");
    } finally {
      setIsPosting(false);
    }
  }, [draft, callTool, parseResult]);

  // Auth poller for re-auth flow
  const authPoller = useAuthPoller({
    callTool,
    openLink,
    onAuthComplete: async () => {
      // After re-auth, retry posting
      await postTweet();
    },
  });

  // Handle initial data
  useEffect(() => {
    if (!initialData) {
      return;
    }

    // Handle string messages - shouldn't happen for tweet-preview
    if (typeof initialData === "string") {
      console.warn("Tweet preview received string instead of draft data");
      return;
    }

    if (isAuthRequired(initialData)) {
      setAuthData(initialData);
      setAppState("auth-required");
    } else if (
      typeof initialData === "object" &&
      initialData !== null &&
      "text" in initialData
    ) {
      setDraft(initialData);
      setAppState("preview");
    }
  }, [initialData]);

  // Handle cancel
  const handleCancel = async () => {
    await updateContext("User cancelled the tweet draft.");
  };

  // Handle edit
  const handleEdit = async () => {
    if (draft) {
      await updateContext(
        `User wants to edit this tweet draft: "${draft.text}"`
      );
    }
  };

  // Handle connect
  const handleConnect = async () => {
    if (authData?.authUrl) {
      await authPoller.startAuth(authData.authUrl);
    }
  };

  // Render loading
  if (appState === "loading") {
    return (
      <div
        className="container flex flex-col items-center justify-center gap-4"
        style={{ padding: 40 }}
      >
        <div className="loading loading-lg" />
        <p className="text-muted">Loading preview...</p>
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
          Connect your X account to post this tweet.
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

  // Render success
  if (appState === "success") {
    return (
      <div
        className="container flex flex-col items-center gap-4"
        style={{ padding: 40 }}
      >
        <div style={{ fontSize: 48 }}>✓</div>
        <h2 style={{ color: "var(--color-success)" }}>Tweet Posted!</h2>
        <p className="text-muted">
          Your tweet has been published successfully.
        </p>
      </div>
    );
  }

  // Render error
  if (appState === "error") {
    return (
      <div
        className="container flex flex-col items-center gap-4"
        style={{ padding: 40 }}
      >
        <div style={{ fontSize: 48 }}>✕</div>
        <h2 style={{ color: "var(--color-error)" }}>Failed to Post</h2>
        <p className="text-muted">{errorMessage}</p>
        <div className="button-group">
          <Button onClick={() => setAppState("preview")} variant="secondary">
            Back to Preview
          </Button>
          <Button onClick={postTweet} variant="primary">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Render preview
  if (!draft) {
    return null;
  }

  const charStatus = getCharCountStatus(draft.charCount);
  const canPost = draft.charCount <= 280 && draft.charCount > 0;

  return (
    <div className="loaded container">
      <div className="tweet-preview">
        <div className="preview-header">Tweet Preview</div>

        {/* Reply context */}
        {draft.replyTo && (
          <div className="quoted-tweet" style={{ marginTop: 0 }}>
            <div className="quoted-author">
              Replying to @{draft.replyTo.author}
            </div>
            {draft.replyTo.text && (
              <div className="quoted-text">
                {truncate(draft.replyTo.text, 100)}
              </div>
            )}
          </div>
        )}

        {/* Tweet content */}
        <div className="tweet-content">{draft.text}</div>

        {/* Quote context */}
        {draft.quoteTweet && (
          <div className="quoted-tweet">
            <div className="quoted-author">@{draft.quoteTweet.author}</div>
            {draft.quoteTweet.text && (
              <div className="quoted-text">
                {truncate(draft.quoteTweet.text, 80)}
              </div>
            )}
          </div>
        )}

        {/* Character count */}
        <div className={`char-count ${charStatus}`}>{draft.charCount}/280</div>

        {/* Actions */}
        <div className="button-group" style={{ justifyContent: "flex-end" }}>
          <Button onClick={handleCancel} variant="ghost">
            Cancel
          </Button>
          <Button onClick={handleEdit} variant="secondary">
            Edit
          </Button>
          <Button
            disabled={!canPost}
            loading={isPosting}
            onClick={postTweet}
            variant="primary"
          >
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}
