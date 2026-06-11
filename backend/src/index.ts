import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { chatRouter } from './routes/chat.routes';
import { errorHandler } from './middleware/errorHandler';
import { checkDbConnection } from './db/pool';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
);

app.use(express.json({ limit: '1mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/chat', chatRouter);

// ─── Error handler (must be last) ─────────────────────────────────────────────

app.use(errorHandler);

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function start() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error('❌ Neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is set in environment variables.');
    process.exit(1);
  }

  await checkDbConnection();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
