/**
 * Time utility functions
 */

// Twitter snowflake epoch (Nov 4, 2010 01:42:54.657 UTC)
const TWITTER_EPOCH = 1288834974657n;

/**
 * Extract timestamp from a Twitter snowflake ID
 * Twitter IDs contain the timestamp in the high bits
 */
export function timestampFromSnowflake(snowflakeId: string): Date | null {
  try {
    const id = BigInt(snowflakeId);
    const timestampMs = Number((id >> 22n) + TWITTER_EPOCH);
    return new Date(timestampMs);
  } catch {
    return null;
  }
}

/**
 * Format a timestamp as relative time (e.g., "2h ago", "3d ago")
 */
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
}

/**
 * Get ISO timestamp for X hours ago
 */
export function hoursAgo(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}
