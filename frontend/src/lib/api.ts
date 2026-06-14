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

export interface StoreSettings {
  agentName: string;
  agentAvatar: string;
  agentStatus: string;
  suggestions: string[];
  storePolicies: string;
}

export async function fetchSettings(): Promise<StoreSettings> {
  const res = await fetch(`${BASE}/settings`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to fetch settings');
  }

  return data as StoreSettings;
}

export async function updateSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
  const res = await fetch(`${BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to update settings');
  }

  return data as StoreSettings;
}
