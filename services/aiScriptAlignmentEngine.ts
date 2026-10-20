import { TamilScene, TamilScriptItem, TamilScreenplayData } from './tamilLeftRightEngine';
import { callAiJson } from './gemini';

export interface AlignmentStats {
  actionsAligned: number;
  dialoguesAligned: number;
  shotNumbersMerged: number;
  typosCorrected: number;
  headingsStandardized: number;
}

export interface AlignmentProgressState {
  isRunning: boolean;
  isPaused: boolean;
  totalScenes: number;
  completedCount: number;
  currentSceneNumber: string;
  currentSceneLocation: string;
  percent: number;
  startTime: number;
  estimatedSecondsRemaining: number;
  processedSceneIds: string[];
  failedSceneIds: string[];
  stats: AlignmentStats;
}

export interface AlignmentOptions {
  model?: string;
  openRouterApiKey?: string;
  mergeNumberedShots?: boolean;
  standardizeHeadings?: boolean;
  detectContinuousDialogue?: boolean;
  correctTamilTypos?: boolean;
  startSceneIndex?: number;
  endSceneIndex?: number;
}

type ProgressListener = (state: AlignmentProgressState) => void;
type SceneCompletedCallback = (updatedScene: TamilScene, stats: AlignmentStats) => void;

/**
 * Common Tamil phonetic & Word (.docx) export typos to automatically correct.
 */
