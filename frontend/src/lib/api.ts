const BASE = '/chat';

export interface SendMessageResponse {
  reply: string;
  sessionId: string;
}

export interface HistoryMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  text: string;
  created_at: string;
}

export interface HistoryResponse {
  sessionId: string;
  messages: HistoryMessage[];
}

export async function sendMessage(
  message: string,
  sessionId?: string
): Promise<SendMessageResponse> {
  const res = await fetch(`${BASE}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to send message');
  }

  return data as SendMessageResponse;
}

export async function fetchHistory(sessionId: string): Promise<HistoryResponse> {
  const res = await fetch(`${BASE}/history/${sessionId}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to fetch history');
  }

  return data as HistoryResponse;
}
