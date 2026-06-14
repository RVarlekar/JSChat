# Spur — AI Live Chat Agent

A mini AI-powered customer support chat widget built for the Spur Founding Full-Stack Engineer take-home assignment.

---

## Tech Stack

| Layer      | Choice                           |
|------------|----------------------------------|
| Backend    | Node.js + TypeScript + Express   |
| Frontend   | React 18 + Vite                  |
| Database   | PostgreSQL                       |
| Cache      | Redis (Caching & Rate Limiting)  |
| LLM        | Anthropic Claude (claude-sonnet) |

---

## Local Setup

### Prerequisites

- Node.js ≥ 18
- PostgreSQL running locally (or a connection URL)
- Redis running locally (Optional: backend fails open to DB if Redis is offline)
- An Anthropic API key → [console.anthropic.com](https://console.anthropic.com)

---

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd spur-chat

# Install all dependencies
npm run install:all
```

---

### 2. Configure Environment Variables

Create `backend/.env` manually with the following variables:

```env
ANTHROPIC_API_KEY=sk-ant-...        # Your Anthropic API key (optional)
GEMINI_API_KEY=AIzaSy...            # Your Google Gemini API key (optional)
DATABASE_URL=postgresql://postgres:password@localhost:5432/spur_chat
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

> **Never commit your `.env` file.** It is ignored by Git. The `.env.example` template has been deleted from the repository for security to prevent credentials leaks.

---

### 3. Set Up the Database

Create the database:

```bash
psql -U postgres -c "CREATE DATABASE spur_chat;"
```

Run migrations (creates `conversations` and `messages` tables):

```bash
npm run db:migrate
```

---

### 3.5. (Optional) Run Redis

If you want to test the caching and API rate limiter, start a local Redis server. 
You can run it via Docker:
```bash
docker run --name spur-redis -p 6379:6379 -d redis
```
Or via Homebrew:
```bash
brew services start redis
```
*Note: If you do not run Redis, the application will print a warning and automatically fall back to querying PostgreSQL directly (fail-open mode), so the application remains fully functional.*

---

### 4. Run the App

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
npm run dev:backend
# Server running on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
npm run dev:frontend
# App running on http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## API Reference

### `POST /chat/message`

Send a message and receive an AI reply.

**Request:**
```json
{
  "message": "What is your return policy?",
  "sessionId": "optional-uuid-for-existing-session"
}
```

**Response:**
```json
{
  "reply": "We offer a 30-day hassle-free return...",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error (400):**
```json
{ "error": "message is required" }
```

---

### `GET /chat/history/:sessionId`

Fetch past messages for a session.

**Response:**
```json
{
  "sessionId": "550e8400-...",
  "messages": [
    { "id": "...", "sender": "user", "text": "Hello", "created_at": "..." },
    { "id": "...", "sender": "ai",   "text": "Hi! How can I help?", "created_at": "..." }
  ]
}
```

---

### `GET /health`

Health check endpoint.

---

## Architecture Overview

```
spur-chat/
├── backend/
│   └── src/
│       ├── index.ts          # App bootstrap, Express setup, CORS
│       ├── routes/
│       │   └── chat.routes.ts     # Route handlers + input validation
│       ├── services/
│       │   ├── chat.service.ts    # Orchestration: session, persist, call LLM
│       │   └── llm.service.ts     # Anthropic SDK wrapper, error classification
│       ├── db/
│       │   ├── pool.ts            # PostgreSQL connection pool
│       │   ├── queries.ts         # Repository: typed DB queries
│       │   └── migrate.ts         # Migration runner
│       └── middleware/
│           └── errorHandler.ts    # Global error handler
└── frontend/
    └── src/
        ├── App.tsx           # Main UI component + inline styles
        ├── hooks/
        │   └── useChat.ts    # All chat state (messages, session, loading)
        └── lib/
            └── api.ts        # Typed fetch wrappers for backend API
```

### Layer Responsibilities

- **Routes** — validate HTTP input, delegate to services, map errors to HTTP status codes.
- **Services** — business logic: resolve/create sessions, persist messages, call LLM, handle service-level errors.
- **DB (queries.ts)** — thin repository with typed PostgreSQL queries. No business logic.
- **LLM Service** — encapsulates Google Gemini (using fetch) and Anthropic Claude SDK. Dynamically detects which key is active and handles error classification (auth, rate limit, timeout, server error) for both providers to convert them to user-friendly messages.
- **useChat (hook)** — owns all frontend state: message list, session ID (persisted to `localStorage`), loading flags. App component is purely presentational.

---

## LLM Notes

**Provider:** Google Gemini (`gemini-1.5-flash` / `gemini-1.5-pro`) or Anthropic Claude (`claude-sonnet-4-20250514`)

**Prompting Strategy:**
- A detailed system prompt seeds the agent with store knowledge (shipping, returns, payments, support hours, cancellation policy).
- Up to the last **20 messages** of conversation history are included for contextual replies.
- `max_tokens: 512` caps response length and cost.

**Guardrails:**
- API errors are caught and classified: `401` (bad key), `429` (rate limit), `5xx` (server error), timeout — each mapped to a distinct user-friendly message.
- Error messages are still persisted to the DB so the chat history is complete.
- Empty messages are rejected at both the frontend (disabled send button) and backend (express-validator).
- Messages over 2000 characters are truncated on the frontend and validated on the backend.

---

## Data Model

```sql
conversations (
  id          UUID PK DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ,  -- auto-updated via trigger on message insert
  metadata    JSONB
)

messages (
  id              UUID PK,
  conversation_id UUID FK → conversations.id ON DELETE CASCADE,
  sender          VARCHAR(10) CHECK ('user' | 'ai'),
  text            TEXT,
  created_at      TIMESTAMPTZ
)
```

A DB trigger on `messages` automatically updates `conversations.updated_at` on every new message insert.

Session IDs are UUIDs stored in the browser's `localStorage`. On page reload the frontend fetches history for the stored session — no login required.

---

## Trade-offs & "If I Had More Time…"

**Kept simple intentionally:**
- No authentication — session is just a UUID in localStorage. In production this would be tied to a user account.
- SQLite would have worked for demo; PostgreSQL was chosen because the spec prefers it and it's what Spur would use in production.

**If I had more time:**
- **Streaming replies** — use Anthropic's streaming API to show tokens as they arrive (much better UX).
- **Tool use / RAG** — move store knowledge to a vector DB (e.g. pgvector) and do semantic retrieval rather than stuffing everything in the system prompt.
- **WebSocket** — replace HTTP polling with a persistent WS connection for real-time "agent typing" state.
- **Admin panel** — view all conversations, flag escalations.
- **Tests** — unit tests for the LLM service mock, integration tests for the chat endpoint.
- **Docker Compose** — one command to spin up Postgres + backend + frontend + Redis.

---

## Deployment

The app is deployed at: **[your-deployed-url-here]**

Recommended free-tier options:
- **Backend**: [Render](https://render.com) (Web Service, add a PostgreSQL instance)
- **Frontend**: [Vercel](https://vercel.com) or [Netlify](https://netlify.com)

Set the same env vars from `.env.example` in your host's environment settings.
