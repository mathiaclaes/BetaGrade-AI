import { supabase } from "./_supabase";

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { data, error } = await supabase
    .from("routes")
    .select("grade_range, official_grade, extra_info, description")
    .or("is_verified.eq.1,official_grade.not.is.null")
    .limit(10);

  if (error) {
    console.error("Training data error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch training data" });
    return;
  }

  res.status(200).json(data);
}
