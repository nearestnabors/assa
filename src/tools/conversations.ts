/**
 * X Conversations Tool
 *
 * Fetches unreplied mentions and returns data for the conversation list UI.
 * Uses the shared Arcade client for API calls.
 */

import { appendFileSync } from "node:fs";
import { AuthRequiredError, executeTool } from "../arcade/client.js";
import {
  getUsername,
  isDismissed,
  isRepliedTo,
  pruneExpiredDismissals,
  pruneStaleReplies,
  updateLastChecked,
} from "../state/manager.js";
import { timestampFromSnowflake } from "../utils/time.js";

const DEBUG_LOG = "/tmp/assa-conversations-debug.log";
function debugLog(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const line = data
    ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}\n`
    : `[${timestamp}] ${message}\n`;
  try {
    appendFileSync(DEBUG_LOG, line);
  } catch {
    // ignore write errors
  }
}

interface Tweet {
  id: string;
  text: string;
  author_id?: string;
  author_username?: string;
  author_name?: string;
  created_at?: string;
  tweet_url?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{
    type: string;
    id: string;
  }>;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
  };
}

interface User {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
}

// Arcade SDK executeTool returns the value directly: { data: [...], includes: { users: [...] } }
interface SearchResponse {
  data?: Tweet[];
  includes?: {
    users?: User[];
  };
  meta?: {
    result_count?: number;
  };
}

interface ConversationItem {
  tweet_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url?: string;
  text: string;
  created_at: string;
  reply_count: number;
  like_count: number;
  retweet_count: number;
}

/**
 * Tool: x_conversations
 * Fetches unreplied mentions and returns data for the conversation list UI
 */
type FetchResult =
  | {
      success: true;
      data: {
        conversations: ConversationItem[];
        username: string;
        totalCount: number;
        hasMore: boolean;
      };
    }
  | { success: false; content: unknown };

interface FetchOptions {
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 10;

// Internal function that fetches and returns conversation data
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: multi-step API orchestration with filtering
async function fetchConversations(
  options: FetchOptions = {}
): Promise<FetchResult> {
  const { limit = DEFAULT_LIMIT, offset = 0 } = options;
  // Clean up expired dismissals
  const prunedDismissals = pruneExpiredDismissals();
  if (prunedDismissals > 0) {
    debugLog(`Pruned ${prunedDismissals} expired dismissals`);
  }

  const username = getUsername();

  // Check if username is set
  if (!username) {
    return {
      success: false,
      content: {
        content: [
          {
            type: "text",
            text: "I need your X username to find your conversations.\n\nPlease check your auth status with x_auth_status first - your username should be detected automatically after authentication.",
          },
        ],
      },
    };
  }

  console.error(`[ASSA] Fetching conversations for @${username}`);

  try {
    // 1. Search for tweets mentioning @username
    debugLog(`Searching for phrases: ["@${username}"]`);
    const mentionsResponse = await executeTool<SearchResponse>(
      "X.SearchRecentTweetsByKeywords",
      {
        phrases: [`@${username}`],
        max_results: 50,
      }
    );

    // Debug: Log the raw response structure to file
    debugLog("Raw mentionsResponse:", mentionsResponse);

    const mentions = mentionsResponse.data || [];
    const mentionUsers = mentionsResponse.includes?.users || [];
    debugLog(`Found ${mentions.length} mentions`, {
      hasData: !!mentionsResponse.data,
      mentions,
    });

    // Clean up replied_to entries that are no longer in the API results
    const mentionIds = mentions.map((m) => m.id);
    const prunedReplies = pruneStaleReplies(mentionIds);
    if (prunedReplies > 0) {
      debugLog(`Pruned ${prunedReplies} stale replied-to entries`);
    }

    if (mentions.length === 0) {
      return {
        success: true,
        data: {
          conversations: [],
          username,
          totalCount: 0,
          hasMore: false,
        },
      };
    }

    // 2. Search for user's own tweets (to find replies they've made)
    const userTweetsResponse = await executeTool<SearchResponse>(
      "X.SearchRecentTweetsByUsername",
      {
        username,
        max_results: 100,
      }
    );

    const userTweets = userTweetsResponse.data || [];
    console.error(`[ASSA] Found ${userTweets.length} user tweets`);

    // Debug: log user tweets response structure
    debugLog("User tweets response structure", {
      hasData: !!userTweetsResponse.data,
      tweetCount: userTweets.length,
      sampleTweet: userTweets[0]
        ? {
            id: userTweets[0].id,
            text: userTweets[0].text?.slice(0, 50),
            referenced_tweets: userTweets[0].referenced_tweets,
            in_reply_to_user_id: userTweets[0].in_reply_to_user_id,
          }
        : null,
    });

    // 3. Build a set of tweet IDs that the user has replied to
    const repliedToIds = new Set<string>();
    for (const tweet of userTweets) {
      // Check if this tweet is a reply to another tweet
      const replyRef = tweet.referenced_tweets?.find(
        (ref) => ref.type === "replied_to"
      );
      if (replyRef) {
        repliedToIds.add(replyRef.id);
        debugLog(`Found reply: ${tweet.id} replied to ${replyRef.id}`);
      }
    }
    console.error(`[ASSA] User has replied to ${repliedToIds.size} tweets`);
    debugLog("Replied to IDs", Array.from(repliedToIds));

    // 4. Build user lookup map for display names
    const userMap = new Map<
      string,
      { username: string; name: string; avatar?: string }
    >();
    for (const user of mentionUsers) {
      userMap.set(user.id, {
        username: user.username,
        name: user.name,
        avatar: user.profile_image_url,
      });
    }

    // 5. Filter mentions to only actionable conversations
    const conversations: ConversationItem[] = [];
    let skippedRetweets = 0;
    let skippedRepliedTo = 0;
    let skippedOwnTweets = 0;
    let skippedDismissed = 0;

    for (const mention of mentions) {
      // Skip retweets - they're not conversations needing reply
      if (mention.text.startsWith("RT @")) {
        skippedRetweets++;
        continue;
      }

      // Skip if user has already replied (via API or locally tracked)
      if (repliedToIds.has(mention.id) || isRepliedTo(mention.id)) {
        skippedRepliedTo++;
        continue;
      }

      // Skip if the mention is from the user themselves
      // Prefer authorInfo from includes.users (reliable) over inline fields (unreliable)
      const authorInfo = userMap.get(mention.author_id || "");
      const authorUsername =
        authorInfo?.username || mention.author_username || "";
      if (authorUsername.toLowerCase() === username.toLowerCase()) {
        skippedOwnTweets++;
        continue;
      }

      const replyCount = mention.public_metrics?.reply_count || 0;

      // Skip if dismissed (but show again if reply count increased)
      if (isDismissed(mention.id, replyCount)) {
        skippedDismissed++;
        continue;
      }

      // Get timestamp from snowflake ID if created_at is missing
      let timestamp: string;
      if (mention.created_at) {
        timestamp = mention.created_at;
      } else {
        const snowflakeDate = timestampFromSnowflake(mention.id);
        timestamp = snowflakeDate
          ? snowflakeDate.toISOString()
          : new Date().toISOString();
      }

      // Debug avatar resolution
      debugLog(`Avatar for ${authorUsername}`, {
        author_id: mention.author_id,
        authorInfo_exists: !!authorInfo,
        authorInfo_avatar: authorInfo?.avatar,
      });

      conversations.push({
        tweet_id: mention.id,
        author_username: authorUsername || mention.author_id || "unknown",
        author_display_name:
          authorInfo?.name ||
          mention.author_name ||
          authorUsername ||
          "Unknown",
        author_avatar_url: authorInfo?.avatar,
        text: mention.text,
        created_at: timestamp,
        reply_count: replyCount,
        like_count: mention.public_metrics?.like_count || 0,
        retweet_count: mention.public_metrics?.retweet_count || 0,
      });
    }

    debugLog("Filtering stats", {
      total: mentions.length,
      skippedRetweets,
      skippedRepliedTo,
      skippedOwnTweets,
      skippedDismissed,
      remaining: conversations.length,
    });

    // Sort by most recent first
    conversations.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Set avatar URLs to unavatar.io - CSP configured in server.ts resourceDomains
    for (const conv of conversations) {
      conv.author_avatar_url = `https://unavatar.io/twitter/${conv.author_username}`;
    }

    // Update last checked timestamp
    updateLastChecked();

    // Apply pagination
    const totalCount = conversations.length;
    const paginatedConversations = conversations.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    debugLog("Pagination", {
      totalCount,
      offset,
      limit,
      returning: paginatedConversations.length,
      hasMore,
    });

    return {
      success: true,
      data: {
        conversations: paginatedConversations,
        username,
        totalCount,
        hasMore,
      },
    };
  } catch (error) {
    console.error("[ASSA] Error fetching conversations:", error);

    // Check for auth errors using AuthRequiredError
    if (error instanceof AuthRequiredError) {
      return {
        success: false,
        content: {
          content: [
            {
              type: "text",
              text: "X authorization required. Please use the x_auth_status tool to connect your account.",
            },
          ],
          isError: true,
        },
      };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Fallback check for auth-related error messages
    if (
      errorMessage.toLowerCase().includes("not authorized") ||
      errorMessage.toLowerCase().includes("unauthorized")
    ) {
      return {
        success: false,
        content: {
          content: [
            {
              type: "text",
              text: "X authorization required. Please use the x_auth_status tool to connect your account.",
            },
          ],
          isError: true,
        },
      };
    }

    return {
      success: false,
      content: {
        content: [
          {
            type: "text",
            text: `Error fetching conversations: ${errorMessage}`,
          },
        ],
        isError: true,
      },
    };
  }
}

/**
 * Tool: x_conversations (for agent)
 * Returns a brief message - UI fetches full data via x_get_conversations
 */
export async function xConversations(): Promise<unknown> {
  const result = await fetchConversations();

  if (!result.success) {
    return result.content;
  }

  const count = result.data.conversations.length;
  return {
    content: [
      {
        type: "text",
        text:
          count === 0
            ? "No conversations awaiting your reply."
            : `${count} conversation${count === 1 ? "" : "s"} awaiting your reply.`,
      },
    ],
  };
}

/**
 * Tool: x_get_conversations (for UI only, hidden from model)
 * Returns full conversation data as JSON with pagination support
 */
export async function xGetConversations(params?: {
  limit?: number;
  offset?: number;
}): Promise<unknown> {
  const result = await fetchConversations({
    limit: params?.limit,
    offset: params?.offset,
  });

  if (!result.success) {
    // Return JSON error so UI can parse it
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: true,
            message: "Please authenticate with x_auth_status first",
            conversations: [],
            username: "",
            totalCount: 0,
            hasMore: false,
          }),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result.data),
      },
    ],
  };
}
