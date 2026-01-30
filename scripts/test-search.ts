/**
 * Test X.SearchRecentTweetsByKeywords
 * Run with: npx tsx scripts/test-search.ts
 */

import "dotenv/config";
import { createInterface } from "node:readline";
import Arcade from "@arcadeai/arcadejs";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  const apiKey = process.env.ARCADE_API_KEY;
  const userId = process.env.ARCADE_USER_ID;

  if (!apiKey) {
    console.error("Error: ARCADE_API_KEY environment variable not set");
    process.exit(1);
  }

  if (!userId) {
    console.error("Error: ARCADE_USER_ID environment variable not set");
    console.error("Add ARCADE_USER_ID=your@email.com to your .env file");
    process.exit(1);
  }

  const arcade = new Arcade({ apiKey });

  console.log(`Using user_id: ${userId}`);
  console.log("Testing X.SearchRecentTweetsByKeywords for @rachelnabors...\n");

  try {
    const result = await arcade.tools.execute({
      tool_name: "X.SearchRecentTweetsByKeywords",
      user_id: userId,
      input: {
        phrases: ["@rachelnabors"],
        max_results: 10,
      },
    });

    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };

    if (err.status === 403 || err.message?.includes("authorization required")) {
      console.log("\n⚠️  Authorization required. Initiating OAuth flow...\n");

      // Initiate OAuth
      const authResponse = await arcade.auth.authorize({
        user_id: userId,
        auth_requirement: {
          provider_id: "x",
          oauth2: {
            scopes: ["tweet.read", "users.read", "offline.access"],
          },
        },
      });

      if (authResponse.status === "completed") {
        console.log("Already authorized! Trying again...\n");
        // Retry the request
        const result = await arcade.tools.execute({
          tool_name: "X.SearchRecentTweetsByKeywords",
          user_id: userId,
          input: {
            phrases: ["@rachelnabors"],
            max_results: 10,
          },
        });
        console.log("Result:", JSON.stringify(result, null, 2));
      } else if (authResponse.url) {
        console.log("Please authorize in your browser:");
        console.log(`\n  ${authResponse.url}\n`);

        await prompt("Press Enter after completing authorization...");

        // Check auth status
        const statusResponse = await arcade.auth.status({
          id: authResponse.id,
        });

        if (statusResponse.status === "completed") {
          console.log(
            "\n✅ Authorization successful! Trying search again...\n"
          );

          const result = await arcade.tools.execute({
            tool_name: "X.SearchRecentTweetsByKeywords",
            user_id: userId,
            input: {
              phrases: ["@rachelnabors"],
              max_results: 10,
            },
          });

          console.log("Result:", JSON.stringify(result, null, 2));
        } else {
          console.log(
            "Authorization not completed. Status:",
            statusResponse.status
          );
        }
      } else {
        console.log("Auth response:", authResponse);
      }
    } else {
      console.error("Error:", error);
    }
  }

  rl.close();
}

main();
