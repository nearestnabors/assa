import { createUIResource } from '@mcp-ui/server';
import { appendFileSync } from 'fs';
import { getUsername, isDismissed, updateLastChecked } from '../state/manager.js';
import { createConversationListUI, type ConversationItem } from '../ui/conversation-list.js';
import { timestampFromSnowflake } from '../utils/time.js';

const DEBUG_LOG = '/tmp/assa-conversations-debug.log';
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

// Arcade API configuration
const ARCADE_API_KEY = process.env.ARCADE_API_KEY;
const ARCADE_BASE_URL = process.env.ARCADE_BASE_URL || 'https://api.arcade.dev/v1';
const ARCADE_USER_ID = process.env.ARCADE_USER_ID || 'assa-default-user';

/**
 * Make an authenticated request to the Arcade API
 */
async function arcadeRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<T> {
  if (!ARCADE_API_KEY) {
    throw new Error('ARCADE_API_KEY not configured');
  }

  const url = `${ARCADE_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ARCADE_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Arcade API error (${response.status}): ${responseText}`);
  }

  return JSON.parse(responseText) as T;
}

/**
 * Execute an Arcade tool
 */
async function executeTool<T>(toolName: string, input: Record<string, unknown>): Promise<T> {
  const response = await arcadeRequest<{
    output?: T;
    status: string;
    error?: string;
  }>('POST', '/tools/execute', {
    tool_name: toolName,
    input,
    user_id: ARCADE_USER_ID,
  });

  if (response.error) {
    throw new Error(`Tool ${toolName} failed: ${response.error}`);
  }

  return response.output as T;
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

// Arcade API response structure: { value: { data: [...], includes: { users: [...] } } }
interface SearchResponse {
  value: {
    data?: Tweet[];
    includes?: {
      users?: User[];
    };
    meta?: {
      result_count?: number;
    };
  };
}

/**
 * Tool: twitter_conversations
 * Fetches unreplied mentions and presents them as a conversation inbox
 */
export async function twitterConversations(): Promise<unknown> {
  const username = getUsername();

  // Check if username is set
  if (!username) {
    return {
      content: [
        {
          type: 'text',
          text: `I need your Twitter username to find your conversations.\n\nPlease check your auth status with twitter_auth_status first - your username should be detected automatically after authentication.`,
        },
      ],
    };
  }

  console.error(`[ASSA] Fetching conversations for @${username}`);

  try {
    // 1. Search for tweets mentioning @username
    debugLog(`Searching for phrases: ["@${username}"]`);
    const mentionsResponse = await executeTool<SearchResponse>(
      'X.SearchRecentTweetsByKeywords',
      {
        phrases: [`@${username}`],
        max_results: 50,
      }
    );

    // Debug: Log the raw response structure to file
    debugLog('Raw mentionsResponse:', mentionsResponse);

    const mentions = mentionsResponse.value?.data || [];
    const mentionUsers = mentionsResponse.value?.includes?.users || [];
    debugLog(`Found ${mentions.length} mentions`, { hasValueData: !!mentionsResponse.value?.data, mentions });

    if (mentions.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No mentions found for @${username} in the last 7 days.\n\nTwitter's search API only returns tweets from the past week.`,
          },
          createUIResource({
            uri: `ui://assa/conversations/empty`,
            content: {
              type: 'rawHtml',
              htmlString: createConversationListUI({
                conversations: [],
                username,
              }),
            },
            encoding: 'text',
          }),
        ],
      };
    }

    // 2. Search for user's own tweets (to find replies they've made)
    const userTweetsResponse = await executeTool<SearchResponse>(
      'X.SearchRecentTweetsByUsername',
      {
        username,
        max_results: 100,
      }
    );

    const userTweets = userTweetsResponse.value?.data || [];
    console.error(`[ASSA] Found ${userTweets.length} user tweets`);

    // 3. Build a set of tweet IDs that the user has replied to
    const repliedToIds = new Set<string>();
    for (const tweet of userTweets) {
      // Check if this tweet is a reply to another tweet
      const replyRef = tweet.referenced_tweets?.find((ref) => ref.type === 'replied_to');
      if (replyRef) {
        repliedToIds.add(replyRef.id);
      }
    }
    console.error(`[ASSA] User has replied to ${repliedToIds.size} tweets`);

    // 4. Build user lookup map for display names
    const userMap = new Map<string, { username: string; name: string; avatar?: string }>();
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
      if (mention.text.startsWith('RT @')) {
        skippedRetweets++;
        continue;
      }

      // Skip if user has already replied
      if (repliedToIds.has(mention.id)) {
        skippedRepliedTo++;
        continue;
      }

      // Skip if the mention is from the user themselves
      // Check both the userMap lookup AND the inline author_username field
      const authorInfo = userMap.get(mention.author_id || '');
      const authorUsername = mention.author_username || authorInfo?.username || '';
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
        timestamp = snowflakeDate ? snowflakeDate.toISOString() : new Date().toISOString();
      }

      conversations.push({
        tweet_id: mention.id,
        author_username: authorUsername || mention.author_id || 'unknown',
        author_display_name: mention.author_name || authorInfo?.name || authorUsername || 'Unknown',
        author_avatar_url: authorInfo?.avatar,
        text: mention.text,
        created_at: timestamp,
        reply_count: replyCount,
        like_count: mention.public_metrics?.like_count || 0,
        retweet_count: mention.public_metrics?.retweet_count || 0,
      });
    }

    debugLog('Filtering stats', {
      total: mentions.length,
      skippedRetweets,
      skippedRepliedTo,
      skippedOwnTweets,
      skippedDismissed,
      remaining: conversations.length,
    });

    // Sort by most recent first
    conversations.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Update last checked timestamp
    updateLastChecked();

    const awaitingCount = conversations.length;
    const statusText =
      awaitingCount === 0
        ? `All caught up! No conversations need your attention.`
        : `Found ${awaitingCount} conversation${awaitingCount === 1 ? '' : 's'} awaiting your reply.`;

    return {
      content: [
        {
          type: 'text',
          text: statusText,
        },
        createUIResource({
          uri: `ui://assa/conversations/${Date.now()}`,
          content: {
            type: 'rawHtml',
            htmlString: createConversationListUI({
              conversations,
              username,
            }),
          },
          encoding: 'text',
        }),
      ],
    };
  } catch (error) {
    console.error('[ASSA] Error fetching conversations:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for auth errors
    if (
      errorMessage.toLowerCase().includes('not authorized') ||
      errorMessage.toLowerCase().includes('unauthorized')
    ) {
      return {
        content: [
          {
            type: 'text',
            text: `Twitter authorization required. Please use the twitter_auth_status tool to connect your account.`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Error fetching conversations: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}
