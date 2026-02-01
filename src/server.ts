/**
 * ASSA MCP Server Setup
 *
 * Registers all tools with MCP Apps UI resources.
 * Uses @modelcontextprotocol/ext-apps for rich UI components.
 *
 * Platform: X via Arcade.dev
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

// X tools
import { xAuthStatus } from "./tools/auth-status.js";
import {
  xConversations,
  xGetConversations,
  xListConversations,
} from "./tools/conversations.js";
import { xDismissConversation } from "./tools/dismiss-conversation.js";
import { xDraftTweet } from "./tools/draft-tweet.js";
import { xPostTweet } from "./tools/post-tweet.js";
import { xShowTweet } from "./tools/show-tweet.js";
import { xTimelineDigest } from "./tools/timeline-digest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// UI Resource URIs
const UI_RESOURCES = {
  authButton: "ui://assa/auth-button.html",
  tweetPreview: "ui://assa/tweet-preview.html",
  conversationList: "ui://assa/conversation-list.html",
};

// Tool definitions for MCP with UI metadata
const TOOLS: Tool[] = [
  // === X Tools ===
  {
    name: "x_auth_status",
    description:
      "Check X authentication status. Shows OAuth button if not authenticated.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    _meta: {
      ui: {
        resourceUri: UI_RESOURCES.authButton,
      },
    },
  },
  {
    name: "x_draft_tweet",
    description:
      "Create a draft tweet and show a preview UI for approval before posting.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Tweet content (max 280 characters)",
        },
        reply_to_id: {
          type: "string",
          description: "Tweet ID to reply to (optional)",
        },
        quote_tweet_id: {
          type: "string",
          description: "Tweet ID to quote (optional)",
        },
      },
      required: ["text"],
    },
    // _meta.ui links tool to UI resource
    _meta: {
      ui: {
        resourceUri: UI_RESOURCES.tweetPreview,
      },
    },
  },
  {
    name: "x_post_tweet",
    description:
      "Post a tweet to X. Usually called from the draft preview UI after user approval.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Tweet content (max 280 characters)",
        },
        reply_to_id: {
          type: "string",
          description: "Tweet ID to reply to (optional)",
        },
        quote_tweet_id: {
          type: "string",
          description: "Tweet ID to quote (optional)",
        },
      },
      required: ["text"],
    },
    // No UI - this is a data-only tool called from tweet-preview UI
  },
  {
    name: "x_conversations",
    description:
      'Show X conversations awaiting your reply. IMPORTANT: The UI shows everything the user needs. Your ONLY response should be a single short sentence like "Here are your conversations." Do NOT offer help, create todos, or ask follow-up questions.',
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    // _meta.ui links tool to UI resource (CSP configured in resource response)
    _meta: {
      ui: {
        resourceUri: UI_RESOURCES.conversationList,
      },
    },
  },
  {
    name: "x_get_conversations",
    description:
      "Internal tool to fetch conversation data for the UI with pagination.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description:
            "Maximum number of conversations to return (default: 10)",
        },
        offset: {
          type: "number",
          description: "Number of conversations to skip (for pagination)",
        },
      },
      required: [],
    },
    // Hidden from model - only callable by UI apps
    _meta: {
      ui: {
        visibility: ["app"],
      },
    },
  },
  {
    name: "x_dismiss_conversation",
    description:
      "Dismiss a conversation from the list. It will reappear if there is new activity (new replies).",
    inputSchema: {
      type: "object",
      properties: {
        tweet_id: {
          type: "string",
          description: "The tweet ID to dismiss",
        },
        reply_count: {
          type: "number",
          description: "Current reply count (used to detect new activity)",
        },
      },
      required: ["tweet_id", "reply_count"],
    },
    // No UI - this is a data-only tool called from conversation-list UI
  },
  {
    name: "x_timeline_digest",
    description:
      "Fetch your X Following timeline from the past 24 hours. " +
      "IMPORTANT: Requires Chrome running with --remote-debugging-port=9222 and logged into X. " +
      "Returns posts with links. When summarizing: " +
      "(1) SKIP ads, promotional content, marketing-speak, hate speech, and spam. " +
      "(2) Focus on interesting conversations, news, insights, and personal updates. " +
      "(3) ALWAYS include markdown links to each post you reference (format: [@username](post_url)) " +
      "so users can click to view/reply on X.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    // No UI - returns text for agent to summarize with links
  },
  {
    name: "x_show_tweet",
    description:
      "Display a single tweet as a rich card with reply functionality. " +
      "Use this when the user wants to see the full content of a specific tweet " +
      "or when they click 'Read more' on a tweet from the timeline digest.",
    inputSchema: {
      type: "object",
      properties: {
        tweet_id: {
          type: "string",
          description: "The ID of the tweet to display",
        },
      },
      required: ["tweet_id"],
    },
    // Uses conversation-list UI to display the tweet card
    _meta: {
      ui: {
        resourceUri: UI_RESOURCES.conversationList,
      },
    },
  },
  {
    name: "x_list_conversations",
    description:
      "List X conversations awaiting your reply as formatted text. " +
      "Use this in scheduled recipes or contexts where UI rendering is not available. " +
      "Returns conversations with links for easy access.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    // No UI - returns text for recipes and scheduled tasks
  },
];

// Tool handler dispatch
type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
const toolHandlers: Record<string, ToolHandler> = {
  x_auth_status: xAuthStatus,
  x_draft_tweet: xDraftTweet,
  x_post_tweet: xPostTweet,
  x_conversations: xConversations,
  x_get_conversations: xGetConversations, // UI-only, returns full data
  x_list_conversations: xListConversations, // Text-only, for recipes
  x_dismiss_conversation: xDismissConversation,
  x_show_tweet: xShowTweet,
  x_timeline_digest: xTimelineDigest,
};

// Load bundled UI HTML from dist/ui/{name}/index.html
async function loadUIResource(filename: string): Promise<string> {
  const baseName = filename.replace(".html", "");
  // Try from dist/ui/{name}/index.html (vite output location)
  const filePath = join(__dirname, "ui", baseName, "index.html");
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    // Fallback: try from project root dist/ui/{name}/index.html (for development)
    const altPath = join(__dirname, "..", "dist", "ui", baseName, "index.html");
    return await readFile(altPath, "utf-8");
  }
}

export function createServer(): Server {
  const server = new Server(
    {
      name: "assa-mcp",
      version: "0.2.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, () => {
    return { tools: TOOLS };
  });

  // Handle resource listing (for MCP Apps UI resources)
  server.setRequestHandler(ListResourcesRequestSchema, () => {
    return {
      resources: [
        {
          uri: UI_RESOURCES.authButton,
          name: "Auth Button UI",
          mimeType: RESOURCE_MIME_TYPE,
        },
        {
          uri: UI_RESOURCES.tweetPreview,
          name: "Tweet Preview UI",
          mimeType: RESOURCE_MIME_TYPE,
        },
        {
          uri: UI_RESOURCES.conversationList,
          name: "Conversation List UI",
          mimeType: RESOURCE_MIME_TYPE,
        },
      ],
    };
  });

  // Handle resource reading (serve bundled UI HTML)
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    // Map URI to filename
    const uriToFile: Record<string, string> = {
      [UI_RESOURCES.authButton]: "auth-button.html",
      [UI_RESOURCES.tweetPreview]: "tweet-preview.html",
      [UI_RESOURCES.conversationList]: "conversation-list.html",
    };

    const filename = uriToFile[uri];
    if (!filename) {
      throw new Error(`Unknown resource URI: ${uri}`);
    }

    const html = await loadUIResource(filename);

    // CSP resource domains - allow external fonts and avatar images
    const resourceDomains = [
      // Google Fonts
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
      // Avatar images
      "https://unavatar.io",
    ];

    return {
      contents: [
        {
          uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: html,
          _meta: {
            ui: {
              csp: {
                resourceDomains,
              },
            },
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = toolHandlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await handler(args ?? {});
      return result as CallToolResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
