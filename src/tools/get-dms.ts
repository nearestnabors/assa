/**
 * Twitter Get DMs Tool
 * 
 * Fetches unread Twitter DMs and displays them as UI cards.
 * 
 * TODO: Implement this tool
 * - Check auth first
 * - Call Arcade Twitter API to get DMs
 * - Transform to DMCard UI components
 * - Show preview only (first 100 chars) for privacy
 */

import { createUIResource } from '@mcp-ui/server';
import { createDMCardUI } from '../ui/dm-card.js';
import { arcadeClient } from '../arcade/client.js';
import { ensureAuth } from '../auth/manager.js';

interface GetDMsArgs {
  unread_only?: boolean;
  limit?: number;
}

export async function twitterGetDMs(
  args: Record<string, unknown>
): Promise<unknown> {
  const { unread_only = true, limit = 20 } = args as GetDMsArgs;
  
  // Check authentication
  const authResult = await ensureAuth();
  if (authResult) {
    return authResult;
  }

  // Fetch DMs from Arcade
  const dms = await arcadeClient.getDMs({ unread_only, limit });
  
  if (dms.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: unread_only ? 'No unread DMs.' : 'No DMs found.',
        },
      ],
    };
  }

  // Build text summary
  const textSummary = dms
    .map((dm) => `From @${dm.sender.handle}: "${dm.preview}..."`)
    .join('\n');

  // Build UI cards
  const uiCards = dms.map((dm) =>
    createUIResource({
      uri: `ui://assa/dm/${dm.id}`,
      content: {
        type: 'rawHtml',
        htmlString: createDMCardUI(dm),
      },
      encoding: 'text',
    })
  );

  return {
    content: [
      {
        type: 'text',
        text: `Found ${dms.length} ${unread_only ? 'unread ' : ''}DMs:\n\n${textSummary}`,
      },
      ...uiCards,
    ],
  };
}
