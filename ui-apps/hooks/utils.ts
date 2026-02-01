/**
 * Utility functions for ASSA UI components
 */

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get initials from a name for avatar fallback
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format a date as relative time (e.g., "2h", "3d")
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return "just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m`;
  }
  if (diffHours < 24) {
    return `${diffHours}h`;
  }
  if (diffDays < 7) {
    return `${diffDays}d`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Extract timestamp from Twitter Snowflake ID
 * Twitter IDs encode the creation timestamp
 */
export function getTimestampFromSnowflake(snowflakeId: string): Date {
  // Twitter epoch is 1288834974657 (Nov 4, 2010)
  const TWITTER_EPOCH = 1288834974657n;

  try {
    const id = BigInt(snowflakeId);
    // Timestamp is stored in the upper 41 bits (after shifting right 22 bits)
    const timestamp = (id >> 22n) + TWITTER_EPOCH;
    return new Date(Number(timestamp));
  } catch {
    // Fallback to current date if parsing fails
    return new Date();
  }
}

/**
 * Format relative time from a Snowflake ID
 */
export function formatTimeFromSnowflake(snowflakeId: string): string {
  const date = getTimestampFromSnowflake(snowflakeId);
  return formatRelativeTime(date.toISOString());
}

/**
 * Check if a tool result requires authentication
 */
export interface AuthRequiredResponse {
  authRequired: true;
  service: string;
  authUrl: string;
  state: string;
  message: string;
}

export function isAuthRequired(data: unknown): data is AuthRequiredResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "authRequired" in data &&
    (data as AuthRequiredResponse).authRequired === true
  );
}

/**
 * Parse tool result content
 */
export function parseToolResult<T>(result: {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}): T | null {
  const textContent = result.content?.find((c) => c.type === "text");
  if (textContent && "text" in textContent) {
    try {
      return JSON.parse(textContent.text as string) as T;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Get character count status for tweets
 */
export function getCharCountStatus(count: number): "ok" | "warning" | "error" {
  if (count > 280) {
    return "error";
  }
  if (count > 260) {
    return "warning";
  }
  return "ok";
}
