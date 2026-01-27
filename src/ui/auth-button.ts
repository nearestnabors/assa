/**
 * AuthButton UI Component
 *
 * Renders a button that:
 * 1. Opens OAuth URL when clicked
 * 2. Shows "I've completed authorization" button
 * 3. Fires 'tool' action to check auth status (server-side)
 */

import { escapeHtml } from '../utils/html.js';

interface AuthButtonParams {
  service: string;      // "Twitter"
  authUrl: string;      // OAuth URL from Arcade
  state: string;        // State param for status check
}

export function createAuthButtonUI(params: AuthButtonParams): string {
  const { service, authUrl } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      background: transparent;
    }

    .auth-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .btn {
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
    }

    .btn-connect {
      background: #3b82f6;
      color: white;
    }

    .btn-connect:hover {
      background: #2563eb;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    .btn-check {
      background: #22c55e;
      color: white;
    }

    .btn-check:hover {
      background: #16a34a;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
    }

    .btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    .status-text {
      font-size: 14px;
      color: #6b7280;
    }

    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="auth-container">
    <!-- Step 1: Connect button -->
    <button id="connectBtn" class="btn btn-connect" data-auth-url='${authUrl}'>
      <span>🔗</span>
      <span>Connect ${escapeHtml(service)}</span>
    </button>

    <!-- Step 2: After clicking, show "I've authorized" button -->
    <button id="checkBtn" class="btn btn-check hidden">
      <span>✓</span>
      <span>I've completed authorization</span>
    </button>

    <p id="statusText" class="status-text"></p>
  </div>

  <script>
    const connectBtn = document.getElementById('connectBtn');
    const checkBtn = document.getElementById('checkBtn');
    const statusText = document.getElementById('statusText');

    // Get URL from data attribute to avoid any JS escaping issues
    const authUrl = connectBtn.dataset.authUrl;

    // Step 1: User clicks Connect - open OAuth URL
    connectBtn.addEventListener('click', () => {
      // Open OAuth URL in new window/tab
      window.parent.postMessage({
        type: 'link',
        payload: { url: authUrl }
      }, '*');

      // Show the "I've authorized" button
      connectBtn.classList.add('hidden');
      checkBtn.classList.remove('hidden');
      statusText.textContent = 'Complete authorization in the browser, then click above';
    });

    // Step 2: User confirms they authorized - use prompt to trigger status check
    checkBtn.addEventListener('click', () => {
      // Use 'prompt' action (supported by Goose) to ask agent to check auth
      window.parent.postMessage({
        type: 'prompt',
        payload: {
          prompt: 'Check my Twitter authorization status now.'
        }
      }, '*');

      checkBtn.disabled = true;
      statusText.textContent = 'Checking authorization status...';
    });

    // ResizeObserver for iframe height
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        window.parent.postMessage({
          type: 'ui-size-change',
          payload: { height: entry.contentRect.height + 32 }
        }, '*');
      });
    });
    resizeObserver.observe(document.body);
  </script>
</body>
</html>
  `.trim();
}
