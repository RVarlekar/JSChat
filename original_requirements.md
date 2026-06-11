# Original Take-Home Assignment Requirements: Spur AI Live Chat Agent

This document lists the original requirements for the Founding Full-Stack Engineer take-home assignment as specified in the hiring document.

---

## Context & Goal
Build a small web app that simulates a customer support chat where an AI agent answers user questions using a real LLM API (OpenAI / Claude / etc.).

### Tech Stack Preference
* **Backend**: Node.js + TypeScript
* **Frontend**: Svelte (or React/Vue/etc. if faster)
* **Database**: PostgreSQL (or simple SQL DB like SQLite)
* **Cache**: Redis (optional, nice-to-have)

---

## Functional Requirements

### 1. Chat UI (Frontend)
* Simple live chat interface.
* Scrollable message list.
* Clear distinction between user and AI messages.
* Input box + send button (Enter should also trigger send).
* Auto-scroll to the latest message.
* Basic UX: Disabled send button while request is in flight, and an optional "Agent is typing..." indicator.

### 2. Backend API
* TypeScript backend server.
* Expose at least:
  * `POST /chat/message` — accepts `{ message: string, (optional) sessionId: string }`, returns `{ reply: string, sessionId: string }`
* The backend should:
  * Persist every message (user + AI) to a database.
  * Associate messages with a session/conversation.
  * Call a real LLM API to generate the reply.

### 3. LLM Integration
* Integrate with any major LLM provider (OpenAI, Anthropic / Claude, etc.).
* Use an API key via environment variables (no hardcoded secrets).
* Wrap the LLM call behind a function/service, e.g., `generateReply(history, userMessage)`.
* Include conversation history so replies are contextual.
* Graceful error handling (timeouts, invalid keys, rate limits) returning friendly messages to the user.

### 4. FAQ / Domain Knowledge
* Seed the agent with basic domain knowledge about a fictional store (Shipping policy, Return/refund policy, Support hours).
* Can be hardcoded in the system prompt or stored in the database.
* The AI should answer these FAQs reliably.

### 5. Data Model & Persistence
* Persist at least:
  * `conversations` (id, createdAt, metadata)
  * `messages` (id, conversationId, sender: "user" | "ai", text, timestamp)
* On reload:
  * Given a `sessionId` (or `conversationId`), fetch past messages and render the history.
  * No user authentication required.

### 6. Robustness & Input Validation
* Validate inputs (no empty messages, truncate/warn on very long messages).
* The backend should never crash on bad inputs.
* LLM/API failures caught and surfaced as clean errors in the UI.

---

## Non-Requirements
* No real Shopify / Facebook / Instagram / WhatsApp integrations.
* No auth/login.
* No fancy design system.
* No Kubernetes / Docker orchestration.

---

## Submission Deliverables
* GitHub repository link (public) with all source code.
* Clear instructions to run the backend and frontend locally.
* Deployed project URL.
* `README.md` must include: local run steps, DB setup (migrations/seed), environment variables config, architecture overview, LLM prompting/guardrails, and trade-offs.
