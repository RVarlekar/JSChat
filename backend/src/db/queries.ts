import { pool } from './pool';

export interface Conversation {
  id: string;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, unknown>;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  text: string;
  created_at: Date;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function createConversation(): Promise<Conversation> {
  const { rows } = await pool.query<Conversation>(
    `INSERT INTO conversations DEFAULT VALUES RETURNING *`
  );
  return rows[0];
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { rows } = await pool.query<Conversation>(
    `SELECT * FROM conversations WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function insertMessage(
  conversationId: string,
  sender: 'user' | 'ai',
  text: string
): Promise<Message> {
  const { rows } = await pool.query<Message>(
    `INSERT INTO messages (conversation_id, sender, text)
     VALUES ($1, $2, $3) RETURNING *`,
    [conversationId, sender, text]
  );
  return rows[0];
}

export async function getMessagesByConversation(
  conversationId: string,
  limit = 50
): Promise<Message[]> {
  const { rows } = await pool.query<Message>(
    `SELECT * FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [conversationId, limit]
  );
  return rows;
}

// ─── Store Settings ──────────────────────────────────────────────────────────

export interface StoreSettings {
  agent_name: string;
  agent_avatar: string;
  agent_status: string;
  store_policies: string;
  suggestions: string[];
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const { rows } = await pool.query<any>(
    `SELECT agent_name, agent_avatar, agent_status, store_policies, suggestions FROM store_settings WHERE id = 1`
  );
  return {
    agent_name: rows[0].agent_name,
    agent_avatar: rows[0].agent_avatar,
    agent_status: rows[0].agent_status,
    store_policies: rows[0].store_policies,
    suggestions: Array.isArray(rows[0].suggestions) 
      ? rows[0].suggestions 
      : JSON.parse(rows[0].suggestions)
  };
}

export async function updateStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
  const current = await getStoreSettings();
  const agentName = settings.agent_name ?? current.agent_name;
  const agentAvatar = settings.agent_avatar ?? current.agent_avatar;
  const agentStatus = settings.agent_status ?? current.agent_status;
  const storePolicies = settings.store_policies ?? current.store_policies;
  const suggestions = settings.suggestions ?? current.suggestions;

  const { rows } = await pool.query<any>(
    `UPDATE store_settings
     SET agent_name = $1, agent_avatar = $2, agent_status = $3, store_policies = $4, suggestions = $5, updated_at = NOW()
     WHERE id = 1
     RETURNING agent_name, agent_avatar, agent_status, store_policies, suggestions`,
    [agentName, agentAvatar, agentStatus, storePolicies, JSON.stringify(suggestions)]
  );

  return {
    agent_name: rows[0].agent_name,
    agent_avatar: rows[0].agent_avatar,
    agent_status: rows[0].agent_status,
    store_policies: rows[0].store_policies,
    suggestions: Array.isArray(rows[0].suggestions) 
      ? rows[0].suggestions 
      : JSON.parse(rows[0].suggestions)
  };
}
