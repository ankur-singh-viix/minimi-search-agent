"use client";

import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "seed-1",
    role: "assistant",
    content: "Hello. Ask me anything and I'll do my best to help.",
    createdAt: "2026-01-01T09:00:00.000Z",
  },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <li className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-[22px] px-4 py-2.5 text-[15px] leading-snug ${
          isUser
            ? "bg-[#0a84ff] text-white"
            : "bg-black/[0.06] text-neutral-900 dark:bg-white/10 dark:text-neutral-100"
        }`}
      >
        {message.content}
      </div>
      <time
        dateTime={message.createdAt}
        suppressHydrationWarning
        className="mt-1 px-2 text-[11px] text-neutral-400"
      >
        {formatTime(message.createdAt)}
      </time>
    </li>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft("");
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center justify-center border-b border-black/5 px-4 py-3 backdrop-blur dark:border-white/10">
        <h1 className="text-[15px] font-semibold tracking-tight">Chat</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <ul className="flex flex-col gap-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </ul>
        <div ref={endRef} />
      </main>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-black/5 px-4 py-3 dark:border-white/10"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message"
          aria-label="Message"
          className="flex-1 rounded-full border border-black/10 bg-transparent px-4 py-2.5 text-[15px] outline-none transition placeholder:text-neutral-400 focus:border-[#0a84ff] dark:border-white/15"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0a84ff] text-white transition hover:bg-[#0071e3] disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}
