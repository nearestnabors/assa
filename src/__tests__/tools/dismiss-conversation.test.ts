import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock homedir before imports
mock.module("node:os", () => ({
  homedir: () => tmpdir(),
}));

import { clearState, isDismissed } from "../../state/manager.js";
// Import after mocking
import { xDismissConversation } from "../../tools/dismiss-conversation.js";

// Generate unique IDs for each test
let testCounter = 0;
function uniqueId(prefix = "dismiss"): string {
  return `${prefix}_${Date.now()}_${++testCounter}`;
}

beforeEach(() => {
  // Reset state before each test
  clearState();
  // Clean state directory
  const testDir = join(tmpdir(), ".config", "assa");
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }
});

afterEach(() => {
  const testDir = join(tmpdir(), ".config", "assa");
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true });
  }
});

describe("xDismissConversation", () => {
  test("returns error when tweet_id is missing", async () => {
    const result = (await xDismissConversation({})) as {
      content: { type: string; text: string }[];
      isError: boolean;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Missing required parameter");
  });

  test("dismisses tweet successfully", async () => {
    const tweetId = uniqueId("tweet");
    const result = (await xDismissConversation({
      tweet_id: tweetId,
      reply_count: 5,
    })) as {
      content: { type: string; text: string }[];
      isError?: boolean;
    };

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Conversation dismissed");

    // Verify the tweet is actually dismissed in state
    expect(isDismissed(tweetId, 5)).toBe(true);
  });

  test("defaults reply_count to 0 when not provided", async () => {
    const tweetId = uniqueId("tweet");
    const result = (await xDismissConversation({
      tweet_id: tweetId,
    })) as {
      content: { type: string; text: string }[];
    };

    expect(result.content[0].text).toContain("Conversation dismissed");

    // Should be dismissed with reply_count of 0
    expect(isDismissed(tweetId, 0)).toBe(true);
  });
});
