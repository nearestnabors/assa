import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// State file location: ~/.config/assa/state.json
const CONFIG_DIR = join(homedir(), '.config', 'assa');
const STATE_FILE = join(CONFIG_DIR, 'state.json');

interface DismissedTweet {
  dismissed_at: string;
  last_reply_count: number;
}

interface AssaState {
  twitter_username: string | null;
  dismissed: Record<string, DismissedTweet>;
  vips: string[];
  last_checked: string | null;
}

const DEFAULT_STATE: AssaState = {
  twitter_username: null,
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
    const content = readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(content) as Partial<AssaState>;

    // Merge with defaults to handle missing fields
    cachedState = {
      twitter_username: parsed.twitter_username ?? null,
      dismissed: parsed.dismissed ?? {},
      vips: parsed.vips ?? [],
      last_checked: parsed.last_checked ?? null,
    };

    return cachedState;
  } catch (error) {
    console.error('[ASSA] Failed to load state, using defaults:', error);
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
    writeFileSync(STATE_FILE, JSON.stringify(cachedState, null, 2), 'utf-8');
  } catch (error) {
    console.error('[ASSA] Failed to save state:', error);
  }
}

/**
 * Get the stored Twitter username
 */
export function getUsername(): string | null {
  const state = loadState();
  return state.twitter_username;
}

/**
 * Set the Twitter username
 */
export function setUsername(username: string): void {
  const state = loadState();
  // Remove @ prefix if provided
  state.twitter_username = username.replace(/^@/, '');
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
export function isDismissed(tweetId: string, currentReplyCount: number): boolean {
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
  const cleanUsername = username.replace(/^@/, '').toLowerCase();

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
  const cleanUsername = username.replace(/^@/, '').toLowerCase();
  state.vips = state.vips.filter(v => v !== cleanUsername);
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
  cachedState = { ...DEFAULT_STATE };
  saveState();
}

/**
 * Get the full state (for debugging)
 */
export function getFullState(): AssaState {
  return loadState();
}
