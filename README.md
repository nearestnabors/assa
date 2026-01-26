# ASSA: Anti-Social Social Agent

An MCP server that provides Twitter integration with rich UI components for [Goose](https://github.com/block/goose) and other MCP-compatible AI agents.

## What is ASSA?

Social media companies weaponize interfaces against humans (infinite scroll, notification anxiety, algorithmic rage bait). Agents are immune to psychological manipulation—they just execute.

ASSA reclaims the social web by:
- **Daily Digest**: Know what happened on Twitter without opening the app
- **Post with Approval**: Agent drafts, you review a rich preview, then approve

## Features

- 🔐 **OAuth via Arcade**: Secure authentication without handling tokens yourself
- 📊 **Rich UI Cards**: Mentions and DMs displayed with avatars, text, engagement metrics
- ✍️ **Tweet Previews**: See exactly what will post, with character count
- 🔁 **Human-in-the-Loop**: Nothing posts without your explicit approval

## Installation

### Prerequisites

- Node.js 20+
- [Goose](https://github.com/block/goose) (or another MCP-compatible agent)
- [Arcade.dev](https://arcade.dev) API key

### Setup

1. **Get your Arcade API key** at [arcade.dev](https://arcade.dev)

2. Clone and install:
   ```bash
   git clone https://github.com/YOUR_USERNAME/assa-mcp
   cd assa-mcp
   pnpm install
   pnpm build
   ```

3. Add to Goose (see below)

### Add to Goose

Add to `~/.config/goose/config.yaml`:

```yaml
extensions:
  assa:
    type: stdio
    command: node
    args: ["/path/to/assa-mcp/dist/index.js"]
    env:
      ARCADE_API_KEY: your_api_key_here  # <-- Required!
```

**Important:** The `env.ARCADE_API_KEY` is required. Get yours at [arcade.dev](https://arcade.dev).

#### Alternative: CLI setup
```bash
goose configure
# Select "Add Extension"
# Select "Command-line Extension"
# Name: assa
# Command: node /path/to/assa-mcp/dist/index.js
# Then manually add the env section to the config file
```

## Usage

### Check Twitter Activity
```
Check my Twitter mentions from the last 24 hours
```

### Get Daily Digest
```
Give me a summary of my Twitter activity today
```

### Post a Tweet
```
Post a tweet: "Just shipped a new feature! 🚀"
```

### Reply to Someone
```
Reply to @anthropic_devs saying I'll share slides after the talk
```

## Tools

| Tool | Description |
|------|-------------|
| `twitter_auth_status` | Check authentication, show connect button if needed |
| `twitter_get_mentions` | Fetch recent mentions with rich UI cards |
| `twitter_get_dms` | Fetch unread DMs |
| `twitter_daily_digest` | Combined digest with AI summary |
| `twitter_draft_tweet` | Create draft with preview |
| `twitter_post_tweet` | Post after approval |

## Development

```bash
# Run in development mode (auto-reload)
pnpm dev

# Type check
pnpm typecheck

# Build for production
pnpm build
```

## Getting an Arcade API Key

1. Go to [arcade.dev](https://arcade.dev)
2. Create an account
3. Navigate to API Keys
4. Create a new key
5. Add it to your `.env` file

## Architecture

```
Goose (MCP Client)
       │
       │ MCP Protocol
       ▼
ASSA MCP Server
       │
       │ HTTPS
       ▼
  Arcade.dev
       │
       │ OAuth + API
       ▼
   Twitter
```

## Credits

Built for [MCP Connect 2026](https://mcpconnect.dev) by RL.

Uses:
- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP-UI](https://mcpui.dev)
- [Goose](https://github.com/block/goose)
- [Arcade.dev](https://arcade.dev)

## License

MIT
