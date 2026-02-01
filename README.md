# ASSA: Anti-Social Social Agent

An MCP server that provides X (formerly Twitter) integration with rich UI components for [Goose](https://github.com/block/goose) and other MCP-compatible AI agents.

## What is ASSA?

Social media companies weaponize interfaces against humans (infinite scroll, notification anxiety, algorithmic rage bait). Agents are immune to psychological manipulation—they just execute.

ASSA reclaims the social web by:

- **Daily Digest**: Know what happened on X without opening the app
- **Post with Approval**: Agent drafts, you review a rich preview, then approve

## Features

- 🔐 **OAuth via Arcade**: Secure authentication without handling tokens yourself
- 📊 **Rich UI Cards**: Mentions displayed with avatars, text, engagement metrics
- ✍️ **Tweet Previews**: See exactly what will post, with character count
- 🔁 **Human-in-the-Loop**: Nothing posts without your explicit approval

## Installation

### Prerequisites

- [Bun](https://bun.sh) 1.0+ (or Node.js 20+)
- [Goose](https://github.com/block/goose) (or another MCP-compatible agent)
- [Arcade.dev](https://arcade.dev) API key

### Setup

1. **Get your Arcade API key** at [arcade.dev](https://arcade.dev)

2. Clone and install:

   ```bash
   git clone https://github.com/YOUR_USERNAME/assa-mcp
   cd assa-mcp
   bun install
   bun run build
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
      ARCADE_API_KEY: your_api_key_here # <-- Required!
      ARCADE_USER_ID: you@example.com # <-- Required! Your Arcade account email
```

**Important:**

- `ARCADE_API_KEY` - Required. Get yours at [arcade.dev](https://arcade.dev)
- `ARCADE_USER_ID` - Required. Must match the email address of your Arcade account. This is used to link OAuth authorizations to your account.

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

### Check X Activity

```
Check my X mentions from the last 24 hours
```

### Get Timeline Digest

```
Show me a digest of my X timeline from the past 24 hours
```

**Note:** Timeline digest requires Chrome running with remote debugging. See [Timeline Digest Setup](#timeline-digest-setup) below.

### Post a Tweet

```
Post a tweet: "Just shipped a new feature! 🚀"
```

### Reply to Someone

```
Reply to @anthropic_devs saying I'll share slides after the talk
```

## Tools

| Tool                     | Description                                                   |
| ------------------------ | ------------------------------------------------------------- |
| `x_auth_status`          | Check authentication, show connect button if needed           |
| `x_conversations`        | Show unreplied mentions as a rich UI conversation inbox       |
| `x_list_conversations`   | List unreplied mentions as text (for scheduled recipes)       |
| `x_dismiss_conversation` | Dismiss a conversation (reappears on new activity)            |
| `x_draft_tweet`          | Create draft with preview                                     |
| `x_post_tweet`           | Post after approval                                           |
| `x_timeline_digest`      | Fetch and summarize your Following timeline (past 24h)        |
| `x_show_tweet`           | Display a single tweet as a rich card with reply option       |

## Timeline Digest Setup

The timeline digest feature accesses your "Following" timeline using your existing browser session and Playwright. This is free (no API costs) and uses your logged-in state. (An API would be more robust, but X only makes timeline API functionality available to industrial developers who can afford extortionate fees. So here we are, as hobbyists.)

### Prerequisites

1. **Google Chrome** installed
2. **Logged into X** in Chrome

### Start Chrome with Remote Debugging

Before using timeline digest, start Chrome with the remote debugging port:

**Mac:**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

**Windows:**

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**Linux:**

```bash
google-chrome --remote-debugging-port=9222
```

Then make sure you're logged into X in that browser window. (I keep one open and minimized on startup.)

### Goose Recipes

ASSA includes two recipes for scheduled automation:

| Recipe                 | Description                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- |
| `x-news-digest.yaml`   | Daily digest of your Following timeline (requires Chrome with remote debugging) |
| `x-conversations.yaml` | Check and respond to X mentions/conversations                                   |

#### Import a Recipe

**Option 1: Follow a Deep Link**

```bash
goose recipe deeplink recipes/x-news-digest.yaml
goose recipe deeplink recipes/x-conversations.yaml
```

This outputs a `goose://recipe?config=...` URL. Paste it in a browser to preview what it will output in Goose Desktop.

**Option 2: Import in Goose Desktop**

1. Open **Goose Desktop**
2. Click **Recipes** in the sidebar
3. Click **Import Recipe** or browse for file
4. Either past the link generated in Option 1 in the **Recipe Deeplink** input box, or choose a recipe from the `recipes/` folder in the **Recipe File** input field.

**Option 3: Run via CLI**

The outputs are in Markdown, enjoy!

```bash
goose run --recipe recipes/x-news-digest.yaml
```

(Not recommended for `x-conversations.yaml`, which return nothing because MCP Apps are iframes.)

#### Schedule a Recipe

After importing, on the **Recipes** screen:

1. Click the little clock icon next the the recipe you want to automate.
2. In the **Add Schedule** modal, select the frequency and time you want the recipe to run.
3. Click **Save**

**Note:** X News Digest requires Chrome running with `--remote-debugging-port=9222`.

## Development

```bash
# Run in development mode (auto-reload)
bun dev

# Type check
bun typecheck

# Lint check
bun check

# Run tests
bun test

# Run tests in watch mode
bun test:watch

# Build for production
bun run build
```

## Testing

ASSA uses [Bun's built-in test runner](https://bun.sh/docs/cli/test) with Jest-compatible syntax.

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode (re-runs on file changes)
bun test:watch

# Run a specific test file
bun test src/__tests__/utils/time.test.ts

# Run tests matching a pattern
bun test --grep "snowflake"
```

### Test Structure

Tests are located in `src/__tests__/` mirroring the source structure:

```
src/
├── __tests__/
│   ├── state/
│   │   └── manager.test.ts    # State management tests
│   ├── tools/
│   │   └── dismiss-conversation.test.ts
│   └── utils/
│       └── time.test.ts       # Time utility tests
├── state/
│   └── manager.ts
├── tools/
│   └── ...
└── utils/
    └── time.ts
```

### Writing Tests

Create a `.test.ts` file in the appropriate `__tests__` subdirectory:

```typescript
import { describe, expect, test } from "bun:test";
import { myFunction } from "../../utils/my-module.js";

describe("myFunction", () => {
  test("does something expected", () => {
    const result = myFunction("input");
    expect(result).toBe("expected output");
  });
});
```

### Mocking

Use `mock.module()` to mock Node.js modules:

```typescript
import { mock } from "bun:test";

// Mock before importing the module that uses it
mock.module("node:os", () => ({
  homedir: () => "/tmp/test-home",
}));

// Now import your module
import { myFunction } from "../../state/manager.js";
```

### Test Isolation

When testing stateful modules, use unique IDs and clean up between tests:

```typescript
import { beforeEach } from "bun:test";

let testCounter = 0;
function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++testCounter}`;
}

beforeEach(() => {
  clearState(); // Reset shared state
});
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
      X
```

## Roadmap

### Completed

- [x] Migrate to React components
- [x] Custom CSS design system (9 color palettes, semantic tokens)
- [x] Timeline digest via Playwright browser automation
- [x] Goose recipe for scheduled digests

### Next Steps

- [ ] Make Authorize button more attractive
- [ ] Make the "reply UI" smaller:
  - [ ] Add small "dismiss" and "reply" icons in the lower left corner of each card
  - [ ] Clicking "reply" replaces icons with input area and reply button
  - [ ] Clicking outside closes the UI and brings back the icons
- [ ] If a Tweet is a reply, show the original tweet as a stylized quote above the comment
- [ ] If a tweet quotes another tweet, show the quoted tweet below the comment

### Future

- [ ] Add `X.GetMutedUsers` to Arcade to filter muted accounts from conversations
- [ ] Add media expansion to Arcade to show images in tweets
- [ ] VIP accounts feature (track specific users)

### Known Limitations

- **No DM support** — Arcade's X integration doesn't include DM access
- **7-day limit** — X search only goes back 7 days

## Credits

Built for [MCP Connect 2026](https://mcpconnect.dev) by RL.

Uses:

- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP Apps](https://github.com/anthropics/mcp-apps)
- [Goose](https://github.com/block/goose)
- [Arcade.dev](https://arcade.dev)

## License

MIT
