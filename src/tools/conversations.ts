/**
 * Twitter Conversations Tool
 *
 * Fetches unreplied mentions and returns data for the conversation list UI.
 * Uses the shared Arcade client for API calls.
 */

import { appendFileSync } from "node:fs";
import { AuthRequiredError, executeTool } from "../arcade/client.js";
import {
  getAvatars,
  pruneExpiredAvatars,
  pruneStaleAvatars,
} from "../state/avatar-cache.js";
import {
  getUsername,
  isDismissed,
  pruneExpiredDismissals,
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

interface UserInfo {
  username: string;
  name: string;
  avatar?: string;
}

/**
 * Build a map of user_id -> user info from the includes.users array
 */
function buildUserMap(users: User[]): Map<string, UserInfo> {
  const userMap = new Map<string, UserInfo>();
  for (const user of users) {
    userMap.set(user.id, {
      username: user.username,
      name: user.name,
      avatar: user.profile_image_url,
    });
  }
  return userMap;
}

/**
 * Build a set of tweet IDs that the user has replied to
 */
function buildRepliedToSet(userTweets: Tweet[]): Set<string> {
  const repliedToIds = new Set<string>();
  for (const tweet of userTweets) {
    const replyRef = tweet.referenced_tweets?.find(
      (ref) => ref.type === "replied_to"
    );
    if (replyRef) {
      repliedToIds.add(replyRef.id);
    }
  }
  return repliedToIds;
}

/**
 * Get timestamp from tweet - use created_at or extract from snowflake ID
 */
function getTweetTimestamp(tweet: Tweet): string {
  if (tweet.created_at) {
    return tweet.created_at;
  }
  const snowflakeDate = timestampFromSnowflake(tweet.id);
  return snowflakeDate ? snowflakeDate.toISOString() : new Date().toISOString();
}

/**
 * Check if a mention should be skipped (not shown in conversations)
 */
function shouldSkipMention(
  mention: Tweet,
  username: string,
  repliedToIds: Set<string>,
  userMap: Map<string, UserInfo>
): { skip: boolean; reason?: string } {
  // Skip retweets
  if (mention.text.startsWith("RT @")) {
    return { skip: true, reason: "retweet" };
  }

  // Skip if user has already replied
  if (repliedToIds.has(mention.id)) {
    return { skip: true, reason: "replied" };
  }

  // Skip if the mention is from the user themselves
  const authorInfo = userMap.get(mention.author_id || "");
  const authorUsername = authorInfo?.username || mention.author_username || "";
  if (authorUsername.toLowerCase() === username.toLowerCase()) {
    return { skip: true, reason: "own_tweet" };
  }

  // Skip if dismissed
  const replyCount = mention.public_metrics?.reply_count || 0;
  if (isDismissed(mention.id, replyCount)) {
    return { skip: true, reason: "dismissed" };
  }

  return { skip: false };
}

/**
 * Convert a mention tweet to a ConversationItem
 */
function mentionToConversation(
  mention: Tweet,
  userMap: Map<string, UserInfo>
): ConversationItem {
  const authorInfo = userMap.get(mention.author_id || "");
  const authorUsername = authorInfo?.username || mention.author_username || "";

  return {
    tweet_id: mention.id,
    author_username: authorUsername || mention.author_id || "unknown",
    author_display_name:
      authorInfo?.name || mention.author_name || authorUsername || "Unknown",
    author_avatar_url: authorInfo?.avatar,
    text: mention.text,
    created_at: getTweetTimestamp(mention),
    reply_count: mention.public_metrics?.reply_count || 0,
    like_count: mention.public_metrics?.like_count || 0,
    retweet_count: mention.public_metrics?.retweet_count || 0,
  };
}

/**
 * Filter mentions to actionable conversations
 */
function filterMentions(
  mentions: Tweet[],
  username: string,
  repliedToIds: Set<string>,
  userMap: Map<string, UserInfo>
): ConversationItem[] {
  const conversations: ConversationItem[] = [];

  for (const mention of mentions) {
    const skipResult = shouldSkipMention(
      mention,
      username,
      repliedToIds,
      userMap
    );
    if (!skipResult.skip) {
      conversations.push(mentionToConversation(mention, userMap));
    }
  }

  // Sort by most recent first
  conversations.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return conversations;
}

/**
 * Fetch and apply avatars to conversations
 */
async function fetchAndApplyAvatars(
  conversations: ConversationItem[]
): Promise<void> {
  const uniqueUsers = new Map<string, string | undefined>();
  for (const conv of conversations) {
    if (!uniqueUsers.has(conv.author_username)) {
      uniqueUsers.set(conv.author_username, conv.author_avatar_url);
    }
  }

  const usersToFetch = Array.from(uniqueUsers.entries()).map(
    ([username, url]) => ({
      username,
      profileImageUrl: url,
    })
  );

  debugLog(`Fetching avatars for ${usersToFetch.length} users`);
  const avatarMap = await getAvatars(usersToFetch);
  debugLog(`Got ${Object.keys(avatarMap).length} avatars`);

  for (const conv of conversations) {
    const dataUrl = avatarMap[conv.author_username.toLowerCase()];
    if (dataUrl) {
      conv.author_avatar_url = dataUrl;
    }
  }

  // Prune avatars for users no longer in conversations
  const activeUsernames = conversations.map((c) => c.author_username);
  const prunedStale = pruneStaleAvatars(activeUsernames);
  if (prunedStale > 0) {
    debugLog(`Pruned ${prunedStale} stale avatars`);
  }
}

/**
 * Create a response object for the MCP tool
 */
function createResponse(data: unknown, isError = false): unknown {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data),
      },
    ],
    ...(isError && { isError: true }),
  };
}

