import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "bouldering.db")
  : path.join(process.cwd(), "bouldering.db");

export function getDb() {
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image1 TEXT,
      image2 TEXT,
      image3 TEXT,
      extra_info TEXT,
      grade_range TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    db.exec("ALTER TABLE routes ADD COLUMN official_grade TEXT");
  } catch {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE routes ADD COLUMN is_verified INTEGER DEFAULT 0");
  } catch {
    // Column already exists
  }

  return db;
}
