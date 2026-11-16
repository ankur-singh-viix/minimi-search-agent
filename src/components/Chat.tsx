"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatUIMessage } from "@/lib/types";

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function messageText(message: ChatUIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

function MessageBubble({ message }: { message: ChatUIMessage }) {
  const isUser = message.role === "user";
  const createdAt = message.metadata?.createdAt;
  const text = messageText(message);
  if (!text) return null;
  return (
    <li className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-[22px] px-4 py-2.5 text-[15px] leading-snug ${
          isUser
            ? "bg-[#0a84ff] text-white"
            : "bg-black/[0.06] text-neutral-900 dark:bg-white/10 dark:text-neutral-100"
        }`}
      >
        {text}
      </div>
      {createdAt && (
        <time
          dateTime={createdAt}
          title={createdAt}
          suppressHydrationWarning
          className="mt-1 px-2 text-[11px] text-neutral-400"
        >
          {formatTime(createdAt)}
        </time>
      )}
    </li>
  );
}

export default function Chat() {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages[messages.length - 1];
          return {
            body: {
              ...body,
              message: last ? messageText(last) : "",
            },
          };
        },
      }),
  );

  const { messages, sendMessage, status, error } = useChat<ChatUIMessage>({
    transport,
  });

  const conversationId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const id = messages[i].metadata?.conversationId;
      if (id) return id;
    }
    return undefined;
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    sendMessage(
      { text, metadata: { createdAt: new Date().toISOString() } },
      { body: { conversationId } },
    );
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
        {status === "submitted" && (
          <p className="mt-4 px-2 text-[13px] text-neutral-400">Thinking...</p>
        )}
        {error && (
          <p role="alert" className="mt-4 px-2 text-[13px] text-red-500">
            Something went wrong. Please try again.
          </p>
        )}
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
          disabled={busy || !draft.trim()}
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
