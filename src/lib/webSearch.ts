import { tool } from "ai";
import { z } from "zod";
import { nowIso } from "./time";

const TAVILY_URL = "https://api.tavily.com/search";
const SEARCH_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;
const MAX_SNIPPET_CHARS = 1200;

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
};

type SearchOutput =
  | {
      query: string;
      retrievedAt: string;
      results: { title: string; url: string; snippet: string; publishedDate?: string }[];
    }
  | { query: string; retrievedAt: string; error: string };

export async function runWebSearch(query: string): Promise<SearchOutput> {
  const retrievedAt = nowIso();
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return { query, retrievedAt, error: "Web search is not configured on the server." };
  }

  try {
    const response = await fetch(TAVILY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: MAX_RESULTS,
      }),
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        query,
        retrievedAt,
        error: `Search provider returned status ${response.status}.`,
      };
    }

    const data = (await response.json()) as { results?: TavilyResult[] };
    const results = (data.results ?? []).slice(0, MAX_RESULTS).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: (r.content ?? "").slice(0, MAX_SNIPPET_CHARS),
      ...(r.published_date ? { publishedDate: r.published_date } : {}),
    }));

    return { query, retrievedAt, results };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      query,
      retrievedAt,
      error: timedOut ? "Search timed out." : "Search request failed.",
    };
  }
}

export const webSearch = tool({
  description:
    "Search the web for current or external information. Returns titles, URLs and snippets, plus the exact time the search ran.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("The search query to look up current or external information"),
  }),
  execute: async ({ query }) => runWebSearch(query),
});
