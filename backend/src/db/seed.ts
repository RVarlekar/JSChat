import { pool } from './pool';
import { createConversation, insertMessage } from './queries';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');
    
    // Create a default demo conversation
    const conv = await createConversation();
    console.log(`Created demo conversation: ${conv.id}`);
    
    // Insert a few welcome messages
    await insertMessage(conv.id, 'user', 'Hello! What is your return policy?');
    await insertMessage(
      conv.id,
      'ai',
      'Hello! We offer a 30-day hassle-free return window from the date of delivery. Items must be unused and in original packaging.'
    );
    
    console.log('✅ Seeding complete');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
