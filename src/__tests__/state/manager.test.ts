import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock the homedir to use our test directory
mock.module("node:os", () => ({
  homedir: () => tmpdir(),
}));

// Import after mocking
import {
  clearState,
  dismissTweet,
  getLastChecked,
  getUsername,
  isDismissed,
  setUsername,
  undismissTweet,
  updateLastChecked,
} from "../../state/manager.js";

// Generate unique IDs for each test to avoid conflicts
let testCounter = 0;
function uniqueId(prefix = "state"): string {
  return `${prefix}_${Date.now()}_${++testCounter}`;
}

beforeEach(() => {
  // Reset state before each test
  clearState();
  // Clean up test state directory
  const testDir = join(tmpdir(), ".config", "assa");
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }
});

afterEach(() => {
  // Clean up after each test
  const testDir = join(tmpdir(), ".config", "assa");
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }
});

describe("username management", () => {
  test("getUsername returns null after clearState", () => {
    clearState();
    expect(getUsername()).toBeNull();
  });

  test("setUsername stores and retrieves username", () => {
    const username = uniqueId("user");
    setUsername(username);
    expect(getUsername()).toBe(username);
  });

  test("setUsername strips @ prefix", () => {
    const username = uniqueId("user");
    setUsername(`@${username}`);
    expect(getUsername()).toBe(username);
  });
});

describe("dismiss management", () => {
  test("isDismissed returns false for unknown tweet", () => {
    const tweetId = uniqueId("tweet");
    expect(isDismissed(tweetId, 0)).toBe(false);
  });

  test("dismissTweet marks tweet as dismissed", () => {
    const tweetId = uniqueId("tweet");
    dismissTweet(tweetId, 5);
    expect(isDismissed(tweetId, 5)).toBe(true);
  });

  test("isDismissed returns false when reply count increases", () => {
    const tweetId = uniqueId("tweet");
    dismissTweet(tweetId, 5);
    // New reply added (count increased from 5 to 6)
    expect(isDismissed(tweetId, 6)).toBe(false);
  });

  test("undismissTweet clears dismissal", () => {
    const tweetId = uniqueId("tweet");
    dismissTweet(tweetId, 5);
    undismissTweet(tweetId);
    expect(isDismissed(tweetId, 5)).toBe(false);
  });
});

describe("last checked timestamp", () => {
  test("getLastChecked returns null after clearState", () => {
    clearState();
    expect(getLastChecked()).toBeNull();
  });

  test("updateLastChecked sets timestamp", () => {
    clearState();
    updateLastChecked();
    const lastChecked = getLastChecked();
    expect(lastChecked).not.toBeNull();
    // Should be a valid ISO string
    expect(new Date(lastChecked!).getTime()).not.toBeNaN();
  });
});

describe("clearState", () => {
  test("clearState resets username", () => {
    setUsername("testuser");
    clearState();
    expect(getUsername()).toBeNull();
  });

  test("clearState resets dismissed tweets", () => {
    clearState();
    const tweetId = uniqueId("tweet");
    dismissTweet(tweetId, 0);
    clearState();
    expect(isDismissed(tweetId, 0)).toBe(false);
  });

  test("clearState resets lastChecked", () => {
    clearState();
    updateLastChecked();
    clearState();
    expect(getLastChecked()).toBeNull();
  });
});
