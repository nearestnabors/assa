/**
 * ASSA MCP Server Setup
 * 
 * Registers all tools and handles MCP protocol communication.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

// Import tools (to be implemented)
import { twitterAuthStatus } from './tools/auth-status.js';
import { twitterGetMentions } from './tools/get-mentions.js';
import { twitterGetDMs } from './tools/get-dms.js';
import { twitterDailyDigest } from './tools/daily-digest.js';
import { twitterDraftTweet } from './tools/draft-tweet.js';
import { twitterPostTweet } from './tools/post-tweet.js';

// Tool definitions for MCP
const TOOLS: Tool[] = [
  {
    name: 'twitter_auth_status',
    description: 'Check if Twitter is authenticated. Returns an auth button UI if not connected.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'twitter_get_mentions',
    description: 'Fetch recent Twitter mentions with rich UI cards showing avatars, text, and engagement.',
    inputSchema: {
      type: 'object',
      properties: {
        hours: {
          type: 'number',
          description: 'Lookback period in hours (default: 24)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of mentions to return (default: 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'twitter_get_dms',
    description: 'Fetch unread Twitter DMs with preview cards.',
    inputSchema: {
      type: 'object',
      properties: {
        unread_only: {
          type: 'boolean',
          description: 'Only return unread DMs (default: true)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of DMs to return (default: 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'twitter_daily_digest',
    description: 'Get a combined digest of Twitter mentions and DMs with AI-friendly summary.',
    inputSchema: {
      type: 'object',
      properties: {
        hours: {
          type: 'number',
          description: 'Lookback period in hours (default: 24)',
        },
      },
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
    description: 'Post a tweet. Usually called from the draft preview UI after user approval.',
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
];

// Tool handler dispatch
type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
const toolHandlers: Record<string, ToolHandler> = {
  twitter_auth_status: twitterAuthStatus,
  twitter_get_mentions: twitterGetMentions,
  twitter_get_dms: twitterGetDMs,
  twitter_daily_digest: twitterDailyDigest,
  twitter_draft_tweet: twitterDraftTweet,
  twitter_post_tweet: twitterPostTweet,
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
