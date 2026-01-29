/**
 * Twitter Post Tweet Tool
 *
 * Actually posts the tweet. Usually called from TweetPreview UI after user approval.
 * Validates tweet length (280 chars) and calls Arcade X API to post.
 */

import { arcadeClient } from '../arcade/client.js';
import { handleToolError } from '../auth/manager.js';

interface PostTweetArgs {
  text: string;
  reply_to_id?: string;
  quote_tweet_id?: string;
}

export async function twitterPostTweet(
  args: Record<string, unknown>
): Promise<unknown> {
  const { text, reply_to_id, quote_tweet_id } = args as unknown as PostTweetArgs;

  // Don't pre-check auth - let the tool execution handle it.
  // The Arcade SDK will return auth info if needed, and handleToolError
  // will convert it to the auth UI response.

  // Validate tweet length
  if (text.length > 280) {
    return {
      content: [
        {
          type: 'text',
          text: `Tweet is too long (${text.length}/280 characters). Cannot post.`,
        },
      ],
      isError: true,
    };
  }

  // Post the tweet via Arcade
  try {
    const result = await arcadeClient.postTweet({
      text,
      reply_to_id,
      quote_tweet_id,
    });

    // Return JSON for UI parsing
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            text,
            url: result.url,
            reply_to_id,
          }),
        },
      ],
    };
  } catch (error) {
    // handleToolError will return authRequired response for auth errors
    // or a generic error for other errors
    return handleToolError(error);
  }
}
