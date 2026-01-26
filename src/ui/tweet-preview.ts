/**
 * TweetPreview UI Component
 * 
 * Shows a draft tweet with Post/Edit/Cancel buttons.
 * The Post button fires a tool action to actually post.
 */

import { escapeHtml } from '../utils/html.js';

interface TweetDraft {
  text: string;
  charCount: number;
  replyTo?: {
    id: string;
    author: string;
    text: string;
  };
  quoteTweet?: {
    id: string;
    author: string;
    text: string;
  };
}

export function createTweetPreviewUI(draft: TweetDraft): string {
  const charCountClass = draft.charCount > 280 ? 'over' : draft.charCount > 260 ? 'warning' : 'ok';
  
  const replyContextHtml = draft.replyTo ? `
    <div class="reply-context">
      <span class="reply-label">Replying to @${escapeHtml(draft.replyTo.author)}</span>
      <p class="reply-text">${escapeHtml(draft.replyTo.text.slice(0, 100))}...</p>
    </div>
  ` : '';
  
  const quoteContextHtml = draft.quoteTweet ? `
    <div class="quote-context">
      <p class="quote-text">@${escapeHtml(draft.quoteTweet.author)}: ${escapeHtml(draft.quoteTweet.text.slice(0, 80))}...</p>
    </div>
  ` : '';
  
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
    .preview-card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .preview-header {
      padding: 16px;
      border-bottom: 1px solid #e2e8f0;
      font-weight: 600;
      color: #1e293b;
    }
    .reply-context, .quote-context {
      padding: 12px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .reply-label {
      font-size: 13px;
      color: #3b82f6;
    }
    .reply-text, .quote-text {
      font-size: 14px;
      color: #64748b;
      margin-top: 4px;
    }
    .tweet-content {
      padding: 16px;
      min-height: 80px;
    }
    .tweet-text {
      font-size: 16px;
      line-height: 1.5;
      color: #1e293b;
      white-space: pre-wrap;
    }
    .char-count {
      text-align: right;
      padding: 8px 16px;
      font-size: 14px;
    }
    .char-count.ok { color: #22c55e; }
    .char-count.warning { color: #f59e0b; }
    .char-count.over { color: #ef4444; font-weight: 600; }
    .actions {
      display: flex;
      gap: 12px;
      padding: 16px;
      border-top: 1px solid #e2e8f0;
      justify-content: flex-end;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-post {
      background: #3b82f6;
      color: white;
      border: none;
    }
    .btn-post:hover { background: #2563eb; }
    .btn-post:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-edit {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .btn-edit:hover { background: #e2e8f0; }
    .btn-cancel {
      background: transparent;
      color: #64748b;
      border: none;
    }
    .btn-cancel:hover { color: #ef4444; }
  </style>
</head>
<body>
  <div class="preview-card">
    <div class="preview-header">📝 Tweet Preview</div>
    ${replyContextHtml}
    <div class="tweet-content">
      <p class="tweet-text">${escapeHtml(draft.text)}</p>
    </div>
    ${quoteContextHtml}
    <div class="char-count ${charCountClass}">
      ${draft.charCount}/280
    </div>
    <div class="actions">
      <button class="btn btn-cancel" onclick="cancel()">Cancel</button>
      <button class="btn btn-edit" onclick="edit()">Edit</button>
      <button class="btn btn-post" onclick="post()" ${draft.charCount > 280 ? 'disabled' : ''}>
        Post
      </button>
    </div>
  </div>
  <script>
    const tweetText = ${JSON.stringify(draft.text)};
    const replyToId = ${JSON.stringify(draft.replyTo?.id || null)};
    const quoteId = ${JSON.stringify(draft.quoteTweet?.id || null)};
    
    function post() {
      window.parent.postMessage({
        type: 'tool',
        payload: {
          toolName: 'twitter_post_tweet',
          params: {
            text: tweetText,
            reply_to_id: replyToId,
            quote_tweet_id: quoteId
          }
        }
      }, '*');
    }
    
    function edit() {
      window.parent.postMessage({
        type: 'prompt',
        payload: {
          prompt: 'Edit this tweet draft: "' + tweetText + '"'
        }
      }, '*');
    }
    
    function cancel() {
      window.parent.postMessage({
        type: 'prompt',
        payload: {
          prompt: 'Cancelled the tweet draft.'
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
