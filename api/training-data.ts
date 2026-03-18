import { getDb } from "./_db";

export default function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const db = getDb();
    const examples = db
      .prepare(
        "SELECT grade_range, official_grade, extra_info, description FROM routes WHERE is_verified = 1 OR official_grade IS NOT NULL LIMIT 10"
      )
      .all();
    db.close();
    res.status(200).json(examples);
  } catch (error: any) {
    console.error("Training data error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch training data" });
  }
}
