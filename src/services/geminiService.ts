import { GoogleGenAI } from "@google/genai";

// Lazy-loaded client-side fallback (specifically for static serverless environments like Vercel)
let clientAiInstance: any = null;
function getClientAiInstance() {
  if (!clientAiInstance) {
    const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
    clientAiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return clientAiInstance;
}

export async function getStudyAnswer(prompt: string, imageBase64?: string) {
  // 1. Try secure backend server route (Primary route)
  try {
    const response = await fetch("/api/gemini/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, imageBase64 }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.text;
    }
    console.warn("Backend Gemini answer API failed, executing client-side fallback...");
  } catch (error) {
    console.warn("Backend Gemini answer API unreachable, executing client-side fallback...", error);
  }

  // 2. Client-side fallback
  const ai = getClientAiInstance();
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
  // 1. Try secure backend server route (Primary route)
  try {
    const response = await fetch("/api/gemini/diagram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.imageUrl;
    }
    console.warn("Backend Gemini diagram API failed, executing client-side fallback...");
  } catch (error) {
    console.warn("Backend Gemini diagram API unreachable, executing client-side fallback...", error);
  }

  // 2. Client-side fallback
  const ai = getClientAiInstance();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ text: `Educational diagram or illustration for: ${prompt}. Clear, academic style, labeled if necessary.` }],
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      }
    }
  });

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
}

export async function generateQuiz(subject: string) {
  // 1. Try secure backend server route (Primary route)
  try {
    const response = await fetch("/api/gemini/quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subject }),
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
    console.warn("Backend Gemini quiz API failed, executing client-side fallback...");
  } catch (error) {
    console.warn("Backend Gemini quiz API unreachable, executing client-side fallback...", error);
  }

  // 2. Client-side fallback
  const ai = getClientAiInstance();
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
