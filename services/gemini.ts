import { GoogleGenAI } from "@google/genai";
import { BreakdownData, Beat } from "../types";

// Removed defensive client initialization and singleton pattern to follow guidelines
// requiring direct process.env.API_KEY usage and per-call instantiation.

export async function generateText(prompt: string, model: string = 'gemini-3-flash-preview'): Promise<string> {
  try {
    // Always use a new instance right before the call to ensure latest API key is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    // Access text property directly (GenerateContentResponse features a text property, not a method)
    return response.text || '';
  } catch (error) {
    console.error("Gemini Text Gen Error:", error);
    throw error;
  }
}

// Helper to sanitize JSON strings with bad escapes
function safeJSONParse(jsonStr: string): any {
    let clean = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(clean);
    } catch (e) {
        console.warn("Initial JSON parse failed, attempting repairs...", e);
        const fixed = clean.replace(/\\(?:(["\\/bfnrt]|u[0-9a-fA-F]{4}))|\\/g, (match, group1) => {
            if (group1) return match; 
            return '\\\\'; 
        });
        try {
            return JSON.parse(fixed);
        } catch (e2) {
            console.error("Failed to parse JSON even after cleanup:", e2);
            throw e2;
        }
    }
}

function createSmartChunks(text: string, maxChars: number): string[] {
    const lines = text.split('\n');
    const chunks: string[] = [];
    let currentChunk = '';
    for (const line of lines) {
        if ((currentChunk.length + line.length + 1) > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = '';
        }
        currentChunk += line + '\n';
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk);
    return chunks;
}

export async function convertTextToScript(
    rawText: string, 
    model: string = 'gemini-3-flash-preview'
): Promise<Beat[]> {
    const chunkSize = 30000;
    const chunks = createSmartChunks(rawText, chunkSize);
    let allBeats: Beat[] = [];
    let beatIdCounter = Date.now();

    for (const chunk of chunks) {
        const prompt = `
        You are an intelligent copy-paster and screenplay formatter. 
        Your ONLY job is to take the raw text provided and format it into a structured JSON array of Scenes.
        CRITICAL RULE: PRESERVE THE ORIGINAL TEXT EXACTLY AS IT APPEARS.
        RAW TEXT: """${chunk}"""
        OUTPUT FORMAT: Return ONLY a raw JSON Array. No markdown code blocks.
        `;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            const text = response.text || '[]';
            const parsedScenes = safeJSONParse(text);

            if (Array.isArray(parsedScenes)) {
                const beats: Beat[] = parsedScenes.map((s: any) => ({
                    id: beatIdCounter++,
                    x: 0, 
                    y: 0,
                    title: s.title || s.slug?.location || 'Untitled',
                    sceneNumber: s.sceneNumber ? String(s.sceneNumber) : undefined,
                    summary: s.summary || '',
                    slug: {
                        prefix: s.slug?.prefix || 'INT.',
                        location: s.slug?.location || 'UNKNOWN',
                        time: s.slug?.time || 'DAY'
                    },
                    content: s.content || '<div class="sc-line sc-action"></div>',
                    color: '#444',
                    shots: [],
                    status: 'not-ready',
                    versions: [],
                    notes: [],
                    boardId: 0
                }));
                allBeats = [...allBeats, ...beats];
            }
        } catch (e) {
            console.error("AI Parse Error for chunk:", e);
        }
    }
    return allBeats;
}

export async function analyzeScriptBatch(
    scenes: { id: number, content: string }[], 
    model: string = 'gemini-3-flash-preview'
): Promise<any[]> {
    if (scenes.length === 0) return [];
    const simplifiedInput = scenes.map(s => ({ id: s.id, text: s.content.replace(/<[^>]+>/g, ' ').substring(0, 1000) }));
    const prompt = `Analyze the following script scenes... ${JSON.stringify(simplifiedInput)}`;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        const text = response.text || '[]';
        return safeJSONParse(text);
    } catch (e) {
        console.error("Batch Analysis Error", e);
        return [];
    }
}

export async function generateShotList(scriptSegment: string, model: string = 'gemini-3-flash-preview'): Promise<any[]> {
  const prompt = `You are an expert cinematographer. Analyze the following screenplay segment and break it down into a list of shot cards.
Return ONLY a raw JSON Array of shot objects. Do not wrap in markdown or object keys.
Each object should contain:
- shotSize (string, e.g., "WIDE", "MEDIUM", "CLOSE UP")
- angle (string, e.g., "EYE LEVEL", "LOW ANGLE", "HIGH ANGLE")
- subject (string, brief subject or character focus)
- description (string, visual description of action)
- scene (string, scene number e.g. "1")

Screenplay Segment:
"""${scriptSegment}"""`;

  try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: { responseMimeType: 'application/json' }
      });
      const text = response.text || '[]';
      const parsed = safeJSONParse(text);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.shots)) return parsed.shots;
          if (Array.isArray(parsed.shotList)) return parsed.shotList;
          if (Array.isArray(parsed.scenes)) return parsed.scenes;
          if (Array.isArray(parsed.data)) return parsed.data;
          const foundArray = Object.values(parsed).find((v: any) => Array.isArray(v));
          if (foundArray && Array.isArray(foundArray)) return foundArray;
      }
      return [];
  } catch (e) {
    console.error("Shot List Gen Error", e);
    return [];
  }
}

