# Chat App — Project Overview

> Last updated: 2026-04-12

## What Is This

A standalone 1-to-1 real-time chat application. Users register with email, password, and a unique username, then chat privately with other users.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 7, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), Zustand |
| **Backend** | Express.js 5, plain JavaScript, Joi validation |
| **Database** | PostgreSQL (Supabase-hosted) via `pg` |
| **Auth** | Single JWT (7 days), bcrypt |
| **Real-time** | Socket.IO (bidirectional WebSocket) |
| **Monorepo** | Turborepo (frontend only — `apps/web` + `packages/ui`) |

## Project Structure

```
chat-app/
├── docs/                        # Project documentation
├── backend/                     # Express.js API server
│   ├── src/
│   │   ├── index.js             # Entry point
│   │   ├── config/              # DB pool, auth constants
│   │   ├── middleware/          # Auth, validation, error handling
│   │   ├── routes/              # HTTP route definitions (auth, users, history)
│   │   ├── socket/             # Socket.IO handlers (messages, typing, read)
│   │   ├── services/            # Business logic
│   │   ├── repositories/       # SQL queries
│   │   ├── validators/         # Joi schemas
│   │   └── utils/              # ApiError, pagination helpers
│   └── .env                     # DATABASE_URL, JWT secrets, PORT
├── frontend/
│   ├── apps/web/                # Main React app (Vite)
│   │   └── src/
│   │       ├── pages/           # LoginPage, RegisterPage, ChatPage
│   │       ├── components/      # auth/, chat/, users/, layout/
│   │       ├── hooks/           # useAuth, useConversations, useMessages, useSocket
│   │       ├── stores/          # Zustand (authStore, chatStore)
│   │       └── lib/             # API client, types
│   └── packages/ui/             # Shared shadcn/ui components
```

## Architecture Decisions

### Why Socket.IO
A chat app needs frequent bidirectional communication — send messages, typing indicators, read receipts, presence. Socket.IO handles all of this over a single persistent connection with built-in reconnection, rooms (map 1:1 to conversations), and ack callbacks (confirm message delivery). REST endpoints remain for initial data loading (auth, conversation list, message history).

### Why Zustand over Redux
Redux is overkill for a single-domain app. Zustand gives us a global store with zero boilerplate, no providers, and built-in devtools. Two stores (`authStore` + `chatStore`) cover all state needs.

### Why Junction Table for Conversations
Instead of `sender_id`/`receiver_id` on messages, we use `conversations` + `conversation_participants`. This makes read receipts, conversation listing, unread counts, and future group chat support straightforward.

### Why No Encryption in Phase 1
AES-256-GCM encryption at rest adds significant complexity (key management, rotation, per-message IV). The database is already behind Supabase's infrastructure security. Encryption is planned for Phase 3 once core features are stable.

## Database Schema

Four tables: `users`, `conversations`, `conversation_participants`, `messages`. Full schema in `docs/features.md`.

## Running Locally

```bash
# Backend
cd backend
cp .env.example .env   # Fill in DATABASE_URL, JWT_SECRET
npm install
npm run dev             # http://localhost:3000

# Frontend
cd frontend
npm install
npm run dev             # http://localhost:5173
```
