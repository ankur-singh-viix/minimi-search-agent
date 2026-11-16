import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import {
  APICallError,
  createUIMessageStreamResponse,
  generateId,
  streamText,
  toUIMessageStream,
  type TextStreamPart,
  type ToolSet,
} from "ai";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { buildSystemPrompt } from "@/lib/prompt";
import { isStrictIso, nowIso } from "@/lib/time";
import type { ChatUIMessage } from "@/lib/types";

export const maxDuration = 60;

const MAX_TITLE_LENGTH = 60;
const PRIMARY_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";
const FIRST_TOKEN_TIMEOUT_MS = 15_000;
const CAPACITY_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

type StreamPart = TextStreamPart<ToolSet>;

class FirstTokenTimeoutError extends Error {
  constructor() {
    super("Model did not start responding in time");
  }
}

function isCapacityError(error: unknown): boolean {
  if (error instanceof FirstTokenTimeoutError) return true;
  if (!APICallError.isInstance(error)) return false;
  return (
    error.statusCode !== undefined && CAPACITY_STATUS_CODES.has(error.statusCode)
  );
}

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { message, conversationId } = (body ?? {}) as {
    message?: unknown;
    conversationId?: unknown;
  };

  if (typeof message !== "string" || message.trim() === "") {
    return badRequest("`message` must be a non-empty string");
  }
  if (conversationId !== undefined && conversationId !== null && typeof conversationId !== "string") {
    return badRequest("`conversationId` must be a string");
  }

  const userText = message.trim();
  let activeConversationId: string;

  if (typeof conversationId === "string" && conversationId !== "") {
    const existing = db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();
    if (!existing) return badRequest("Conversation not found", 404);
    activeConversationId = existing.id;
  } else {
    const createdAt = nowIso();
    const [created] = db
      .insert(conversations)
      .values({
        title: userText.slice(0, MAX_TITLE_LENGTH),
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: conversations.id })
      .all();
    activeConversationId = created.id;
  }

  const userCreatedAt = nowIso();
  const [userRow] = db
    .insert(messages)
    .values({
      conversationId: activeConversationId,
      role: "user",
      content: userText,
      createdAt: userCreatedAt,
    })
    .returning()
    .all();

  const history = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, activeConversationId))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .all()
    .filter((m) => m.id !== userRow.id);

  const systemPrompt = buildSystemPrompt({ now: nowIso(), history });
  const assistantCreatedAt = nowIso();

  const saveAssistantMessage = (text: string) => {
    if (!text) return;
    if (!isStrictIso(assistantCreatedAt)) return;
    db.insert(messages)
      .values({
        conversationId: activeConversationId,
        role: "assistant",
        content: text,
        createdAt: assistantCreatedAt,
      })
      .run();
    db.update(conversations)
      .set({ updatedAt: nowIso() })
      .where(eq(conversations.id, activeConversationId))
      .run();
  };

  const openStream = async (modelId: string) => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, FIRST_TOKEN_TIMEOUT_MS);

    const result = streamText({
      model: google(modelId),
      maxRetries: 0,
      abortSignal: controller.signal,
      providerOptions: {
        google: {
          thinkingConfig: { thinkingLevel: "low" },
        } satisfies GoogleLanguageModelOptions,
      },
      instructions: systemPrompt,
      messages: [{ role: "user", content: userText }],
      onEnd: ({ text }) => saveAssistantMessage(text),
    });

    const iterator = result.stream[Symbol.asyncIterator]();
    const head: StreamPart[] = [];
    let failure: unknown;

    try {
      for (;;) {
        const { done, value } = await iterator.next();
        if (done) break;
        head.push(value);
        if (value.type === "error") {
          failure = value.error;
          break;
        }
        if (value.type === "abort") break;
        if (value.type === "text-delta") break;
      }
    } catch (error) {
      failure = error;
    } finally {
      clearTimeout(timer);
    }

    if (timedOut) failure = new FirstTokenTimeoutError();

    const stream = new ReadableStream<StreamPart>({
      start(controller) {
        for (const part of head) controller.enqueue(part);
      },
      async pull(controller) {
        const { done, value } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      async cancel() {
        await iterator.return?.();
      },
    });

    return { stream, failure };
  };

  let opened = await openStream(PRIMARY_MODEL);
  if (opened.failure !== undefined && isCapacityError(opened.failure)) {
    opened = await openStream(FALLBACK_MODEL);
  }

  const originalMessages: ChatUIMessage[] = [];

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: opened.stream,
      originalMessages,
      generateMessageId: generateId,
      messageMetadata: ({ part }) => {
        if (part.type === "start") {
          return {
            conversationId: activeConversationId,
            createdAt: assistantCreatedAt,
          };
        }
      },
      onError: () => "Something went wrong while generating a response.",
    }),
  });
}
