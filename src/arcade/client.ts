/**
 * Arcade.dev API Client
 *
 * Uses the official @arcadeai/arcadejs SDK for Twitter/X OAuth and API calls.
 *
 * Key insight: When a tool execution requires auth, the SDK returns
 * `output.authorization` with the OAuth URL directly - no separate call needed.
 */

import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import Arcade from "@arcadeai/arcadejs";
import type { AuthorizationResponse } from "@arcadeai/arcadejs/resources";
import { setUsername as setPersistentUsername } from "../state/manager.js";

// Types for Twitter data
export interface Mention {
  id: string;
  author: {
    handle: string;
    displayName: string;
    avatarUrl: string;
  };
  text: string;
  timestamp: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  url: string;
}

export interface DM {
  id: string;
  sender: {
    handle: string;
    displayName: string;
    avatarUrl: string;
  };
  preview: string;
  timestamp: string;
  isUnread: boolean;
}

// Debug logger
const LOG_FILE = "/tmp/assa-debug.log";
function log(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const line = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data, null, 2)}\n`
    : `[${timestamp}] ${message}\n`;
  appendFileSync(LOG_FILE, line);
  console.error(line.trim());
}

// Persist auth state
const AUTH_STATE_FILE = "/tmp/assa-auth-state.json";

interface AuthState {
  pendingAuthId: string | null;
  authenticatedUsername: string | null;
}

function loadAuthState(): AuthState {
  try {
    if (existsSync(AUTH_STATE_FILE)) {
      const data = readFileSync(AUTH_STATE_FILE, "utf-8");
      const state = JSON.parse(data) as AuthState;
      log("Loaded auth state from file:", state);
      return state;
    }
  } catch (error) {
    log("Error loading auth state:", String(error));
  }
  return { pendingAuthId: null, authenticatedUsername: null };
}

function saveAuthState(state: AuthState) {
  try {
    writeFileSync(AUTH_STATE_FILE, JSON.stringify(state, null, 2));
    log("Saved auth state to file:", state);
  } catch (error) {
    log("Error saving auth state:", String(error));
  }
}

const ARCADE_API_KEY = process.env.ARCADE_API_KEY;
const ARCADE_USER_ID = process.env.ARCADE_USER_ID || "assa-default-user";

// Load persisted auth state
const initialState = loadAuthState();
let pendingAuthId: string | null = initialState.pendingAuthId;
let authenticatedUsername: string | null = initialState.authenticatedUsername;

// Initialize Arcade SDK client
const arcade = ARCADE_API_KEY ? new Arcade({ apiKey: ARCADE_API_KEY }) : null;

/**
 * Custom error for auth-related failures
 * Contains the OAuth URL when available
 */
export class AuthRequiredError extends Error {
  readonly authUrl?: string;
  readonly authId?: string;

  constructor(message: string, authResponse?: AuthorizationResponse) {
    super(message);
    this.name = "AuthRequiredError";
    this.authUrl = authResponse?.url;
    this.authId = authResponse?.id;
  }
}

/**
 * Clear the cached auth state
 */
export function clearAuthCache() {
  log("Clearing auth cache");
  pendingAuthId = null;
  authenticatedUsername = null;
  saveAuthState({ pendingAuthId: null, authenticatedUsername: null });
}

/**
 * Set the authenticated username
 */
export function setAuthenticatedUsername(username: string) {
  authenticatedUsername = username;
  saveAuthState({ pendingAuthId, authenticatedUsername });
  log("Username set:", username);
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
  getAuthStatus(): Promise<{ authorized: boolean; username?: string }>;
  initiateAuth(): Promise<{
    oauthUrl: string;
    state: string;
    alreadyAuthorized?: boolean;
  }>;
  getAuthenticatedUser(): Promise<WhoAmIResponse | null>;
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
 * Execute a tool and handle auth requirements
 * If auth is required, throws AuthRequiredError with the OAuth URL
 */
export async function executeTool<T>(
  toolName: string,
  input: Record<string, unknown>
): Promise<T> {
  if (!arcade) {
    throw new Error("Arcade SDK not initialized - ARCADE_API_KEY not set");
  }

  log(`Executing tool: ${toolName}`, input);

  const response = await arcade.tools.execute({
    tool_name: toolName,
    input,
    user_id: ARCADE_USER_ID,
  });

  log(`Tool response for ${toolName}:`, response);

  // Check if authorization is required
  if (response.output?.authorization) {
    const auth = response.output.authorization;
    log("Tool requires authorization:", auth);

    if (auth.status === "pending" && auth.url) {
      // Store the pending auth ID
      pendingAuthId = auth.id || null;
      saveAuthState({ pendingAuthId, authenticatedUsername });
      throw new AuthRequiredError(
        `Authorization required for ${toolName}`,
        auth
      );
    }
    if (auth.status === "completed") {
      // This shouldn't happen - if auth is completed, tool should succeed
      log(
        "Auth status is completed but tool returned auth response - retrying"
      );
    }
  }

  // Check for errors
  if (response.output?.error) {
    const error = response.output.error;
    log("Tool error:", error);

    // Check if it's an auth-related error
    if (
      error.kind === "UPSTREAM_RUNTIME_AUTH_ERROR" ||
      error.kind === "TOOL_REQUIREMENTS_NOT_MET"
    ) {
      // Try to get a fresh auth URL
      log("Auth error detected, initiating fresh auth");
      clearAuthCache();

      const authResponse = await arcade.tools.authorize({
        tool_name: toolName,
        user_id: ARCADE_USER_ID,
      });

      if (authResponse.status === "pending" && authResponse.url) {
        pendingAuthId = authResponse.id || null;
        saveAuthState({ pendingAuthId, authenticatedUsername });
        throw new AuthRequiredError(
          `Authorization required: ${error.message}`,
          authResponse
        );
      }

      throw new Error(`Tool ${toolName} failed: ${error.message}`);
    }

    throw new Error(`Tool ${toolName} failed: ${error.message}`);
  }

  return response.output?.value as T;
}

/**
 * Helper: Check pending auth status and fetch user if completed
 */
async function checkPendingAuth(): Promise<{
  authorized: boolean;
  username?: string;
} | null> {
  if (!(pendingAuthId && arcade)) {
    return null;
  }

  log("Checking status for pendingAuthId:", pendingAuthId);
  try {
    const response = await arcade.auth.status({ id: pendingAuthId });
    log("Auth status response:", response);

    if (response.status !== "completed") {
      log("Auth still pending, status:", response.status);
      return { authorized: false };
    }

    log("Auth COMPLETED! Fetching user info via X.WhoAmI...");
    pendingAuthId = null;

    try {
      const whoami = await executeTool<WhoAmIResponse>("X.WhoAmI", {});
      log("X.WhoAmI after auth:", whoami);
      const username = whoami.value?.data?.username;
      if (username) {
        authenticatedUsername = username;
        setPersistentUsername(username);
        log("Stored username from WhoAmI:", `@${username}`);
      }
      saveAuthState({ pendingAuthId, authenticatedUsername });
      return { authorized: true, username };
    } catch (whoamiError) {
      log("X.WhoAmI failed after auth:", String(whoamiError));
      saveAuthState({ pendingAuthId, authenticatedUsername });
      return { authorized: true };
    }
  } catch (error) {
    log("Error checking auth status:", String(error));
    return { authorized: false };
  }
}

/**
 * Helper: Verify cached auth is still valid
 */
async function verifyCachedAuth(): Promise<{
  authorized: boolean;
  username?: string;
} | null> {
  if (!authenticatedUsername) {
    return null;
  }

  log("Have cached username, verifying auth");
  try {
    await executeTool("X.LookupSingleUserByUsername", { username: "x" });
    log("Auth verified, using cached username:", `@${authenticatedUsername}`);
    return { authorized: true, username: authenticatedUsername };
  } catch (error) {
    log(
      error instanceof AuthRequiredError
        ? "Auth check failed - auth required"
        : `Auth check failed: ${String(error)}`
    );
    authenticatedUsername = null;
    saveAuthState({ pendingAuthId, authenticatedUsername });
    return { authorized: false };
  }
}

/**
 * Helper: Try to get auth status via WhoAmI
 */
async function fetchAuthViaWhoAmI(): Promise<{
  authorized: boolean;
  username?: string;
}> {
  log("No cached username - calling X.WhoAmI");
  try {
    const whoami = await executeTool<WhoAmIResponse>("X.WhoAmI", {});
    log("X.WhoAmI succeeded:", whoami);

    const username = whoami.value?.data?.username;
    if (username) {
      authenticatedUsername = username;
      setPersistentUsername(username);
      saveAuthState({ pendingAuthId, authenticatedUsername });
      log("Stored username from WhoAmI:", `@${username}`);
    }

    return { authorized: true, username };
  } catch (error) {
    log(
      error instanceof AuthRequiredError
        ? "X.WhoAmI requires auth"
        : `X.WhoAmI failed: ${String(error)}`
    );
    return { authorized: false };
  }
}

/**
 * Real Arcade client using the SDK
 */
const realArcadeClient: ArcadeClient = {
  async getAuthStatus() {
    log("======== getAuthStatus called ========");
    log("pendingAuthId:", pendingAuthId);
    log("authenticatedUsername:", authenticatedUsername);

    if (!arcade) {
      return { authorized: false };
    }

    // Check pending auth first
    const pendingResult = await checkPendingAuth();
    if (pendingResult !== null) {
      return pendingResult;
    }

    // Verify cached auth
    const cachedResult = await verifyCachedAuth();
    if (cachedResult !== null) {
      return cachedResult;
    }

    // Fall back to WhoAmI
    return fetchAuthViaWhoAmI();
  },

  async initiateAuth() {
    log("======== initiateAuth called ========");
    log("Previous pendingAuthId:", pendingAuthId);

    if (!arcade) {
      throw new Error("Arcade SDK not initialized");
    }

    // Use tools.authorize to get OAuth URL for X.PostTweet (includes write scopes)
    const response = await arcade.tools.authorize({
      tool_name: "X.PostTweet",
      user_id: ARCADE_USER_ID,
    });

    log("Auth initiate response:", response);

    if (response.status === "completed") {
      log("User is already authorized!");
      pendingAuthId = null;
      saveAuthState({ pendingAuthId, authenticatedUsername });
      return {
        oauthUrl: "",
        state: response.id || "",
        alreadyAuthorized: true,
      };
    }

    // Store pending auth ID
    pendingAuthId = response.id || null;
    saveAuthState({ pendingAuthId, authenticatedUsername });

    if (!response.url) {
      log("ERROR: No OAuth URL in response!", response);
      throw new Error("Arcade did not return an OAuth URL");
    }

    return {
      oauthUrl: response.url,
      state: response.id || "",
    };
  },

  async getAuthenticatedUser() {
    log("======== getAuthenticatedUser called ========");
    try {
      const whoami = await executeTool<WhoAmIResponse>("X.WhoAmI", {});
      log("X.WhoAmI response:", whoami);

      const username = whoami.value?.data?.username;
      if (username) {
        authenticatedUsername = username;
        setPersistentUsername(username);
        saveAuthState({ pendingAuthId, authenticatedUsername });
      }

      return whoami;
    } catch (error) {
      log("X.WhoAmI failed:", String(error));
      return null;
    }
  },

  async getMentions({ limit }) {
    if (!authenticatedUsername) {
      console.error(
        "[ASSA] No authenticated username - cannot search mentions"
      );
      return [];
    }

    const searchHandle = `@${authenticatedUsername}`;
    console.error(`[ASSA] Searching for mentions of ${searchHandle}`);

    try {
      const response = await executeTool<{
        value: {
          data?: Array<{
            id: string;
            text: string;
            author_id?: string;
            author_name?: string;
            author_username?: string;
            author_profile_image_url?: string;
            created_at?: string;
            tweet_url?: string;
          }>;
          includes?: {
            users?: Array<{
              id: string;
              name: string;
              username: string;
              profile_image_url?: string;
            }>;
          };
        };
      }>("X.SearchRecentTweetsByKeywords", {
        phrases: [searchHandle],
        max_results: Math.min(limit, 100),
      });

      const tweets = response.value?.data || [];
      const users = response.value?.includes?.users || [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      console.error(
        `[ASSA] Found ${tweets.length} tweets mentioning ${searchHandle}`
      );
      console.error(
        "[ASSA] Users in includes:",
        JSON.stringify(users.slice(0, 3))
      );

      return tweets.map((tweet) => {
        const user = tweet.author_id ? userMap.get(tweet.author_id) : null;
        const handle = tweet.author_username || user?.username || "unknown";
        const displayName = tweet.author_name || user?.name || handle;
        // Try to get avatar from tweet data first, then from includes.users
        const avatarUrl =
          tweet.author_profile_image_url || user?.profile_image_url || "";

        return {
          id: tweet.id,
          author: {
            handle,
            displayName,
            avatarUrl,
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
      console.error("[ASSA] Error getting mentions:", error);
      if (error instanceof AuthRequiredError) {
        throw error; // Re-throw auth errors
      }
      return [];
    }
  },

  getDMs() {
    console.error("[ASSA] DMs are not supported by Arcade X integration");
    return Promise.resolve([]);
  },

  async getTweet(id) {
    const response = await executeTool<{
      id: string;
      text: string;
      author?: {
        username?: string;
      };
    }>("X.LookupTweetById", {
      tweet_id: id,
    });

    return {
      author: { handle: response.author?.username || "unknown" },
      text: response.text,
    };
  },

  async postTweet({ text, reply_to_id, quote_tweet_id }) {
    // The Arcade API returns different structures - try common patterns
    interface TweetResponse {
      id?: string;
      data?: { id?: string };
      tweet_id?: string;
    }

    let response: TweetResponse;

    if (reply_to_id) {
      response = await executeTool<TweetResponse>("X.ReplyToTweet", {
        tweet_id: reply_to_id,
        tweet_text: text,
        quote_tweet_id,
      });
    } else {
      response = await executeTool<TweetResponse>("X.PostTweet", {
        tweet_text: text,
        quote_tweet_id,
      });
    }

    log("Post tweet response:", response);

    // Try different response structures
    const tweetId =
      response.id || response.data?.id || response.tweet_id || "unknown";
    log("Extracted tweet ID:", tweetId);

    return {
      id: tweetId,
      url: `https://twitter.com/i/status/${tweetId}`,
    };
  },
};

