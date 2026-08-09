import { GoogleGenAI } from "@google/genai";
import { BreakdownData, Beat } from "../types";

// Removed defensive client initialization and singleton pattern to follow guidelines
// requiring direct import.meta.env.VITE_GEMINI_API_KEY usage and per-call instantiation.

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const TOKENROUTER_BASE_URL = 'https://api.tokenrouter.com/v1';
export const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash';

const QUOTA_ERROR_RE = /quota|credit|balance|insufficient|recharge|429/i;

function quotaErrorMessage(provider: string, status: number, message: string): string {
  return `${provider} rejected the request (HTTP ${status}) because the account has no usable balance: "${message.slice(0, 140)}". Recharge the account, or switch the General Purpose model to a Gemini model in Backstage > AI.`;
}

async function callGeminiText(prompt: string, model: string, jsonMode: boolean): Promise<string> {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error("Gemini API key is not set. Add GEMINI_API_KEY to the .env file, or fix the TokenRouter/OpenRouter account balance in Backstage > AI.");
  }
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  if (jsonMode) {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    return response.text || '';
  }
  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
  });
  return response.text || '';
}

// TokenRouter blocks browser CORS, so in dev we tunnel through the Vite dev
// server proxy (/tokenrouter -> https://api.tokenrouter.com). Production builds
// fall back to the direct URL.
function tokenRouterBaseUrl(): string {
  return import.meta.env.DEV ? '/tokenrouter/v1' : TOKENROUTER_BASE_URL;
}

// OpenRouter/TokentRouter models use slugs like "nvidia/..." or "moonshotai/...".
// Google models never contain a "/", so this is a reliable router.
export function isOpenRouterModel(model: string): boolean {
  return typeof model === 'string' && model.includes('/');
}

// OpenRouter keys always start with "sk-or-v1-". Everything else starting with
// "sk-" is treated as a TokenRouter key. Defaults to TokenRouter when present.
export function resolveBaseUrl(apiKey?: string): string {
  if (apiKey && apiKey.startsWith('sk-or-v1-')) return OPENROUTER_BASE_URL;
  return tokenRouterBaseUrl();
}

// OpenAI-compatible chat completion against OpenRouter or TokenRouter.
async function openAICompletion(baseUrl: string, prompt: string, model: string, apiKey: string, jsonMode = false): Promise<string> {
  const provider = baseUrl.includes('openrouter') ? 'OpenRouter' : 'TokenRouter';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    let message = `${provider} API Error ${res.status}: ${errText.slice(0, 300)}`;
    if (QUOTA_ERROR_RE.test(message)) {
      message = quotaErrorMessage(provider, res.status, errText);
    }
    throw new Error(message);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// Routes a text prompt to OpenRouter/TokenRouter or Google Gemini based on the model slug.
// Falls back to Gemini automatically when the external provider is out of credit
// and a Gemini key is configured.
async function callTextModel(prompt: string, model: string, jsonMode: boolean, openRouterApiKey?: string): Promise<string> {
  if (isOpenRouterModel(model)) {
    // Prefer the in-app key (Backstage AI tab), fall back to env vars.
    const key = openRouterApiKey || import.meta.env.VITE_TOKENROUTER_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!key) {
      throw new Error("API key not set. Add it in Backstage > AI.");
    }
    try {
      return await openAICompletion(resolveBaseUrl(key), prompt, model, key, jsonMode);
    } catch (err: any) {
      const msg = err?.message || '';
      if (QUOTA_ERROR_RE.test(msg) && import.meta.env.VITE_GEMINI_API_KEY) {
        console.warn('External provider out of credit — falling back to Gemini.');
        return callGeminiText(prompt, GEMINI_FALLBACK_MODEL, jsonMode);
      }
      throw err;
    }
  }
  return callGeminiText(prompt, model, jsonMode);
}

export async function generateText(prompt: string, model: string = 'gemini-2.5-flash', openRouterApiKey?: string): Promise<string> {
  try {
    return await callTextModel(prompt, model, false, openRouterApiKey);
  } catch (error) {
    console.error("AI Text Gen Error:", error);
    throw error;
  }
}

