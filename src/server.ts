/**
 * ASSA MCP Server Setup
 *
 * Registers all tools with MCP Apps UI resources.
 * Uses @modelcontextprotocol/ext-apps for rich UI components.
 *
 * Platform: X via Arcade.dev
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// X tools
import { xAuthStatus } from './tools/auth-status.js';
import { xDraftTweet } from './tools/draft-tweet.js';
import { xPostTweet } from './tools/post-tweet.js';
import { xConversations } from './tools/conversations.js';
import { xDismissConversation } from './tools/dismiss-conversation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// UI Resource URIs
const UI_RESOURCES = {
  authButton: 'ui://assa/auth-button.html',
  tweetPreview: 'ui://assa/tweet-preview.html',
  conversationList: 'ui://assa/conversation-list.html',
};

// Tool definitions for MCP with UI metadata
const TOOLS: Tool[] = [
  // === X Tools ===
  {
    name: 'x_auth_status',
    description: 'Check if X is authenticated via Arcade. Returns an auth button UI if not connected.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    // _meta.ui links tool to UI resource
    _meta: {
      ui: {
        resourceUri: UI_RESOURCES.authButton,
      },
    },
  },
  {
    name: 'x_draft_tweet',
    description: 'Create a draft tweet and show a preview UI for approval before posting.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Tweet content (max 280 characters)',
        },
        reply_to_id: {
          type: 'string',
          description: 'Tweet ID to reply to (optional)',
        },
        quote_tweet_id: {
          type: 'string',
          description: 'Tweet ID to quote (optional)',
        },
      },
      required: ['text'],
    },
    // _meta.ui links tool to UI resource
    _meta: {
      ui: {
        resourceUri: UI_RESOURCES.tweetPreview,
      },
    },
  },
  {
    name: 'x_post_tweet',
    description: 'Post a tweet to X. Usually called from the draft preview UI after user approval.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Tweet content (max 280 characters)',
        },
        reply_to_id: {
          type: 'string',
          description: 'Tweet ID to reply to (optional)',
        },
        quote_tweet_id: {
          type: 'string',
          description: 'Tweet ID to quote (optional)',
        },
      },
      required: ['text'],
    },
    // No UI - this is a data-only tool called from tweet-preview UI
  },
  {
    name: 'x_conversations',
    description: 'Show X conversations awaiting your reply. Displays mentions that you have not yet responded to.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    // _meta.ui links tool to UI resource
    _meta: {
      ui: {
        resourceUri: UI_RESOURCES.conversationList,
        // Allow loading avatar images from unavatar.io
        csp: {
          resourceDomains: ['https://unavatar.io'],
        },
      },
    },
  },
  {
    name: 'x_dismiss_conversation',
    description: 'Dismiss a conversation from the list. It will reappear if there is new activity (new replies).',
    inputSchema: {
      type: 'object',
      properties: {
        tweet_id: {
          type: 'string',
          description: 'The tweet ID to dismiss',
        },
        reply_count: {
          type: 'number',
          description: 'Current reply count (used to detect new activity)',
        },
      },
      required: ['tweet_id', 'reply_count'],
    },
    // No UI - this is a data-only tool called from conversation-list UI
  },
];

// Tool handler dispatch
type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
const toolHandlers: Record<string, ToolHandler> = {
  x_auth_status: xAuthStatus,
  x_draft_tweet: xDraftTweet,
  x_post_tweet: xPostTweet,
  x_conversations: xConversations,
  x_dismiss_conversation: xDismissConversation,
};

// Load bundled UI HTML from dist/ui/{name}/ui-apps/{name}.html
async function loadUIResource(filename: string): Promise<string> {
  const baseName = filename.replace('.html', '');
  // Try from dist/ui/{name}/ui-apps/{name}.html (vite output location)
  const filePath = path.join(__dirname, 'ui', baseName, 'ui-apps', filename);
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    // Fallback: try from project root dist/ui/{name}/ui-apps/{name}.html (for development)
    const altPath = path.join(__dirname, '..', 'dist', 'ui', baseName, 'ui-apps', filename);
    return await fs.readFile(altPath, 'utf-8');
  }
}

export function createServer(): Server {
  const server = new Server(
    {
      name: 'assa-mcp',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle resource listing (for MCP Apps UI resources)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: UI_RESOURCES.authButton,
          name: 'Auth Button UI',
          mimeType: RESOURCE_MIME_TYPE,
        },
        {
          uri: UI_RESOURCES.tweetPreview,
          name: 'Tweet Preview UI',
          mimeType: RESOURCE_MIME_TYPE,
        },
        {
          uri: UI_RESOURCES.conversationList,
          name: 'Conversation List UI',
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
      [UI_RESOURCES.authButton]: 'auth-button.html',
      [UI_RESOURCES.tweetPreview]: 'tweet-preview.html',
      [UI_RESOURCES.conversationList]: 'conversation-list.html',
    };

    const filename = uriToFile[uri];
    if (!filename) {
      throw new Error(`Unknown resource URI: ${uri}`);
    }

    const html = await loadUIResource(filename);

    return {
      contents: [
        {
          uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: html,
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
