/**
 * ASSA MCP Server Setup
 *
 * Registers all tools and handles MCP protocol communication.
 *
 * Platform: Twitter/X via Arcade.dev
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

// Twitter tools
import { twitterAuthStatus } from './tools/auth-status.js';
import { twitterDraftTweet } from './tools/draft-tweet.js';
import { twitterPostTweet } from './tools/post-tweet.js';
import { twitterConversations } from './tools/conversations.js';
import { twitterDismissConversation } from './tools/dismiss-conversation.js';

// Tool definitions for MCP
const TOOLS: Tool[] = [
  // === Twitter/X Tools ===
  {
    name: 'twitter_auth_status',
    description: 'Check if Twitter/X is authenticated via Arcade. Returns an auth button UI if not connected.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'twitter_draft_tweet',
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
  },
  {
    name: 'twitter_post_tweet',
    description: 'Post a tweet to X/Twitter. Usually called from the draft preview UI after user approval.',
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
  },
  {
    name: 'twitter_conversations',
    description: 'Show Twitter conversations awaiting your reply. Displays mentions that you have not yet responded to.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'twitter_dismiss_conversation',
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
  },

];

// Tool handler dispatch
type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
const toolHandlers: Record<string, ToolHandler> = {
  twitter_auth_status: twitterAuthStatus,
  twitter_draft_tweet: twitterDraftTweet,
  twitter_post_tweet: twitterPostTweet,
  twitter_conversations: twitterConversations,
  twitter_dismiss_conversation: twitterDismissConversation,
};

export function createServer(): Server {
  const server = new Server(
    {
      name: 'assa-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
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
