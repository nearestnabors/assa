/**
 * Tweet Preview MCP App
 *
 * Receives draft tweet data from tool result and provides Post/Edit/Cancel actions.
 * Posts tweets directly via app.callServerTool().
 */

import { App } from '@modelcontextprotocol/ext-apps';

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

const app = new App({ name: 'ASSA Tweet Preview', version: '1.0.0' });

// DOM elements
const loadingEl = document.getElementById('loading')!;
const previewCard = document.getElementById('previewCard')!;
const replyContext = document.getElementById('replyContext')!;
const replyAuthor = document.getElementById('replyAuthor')!;
const replyTextEl = document.getElementById('replyText')!;
const tweetTextEl = document.getElementById('tweetText')!;
const quoteContext = document.getElementById('quoteContext')!;
const quoteTextEl = document.getElementById('quoteText')!;
const charCountEl = document.getElementById('charCount')!;
const actionsEl = document.getElementById('actions')!;
const cancelBtn = document.getElementById('cancelBtn')!;
const editBtn = document.getElementById('editBtn')!;
const postBtn = document.getElementById('postBtn')!;
const successMessage = document.getElementById('successMessage')!;
const errorMessage = document.getElementById('errorMessage')!;

let draft: TweetDraft | null = null;

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderDraft(data: TweetDraft): void {
  draft = data;
  loadingEl.classList.add('hidden');
  previewCard.classList.remove('hidden');

  // Set tweet text
  tweetTextEl.textContent = data.text;

  // Character count styling
  const charCountClass = data.charCount > 280 ? 'over' : data.charCount > 260 ? 'warning' : 'ok';
  charCountEl.className = `char-count ${charCountClass}`;
  charCountEl.textContent = `${data.charCount}/280`;

  // Disable post if over limit
  (postBtn as HTMLButtonElement).disabled = data.charCount > 280;

  // Reply context
  if (data.replyTo) {
    replyContext.classList.remove('hidden');
    replyAuthor.textContent = `@${escapeHtml(data.replyTo.author || 'unknown')}`;
    if (data.replyTo.text) {
      replyTextEl.textContent = data.replyTo.text.slice(0, 100) + '...';
    }
  }

  // Quote context
  if (data.quoteTweet) {
    quoteContext.classList.remove('hidden');
    const author = escapeHtml(data.quoteTweet.author || 'unknown');
    const text = data.quoteTweet.text ? data.quoteTweet.text.slice(0, 80) + '...' : '';
    quoteTextEl.textContent = `@${author}: ${text}`;
  }
}

// Handle tool result from server
app.ontoolresult = (result) => {
  const textContent = result.content?.find((c: { type: string }) => c.type === 'text');
  if (textContent && 'text' in textContent) {
    try {
      const data = JSON.parse(textContent.text as string) as TweetDraft;
      renderDraft(data);
    } catch {
      errorMessage.textContent = 'Error: Invalid draft data';
      errorMessage.classList.remove('hidden');
      loadingEl.classList.add('hidden');
    }
  }
};

// Cancel button - notify context
cancelBtn.addEventListener('click', async () => {
  await app.updateModelContext({
    content: [{ type: 'text', text: 'User cancelled the tweet draft.' }],
  });
  actionsEl.classList.add('hidden');
  errorMessage.textContent = 'Draft cancelled';
  errorMessage.classList.remove('hidden');
});

// Edit button - notify context with request to edit
editBtn.addEventListener('click', async () => {
  if (!draft) return;
  await app.updateModelContext({
    content: [{ type: 'text', text: `User wants to edit this tweet draft: "${draft.text}"` }],
  });
});

// Post button - call twitter_post_tweet directly
postBtn.addEventListener('click', async () => {
  if (!draft) return;

  (postBtn as HTMLButtonElement).disabled = true;
  postBtn.textContent = 'Posting...';

  try {
    const result = await app.callServerTool({
      name: 'twitter_post_tweet',
      arguments: {
        text: draft.text,
        reply_to_id: draft.replyTo?.id,
        quote_tweet_id: draft.quoteTweet?.id,
      },
    });

    // Check result
    const textContent = result.content?.find((c: { type: string }) => c.type === 'text');
    if (textContent && 'text' in textContent) {
      const text = textContent.text as string;
      if (text.includes('posted') || text.includes('success')) {
        previewCard.classList.add('hidden');
        successMessage.textContent = 'Tweet posted successfully!';
        successMessage.classList.remove('hidden');
      } else {
        errorMessage.textContent = text;
        errorMessage.classList.remove('hidden');
        (postBtn as HTMLButtonElement).disabled = false;
        postBtn.textContent = 'Post';
      }
    }
  } catch (error) {
    errorMessage.textContent = `Error: ${error instanceof Error ? error.message : 'Failed to post'}`;
    errorMessage.classList.remove('hidden');
    (postBtn as HTMLButtonElement).disabled = false;
    postBtn.textContent = 'Post';
  }
});

// Connect to host
app.connect();
