/**
 * X Timeline Digest Tool
 *
 * Connects to an existing Chrome browser session via CDP,
 * navigates to the Twitter Following timeline, and extracts
 * tweets from the past 24 hours for summarization.
 *
 * Prerequisites:
 * - Chrome must be started with: --remote-debugging-port=9222
 * - User must be logged into Twitter in that browser
 */

import { appendFileSync } from "node:fs";
import { type Browser, chromium, type Page } from "playwright";
import { timestampFromSnowflake } from "../utils/time.js";

const DEBUG_LOG = "/tmp/assa-timeline-debug.log";
const CDP_ENDPOINT = "http://127.0.0.1:9222";
const TWITTER_HOME_URL = "https://x.com/home";

// 24 hours in milliseconds
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Regex patterns (top-level for performance)
const TWEET_STATUS_REGEX = /\/status\/(\d+)/;

function debugLog(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const line = data
    ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}\n`
    : `[${timestamp}] ${message}\n`;
  try {
    appendFileSync(DEBUG_LOG, line);
  } catch {
    // ignore write errors
  }
}

/**
 * Wait for a random human-like delay
 */
function humanDelay(minMs = 2000, maxMs = 4000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Represents a tweet extracted from the timeline
 */
export interface TimelineTweet {
  id: string;
  text: string;
  authorUsername: string;
  authorDisplayName: string;
  timestamp: Date;
  likes: number;
  retweets: number;
  replies: number;
  isRetweet: boolean;
  isQuote: boolean;
  quotedTweetText?: string;
}

/**
 * Connect to Chrome via CDP
 * User must have started Chrome with --remote-debugging-port=9222
 */
async function connectToBrowser(): Promise<Browser> {
  debugLog("Attempting to connect to Chrome via CDP", {
    endpoint: CDP_ENDPOINT,
  });

  try {
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    debugLog("Successfully connected to Chrome");
    return browser;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog("Failed to connect to Chrome", { error: message });

    throw new Error(
      "Could not connect to Chrome. Please start Chrome with remote debugging:\n\n" +
        "On Mac:\n" +
        '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug-profile"\n\n' +
        "On Windows:\n" +
        '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\\chrome-debug-profile"\n\n' +
        "Then make sure you're logged into Twitter/X in that browser."
    );
  }
}

/**
 * Create a new tab for Twitter timeline scraping
 * Returns the new page - caller is responsible for closing it
 */
async function createTwitterPage(browser: Browser): Promise<Page> {
  const contexts = browser.contexts();
  debugLog(`Found ${contexts.length} browser contexts`);

  if (contexts.length === 0) {
    throw new Error(
      "No browser contexts found. Please make sure Chrome is open with at least one window."
    );
  }

  // Create a new page (tab) in the first context
  const context = contexts[0];
  debugLog("Creating new tab for Twitter timeline");
  const page = await context.newPage();

  return page;
}

/**
 * Navigate to the Following timeline
 */
async function navigateToFollowing(page: Page): Promise<void> {
  // Navigate to Twitter home
  debugLog("Navigating to Twitter home");
  await page.goto(TWITTER_HOME_URL, { waitUntil: "domcontentloaded" });
  await humanDelay(2000, 3000);

  // Look for and click the "Following" tab
  // Twitter uses div[role="tab"] containing text "Following"
  try {
    debugLog("Looking for Following tab");

    // Wait for tweets to load first (indicates page is ready)
    await page.waitForSelector('article[data-testid="tweet"]', {
      timeout: 10_000,
    });

    // The Following tab is a div[role="tab"] with "Following" text inside
    // We need to click it to switch from "For you" to "Following" timeline
    const followingTab = page
      .locator('div[role="tab"]:has-text("Following")')
      .first();

    if (await followingTab.isVisible({ timeout: 3000 })) {
      await followingTab.click();
      debugLog("Clicked Following tab");
      // Wait for timeline to refresh
      await humanDelay(2000, 3000);

      // After clicking Following, there may be a dropdown to select "Recent" (chronological)
      // The Following tab has a dropdown arrow (svg) - clicking the tab may open a menu
      await selectRecentSort(page);
    } else {
      debugLog("WARNING: Following tab not visible");
    }
  } catch (error) {
    debugLog("Error navigating to Following tab", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * If there's a sort dropdown open, select "Recent" for chronological order
 */
async function selectRecentSort(page: Page): Promise<void> {
  try {
    // Check if a menu with "Recent" option is visible
    const recentMenuItem = page
      .locator('div[role="menuitem"]:has-text("Recent")')
      .first();

    if (await recentMenuItem.isVisible({ timeout: 1000 })) {
      debugLog("Found Recent menu item, clicking it");
      await recentMenuItem.click();
      await humanDelay(1500, 2500);
      return;
    }

    // Menu might not be open yet - try clicking the Following tab dropdown arrow
    // The Following tab has an SVG dropdown indicator
    const followingTabWithDropdown = page
      .locator('div[role="tab"]:has-text("Following") svg')
      .first();

    if (await followingTabWithDropdown.isVisible({ timeout: 1000 })) {
      debugLog("Clicking Following tab dropdown arrow");
      await followingTabWithDropdown.click();
      await humanDelay(500, 1000);

      // Now look for Recent menu item
      const menuItem = page
        .locator('div[role="menuitem"]:has-text("Recent")')
        .first();
      if (await menuItem.isVisible({ timeout: 2000 })) {
        debugLog("Found Recent menu item after opening dropdown");
        await menuItem.click();
        await humanDelay(1500, 2500);
      }
    }
  } catch (error) {
    debugLog("Could not select Recent sort (may not be available)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Extract tweet data from the current page
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Tweet extraction requires handling many edge cases
async function extractVisibleTweets(page: Page): Promise<TimelineTweet[]> {
  const tweets: TimelineTweet[] = [];

  try {
    // Twitter uses article elements for tweets
    const tweetElements = await page
      .locator('article[data-testid="tweet"]')
      .all();
    debugLog(`Found ${tweetElements.length} tweet elements`);

    for (const tweetEl of tweetElements) {
      try {
        // Extract tweet link to get the ID
        const tweetLink = await tweetEl
          .locator('a[href*="/status/"]')
          .first()
          .getAttribute("href");
        const idMatch = tweetLink?.match(TWEET_STATUS_REGEX);
        const id = idMatch?.[1];

        if (!id) {
          continue;
        }

        // Check if we already have this tweet
        if (tweets.some((t) => t.id === id)) {
          continue;
        }

        // Extract tweet text
        const textEl = tweetEl.locator('[data-testid="tweetText"]').first();
        const text = (await textEl.textContent()) || "";

        // Extract author info
        const authorLink = await tweetEl
          .locator('a[href^="/"][role="link"]')
          .first()
          .getAttribute("href");
        const authorUsername = authorLink?.replace("/", "") || "unknown";

        // Try to get display name
        let authorDisplayName = authorUsername;
        try {
          const displayNameEl = tweetEl
            .locator('[data-testid="User-Name"] span')
            .first();
          authorDisplayName =
            (await displayNameEl.textContent()) || authorUsername;
        } catch {
          // Use username as fallback
        }

        // Parse timestamp from snowflake ID
        const timestamp = timestampFromSnowflake(id) || new Date();

        // Extract engagement metrics
        let likes = 0;
        let retweets = 0;
        let replies = 0;

        try {
          const likeButton = tweetEl.locator('[data-testid="like"]').first();
          const likeText = await likeButton.textContent();
          likes = Number.parseInt(likeText?.replace(/[^0-9]/g, "") || "0", 10);
        } catch {
          /* ignore */
        }

        try {
          const retweetButton = tweetEl
            .locator('[data-testid="retweet"]')
            .first();
          const rtText = await retweetButton.textContent();
          retweets = Number.parseInt(rtText?.replace(/[^0-9]/g, "") || "0", 10);
        } catch {
          /* ignore */
        }

        try {
          const replyButton = tweetEl.locator('[data-testid="reply"]').first();
          const replyText = await replyButton.textContent();
          replies = Number.parseInt(
            replyText?.replace(/[^0-9]/g, "") || "0",
            10
          );
        } catch {
          /* ignore */
        }

        // Check if it's a retweet
        const isRetweet =
          text.startsWith("RT @") ||
          (await tweetEl.locator('[data-testid="socialContext"]').count()) > 0;

        // Check if it's a quote tweet
        const isQuote =
          (await tweetEl.locator('[data-testid="quoteTweet"]').count()) > 0;
        let quotedTweetText: string | undefined;
        if (isQuote) {
          try {
            const quotedEl = tweetEl
              .locator('[data-testid="quoteTweet"] [data-testid="tweetText"]')
              .first();
            quotedTweetText = (await quotedEl.textContent()) || undefined;
          } catch {
            /* ignore */
          }
        }

        tweets.push({
          id,
          text,
          authorUsername,
          authorDisplayName,
          timestamp,
          likes,
          retweets,
          replies,
          isRetweet,
          isQuote,
          quotedTweetText,
        });
      } catch (error) {
        debugLog("Error extracting tweet", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    debugLog("Error in extractVisibleTweets", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return tweets;
}

/**
 * Check if a tweet is older than 24 hours
 */
function isOlderThan24Hours(timestamp: Date): boolean {
  const now = new Date();
  return now.getTime() - timestamp.getTime() > TWENTY_FOUR_HOURS_MS;
}

/**
 * Scroll the page and collect tweets until we find ones older than 24 hours
 * Always scrolls at least MIN_SCROLL_ATTEMPTS times to ensure we get enough content
 */
async function scrollAndCollectTweets(page: Page): Promise<TimelineTweet[]> {
  const allTweets = new Map<string, TimelineTweet>();
  let scrollAttempts = 0;
  const minScrollAttempts = 3; // Always scroll at least this many times
  const maxScrollAttempts = 50; // Safety limit
  let foundOldTweet = false;

  debugLog("Starting scroll and collect loop", {
    minScrollAttempts,
    maxScrollAttempts,
  });

  while (scrollAttempts < maxScrollAttempts) {
    scrollAttempts++;
    debugLog(`Scroll attempt ${scrollAttempts}`);

    // Extract tweets from current view
    const visibleTweets = await extractVisibleTweets(page);
    debugLog(`Extracted ${visibleTweets.length} tweets this scroll`);

    for (const tweet of visibleTweets) {
      if (!allTweets.has(tweet.id)) {
        allTweets.set(tweet.id, tweet);

        // Check if this tweet is older than 24 hours
        if (isOlderThan24Hours(tweet.timestamp)) {
          debugLog("Found tweet older than 24 hours", {
            id: tweet.id,
            timestamp: tweet.timestamp.toISOString(),
          });
          foundOldTweet = true;
        }
      }
    }

    // Only stop for old tweets AFTER minimum scrolls completed
    if (foundOldTweet && scrollAttempts >= minScrollAttempts) {
      debugLog(
        "Stopping scroll - found old tweet and completed minimum scrolls"
      );
      break;
    }

    // Scroll down - use mouse wheel which is more human-like
    await page.mouse.wheel(0, 800);

    // Wait for new content to load (human-like delay)
    await humanDelay(2000, 4000);

    // Check if we've reached the bottom (no new tweets) - but only after min scrolls
    if (visibleTweets.length === 0 && scrollAttempts >= minScrollAttempts) {
      debugLog("No new tweets found, may have reached timeline end");
      break;
    }
  }

  debugLog("Scroll complete", {
    totalTweets: allTweets.size,
    scrollAttempts,
    stoppedDueToOldTweet: foundOldTweet,
  });

  // Convert map to array and filter to only last 24 hours
  const tweetsArray = Array.from(allTweets.values()).filter(
    (t) => !isOlderThan24Hours(t.timestamp)
  );

  // Sort by timestamp (newest first)
  tweetsArray.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return tweetsArray;
}

/**
 * Format relative time from a Date
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  return `${diffHours}h ago`;
}

/**
 * Format tweets as text with URLs for agent to summarize
 * Includes tweet links so agent can include them in its summary
 */
function formatTweetsWithLinks(tweets: TimelineTweet[]): string {
  if (tweets.length === 0) {
    return "No tweets found in your Following timeline from the past 24 hours.";
  }

  const lines: string[] = [
    `Found ${tweets.length} tweets from the past 24 hours in your Following timeline.`,
    "",
    "When summarizing, include markdown links to tweets like: [@username](url)",
    "",
  ];

  for (const tweet of tweets) {
    const timeAgo = formatTimeAgo(tweet.timestamp);
    const tweetUrl = `https://x.com/${tweet.authorUsername}/status/${tweet.id}`;
    const engagement = `${tweet.likes} likes, ${tweet.retweets} RTs, ${tweet.replies} replies`;

    let prefix = "";
    if (tweet.isRetweet) {
      prefix = "[RT] ";
    } else if (tweet.isQuote) {
      prefix = "[QT] ";
    }

    // Truncate long tweets
    const maxTextLength = 200;
    const truncatedText =
      tweet.text.length > maxTextLength
        ? `${tweet.text.substring(0, maxTextLength)}...`
        : tweet.text;

    lines.push("---");
    lines.push(
      `${prefix}@${tweet.authorUsername} (${tweet.authorDisplayName}) - ${timeAgo}`
    );
    lines.push(`URL: ${tweetUrl}`);
    lines.push(truncatedText);
    lines.push(`Engagement: ${engagement}`);

    if (tweet.quotedTweetText) {
      lines.push(`> Quoted: "${tweet.quotedTweetText.substring(0, 100)}..."`);
    }
  }

  return lines.join("\n");
}

