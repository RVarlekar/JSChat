# Project Submission Documentation: Spur AI Live Chat Agent

This document provides a comprehensive overview of the AI Live Chat Agent application developed for the Spur Founding Full-Stack Engineer take-home assignment.

---

## 1. Project Overview

The project simulates a real-time e-commerce customer support chat widget. An AI agent named **"Nova"** answers user questions about shipping policies, return processes, warranty terms, support hours, and order tracking, using either the **Google Gemini API** or the **Anthropic Claude API** (or falls back to a deterministic local mock engine if running without active API keys).

### Key Features
- **Responsive Chat Interface**: Built with React and Vite, featuring smooth scrolling, user/AI message distinction, dynamic auto-resizing text area, and character limit warning indicators.
- **Typing Indicator**: Displays a subtle bounce animation while the AI is generating a response.
- **Conversation Persistence**: All messages (both user inputs and AI replies) are saved to a PostgreSQL database. 
- **Redis Caching & Rate Limiting**: Caches message history logs locally in Redis to offload database reads, and implements request rate limiting (max 10 requests/minute) per session. Operates on a **fail-open** design to run smoothly even if Redis is offline.
- **Session Restoration**: Uses a browser `localStorage` UUID to fetch and restore previous chat history upon reloading or returning to the page.
- **Local Test Fallback**: Incorporates a mock fallback option for local testing, rendering policy-compliant responses instantly without calling the live Anthropic API.
- **Idiomatic Code & Separation of Concerns**: Strict boundary divisions between routes (validation), services (business logic, prompt formatting, cache operations), repository queries (SQL statements), and UI hooks.

---

## 2. Local Setup Guide

Follow these steps to configure and run the application on your local machine.

### Prerequisites
- **Node.js** ≥ 18
- **PostgreSQL** running locally
- **npm** (comes packaged with Node.js)

### Step 1: Install Dependencies
From the root directory of the project, run:
```bash
npm run install:all
```
This automatically installs the required node packages for both the `backend` and the `frontend` directories.

### Step 2: Configure Environment Variables
Navigate to the `backend` directory, duplicate the environment template, and configure the variables:
```bash
cd backend
cp .env.example .env
```

Edit the `backend/.env` file:
```env
# Anthropic API Key (optional placeholder)
ANTHROPIC_API_KEY=sk-ant-placeholder-key

# Google Gemini API Key (optional placeholder)
GEMINI_API_KEY=your_gemini_api_key_here

# PostgreSQL Connection URL (substitute with your credentials)
DATABASE_URL=postgresql://postgres:Test123@localhost:5432/spur_chat

# Redis URL for caching & rate limiting
REDIS_URL=redis://127.0.0.1:6379

# Server Port and Environment
PORT=3001
NODE_ENV=development

# Frontend Origin for CORS configuration
FRONTEND_URL=http://localhost:5173
```

### Step 3: Initialize Database (Migrations & Seeding)
From the root directory, execute the migrations to create the required tables (`conversations`, `messages`), indices, and updated-at database triggers:
```bash
npm run db:migrate
```

To populate the database with a default welcome message and initial conversation history, run the seeding script:
```bash
# Navigate to backend to seed the database
cd backend
npm run db:seed
```

### Step 4: Run the Application
Start both the backend server and frontend development server by opening two terminal windows:

**Terminal 1 (Backend):**
```bash
npm run dev:backend
# Server starts running at http://localhost:3001
```

**Terminal 2 (Frontend):**
```bash
npm run dev:frontend
# App starts running at http://localhost:5173
```

