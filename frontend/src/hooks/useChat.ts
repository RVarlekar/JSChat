import { useState, useCallback, useEffect, useRef } from 'react';
import { sendMessage, fetchHistory, fetchSettings, type HistoryMessage, type StoreSettings } from '../lib/api';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  isError?: boolean;
}

const SESSION_KEY = 'spur_session_id';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(() =>
    localStorage.getItem(SESSION_KEY) ?? undefined
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>({
    agentName: 'Nova Store Support',
    agentAvatar: '🛍️',
    agentStatus: 'AI Agent · Online',
    suggestions: [
      "What's your return policy?",
      'Do you ship internationally?',
      'What payment methods do you accept?',
      'How do I track my order?',
    ],
    storePolicies: '',
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load store settings on mount
  useEffect(() => {
    fetchSettings()
      .then((res) => {
        setSettings(res);
      })
      .catch((err) => {
        console.warn('Failed to load store settings, using fallback defaults', err);
      });
  }, []);

  // Load history on mount if session exists
  useEffect(() => {
    if (!sessionId) return;

    setIsLoadingHistory(true);
    fetchHistory(sessionId)
      .then((res) => {
        const mapped: ChatMessage[] = res.messages.map((m: HistoryMessage) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          timestamp: new Date(m.created_at),
        }));
        setMessages(mapped);
      })
      .catch(() => {
        // Session may be stale — clear it
        localStorage.removeItem(SESSION_KEY);
        setSessionId(undefined);
      })
      .finally(() => setIsLoadingHistory(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'user',
        text: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res = await sendMessage(trimmed, sessionId);

        // Persist session
        if (res.sessionId !== sessionId) {
          setSessionId(res.sessionId);
          localStorage.setItem(SESSION_KEY, res.sessionId);
        }

        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          sender: 'ai',
          text: res.reply,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          sender: 'ai',
          text:
            err instanceof Error
              ? err.message
              : 'Something went wrong. Please try again.',
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, isLoading]
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(undefined);
    setMessages([]);
  }, []);

  return { messages, isLoading, isLoadingHistory, send, clearSession, bottomRef, settings };
}
