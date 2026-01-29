/**
 * Auth Button MCP App
 *
 * Receives auth URL from tool result and handles OAuth flow.
 * After successful auth, fetches and displays conversations inline.
 */

import { App } from '@modelcontextprotocol/ext-apps';
import { openExternalLink } from './lib/auth-handler.js';

interface AuthData {
  service: string;
  authUrl: string;
  state: string;
}

interface ConversationItem {
  tweet_id: string;
  author_username: string;
  author_display_name: string;
  text: string;
  created_at: string;
}

interface ConversationsData {
  conversations: ConversationItem[];
  username: string;
}

// Enable autoResize to let the SDK handle iframe height automatically
const app = new App({ name: 'ASSA Auth Button', version: '1.0.0' }, {}, { autoResize: true });

const loadingEl = document.getElementById('loading')!;
const connectBtn = document.getElementById('connectBtn')!;
const checkBtn = document.getElementById('checkBtn')!;
const statusText = document.getElementById('statusText')!;
const conversationsContainer = document.getElementById('conversationsContainer')!;

let authData: AuthData | null = null;

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function renderConversations(data: ConversationsData): void {
  const count = data.conversations.length;

  if (count === 0) {
    conversationsContainer.innerHTML = `
      <div class="conversations-header">
        <h3>Conversations</h3>
        <span class="badge empty">All clear</span>
      </div>
      <div class="empty-state">
        <div class="empty-icon">✨</div>
        <p>No conversations need your attention</p>
      </div>
    `;
  } else {
    const cardsHtml = data.conversations.slice(0, 5).map((conv) => {
      const initials = getInitials(conv.author_display_name || conv.author_username || '?');
      const time = formatRelativeTime(conv.created_at);
      return `
        <div class="conversation-card">
          <div class="card-header">
            <div class="avatar-placeholder">${escapeHtml(initials)}</div>
            <div class="author-info">
              <span class="display-name">${escapeHtml(conv.author_display_name)}</span>
              <span class="handle">@${escapeHtml(conv.author_username)}</span>
            </div>
            <span class="time">${escapeHtml(time)}</span>
          </div>
          <p class="tweet-text">${escapeHtml(conv.text.slice(0, 140))}${conv.text.length > 140 ? '...' : ''}</p>
        </div>
      `;
    }).join('');

    const moreText = count > 5 ? `<p style="text-align: center; color: #6b7280; font-size: 12px;">+ ${count - 5} more</p>` : '';

    conversationsContainer.innerHTML = `
      <div class="conversations-header">
        <h3>Conversations</h3>
        <span class="badge">${count} awaiting</span>
      </div>
      ${cardsHtml}
      ${moreText}
    `;
  }

  conversationsContainer.classList.remove('hidden');
}

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
  statusText.textContent = 'Checking authorization...';

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
        // Hide auth UI elements
        checkBtn.classList.add('hidden');
        statusText.textContent = 'Loading conversations...';

        // Fetch conversations directly
        try {
          const convResult = await app.callServerTool({
            name: 'x_conversations',
            arguments: {},
          });

          const convTextContent = convResult.content?.find((c: { type: string }) => c.type === 'text');
          if (convTextContent && 'text' in convTextContent) {
            const data = JSON.parse(convTextContent.text as string) as ConversationsData;
            statusText.classList.add('hidden');
            renderConversations(data);
          }
        } catch (convError) {
          console.error('[Auth Button] Failed to load conversations:', convError);
          statusText.textContent = 'Connected! Ask me to show your conversations.';
          statusText.style.color = '#22c55e';
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
