import {
  createConversation,
  getConversation,
  insertMessage,
  getMessagesByConversation,
  type Message,
} from '../db/queries';
import { generateReply, LLMError } from './llm.service';
import { getCache, setCache, invalidateCache } from './cache.service';
import { getStoreSettingsCached } from './settings.service';

const MAX_MESSAGE_LENGTH = 2000;

export interface SendMessageResult {
  reply: string;
  sessionId: string;
  userMessage: Message;
  aiMessage: Message;
}

export interface ConversationHistory {
  sessionId: string;
  messages: Message[];
}

export async function sendMessage(
  userText: string,
  sessionId?: string
): Promise<SendMessageResult> {
  // Validate & sanitise input
  const trimmed = userText.trim();
  if (!trimmed) {
    throw new ValidationError('Message cannot be empty.');
  }

  const text =
    trimmed.length > MAX_MESSAGE_LENGTH
      ? trimmed.slice(0, MAX_MESSAGE_LENGTH)
      : trimmed;

  // Resolve or create conversation
  let conversationId: string;

  if (sessionId) {
    const existing = await getConversation(sessionId);
    if (!existing) {
      // Session not found — start fresh (don't crash)
      const conv = await createConversation();
      conversationId = conv.id;
    } else {
      conversationId = existing.id;
    }
  } else {
    const conv = await createConversation();
    conversationId = conv.id;
  }

  // Fetch history for context
  const history = await getMessagesByConversation(conversationId);

  // Invalidate cache immediately when new user message is sent to prevent serving stale history
  await invalidateCache(`session:history:${conversationId}`);

  // Persist user message first
  const userMessage = await insertMessage(conversationId, 'user', text);

  // Call LLM
  let replyText: string;
  try {
    const settings = await getStoreSettingsCached();
    replyText = await generateReply(history, text, settings.store_policies);
  } catch (err) {
    if (err instanceof LLMError) {
      // Still persist a friendly AI error message so UI shows something
      const aiMessage = await insertMessage(conversationId, 'ai', err.userMessage);
      await invalidateCache(`session:history:${conversationId}`);
      return {
        reply: err.userMessage,
        sessionId: conversationId,
        userMessage,
        aiMessage,
      };
    }
    throw err;
  }

  // Persist AI reply
  const aiMessage = await insertMessage(conversationId, 'ai', replyText);
  await invalidateCache(`session:history:${conversationId}`);

  return {
    reply: replyText,
    sessionId: conversationId,
    userMessage,
    aiMessage,
  };
}

export async function getHistory(sessionId: string): Promise<ConversationHistory> {
  const cacheKey = `session:history:${sessionId}`;
  
  // Try to load from cache
  const cached = await getCache(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.messages)) {
        parsed.messages = parsed.messages.map((m: any) => ({
          ...m,
          created_at: new Date(m.created_at)
        }));
      }
      return parsed as ConversationHistory;
    } catch (err) {
      console.warn(`[Redis] Failed to parse cached history: ${err}`);
    }
  }

  const conv = await getConversation(sessionId);
  if (!conv) {
    throw new NotFoundError(`Session "${sessionId}" not found.`);
  }

  const messages = await getMessagesByConversation(sessionId);
  const result = { sessionId, messages };

  // Cache in Redis for 10 minutes (600 seconds)
  await setCache(cacheKey, JSON.stringify(result), 600);

  return result;
}

// ─── Domain errors ────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
