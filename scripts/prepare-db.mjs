import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

const columns = db.prepare("PRAGMA table_info(messages)").all();
const hasLegacyColumn = columns.some((column) => column.name === "conversation_id");

if (hasLegacyColumn) {
  db.pragma("foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    db.exec(`
      ALTER TABLE messages RENAME TO messages_legacy;
      CREATE TABLE messages (
        id text PRIMARY KEY NOT NULL,
        role text NOT NULL,
        content text NOT NULL,
        created_at text NOT NULL,
        CONSTRAINT "messages_created_at_iso" CHECK("messages"."created_at" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]*Z')
      );
      INSERT INTO messages (id, role, content, created_at)
        SELECT id, role, content, created_at FROM messages_legacy ORDER BY created_at, id;
      DROP TABLE messages_legacy;
      DROP TABLE IF EXISTS conversations;
      CREATE INDEX messages_created_idx ON messages (created_at);
    `);
    db.exec("COMMIT");
    const { n } = db.prepare("SELECT count(*) AS n FROM messages").get();
    console.log(`Flattened message history into a single timeline (${n} messages kept).`);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

db.close();
