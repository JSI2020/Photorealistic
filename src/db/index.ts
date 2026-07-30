import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

type AppDb = BetterSQLite3Database<typeof schema>;

let _db: AppDb | null = null;

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? "file:./data/photoreal.db";
  const filePath = raw.startsWith("file:") ? raw.slice("file:".length) : raw;
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
}

function createDb(): AppDb {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS designs (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT,
      description TEXT,
      shirt_colour TEXT,
      trouser_colour TEXT,
      fabric TEXT,
      sketch_urls_json TEXT NOT NULL DEFAULT '[]',
      old_design_url TEXT,
      persona_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      total_cost REAL NOT NULL DEFAULT 0,
      saved INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS design_versions (
      id TEXT PRIMARY KEY NOT NULL,
      design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
      parent_version_id TEXT,
      image_url TEXT NOT NULL,
      prompt TEXT NOT NULL,
      negative_prompt TEXT,
      seed INTEGER,
      model_id TEXT NOT NULL,
      feedback TEXT,
      cost_usd REAL NOT NULL DEFAULT 0,
      request_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      persona_description TEXT,
      seed INTEGER,
      lock_seed INTEGER NOT NULL DEFAULT 1,
      generate_model TEXT NOT NULL DEFAULT 'nano-banana-edit',
      refine_model TEXT NOT NULL DEFAULT 'nano-banana-edit',
      preferred_house_model_id TEXT NOT NULL DEFAULT 'random',
      monthly_spend_reminder_usd REAL,
      updated_at INTEGER NOT NULL
    );
  `);

  try {
    sqlite.exec(
      `ALTER TABLE app_settings ADD COLUMN preferred_house_model_id TEXT NOT NULL DEFAULT 'random'`,
    );
  } catch {
    // column already exists
  }

  return drizzle(sqlite, { schema });
}

/** Lazily open SQLite only when an API route actually needs it. */
export function getDb(): AppDb {
  if (!_db) _db = createDb();
  return _db;
}

/** Back-compat export used across the codebase. */
export const db = new Proxy({} as AppDb, {
  get(_t, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});
