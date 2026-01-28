/**
 * Twitter Auth Status Tool
 *
 * Checks if Twitter is authenticated via Arcade.
 * If authenticated, uses X.WhoAmI to get the username.
 * If not authenticated, returns an AuthButton UI component.
 */

import { createUIResource } from '@mcp-ui/server';
import { createAuthButtonUI } from '../ui/auth-button.js';
import { arcadeClient } from '../arcade/client.js';

export async function twitterAuthStatus(
  _args: Record<string, unknown>
): Promise<unknown> {
  // Check with Arcade if we have a valid token (also fetches username via X.WhoAmI)
  const authState = await arcadeClient.getAuthStatus();

  if (authState.authorized) {
    const usernameText = authState.username ? ` as @${authState.username}` : '';

    return {
      content: [
        {
          type: 'text',
          text: `✓ Twitter/X connected${usernameText}. You can now post, reply, and view your conversations.`,
        },
      ],
    };
  }

  // Not authenticated - try to get OAuth URL
  const { oauthUrl, state, alreadyAuthorized } = await arcadeClient.initiateAuth();

  // If already authorized (initiateAuth detected completed status), report success
  if (alreadyAuthorized) {
    return {
      content: [
        {
          type: 'text',
          text: `✓ Twitter/X connected. You can now post, reply, and view your conversations.`,
        },
      ],
    };
  }

  // Need actual OAuth - show auth button
  return {
    content: [
      {
        type: 'text',
        text: 'Twitter is not connected. Click the button below to authorize.',
      },
      createUIResource({
        uri: `ui://assa/auth-button/${state}`,
        content: {
          type: 'rawHtml',
          htmlString: createAuthButtonUI({
            service: 'Twitter',
            authUrl: oauthUrl,
            state: state,
          }),
        },
        encoding: 'text',
      }),
    ],
  };
}