// Validates an API key against its provider (TokenRouter or OpenRouter).
// ok = key authenticates; quotaOk = a real completion succeeded (catches $0 credit).
export async function testApiKey(apiKey: string): Promise<{ ok: boolean; provider: string; quotaOk: boolean; error?: string }> {
  const provider = apiKey && apiKey.startsWith('sk-or-v1-') ? 'OpenRouter' : 'TokenRouter';
  const baseUrl = resolveBaseUrl(apiKey);
  try {
    // OpenRouter exposes /auth/key; TokenRouter lists models for the key.
    const res = await fetch(`${baseUrl}/${provider === 'OpenRouter' ? 'auth/key' : 'models'}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error?.message) message = body.error.message;
      } catch { /* ignore parse errors */ }
      return { ok: false, provider, quotaOk: false, error: message };
    }

    // Probe with a 1-token completion on the first model the key can access,
    // so a $0-balance account surfaces as "valid key, but no credit".
    const listData = await res.json();
    const modelId = Array.isArray(listData?.data) && listData.data.length > 0 ? listData.data[0].id : undefined;
    if (modelId) {
      try {
        const probe = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
        });
        const pbody = await probe.json().catch(() => null);
        if (!probe.ok) {
          const msg = pbody?.error?.message || `HTTP ${probe.status}`;
          if (/quota|credit|balance|recharge|insufficient/i.test(msg)) {
            return { ok: true, provider, quotaOk: false, error: msg };
          }
        }
      } catch { /* completion probe failed non-fatally — key still authenticated */ }
    }

    return { ok: true, provider, quotaOk: true };
  } catch (err: any) {
    return { ok: false, provider, quotaOk: false, error: err?.message || 'Network error' };
  }
}

// Probes the configured Gemini key with a tiny generateContent call.
export async function testGeminiApiKey(): Promise<{ ok: boolean; error?: string }> {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    return { ok: false, error: 'Gemini API key is not set — add VITE_GEMINI_API_KEY to the .env file.' };
  }
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'reply OK' }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg = body?.error?.message || `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Multi-turn conversation routed to OpenRouter/TokenRouter (full history) or Gemini.
// Falls back to Gemini automatically when the external provider is out of credit
// and a Gemini key is configured.
export async function chatWithAI(
  messages: ChatMessage[],
  model: string,
  systemPrompt?: string,
  openRouterApiKey?: string
): Promise<string> {
  if (isOpenRouterModel(model)) {
    const key = openRouterApiKey || import.meta.env.VITE_TOKENROUTER_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!key) {
      throw new Error("API key not set. Add it in Backstage > AI.");
    }
    const provider = resolveBaseUrl(key).includes('openrouter') ? 'OpenRouter' : 'TokenRouter';
    try {
      const baseUrl = resolveBaseUrl(key);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...messages.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        let message = `${provider} API Error ${res.status}: ${errText.slice(0, 300)}`;
        if (QUOTA_ERROR_RE.test(message)) {
          message = quotaErrorMessage(provider, res.status, errText);
        }
        throw new Error(message);
      }
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      const msg = err?.message || '';
      if (QUOTA_ERROR_RE.test(msg) && import.meta.env.VITE_GEMINI_API_KEY) {
        console.warn('External provider out of credit — falling back to Gemini for chat.');
        return chatGemini(messages, GEMINI_FALLBACK_MODEL, systemPrompt);
      }
      throw err;
    }
  }

  return chatGemini(messages, model, systemPrompt);
}

async function chatGemini(messages: ChatMessage[], model: string, systemPrompt?: string): Promise<string> {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error("Gemini API key is not set. Add GEMINI_API_KEY to the .env file, or fix the TokenRouter/OpenRouter account balance in Backstage > AI.");
  }
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const contents = [
    ...(systemPrompt ? [{ role: 'user' as const, parts: [{ text: systemPrompt }] }] : []),
    ...messages.map(m => ({
      role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: m.content }],
    })),
  ];
  const response = await ai.models.generateContent({ model, contents });
  return response.text || '';
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
    model: string = 'gemini-2.5-flash',
    openRouterApiKey?: string
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
            const text = await callTextModel(prompt, model, true, openRouterApiKey);
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
    model: string = 'gemini-2.5-flash',
    openRouterApiKey?: string
): Promise<any[]> {
    if (scenes.length === 0) return [];
    const simplifiedInput = scenes.map(s => ({ id: s.id, text: s.content.replace(/<[^>]+>/g, ' ').substring(0, 1000) }));
    const prompt = `Analyze the following script scenes... ${JSON.stringify(simplifiedInput)}`;

    try {
        const text = await callTextModel(prompt, model, true, openRouterApiKey);
        return safeJSONParse(text);
    } catch (e) {
        console.error("Batch Analysis Error", e);
        return [];
    }
}

