/**
 * Twitter Auth Status Tool
 * 
 * Checks if Twitter is authenticated via Arcade.
 * If not authenticated, returns an AuthButton UI component.
 * 
 * TODO: Implement this tool
 * - Check auth state with Arcade
 * - If authenticated, return success message
 * - If not, return AuthButton UI that:
 *   1. Opens OAuth URL via 'link' action
 *   2. Polls for completion
 *   3. Fires 'prompt' action on success to retry original request
 */

import { createUIResource } from '@mcp-ui/server';
import { createAuthButtonUI } from '../ui/auth-button.js';
import { arcadeClient } from '../arcade/client.js';

export async function twitterAuthStatus(
  _args: Record<string, unknown>
): Promise<unknown> {
  // TODO: Check with Arcade if we have a valid token
  const authState = await arcadeClient.getAuthStatus();
  
  if (authState.authorized) {
    return {
      content: [
        {
          type: 'text',
          text: `✓ Twitter connected as @${authState.username}`,
        },
      ],
    };
  }

  // Not authenticated - get OAuth URL and return AuthButton
  const { oauthUrl, state } = await arcadeClient.initiateAuth();
  
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
