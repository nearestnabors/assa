#!/usr/bin/env node

/**
 * ASSA: Anti-Social Social Agent
 * MCP Server Entry Point
 *
 * This server provides Twitter integration with rich UI components.
 * Run with: node dist/index.js
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  // Check for required API key
  if (!process.env.ARCADE_API_KEY) {
    console.error("");
    console.error("=".repeat(60));
    console.error("  ERROR: ARCADE_API_KEY is required");
    console.error("=".repeat(60));
    console.error("");
    console.error("Set your Arcade API key in one of these places:");
    console.error("");
    console.error(
      "  Option 1: In your Goose config (~/.config/goose/config.yaml):"
    );
    console.error("");
    console.error("    extensions:");
    console.error("      assa:");
    console.error("        type: stdio");
    console.error("        command: node");
    console.error('        args: ["/path/to/assa-mcp/dist/index.js"]');
    console.error("        env:");
    console.error('          ARCADE_API_KEY: "your_key_here"');
    console.error("");
    console.error("  Option 2: Export in your shell before running:");
    console.error("");
    console.error('    export ARCADE_API_KEY="your_key_here"');
    console.error("");
    console.error("  Get your API key at: https://arcade.dev");
    console.error("=".repeat(60));
    console.error("");
    process.exit(1);
  }

  const server = createServer();
  const transport = new StdioServerTransport();

  // Connect to stdio transport (for Goose)
  await server.connect(transport);

  console.error("ASSA MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
