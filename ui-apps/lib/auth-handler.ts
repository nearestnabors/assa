/**
 * Client-side auth handler for MCP Apps UI components
 *
 * Provides utilities to:
 * 1. Check if a tool result requires auth
 * 2. Render an inline auth UI
 * 3. Handle the re-auth flow
 * 4. Open external links safely via MCP Apps API
 */

import type { App } from "@modelcontextprotocol/ext-apps";

/**
 * Open an external URL using the MCP Apps API.
 * This is the correct way to open links from sandboxed iframes.
 *
 * Usage: await openExternalLink(app, 'https://example.com')
 */
export async function openExternalLink(app: App, url: string): Promise<void> {
  if (!url || typeof url !== "string") {
    console.error("[MCP Apps] Invalid URL provided to openExternalLink:", url);
    return;
  }
  try {
    // MCP Apps SDK expects { url: string } object, NOT just a string
    await app.openLink({ url });
  } catch (error) {
    console.error("[MCP Apps] Failed to open external link:", error);
    throw error;
  }
}

/**
 * Auth required response from server
 */
export interface AuthRequiredResponse {
  authRequired: true;
  service: string;
  authUrl: string;
  state: string;
  message: string;
}

/**
 * Check if a parsed result indicates auth is required
 */
export function isAuthRequired(data: unknown): data is AuthRequiredResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "authRequired" in data &&
    (data as AuthRequiredResponse).authRequired === true
  );
}

/**
 * Parse a tool result and check for auth requirement
 * Returns the parsed data or null if parsing fails
 */
export function parseToolResult(result: {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}): { data: unknown; isError: boolean } | null {
  const textContent = result.content?.find((c) => c.type === "text");
  if (!(textContent && "text" in textContent)) {
    return null;
  }

  try {
    const data = JSON.parse(textContent.text as string);
    return { data, isError: result.isError };
  } catch {
    // Not JSON, might be a plain error message
    return {
      data: { error: true, message: textContent.text },
      isError: true,
    };
  }
}

/**
 * Render an inline auth button that triggers re-authentication
 * Preserves original content and restores it after successful auth
 */
export function renderAuthRequired(
  container: HTMLElement,
  authData: AuthRequiredResponse,
  app: App
): void {
  console.log(
    "[Auth Handler] Rendering auth UI with data:",
    JSON.stringify(authData, null, 2)
  );
  console.log(
    "[Auth Handler] authUrl value:",
    authData.authUrl,
    "type:",
    typeof authData.authUrl
  );

  // Save original content to restore after auth
  const originalContent = container.innerHTML;

  // Validate authUrl
  if (!authData.authUrl) {
    console.error("[Auth Handler] No authUrl in auth data");
    container.innerHTML = `
      <div class="auth-required">
        <p class="auth-message">Authentication required but failed to get auth URL. Please try again.</p>
      </div>
    ${originalContent}`;
    return;
  }

  // Show auth UI above original content (hidden during auth)
  container.innerHTML = `
    <div class="auth-required">
      <p class="auth-message">${escapeHtml(authData.message)}</p>
      <button class="auth-btn" id="authBtn">
        Connect ${escapeHtml(authData.service)}
      </button>
      <button class="auth-btn auth-btn-secondary hidden" id="authCheckBtn">
        I've completed authorization
      </button>
    </div>
    <div class="original-content hidden">${originalContent}</div>
  `;

  const authBtn = container.querySelector("#authBtn") as HTMLButtonElement;
  const authCheckBtn = container.querySelector(
    "#authCheckBtn"
  ) as HTMLButtonElement;
  const _originalContentEl = container.querySelector(
    ".original-content"
  ) as HTMLElement;

  // Step 1: Open OAuth URL
  authBtn.addEventListener("click", async () => {
    console.log("[Auth Handler] Opening OAuth URL:", authData.authUrl);
    console.log("[Auth Handler] Full authData:", JSON.stringify(authData));

    // Defensive check - make sure we have a valid URL
    if (
      !authData.authUrl ||
      typeof authData.authUrl !== "string" ||
      authData.authUrl.trim() === ""
    ) {
      console.error("[Auth Handler] Invalid authUrl:", authData.authUrl);
      authBtn.textContent = "Error - no auth URL";
      return;
    }

    try {
      await openExternalLink(app, authData.authUrl);
      authBtn.classList.add("hidden");
      authCheckBtn.classList.remove("hidden");
    } catch (error) {
      console.error("[Auth Handler] Failed to open link:", error);
      authBtn.textContent = "Error - try again";
    }
  });

  // Step 2: Check auth status
  authCheckBtn.addEventListener("click", async () => {
    authCheckBtn.disabled = true;
    authCheckBtn.textContent = "Checking...";

    try {
      const result = await app.callServerTool({
        name: "x_auth_status",
        arguments: {},
      });

      const parsed = parseToolResult(result);
      if (parsed && !isAuthRequired(parsed.data)) {
        // Auth successful - show success banner and restore original content
        container.innerHTML = `
          <div class="auth-success">
            <p>✓ Authorization successful! You can now retry your action.</p>
          </div>
        ${originalContent}`;

        // Re-enable any buttons that might have been disabled
        const replyBtn = container.querySelector(
          '[data-action="reply"]'
        ) as HTMLButtonElement;
        if (replyBtn) {
          replyBtn.disabled = false;
          replyBtn.textContent = "Reply";
        }
      } else {
        // Still not authorized
        authCheckBtn.textContent = "Not detected - try again";
        authCheckBtn.disabled = false;
      }
    } catch (_error) {
      authCheckBtn.textContent = "Error - try again";
      authCheckBtn.disabled = false;
    }
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * CSS styles for auth UI - inject into document
 */
export const authStyles = `
  .auth-required {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }

  .auth-message {
    color: #92400e;
    font-size: 14px;
    margin-bottom: 12px;
  }

  .auth-btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
  }

  .auth-btn:not(.auth-btn-secondary) {
    background: #3b82f6;
    color: white;
  }

  .auth-btn:not(.auth-btn-secondary):hover {
    background: #2563eb;
  }

  .auth-btn-secondary {
    background: #22c55e;
    color: white;
  }

  .auth-btn-secondary:hover {
    background: #16a34a;
  }

  .auth-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .auth-success {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
    color: #166534;
    font-size: 14px;
  }

  .hidden {
    display: none !important;
  }
`;
