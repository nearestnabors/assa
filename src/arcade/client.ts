/**
 * Arcade.dev API Client
 *
 * Handles all communication with Arcade for Twitter/X OAuth and API calls.
 *
 * Arcade API:
 * - Auth: POST /auth/authorize, GET /auth/status
 * - Tools: POST /tools/execute with tool_name like "X.PostTweet"
 */

import { appendFileSync } from 'fs';
import type { Mention } from '../ui/mention-card.js';
import type { DM } from '../ui/dm-card.js';

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

const ARCADE_API_KEY = process.env.ARCADE_API_KEY;
const ARCADE_BASE_URL = process.env.ARCADE_BASE_URL || 'https://api.arcade.dev/v1';

// User ID for Arcade (identifies this user's auth session)
// In production, you'd want to persist this per-user
const ARCADE_USER_ID = process.env.ARCADE_USER_ID || 'assa-default-user';

// Store the pending auth ID for status polling
let pendingAuthId: string | null = null;

// Store the authenticated user's username for mentions search
let authenticatedUsername: string | null = null;

interface ArcadeClient {
  // Auth
  getAuthStatus(): Promise<{ authorized: boolean; username?: string }>;
  initiateAuth(): Promise<{ oauthUrl: string; state: string }>;

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
          const username = response.context?.user_info?.username;
          log('Auth COMPLETED! username:', username);
          pendingAuthId = null; // Clear pending auth
          if (username) {
            authenticatedUsername = username; // Store for mentions search
            log('Stored authenticated username:', `@${username}`);
          }
          return { authorized: true, username };
        }

        // Still pending
        log('Auth still pending, status:', response.status);
        return { authorized: false };
      } catch (error) {
        log('Error checking auth status:', String(error));
        return { authorized: false };
      }
    }

    // No pending auth - try to execute a simple tool to check if we're authorized
    log('No pendingAuthId - trying tool execution to verify auth');
    try {
      // Try to look up a known user as a test - if auth fails, we'll get an error
      const result = await executeTool('X.LookupSingleUserByUsername', { username: 'x' });
      log('Tool execution succeeded, user is authorized. Result:', result);
      return { authorized: true };
    } catch (error) {
      log('Auth check via tool failed:', String(error));
      return { authorized: false };
    }
  },

  async initiateAuth() {
    log('======== initiateAuth called ========');
    log('Previous pendingAuthId was:', pendingAuthId);

    // Use tool-based authorization (like the working Python example)
    // This lets Arcade determine the required scopes automatically
    const response = await arcadeRequest<{
      id: string;
      url: string;
      status: string;
    }>('POST', '/tools/authorize', {
      tool_name: 'X.SearchRecentTweetsByUsername',
      user_id: ARCADE_USER_ID,
    });

    log('Auth initiate response:', response);

    // Store the auth ID for status polling
    pendingAuthId = response.id;
    log('New pendingAuthId set to:', pendingAuthId);

    return {
      oauthUrl: response.url,
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
      const response = await executeTool<{
        tweets?: Array<{
          id: string;
          text: string;
          author_id?: string;
          created_at?: string;
          public_metrics?: {
            like_count?: number;
            retweet_count?: number;
            reply_count?: number;
          };
        }>;
      }>('X.SearchRecentTweetsByKeywords', {
        phrases: [searchHandle], // Search for @username mentions
        max_results: Math.min(limit, 100),
      });

      // Transform to Mention format
      return (response.tweets || []).map((tweet) => ({
        id: tweet.id,
        author: {
          handle: tweet.author_id || 'unknown',
          displayName: tweet.author_id || 'Unknown User',
          avatarUrl: '',
        },
        text: tweet.text,
        timestamp: tweet.created_at || new Date().toISOString(),
        metrics: {
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          replies: tweet.public_metrics?.reply_count || 0,
        },
        url: `https://twitter.com/i/status/${tweet.id}`,
      }));
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