export async function generateShotDivisionPreview(
  sceneHeading: string,
  scriptSegment: string,
  styleMode: string = 'Cinematic Pace',
  model: string = 'gemini-3-flash-preview'
): Promise<any[]> {
  const prompt = `You are an A-list Director of Photography and Director. Analyze this scene and create a professional, highly detailed Shot Division breakdown in "${styleMode}" style.
Scene Heading: ${sceneHeading}

Screenplay Text:
"""${scriptSegment}"""

Return ONLY a raw JSON Array of shot objects. Each object MUST contain:
- shotSize: (e.g. "WIDE", "MEDIUM", "CLOSE UP", "EXTREME CLOSE UP", "POV", "OVER THE SHOULDER", "TWO SHOT")
- angle: (e.g. "EYE LEVEL", "LOW ANGLE", "HIGH ANGLE", "DUTCH ANGLE", "BIRD'S EYE")
- lens: (e.g. "24mm Prime", "35mm Prime", "50mm Prime", "85mm Anamorphic")
- movement: (e.g. "Static", "Dolly In", "Slow Pan", "Tracking Shot", "Handheld", "Steadicam")
- subject: (Main character or object in focus)
- description: (Vivid visual description of action, composition, and emotional focus)
- scriptReference: (The specific dialogue or action line in script covered by this shot)
- durationSec: (Estimated duration in seconds, e.g. 4)
- reasoning: (1 concise sentence explaining the directorial choice/rationale for this shot division)

Ensure shots cover the complete scene logically from start to finish.`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const text = response.text || '[]';
    const parsed = safeJSONParse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      const foundArray = Object.values(parsed).find((v: any) => Array.isArray(v));
      if (foundArray && Array.isArray(foundArray)) return foundArray;
    }
    return [];
  } catch (e) {
    console.error("Shot Division Preview Gen Error", e);
    return [];
  }
}

export async function predictNextShotSummary(
  sceneHeading: string,
  scriptText: string,
  existingShots: any[],
  partialInput: { shotSize?: string; angle?: string; subject?: string; description?: string },
  model: string = 'gemini-3-flash-preview'
): Promise<{ description: string; subject: string; lens: string; movement: string; scriptReference: string } | null> {
  const existingSummary = existingShots.map((s, idx) => `Shot #${idx + 1}: ${s.shotSize} ${s.angle} on ${s.subject || 'scene'} - ${s.description}`).join('\n');
  
  const prompt = `You are a film director assistant predicting the next shot's details in a screenplay scene.
Scene: ${sceneHeading}
Screenplay Context:
"""${scriptText}"""

Current Existing Shots in Scene:
${existingSummary || '(No shots yet in this scene)'}

The Director is currently typing a new shot with these initial inputs:
- Shot Size: ${partialInput.shotSize || 'Not specified'}
- Camera Angle: ${partialInput.angle || 'Not specified'}
- Subject: ${partialInput.subject || 'Not specified'}
- Partial Description typed so far: "${partialInput.description || ''}"

Based on the screenplay context and uncovered story beats, predict what visual action or reaction shot the director is aiming for.
Return ONLY a raw JSON Object with:
- description: (Complete, vivid description completing or expanding the shot)
- subject: (Character or object name)
- lens: (Recommended lens e.g. "50mm Prime")
- movement: (Recommended movement e.g. "Slow Dolly In")
- scriptReference: (Script line reference)
`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const text = response.text || '{}';
    const parsed = safeJSONParse(text);
    if (parsed && typeof parsed === 'object') {
      return {
        description: parsed.description || '',
        subject: parsed.subject || '',
        lens: parsed.lens || '50mm',
        movement: parsed.movement || 'Static',
        scriptReference: parsed.scriptReference || ''
      };
    }
    return null;
  } catch (e) {
    console.error("Shot Prediction Error", e);
    return null;
  }
}

export async function generateBreakdown(scriptText: string, model: string = 'gemini-3-flash-preview', language: 'english' | 'tamil' = 'english'): Promise<BreakdownData | null> {
  const prompt = `Breakdown analysis: ${scriptText}`;
  try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: { responseMimeType: 'application/json' }
      });
      const text = response.text || '{}';
      const data = safeJSONParse(text);
      const normalize = (arr: any[]) => {
          if (!Array.isArray(arr)) return [];
          return arr.map(item => (typeof item === 'string' ? { name: item, source: item } : { name: item.name || 'Unknown', source: item.source || '' }));
      };
      return {
          props: normalize(data.props),
          sound: normalize(data.sound),
          costume: normalize(data.costume),
          vfx: normalize(data.vfx),
          practical: normalize(data.practical),
          cast: normalize(data.cast),
          location: normalize(data.location)
      };
  } catch (e) {
      console.error("Breakdown Gen Error", e);
      return null;
  }
}

export async function generateImage(promptOrOptions: any): Promise<string | null> {
  let prompt = typeof promptOrOptions === 'object' ? (promptOrOptions.prompt || '') : (promptOrOptions || '');
  let model = (typeof promptOrOptions === 'object' && promptOrOptions?.model) ? promptOrOptions.model : 'gemini-2.5-flash-image';
  let aspectRatio = (typeof promptOrOptions === 'object' && promptOrOptions?.aspectRatio) ? promptOrOptions.aspectRatio : '16:9';

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    if (model && model.includes('imagen')) {
        const response = await ai.models.generateImages({
            model: model,
            prompt: prompt,
            config: { numberOfImages: 1, aspectRatio: aspectRatio, outputMimeType: 'image/jpeg' },
        });
        const base64 = response.generatedImages?.[0]?.image?.imageBytes;
        return base64 ? `data:image/jpeg;base64,${base64}` : null;
    } else {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }] },
            config: { imageConfig: { aspectRatio: aspectRatio } } as any,
        });
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    }
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
}