export const TAMIL_TYPO_CORRECTIONS: [RegExp, string][] = [
  [/பாற்க/g, 'பார்க்க'],
  [/பாற்கிறார்/g, 'பார்க்கிறார்'],
  [/பாற்கிறான்/g, 'பார்க்கிறான்'],
  [/பாற்கிறது/g, 'பார்க்கிறது'],
  [/பாற்கிறார்கள்/g, 'பார்க்கிறார்கள்'],
  [/பாற்கவே/g, 'பார்க்கவே'],
  [/சிறிப்புடன்/g, 'சிரிப்புடன்'],
  [/சிறித்தாள்/g, 'சிரித்தாள்'],
  [/சிறித்தான்/g, 'சிரித்தான்'],
  [/சிறித்துவிட்டு/g, 'சிரித்துவிட்டு'],
  [/சிறித்தபடி/g, 'சிரித்தபடி'],
  [/பெறிய/g, 'பெரிய'],
  [/அர்புதம்/g, 'அற்புதம்'],
  [/அடையாலம்/g, 'அடையாளம்'],
  [/அடையாலங்கள்/g, 'அடையாளங்கள்'],
  [/டைனிங்கு ஹால்/g, 'டைனிங் ஹால்'],
  [/நாற்காளியை/g, 'நாற்காலியை'],
  [/நாற்காளியில்/g, 'நாற்காலியில்'],
  [/நாற்காளியில்லிருந்து/g, 'நாற்காலியிலிருந்து'],
  [/உரிமையாலர்/g, 'உரிமையாளர்'],
  [/உறிமையாலர்/g, 'உரிமையாளர்'],
  [/உரிமையாலரிடம்/g, 'உரிமையாளரிடம்'],
  [/பயிற்ச்சி/g, 'பயிற்சி'],
  [/பயிர்ச்சி/g, 'பயிற்சி'],
  [/அனிந்து/g, 'அணிந்து'],
  [/அனிந்தபடி/g, 'அணிந்தபடி'],
  [/அனிந்தபடியே/g, 'அணிந்தபடியே'],
  [/அனிவிக்கப்பட்டு/g, 'அணிவிக்கப்பட்டு'],
  [/கானோம்/g, 'காணோம்'],
  [/கானும்படி/g, 'காணும்படி'],
  [/கானவில்லை/g, 'காணவில்லை'],
  [/கான்கிறான்/g, 'காண்கிறான்'],
  [/கிலம்பி/g, 'கிளம்பி'],
  [/கிலம்பு/g, 'கிளம்பு'],
  [/கிலம்பினார்/g, 'கிளம்பினார்'],
  [/கிலம்பினான்/g, 'கிளம்பினான்'],
  [/கிலம்பினார்கள்/g, 'கிளம்பினார்கள்'],
  [/கிலம்ப முற்படும்/g, 'கிளம்ப முற்படும்'],
  [/கிலிர்ப்பில்/g, 'கிளிர்ப்பில்'],
  [/கிலப்புது/g, 'கிளப்புது'],
  [/குரஞ்சிப்போயிடுச்சி/g, 'குறைஞ்சிப்போயிடுச்சு'],
  [/சம்பர்தாயங்களை/g, 'சம்பிரதாயங்களை'],
  [/சம்பர்தாயம்/g, 'சம்பிரதாயம்'],
  [/கிருஸ்துவ/g, 'கிறிஸ்தவ'],
  [/கிருஸ்துவத்துக்கு/g, 'கிறிஸ்தவத்துக்கு'],
  [/கிருஸ்துவத்துக்குள்ள/g, 'கிறிஸ்தவத்துக்குள்ள'],
  [/கிருஸ்துவ அமைப்புகள/g, 'கிறிஸ்தவ அமைப்புகளை'],
  [/கிருஸ்துவ திருமணத்தை/g, 'கிறிஸ்தவ திருமணத்தை'],
  [/கிருஸ்துவச்சியா/g, 'கிறிஸ்தவச்சியா'],
  [/கிருஸ்த்துவ/g, 'கிறிஸ்தவ'],
  [/கிருஸ்துஏசுவே/g, 'கிறிஸ்து இயேசுவே'],
  [/ஏசப்பா/g, 'இயேசப்பா'],
  [/ஏசப்பாகிட்ட/g, 'இயேசப்பாகிட்ட'],
  [/ஏசுவின்/g, 'இயேசுவின்'],
  [/ஏசுவை/g, 'இயேசுவை'],
  [/கர்தர்/g, 'கர்த்தர்'],
  [/கர்தருக்கு/g, 'கர்த்தருக்கு'],
  [/கர்தரோட/g, 'கர்த்தரோட'],
  [/கர்தரை/g, 'கர்த்தரை'],
  [/பறலோக/g, 'பரலோக'],
  [/சோஸ்திரம்/g, 'ஸ்தோத்திரம்'],
  [/சோஸ்திறம்/g, 'ஸ்தோத்திரம்'],
  [/சோத்திரம்/g, 'ஸ்தோத்திரம்'],
  [/விடிவிக்க/g, 'விடுவிக்க'],
  [/அலித்தவனை/g, 'அளித்தவனை'],
  [/மண்ணிக்கனும்/g, 'மன்னிக்கணும்'],
  [/மன்னிச்சிடுங்க/g, 'மன்னிச்சிடுங்க'],
  [/பதரிப்போன/g, 'பதறிப்போன'],
  [/பதராத/g, 'பதறாத'],
  [/பதட்டத்தோடு/g, 'பதற்றத்தோடு'],
  [/பதட்டம்/g, 'பதற்றம்'],
  [/பகள்/g, 'பகல்'],
  [/இரவு\s*நேரம்/g, 'இரவு'],
  [/DOCTER/g, 'DOCTOR'],
  [/PRESONER/g, 'PRISONER'],
  [/PRESONERS/g, 'PRISONERS'],
  [/DANGER PRESONER/g, 'DANGEROUS PRISONER'],
  [/TWO VILLAGE PEOPLES/g, 'VILLAGERS'],
  [/ATMOSPHERE/g, 'ATMOSPHERE CROWD']
];

/**
 * Applies deterministic typo correction to a string.
 */
export function applyTypoCorrections(text: string): { text: string; count: number } {
  if (!text) return { text: '', count: 0 };
  let current = text;
  let count = 0;
  for (const [re, val] of TAMIL_TYPO_CORRECTIONS) {
    const matches = current.match(re);
    if (matches && matches.length > 0) {
      count += matches.length;
      current = current.replace(re, val);
    }
  }
  return { text: current, count };
}

