/**
 * Twitter Get Mentions Tool
 * 
 * Fetches recent Twitter mentions and displays them as rich UI cards.
 * 
 * TODO: Implement this tool
 * - Check auth first (return AuthButton if not authed)
 * - Call Arcade Twitter API to get mentions
 * - Transform to MentionCard UI components
 * - Return both text summary and UI
 */

import { createUIResource } from '@mcp-ui/server';
import { createMentionCardUI } from '../ui/mention-card.js';
import { arcadeClient } from '../arcade/client.js';
import { ensureAuth, handleToolError } from '../auth/manager.js';

interface GetMentionsArgs {
  hours?: number;
  limit?: number;
}

export async function twitterGetMentions(
  args: Record<string, unknown>
): Promise<unknown> {
  const { hours = 24, limit = 50 } = args as GetMentionsArgs;
  
  // Check authentication
  const authResult = await ensureAuth();
  if (authResult) {
    return authResult; // Returns AuthButton UI if not authenticated
  }

  // Fetch mentions from Arcade
  try {
    const mentions = await arcadeClient.getMentions({ hours, limit });

    if (mentions.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No mentions in the last ${hours} hours.`,
          },
        ],
      };
    }

    // Build text summary
    const textSummary = mentions
      .map((m) => `@${m.author.handle}: "${m.text}" (${m.metrics.likes} likes)`)
      .join('\n');

    // Build UI cards
    const uiCards = mentions.map((mention) =>
      createUIResource({
        uri: `ui://assa/mention/${mention.id}`,
        content: {
          type: 'rawHtml',
          htmlString: createMentionCardUI(mention),
        },
        encoding: 'text',
      })
    );

    return {
      content: [
        {
          type: 'text',
          text: `Found ${mentions.length} mentions in the last ${hours} hours:\n\n${textSummary}`,
        },
        ...uiCards,
      ],
    };
  } catch (error) {
    return handleToolError(error);
  }
}
