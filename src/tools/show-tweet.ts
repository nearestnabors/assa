/**
 * Show Tweet Tool
 *
 * Displays a single tweet as a rich card UI with reply functionality.
 * Used for "Read more" links in the timeline digest.
 */

import { executeTool } from "../arcade/client.js";

interface TweetData {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    reply_count: number;
    like_count: number;
    retweet_count: number;
    quote_count: number;
  };
}

interface UserData {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
}

interface LookupTweetResponse {
  data?: TweetData;
  includes?: {
    users?: UserData[];
  };
}

/**
 * Fetch tweet by ID using Arcade's X.LookupTweetById
 */
async function fetchTweet(
  tweetId: string
): Promise<{ tweet: TweetData; author: UserData } | null> {
  try {
    const result = await executeTool<LookupTweetResponse>("X.LookupTweetById", {
      tweet_id: tweetId,
    });

    const response = result as LookupTweetResponse;

    if (!response.data) {
      return null;
    }

    const tweet = response.data;
    const author = response.includes?.users?.find(
      (u) => u.id === tweet.author_id
    ) || {
      id: tweet.author_id,
      username: "unknown",
      name: "Unknown User",
    };

    return { tweet, author };
  } catch (error) {
    console.error("Error fetching tweet:", error);
    return null;
  }
}

/**
 * Tool: x_show_tweet
 * Displays a single tweet as a rich card with reply functionality
 */
export async function xShowTweet(
  args: Record<string, unknown>
): Promise<unknown> {
  const tweet_id = args.tweet_id as string;

  if (!tweet_id) {
    return {
      content: [
        {
          type: "text",
          text: "Error: tweet_id is required",
        },
      ],
      isError: true,
    };
  }

  const result = await fetchTweet(tweet_id);

  if (!result) {
    return {
      content: [
        {
          type: "text",
          text: `Could not find tweet with ID: ${tweet_id}`,
        },
      ],
      isError: true,
    };
  }

  const { tweet, author } = result;

  // Format the data for the conversation-list UI
  const conversationData = {
    conversations: [
      {
        tweet_id: tweet.id,
        author_username: author.username,
        author_display_name: author.name,
        author_avatar_url: author.profile_image_url,
        text: tweet.text,
        created_at: tweet.created_at,
        reply_count: tweet.public_metrics?.reply_count || 0,
        like_count: tweet.public_metrics?.like_count || 0,
        retweet_count: tweet.public_metrics?.retweet_count || 0,
      },
    ],
    username: "", // Not needed for display
    totalCount: 1,
    hasMore: false,
  };

  return {
    content: [
      {
        type: "text",
        text: `Showing tweet from @${author.username}`,
      },
    ],
    // Return the data that will be passed to the UI
    _meta: {
      uiData: conversationData,
    },
  };
}
