/**
 * Twitter Set Handle Tool
 *
 * Allows the user to set their Twitter handle for mention searches.
 * This is needed because Arcade's auth response doesn't include username.
 */

import { setAuthenticatedUsername } from '../arcade/client.js';

export async function twitterSetHandle(
  args: Record<string, unknown>
): Promise<unknown> {
  const handle = args.handle as string | undefined;

  if (!handle) {
    return {
      content: [
        {
          type: 'text',
          text: 'Please provide your Twitter handle. Usage: set my Twitter handle to @yourhandle',
        },
      ],
    };
  }

  // Clean the handle (remove @ if present)
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  // Store it
  setAuthenticatedUsername(cleanHandle);

  return {
    content: [
      {
        type: 'text',
        text: `✓ Twitter handle set to @${cleanHandle}. I can now search for your mentions.`,
      },
    ],
  };
}
