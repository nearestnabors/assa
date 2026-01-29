/**
 * Reusable Auth Polling Module
 *
 * Provides automatic OAuth polling for any MCP App component.
 *
 * Usage:
 *   const poller = createAuthPoller(app, {
 *     onAuthComplete: async () => {
 *       // Your action after auth succeeds
 *       const result = await app.callServerTool({ name: 'x_conversations', arguments: {} });
 *       renderConversations(result);
 *     },
 *     onStatusChange: (status) => {
 *       statusEl.textContent = status;
 *     }
 *   });
 *
 *   // When user clicks connect button:
 *   await poller.startAuth(authUrl);
 *
 *   // To check if already authed and run callback:
 *   await poller.checkAuthStatus();
 */

import type { App } from '@modelcontextprotocol/ext-apps';
import { openExternalLink } from './auth-handler.js';

export interface AuthPollerOptions {
  /** Called when auth completes successfully */
  onAuthComplete: () => Promise<void>;
  /** Called with status updates ("Waiting for authorization...", "Loading...", etc.) */
  onStatusChange?: (status: string) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
  /** Polling interval in ms (default: 2000) */
  pollInterval?: number;
  /** Auth status tool name (default: 'x_auth_status') */
  authStatusTool?: string;
}

export interface AuthPoller {
  /** Open OAuth URL and start polling for completion */
  startAuth: (authUrl: string) => Promise<void>;
  /** Check current auth status; if authed, calls onAuthComplete */
  checkAuthStatus: () => Promise<boolean>;
  /** Stop polling */
  stopPolling: () => void;
  /** Check if currently polling */
  isPolling: () => boolean;
}

export function createAuthPoller(app: App, options: AuthPollerOptions): AuthPoller {
  const {
    onAuthComplete,
    onStatusChange = () => {},
    onError = console.error,
    pollInterval = 2000,
    authStatusTool = 'x_auth_status',
  } = options;

  let intervalId: number | null = null;

  const stopPolling = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const isPolling = () => intervalId !== null;

  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      const result = await app.callServerTool({
        name: authStatusTool,
        arguments: {},
      });

      const textContent = result.content?.find((c: { type: string }) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        const text = textContent.text as string;
        if (text.includes('connected')) {
          stopPolling();
          onStatusChange('Loading...');
          await onAuthComplete();
          return true;
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
    return false;
  };

  const startPolling = () => {
    stopPolling(); // Clear any existing interval
    intervalId = window.setInterval(async () => {
      await checkAuthStatus();
    }, pollInterval);
  };

  const startAuth = async (authUrl: string): Promise<void> => {
    try {
      await openExternalLink(app, authUrl);
      onStatusChange('Waiting for authorization...');
      startPolling();
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };

  return {
    startAuth,
    checkAuthStatus,
    stopPolling,
    isPolling,
  };
}

/**
 * CSS for inline auth UI - can be injected into any component
 */
export const authPollerStyles = `
  .auth-poller-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
  }

  .auth-poller-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 8px;
    border: none;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #3b82f6;
    color: white;
  }

  .auth-poller-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .auth-poller-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .auth-poller-status {
    font-size: 14px;
    color: #6b7280;
    text-align: center;
  }

  .auth-poller-status.success {
    color: #22c55e;
  }

  .auth-poller-status.error {
    color: #ef4444;
  }
`;

/**
 * Render an inline auth UI that uses the polling pattern
 *
 * @param container - Element to render into
 * @param authData - Auth data from server ({ service, authUrl, state })
 * @param app - MCP App instance
 * @param onAuthComplete - Callback when auth succeeds
 */
export function renderAuthPollerUI(
  container: HTMLElement,
  authData: { service: string; authUrl: string; state: string },
  app: App,
  onAuthComplete: () => Promise<void>
): void {
  // Inject styles if not already present
  if (!document.getElementById('auth-poller-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'auth-poller-styles';
    styleEl.textContent = authPollerStyles;
    document.head.appendChild(styleEl);
  }

  container.innerHTML = `
    <div class="auth-poller-container">
      <button class="auth-poller-btn" id="authPollerBtn">
        Connect ${escapeHtml(authData.service)}
      </button>
      <p class="auth-poller-status" id="authPollerStatus"></p>
    </div>
  `;

  const btn = container.querySelector('#authPollerBtn') as HTMLButtonElement;
  const status = container.querySelector('#authPollerStatus') as HTMLElement;

  const poller = createAuthPoller(app, {
    onAuthComplete,
    onStatusChange: (msg) => {
      status.textContent = msg;
      status.className = 'auth-poller-status';
    },
    onError: (error) => {
      status.textContent = `Error: ${error.message}`;
      status.className = 'auth-poller-status error';
      btn.disabled = false;
      btn.textContent = `Connect ${authData.service}`;
    },
  });

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Opening...';
    await poller.startAuth(authData.authUrl);
    btn.classList.add('hidden');
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
