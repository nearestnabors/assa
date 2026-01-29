/**
 * Auth Button MCP App
 *
 * Receives auth URL from tool result and handles OAuth flow.
 * Uses App class for bidirectional communication with host.
 */

import { App } from '@modelcontextprotocol/ext-apps';
import { openExternalLink } from './lib/auth-handler.js';

interface AuthData {
  service: string;
  authUrl: string;
  state: string;
}

// Enable autoResize to let the SDK handle iframe height automatically
const app = new App({ name: 'ASSA Auth Button', version: '1.0.0' }, {}, { autoResize: true });

const loadingEl = document.getElementById('loading')!;
const connectBtn = document.getElementById('connectBtn')!;
const checkBtn = document.getElementById('checkBtn')!;
const statusText = document.getElementById('statusText')!;

let authData: AuthData | null = null;

// Handle tool result from server
app.ontoolresult = (result) => {
  loadingEl.classList.add('hidden');

  // Extract auth data from tool result
  const textContent = result.content?.find((c: { type: string }) => c.type === 'text');
  if (textContent && 'text' in textContent) {
    const text = textContent.text as string;

    // Check if already authenticated (plain text success message)
    if (text.includes('connected') || text.startsWith('✓')) {
      statusText.textContent = text;
      statusText.style.color = '#22c55e';
      // Hide buttons since already connected
      connectBtn.classList.add('hidden');
      checkBtn.classList.add('hidden');
      return;
    }

    // Try to parse as JSON auth data (needs OAuth)
    try {
      authData = JSON.parse(text) as AuthData;
      connectBtn.textContent = `Connect ${authData.service}`;
      connectBtn.classList.remove('hidden');
    } catch {
      statusText.textContent = 'Error: Invalid auth data';
    }
  }
};

// Step 1: User clicks Connect - open OAuth URL
connectBtn.addEventListener('click', async () => {
  if (!authData) return;

  try {
    await openExternalLink(app, authData.authUrl);

    // Show the "I've authorized" button
    connectBtn.classList.add('hidden');
    checkBtn.classList.remove('hidden');
    statusText.textContent = 'Complete authorization in the browser, then click above';
  } catch (error) {
    console.error('[Auth Button] Failed to open link:', error);
    statusText.textContent = 'Error opening auth link. Try again.';
  }
});

// Step 2: User confirms they authorized - call tool directly
checkBtn.addEventListener('click', async () => {
  (checkBtn as HTMLButtonElement).disabled = true;
  statusText.textContent = 'Checking authorization status...';

  try {
    // Call the auth status tool directly via MCP Apps
    const result = await app.callServerTool({
      name: 'x_auth_status',
      arguments: {},
    });

    // Check if auth succeeded
    const textContent = result.content?.find((c: { type: string }) => c.type === 'text');
    if (textContent && 'text' in textContent) {
      const text = textContent.text as string;
      if (text.includes('connected')) {
        statusText.textContent = 'Authorization successful! Ask me to show your conversations.';
        statusText.style.color = '#22c55e';
        checkBtn.textContent = 'Connected ✓';

        // Try to prompt the agent to load conversations
        // Use sendMessage to add a message to the conversation
        try {
          await app.sendMessage({
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Show my X conversations',
              },
            ],
          });
        } catch (msgError) {
          // sendMessage not supported by this host - that's ok
          // User can manually ask for conversations
          console.log('[Auth Button] sendMessage not supported:', msgError);
        }
      } else {
        statusText.textContent = 'Authorization not detected. Please try again.';
        (checkBtn as HTMLButtonElement).disabled = false;
      }
    }
  } catch (error) {
    statusText.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    (checkBtn as HTMLButtonElement).disabled = false;
  }
});

// Connect to host
app.connect();
