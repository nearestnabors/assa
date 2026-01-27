/**
 * Auth Manager
 *
 * Handles authentication state and provides helper for tools to check auth.
 */

import { createUIResource } from '@mcp-ui/server';
import { createAuthButtonUI } from '../ui/auth-button.js';
import { arcadeClient, AuthRequiredError } from '../arcade/client.js';

/**
 * Create an auth button response for when user needs to (re-)authenticate
 */
async function createAuthResponse(message: string): Promise<unknown> {
  const { oauthUrl, state } = await arcadeClient.initiateAuth();

  return {
    content: [
      {
        type: 'text',
        text: message,
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

/**
 * Ensure user is authenticated before proceeding.
 * Returns null if authenticated, or an AuthButton response if not.
 */
export async function ensureAuth(): Promise<unknown | null> {
  const authState = await arcadeClient.getAuthStatus();

  if (authState.authorized) {
    return null; // Authenticated, proceed
  }

  return createAuthResponse(
    'You need to connect your Twitter account first. Click the button below to authorize.'
  );
}

/**
 * Handle an error that occurred during tool execution.
 * If it's an auth error, returns an AuthButton response.
 * Otherwise, re-throws the error.
 */
export async function handleToolError(error: unknown): Promise<unknown> {
  if (error instanceof AuthRequiredError) {
    console.error('[ASSA] Tool execution requires re-authentication');
    return createAuthResponse(
      'Your Twitter authorization has expired or was revoked. Please re-authorize to continue.'
    );
  }
  throw error;
}
