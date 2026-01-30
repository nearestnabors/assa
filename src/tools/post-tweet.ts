/**
 * X Post Tweet Tool
 *
 * Actually posts the tweet. Usually called from TweetPreview UI after user approval.
 * Calls Arcade X API to post - the API handles character limit validation
 * (280 for free tier, 25,000 for X Premium).
 */

import { arcadeClient } from "../arcade/client.js";
import { handleToolError } from "../auth/manager.js";
import { markReplied } from "../state/manager.js";

interface PostTweetArgs {
  text: string;
  reply_to_id?: string;
  quote_tweet_id?: string;
}

export async function xPostTweet(
  args: Record<string, unknown>
): Promise<unknown> {
  const { text, reply_to_id, quote_tweet_id } =
    args as unknown as PostTweetArgs;

  // Don't pre-check auth - let the tool execution handle it.
  // The Arcade SDK will return auth info if needed, and handleToolError
  // will convert it to the auth UI response.

  // Note: Character limit validation is handled by the X API
  // (280 for free tier, 25,000 for X Premium)

  // Post the tweet via Arcade
  try {
    const result = await arcadeClient.postTweet({
      text,
      reply_to_id,
      quote_tweet_id,
    });

    // Mark the tweet as replied-to in local state (for filtering)
    if (reply_to_id) {
      markReplied(reply_to_id);
    }

    // Return JSON for UI parsing
    return {
      content: [
        {
          type: "text",
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
