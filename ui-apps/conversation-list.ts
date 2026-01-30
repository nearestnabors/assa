/**
 * Conversation List MCP App
 *
 * Displays X mentions awaiting reply.
 * Supports dismiss and reply actions via direct tool calls.
 */

import { App } from '@modelcontextprotocol/ext-apps';
import {
  isAuthRequired,
  parseToolResult,
  renderAuthRequired,
  authStyles,
  openExternalLink,
} from './lib/auth-handler.js';

// Inject auth styles
const styleEl = document.createElement('style');
styleEl.textContent = authStyles;
document.head.appendChild(styleEl);

interface ConversationItem {
  tweet_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url?: string;
  text: string;
  created_at: string;
  reply_count: number;
  like_count: number;
  retweet_count: number;
}

interface ConversationsData {
  conversations: ConversationItem[];
  username: string;
  totalCount: number;
  hasMore: boolean;
}

// Enable autoResize to let the SDK handle iframe height automatically
const app = new App({ name: 'ASSA Conversations', version: '1.0.0' }, {}, { autoResize: true });

// DOM elements
const loadingEl = document.getElementById('loading')!;
const contentEl = document.getElementById('content')!;
const conversationsListEl = document.getElementById('conversationsList')!;
const loadMoreBtn = document.getElementById('loadMoreBtn') as HTMLButtonElement;

let currentData: ConversationsData | null = null;
let currentOffset = 0;
const PAGE_SIZE = 10;

// Height is now managed automatically by the MCP Apps SDK (autoResize: true)

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

function updateLoadMoreButton(data: ConversationsData): void {
  const displayedCount = document.querySelectorAll('.conversation-card').length;

  if (displayedCount === 0) {
    // Show button only when empty - lets user check for new mentions
    loadMoreBtn.textContent = 'Check for new mentions';
    loadMoreBtn.classList.add('all-clear');
    loadMoreBtn.classList.remove('hidden');
  } else if (data.hasMore) {
    // Show load more button when there are more items
    const remaining = data.totalCount - displayedCount;
    loadMoreBtn.textContent = `Load more (${remaining} remaining)`;
    loadMoreBtn.classList.remove('all-clear', 'hidden');
  } else {
    // Hide button when all loaded
    loadMoreBtn.classList.add('hidden');
  }
}

