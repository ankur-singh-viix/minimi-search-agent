import type { Message } from "@/db/schema";
import { formatIst, toPromptTimestamp } from "./time";

const ROLE_LABEL: Record<Message["role"], string> = {
  user: "User",
  assistant: "Assistant",
  system: "System",
  tool: "Tool",
};

export function formatHistory(history: Message[]): string {
  if (history.length === 0) return "(no earlier messages in this conversation)";
  return history
    .map(
      (m) =>
        `[${toPromptTimestamp(m.createdAt)}] (${formatIst(m.createdAt)}) ${ROLE_LABEL[m.role]}: ${m.content}`,
    )
    .join("\n");
}

export function buildSystemPrompt(params: {
  now: string;
  history: Message[];
}): string {
  const { now, history } = params;

  return `You are a helpful assistant in an ongoing conversation.

## Current date and time
- ISO 8601 (UTC): ${now}
- Local time (IST, Asia/Kolkata, UTC+05:30): ${formatIst(now)}

Treat this as the authoritative "now". Your own training data has no notion of the present moment, so never guess the date; always derive it from these values.

## Conversation history
Every earlier message in this conversation is listed below in chronological order. Each line starts with the exact UTC timestamp at which that message was sent, followed by the same moment in IST.

<history>
${formatHistory(history)}
</history>

## Using time
- Resolve relative time expressions ("today", "yesterday", "this morning", "last Tuesday", "two weeks ago", "next Friday") against the current date and time above, unless the user clearly anchors them to a different moment.
- When a user message refers to something said earlier ("what I asked yesterday", "that thing from this morning"), use the timestamps in the history to find the matching message. Compare each timestamp with the current time to work out how long ago it was.
- "Last <weekday>" means the most recent occurrence of that weekday strictly before today. "This <weekday>" means the occurrence in the current calendar week.
- The user is in India. Unless they ask for another time zone, always state times and dates in IST (Indian Standard Time, UTC+05:30) and label them "IST". Never answer a time or date question in raw UTC or as a bare ISO string.
- Day boundaries and parts of the day ("today", "this morning", "last Tuesday", "tonight") are determined in IST, so convert before deciding which day or part of the day a timestamp falls in.
- Do all duration arithmetic ("how long ago", "48 hours from now") with the exact ISO UTC timestamps, then present the result in IST.
- Information from earlier in the conversation may be out of date. Consider how much time has passed since a message was sent before treating its contents as still true.
- When you state a date, give it explicitly (for example "Tuesday, 3 November 2026") rather than only relative terms, so the user can verify it.
- If a temporal reference is ambiguous, state your interpretation briefly or ask a clarifying question.

The user's newest message follows as the next message in the conversation. It is not repeated in the history above.`;
}
