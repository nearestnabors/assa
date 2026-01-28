/**
 * Arcade.dev API Client
 *
 * Handles all communication with Arcade for Twitter/X OAuth and API calls.
 *
 * Arcade API:
 * - Auth: POST /auth/authorize, GET /auth/status
 * - Tools: POST /tools/execute with tool_name like "X.PostTweet"
 */

import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'fs';
import type { Mention } from '../ui/mention-card.js';
import type { DM } from '../ui/dm-card.js';
import { setUsername as setPersistentUsername } from '../state/manager.js';

// Debug logger that writes to a file we can tail
const LOG_FILE = '/tmp/assa-debug.log';
function log(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const line = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data, null, 2)}\n`
    : `[${timestamp}] ${message}\n`;
  appendFileSync(LOG_FILE, line);
  console.error(line.trim()); // Also keep stderr for good measure
}

// Persist auth state to survive server restarts
const AUTH_STATE_FILE = '/tmp/assa-auth-state.json';

interface AuthState {
  pendingAuthId: string | null;
  authenticatedUsername: string | null;
}

function loadAuthState(): AuthState {
  try {
    if (existsSync(AUTH_STATE_FILE)) {
      const data = readFileSync(AUTH_STATE_FILE, 'utf-8');
      const state = JSON.parse(data) as AuthState;
      log('Loaded auth state from file:', state);
      return state;
    }
  } catch (error) {
    log('Error loading auth state:', String(error));
  }
  return { pendingAuthId: null, authenticatedUsername: null };
}

function saveAuthState(state: AuthState) {
  try {
    writeFileSync(AUTH_STATE_FILE, JSON.stringify(state, null, 2));
    log('Saved auth state to file:', state);
  } catch (error) {
    log('Error saving auth state:', String(error));
  }
}

const ARCADE_API_KEY = process.env.ARCADE_API_KEY;
const ARCADE_BASE_URL = process.env.ARCADE_BASE_URL || 'https://api.arcade.dev/v1';

// User ID for Arcade (identifies this user's auth session)
// In production, you'd want to persist this per-user
const ARCADE_USER_ID = process.env.ARCADE_USER_ID || 'assa-default-user';

// Load persisted auth state on startup
const initialState = loadAuthState();
let pendingAuthId: string | null = initialState.pendingAuthId;
let authenticatedUsername: string | null = initialState.authenticatedUsername;

/**
 * Set the authenticated username (for when Arcade doesn't provide it)
 */
export function setAuthenticatedUsername(username: string) {
  authenticatedUsername = username;
  saveAuthState({ pendingAuthId, authenticatedUsername });
  log('Username set manually:', username);
}

interface WhoAmIUserData {
  id: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
  url?: string;
}

interface WhoAmIResponse {
  value: {
    data: WhoAmIUserData;
  };
}

interface ArcadeClient {
  // Auth
  getAuthStatus(): Promise<{ authorized: boolean; username?: string }>;
  initiateAuth(): Promise<{ oauthUrl: string; state: string; alreadyAuthorized?: boolean }>;
  getAuthenticatedUser(): Promise<WhoAmIResponse | null>;

  // Twitter API
  getMentions(params: { hours: number; limit: number }): Promise<Mention[]>;
  getDMs(params: { unread_only: boolean; limit: number }): Promise<DM[]>;
  getTweet(id: string): Promise<{ author: { handle: string }; text: string }>;
  postTweet(params: {
    text: string;
    reply_to_id?: string;
    quote_tweet_id?: string;
  }): Promise<{ id: string; url: string }>;
}

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

  console.error(`[ASSA] Arcade API: ${method} ${url}`);
  if (body) {
    console.error(`[ASSA] Request body: ${JSON.stringify(body, null, 2)}`);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  console.error(`[ASSA] Response ${response.status}: ${responseText.substring(0, 500)}`);

  if (!response.ok) {
    throw new Error(`Arcade API error (${response.status}): ${responseText}`);
  }

  return JSON.parse(responseText) as T;
}

/**
 * Custom error for auth-related failures
 */
export class AuthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthRequiredError';
  }
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
    const errorLower = response.error.toLowerCase();
    // Detect authorization-related errors
    if (
      errorLower.includes('not authorized') ||
      errorLower.includes('unauthorized') ||
      errorLower.includes('authorization required') ||
      errorLower.includes('auth') && errorLower.includes('failed')
    ) {
      console.error(`[ASSA] Auth required for tool ${toolName}: ${response.error}`);
      throw new AuthRequiredError(`Authorization required: ${response.error}`);
    }
    throw new Error(`Tool ${toolName} failed: ${response.error}`);
  }

  return response.output as T;
}

/**
 * Real Arcade client implementation
 */
const realArcadeClient: ArcadeClient = {
  async getAuthStatus() {
    log('======== getAuthStatus called ========');
    log('pendingAuthId:', pendingAuthId);
    log('authenticatedUsername:', authenticatedUsername);

    // If we have a pending auth, check its status
    if (pendingAuthId) {
      log('Checking status for pendingAuthId:', pendingAuthId);
      try {
        const response = await arcadeRequest<{
          status: string;
          context?: {
            user_info?: {
              username?: string;
            };
          };
        }>('GET', `/auth/status?id=${encodeURIComponent(pendingAuthId)}`);

        log('Auth status response:', response);

        if (response.status === 'completed') {
          log('Auth COMPLETED! Fetching user info via X.WhoAmI...');
          pendingAuthId = null; // Clear pending auth

          // Use X.WhoAmI to get the authenticated username
          try {
            const whoami = await executeTool<WhoAmIResponse>('X.WhoAmI', {});
            log('X.WhoAmI after auth:', whoami);
            const username = whoami.value?.data?.username;
            if (username) {
              authenticatedUsername = username;
              setPersistentUsername(username); // Sync to persistent state
              log('Stored authenticated username from WhoAmI:', `@${username}`);
            }
            saveAuthState({ pendingAuthId, authenticatedUsername });
            return { authorized: true, username };
          } catch (whoamiError) {
            log('X.WhoAmI failed after auth:', String(whoamiError));
            // Auth succeeded but couldn't get username - still authorized
            saveAuthState({ pendingAuthId, authenticatedUsername });
            return { authorized: true };
          }
        }

        // Still pending
        log('Auth still pending, status:', response.status);
        return { authorized: false };
      } catch (error) {
        log('Error checking auth status:', String(error));
        return { authorized: false };
      }
    }

    // No pending auth - check if we're authorized
    // If we already have a cached username, use a simple tool call to verify auth
    // Only call X.WhoAmI if we need to fetch the username
    if (authenticatedUsername) {
      log('Have cached username, verifying auth with simple tool call');
      try {
        // Quick auth check - if this succeeds, we're still authorized
        await executeTool('X.LookupSingleUserByUsername', { username: 'x' });
        log('Auth verified, using cached username:', `@${authenticatedUsername}`);
        return { authorized: true, username: authenticatedUsername };
      } catch (error) {
        log('Auth check failed, clearing cached username:', String(error));
        authenticatedUsername = null;
        saveAuthState({ pendingAuthId, authenticatedUsername });
        return { authorized: false };
      }
    }

    // No cached username - try X.WhoAmI to verify auth and get username
    log('No cached username - calling X.WhoAmI to verify auth and get username');
    try {
      const whoami = await executeTool<WhoAmIResponse>('X.WhoAmI', {});
      log('X.WhoAmI succeeded:', whoami);

      // Store the username from WhoAmI
      const username = whoami.value?.data?.username;
      if (username) {
        authenticatedUsername = username;
        setPersistentUsername(username); // Sync to persistent state
        saveAuthState({ pendingAuthId, authenticatedUsername });
        log('Stored username from WhoAmI:', `@${username}`);
      }

      return { authorized: true, username };
    } catch (error) {
      log('X.WhoAmI failed:', String(error));
      // Not authorized or tool failed
      return { authorized: false };
    }
  },

  async getAuthenticatedUser() {
    log('======== getAuthenticatedUser called ========');
    try {
      const whoami = await executeTool<WhoAmIResponse>('X.WhoAmI', {});
      log('X.WhoAmI response:', whoami);

      // Store the username
      const username = whoami.value?.data?.username;
      if (username) {
        authenticatedUsername = username;
        setPersistentUsername(username); // Sync to persistent state
        saveAuthState({ pendingAuthId, authenticatedUsername });
      }

      return whoami;
    } catch (error) {
      log('X.WhoAmI failed:', String(error));
      return null;
    }
  },

  async initiateAuth() {
    log('======== initiateAuth called ========');
    log('Previous pendingAuthId was:', pendingAuthId);

    // Use tool-based authorization (like the working Python example)
    // This lets Arcade determine the required scopes automatically
    const response = await arcadeRequest<{
      id: string;
      url?: string;
      status: string;
    }>('POST', '/tools/authorize', {
      tool_name: 'X.SearchRecentTweetsByUsername',
      user_id: ARCADE_USER_ID,
    });

    log('Auth initiate response:', response);

    // If already authorized, the response won't have a URL
    if (response.status === 'completed') {
      log('User is already authorized! No OAuth URL needed.');
      // Clear any stale pending auth
      pendingAuthId = null;
      saveAuthState({ pendingAuthId, authenticatedUsername });
      // Return empty URL to signal already authorized
      return {
        oauthUrl: '',
        state: response.id,
        alreadyAuthorized: true,
      };
    }

    // Store the auth ID for status polling
    pendingAuthId = response.id;
    log('New pendingAuthId set to:', pendingAuthId);

    // Persist the pending auth ID
    saveAuthState({ pendingAuthId, authenticatedUsername });

    return {
      oauthUrl: response.url || '',
      state: response.id, // Use auth ID as state
    };
  },

  async getMentions({ limit }) {
    // Arcade doesn't have a direct "get mentions" tool
    // We search for tweets mentioning @username using SearchRecentTweetsByKeywords

    if (!authenticatedUsername) {
      console.error('[ASSA] No authenticated username stored - cannot search for mentions');
      console.error('[ASSA] User needs to re-authenticate to fetch mentions');
      return [];
    }

    const searchHandle = `@${authenticatedUsername}`;
    console.error(`[ASSA] Searching for mentions of ${searchHandle}`);

    try {
      // Response structure: { value: { data: [...], includes: { users: [...] } } }
      const response = await executeTool<{
        value: {
          data?: Array<{
            id: string;
            text: string;
            author_id?: string;
            author_name?: string;
            author_username?: string;
            created_at?: string;
            tweet_url?: string;
          }>;
          includes?: {
            users?: Array<{
              id: string;
              name: string;
              username: string;
            }>;
          };
        };
      }>('X.SearchRecentTweetsByKeywords', {
        phrases: [searchHandle], // Search for @username mentions
        max_results: Math.min(limit, 100),
      });

      const tweets = response.value?.data || [];
      const users = response.value?.includes?.users || [];

      // Create a map of user_id -> user info for lookups
      const userMap = new Map(users.map((u) => [u.id, u]));

      console.error(`[ASSA] Found ${tweets.length} tweets mentioning ${searchHandle}`);

      // Transform to Mention format
      return tweets.map((tweet) => {
        // Look up user info from includes, or use inline author info
        const user = tweet.author_id ? userMap.get(tweet.author_id) : null;
        const handle = tweet.author_username || user?.username || 'unknown';
        const displayName = tweet.author_name || user?.name || handle;

        return {
          id: tweet.id,
          author: {
            handle,
            displayName,
            avatarUrl: '',
          },
          text: tweet.text,
          timestamp: tweet.created_at || new Date().toISOString(),
          metrics: {
            likes: 0,
            retweets: 0,
            replies: 0,
          },
          url: tweet.tweet_url || `https://twitter.com/i/status/${tweet.id}`,
        };
      });
    } catch (error) {
      console.error('[ASSA] Error getting mentions:', error);
      return [];
    }
  },

  async getDMs() {
    // Arcade's X integration doesn't include DM access
    console.error('[ASSA] DMs are not supported by Arcade X integration');
    return [];
  },

  async getTweet(id) {
    const response = await executeTool<{
      id: string;
      text: string;
      author?: {
        username?: string;
      };
    }>('X.LookupTweetById', {
      tweet_id: id,
    });

    return {
      author: { handle: response.author?.username || 'unknown' },
      text: response.text,
    };
  },

  async postTweet({ text, reply_to_id, quote_tweet_id }) {
    let response: { id?: string };

    if (reply_to_id) {
      // Use ReplyToTweet for replies
      response = await executeTool<{ id?: string }>('X.ReplyToTweet', {
        tweet_id: reply_to_id,
        tweet_text: text,
        quote_tweet_id,
      });
    } else {
      // Use PostTweet for new tweets
      response = await executeTool<{ id?: string }>('X.PostTweet', {
        tweet_text: text,
        quote_tweet_id,
      });
    }

    const tweetId = response.id || 'unknown';
    return {
      id: tweetId,
      url: `https://twitter.com/i/status/${tweetId}`,
    };
  },
};