function renderConversations(data: ConversationsData, append = false): void {
  currentData = data;
  loadingEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  // Reset offset if not appending
  if (!append) {
    currentOffset = data.conversations.length;
  }

  // Check for empty state using totalCount (0 total means nothing to show)
  if (data.totalCount === 0) {
    conversationsListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✨</div>
        <h3>All caught up!</h3>
        <p>No conversations need your attention right now.</p>
      </div>
    `;
    updateLoadMoreButton(data);
    return;
  }

  // Helper to get initials from display name
  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  const cardsHtml = data.conversations
    .map((conv) => {
      const relativeTime = formatRelativeTime(conv.created_at);
      const initials = getInitials(conv.author_display_name || conv.author_username || '?');

      // Use avatar URL if available - use data-src for deferred loading (CSP race condition workaround)
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
            <textarea
              class="reply-input"
              placeholder="Write your reply..."
              maxlength="280"
            ></textarea>
            <div class="reply-actions">
              <button class="action-btn dismiss" data-action="dismiss">
                Dismiss
              </button>
              <button class="action-btn reply" data-action="reply" data-author="${escapeHtml(conv.author_username)}">
                Reply
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  if (append) {
    // Append new cards to existing list
    conversationsListEl.insertAdjacentHTML('beforeend', cardsHtml);
    currentOffset += data.conversations.length;
  } else {
    // Replace entire list
    conversationsListEl.innerHTML = cardsHtml;
  }

  // Attach event listeners to action buttons
  attachEventListeners();

  // Defer image loading to allow CSP to be applied by host
  // Extended delay to give MCP Apps SDK time to set up resourceDomains CSP
  setTimeout(() => {
    document.querySelectorAll('img[data-src]').forEach((img) => {
      const src = img.getAttribute('data-src');
      if (src) {
        (img as HTMLImageElement).src = src;
        // Hide placeholder when image loads
        img.addEventListener('load', () => {
          const placeholder = img.nextElementSibling as HTMLElement;
          if (placeholder?.classList.contains('avatar-placeholder')) {
            placeholder.style.display = 'none';
          }
        });
      }
    });
  }, 500);

  // Update load more button state
  updateLoadMoreButton(data);
}

function attachEventListeners(): void {
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
          arguments: {
            tweet_id: tweetId,
            reply_count: replyCount,
          },
        });

        // Remove card from UI
        card.style.opacity = '0.5';
        setTimeout(() => card.remove(), 300);

        // Update button state based on remaining items
        const remaining = document.querySelectorAll('.conversation-card').length - 1;
        if (currentData) {
          // Update the data to reflect the removal
          currentData.totalCount = Math.max(0, currentData.totalCount - 1);
          currentData.hasMore = currentOffset < currentData.totalCount;
          updateLoadMoreButton(currentData);
        }
      } catch (error) {
        btn.textContent = 'Dismiss';
        (btn as HTMLButtonElement).disabled = false;
        console.error('Failed to dismiss:', error);
      }
    });
  });

  // Reply buttons - post directly and show inline confirmation
  document.querySelectorAll('[data-action="reply"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      console.log('[ASSA] Reply button clicked');
      const card = (e.target as HTMLElement).closest('.conversation-card') as HTMLElement;
      const tweetId = card.dataset.tweetId;
      const replyCount = parseInt(card.dataset.replyCount || '0', 10);
      const textarea = card.querySelector('.reply-input') as HTMLTextAreaElement;
      const replyText = textarea?.value.trim();

      console.log('[ASSA] Reply data:', { tweetId, replyCount, replyText });

      if (!replyText) {
        console.log('[ASSA] No reply text, focusing textarea');
        textarea.focus();
        textarea.style.borderColor = '#ef4444';
        setTimeout(() => {
          textarea.style.borderColor = '';
        }, 2000);
        return;
      }

      (btn as HTMLButtonElement).disabled = true;
      btn.textContent = 'Posting...';

      try {
        console.log('[ASSA] Calling x_post_tweet...');
        // Post the reply directly
        const result = await app.callServerTool({
          name: 'x_post_tweet',
          arguments: {
            text: replyText,
            reply_to_id: tweetId,
          },
        });

        console.log('[ASSA] Result:', result);

        // Parse the result using the auth handler utility
        const parsed = parseToolResult(result);
        if (!parsed) {
          console.error('[ASSA] Failed to parse tool result');
          btn.textContent = 'Error - try again';
          (btn as HTMLButtonElement).disabled = false;
          return;
        }

        const { data } = parsed;

        // Check if auth is required
        if (isAuthRequired(data)) {
          console.log('[ASSA] Auth required, showing auth UI');
          btn.textContent = 'Auth required';
          const replyBox = card.querySelector('.reply-box') as HTMLElement;
          renderAuthRequired(replyBox, data, app);
          return;
        }

        // Check for other errors
        if (parsed.isError || (data && typeof data === 'object' && 'error' in data)) {
          console.error('[ASSA] Tool error:', data);
          btn.textContent = 'Error - try again';
          (btn as HTMLButtonElement).disabled = false;
          return;
        }

        // Handle successful post
        const successData = data as { success?: boolean; url?: string };
        if (successData.success) {
            // Show inline reply confirmation
            const replyBox = card.querySelector('.reply-box') as HTMLElement;
            const tweetUrl = successData.url || '';
            const hasValidUrl = tweetUrl && !tweetUrl.includes('/unknown');

            replyBox.innerHTML = `
              <div class="reply-sent">
                <div class="reply-sent-header">✓ Reply posted</div>
                <p class="reply-sent-text">${escapeHtml(replyText)}</p>
                ${hasValidUrl ? `<button class="reply-sent-link" data-url="${escapeHtml(tweetUrl)}">View on X →</button>` : ''}
              </div>
            `;

            // Handle the "View on X" button click via openExternalLink helper
            const viewBtn = replyBox.querySelector('.reply-sent-link') as HTMLButtonElement;
            console.log('[ASSA] View button found:', !!viewBtn, 'URL:', viewBtn?.dataset?.url);
            if (viewBtn) {
              viewBtn.addEventListener('click', async () => {
                const url = viewBtn.dataset.url;
                console.log('[ASSA] View button clicked, URL:', url);
                if (url) {
                  try {
                    await openExternalLink(app, url);
                    console.log('[ASSA] openExternalLink completed');
                  } catch (err) {
                    console.error('[ASSA] openExternalLink failed:', err);
                  }
                }
              });
            }

            // Auto-dismiss after a delay
            setTimeout(async () => {
              try {
                await app.callServerTool({
                  name: 'x_dismiss_conversation',
                  arguments: {
                    tweet_id: tweetId,
                    reply_count: replyCount + 1, // Increment so it stays dismissed
                  },
                });
                card.style.opacity = '0.5';
                setTimeout(() => card.remove(), 500);

                // Update button state based on remaining items
                if (currentData) {
                  currentData.totalCount = Math.max(0, currentData.totalCount - 1);
                  currentData.hasMore = currentOffset < currentData.totalCount;
                  updateLoadMoreButton(currentData);
                }
              } catch {
                // Ignore dismiss errors
              }
            }, 3000);
        }
      } catch (error) {
        console.error('[ASSA] Failed to post reply:', error);
        btn.textContent = 'Error - try again';
        (btn as HTMLButtonElement).disabled = false;
      }
    });
  });
}

// Handle tool result from server (may be brief message, data comes from x_get_conversations)
app.ontoolresult = async () => {
  // Fetch actual data using the app-only tool
  try {
    const result = await app.callServerTool({
      name: 'x_get_conversations',
      arguments: {},
    });
    const textContent = result.content?.find((c: { type: string }) => c.type === 'text');
    if (textContent && 'text' in textContent) {
      const data = JSON.parse(textContent.text as string) as ConversationsData & { error?: boolean; message?: string };

      // Check for error response
      if (data.error) {
        loadingEl.textContent = data.message || 'Please authenticate first';
        return;
      }

      renderConversations(data);
    }
  } catch (error) {
    console.error('[ASSA] Failed to fetch conversations:', error);
    loadingEl.textContent = 'Error loading conversations';
  }
};

// Load more button - either refreshes when empty or loads next page
loadMoreBtn.addEventListener('click', async () => {
  const isLoadingMore = currentOffset > 0 && currentData?.hasMore;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = isLoadingMore ? 'Loading...' : 'Checking...';

  try {
    const result = await app.callServerTool({
      name: 'x_get_conversations',
      arguments: isLoadingMore ? { limit: PAGE_SIZE, offset: currentOffset } : {},
    });

    const textContent = result.content?.find((c: { type: string }) => c.type === 'text');
    if (textContent && 'text' in textContent) {
      const data = JSON.parse(textContent.text as string) as ConversationsData;
      if (isLoadingMore) {
        // Append new conversations
        renderConversations(data, true);
      } else {
        // Fresh load
        renderConversations(data, false);
      }
    }
  } catch (error) {
    console.error('[ASSA] Failed to load conversations:', error);
    loadMoreBtn.textContent = currentOffset > 0 ? 'Error - try again' : 'Check for new mentions';
  } finally {
    loadMoreBtn.disabled = false;
  }
});

// Connect to host
app.connect();
