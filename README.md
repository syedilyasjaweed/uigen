# UIGen

An AI-powered React component generator with live preview. Describe a UI component in plain English, and Claude generates the code instantly — visible in a sandboxed preview alongside a full code editor.

## Features

- **AI component generation** — Chat with Claude to create React components from natural language descriptions
- **Live preview** — Generated components render instantly in a sandboxed iframe with React 19 and Tailwind CSS v4
- **Code editor** — Monaco-based editor with syntax highlighting; edit generated files directly
- **Virtual file system** — All generated code lives in-memory; nothing is written to disk
- **Iterative refinement** — Continue the conversation to update, extend, or redesign components
- **Project persistence** — Authenticated users have their projects (chat history + file system) saved to a local SQLite database
- **Works without an API key** — A mock provider generates demo components so the full UI is usable without Anthropic credentials

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| AI | Anthropic Claude (`claude-haiku-4-5`) via Vercel AI SDK |
| Code editor | Monaco Editor |
| JSX transform | Babel standalone (client-side) |
| Preview | Sandboxed iframe + [esm.sh](https://esm.sh) CDN imports |
| UI components | Radix UI + shadcn/ui |
| Database | Prisma 6 + SQLite |
| Auth | JWT (`jose`) + bcrypt |
| Testing | Vitest + React Testing Library |
| Build | Turbopack |

## Prerequisites

- Node.js 18+
- npm

## Setup

1. Copy `.env` and add your Anthropic API key:

   ```bash
   cp .env .env.local
   ```

   ```
   ANTHROPIC_API_KEY=your-api-key-here
   ```

   The API key is optional. Without it, the app uses a `MockLanguageModel` that returns static demo components (Counter, Form, Card) so you can explore the full interface.

2. Install dependencies, generate the Prisma client, and run database migrations:

   ```bash
   npm run setup
   ```

## Running the Application

```bash
# Development (http://localhost:3000)
npm run dev

# Production
npm run build
npm start
```

## Usage

1. Open [http://localhost:3000](http://localhost:3000)
2. Sign up for an account or continue as an anonymous user
3. Type a description of the component you want — e.g., *"A signup form with email and password fields"*
4. Watch the component generate in real-time in the **Preview** panel
5. Switch to **Code** view to browse and edit the generated files
6. Keep chatting to iterate on the component

Anonymous sessions are not persisted. Sign up to save projects across sessions.

## Available Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run dev:daemon   # Start dev server in background (logs to logs.txt)
npm run build        # Production build
npm start            # Start production server
npm run lint         # Run ESLint
npm run test         # Run Vitest unit tests
npm run setup        # Install deps + generate Prisma client + run migrations
npm run db:reset     # Reset the database (destructive)
```

## Architecture

```
User prompt → ChatInterface
  → POST /api/chat
    → Claude (claude-haiku-4-5) with tool calling
    → str_replace_editor / file_manager tools mutate VirtualFileSystem
    → onFinish: saves messages + FS to Prisma (authenticated users only)
  ← Streaming response
→ FileSystemContext receives tool results → updates state
→ PreviewFrame re-renders: Babel transforms JSX → iframe renders component
```

**Key modules:**

- `src/lib/file-system.ts` — Map-based in-memory virtual file system; serializes to JSON for DB persistence
- `src/lib/tools/` — Two AI tools: `str_replace_editor` (view/create/edit files) and `file_manager` (rename/delete)
- `src/lib/transform/jsx-transformer.ts` — Client-side Babel transform; maps local imports and npm packages to esm.sh CDN URLs
- `src/lib/provider.ts` — Returns the Anthropic model, or `MockLanguageModel` when `ANTHROPIC_API_KEY` is absent
- `src/lib/auth.ts` — JWT session management (7-day httpOnly cookies)
- `src/lib/contexts/` — `FileSystemContext` (FS state + tool execution) and `ChatContext` (Vercel AI SDK `useChat` wrapper)

## Database

SQLite via Prisma with two models:

- **User** — email + hashed password
- **Project** — name, owner (optional), chat messages (JSON), serialized virtual file system (JSON)

To reset the database:

```bash
npm run db:reset
```
