import { GoogleGenAI, Type } from "@google/genai";

// @ts-ignore
const apiKey = typeof window !== 'undefined' && window.process?.env?.VITE_GEMINI_API_KEY 
  ? window.process.env.VITE_GEMINI_API_KEY 
  : "";

const ai = new GoogleGenAI({ apiKey });

export interface AnalysisResult {
  gradeRange: string;
  description: string;
}

export async function resizeImage(base64Str: string, maxWidth = 1024, maxHeight = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
}

export async function analyzeBoulderingRoute(
  images: string[],
  extraInfo: string,
  trainingData: any[] = []
): Promise<AnalysisResult> {
  const model = "gemini-3-flash-preview";
  
  // Resize images to prevent payload size issues
  const resizedImages = await Promise.all(images.map(img => resizeImage(img)));

  const imageParts = resizedImages.map((base64) => {
    const data = base64.split(",")[1] || base64;
    return {
      inlineData: {
        data,
        mimeType: "image/jpeg",
      },
    };
  });

  let trainingContext = "";
  if (trainingData.length > 0) {
    trainingContext = "\n\nHere are some examples of verified routes to help you calibrate your universal grading logic:\n";
    trainingData.forEach((ex, i) => {
      trainingContext += `Example ${i+1}:
- User Context: ${ex.extra_info || 'None'}
- AI Estimated: ${ex.grade_range}
- Verified Grade (Ground Truth): ${ex.official_grade || ex.grade_range}
- Physical Description: ${ex.description}
---\n`;
    });
  }

  const prompt = `
    You are an expert bouldering route setter and grade estimator with a universal perspective. 
    I am providing 3 different angles of a bouldering route.
    Extra context from the user: ${extraInfo}
    ${trainingContext}

    CRITICAL INSTRUCTIONS:
    1. IGNORE HOLD COLORS for difficulty estimation. Many gyms use color-coded circuits, but these are arbitrary and not universal. Do not "cheat" by using color as a proxy for grade.
    2. FOCUS ON PHYSICALITY: Analyze hold geometry (crimps, slopers, jugs, pockets), wall inclination (slab vs overhang), distance between holds (span/reach), and the technical complexity of the movement (drop-knees, heel hooks, dynamic vs static).
    3. UNIVERSAL STANDARDS: Use the French Font bouldering grade system as a universal standard.
    4. LEARNING FROM EXAMPLES: Use the provided examples to understand how physical features translate to specific grades, maintaining a consistent and objective logic across different environments.
    
    Provide:
    1. A French Font bouldering grade range of exactly 2 adjacent grades (e.g., "6A-6A+" or "7B+-7C").
    2. A short description of exactly 5 small sentences describing the route's character based ONLY on its physical features and movement.

    Return the response in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [...imageParts, { text: prompt }],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gradeRange: {
              type: Type.STRING,
              description: "French Font grade range, e.g., 6A-6A+",
            },
            description: {
              type: Type.STRING,
              description: "Exactly 5 small sentences describing the route.",
            },
          },
          required: ["gradeRange", "description"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No text response from Gemini");
    }
    return JSON.parse(resultText);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("API key")) {
      throw new Error("Invalid Gemini API key. Please check your environment configuration.");
    }
    throw error;
  }
}
