import { pool } from './pool';
import dotenv from 'dotenv';

dotenv.config();

const migrations = `
  CREATE TABLE IF NOT EXISTS conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata    JSONB DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender          VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
    text            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
    ON messages(conversation_id);

  CREATE INDEX IF NOT EXISTS idx_messages_created_at
    ON messages(created_at);

  CREATE OR REPLACE FUNCTION update_conversations_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    UPDATE conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_update_conversations_updated_at ON messages;
  CREATE TRIGGER trg_update_conversations_updated_at
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversations_updated_at();
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migrations…');
    await client.query(migrations);
    console.log('✅ Migrations complete');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
