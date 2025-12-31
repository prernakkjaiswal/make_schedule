import { GoogleGenAI, Type, Schema } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export interface AISuggestion {
  title: string;
  durationMinutes: number;
  subtasks?: { title: string; duration: number }[];
}

export const analyzeTaskInput = async (input: string): Promise<AISuggestion | null> => {
  if (!apiKey) {
    console.warn("API Key not found for Gemini");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this task request: "${input}". 
      If it's a simple task, return the title and estimated duration in minutes. 
      If it's a complex task (like "Finish Project"), break it down into 2-3 subtasks.
      Default duration for generic tasks should be 30 minutes.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            durationMinutes: { type: Type.INTEGER },
            subtasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  duration: { type: Type.INTEGER }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as AISuggestion;

  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};
