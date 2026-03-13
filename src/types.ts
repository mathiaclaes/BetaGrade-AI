export interface RouteRecord {
  id: number;
  image1: string;
  image2: string;
  image3: string;
  extra_info: string;
  grade_range: string;
  description: string;
  created_at: string;
}

export interface AnalysisResult {
  gradeRange: string;
  description: string;
}
