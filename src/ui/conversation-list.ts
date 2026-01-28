/**
 * ConversationList UI Component
 *
 * Displays a list of Twitter conversations (mentions) awaiting reply.
 * Each conversation can be dismissed or replied to.
 */

import { escapeHtml } from '../utils/html.js';
import { formatRelativeTime } from '../utils/time.js';

export interface ConversationItem {
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

interface ConversationListParams {
  conversations: ConversationItem[];
  username: string;
}

export function createConversationListUI(params: ConversationListParams): string {
  const { conversations, username } = params;
  const count = conversations.length;

  // Generate conversation cards HTML
  const cardsHtml = conversations
    .map((conv, index) => {
      const relativeTime = formatRelativeTime(conv.created_at);
      const avatarUrl =
        conv.author_avatar_url ||
        'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
      const truncatedText =
        conv.text.length > 200 ? conv.text.slice(0, 200) + '...' : conv.text;

      return `
      <div class="conversation-card" data-index="${index}">
        <div class="card-main">
          <img
            class="avatar"
            src="${escapeHtml(avatarUrl)}"
            alt="${escapeHtml(conv.author_display_name)}"
            onerror="this.src='https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'"
          />
          <div class="content">
            <div class="header">
              <span class="display-name">${escapeHtml(conv.author_display_name)}</span>
              <span class="handle">@${escapeHtml(conv.author_username)}</span>
              <span class="time">${escapeHtml(relativeTime)}</span>
            </div>
            <p class="text">${escapeHtml(truncatedText)}</p>
          </div>
        </div>
        <div class="reply-box">
          <textarea
            class="reply-input"
            id="reply-${escapeHtml(conv.tweet_id)}"
            placeholder="Write your reply..."
            maxlength="280"
          ></textarea>
          <div class="reply-actions">
            <button
              class="action-btn dismiss"
              onclick="dismissConversation('${escapeHtml(conv.tweet_id)}', ${conv.reply_count})"
            >
              Dismiss
            </button>
            <button
              class="action-btn reply"
              onclick="sendReply('${escapeHtml(conv.author_username)}', '${escapeHtml(conv.tweet_id)}')"
            >
              Reply
            </button>
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  const emptyStateHtml = `
    <div class="empty-state">
      <div class="empty-icon">✨</div>
      <h3>All caught up!</h3>
      <p>No conversations need your attention right now.</p>
    </div>
  `;

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
      background: transparent;
      padding: 16px;
    }

    .container {
      max-width: 600px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }

    .header h2 {
      font-size: 18px;
      font-weight: 600;
    }

    .header .badge {
      background: #3b82f6;
      color: white;
      font-size: 13px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 12px;
    }

    .header .badge.empty {
      background: #22c55e;
    }

    .conversation-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
      transition: all 0.2s ease;
    }

    .conversation-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: #cbd5e1;
    }

    .card-main {
      display: flex;
      gap: 12px;
    }

    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }

    .content {
      flex: 1;
      min-width: 0;
    }

    .content .header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      padding-bottom: 0;
      border-bottom: none;
    }

    .display-name {
      font-weight: 600;
      color: #0f172a;
      font-size: 14px;
    }

    .handle {
      color: #64748b;
      font-size: 13px;
    }

    .time {
      color: #94a3b8;
      font-size: 13px;
      margin-left: auto;
    }

    .text {
      color: #1e293b;
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 8px;
      word-wrap: break-word;
    }

    .reply-box {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;
    }

    .reply-input {
      width: 100%;
      min-height: 60px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
      margin-bottom: 8px;
    }

    .reply-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }

    .reply-input::placeholder {
      color: #94a3b8;
    }

    .reply-actions {
      display: flex;
      gap: 8px;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;
    }

    .action-btn {
      flex: 1;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .action-btn.dismiss {
      background: #f1f5f9;
      color: #64748b;
    }

    .action-btn.dismiss:hover {
      background: #e2e8f0;
      color: #475569;
    }

    .action-btn.reply {
      background: #3b82f6;
      color: white;
    }

    .action-btn.reply:hover {
      background: #2563eb;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px dashed #e2e8f0;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 8px;
    }

    .empty-state p {
      color: #64748b;
      font-size: 14px;
    }

    .refresh-btn {
      display: block;
      width: 100%;
      margin-top: 16px;
      padding: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .refresh-btn:hover {
      background: #f1f5f9;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="container" id="conversations-container">
    <div class="header">
      <h2>Your Conversations</h2>
      <span class="badge ${count === 0 ? 'empty' : ''}">${count === 0 ? 'All clear' : `${count} awaiting`}</span>
    </div>

    ${count === 0 ? emptyStateHtml : cardsHtml}

    <button class="refresh-btn" onclick="refreshConversations()">
      🔄 Refresh conversations
    </button>
  </div>

  <script>
    const username = ${JSON.stringify(username)};

    function dismissConversation(tweetId, replyCount) {
      // Use prompt since Goose doesn't support 'tool' action yet
      window.parent.postMessage({
        type: 'prompt',
        payload: {
          prompt: 'Dismiss tweet ' + tweetId + ' (reply_count: ' + replyCount + ')'
        }
      }, '*');
    }

    function sendReply(authorHandle, tweetId) {
      const textarea = document.getElementById('reply-' + tweetId);
      const replyText = textarea ? textarea.value.trim() : '';

      if (!replyText) {
        textarea.focus();
        textarea.style.borderColor = '#ef4444';
        setTimeout(() => { textarea.style.borderColor = ''; }, 2000);
        return;
      }

      // Use prompt since Goose doesn't support 'tool' action yet
      window.parent.postMessage({
        type: 'prompt',
        payload: {
          prompt: 'Draft reply to tweet ' + tweetId + ': ' + replyText
        }
      }, '*');
    }

    function refreshConversations() {
      window.parent.postMessage({
        type: 'prompt',
        payload: {
          prompt: 'Refresh my Twitter conversations using the twitter_conversations tool.'
        }
      }, '*');
    }

    // ResizeObserver for iframe height — observe the container, not body.
    // Body stretches to fill the iframe viewport, which prevents shrinking.
    const container = document.getElementById('conversations-container');
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        // Add body padding (16px top + 16px bottom)
        window.parent.postMessage({
          type: 'ui-size-change',
          payload: { height: entry.contentRect.height + 32 }
        }, '*');
      });
    });
    if (container) resizeObserver.observe(container);
  </script>
</body>
</html>
  `.trim();
}
