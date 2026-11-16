"use client";

import { useState } from "react";
import type { HistoryMessage } from "@/lib/types";
import { TrashIcon } from "./icons";

type SidebarProps = {
  messages: HistoryMessage[];
  onClear: () => Promise<void>;
};

function dayLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

function timeLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function Sidebar({ messages, onClear }: SidebarProps) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  const visible = messages.filter((m) => m.role === "user" || m.role === "assistant");

  async function handleClear() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setClearing(true);
    try {
      await onClear();
    } finally {
      setClearing(false);
      setConfirming(false);
    }
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-200/80 bg-zinc-100/80 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/80">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          History
        </h2>
        <span className="text-[11px] text-zinc-400">
          {visible.length} {visible.length === 1 ? "message" : "messages"}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Message history">
        {visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-zinc-400">
            No messages yet
          </p>
        ) : (
          <ul className="flex flex-col">
            {visible.map((m, index) => {
              const day = dayLabel(m.createdAt);
              const previous = index > 0 ? visible[index - 1] : undefined;
              const showDay = !previous || dayLabel(previous.createdAt) !== day;
              return (
                <li key={m.id}>
                  {showDay && (
                    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold text-zinc-500">
                      {day}
                    </p>
                  )}
                  <div className="flex flex-col gap-0.5 rounded-xl px-3 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-zinc-500">
                        {m.role === "user" ? "You" : "Assistant"}
                      </span>
                      <time
                        dateTime={m.createdAt}
                        title={m.createdAt}
                        className="text-[11px] text-zinc-400"
                      >
                        {timeLabel(m.createdAt)}
                      </time>
                    </div>
                    <p className="line-clamp-2 text-[13px] leading-snug text-zinc-800 dark:text-zinc-200">
                      {m.content}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-zinc-200/80 p-3 dark:border-white/10">
        <button
          type="button"
          onClick={handleClear}
          onBlur={() => setConfirming(false)}
          disabled={clearing || (visible.length === 0 && !confirming)}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition disabled:opacity-40 ${
            confirming
              ? "bg-red-500 text-white hover:bg-red-600"
              : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-white/10"
          }`}
        >
          <TrashIcon className="h-4 w-4" />
          {clearing ? "Clearing..." : confirming ? "Click again to confirm" : "Clear history"}
        </button>
      </div>
    </aside>
  );
}
