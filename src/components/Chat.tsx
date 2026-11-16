"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatUIMessage, HistoryMessage } from "@/lib/types";
import { ArrowUpIcon, SidebarIcon, SparkIcon } from "./icons";
import Sidebar from "./Sidebar";

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function messageText(message: ChatUIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}

function toUiMessages(history: HistoryMessage[]): ChatUIMessage[] {
  return history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map<ChatUIMessage>((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text", text: m.content }],
      metadata: { createdAt: m.createdAt },
    }));
}

function MessageRow({ message }: { message: ChatUIMessage }) {
  const text = messageText(message);
  if (!text) return null;

  const isUser = message.role === "user";
  const createdAt = message.metadata?.createdAt;
  const time = createdAt && (
    <time
      dateTime={createdAt}
      title={createdAt}
      suppressHydrationWarning
      className="text-[11px] text-zinc-400 dark:text-zinc-500"
    >
      {formatTime(createdAt)}
    </time>
  );

  if (isUser) {
    return (
      <li className="flex flex-col items-end gap-1">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-zinc-100 px-4 py-2.5 text-[15px] leading-relaxed text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
          {text}
        </div>
        {time}
      </li>
    );
  }

  return (
    <li className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-zinc-700 to-zinc-900 text-white ring-1 ring-black/10 dark:from-zinc-200 dark:to-zinc-400 dark:text-zinc-900">
        <SparkIcon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
          {text}
        </div>
        <div className="mt-1">{time}</div>
      </div>
    </li>
  );
}

export default function Chat() {
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/history", { cache: "no-store" });
      if (!response.ok) return;
      setHistory((await response.json()) as HistoryMessage[]);
    } catch {
      return;
    }
  }, []);

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

  const { messages, setMessages, sendMessage, status, error, clearError, stop } =
    useChat<ChatUIMessage>({
      transport,
      onFinish: () => {
        void refreshHistory();
      },
    });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: HistoryMessage[] | null) => {
        if (cancelled) return;
        if (data) {
          setHistory(data);
          setMessages((current) =>
            current.length > 0 ? current : toUiMessages(data),
          );
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setMessages]);

  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const waitingForText =
    status === "submitted" ||
    (status === "streaming" &&
      lastMessage?.role === "assistant" &&
      messageText(lastMessage) === "");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    sendMessage({ text, metadata: { createdAt: new Date().toISOString() } });
    setDraft("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  }

  async function clearHistory() {
    const response = await fetch("/api/history", { method: "DELETE" });
    if (!response.ok) return;
    await stop();
    clearError();
    setMessages([]);
    setHistory([]);
    await refreshHistory();
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      {sidebarOpen && (
        <div className="hidden md:block">
          <Sidebar messages={history} onClear={clearHistory} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200/80 px-3 backdrop-blur-xl dark:border-white/10">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 md:flex dark:hover:bg-white/10 dark:hover:text-zinc-100"
          >
            <SidebarIcon className="h-[18px] w-[18px]" />
          </button>
          <h1 className="flex-1 text-center text-[13px] font-semibold tracking-tight text-zinc-700 md:pr-8 dark:text-zinc-300">
            Chat
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-8">
            {messages.length === 0 && !loaded ? null : messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-white/10">
                  <SparkIcon className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">How can I help?</h2>
                <p className="max-w-sm text-[14px] text-zinc-500">
                  I remember what we have talked about and when, and I can look up
                  what is happening now.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-7">
                {messages.map((m) => (
                  <MessageRow key={m.id} message={m} />
                ))}
              </ul>
            )}

            {waitingForText && (
              <p className="mt-6 pl-10 text-[13px] text-zinc-400" aria-live="polite">
                Thinking...
              </p>
            )}
            {error && (
              <p role="alert" className="mt-6 pl-10 text-[13px] text-red-500">
                Something went wrong. Please try again.
              </p>
            )}
            <div ref={endRef} />
          </div>
        </main>

        <div className="shrink-0 px-5 pb-5 pt-2">
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-zinc-200 bg-white/80 p-2 pl-4 shadow-lg shadow-black/5 backdrop-blur-xl transition focus-within:border-zinc-300 dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-black/40 dark:focus-within:border-white/20"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Message"
              aria-label="Message"
              className="max-h-40 min-h-9 flex-1 resize-none self-center bg-transparent py-1.5 text-[15px] leading-snug [field-sizing:content] outline-none placeholder:text-zinc-400"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:opacity-25 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <ArrowUpIcon className="h-[18px] w-[18px]" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