Access the chat interface by navigating to [http://localhost:5173](http://localhost:5173) in your web browser.

---

## 3. Database Schema

The persistence layer uses a highly relational model in PostgreSQL, complete with cascading deletes, indexing on query search columns, and automatic timestamps.

### Table: `conversations`
Tracks individual customer chat sessions.
```sql
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB DEFAULT '{}'
);
```

### Table: `messages`
Stores individual chat bubbles associated with a specific conversation session.
```sql
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender          VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
  text            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Automation & Performance Optimizations
- **Indexing**: Fast retrieval is ensured by creating composite/single indexes on `messages(conversation_id)` and `messages(created_at)`.
- **Database Trigger**: A PL/pgSQL trigger is registered to automatically touch `conversations.updated_at` to the current timestamp whenever a message is inserted:
  ```sql
  CREATE OR REPLACE FUNCTION update_conversations_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    UPDATE conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```

---

## 4. Architecture Overview

The backend follows a layered architecture pattern:

```
[Client (React UI)] ──> [Routes (Express)] ──> [Chat Service (Orchestration)] ──> [Database (pg)]
                             │                        │
                             ├──> [Rate Limiter]      └──> [Cache Service (Redis)]
                             │
                             └──> [LLM Service (Claude SDK / Mock)]
```

- **Routes (`chat.routes.ts`)**: Decouples network concerns. Express routing layer validated via `express-validator` and rate-limited via a Redis-backed middleware. Sanitizes parameters (e.g., checks valid session UUIDs, message length limits) and maps service-level errors to standard HTTP response codes.
- **Cache Service (`cache.service.ts`)**: Manages the Redis connection client and connection status, exposing safe wrappers that fail-open if the Redis server goes offline.
- **Chat Service (`chat.service.ts`)**: Serves as the central business logic coordinator. It handles session resolving/creation, manages history length constraints, checks Redis cache, invalidates cache keys on updates, persists records to the database, and invokes the LLM client.
- **Database Queries (`queries.ts`)**: A clean data-access layer that exposes strongly typed database execution functions (`createConversation`, `getMessagesByConversation`, etc.).
- **LLM Service (`llm.service.ts`)**: Encapsulates both Anthropic Claude SDK and Google Gemini API (using native fetch). Automatically checks which API key is active, dynamically routing prompts, and translating upstream API errors (timeouts, rate limits, invalid keys) to helpful client messages.

---

## 5. LLM Prompt Strategy & Guardrails

- **System Prompt**: Seeding the Claude context with detailed policies (shipping tiers, refund windows, warranty scopes, support schedules) ensuring responses conform to correct factual guidelines.
- **Short History Window**: Appends up to the last **20 messages** of conversation history (`MAX_HISTORY_MESSAGES = 20`) to Anthropic messages to preserve conversational context without exceeding token quotas.
- **Token Caps**: Restricts replies to `max_tokens: 512` to control query costs.
- **Graceful Error Classification**: Anthropic API errors are caught and converted into user-friendly notifications (e.g., `401` -> *"Invalid API key. Please contact support."*, `429` -> *"Our AI agent is very busy right now..."*).

---

## 6. Trade-offs & Future Extensions

- **Local Mock Fallback**: Added a regex/string matching fallback in the LLM service to simulate the store's knowledge base. This is highly useful for local reviewer evaluation without an API key, but in production, we would hook directly to the Claude endpoint.
- **RAG Integration**: For a massive e-commerce store with millions of items, stuffing rules inside the system prompt will overflow token limits. A Vector Database (like `pgvector`) should be used to retrieve only relevant policy chunks.
- **Streaming UI**: Incorporate Server-Sent Events (SSE) or WebSockets to stream Claude tokens token-by-token rather than waiting for the entire block to generate.

---

## 7. Automated Integration Tests

To verify the system end-to-end, we have created an automated integration test suite located at `backend/src/test-runner.ts`. It runs natively using Node.js's built-in `node:test` and `node:assert` runner without external dependencies, compiling on the fly using `ts-node`.

### Test Cases Covered
1. **Health Check (`GET /health`)**: Verifies the API server is up and returning `status: "ok"`.
2. **Empty Message Validation**: Asserts that sending an empty query returns status `400` with the correct error message.
3. **Invalid Session ID Validation**: Asserts that sending a malformed UUID sessionId returns `400`.
4. **Chat Message Resolution (Gemini/Claude)**: Submits a query, validates that it calls the active LLM engine (Google Gemini 2.5 Flash), retrieves a policy-compliant reply, and returns a new session ID.
5. **Contextual Continuity**: Sends a follow-up query using the same session ID to confirm thread history retention works correctly.
6. **Chat History Retrieval (`GET /chat/history/:sessionId`)**: Retrieves saved records from the database (backed by Redis caching) and validates the order and sender tags.
7. **Rate Limiting Protection**: Simulates multiple queries to confirm that the server blocks abuse after 10 requests per minute by returning a `429 Too Many Requests` status code.

### Running the Tests
To run the automated tests against a running dev server:
```bash
# From the root workspace directory
npm run test:backend
```

