/**
 * Twitter Daily Digest Tool
 * 
 * Combines mentions and DMs into a single digest with AI-friendly summary.
 * 
 * TODO: Implement this tool
 * - Check auth first
 * - Fetch both mentions and DMs
 * - Build DigestContainer UI with sections
 * - Return structured data for LLM to summarize
 */

import { createUIResource } from '@mcp-ui/server';
import { createDigestContainerUI } from '../ui/digest-container.js';
import { arcadeClient } from '../arcade/client.js';
import { ensureAuth, handleToolError } from '../auth/manager.js';

interface DailyDigestArgs {
  hours?: number;
}

export async function twitterDailyDigest(
  args: Record<string, unknown>
): Promise<unknown> {
  const { hours = 24 } = args as DailyDigestArgs;

  // Check authentication
  const authResult = await ensureAuth();
  if (authResult) {
    return authResult;
  }

  try {
    // Fetch both mentions and DMs
    const [mentions, dms] = await Promise.all([
      arcadeClient.getMentions({ hours, limit: 50 }),
      arcadeClient.getDMs({ unread_only: true, limit: 20 }),
    ]);

    // Categorize mentions (this is a simple heuristic - LLM will do better)
    const questions = mentions.filter((m) => m.text.includes('?'));
    const others = mentions.filter((m) => !m.text.includes('?'));

    // Build digest data
    const digestData = {
      title: `Twitter Digest — Last ${hours}h`,
      generatedAt: new Date().toISOString(),
      sections: [
        {
          title: 'Needs Response',
          icon: '💬',
          count: questions.length + dms.length,
          items: [...questions, ...dms],
        },
        {
          title: 'Other Mentions',
          icon: '📣',
          count: others.length,
          items: others,
        },
      ],
      stats: {
        totalMentions: mentions.length,
        unreadDMs: dms.length,
        questionsAsked: questions.length,
      },
    };

    // Build text summary for LLM
    const textSummary = `
Twitter Activity Summary (Last ${hours} hours):
- ${mentions.length} mentions
- ${dms.length} unread DMs
- ${questions.length} questions/requests to potentially respond to

Key mentions:
${mentions.slice(0, 5).map((m) => `• @${m.author.handle}: "${m.text.slice(0, 100)}..."`).join('\n')}

${dms.length > 0 ? `\nUnread DMs from: ${dms.map((dm) => `@${dm.sender.handle}`).join(', ')}` : ''}
`.trim();

    return {
      content: [
        {
          type: 'text',
          text: textSummary,
        },
        createUIResource({
          uri: `ui://assa/digest/${Date.now()}`,
          content: {
            type: 'rawHtml',
            htmlString: createDigestContainerUI(digestData),
          },
          encoding: 'text',
        }),
      ],
    };
  } catch (error) {
    return handleToolError(error);
  }
}
