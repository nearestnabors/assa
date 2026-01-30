/**
 * Auth Button MCP App
 *
 * Handles OAuth flow with automatic polling for auth completion.
 * After auth succeeds, automatically fetches and displays conversations.
 */

import { App } from '@modelcontextprotocol/ext-apps';
import { createAuthPoller } from './lib/auth-poller.js';

interface AuthData {
  service: string;
  authUrl: string;
  state: string;
}

interface ConversationItem {
  tweet_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url?: string;
  text: string;
  created_at: string;
  reply_count: number;
}

interface ConversationsData {
  conversations: ConversationItem[];
  username: string;
}

const app = new App({ name: 'ASSA Auth Button', version: '1.0.0' }, {}, { autoResize: true });

// Auth elements
const authContainer = document.getElementById('authContainer')!;
const loadingEl = document.getElementById('loading')!;
const connectBtn = document.getElementById('connectBtn')!;
const statusText = document.getElementById('statusText')!;

// Conversation elements
const conversationsContainer = document.getElementById('conversationsContainer')!;
const badgeEl = document.getElementById('badge')!;
const conversationsListEl = document.getElementById('conversationsList')!;
const refreshBtn = document.getElementById('refreshBtn')!;

let authData: AuthData | null = null;

// Create auth poller with callback to load conversations
const authPoller = createAuthPoller(app, {
  onAuthComplete: async () => {
    const convResult = await app.callServerTool({
      name: 'x_conversations',
      arguments: {},
    });

    const convTextContent = convResult.content?.find((c: { type: string }) => c.type === 'text');
    if (convTextContent && 'text' in convTextContent) {
      const data = JSON.parse(convTextContent.text as string) as ConversationsData;
      authContainer.classList.add('hidden');
      conversationsContainer.classList.remove('hidden');
      renderConversations(data);
    }
  },
  onStatusChange: (status) => {
    statusText.textContent = status;
  },
  onError: (error) => {
    statusText.textContent = `Error: ${error.message}`;
    connectBtn.classList.remove('hidden');
  },
});

// === Utility functions ===

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

// === Conversation rendering (identical to conversation-list.ts) ===

