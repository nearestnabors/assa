/**
 * X Auth Status Tool
 *
 * Checks if X is authenticated via Arcade.
 * If authenticated, uses X.WhoAmI to get the username.
 * If not authenticated, returns auth data for the MCP Apps UI component.
 */

import { arcadeClient } from "../arcade/client.js";

export async function xAuthStatus(
  _args: Record<string, unknown>
): Promise<unknown> {
  // Check with Arcade if we have a valid token (also fetches username via X.WhoAmI)
  const authState = await arcadeClient.getAuthStatus();

  if (authState.authorized) {
    const usernameText = authState.username ? ` as @${authState.username}` : "";

    return {
      content: [
        {
          type: "text",
          text: `✓ X connected${usernameText}. You can now post, reply, and view your conversations.`,
        },
      ],
    };
  }

  // Not authenticated - try to get OAuth URL
  const { oauthUrl, state, alreadyAuthorized } =
    await arcadeClient.initiateAuth();

  // If already authorized (initiateAuth detected completed status), report success
  if (alreadyAuthorized) {
    return {
      content: [
        {
          type: "text",
          text: "✓ X connected. You can now post, reply, and view your conversations.",
        },
      ],
    };
  }

  // Need actual OAuth - return JSON data for the auth-button UI app
  const authData = {
    authRequired: true,
    service: "X",
    authUrl: oauthUrl,
    state,
    message: "Connect your X account to continue.",
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(authData),
      },
    ],
  };
}
