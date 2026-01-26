/**
 * Twitter Draft Tweet Tool
 * 
 * Creates a draft tweet and shows a preview UI for approval.
 * Does NOT post the tweet - that happens when user clicks Post in the UI.
 * 
 * TODO: Implement this tool
 * - Validate tweet length (max 280)
 * - If reply, fetch context of original tweet
 * - Build TweetPreview UI with Post/Edit/Cancel buttons
 */

import { createUIResource } from '@mcp-ui/server';
import { createTweetPreviewUI } from '../ui/tweet-preview.js';
import { arcadeClient } from '../arcade/client.js';
import { ensureAuth } from '../auth/manager.js';

interface DraftTweetArgs {
  text: string;
  reply_to_id?: string;
  quote_tweet_id?: string;
}

export async function twitterDraftTweet(
  args: Record<string, unknown>
): Promise<unknown> {
  const { text, reply_to_id, quote_tweet_id } = args as unknown as DraftTweetArgs;
  
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
          type: 'text',
          text: `Tweet is too long (${text.length}/280 characters). Please shorten it.`,
        },
      ],
    };
  }

  // Fetch reply context if replying
  let replyContext = null;
  if (reply_to_id) {
    try {
      replyContext = await arcadeClient.getTweet(reply_to_id);
    } catch {
      // If we can't fetch context, continue without it
    }
  }

  // Fetch quote tweet context if quote tweeting
  let quoteContext = null;
  if (quote_tweet_id) {
    try {
      quoteContext = await arcadeClient.getTweet(quote_tweet_id);
    } catch {
      // If we can't fetch context, continue without it
    }
  }

  const draftData = {
    text,
    charCount: text.length,
    replyTo: replyContext ? {
      id: reply_to_id!,
      author: replyContext.author.handle,
      text: replyContext.text,
    } : undefined,
    quoteTweet: quoteContext ? {
      id: quote_tweet_id!,
      author: quoteContext.author.handle,
      text: quoteContext.text,
    } : undefined,
  };

  return {
    content: [
      {
        type: 'text',
        text: `Draft tweet ready (${text.length}/280 characters):\n\n"${text}"\n\nReview the preview below and click Post to publish.`,
      },
      createUIResource({
        uri: `ui://assa/tweet-preview/${Date.now()}`,
        content: {
          type: 'rawHtml',
          htmlString: createTweetPreviewUI(draftData),
        },
        encoding: 'text',
      }),
    ],
  };
}
