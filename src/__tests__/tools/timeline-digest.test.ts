import { describe, expect, test } from "bun:test";
import {
  normalizeXquikBaseUrl,
  timelineTweetFromXquik,
} from "../../tools/timeline-digest.js";

describe("Xquik timeline adapter", () => {
  test("normalizes default and host-only base URLs", () => {
    expect(normalizeXquikBaseUrl(undefined)).toBe("https://xquik.com/api/v1");
    expect(normalizeXquikBaseUrl("https://xquik.com")).toBe(
      "https://xquik.com/api/v1"
    );
    expect(normalizeXquikBaseUrl("https://xquik.com/api/v1/")).toBe(
      "https://xquik.com/api/v1"
    );
  });

  test("maps Xquik tweets into ASSA timeline tweets", () => {
    const mapped = timelineTweetFromXquik({
      id: "1234567890123456789",
      text: "Timeline item",
      createdAt: "2026-06-06T10:00:00Z",
      likeCount: "12",
      retweetCount: 3,
      replyCount: "4 replies",
      isQuoteStatus: true,
      quoted_tweet: { text: "quoted text" },
      author: {
        username: "xquikcom",
        name: "Xquik",
      },
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.id).toBe("1234567890123456789");
    expect(mapped?.text).toBe("Timeline item");
    expect(mapped?.authorUsername).toBe("xquikcom");
    expect(mapped?.authorDisplayName).toBe("Xquik");
    expect(mapped?.likes).toBe(12);
    expect(mapped?.retweets).toBe(3);
    expect(mapped?.replies).toBe(4);
    expect(mapped?.isQuote).toBe(true);
    expect(mapped?.quotedTweetText).toBe("quoted text");
  });

  test("rejects incomplete Xquik tweet payloads", () => {
    expect(timelineTweetFromXquik({ id: "1" })).toBeNull();
    expect(timelineTweetFromXquik({ text: "missing id" })).toBeNull();
    expect(timelineTweetFromXquik(null)).toBeNull();
  });
});
