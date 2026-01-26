/**
 * DigestContainer UI Component
 * 
 * Displays a full digest with sections for different content types.
 * 
 * TODO: Complete implementation with collapsible sections
 */

import { escapeHtml } from '../utils/html.js';

interface DigestSection {
  title: string;
  icon: string;
  count: number;
  items: unknown[];
}

interface DigestData {
  title: string;
  generatedAt: string;
  sections: DigestSection[];
  stats: {
    totalMentions: number;
    unreadDMs: number;
    questionsAsked: number;
  };
}

export function createDigestContainerUI(data: DigestData): string {
  const generatedTime = new Date(data.generatedAt).toLocaleTimeString();
  
  const sectionsHtml = data.sections
    .filter(s => s.count > 0)
    .map(section => `
      <div class="section">
        <div class="section-header">
          <span class="section-icon">${section.icon}</span>
          <span class="section-title">${escapeHtml(section.title)}</span>
          <span class="section-count">${section.count}</span>
        </div>
      </div>
    `)
    .join('');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      background: transparent;
    }
    .container {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      padding: 20px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
    }
    .header h1 { font-size: 20px; margin-bottom: 4px; }
    .header .time { opacity: 0.8; font-size: 14px; }
    .stats {
      display: flex;
      gap: 20px;
      padding: 16px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .stat { text-align: center; }
    .stat-value { font-size: 24px; font-weight: 700; color: #1e293b; }
    .stat-label { font-size: 12px; color: #64748b; }
    .sections { padding: 16px; }
    .section { margin-bottom: 12px; }
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #f1f5f9;
      border-radius: 8px;
      cursor: pointer;
    }
    .section-icon { font-size: 18px; }
    .section-title { flex: 1; font-weight: 600; }
    .section-count {
      background: #3b82f6;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
    }
    .refresh-btn {
      display: block;
      width: calc(100% - 32px);
      margin: 0 16px 16px;
      padding: 12px;
      background: #f1f5f9;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    }
    .refresh-btn:hover { background: #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(data.title)}</h1>
      <p class="time">Generated at ${generatedTime}</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${data.stats.totalMentions}</div>
        <div class="stat-label">Mentions</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.stats.unreadDMs}</div>
        <div class="stat-label">DMs</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.stats.questionsAsked}</div>
        <div class="stat-label">Questions</div>
      </div>
    </div>
    <div class="sections">
      ${sectionsHtml}
    </div>
    <button class="refresh-btn" onclick="refresh()">🔄 Refresh Digest</button>
  </div>
  <script>
    function refresh() {
      window.parent.postMessage({
        type: 'tool',
        payload: {
          toolName: 'twitter_daily_digest',
          params: {}
        }
      }, '*');
    }
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
