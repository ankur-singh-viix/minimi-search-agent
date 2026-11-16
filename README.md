# Minimi Search Agent

A Mac-native, continuous chat agent with exact temporal memory and live web search.

It keeps one unbroken timeline of everything you have said to it, stamped to the second. Ask "what did I ask yesterday morning?" or "has this changed since we last talked?" and it answers from real timestamps, then checks the live web when the answer depends on what is true now.

## Key features

- **Continuous temporal memory.** Every message is stored in SQLite with a strict ISO 8601 UTC timestamp. On each turn the full history is injected into the system prompt, formatted with both the exact UTC time (for duration math) and IST (`Asia/Kolkata`, for how people actually say "this morning").
- **Live web search.** A single `webSearch` tool backed by the Tavily API, which respects the one-tool constraint. Memory is passive prompt context, not a tool, so the only tool slot goes to the thing the model cannot know.
- **Mac-native UI.** One continuous timeline: no threads, no "New Chat" fragmentation. A translucent sidebar shows a chronological log with a Clear History action; the main pane streams replies. Light and dark mode follow the system.
- **Fast, resilient responses.** A first-token abort timer (15 s) wraps each model call and falls over from `gemini-3.5-flash-lite` to `gemini-3.1-flash-lite` on a timeout or a 429/5xx. In local testing a plain answer starts in about 1.5 s and a search turn completes in about 3 s.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router), React, TypeScript |
| LLM orchestration | Vercel AI SDK (`streamText`, `useChat`) with `@ai-sdk/google` |
| Storage | SQLite via `better-sqlite3`, Drizzle ORM |
| Styling | Tailwind CSS |
| Search | Tavily API |

## Quick start

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
```

Add your keys to `.env.local`:

```
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-studio-key
TAVILY_API_KEY=your-tavily-key
```

Then start the app:

```bash
npm run dev
```

Open http://localhost:3000.

No database setup is needed. `npm install` creates the local SQLite file at `data/app.db` through the `db:push` script. If you ever need to re-apply the schema, run `npm run db:push`; it is safe to repeat, and it also migrates databases created by earlier versions of this project into the single-timeline schema.

Without `TAVILY_API_KEY` the agent still works. Search returns an "unavailable" result and the model answers from memory, saying so.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run db:push` | Create or migrate the local SQLite schema |
| `npm run db:studio` | Browse the database with Drizzle Studio |
| `npm run lint` | Lint the project |

## Project layout

```
src/app/api/chat      POST: store message, build temporal prompt, stream reply
src/app/api/history   GET: full timeline; DELETE: clear it
src/lib/prompt.ts     system prompt: current time, timestamped history, rules
src/lib/webSearch.ts  the single Tavily search tool
src/lib/time.ts       ISO validation and IST formatting
src/db                Drizzle schema and SQLite client
src/components        Chat, Sidebar
scripts/prepare-db.mjs  one-time flattening migration used by db:push
```

## Limits

- Single user, single timeline, no authentication.
- The whole history is injected into every prompt. That is exact, but it grows with use; see [DESIGN.md](DESIGN.md) for the compaction plan.
- Model names target Google's free tier and may need updating as Google retires models.

See [DESIGN.md](DESIGN.md) for architecture and the reasoning behind it.
