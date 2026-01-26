# ASSA: Anti-Social Social Agent

## Overview

**Project:** ASSA (Anti-Social Social Agent)
**Purpose:** MCP server that provides Twitter/X integration with rich UI components for Goose
**Author:** RL (they/them)

### Core Thesis

Social media companies weaponize interfaces against humans. Agents are immune to psychological manipulation—they just execute. ASSA reclaims the social web by:
1. Providing a **daily digest** of Twitter activity (no doom-scrolling)
2. Enabling **posting with approval** via rich UI previews (human-in-the-loop)

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| MCP SDK | `@modelcontextprotocol/sdk` |
| MCP-UI SDK | `@mcp-ui/server` |
| Twitter API | Arcade.dev |
| Package Manager | pnpm |

---

## Arcade.dev Integration

### API Reference

**Base URL:** `https://api.arcade.dev/v1`

**Authentication:** Bearer token via `ARCADE_API_KEY` environment variable.

### Auth Endpoints

```
POST /auth/authorize
Body: {
  user_id: string,
  auth_requirement: {
    provider_type: "x",
    oauth2: { scopes: ["tweet.read", "tweet.write", "users.read"] }
  }
}
Response: { id: string, url: string, status: string }

GET /auth/status?id={auth_id}
Response: { status: "pending" | "completed", context?: { user_info?: { username?: string } } }
```

### Tool Execution

```
POST /tools/execute
Body: {
  tool_name: string,    // e.g., "X.PostTweet"
  input: object,        // Tool-specific parameters
  user_id: string       // Same user_id used for auth
}
Response: { output: any, status: string, error?: string }
```

### Available X Tools

| Tool | Parameters | Description |
|------|------------|-------------|
| `X.PostTweet` | `tweet_text`, `quote_tweet_id?` | Post a new tweet |
| `X.ReplyToTweet` | `tweet_id`, `tweet_text`, `quote_tweet_id?` | Reply to a tweet |
| `X.DeleteTweetById` | `tweet_id` | Delete a tweet |
| `X.LookupTweetById` | `tweet_id` | Get tweet by ID |
| `X.LookupSingleUserByUsername` | `username` | Look up user |
| `X.SearchRecentTweetsByUsername` | `username`, `max_results?`, `next_token?` | Search user's tweets (7 days) |
| `X.SearchRecentTweetsByKeywords` | `keywords?`, `phrases?`, `max_results?`, `next_token?` | Search by keywords (7 days) |

**Note:** Arcade does not provide direct "get mentions" or "get DMs" tools. Mentions must be found by searching for @username.

---

## Environment Variables

```bash
ARCADE_API_KEY=your_arcade_api_key     # Required
ARCADE_BASE_URL=https://api.arcade.dev/v1  # Optional, defaults to this
ARCADE_USER_ID=your_user_id            # Optional, defaults to "assa-default-user"
```

---

## Reference Links

- **Arcade Docs (LLM-friendly):** https://docs.arcade.dev/llms.txt
- **Arcade X Integration:** https://docs.arcade.dev/en/resources/integrations/social-communication/x
- **Arcade API Reference:** https://docs.arcade.dev/en/references/api
- **Arcade OpenAPI Spec:** https://api.arcade.dev/v1/swagger
- **MCP SDK:** https://github.com/modelcontextprotocol/typescript-sdk
- **MCP-UI:** https://mcpui.dev
- **Goose:** https://github.com/block/goose

---

## Development Commands

```bash
pnpm install      # Install dependencies
pnpm build        # Compile TypeScript
pnpm dev          # Run with tsx watch
pnpm typecheck    # Type check only
```

---

## Goose Configuration

Add to `~/.config/goose/config.yaml`:

```yaml
extensions:
  assa:
    type: stdio
    command: node
    args: ["/path/to/assa-mcp-starter/dist/index.js"]
    env:
      ARCADE_API_KEY: "your_api_key_here"
```
