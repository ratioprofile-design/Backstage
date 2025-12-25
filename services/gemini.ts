
import { GoogleGenAI } from "@google/genai";
import { BreakdownData, Beat } from "../types";

let ai: GoogleGenAI | null = null;

// Allow the app to inject the key at runtime (from LocalStorage/User Input)
export function updateGeminiConfig(apiKey: string) {
    if (!apiKey) {
        // Only clear if explicitly empty, don't clear if undefined passed by accident
        if (apiKey === '') ai = null;
        return;
    }
    ai = new GoogleGenAI({ apiKey });
}

// Helper to get client, prioritizing temp key, then global instance
const getClient = (tempApiKey?: string) => {
    if (tempApiKey) {
        return new GoogleGenAI({ apiKey: tempApiKey });
    }
    if (!ai) {
        throw new Error("Gemini API Key not set. Please go to Backstage > Features and enter your API Key.");
    }
    return ai;
};

// Modified to accept an optional temporary key for testing purposes
export async function generateText(prompt: string, model: string = 'gemini-3-flash-preview', tempApiKey?: string): Promise<string> {
  try {
    const client = getClient(tempApiKey);
    
    const response = await client.models.generateContent({
      model: model,
      contents: prompt,
    });
    return response.text || '';
  } catch (error) {
    console.error("Gemini Text Gen Error:", error);
    throw error;
  }
}

