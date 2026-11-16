# Design

A single-timeline chat agent that knows what time it is and what was said when. Memory is a chronological log injected into the prompt; the one allowed tool is live web search.

## Architecture and how it works

```
Browser (useChat, hydrated from GET /api/history)
  -> POST /api/chat { message }
       1. insert user message                                       (SQLite, ISO UTC)
       2. load the entire message table by created_at, excluding this turn
       3. build system prompt: now (UTC + IST) + timestamped history + rules
       4. streamText: primary model -> fallback model, tool = webSearch, max 3 steps
       5. stream UI parts back; on end, insert assistant message    (SQLite, ISO UTC)
```

**Storage.** `better-sqlite3` with Drizzle. One flat `messages` table (`id`, `role`, `content`, `created_at`) is the agent's single continuous timeline: no threads, no sessions. `created_at` is text in strict ISO 8601 UTC, enforced by a SQLite `CHECK (created_at GLOB 'YYYY-MM-DDTHH:MM:SS*Z')`, so ordering and arithmetic never meet a malformed value. The assistant row is stamped when the reply starts, so it always sorts after the user row it answers.

**Temporal context injection.** Every request rebuilds the system prompt from scratch with:
- the current time as exact ISO UTC and as IST (`Asia/Kolkata`), e.g. `Monday, 16 Nov 2026, 1:15 PM IST`;
- the full prior history, one line per message: `[2026-11-16T04:02:00Z] (Monday, 16 Nov 2026, 9:32 AM IST) User: ...`;
- rules for resolving "last Tuesday", "this morning" and "48 hours ago": day boundaries are decided in IST, durations are computed on the UTC timestamps, answers are given in IST.

Memory is passive context, not a tool. That keeps the single allowed tool slot free for search.

**Web search.** `webSearch` calls Tavily (`basic` depth, 5 results) and returns snippets plus `retrievedAt`. A missing key, an API error or the 10 s timeout all come back as a tool result, never as an exception, so the model can tell the user search was unavailable. `isStepCount(3)` allows call, read results, synthesize. For "has X changed since we last talked?" the prompt tells the model to find the earlier mention in the history, search for the present state, and compare the two points in time explicitly.

**Streaming and resilience.** The server reads up to the model's first sign of life (first text or tool call) under a 15 s abort timer, then clears the timer so long answers and the search call are never cut off. A timeout or a 429/5xx falls over once, `gemini-3.5-flash-lite` to `gemini-3.1-flash-lite`, both with `thinkingLevel: 'low'` and `maxRetries: 0`. Measured locally: a plain answer starts in about 1.5 s, a search turn finishes in about 3 s. The worst case, both models stalling, is about 30 s before a normal error message.

## Why I built it this way

- **SQLite for zero-config local execution.** `npm install` creates the database file and `npm run dev` just works: no Docker, no Postgres, no hosted service. Synchronous writes are fast enough that they never show up in latency.
- **Prompt injection spends no tool.** History in the prompt costs zero tool calls and zero extra round trips, and leaves the only slot for what the model cannot know: the live web. Chronological injection also gives exact timestamp fidelity, so temporal questions are lookups and subtraction, not guesses.
- **UTC in storage, IST at the edges.** UTC sorts and subtracts reliably; IST is what the user means by "this morning". The model gets both and is told which to use for what.
- **A first-token timer to get around Google 503s.** Free-tier capacity errors arrive slowly, 4 to 60 s in testing, and the SDK's default retries compound them into minutes. Failing in 15 s onto a second model turns a multi-minute hang into a short delay.
- **One continuous thread.** minimi's idea is an ambient, always-on assistant on the Mac. A "New Chat" button is a ritual that fragments memory and breaks "since we last talked". One timeline, hydrated on load, matches that model: you do not start a conversation, you just continue it.

## Considered and rejected

- **Vector DB / RAG for memory.** Semantic similarity cannot do exact temporal math. "What did I ask 48 hours ago?" is a range query on time, not nearest-neighbour on meaning, and retrieval adds an embedding model, an index and a chance of missing the exact message that matters.
- **A `search_memory` tool.** It would spend the only tool slot on something a prompt can do, and add a model round trip to every recall.
- **A whole-request timeout.** `AbortSignal.timeout(15000)` would kill any answer that streams longer than 15 s. The timer covers only time to first token.
- **Per-conversation threads.** A thread id on every message would split memory into silos. One flat, ordered table keeps recall global.
- **Client-held history.** Timestamps would come from browser clocks and history would vanish on refresh. The server owns time and storage; the client sends only the new message.

## With another week

- **Sliding-window compaction.** The whole history is injected today, which is exact but grows without bound. Keep the last N messages verbatim with timestamps, replace older spans with dated summaries, and keep full text in SQLite for on-demand expansion.
- **Proactive entity extraction.** In the background, pull dated entities and commitments ("flight on Friday", "following Postgres pricing") into a table, and drive native macOS notifications that nudge the user or re-check a topic without being asked.
- **Tests and evals.** A fixed-clock harness for the prompt builder and a small suite of temporal questions ("last Tuesday", "48 hours from now") run against a pinned model.
