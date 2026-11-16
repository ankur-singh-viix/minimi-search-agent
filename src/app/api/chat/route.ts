import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import {
  APICallError,
  createUIMessageStreamResponse,
  generateId,
  isStepCount,
  streamText,
  toUIMessageStream,
  type TextStreamPart,
  type ToolSet,
} from "ai";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { buildSystemPrompt } from "@/lib/prompt";
import { webSearch } from "@/lib/webSearch";
import { isStrictIso, nowIso } from "@/lib/time";
import type { ChatUIMessage } from "@/lib/types";

export const maxDuration = 60;

const PRIMARY_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";
const FIRST_TOKEN_TIMEOUT_MS = 15_000;
const MAX_STEPS = 3;
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

  const { message } = (body ?? {}) as { message?: unknown };

  if (typeof message !== "string" || message.trim() === "") {
    return badRequest("`message` must be a non-empty string");
  }

  const userText = message.trim();

  const [userRow] = db
    .insert(messages)
    .values({
      role: "user",
      content: userText,
      createdAt: nowIso(),
    })
    .returning()
    .all();

  const history = db
    .select()
    .from(messages)
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
        role: "assistant",
        content: text,
        createdAt: assistantCreatedAt,
      })
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
      tools: { webSearch },
      stopWhen: isStepCount(MAX_STEPS),
      providerOptions: {
        google: {
          thinkingConfig: { thinkingLevel: "low" },
        } satisfies GoogleLanguageModelOptions,
      },
      instructions: systemPrompt,
      messages: [{ role: "user", content: userText }],
      onEnd: ({ steps }) =>
        saveAssistantMessage(
          steps
            .map((step) => step.text.trim())
            .filter(Boolean)
            .join("\n\n"),
        ),
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
        if (
          value.type === "text-delta" ||
          value.type === "tool-input-start" ||
          value.type === "tool-call"
        ) {
          break;
        }
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
          return { createdAt: assistantCreatedAt };
        }
      },
      onError: () => "Something went wrong while generating a response.",
    }),
  });
}
