<div style="text-align: center">
   <img style="display: inline-block;" width="500" alt="Anti Social Social Agent logo riffing on 'Anti Social Social Club' brannding" src="https://github.com/user-attachments/assets/2bb3f203-f344-48a7-9473-e91a7dd20a30" />
   <h1>ASSA: the antisocial social agent extension</h1>
</div>

ASSA lets you get timeline digests and have conversations with people on X (formerly Twitter)via rich UI components. Built for [Goose](https://github.com/block/goose) and other MCP-compatible AI agents.

## What is ASSA?

ASSA reclaims your social life by moving your activity off of algorithm driven sites and apps and into your personal agent, where you control the flow and decide how to engage. Enjoy:

- **Digest** tell you what's happening without opening any social app. Let your agent filter spam, ads, and hate speech!
- **Have conversations** right in your agent's interface, no need to open the X app or site.

## Features

- 🔐 **Safe authorization via Arcade**: Access you social accounts with sharing your password with an agent (or accidentally committing it, oops!)
- 📊 **Interactive interface**: Mentions displayed with avatars, text. Respond right there!
- 🔁 **You're in control**: Nothing posts without your explicit approval

## Installation

### Prerequisites

- [Goose](https://github.com/block/goose) (or another MCP-compatible agent)
- [Arcade.dev](https://arcade.dev) API key

### Setup

1. **Get your Arcade API key** at [arcade.dev](https://arcade.dev)

2. Clone and install:

   ```bash
   git clone https://github.com/nearestnabors/assa
   cd assa
   bun install
   bun run build
   ```

3. Add to Goose App (recommended—Goose CLI can't display interactive UI!)

* In Goose's sidebar, go to **Extensiions**
* Select "+ Add Custom Extension"
* Add the command: `node PATH TO ASSA FOLDER/dist/index.js`
* Add Environment variables `ARCADE_USER_ID` (the email you signed up to Arcade with) and `ARCADE_API_KEY` (get your [Arcade API key here]([url](https://app.arcade.dev/api-keys))
* Select "Add Extension"

## How to use

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

### Goose Recipe

ASSA includes a recipe for scheduled timeline digests:

| Recipe               | Description                                                                     |
| -------------------- | ------------------------------------------------------------------------------- |
| `x-news-digest.yaml` | Daily digest of your Following timeline (requires Chrome with remote debugging) |

#### Import the Recipe

**Option 1: Generate a Deep Link**

```bash
goose recipe deeplink recipes/x-news-digest.yaml
```

This outputs a `goose://recipe?config=...` URL. Paste it in a browser to import into Goose Desktop.

**Option 2: Import in Goose Desktop**

1. Open **Goose Desktop**
2. Click **Recipes** in the sidebar
3. Click **Import Recipe** or browse for file
4. Choose `recipes/x-news-digest.yaml` from the **Recipe File** input field

**Option 3: Run via CLI**

```bash
goose run --recipe recipes/x-news-digest.yaml
```

#### Schedule the Recipe

After importing, on the **Recipes** screen:

1. Click the clock icon next to the recipe
2. Select the frequency and time in the **Add Schedule** modal
3. Click **Save**

**Note:** Requires Chrome running with `--remote-debugging-port=9222`.

## Tools

| Tool                     | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `x_auth_status`          | Check authentication, show connect button if needed     |
| `x_conversations`        | Show unreplied mentions as a conversation inbox         |
| `x_dismiss_conversation` | Dismiss a conversation (reappears on new activity)      |
| `x_draft_tweet`          | Create draft with preview                               |
| `x_post_tweet`           | Post after approval                                     |
| `x_timeline_digest`      | Fetch and summarize your Following timeline (past 24h)  |
| `x_show_tweet`           | Display a single tweet as a rich card with reply option |

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

- [ ] Make the "reply UI" smaller:
  - [ ] Add small "dismiss" and "reply" icons in the lower left corner of each card
  - [ ] Clicking "reply" replaces icons with input area and reply button
  - [ ] Clicking outside closes the UI and brings back the icons

### Future

- [ ] Add `X.GetMutedUsers` to Arcade to filter muted accounts from conversations
- [ ] Add media expansion to Arcade to show images in tweets
- [ ] VIP accounts feature (track specific users)
- [ ] If a Tweet is a reply, show the original tweet as a stylized quote above the comment
- [ ] If a tweet quotes another tweet, show the quoted tweet below the comment

### Known Limitations

- **No DM support** — Arcade's X integration doesn't include DM access
- **7-day limit** — X search only goes back 7 days

## Credits

Built for [MCP Connect 2026](https://mcpconnect.dev) by [RL Nabors](https://nearestnabors).

Uses:

- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP Apps](https://github.com/anthropics/mcp-apps)
- [Goose](https://github.com/block/goose)
- [Arcade.dev](https://arcade.dev)