function renderConversations(data: ConversationsData): void {
  const count = data.conversations.length;
  badgeEl.textContent = count === 0 ? 'All clear' : `${count} awaiting`;
  badgeEl.className = count === 0 ? 'badge empty' : 'badge';

  if (count === 0) {
    conversationsListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✨</div>
        <h3>All caught up!</h3>
        <p>No conversations need your attention right now.</p>
      </div>
    `;
    return;
  }

  conversationsListEl.innerHTML = data.conversations
    .map((conv) => {
      const relativeTime = formatRelativeTime(conv.created_at);
      const initials = getInitials(conv.author_display_name || conv.author_username || '?');
      // Use data-src for deferred loading (CSP race condition workaround)
      const hasAvatarUrl = !!conv.author_avatar_url;
      const avatarHtml = hasAvatarUrl
        ? `<img class="avatar" data-src="${escapeHtml(conv.author_avatar_url!)}" alt="${escapeHtml(conv.author_display_name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="avatar-placeholder">${escapeHtml(initials)}</div>`
        : `<div class="avatar-placeholder">${escapeHtml(initials)}</div>`;

      return `
        <div class="conversation-card" data-tweet-id="${escapeHtml(conv.tweet_id)}" data-reply-count="${conv.reply_count}">
          <div class="card-main">
            ${avatarHtml}
            <div class="content">
              <div class="header">
                <span class="display-name">${escapeHtml(conv.author_display_name)}</span>
                <span class="handle">@${escapeHtml(conv.author_username)}</span>
                <span class="time">${escapeHtml(relativeTime)}</span>
              </div>
              <p class="text">${escapeHtml(conv.text)}</p>
            </div>
          </div>
          <div class="reply-box">
            <textarea class="reply-input" placeholder="Write your reply..." maxlength="280"></textarea>
            <div class="reply-actions">
              <button class="action-btn dismiss" data-action="dismiss">Dismiss</button>
              <button class="action-btn reply" data-action="reply" data-author="${escapeHtml(conv.author_username)}">Reply</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  attachConversationListeners();

  // Defer image loading to allow CSP to be applied (race condition workaround)
  setTimeout(() => {
    document.querySelectorAll('img[data-src]').forEach((img) => {
      const src = img.getAttribute('data-src');
      if (src) {
        (img as HTMLImageElement).src = src;
        img.addEventListener('load', () => {
          const placeholder = img.nextElementSibling as HTMLElement;
          if (placeholder?.classList.contains('avatar-placeholder')) {
            placeholder.style.display = 'none';
          }
        });
      }
    });
  }, 100);
}

function attachConversationListeners(): void {
  // Dismiss buttons
  document.querySelectorAll('[data-action="dismiss"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const card = (e.target as HTMLElement).closest('.conversation-card') as HTMLElement;
      const tweetId = card.dataset.tweetId;
      const replyCount = parseInt(card.dataset.replyCount || '0', 10);

      (btn as HTMLButtonElement).disabled = true;
      btn.textContent = 'Dismissing...';

      try {
        await app.callServerTool({
          name: 'x_dismiss_conversation',
          arguments: { tweet_id: tweetId, reply_count: replyCount },
        });
        card.style.opacity = '0.5';
        setTimeout(() => card.remove(), 300);

        const remaining = document.querySelectorAll('.conversation-card').length - 1;
        badgeEl.textContent = remaining === 0 ? 'All clear' : `${remaining} awaiting`;
        badgeEl.className = remaining === 0 ? 'badge empty' : 'badge';
      } catch (error) {
        btn.textContent = 'Dismiss';
        (btn as HTMLButtonElement).disabled = false;
      }
    });
  });

  // Reply buttons
  document.querySelectorAll('[data-action="reply"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const card = (e.target as HTMLElement).closest('.conversation-card') as HTMLElement;
      const tweetId = card.dataset.tweetId;
      const replyCount = parseInt(card.dataset.replyCount || '0', 10);
      const textarea = card.querySelector('.reply-input') as HTMLTextAreaElement;
      const replyText = textarea?.value.trim();

      if (!replyText) {
        textarea.focus();
        textarea.style.borderColor = '#ef4444';
        setTimeout(() => { textarea.style.borderColor = ''; }, 2000);
        return;
      }

      (btn as HTMLButtonElement).disabled = true;
      btn.textContent = 'Posting...';

      try {
        const result = await app.callServerTool({
          name: 'x_post_tweet',
          arguments: { text: replyText, reply_to_id: tweetId },
        });

        const textContent = result.content?.find((c: { type: string }) => c.type === 'text');
        if (textContent && 'text' in textContent) {
          const data = JSON.parse(textContent.text as string);
          if (data.success) {
            const replyBox = card.querySelector('.reply-box') as HTMLElement;
            replyBox.innerHTML = `
              <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px;">
                <div style="color: #16a34a; font-weight: 600; font-size: 14px;">✓ Reply posted</div>
              </div>
            `;

            setTimeout(async () => {
              try {
                await app.callServerTool({
                  name: 'x_dismiss_conversation',
                  arguments: { tweet_id: tweetId, reply_count: replyCount + 1 },
                });
                card.style.opacity = '0.5';
                setTimeout(() => card.remove(), 500);

                const remaining = document.querySelectorAll('.conversation-card').length - 1;
                badgeEl.textContent = remaining === 0 ? 'All clear' : `${remaining} awaiting`;
                badgeEl.className = remaining === 0 ? 'badge empty' : 'badge';
              } catch { /* ignore */ }
            }, 2000);
          }
        }
      } catch (error) {
        btn.textContent = 'Error - try again';
        (btn as HTMLButtonElement).disabled = false;
      }
    });
  });
}


// === Event handlers ===

app.ontoolresult = (result) => {
  loadingEl.classList.add('hidden');

  const textContent = result.content?.find((c: { type: string }) => c.type === 'text');
  if (textContent && 'text' in textContent) {
    const text = textContent.text as string;

    // Already authenticated - just show status (don't auto-load conversations)
    // Auto-load only happens after OAuth flow completes via authPoller
    if (text.includes('connected') || text.startsWith('✓')) {
      statusText.textContent = text;
      statusText.style.color = '#22c55e';
      return;
    }

    // Need OAuth
    try {
      authData = JSON.parse(text) as AuthData;
      connectBtn.textContent = `Connect ${authData.service}`;
      connectBtn.classList.remove('hidden');
    } catch {
      statusText.textContent = 'Error: Invalid auth data';
    }
  }
};

connectBtn.addEventListener('click', async () => {
  if (!authData) return;

  try {
    connectBtn.classList.add('hidden');
    await authPoller.startAuth(authData.authUrl);
  } catch (error) {
    console.error('[Auth] Failed to start auth:', error);
    connectBtn.classList.remove('hidden');
  }
});

refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing...';

  try {
    const result = await app.callServerTool({
      name: 'x_conversations',
      arguments: {},
    });

    const textContent = result.content?.find((c: { type: string }) => c.type === 'text');
    if (textContent && 'text' in textContent) {
      const data = JSON.parse(textContent.text as string) as ConversationsData;
      renderConversations(data);
    }
  } catch (error) {
    console.error('[Auth] Refresh failed:', error);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh conversations';
  }
});

app.connect();