/**
 * Handle conversation fetch errors
 */
function handleConversationsError(error: unknown): unknown {
  console.error("[ASSA] Error fetching conversations:", error);

  if (error instanceof AuthRequiredError) {
    return createResponse(
      "Twitter authorization required. Please use the twitter_auth_status tool to connect your account.",
      true
    );
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.toLowerCase().includes("not authorized") ||
    errorMessage.toLowerCase().includes("unauthorized")
  ) {
    return createResponse(
      "Twitter authorization required. Please use the twitter_auth_status tool to connect your account.",
      true
    );
  }

  return createResponse(`Error fetching conversations: ${errorMessage}`, true);
}

/**
 * Tool: twitter_conversations
 * Fetches unreplied mentions and returns data for the conversation list UI
 */
export async function twitterConversations(): Promise<unknown> {
  // Clean up expired entries
  const prunedDismissals = pruneExpiredDismissals();
  const prunedAvatars = pruneExpiredAvatars();
  if (prunedDismissals > 0 || prunedAvatars > 0) {
    debugLog(
      `Pruned ${prunedDismissals} expired dismissals, ${prunedAvatars} expired avatars`
    );
  }

  const username = getUsername();

  if (!username) {
    return createResponse(
      "I need your Twitter username to find your conversations.\n\nPlease check your auth status with twitter_auth_status first - your username should be detected automatically after authentication."
    );
  }

  console.error(`[ASSA] Fetching conversations for @${username}`);

  try {
    // 1. Search for tweets mentioning @username
    debugLog(`Searching for phrases: ["@${username}"]`);
    const mentionsResponse = await executeTool<SearchResponse>(
      "X.SearchRecentTweetsByKeywords",
      { phrases: [`@${username}`], max_results: 50 }
    );

    debugLog("Raw mentionsResponse:", mentionsResponse);

    const mentions = mentionsResponse.data || [];
    const mentionUsers = mentionsResponse.includes?.users || [];
    debugLog(`Found ${mentions.length} mentions`, {
      hasData: !!mentionsResponse.data,
      mentions,
    });

    if (mentions.length === 0) {
      return createResponse({ conversations: [], username });
    }

    // 2. Search for user's own tweets (to find replies they've made)
    const userTweetsResponse = await executeTool<SearchResponse>(
      "X.SearchRecentTweetsByUsername",
      { username, max_results: 100 }
    );

    const userTweets = userTweetsResponse.data || [];
    console.error(`[ASSA] Found ${userTweets.length} user tweets`);

    // 3. Build lookup structures
    const repliedToIds = buildRepliedToSet(userTweets);
    console.error(`[ASSA] User has replied to ${repliedToIds.size} tweets`);
    const userMap = buildUserMap(mentionUsers);

    // 4. Filter and process conversations
    const conversations = filterMentions(
      mentions,
      username,
      repliedToIds,
      userMap
    );

    // 5. Fetch and apply avatars
    await fetchAndApplyAvatars(conversations);

    // Update last checked timestamp
    updateLastChecked();

    return createResponse({ conversations, username });
  } catch (error) {
    return handleConversationsError(error);
  }
}