/**
 * Mock Arcade client for development (when no API key)
 */
let mockAuthState: { authorized: boolean; username?: string } = {
  authorized: false,
};

const mockArcadeClient: ArcadeClient = {
  async getAuthStatus() {
    return mockAuthState;
  },

  async initiateAuth() {
    const state = `mock_state_${Date.now()}`;
    setTimeout(() => {
      mockAuthState = { authorized: true, username: 'demo_user' };
    }, 5000);

    return {
      oauthUrl: `https://arcade.dev/oauth/twitter?state=${state}`,
      state,
    };
  },

  async getAuthenticatedUser() {
    if (mockAuthState.authorized) {
      return {
        value: {
          data: {
            id: '12345',
            username: mockAuthState.username || 'demo_user',
            name: 'Demo User',
            description: 'A demo user for testing',
            profile_image_url: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png',
          },
        },
      };
    }
    return null;
  },

  async getMentions({ limit }) {
    return [
      {
        id: '1',
        author: {
          handle: 'anthropic_devs',
          displayName: 'Anthropic Developers',
          avatarUrl: 'https://pbs.twimg.com/profile_images/1234567890/avatar.jpg',
        },
        text: 'Will you be sharing slides from your MCP Connect talk?',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        metrics: { likes: 12, retweets: 3, replies: 1 },
        url: 'https://twitter.com/anthropic_devs/status/1234567890',
      },
      {
        id: '2',
        author: {
          handle: 'blockeng',
          displayName: 'Block Engineering',
          avatarUrl: 'https://pbs.twimg.com/profile_images/0987654321/avatar.jpg',
        },
        text: 'Great demo of Goose + MCP-UI! Looking forward to seeing more.',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        metrics: { likes: 45, retweets: 12, replies: 3 },
        url: 'https://twitter.com/blockeng/status/0987654321',
      },
    ].slice(0, limit);
  },

  async getDMs({ limit }) {
    return [
      {
        id: 'dm1',
        sender: {
          handle: 'conference_org',
          displayName: 'Conference Organizer',
          avatarUrl: 'https://pbs.twimg.com/profile_images/2222222222/avatar.jpg',
        },
        preview: "Hi! We'd love to discuss sponsorship opportunities...",
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        isUnread: true,
      },
    ].slice(0, limit);
  },

  async getTweet() {
    return {
      author: { handle: 'someone' },
      text: 'This is the original tweet content...',
    };
  },

  async postTweet() {
    const tweetId = `mock_${Date.now()}`;
    return {
      id: tweetId,
      url: `https://twitter.com/user/status/${tweetId}`,
    };
  },
};

// Export the appropriate client based on environment
export const arcadeClient: ArcadeClient = ARCADE_API_KEY
  ? realArcadeClient
  : mockArcadeClient;

// Log which mode we're using
console.error('[ASSA] ========================================');
console.error(`[ASSA] ARCADE_API_KEY present: ${!!ARCADE_API_KEY}`);
console.error(`[ASSA] ARCADE_API_KEY length: ${ARCADE_API_KEY?.length || 0}`);
console.error(`[ASSA] ARCADE_USER_ID: ${ARCADE_USER_ID}`);
console.error(`[ASSA] Using: ${ARCADE_API_KEY ? 'REAL Arcade API' : 'MOCK client'}`);
console.error('[ASSA] ========================================');
