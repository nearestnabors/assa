import { dismissTweet } from "../state/manager.js";

interface DismissConversationArgs {
  tweet_id?: string;
  reply_count?: number;
}

/**
 * Tool: twitter_dismiss_conversation
 * Dismisses a conversation (hides it from the list until new activity)
 */
export function twitterDismissConversation(
  args: DismissConversationArgs
): Promise<unknown> {
  const { tweet_id, reply_count } = args;

  if (!tweet_id) {
    return Promise.resolve({
      content: [
        {
          type: "text",
          text: "Missing required parameter: tweet_id",
        },
      ],
      isError: true,
    });
  }

  // Default reply count to 0 if not provided
  const currentReplyCount = reply_count ?? 0;

  // Dismiss the tweet
  dismissTweet(tweet_id, currentReplyCount);

  return Promise.resolve({
    content: [
      {
        type: "text",
        text: `Conversation dismissed. It will reappear if there's new activity (new replies).\n\nUse twitter_conversations to see your remaining conversations.`,
      },
    ],
  });
}