/**
 * Merges split numbered shots like "1." on one row and "Long shot of village..." on next row,
 * or formats shot numbers into cohesive Kollywood action paragraphs ending with a dash "-".
 */
export function preMergeNumberedShots(items: TamilScriptItem[]): { items: TamilScriptItem[]; mergedCount: number } {
  const result: TamilScriptItem[] = [];
  let mergedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    const curText = (current.leftAction || current.rawText || '').trim();

    // Check if current is just a hanging number like "1." or "2)" or "(1)"
    const isHangingNumber = /^(\(?\d+[\.\)]\s*)$/.test(curText);

    if (isHangingNumber && i + 1 < items.length) {
      const next = items[i + 1];
      const nextText = (next.leftAction || next.rawText || '').trim();
      if (nextText) {
        // Merge with next item
        const mergedAction = `${curText} ${nextText}`.replace(/\s+/g, ' ').trim();
        result.push({
          ...next,
          id: current.id || next.id,
          type: 'action',
          column: 'left',
          leftAction: mergedAction,
          rawText: mergedAction,
        });
        mergedCount++;
        i++; // skip next item
        continue;
      }
    }

    result.push(current);
  }

  return { items: result, mergedCount };
}

/**
 * Formats a single scene using AI (Gemini / OpenRouter) with deterministic safety guards.
 */
