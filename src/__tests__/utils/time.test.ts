import { describe, expect, test } from "bun:test";
import {
  formatRelativeTime,
  hoursAgo,
  timestampFromSnowflake,
} from "../../utils/time.js";

// Regex for ISO timestamp format
const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

describe("timestampFromSnowflake", () => {
  test("extracts correct timestamp from valid snowflake ID", () => {
    // Known tweet ID: 1234567890123456789
    // This corresponds to a specific timestamp
    const result = timestampFromSnowflake("1234567890123456789");
    expect(result).toBeInstanceOf(Date);
    expect(result).not.toBeNull();
  });

  test("returns null for invalid snowflake ID", () => {
    expect(timestampFromSnowflake("not-a-number")).toBeNull();
  });

  test("returns epoch date for empty string (BigInt converts to 0)", () => {
    // BigInt("") returns 0n, which results in the X epoch date
    const result = timestampFromSnowflake("");
    expect(result).not.toBeNull();
    expect(result?.getFullYear()).toBe(2010);
  });

  test("handles real X tweet IDs", () => {
    // A tweet from ~2023 should return a date in 2023
    const tweetId = "1704567890123456789";
    const result = timestampFromSnowflake(tweetId);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.getFullYear()).toBeGreaterThanOrEqual(2023);
    }
  });
});

describe("formatRelativeTime", () => {
  test("returns 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  test("returns minutes for timestamps under an hour", () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(formatRelativeTime(thirtyMinsAgo)).toBe("30m ago");
  });

  test("returns hours for timestamps under a day", () => {
    const fiveHoursAgo = new Date(
      Date.now() - 5 * 60 * 60 * 1000
    ).toISOString();
    expect(formatRelativeTime(fiveHoursAgo)).toBe("5h ago");
  });

  test("returns days for timestamps under a week", () => {
    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
  });

  test("returns formatted date for timestamps over a week", () => {
    const twoWeeksAgo = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000
    ).toISOString();
    const result = formatRelativeTime(twoWeeksAgo);
    // Should be a date string, not relative time
    expect(result).not.toContain("ago");
    expect(result).not.toBe("just now");
  });
});

describe("hoursAgo", () => {
  test("returns ISO string for time in the past", () => {
    const result = hoursAgo(2);
    expect(result).toMatch(ISO_TIMESTAMP_REGEX);
  });

  test("returns time approximately N hours ago", () => {
    const hours = 5;
    const result = new Date(hoursAgo(hours));
    const expected = new Date(Date.now() - hours * 60 * 60 * 1000);
    // Allow 1 second tolerance
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000);
  });
});
