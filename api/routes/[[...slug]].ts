import { getDb } from "../_db";

export default function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  const url: string = req.url || "";
  // Extract id from path: /api/routes/:id
  const idMatch = url.match(/\/api\/routes\/(\d+)/);
  const id = idMatch ? idMatch[1] : null;

  try {
    const db = getDb();

    if (req.method === "GET") {
      const routes = db
        .prepare("SELECT * FROM routes ORDER BY created_at DESC")
        .all();
      db.close();
      res.status(200).json(routes);
      return;
    }

    if (req.method === "POST") {
      const {
        image1,
        image2,
        image3,
        extra_info,
        grade_range,
        description,
        official_grade,
        is_verified,
      } = req.body;
      const stmt = db.prepare(`
        INSERT INTO routes (image1, image2, image3, extra_info, grade_range, description, official_grade, is_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        image1,
        image2,
        image3,
        extra_info,
        grade_range,
        description,
        official_grade || null,
        is_verified ? 1 : 0
      );
      db.close();
      res.status(200).json({ id: info.lastInsertRowid });
      return;
    }

    if (req.method === "PATCH" && id) {
      const { official_grade } = req.body;
      const stmt = db.prepare(
        "UPDATE routes SET official_grade = ? WHERE id = ?"
      );
      stmt.run(official_grade, id);
      db.close();
      res.status(200).json({ success: true });
      return;
    }

    db.close();
    res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("API error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}
