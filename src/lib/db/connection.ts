/**
 * Database connection singleton.
 *
 * Uses better-sqlite3 for synchronous SQLite access.
 * The database file is stored in the project root as cassper.db.
 *
 * In production (Vercel/serverless), this would need to be replaced
 * with @vercel/postgres or Turso. The repository pattern makes that
 * migration straightforward.
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'cassper.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);

    // Performance pragmas
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('busy_timeout = 5000');
  }

  return _db;
}

/** Close the database connection (useful for tests and cleanup) */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/** Get a fresh in-memory database (for testing) */
export function getMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}
