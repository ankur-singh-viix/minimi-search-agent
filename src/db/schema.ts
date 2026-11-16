import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

const ISO_PATTERN =
  "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]*Z";

const nowIso = () => new Date().toISOString();

export const messages = sqliteTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    role: text("role", { enum: ["user", "assistant", "system", "tool"] }).notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [
    index("messages_created_idx").on(t.createdAt),
    check("messages_created_at_iso", sql`${t.createdAt} GLOB '${sql.raw(ISO_PATTERN)}'`),
  ],
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
