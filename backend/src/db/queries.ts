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
