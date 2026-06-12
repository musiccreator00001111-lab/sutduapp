import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function getStudyAnswer(prompt: string, imageBase64?: string) {
  const parts: any[] = [{ text: prompt }];
  
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: imageBase64.split(',')[1] || imageBase64
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: { parts },
    config: {
      systemInstruction: "You are a helpful study assistant. Explain concepts clearly and provide step-by-step solutions. Support subjects like Math, Science, Biology, Physics, Chemistry, and English. If the user asks for a diagram or visual explanation, describe it clearly or suggest a visual aid.",
    },
  });
  
  return response.text;
}

export async function generateStudyDiagram(prompt: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ text: `Educational diagram or illustration for: ${prompt}. Clear, academic style, labeled if necessary.` }],
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}

export async function generateQuiz(subject: string) {
  const model = ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Generate a 5-question multiple choice quiz for ${subject}. Return only valid JSON in the format: [{"question": "...", "options": ["...", "...", "...", "..."], "answer": 0}]`,
    config: {
      responseMimeType: "application/json",
    },
  });
  const response = await model;
  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
}
