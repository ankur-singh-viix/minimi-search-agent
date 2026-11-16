import { connection } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import type { HistoryMessage } from "@/lib/types";

export async function GET() {
  await connection();

  const all: HistoryMessage[] = db
    .select()
    .from(messages)
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .all();

  return Response.json(all, { headers: { "cache-control": "no-store" } });
}

export async function DELETE() {
  await connection();
  db.delete(messages).run();
  return Response.json({ ok: true });
}
