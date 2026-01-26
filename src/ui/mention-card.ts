/**
 * MentionCard UI Component
 * 
 * Displays a single Twitter mention with avatar, text, and engagement metrics.
 */

import { escapeHtml } from '../utils/html.js';
import { formatRelativeTime } from '../utils/time.js';

export interface Mention {
  id: string;
  author: {
    handle: string;
    displayName: string;
    avatarUrl: string;
  };
  text: string;
  timestamp: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  url: string;
}

export function createMentionCardUI(mention: Mention): string {
  const relativeTime = formatRelativeTime(mention.timestamp);
  
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
      padding: 12px;
      background: transparent;
    }
    
    .card {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: all 0.2s ease;
      cursor: pointer;
    }
    
    .card:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      transform: translateY(-2px);
    }
    
    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    
    .content {
      flex: 1;
      min-width: 0;
    }
    
    .header {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
    }
    
    .display-name {
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .handle {
      color: #64748b;
      font-size: 14px;
      white-space: nowrap;
    }
    
    .text {
      color: #1e293b;
      line-height: 1.5;
      margin-bottom: 8px;
      word-wrap: break-word;
    }
    
    .meta {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 13px;
      color: #64748b;
    }
    
    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    
    .action-btn {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .action-btn:hover {
      background: #e2e8f0;
    }
    
    .action-btn.primary {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }
    
    .action-btn.primary:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="card" onclick="openTweet()">
    <img 
      class="avatar" 
      src="${escapeHtml(mention.author.avatarUrl)}" 
      alt="${escapeHtml(mention.author.displayName)}"
      onerror="this.src='https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'"
    />
    <div class="content">
      <div class="header">
        <span class="display-name">${escapeHtml(mention.author.displayName)}</span>
        <span class="handle">@${escapeHtml(mention.author.handle)}</span>
      </div>
      <p class="text">${escapeHtml(mention.text)}</p>
      <div class="meta">
        <span class="meta-item">🕐 ${escapeHtml(relativeTime)}</span>
        <span class="meta-item">❤️ ${mention.metrics.likes}</span>
        <span class="meta-item">🔁 ${mention.metrics.retweets}</span>
        <span class="meta-item">💬 ${mention.metrics.replies}</span>
      </div>
      <div class="actions" onclick="event.stopPropagation()">
        <button class="action-btn primary" onclick="replyToTweet()">Reply</button>
        <button class="action-btn" onclick="openTweet()">View</button>
      </div>
    </div>
  </div>
  
  <script>
    const tweetUrl = ${JSON.stringify(mention.url)};
    const authorHandle = ${JSON.stringify(mention.author.handle)};
    const tweetText = ${JSON.stringify(mention.text)};
    
    function openTweet() {
      window.parent.postMessage({
        type: 'link',
        payload: { url: tweetUrl }
      }, '*');
    }
    
    function replyToTweet() {
      window.parent.postMessage({
        type: 'prompt',
        payload: {
          prompt: 'Draft a reply to @' + authorHandle + '\\'s tweet: "' + tweetText.slice(0, 100) + '..."'
        }
      }, '*');
    }
    
    // ResizeObserver for iframe height
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        window.parent.postMessage({
          type: 'ui-size-change',
          payload: { height: entry.contentRect.height + 24 }
        }, '*');
      });
    });
    resizeObserver.observe(document.body);
  </script>
</body>
</html>
  `.trim();
}
