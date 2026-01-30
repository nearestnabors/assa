import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { timestampFromSnowflake } from "../utils/time.js";

// State file location: ~/.config/assa/state.json
const CONFIG_DIR = join(homedir(), ".config", "assa");
const STATE_FILE = join(CONFIG_DIR, "state.json");

// Regex to strip @ prefix from usernames
const AT_PREFIX_REGEX = /^@/;

interface DismissedTweet {
  dismissed_at: string;
  last_reply_count: number;
}

interface AssaState {
  x_username: string | null;
  dismissed: Record<string, DismissedTweet>;
  vips: string[];
  last_checked: string | null;
}

const DEFAULT_STATE: AssaState = {
  x_username: null,
  dismissed: {},
  vips: [],
  last_checked: null,
};

// In-memory cache
let cachedState: AssaState | null = null;

/**
 * Ensure the config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load state from disk
 */
export function loadState(): AssaState {
  if (cachedState) {
    return cachedState;
  }

  ensureConfigDir();

  if (!existsSync(STATE_FILE)) {
    cachedState = { ...DEFAULT_STATE };
    return cachedState;
  }

  try {
    const content = readFileSync(STATE_FILE, "utf-8");
    const parsed = JSON.parse(content) as Partial<AssaState>;

    // Merge with defaults to handle missing fields
    // Support both old (twitter_username) and new (x_username) field names for migration
    cachedState = {
      x_username:
        parsed.x_username ??
        ((parsed as Record<string, unknown>).twitter_username as string) ??
        null,
      dismissed: parsed.dismissed ?? {},
      vips: parsed.vips ?? [],
      last_checked: parsed.last_checked ?? null,
    };

    return cachedState;
  } catch (error) {
    console.error("[ASSA] Failed to load state, using defaults:", error);
    cachedState = { ...DEFAULT_STATE };
    return cachedState;
  }
}

/**
 * Save state to disk
 */
export function saveState(): void {
  if (!cachedState) {
    return;
  }

  ensureConfigDir();

  try {
    writeFileSync(STATE_FILE, JSON.stringify(cachedState, null, 2), "utf-8");
  } catch (error) {
    console.error("[ASSA] Failed to save state:", error);
  }
}

/**
 * Get the stored X username
 */
export function getUsername(): string | null {
  const state = loadState();
  return state.x_username;
}

/**
 * Set the X username
 */
export function setUsername(username: string): void {
  const state = loadState();
  // Remove @ prefix if provided
  state.x_username = username.replace(AT_PREFIX_REGEX, "");
  saveState();
}

/**
 * Dismiss a tweet (hide from conversations list)
 * Will re-show if reply_count increases later
 */
export function dismissTweet(tweetId: string, replyCount: number): void {
  const state = loadState();
  state.dismissed[tweetId] = {
    dismissed_at: new Date().toISOString(),
    last_reply_count: replyCount,
  };
  saveState();
}

/**
 * Check if a tweet is dismissed
 * Returns false if reply count has increased (new activity)
 */
export function isDismissed(
  tweetId: string,
  currentReplyCount: number
): boolean {
  const state = loadState();
  const dismissed = state.dismissed[tweetId];

  if (!dismissed) {
    return false;
  }

  // If reply count increased, there's new activity - show it again
  if (currentReplyCount > dismissed.last_reply_count) {
    // Remove from dismissed since there's new activity
    delete state.dismissed[tweetId];
    saveState();
    return false;
  }

  return true;
}

/**
 * Clear a dismissed tweet (un-dismiss)
 */
export function undismissTweet(tweetId: string): void {
  const state = loadState();
  delete state.dismissed[tweetId];
  saveState();
}

/**
 * Prune dismissed tweets older than 7 days
 * X's search API only returns tweets from the last 7 days,
 * so older dismissed entries will never be needed again
 */
export function pruneExpiredDismissals(): number {
  const state = loadState();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  let prunedCount = 0;

  for (const tweetId of Object.keys(state.dismissed)) {
    const tweetDate = timestampFromSnowflake(tweetId);
    if (tweetDate && now - tweetDate.getTime() > sevenDaysMs) {
      delete state.dismissed[tweetId];
      prunedCount++;
    }
  }

  if (prunedCount > 0) {
    saveState();
  }

  return prunedCount;
}

/**
 * Get VIP list (accounts to watch)
 */
export function getVips(): string[] {
  const state = loadState();
  return state.vips;
}

/**
 * Add a VIP account
 */
export function addVip(username: string): void {
  const state = loadState();
  const cleanUsername = username.replace(AT_PREFIX_REGEX, "").toLowerCase();

  if (!state.vips.includes(cleanUsername)) {
    state.vips.push(cleanUsername);
    saveState();
  }
}

/**
 * Remove a VIP account
 */
export function removeVip(username: string): void {
  const state = loadState();
  const cleanUsername = username.replace(AT_PREFIX_REGEX, "").toLowerCase();
  state.vips = state.vips.filter((v) => v !== cleanUsername);
  saveState();
}

/**
 * Update last checked timestamp
 */
export function updateLastChecked(): void {
  const state = loadState();
  state.last_checked = new Date().toISOString();
  saveState();
}

/**
 * Get last checked timestamp
 */
export function getLastChecked(): string | null {
  const state = loadState();
  return state.last_checked;
}

/**
 * Clear all state (for testing)
 */
export function clearState(): void {
  // Deep copy to avoid shared references with DEFAULT_STATE
  cachedState = {
    x_username: null,
    dismissed: {},
    vips: [],
    last_checked: null,
  };
  saveState();
}

/**
 * Get the full state (for debugging)
 */
export function getFullState(): AssaState {
  return loadState();
}
