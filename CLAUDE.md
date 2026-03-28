# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server with Turbopack at http://localhost:3000
npm run dev:daemon   # Start dev server in background (logs to logs.txt)

# Build & Production
npm run build        # Optimized production build
npm run start        # Start production server

# Code Quality
npm run lint         # ESLint (Next.js config)
npm run test         # Run Vitest unit tests

# Database
npm run setup        # Install deps + generate Prisma client + run migrations
npm run db:reset     # Reset database (--force flag, destructive)
```

Single test: `npx vitest run <path/to/test.ts>`

## Environment

Copy `.env` and set `ANTHROPIC_API_KEY`. Without it, the app uses a `MockLanguageModel` that generates static demo components — full UI works but no real AI generation.

## Architecture

UIGen is an AI-powered React component generator with live preview. Users describe a component in chat; Claude generates it via tool calls; the result renders in a sandboxed iframe.

### Key Data Flow

```
User prompt → ChatInterface
  → POST /api/chat
    → Claude (claude-haiku-4-5) + tool calling
    → str_replace_editor / file_manager tools mutate VirtualFileSystem
    → onFinish: saves messages + FS to Prisma (authenticated users only)
  ← Streaming response
→ FileSystemContext receives tool results → updates state
→ PreviewFrame re-renders: Babel transforms JSX → iframe with esm.sh CDN imports
```

### Virtual File System (`src/lib/file-system.ts`)

All generated code lives in-memory (Map-based). No disk writes. Serializes to JSON for DB persistence. Key methods: `createFile`, `readFile`, `writeFile`, `deleteFile`, `replaceInFile`, `insertInFile`. The FS is serialized with each chat request so the server can replay tool calls against it.

### AI Tools (`src/lib/tools/`)

Two tools are exposed to Claude:
- **`str_replace_editor`** — view/create/str_replace/insert on files
- **`file_manager`** — rename/delete files and directories

Tool calls from the AI are executed client-side in `FileSystemContext.handleToolCall()` which then updates React state.

### Preview System (`src/lib/transform/jsx-transformer.ts`)

Babel standalone transforms JSX/TSX on the client. An import map maps local module paths and npm packages to `esm.sh` CDN URLs. Output is injected into a sandboxed iframe with React 19 and Tailwind v4 from CDN. Auto-detects entry point (`App.jsx`, `App.tsx`, `index.jsx`, etc.).

### Authentication (`src/lib/auth.ts`, `src/middleware.ts`)

JWT sessions (7-day, httpOnly cookies). Anonymous users get no DB persistence. Authenticated users have projects saved in SQLite via Prisma. Protected routes (`/api/projects`, `/api/filesystem`) are gated by middleware.

### State Management

Two main React contexts in `src/lib/contexts/`:
- **`FileSystemContext`** — owns the VirtualFileSystem instance, handles tool call execution, triggers re-renders on FS changes
- **`ChatContext`** — wraps Vercel AI SDK's `useChat`, manages message state and streaming

### Database (`prisma/schema.prisma`)

SQLite with two models:
- `User` — email + hashed password
- `Project` — name, userId FK, messages (JSON string), data (JSON string = serialized VirtualFS)

### Path Alias

`@/*` → `./src/*` (configured in `tsconfig.json`)

### Mock Provider (`src/lib/provider.ts`)

When `ANTHROPIC_API_KEY` is absent, `MockLanguageModel` simulates multi-step tool calls with delays to generate demo components (Counter, Form, Card). Agentic loop limit: 4 steps (mock) vs 40 steps (real).
