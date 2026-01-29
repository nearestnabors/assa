import { dismissTweet } from '../state/manager.js';

interface DismissConversationArgs {
  tweet_id?: string;
  reply_count?: number;
}

/**
 * Tool: x_dismiss_conversation
 * Dismisses a conversation (hides it from the list until new activity)
 */
export async function xDismissConversation(
  args: DismissConversationArgs
): Promise<unknown> {
  const { tweet_id, reply_count } = args;

  if (!tweet_id) {
    return {
      content: [
        {
          type: 'text',
          text: 'Missing required parameter: tweet_id',
        },
      ],
      isError: true,
    };
  }

  // Default reply count to 0 if not provided
  const currentReplyCount = reply_count ?? 0;

  // Dismiss the tweet
  dismissTweet(tweet_id, currentReplyCount);

  return {
    content: [
      {
        type: 'text',
        text: `Conversation dismissed. It will reappear if there's new activity (new replies).\n\nUse x_conversations to see your remaining conversations.`,
      },
    ],
  };
}