// Helper to sanitize JSON strings with bad escapes
function safeJSONParse(jsonStr: string): any {
    // 1. Basic Cleanup (Markdown & Whitespace)
    let clean = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    try {
        return JSON.parse(clean);
    } catch (e) {
        console.warn("Initial JSON parse failed, attempting repairs...", e);
        
        // 2. Fix "Bad escaped character" (invalid backslashes)
        // This regex matches valid escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
        // OR it matches a backslash that failed the first check.
        // We preserve valid ones, and escape invalid ones.
        const fixed = clean.replace(/\\(?:(["\\/bfnrt]|u[0-9a-fA-F]{4}))|\\/g, (match, group1) => {
            if (group1) return match; // Valid escape, keep it
            return '\\\\'; // Invalid backslash (e.g. \a, \', or \u12), escape it to \\
        });
        
        try {
            return JSON.parse(fixed);
        } catch (e2) {
            console.error("Failed to parse JSON even after cleanup:", e2);
            // Log snippet of failure point if possible
            if (e2 instanceof SyntaxError && 'position' in e2) {
                const pos = (e2 as any).position;
                if (typeof pos === 'number') {
                    const start = Math.max(0, pos - 20);
                    const end = Math.min(fixed.length, pos + 20);
                    console.error(`Error near: ...${fixed.substring(start, end)}...`);
                }
            }
            throw e2;
        }
    }
}

// Helper: Smart Chunking to avoid breaking sentences/lines
function createSmartChunks(text: string, maxChars: number): string[] {
    const lines = text.split('\n');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const line of lines) {
        // If adding this line exceeds max, push current and start new
        // Check for edge case: single line larger than maxChars (unlikely in scripts, but handle it by forcing split if empty)
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
    model: string = 'gemini-3-flash-preview', 
    apiKey?: string
): Promise<Beat[]> {
    // 1. Smart Chunking
    // We'll split roughly by 30,000 characters to ensure the Model's OUTPUT limit (usually 8k tokens) isn't exceeded by a massive JSON response.
    // 30k chars input usually results in <8k token output for screenplays.
    const chunkSize = 30000;
    const chunks = createSmartChunks(rawText, chunkSize);

    let allBeats: Beat[] = [];
    let beatIdCounter = Date.now();

    for (const chunk of chunks) {
        const prompt = `
        You are an intelligent copy-paster and screenplay formatter. 
        Your ONLY job is to take the raw text provided and format it into a structured JSON array of Scenes.

        CRITICAL RULE: 
        DO NOT CORRECT SPELLING, GRAMMAR, OR SPACING.
        PRESERVE THE ORIGINAL TEXT EXACTLY AS IT APPEARS.
        If the input says "வந்துகொண்டிருகின்ற", you MUST output "வந்துகொண்டிருகின்ற". Do not change it to "வந்து கொண்டிருக்கின்ற".
        Do not split joined words. Do not fix typos. Just identify the structure (Action, Dialogue, Character) and wrap the EXACT original text in the correct HTML tags.

        RAW TEXT:
        """
        ${chunk}
        """

        INSTRUCTIONS:
        1. Identify every individual Scene.
           - English Headers: INT., EXT., I/E.
           - Tamil Headers: காட்சி (Scene), இடம் (Location), உள் (Int), வெளி (Ext), பகல் (Day), இரவு (Night).
        2. Detect the Scene Number if present (e.g. "1", "5A", "காட்சி 1"). If strictly numeric, return it. If missing, leave null.
        3. Format the 'content' field as HTML using these exact class names. Paste the original raw text content inside the divs:
           - Sluglines: Do not include in 'content' (they go in 'slug' object).
           - Action/Description: <div class="sc-line sc-action">Original Text</div>
           - Character Names: <div class="sc-line sc-character">ORIGINAL NAME</div>
           - Dialogue: <div class="sc-line sc-dialogue">Original Text</div>
           - Parentheticals: <div class="sc-line sc-parenthetical">(Original Text)</div>
           - Transitions: <div class="sc-line sc-transition">Original Text</div>
        4. Extract the slugline details into the 'slug' object.
        5. Generate a very short 'title' (2-4 words) based on the scene event.
        6. Generate a 1-sentence 'summary'.

        OUTPUT FORMAT:
        Return ONLY a raw JSON Array. No markdown code blocks.
        [
          {
            "sceneNumber": "1",
            "title": "Introduction",
            "summary": "Hero walks into the room.",
            "slug": { "prefix": "INT.", "location": "HOUSE", "time": "DAY" },
            "content": "<div class=\"sc-line sc-action\">Hero walks in.</div><div class=\"sc-line sc-character\">HERO</div><div class=\"sc-line sc-dialogue\">Hello.</div>"
          }
        ]
        `;

        try {
            const client = getClient(apiKey);
            
            // Use responseMimeType to encourage valid JSON output
            const response = await client.models.generateContent({
                model: model,
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            
            const text = response.text || '[]';
            const parsedScenes = safeJSONParse(text);

            if (Array.isArray(parsedScenes)) {
                // Convert to Beat objects
                const beats: Beat[] = parsedScenes.map((s: any) => ({
                    id: beatIdCounter++,
                    x: 0, 
                    y: 0, // Will be laid out by BoardView
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
                    versions: []
                }));

                allBeats = [...allBeats, ...beats];
            }

        } catch (e) {
            console.error("AI Parse Error for chunk:", e);
            // Continue to next chunk even if one fails
        }
    }

    return allBeats;
}

export async function analyzeScriptBatch(
    scenes: { id: number, content: string }[], 
    model: string = 'gemini-3-flash-preview', 
    apiKey?: string
): Promise<any[]> {
    if (scenes.length === 0) return [];

    // Strip HTML tags for token efficiency, keep structure roughly
    const simplifiedInput = scenes.map(s => ({
        id: s.id,
        text: s.content.replace(/<[^>]+>/g, ' ').substring(0, 1000) // Limit context per scene to avoid overflow
    }));

    const prompt = `
    You are a professional Script Coordinator. 
    Analyze the following list of screenplay scenes (provided as ID and Raw Text).
    
    For EACH scene, extract or generate:
    1. "title": A short, creative title (2-5 words). If Tamil text, use Tamil.
    2. "summary": A 1-sentence logline.
    3. "sceneNumber": The scene number if explicitly written (e.g., "5", "2A"). If none, return null.
    4. "slug": Clean breakdown of the location header:
       - prefix: "INT.", "EXT.", "உள்.", "வெளி." etc.
       - location: The location name.
       - time: "DAY", "NIGHT", "பகல்", "இரவு" etc.

    INPUT DATA:
    ${JSON.stringify(simplifiedInput)}

    OUTPUT FORMAT:
    Return ONLY a raw JSON Array of objects. No markdown.
    Example:
    [
      { "id": 123, "title": "The Confrontation", "summary": "Hero meets Villain.", "sceneNumber": "1", "slug": { "prefix": "INT.", "location": "HOUSE", "time": "DAY" } }
    ]
    `;

    try {
        const client = getClient(apiKey);
        const response = await client.models.generateContent({
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

export async function generateShotList(scriptSegment: string, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<any[]> {
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
  
  const client = getClient(apiKey);
  try {
      const response = await client.models.generateContent({
          model: model,
          contents: prompt,
          config: { responseMimeType: 'application/json' }
      });
      const text = response.text || '[]';
      return safeJSONParse(text);
  } catch (e) {
    console.error("JSON Parse Error", e);
    return [];
  }
}

export async function generateBreakdown(scriptText: string, model: string = 'gemini-3-flash-preview', apiKey?: string, language: 'english' | 'tamil' = 'english'): Promise<BreakdownData | null> {
  const langInstruction = language === 'tamil' 
    ? "IMPORTANT: Provide the 'name' in Tamil language (Tamil script). Keep the keys in English. The 'source' text must remain in English (exactly as it appears in the script)."
    : "Provide the values in English.";

  const prompt = `
    You are a First Assistant Director creating a script breakdown.
    Analyze the following scene text.
    ${langInstruction}
    
    Extract items for the following categories.
    For EACH item, provide:
    1. 'name': The derived list item name (e.g. "Revolver", "Raincoat").
    2. 'source': The EXACT text snippet from the script that justifies this item.

    Categories:
    1. PROPS (objects specifically handled by characters)
    2. SOUND / SFX (specific audible cues mentioned)
    3. COSTUME / WARDROBE (specific clothing items)
    4. VFX (digital visual effects, green screen)
    5. PRACTICAL EFFECTS (physical effects on set: squibs, smoke, rain)
    6. CAST / EXTRAS (background characters, crowds)
    7. LOCATION SCENARIO (optimal location type, e.g., "Abandoned Warehouse")

    Return ONLY raw JSON with these keys: props, sound, costume, vfx, practical, cast, location.
    Value structure: Array of objects { "name": string, "source": string }.
    Do not wrap in markdown.

    SCENE TEXT:
    ${scriptText}
  `;

  try {
      const client = getClient(apiKey);
      const response = await client.models.generateContent({
          model: model,
          contents: prompt,
          config: { responseMimeType: 'application/json' }
      });
      const text = response.text || '{}';
      const data = safeJSONParse(text);
      
      // Helper to normalize legacy string arrays to objects if model hallucinates or for robust handling
      const normalize = (arr: any[]) => {
          if (!Array.isArray(arr)) return [];
          return arr.map(item => {
              if (typeof item === 'string') return { name: item, source: item };
              return { name: item.name || 'Unknown', source: item.source || '' };
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

// --- STABILITY AI INTEGRATION ---
async function generateStabilityImage(prompt: string, model: string, apiKey: string): Promise<string | null> {
    if (!apiKey) throw new Error("Stability API Key is missing.");

    // Mapped Dimensions for SDXL v1 API (1024x1024 base)
    // We are using the text-to-image v1 endpoint for simplicity with base64 return
    const engineId = model || 'stable-diffusion-xl-1024-v1-0';
    const apiHost = 'https://api.stability.ai';
    const url = `${apiHost}/v1/generation/${engineId}/text-to-image`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            text_prompts: [
                { text: prompt }
            ],
            cfg_scale: 7,
            height: 1024,
            width: 1024, // Default to square, Aspect Ratio logic would need crop or specific dims
            steps: 30,
            samples: 1,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Stability API Error: ${err}`);
    }

    const data = await response.json();
    if (data.artifacts && data.artifacts.length > 0) {
        return `data:image/png;base64,${data.artifacts[0].base64}`;
    }
    return null;
}

export interface GenerateImageOptions {
    prompt: string;
    aspectRatio?: string;
    model?: string;
    apiKey?: string;
    provider?: 'google' | 'stability';
    stabilityApiKey?: string; // Explicit separate key for Stability
}

export async function generateImage(
    promptOrOptions: string | GenerateImageOptions, 
    aspectRatioArg: string = '16:9', 
    modelArg: string = 'gemini-2.5-flash-image', 
    apiKeyArg?: string
): Promise<string | null> {
  
  // Normalize Arguments
  let prompt: string;
  let aspectRatio = aspectRatioArg;
  let model = modelArg;
  let apiKey = apiKeyArg;
  let provider = 'google';
  let stabilityKey = '';

  if (typeof promptOrOptions === 'object') {
      prompt = promptOrOptions.prompt;
      aspectRatio = promptOrOptions.aspectRatio || '16:9';
      model = promptOrOptions.model || 'gemini-2.5-flash-image';
      apiKey = promptOrOptions.apiKey;
      provider = promptOrOptions.provider || 'google';
      stabilityKey = promptOrOptions.stabilityApiKey || '';
  } else {
      prompt = promptOrOptions;
  }

  // --- ROUTING ---
  if (provider === 'stability') {
      return generateStabilityImage(prompt, model, stabilityKey);
  }

  // --- GOOGLE DEFAULT ---
  try {
    const client = getClient(apiKey);
    
    if (model.includes('imagen')) {
        // --- IMAGEN PATH ---
        const response = await client.models.generateImages({
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
        const response = await client.models.generateContent({
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
    throw error; // Re-throw to allow UI to catch and alert
  }
}
