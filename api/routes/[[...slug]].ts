import { supabase } from "../_supabase";

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  const url: string = req.url || "";
  // Extract id from path: /api/routes/:id
  const idMatch = url.match(/\/api\/routes\/(\d+)/);
  const id = idMatch ? idMatch[1] : null;

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("routes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch routes" });
      return;
    }
    res.status(200).json(data);
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
    const { data, error } = await supabase
      .from("routes")
      .insert({
        image1,
        image2,
        image3,
        extra_info,
        grade_range,
        description,
        official_grade: official_grade || null,
        is_verified: is_verified ? 1 : 0,
      })
      .select("id")
      .single();
    if (error) {
      console.error("Insert error:", error);
      res.status(500).json({ error: error.message || "Failed to save route" });
      return;
    }
    res.status(200).json({ id: data.id });
    return;
  }

  if (req.method === "PATCH" && id) {
    const { official_grade } = req.body;
    const { error } = await supabase
      .from("routes")
      .update({ official_grade })
      .eq("id", id);
    if (error) {
      console.error("Update error:", error);
      res.status(500).json({ error: error.message || "Failed to update grade" });
      return;
    }
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
