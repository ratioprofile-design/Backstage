
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export async function generateText(prompt: string, model: string = 'gemini-3-flash-preview'): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    return response.text || '';
  } catch (error) {
    console.error("Gemini Text Gen Error:", error);
    throw error;
  }
}

export async function generateShotList(scriptSegment: string, model: string = 'gemini-3-flash-preview'): Promise<any[]> {
  const prompt = `
    You are an expert cinematographer. 
    Analyze the following screenplay text.
    Break down the action and dialogue into a visual shot list (Shot Division).
    
    Return ONLY a raw JSON array of objects. Do not wrap in markdown or code blocks.
    Structure:
    [
      {
        "scene": "string (Scene Number or Slugline reference)",
        "shotSize": "string (e.g. WIDE, CU, MCU, OTS, ESTABLISHING)",
        "angle": "string (e.g. EYE LEVEL, LOW ANGLE, HIGH ANGLE, DUTCH)",
        "description": "string (visual description of the composition, lighting, and action)",
        "subject": "string (main subject of shot)"
      }
    ]

    SCREENPLAY SEGMENT:
    ${scriptSegment}
  `;
  
  const text = await generateText(prompt, model);
  // Cleanup markdown if present
  const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("JSON Parse Error", e);
    return [];
  }
}

export async function generateImage(prompt: string, aspectRatio: string = '16:9', model: string = 'gemini-2.5-flash-image'): Promise<string | null> {
  try {
    if (model.includes('imagen')) {
        // --- IMAGEN PATH ---
        const response = await ai.models.generateImages({
            model: model,
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: aspectRatio,
                outputMimeType: 'image/jpeg',
            },
        });
        
        const base64EncodeString = response.generatedImages?.[0]?.image?.imageBytes;
        return base64EncodeString ? `data:image/jpeg;base64,${base64EncodeString}` : null;

    } else {
        // --- GEMINI IMAGE PATH (Flash Image, Pro Image) ---
        // Uses generateContent
        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [{ text: prompt }],
            },
            config: {
                // @ts-ignore - The SDK types might lag, but this fits the Gemini Image spec
                imageConfig: {
                    aspectRatio: aspectRatio
                }
            },
        });

        if (response.candidates && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64EncodeString = part.inlineData.data;
                    return `data:image/png;base64,${base64EncodeString}`;
                }
            }
        }
        return null;
    }
  } catch (error) {
    console.error("Image Generation Error:", error);
    return null;
  }
}
