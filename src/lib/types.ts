import type { UIMessage } from "ai";

export type ChatMetadata = {
  createdAt?: string;
};

export type ChatUIMessage = UIMessage<ChatMetadata>;

export type HistoryMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
};
