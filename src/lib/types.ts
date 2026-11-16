import type { UIMessage } from "ai";

export type ChatMetadata = {
  createdAt?: string;
  conversationId?: string;
};

export type ChatUIMessage = UIMessage<ChatMetadata>;