/**
 * Tool: x_timeline_digest
 * Fetches tweets from the Following timeline for the past 24 hours
 */
export async function xTimelineDigest(): Promise<unknown> {
  debugLog("=== Starting timeline digest ===");

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Connect to existing Chrome browser
    browser = await connectToBrowser();

    // Create a new tab for Twitter (don't interfere with user's browsing)
    page = await createTwitterPage(browser);

    // Navigate to Following tab
    await navigateToFollowing(page);

    // Scroll and collect tweets
    const tweets = await scrollAndCollectTweets(page);

    debugLog("Timeline digest complete", {
      tweetCount: tweets.length,
    });

    // Format tweets as text with URLs for agent to summarize
    const formattedOutput = formatTweetsWithLinks(tweets);

    return {
      content: [
        {
          type: "text",
          text: formattedOutput,
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog("Error in timeline digest", { error: message });

    return {
      content: [
        {
          type: "text",
          text: `Error fetching timeline: ${message}`,
        },
      ],
      isError: true,
    };
  } finally {
    // Close the tab we created
    if (page) {
      try {
        debugLog("Closing Twitter tab");
        await page.close();
      } catch {
        // Ignore close errors
      }
    }
    // Don't close the browser - we're connected to user's browser
    if (browser) {
      try {
        // Playwright's connectOverCDP doesn't actually own the browser,
        // so we just let the connection drop
        debugLog("Disconnecting from browser");
      } catch {
        // Ignore disconnect errors
      }
    }
  }
}