export async function alignSingleScene(
  scene: TamilScene,
  options: AlignmentOptions = {}
): Promise<{ scene: TamilScene; stats: AlignmentStats }> {
  const model = options.model || 'gemini-flash-latest';
  const openRouterApiKey = options.openRouterApiKey;
  let typosCount = 0;
  let shotMergedCount = 0;

  // 1. Pre-merge split numbered shots deterministically first
  let preparedItems = [...scene.items];
  if (options.mergeNumberedShots !== false) {
    const mergeRes = preMergeNumberedShots(preparedItems);
    preparedItems = mergeRes.items;
    shotMergedCount += mergeRes.mergedCount;
  }

  // 2. Apply deterministic typo corrections to existing fields
  let cleanedLocation = scene.location || '';
  let cleanedRealLocation = scene.realLocation || '';
  let cleanedTimeOfDay = scene.timeOfDay || 'Day / INT';

  if (options.correctTamilTypos !== false) {
    const locRes = applyTypoCorrections(cleanedLocation);
    cleanedLocation = locRes.text;
    typosCount += locRes.count;

    const realLocRes = applyTypoCorrections(cleanedRealLocation);
    cleanedRealLocation = realLocRes.text;
    typosCount += realLocRes.count;

    const timeRes = applyTypoCorrections(cleanedTimeOfDay);
    cleanedTimeOfDay = timeRes.text;
    typosCount += timeRes.count;
  }

  // 3. Compact representation of the scene items for LLM
  const simplifiedItems = preparedItems.map((item, idx) => {
    return {
      index: idx + 1,
      type: item.type,
      column: item.column,
      leftAction: item.leftAction || '',
      rightCharacter: item.rightCharacter || '',
      rightDialogue: item.rightDialogue || '',
      rightAudioSfx: item.rightAudioSfx || '',
      rawText: item.rawText || '',
    };
  });

  const prompt = `You are an expert Kollywood Screenplay Script Supervisor & 2-Column Formatting AI Engine.
Analyze the following scene from a 2-column Kollywood script and align it to perfection.

INPUT SCENE DETAILS:
- Scene Number: "${scene.sceneNumber || ''}"
- Script Location: "${cleanedLocation}"
- Real Location: "${cleanedRealLocation}"
- Time / Setting: "${cleanedTimeOfDay}"
- Existing Characters: ${JSON.stringify(scene.characters || [])}
- Effects: "${scene.effects || 'None'}"

RAW SCENE ITEMS:
${JSON.stringify(simplifiedItems, null, 2)}

ALIGNMENT RULES:
1. COLUMNS:
   - "left" (காட்சி / Action): Visual action, camera direction, scene description, character movement, environment, numbered shots (e.g. "1. லாங் ஷாட் - காட்டின் நடுவே ஒரு புழுதி பாதை.-").
   - "right" (வசனம் / Dialogue): Character dialogue. Must have "rightCharacter" (Name of speaking character) and "rightDialogue" (Spoken dialogue line). If dialogue has an audio cue (e.g. V.O., O.S., போனில்), put it in "rightAudioSfx".
   - "center" (மாண்டேஜ் / Transition): Scene transitions ("CUT TO:", "FADE OUT:", "மாண்டேஜ்", "TITLE", "இடைவேளை").
2. NUMBERED SHOTS:
   - When action lines are numbered shots (e.g. 1., 2.), ensure they start cleanly with "1. ", "2. " and end with a dash "-" if standard in Kollywood scripts.
3. CONTINUOUS DIALOGUE:
   - If the same character speaks again immediately after an action beat without an intervening speaker, set "isContinuous": true.
4. HEADINGS STANDARDIZATION:
   - Standardize "sceneNumber" (e.g. "1", "12", "15A").
   - "location": Clean story script location (e.g. "முத்தனூர் - கருப்பனூர் கிராமம்").
   - "realLocation": Real shooting location if specified, otherwise repeat location.
   - "timeOfDay": Clean lighting & setting (e.g. "Day / INT", "Night / EXT", "பகல் / INT", "இரவு / EXT").
   - "characters": Array of distinct speaking and principal characters in this scene.
   - "effects": Sound or practical visual effects (e.g. "மழை", "வெடிச்சத்தம்", "None").
5. FIDELITY & NO DATA LOSS:
   - CRITICAL: DO NOT omit, truncate, summarize, or hallucinate content. Every single spoken word and action beat must be preserved verbatim.
6. TYPO CORRECTIONS:
   - Fix obvious Tamil phonetic and Word export typos (e.g. "பகள்" -> "பகல்", "அனிந்து" -> "அணிந்து", "பதட்டம்" -> "பதற்றம்").

OUTPUT FORMAT: Return ONLY a raw JSON object with this exact structure:
{
  "sceneNumber": string,
  "location": string,
  "realLocation": string,
  "timeOfDay": string,
  "characters": string[],
  "effects": string,
  "items": [
    {
      "column": "left" | "right" | "center",
      "type": "action" | "dialogue" | "transition",
      "leftAction": string,
      "rightCharacter": string,
      "rightDialogue": string,
      "rightAudioSfx": string,
      "isContinuous": boolean,
      "rawText": string
    }
  ]
}`;

  let parsedResponse: any = null;
  try {
    parsedResponse = await callAiJson(prompt, model, openRouterApiKey);
  } catch (err) {
    console.warn(`[AI Alignment] LLM call failed for Scene ${scene.sceneNumber}, falling back to deterministic alignment.`, err);
  }

  let finalSceneNumber = scene.sceneNumber;
  let finalLocation = cleanedLocation;
  let finalRealLocation = cleanedRealLocation;
  let finalTimeOfDay = cleanedTimeOfDay;
  let finalCharacters = scene.characters || [];
  let finalEffects = scene.effects || 'None';
  let finalItems: TamilScriptItem[] = [];

  let actionsAligned = 0;
  let dialoguesAligned = 0;
  let headingsStandardized = 0;

  if (parsedResponse && typeof parsedResponse === 'object' && Array.isArray(parsedResponse.items) && parsedResponse.items.length > 0) {
    // Successfully received AI alignment!
    if (parsedResponse.sceneNumber) {
      finalSceneNumber = String(parsedResponse.sceneNumber).trim();
      if (finalSceneNumber !== scene.sceneNumber) headingsStandardized++;
    }
    if (parsedResponse.location) {
      finalLocation = String(parsedResponse.location).trim();
      if (finalLocation !== scene.location) headingsStandardized++;
    }
    if (parsedResponse.realLocation) {
      finalRealLocation = String(parsedResponse.realLocation).trim();
    }
    if (parsedResponse.timeOfDay) {
      finalTimeOfDay = String(parsedResponse.timeOfDay).trim();
      if (finalTimeOfDay !== scene.timeOfDay) headingsStandardized++;
    }
    if (Array.isArray(parsedResponse.characters) && parsedResponse.characters.length > 0) {
      finalCharacters = parsedResponse.characters.map((c: any) => String(c).trim()).filter(Boolean);
    }
    if (parsedResponse.effects) {
      finalEffects = String(parsedResponse.effects).trim();
    }

    finalItems = parsedResponse.items.map((item: any, idx: number) => {
      const originalItem = preparedItems[idx];
      const baseId = originalItem?.id || `item-${Date.now()}-${idx}`;

      const col = (item.column === 'left' || item.column === 'right' || item.column === 'center')
        ? item.column
        : (item.rightCharacter && item.rightDialogue ? 'right' : 'left');

      const itemType = (item.type === 'action' || item.type === 'dialogue' || item.type === 'transition')
        ? item.type
        : (col === 'right' ? 'dialogue' : col === 'center' ? 'transition' : 'action');

      let leftAction = item.leftAction ? String(item.leftAction).trim() : undefined;
      let rightChar = item.rightCharacter ? String(item.rightCharacter).trim() : undefined;
      let rightDia = item.rightDialogue ? String(item.rightDialogue).trim() : undefined;
      let rightAudio = item.rightAudioSfx ? String(item.rightAudioSfx).trim() : undefined;
      let rawText = item.rawText ? String(item.rawText).trim() : undefined;

      // Handle continuous dialogue parenthetical tag
      if (item.isContinuous && rightDia && !rightDia.startsWith('(continues)') && !rightDia.startsWith('(தொடர்ந்து)')) {
        const isTamil = /[\u0B80-\u0BFF]/.test(rightDia);
        rightDia = isTamil ? `(தொடர்ந்து) ${rightDia}` : `(continues) ${rightDia}`;
      }

      // Apply typo correction
      if (options.correctTamilTypos !== false) {
        if (leftAction) {
          const res = applyTypoCorrections(leftAction);
          leftAction = res.text;
          typosCount += res.count;
        }
        if (rightChar) {
          const res = applyTypoCorrections(rightChar);
          rightChar = res.text;
          typosCount += res.count;
        }
        if (rightDia) {
          const res = applyTypoCorrections(rightDia);
          rightDia = res.text;
          typosCount += res.count;
        }
        if (rawText) {
          const res = applyTypoCorrections(rawText);
          rawText = res.text;
          typosCount += res.count;
        }
      }

      if (col === 'left') actionsAligned++;
      if (col === 'right') dialoguesAligned++;

      return {
        id: baseId,
        type: itemType,
        column: col,
        leftAction: leftAction || (col === 'left' ? rawText || '' : undefined),
        rightCharacter: rightChar,
        rightDialogue: rightDia,
        rightAudioSfx: rightAudio,
        rawText: rawText || (col === 'right' ? `${rightChar || ''} : ${rightDia || ''}` : leftAction || ''),
        updatedAt: Date.now(),
      };
    });
  } else {
    // Fallback: apply deterministic alignment directly to prepared items
    finalItems = preparedItems.map((item) => {
      let leftAction = item.leftAction;
      let rightChar = item.rightCharacter;
      let rightDia = item.rightDialogue;
      let col = item.column;
      let itemType = item.type;

      // Detect if leftAction looks like dialogue "Character : Dialogue"
      if (col === 'left' && leftAction && leftAction.includes(':')) {
        const parts = leftAction.split(':');
        const possibleChar = parts[0].trim();
        const possibleDia = parts.slice(1).join(':').trim();
        if (possibleChar.length <= 30 && possibleDia.length > 0 && !possibleChar.includes('.')) {
          col = 'right';
          itemType = 'dialogue';
          rightChar = possibleChar;
          rightDia = possibleDia;
          leftAction = undefined;
          dialoguesAligned++;
        }
      }

      if (options.correctTamilTypos !== false) {
        if (leftAction) {
          const res = applyTypoCorrections(leftAction);
          leftAction = res.text;
          typosCount += res.count;
        }
        if (rightChar) {
          const res = applyTypoCorrections(rightChar);
          rightChar = res.text;
          typosCount += res.count;
        }
        if (rightDia) {
          const res = applyTypoCorrections(rightDia);
          rightDia = res.text;
          typosCount += res.count;
        }
      }

      if (col === 'left') actionsAligned++;
      if (col === 'right') dialoguesAligned++;

      return {
        ...item,
        type: itemType,
        column: col,
        leftAction,
        rightCharacter: rightChar,
        rightDialogue: rightDia,
        updatedAt: Date.now(),
      };
    });
  }

  const sluglineText = `sc no: ${finalSceneNumber}${finalLocation ? `     Script Location: ${finalLocation}` : ''}${finalTimeOfDay ? `     Time: ${finalTimeOfDay}` : ''}`;

  const updatedScene: TamilScene = {
    ...scene,
    sceneNumber: finalSceneNumber,
    location: finalLocation,
    realLocation: finalRealLocation,
    timeOfDay: finalTimeOfDay,
    sluglineText,
    characters: finalCharacters,
    effects: finalEffects,
    items: finalItems,
  };

  const stats: AlignmentStats = {
    actionsAligned,
    dialoguesAligned,
    shotNumbersMerged: shotMergedCount,
    typosCorrected: typosCount,
    headingsStandardized,
  };

  return { scene: updatedScene, stats };
}

