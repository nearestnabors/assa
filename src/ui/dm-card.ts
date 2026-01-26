/**
 * DMCard UI Component
 * 
 * Displays a single Twitter DM with sender info and preview.
 * 
 * TODO: Implement similar to MentionCard but more compact
 */

import { escapeHtml } from '../utils/html.js';
import { formatRelativeTime } from '../utils/time.js';

export interface DM {
  id: string;
  sender: {
    handle: string;
    displayName: string;
    avatarUrl: string;
  };
  preview: string;
  timestamp: string;
  isUnread: boolean;
}

export function createDMCardUI(dm: DM): string {
  const relativeTime = formatRelativeTime(dm.timestamp);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 8px;
      background: transparent;
    }
    .card {
      display: flex;
      gap: 10px;
      padding: 12px;
      background: #ffffff;
      border-radius: 10px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      position: relative;
    }
    .unread-dot {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 8px;
      height: 8px;
      background: #3b82f6;
      border-radius: 50%;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }
    .content { flex: 1; min-width: 0; }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .name { font-weight: 600; font-size: 14px; }
    .time { color: #64748b; font-size: 12px; }
    .preview {
      color: #475569;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="card">
    ${dm.isUnread ? '<div class="unread-dot"></div>' : ''}
    <img class="avatar" src="${escapeHtml(dm.sender.avatarUrl)}" 
         onerror="this.src='https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'" />
    <div class="content">
      <div class="header">
        <span class="name">@${escapeHtml(dm.sender.handle)}</span>
        <span class="time">${escapeHtml(relativeTime)}</span>
      </div>
      <p class="preview">${escapeHtml(dm.preview)}</p>
    </div>
  </div>
  <script>
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        window.parent.postMessage({
          type: 'ui-size-change',
          payload: { height: entry.contentRect.height + 16 }
        }, '*');
      });
    });
    resizeObserver.observe(document.body);
  </script>
</body>
</html>
  `.trim();
}
