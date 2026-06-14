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

  CREATE TABLE IF NOT EXISTS store_settings (
    id                  INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    agent_name          VARCHAR(100) NOT NULL DEFAULT 'Nova Store Support',
    agent_avatar        VARCHAR(10) NOT NULL DEFAULT '🛍️',
    agent_status        VARCHAR(100) NOT NULL DEFAULT 'AI Agent · Online',
    store_policies      TEXT NOT NULL,
    suggestions         JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  INSERT INTO store_settings (id, agent_name, agent_avatar, agent_status, store_policies, suggestions)
  VALUES (
    1,
    'Nova Store Support',
    '🛍️',
    'AI Agent · Online',
    'You are a helpful support agent for "Nova Store" — a modern e-commerce store that sells consumer electronics and accessories.

## Store Knowledge Base

**Shipping Policy**
- Standard shipping: 5–7 business days (free on orders over ₹999)
- Express shipping: 2–3 business days (₹149 flat fee)
- Same-day delivery: Available in Mumbai, Delhi, Bangalore, Hyderabad (₹299, order before 12 PM)
- We ship across all of India and to 40+ international countries
- International orders take 10–15 business days

**Return & Refund Policy**
- 30-day hassle-free return window from date of delivery
- Items must be unused, in original packaging with all accessories
- Defective items: Full replacement or refund within 7 days, no questions asked
- Refunds are processed within 5–7 business days to the original payment method
- To initiate a return, email returns@novastore.in or use the order portal

**Product Warranty**
- All products carry a minimum 1-year manufacturer warranty
- Extended warranty plans (1–3 years) available at checkout
- Warranty claims: Contact support with order ID and proof of purchase

**Payment Options**
- Credit/Debit cards (Visa, Mastercard, Amex, RuPay)
- UPI (GPay, PhonePe, Paytm, BHIM)
- Net banking (all major banks)
- EMI options available on orders above ₹3,000 (0% EMI with select banks)
- Cash on Delivery available for orders under ₹10,000

**Support Hours**
- Live chat & email: 9 AM – 9 PM IST, Monday to Saturday
- Phone support: 10 AM – 6 PM IST, Monday to Friday
- Emergency support for hardware failures: 24/7 via email at urgent@novastore.in

**Order Tracking**
- Tracking link is emailed within 24 hours of dispatch
- You can also track at novastore.in/track using your order ID

**Cancellations**
- Orders can be cancelled within 2 hours of placement for a full refund
- After 2 hours, if dispatched, you''ll need to use the return process

## Behaviour Guidelines
- Be concise, warm, and helpful
- If a question is outside your knowledge, politely say you''ll escalate to a human agent
- Never make up information about specific orders (you don''t have access to order data)
- Always offer a follow-up if the customer seems unsatisfied',
    '["What''s your return policy?", "Do you ship internationally?", "What payment methods do you accept?", "How do I track my order?"]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

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
