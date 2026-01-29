/**
 * Avatar Cache Manager
 *
 * Fetches Twitter profile images and caches them as base64 data URLs.
 * This bypasses CSP restrictions in the UI iframe.
 *
 * Cache location: ~/.config/assa/avatars.json
 * Cache expiration: 7 days (matches X search API limit)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.config', 'assa');
const AVATAR_CACHE_FILE = join(CONFIG_DIR, 'avatars.json');
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedAvatar {
  dataUrl: string;
  cachedAt: number; // timestamp
}

interface AvatarCache {
  avatars: Record<string, CachedAvatar>;
}

// In-memory cache
let cache: AvatarCache | null = null;

/**
 * Ensure the config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load cache from disk
 */
function loadCache(): AvatarCache {
  if (cache) {
    return cache;
  }

  ensureConfigDir();

  if (!existsSync(AVATAR_CACHE_FILE)) {
    cache = { avatars: {} };
    return cache;
  }

  try {
    const content = readFileSync(AVATAR_CACHE_FILE, 'utf-8');
    cache = JSON.parse(content) as AvatarCache;
    return cache;
  } catch (error) {
    console.error('[ASSA] Failed to load avatar cache:', error);
    cache = { avatars: {} };
    return cache;
  }
}

/**
 * Save cache to disk
 */
function saveCache(): void {
  if (!cache) return;

  ensureConfigDir();

  try {
    writeFileSync(AVATAR_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error('[ASSA] Failed to save avatar cache:', error);
  }
}

/**
 * Get a cached avatar by username
 * Returns null if not cached or expired
 */
export function getCachedAvatar(username: string): string | null {
  const avatarCache = loadCache();
  const entry = avatarCache.avatars[username.toLowerCase()];

  if (!entry) {
    return null;
  }

  // Check if expired
  if (Date.now() - entry.cachedAt > CACHE_MAX_AGE_MS) {
    delete avatarCache.avatars[username.toLowerCase()];
    saveCache();
    return null;
  }

  return entry.dataUrl;
}

/**
 * Store an avatar in the cache
 */
export function setCachedAvatar(username: string, dataUrl: string): void {
  const avatarCache = loadCache();
  avatarCache.avatars[username.toLowerCase()] = {
    dataUrl,
    cachedAt: Date.now(),
  };
  saveCache();
}

/**
 * Fetch an image URL and convert to base64 data URL
 */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[ASSA] Failed to fetch avatar: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('[ASSA] Failed to fetch avatar:', error);
    return null;
  }
}

/**
 * Get avatar for a user, using cache or fetching from URL
 * Falls back to unavatar.io if no profile image URL is provided
 * Returns data URL or null if unavailable
 */
export async function getAvatar(
  username: string,
  profileImageUrl?: string
): Promise<string | null> {
  // Check cache first
  const cached = getCachedAvatar(username);
  if (cached) {
    return cached;
  }

  // Use provided URL or fall back to unavatar.io (small size to reduce response payload)
  const urlToFetch = profileImageUrl || `https://unavatar.io/twitter/${username}?size=48`;

  // Fetch and cache
  const dataUrl = await fetchImageAsDataUrl(urlToFetch);
  if (dataUrl) {
    setCachedAvatar(username, dataUrl);
  }

  return dataUrl;
}

/**
 * Batch fetch avatars for multiple users
 * Returns a map of username -> data URL
 */
export async function getAvatars(
  users: Array<{ username: string; profileImageUrl?: string }>
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Process in parallel with a concurrency limit
  const CONCURRENCY = 5;
  const chunks: Array<typeof users> = [];

  for (let i = 0; i < users.length; i += CONCURRENCY) {
    chunks.push(users.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (user) => {
      const avatar = await getAvatar(user.username, user.profileImageUrl);
      if (avatar) {
        results[user.username.toLowerCase()] = avatar;
      }
    });

    await Promise.all(promises);
  }

  return results;
}

/**
 * Prune expired avatars from cache (older than 7 days)
 */
export function pruneExpiredAvatars(): number {
  const avatarCache = loadCache();
  const now = Date.now();
  let prunedCount = 0;

  for (const username of Object.keys(avatarCache.avatars)) {
    const entry = avatarCache.avatars[username];
    if (now - entry.cachedAt > CACHE_MAX_AGE_MS) {
      delete avatarCache.avatars[username];
      prunedCount++;
    }
  }

  if (prunedCount > 0) {
    saveCache();
  }

  return prunedCount;
}

/**
 * Prune avatars for users not in the active set
 * Call this after fetching conversations to clean up stale avatars
 */
export function pruneStaleAvatars(activeUsernames: string[]): number {
  const avatarCache = loadCache();
  const activeSet = new Set(activeUsernames.map((u) => u.toLowerCase()));
  let prunedCount = 0;

  for (const username of Object.keys(avatarCache.avatars)) {
    if (!activeSet.has(username)) {
      delete avatarCache.avatars[username];
      prunedCount++;
    }
  }

  if (prunedCount > 0) {
    saveCache();
  }

  return prunedCount;
}
