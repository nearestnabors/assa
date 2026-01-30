/**
 * Auth Manager
 *
 * Handles authentication state and provides helper for tools to check auth.
 * Returns structured JSON data that client UIs can detect and handle.
 *
 * Auth Response Format:
 * {
 *   authRequired: true,
 *   service: "Twitter",
 *   authUrl: "https://...",
 *   message: "..."
 * }
 *
 * Client UIs can check for `authRequired: true` to show the auth flow.
 */

import {
  AuthRequiredError,
  arcadeClient,
  clearAuthCache,
} from "../arcade/client.js";

/**
 * Structured auth response that clients can detect and handle
 */
export interface AuthRequiredResponse {
  authRequired: true;
  service: string;
  authUrl: string;
  state: string;
  message: string;
}

/**
 * Create an auth response with JSON data for the auth-button UI
 * Can optionally use an existing OAuth URL from an AuthRequiredError
 */
async function createAuthResponse(
  message: string,
  existingAuthUrl?: string,
  existingState?: string
): Promise<unknown> {
  console.error("[ASSA Auth] createAuthResponse called");
  console.error("[ASSA Auth] existingAuthUrl:", existingAuthUrl);
  console.error("[ASSA Auth] existingState:", existingState);

  // If we already have an auth URL from a caught AuthRequiredError, use it directly
  if (existingAuthUrl) {
    console.error("[ASSA Auth] Using existing OAuth URL from error");
    const authData: AuthRequiredResponse = {
      authRequired: true,
      service: "Twitter",
      authUrl: existingAuthUrl,
      state: existingState || "",
      message,
    };

    const response = {
      content: [
        {
          type: "text",
          text: JSON.stringify(authData),
        },
      ],
    };
    console.error(
      "[ASSA Auth] Returning auth response:",
      JSON.stringify(response, null, 2)
    );
    return response;
  }

  // Otherwise, initiate a new auth flow
  try {
    const { oauthUrl, state, alreadyAuthorized } =
      await arcadeClient.initiateAuth();
    console.error(
      "[ASSA Auth] Got OAuth URL:",
      oauthUrl,
      "alreadyAuthorized:",
      alreadyAuthorized
    );

    // Handle weird state: Arcade says we're authorized but tool failed
    if (alreadyAuthorized && !oauthUrl) {
      console.error(
        "[ASSA Auth] Arcade reports authorized but tool failed - permissions mismatch"
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: true,
              message:
                "Your Twitter connection needs to be refreshed. " +
                "Please try again in a few minutes, or restart the app to reconnect.",
            }),
          },
        ],
        isError: true,
      };
    }

    if (!oauthUrl) {
      console.error("[ASSA Auth] No OAuth URL returned from initiateAuth");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: true,
              message: "Could not get authorization URL. Please try again.",
            }),
          },
        ],
        isError: true,
      };
    }

    const authData: AuthRequiredResponse = {
      authRequired: true,
      service: "Twitter",
      authUrl: oauthUrl,
      state,
      message,
    };

    const response = {
      content: [
        {
          type: "text",
          text: JSON.stringify(authData),
        },
      ],
    };
    console.error(
      "[ASSA Auth] Returning auth response:",
      JSON.stringify(response, null, 2)
    );
    return response;
  } catch (error) {
    console.error("[ASSA Auth] Failed to get OAuth URL:", error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: true,
            message: `Failed to initiate authentication: ${error instanceof Error ? error.message : String(error)}`,
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Ensure user is authenticated before proceeding.
 * Returns null if authenticated, or auth data for the UI if not.
 */
export async function ensureAuth(): Promise<unknown | null> {
  const authState = await arcadeClient.getAuthStatus();

  if (authState.authorized) {
    return null; // Authenticated, proceed
  }

  return createAuthResponse(
    "You need to connect your Twitter account first. Click the button below to authorize."
  );
}

/**
 * Handle an error that occurred during tool execution.
 * If it's an auth error, returns structured auth data for the UI.
 * Otherwise, returns a generic error response.
 *
 * IMPORTANT: Always uses initiateAuth() to get a fresh OAuth URL with full
 * permissions (including write). Don't use the URL from the error because
 * it might only have scopes for the specific tool that failed.
 */
export async function handleToolError(error: unknown): Promise<unknown> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("[ASSA Auth] handleToolError called with:", errorMessage);

  // Check if it's an AuthRequiredError
  if (error instanceof AuthRequiredError) {
    console.error("[ASSA Auth] AuthRequiredError detected");
    console.error("[ASSA Auth] authUrl from error:", error.authUrl);
    console.error("[ASSA Auth] authId from error:", error.authId);

    // Clear cached auth state
    clearAuthCache();

    // ALWAYS initiate a fresh auth flow with full permissions (via X.PostTweet)
    // Don't use the URL from the error - it might only have read scopes
    console.error(
      "[ASSA Auth] Initiating fresh auth flow with full permissions"
    );
    return await createAuthResponse(
      "You need to connect your Twitter account first. Click the button below to authorize."
    );
  }

  // Check for other auth-related error messages
  if (
    errorMessage.includes("authorization_required") ||
    errorMessage.includes("tool_authorization_required") ||
    errorMessage.includes("403")
  ) {
    console.error("[ASSA Auth] Auth-related error message detected");
    clearAuthCache();
    return await createAuthResponse(
      "Your Twitter authorization has expired or needs additional permissions. Please re-authorize to continue."
    );
  }

  // Return generic error
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          error: true,
          message: errorMessage,
        }),
      },
    ],
    isError: true,
  };
}