export async function generateShotList(scriptSegment: string, model: string = 'gemini-2.5-flash'): Promise<any[]> {
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
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
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
  model: string = 'gemini-2.5-flash'
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
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
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
  model: string = 'gemini-2.5-flash'
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
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
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

export async function generateBreakdown(
  scriptText: string, 
  model: string = 'gemini-2.5-flash', 
  language: 'english' | 'tamil' = 'english',
  openRouterApiKey?: string
): Promise<BreakdownData | null> {
  const langInstruction = language === 'tamil' 
    ? `CRITICAL LANGUAGE REQUIREMENT FOR TAMIL:
For EVERY SINGLE breakdown item across all categories (cast, props, sound, costume, vfx, practical, location), you MUST provide the Tamil name followed ALWAYS by its English name/meaning in brackets right next to it.
Format: "Tamil Name (English Name / Meaning)"
Examples:
- "அபிராமி (Abhirami)"
- "மரக் குச்சி (Wooden Stick)"
- "இடி முழக்கம் (Thunderclap)"
- "கிழிந்த மஞ்சள் பாவாடை (Torn Yellow Dress)"
- "கனமழை (Heavy Rain)"
- "இராமேஸ்வரம் பாலம் (Rameswaram Bridge)"

EVERY single item name MUST have the English name / translation in parentheses next to the Tamil name.` 
    : 'Provide item names and descriptions in English.';

  const prompt = `You are a professional assistant director and script breakdown supervisor. 
Analyze the following scene text from a screenplay and extract all production breakdown items into categories.

Language requirement:
${langInstruction}

Scene Text:
"""${scriptText}"""

Return ONLY a raw JSON Object with the following keys. Each key must contain an array of objects with "name" (string, the name of the item/character/element) and "source" (string, the exact line or phrase from the script where it appears):
- "cast": Characters, actors, extras, voices appearing in this scene
- "props": Physical objects handled or used by characters (weapons, tools, documents, food, phones, vehicles)
- "sound": Sound effects (SFX), background ambient noise, music cues mentioned or implied
- "costume": Wardrobe, outfits, makeup, prosthetic details, special clothing mentioned
- "vfx": Visual effects, CGI elements, green screen requirements, digital enhancements
- "practical": Practical special effects (SFX), fire, rain, smoke, explosions, squibs, dust clouds
- "location": Specific physical set requirements, landmarks, environmental condition or real-world location elements

Example JSON format:
${language === 'tamil' ? `{
  "cast": [{"name": "அபிராமி (Abhirami)", "source": "அபிராமி (7) சேற்றில் ஓடுகிறாள்"}],
  "props": [{"name": "மரக் குச்சி (Wooden Stick)", "source": "கையில் மரக் குச்சி வைத்திருக்கிறாள்"}],
  "sound": [{"name": "இடி முழக்கம் (Thunderclap)", "source": "பயங்கர இடி முழக்கம் கேட்கிறது"}],
  "costume": [{"name": "கிழிந்த மஞ்சள் பாவாடை (Torn Yellow Dress)", "source": "மஞ்சள் பாவாடை கிழிந்துள்ளது"}],
  "vfx": [{"name": "ராட்சச கடல் அலை (Giant Tidal Wave)", "source": "பெரிய அலை வருகிறது"}],
  "practical": [{"name": "கனமழை (Heavy Rain)", "source": "கனமழை பெய்கிறது"}],
  "location": [{"name": "இராமேஸ்வரம் பாலம் (Rameswaram Bridge)", "source": "EXT. RAMESWARAM BRIDGE - DAY"}]
}` : `{
  "cast": [{"name": "KAVYA", "source": "KAVYA (7) runs through the mud"}],
  "props": [{"name": "Wooden Stick", "source": "clutching a worn wooden stick"}],
  "sound": [{"name": "Thunderclap", "source": "A DEAFENING THUNDERCLAP echoes"}],
  "costume": [{"name": "Torn Yellow Dress", "source": "her yellow dress torn at the knee"}],
  "vfx": [{"name": "Giant Tidal Wave", "source": "massive ocean wall looming"}],
  "practical": [{"name": "Heavy Torrential Rain", "source": "rain pours down relentlessly"}],
  "location": [{"name": "Rameswaram Bridge", "source": "EXT. RAMESWARAM BRIDGE - DAY"}]
}`}
`;

  try {
      const text = await callTextModel(prompt, model, true, openRouterApiKey);
      const data = safeJSONParse(text);

      const normalize = (arr: any[]) => {
          if (!Array.isArray(arr)) {
              if (arr && typeof arr === 'object') {
                  const possibleArray = Object.values(arr).find(v => Array.isArray(v));
                  if (possibleArray && Array.isArray(possibleArray)) arr = possibleArray;
                  else return [];
              } else {
                  return [];
              }
          }
          return arr.map(item => {
              if (typeof item === 'string') return { name: item, source: item };
              if (item && typeof item === 'object') {
                  const name = item.name || item.item || item.title || item.element || 'Unknown';
                  const source = item.source || item.line || item.reference || name;
                  return { name: String(name), source: String(source) };
              }
              return { name: String(item), source: String(item) };
          });
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
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
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

export async function identifyActorFromImage(base64Image: string): Promise<string | null> {
  try {
    const match = base64Image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let base64Data = base64Image;
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    } else {
      if (base64Image.startsWith('http')) {
        return null;
      }
    }

    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        "Who is the well-known actor/actress in this image? Return ONLY their full name. If you cannot identify a famous actor or the person is unrecognized, return exactly 'Unknown'."
      ]
    });
    
    const text = (response.text || '').trim().replace(/['"']/g, '');
    if (text && text.toLowerCase() !== 'unknown' && text.length < 100) {
      return text;
    }
    return null;
  } catch (error) {
    console.error("Actor Identification Error:", error);
    return null;
  }
}

