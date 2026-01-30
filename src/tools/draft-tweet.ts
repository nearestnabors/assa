/**
 * Twitter Draft Tweet Tool
 *
 * Creates a draft tweet and returns data for the preview UI.
 * Does NOT post the tweet - that happens when user clicks Post in the UI,
 * which calls twitter_post_tweet directly via MCP Apps.
 */

import { arcadeClient } from "../arcade/client.js";
import { ensureAuth } from "../auth/manager.js";

interface DraftTweetArgs {
  text: string;
  reply_to_id?: string;
  quote_tweet_id?: string;
}

interface TweetContext {
  author: { handle: string };
  text: string;
}

export async function twitterDraftTweet(
  args: Record<string, unknown>
): Promise<unknown> {
  const { text, reply_to_id, quote_tweet_id } =
    args as unknown as DraftTweetArgs;

  // Check authentication
  const authResult = await ensureAuth();
  if (authResult) {
    return authResult;
  }

  // Validate tweet length
  if (text.length > 280) {
    return {
      content: [
        {
          type: "text",
          text: `Tweet is too long (${text.length}/280 characters). Please shorten it.`,
        },
      ],
    };
  }

  // Fetch reply context if replying
  let replyContext: TweetContext | null = null;
  if (reply_to_id) {
    try {
      replyContext = await arcadeClient.getTweet(reply_to_id);
    } catch {
      // If we can't fetch context, continue without it
    }
  }

  // Fetch quote tweet context if quote tweeting
  let quoteContext: TweetContext | null = null;
  if (quote_tweet_id) {
    try {
      quoteContext = await arcadeClient.getTweet(quote_tweet_id);
    } catch {
      // If we can't fetch context, continue without it
    }
  }

  // Return JSON data for the tweet-preview UI app
  const draftData = {
    text,
    charCount: text.length,
    replyTo: replyContext
      ? {
          id: reply_to_id!,
          author: replyContext.author.handle,
          text: replyContext.text,
        }
      : undefined,
    quoteTweet: quoteContext
      ? {
          id: quote_tweet_id!,
          author: quoteContext.author.handle,
          text: quoteContext.text,
        }
      : undefined,
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(draftData),
      },
    ],
  };
}
