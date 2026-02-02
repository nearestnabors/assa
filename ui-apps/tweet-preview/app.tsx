/**
 * Tweet Preview React App
 *
 * Displays draft tweet with Post/Edit/Cancel actions.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/button";
import { type AppState, StateContainer } from "@/components/state-container";
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

type PreviewAppState = AppState | "preview";

export function TweetPreviewApp() {
  const [appState, setAppState] = useState<PreviewAppState>("loading");
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
    onAuthComplete: postTweet,
  });

  // Handle initial data
  useEffect(() => {
    if (!initialData) {
      return;
    }

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

  const handleCancel = () => updateContext("User cancelled the tweet draft.");
  const handleEdit = () => {
    if (draft) {
      updateContext(`User wants to edit this tweet draft: "${draft.text}"`);
    }
  };
  const handleConnect = () => {
    if (authData?.authUrl) {
      authPoller.startAuth(authData.authUrl);
    }
  };

  // Use StateContainer for loading, auth, error, and success states
  if (appState !== "preview") {
    return (
      <StateContainer
        authData={authData}
        authDescription="Connect your X account to post this tweet."
        authPoller={authPoller}
        errorMessage={errorMessage}
        loadingMessage="Loading preview..."
        onBack={() => setAppState("preview")}
        onConnect={handleConnect}
        onRetry={postTweet}
        state={appState as AppState}
        successMessage="Your tweet has been published successfully."
        successTitle="Tweet Posted!"
      />
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
          <div className="quoted-tweet">
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
        <div className="button-group justify-end">
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