/**
 * Mock Arcade client for development
 */
let mockAuthState: { authorized: boolean; username?: string } = {
  authorized: false,
};

const mockArcadeClient: ArcadeClient = {
  getAuthStatus() {
    return Promise.resolve(mockAuthState);
  },

  initiateAuth() {
    const state = `mock_state_${Date.now()}`;
    setTimeout(() => {
      mockAuthState = { authorized: true, username: "demo_user" };
    }, 5000);

    return Promise.resolve({
      oauthUrl: `https://arcade.dev/oauth/twitter?state=${state}`,
      state,
    });
  },

  getAuthenticatedUser() {
    if (mockAuthState.authorized) {
      return Promise.resolve({
        value: {
          data: {
            id: "12345",
            username: mockAuthState.username || "demo_user",
            name: "Demo User",
            description: "A demo user for testing",
            profile_image_url:
              "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png",
          },
        },
      });
    }
    return Promise.resolve(null);
  },

  getMentions({ limit }) {
    return Promise.resolve(
      [
        {
          id: "1",
          author: {
            handle: "anthropic_devs",
            displayName: "Anthropic Developers",
            avatarUrl: "",
          },
          text: "Will you be sharing slides from your MCP Connect talk?",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          metrics: { likes: 12, retweets: 3, replies: 1 },
          url: "https://twitter.com/anthropic_devs/status/1234567890",
        },
      ].slice(0, limit)
    );
  },

  getDMs() {
    return Promise.resolve([]);
  },

  getTweet() {
    return Promise.resolve({
      author: { handle: "someone" },
      text: "This is the original tweet content...",
    });
  },

  postTweet() {
    const tweetId = `mock_${Date.now()}`;
    return Promise.resolve({
      id: tweetId,
      url: `https://twitter.com/user/status/${tweetId}`,
    });
  },
};

// Export the appropriate client
export const arcadeClient: ArcadeClient = ARCADE_API_KEY
  ? realArcadeClient
  : mockArcadeClient;

// Log initialization
console.error("[ASSA] ========================================");
console.error(`[ASSA] ARCADE_API_KEY present: ${!!ARCADE_API_KEY}`);
console.error(`[ASSA] ARCADE_USER_ID: ${ARCADE_USER_ID}`);
console.error(`[ASSA] Using: ${ARCADE_API_KEY ? "Arcade SDK" : "MOCK client"}`);
console.error("[ASSA] ========================================");
