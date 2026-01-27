/**
 * Twitter Post Tweet Tool
 * 
 * Actually posts the tweet. Usually called from TweetPreview UI after user approval.
 * 
 * TODO: Implement this tool
 * - Validate tweet
 * - Call Arcade Twitter API to post
 * - Return success confirmation with link to posted tweet
 */

import { arcadeClient } from '../arcade/client.js';
import { ensureAuth, handleToolError } from '../auth/manager.js';

interface PostTweetArgs {
  text: string;
  reply_to_id?: string;
  quote_tweet_id?: string;
}

export async function twitterPostTweet(
  args: Record<string, unknown>
): Promise<unknown> {
  const { text, reply_to_id, quote_tweet_id } = args as unknown as PostTweetArgs;

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

    return {
      content: [
        {
          type: 'text',
          text: `✓ Tweet posted successfully!\n\nView it here: ${result.url}`,
        },
      ],
    };
  } catch (error) {
    return handleToolError(error);
  }
}
