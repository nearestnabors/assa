/**
 * Auth Manager
 * 
 * Handles authentication state and provides helper for tools to check auth.
 */

import { createUIResource } from '@mcp-ui/server';
import { createAuthButtonUI } from '../ui/auth-button.js';
import { arcadeClient } from '../arcade/client.js';

/**
 * Ensure user is authenticated before proceeding.
 * Returns null if authenticated, or an AuthButton response if not.
 */
export async function ensureAuth(): Promise<unknown | null> {
  const authState = await arcadeClient.getAuthStatus();
  
  if (authState.authorized) {
    return null; // Authenticated, proceed
  }

  // Not authenticated - return AuthButton UI
  const { oauthUrl, state } = await arcadeClient.initiateAuth();
  
  return {
    content: [
      {
        type: 'text',
        text: 'You need to connect your Twitter account first. Click the button below to authorize.',
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