/**
 * Background manager for batch alignment of the entire 200-page screenplay.
 * Provides pause, resume, cancel, and reactive progress notifications.
 */
export class AiScriptAlignmentManager {
  private state: AlignmentProgressState = {
    isRunning: false,
    isPaused: false,
    totalScenes: 0,
    completedCount: 0,
    currentSceneNumber: '',
    currentSceneLocation: '',
    percent: 0,
    startTime: 0,
    estimatedSecondsRemaining: 0,
    processedSceneIds: [],
    failedSceneIds: [],
    stats: {
      actionsAligned: 0,
      dialoguesAligned: 0,
      shotNumbersMerged: 0,
      typosCorrected: 0,
      headingsStandardized: 0,
    },
  };

  private listeners: Set<ProgressListener> = new Set();
  private abortController: AbortController | null = null;
  private queue: TamilScene[] = [];
  private onSceneCompletedCb: SceneCompletedCallback | null = null;
  private options: AlignmentOptions = {};

  public getState(): AlignmentProgressState {
    return { ...this.state, stats: { ...this.state.stats } };
  }

  public subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((l) => l(currentState));
  }

  public async startBatch(
    scenesToProcess: TamilScene[],
    options: AlignmentOptions = {},
    onSceneCompleted: SceneCompletedCallback
  ) {
    if (this.state.isRunning) {
      console.warn('AI Script Alignment is already running.');
      return;
    }

    if (!scenesToProcess || scenesToProcess.length === 0) return;

    this.queue = [...scenesToProcess];
    this.onSceneCompletedCb = onSceneCompleted;
    this.options = options;
    this.abortController = new AbortController();

    this.state = {
      isRunning: true,
      isPaused: false,
      totalScenes: scenesToProcess.length,
      completedCount: 0,
      currentSceneNumber: scenesToProcess[0]?.sceneNumber || '#1',
      currentSceneLocation: scenesToProcess[0]?.location || 'LOCATION',
      percent: 0,
      startTime: Date.now(),
      estimatedSecondsRemaining: Math.ceil(scenesToProcess.length * 1.5),
      processedSceneIds: [],
      failedSceneIds: [],
      stats: {
        actionsAligned: 0,
        dialoguesAligned: 0,
        shotNumbersMerged: 0,
        typosCorrected: 0,
        headingsStandardized: 0,
      },
    };

    this.notify();
    this.runQueue();
  }

  public pause() {
    if (this.state.isRunning && !this.state.isPaused) {
      this.state.isPaused = true;
      this.notify();
    }
  }

  public resume() {
    if (this.state.isRunning && this.state.isPaused) {
      this.state.isPaused = false;
      this.notify();
    }
  }

  public cancel() {
    if (this.state.isRunning) {
      if (this.abortController) {
        this.abortController.abort();
      }
      this.queue = [];
      this.state.isRunning = false;
      this.state.isPaused = false;
      this.notify();
    }
  }

  private async runQueue() {
    while (this.queue.length > 0 && this.state.isRunning) {
      if (this.state.isPaused) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }

      if (this.abortController?.signal.aborted) {
        break;
      }

      const scene = this.queue.shift();
      if (!scene) break;

      this.state.currentSceneNumber = scene.sceneNumber || `#${scene.id}`;
      this.state.currentSceneLocation = scene.location || 'LOCATION';
      this.notify();

      let retryCount = 0;
      let success = false;
      let updatedScene: TamilScene = scene;
      let sceneStats: AlignmentStats = {
        actionsAligned: 0,
        dialoguesAligned: 0,
        shotNumbersMerged: 0,
        typosCorrected: 0,
        headingsStandardized: 0,
      };

      while (retryCount <= 2 && !success) {
        if (this.abortController?.signal.aborted) break;

        try {
          const res = await alignSingleScene(scene, this.options);
          updatedScene = res.scene;
          sceneStats = res.stats;
          success = true;
        } catch (err: any) {
          retryCount++;
          console.warn(`[AI Alignment] Retry ${retryCount}/2 for Scene ${scene.sceneNumber}:`, err);
          if (retryCount <= 2) {
            // Exponential backoff
            await new Promise((r) => setTimeout(r, retryCount * 1200));
          }
        }
      }

      if (success) {
        this.state.completedCount++;
        this.state.processedSceneIds.push(scene.id);
        this.state.stats.actionsAligned += sceneStats.actionsAligned;
        this.state.stats.dialoguesAligned += sceneStats.dialoguesAligned;
        this.state.stats.shotNumbersMerged += sceneStats.shotNumbersMerged;
        this.state.stats.typosCorrected += sceneStats.typosCorrected;
        this.state.stats.headingsStandardized += sceneStats.headingsStandardized;

        if (this.onSceneCompletedCb) {
          try {
            this.onSceneCompletedCb(updatedScene, sceneStats);
          } catch (cbErr) {
            console.error('[AI Alignment] Error in onSceneCompleted callback:', cbErr);
          }
        }
      } else {
        console.error(`[AI Alignment] Failed Scene ${scene.sceneNumber}`);
        this.state.failedSceneIds.push(scene.id);
      }

      // Update ETA and progress percentage
      const elapsedMs = Date.now() - this.state.startTime;
      const avgMsPerScene = elapsedMs / Math.max(1, this.state.completedCount);
      const remainingScenes = this.queue.length;
      this.state.estimatedSecondsRemaining = Math.max(0, Math.ceil((remainingScenes * avgMsPerScene) / 1000));
      this.state.percent = Math.min(
        100,
        Math.round(((this.state.totalScenes - remainingScenes) / this.state.totalScenes) * 100)
      );

      this.notify();

      // Gentle pause between scenes to respect API rate limits
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    this.state.isRunning = false;
    this.state.isPaused = false;
    this.notify();
  }
}

export const aiScriptAlignmentManager = new AiScriptAlignmentManager();
