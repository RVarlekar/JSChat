import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useChat, type ChatMessage } from './hooks/useChat';

// ─── Inline styles (no external CSS file needed) ──────────────────────────────

const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0d0f12;
    --surface: #161a1f;
    --surface2: #1e2329;
    --border: rgba(255,255,255,0.07);
    --text: #e8eaf0;
    --text-muted: #6b7280;
    --accent: #3ecf8e;
    --accent-dim: rgba(62,207,142,0.12);
    --accent-dim2: rgba(62,207,142,0.06);
    --user-bg: #1a2e24;
    --user-border: rgba(62,207,142,0.25);
    --error: #f87171;
    --error-bg: rgba(248,113,113,0.08);
    --radius: 16px;
    --radius-sm: 10px;
    --font: 'DM Sans', sans-serif;
    --mono: 'DM Mono', monospace;
    --shadow: 0 4px 24px rgba(0,0,0,0.4);
  }

  html, body, #root { height: 100%; }

  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-width: 780px;
    margin: 0 auto;
    position: relative;
  }

  /* Ambient glow */
  .app::before {
    content: '';
    position: fixed;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 600px;
    height: 400px;
    background: radial-gradient(ellipse, rgba(62,207,142,0.06) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px;
    border-bottom: 1px solid var(--border);
    background: rgba(22,26,31,0.8);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--accent-dim);
    border: 1.5px solid var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 17px;
  }

  .header-info h1 {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.2px;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .new-chat-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    padding: 6px 12px;
    font-family: var(--font);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .new-chat-btn:hover {
    border-color: rgba(255,255,255,0.15);
    color: var(--text);
    background: var(--surface2);
  }

  /* ── Messages ── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--surface2) transparent;
  }

  .messages::-webkit-scrollbar { width: 4px; }
  .messages::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 4px; }

  /* ── Empty state ── */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 40px;
    text-align: center;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    border-radius: 20px;
    background: var(--accent-dim);
    border: 1px solid rgba(62,207,142,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
  }

  .empty-state h2 {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.3px;
  }

  .empty-state p {
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1.6;
    max-width: 300px;
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 8px;
  }

  .suggestion-chip {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 7px 14px;
    font-size: 13px;
    color: var(--text-muted);
    cursor: pointer;
    font-family: var(--font);
    transition: all 0.15s ease;
  }

  .suggestion-chip:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-dim2);
  }

  /* ── Message bubble ── */
  .msg-group {
    display: flex;
    flex-direction: column;
    margin-bottom: 6px;
  }

  .msg-group.user { align-items: flex-end; }
  .msg-group.ai   { align-items: flex-start; }

  .msg-sender-label {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 4px;
    padding: 0 4px;
    font-weight: 500;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  .bubble {
    max-width: 72%;
    padding: 12px 16px;
    border-radius: var(--radius);
    font-size: 14.5px;
    line-height: 1.65;
    word-break: break-word;
    white-space: pre-wrap;
    position: relative;
    animation: fadeUp 0.2s ease;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .bubble.user {
    background: var(--user-bg);
    border: 1px solid var(--user-border);
    border-bottom-right-radius: 4px;
    color: #d4f7e5;
  }

  .bubble.ai {
    background: var(--surface);
    border: 1px solid var(--border);
    border-bottom-left-radius: 4px;
    color: var(--text);
  }

  .bubble.error {
    background: var(--error-bg);
    border-color: rgba(248,113,113,0.2);
    color: var(--error);
  }

  .msg-time {
    font-size: 10.5px;
    color: var(--text-muted);
    margin-top: 4px;
    padding: 0 4px;
    font-variant-numeric: tabular-nums;
  }

  /* ── Typing indicator ── */
  .typing-bubble {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    border-bottom-left-radius: 4px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 5px;
    animation: fadeUp 0.2s ease;
  }

  .typing-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    animation: typingBounce 1.2s infinite ease-in-out;
  }

  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-5px); opacity: 1; }
  }

  /* ── Loading history ── */
  .loading-history {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Input area ── */
  .input-area {
    padding: 16px 20px 20px;
    border-top: 1px solid var(--border);
    background: rgba(22,26,31,0.9);
    backdrop-filter: blur(12px);
  }

  .input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 8px 8px 8px 16px;
    transition: border-color 0.15s ease;
  }

  .input-wrapper:focus-within {
    border-color: rgba(62,207,142,0.3);
    box-shadow: 0 0 0 3px rgba(62,207,142,0.06);
  }

  .input-field {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text);
    font-family: var(--font);
    font-size: 14.5px;
    line-height: 1.5;
    resize: none;
    max-height: 120px;
    min-height: 24px;
    padding: 4px 0;
  }

  .input-field::placeholder { color: var(--text-muted); }

  .send-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: var(--accent);
    color: #0d1a12;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
    font-size: 16px;
  }

  .send-btn:hover:not(:disabled) {
    background: #4ff09e;
    transform: scale(1.05);
  }

  .send-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    transform: none;
  }

  .input-hint {
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 10px;
    opacity: 0.6;
  }

  /* Char counter */
  .char-count {
    font-size: 11px;
    color: var(--text-muted);
    padding-bottom: 6px;
    padding-right: 4px;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    font-family: var(--mono);
  }

  .char-count.warn { color: var(--error); }
`;

const SUGGESTIONS = [
  "What's your return policy?",
  'Do you ship internationally?',
  'What payment methods do you accept?',
  'How do I track my order?',
];

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TypingIndicator() {
  return (
    <div className="msg-group ai">
      <div className="msg-sender-label">Nova</div>
      <div className="typing-bubble">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className={`msg-group ${msg.sender}`}>
      <div className="msg-sender-label">
        {msg.sender === 'user' ? 'You' : 'Nova'}
      </div>
      <div className={`bubble ${msg.sender}${msg.isError ? ' error' : ''}`}>
        {msg.text}
      </div>
      <div className="msg-time">{formatTime(msg.timestamp)}</div>
    </div>
  );
}

export default function App() {
  const { messages, isLoading, isLoadingHistory, send, clearSession, bottomRef } =
    useChat();
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX = 2000;
  const canSend = draft.trim().length > 0 && !isLoading;

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  function handleSend() {
    if (!canSend) return;
    send(draft);
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggestion(text: string) {
    setDraft(text);
    textareaRef.current?.focus();
  }

  const isEmpty = messages.length === 0 && !isLoadingHistory;

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <div className="avatar">🛍️</div>
            <div className="header-info">
              <h1>Nova Store Support</h1>
              <div className="status-row">
                <div className="status-dot" />
                <span>AI Agent · Online</span>
              </div>
            </div>
          </div>
          {messages.length > 0 && (
            <button className="new-chat-btn" onClick={clearSession}>
              ↺ New chat
            </button>
          )}
        </header>

        {/* Messages */}
        <div className="messages">
          {isLoadingHistory && (
            <div className="loading-history">
              <div className="spinner" />
              Loading your conversation…
            </div>
          )}

          {isEmpty && (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h2>How can I help you today?</h2>
              <p>
                Ask me anything about orders, shipping, returns, or our
                products.
              </p>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="suggestion-chip"
                    onClick={() => handleSuggestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="input-field"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              disabled={isLoading}
            />
            {draft.length > MAX * 0.8 && (
              <span className={`char-count${draft.length > MAX * 0.95 ? ' warn' : ''}`}>
                {draft.length}/{MAX}
              </span>
            )}
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Send message"
            >
              ↑
            </button>
          </div>
          <p className="input-hint">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </>
  );
}
