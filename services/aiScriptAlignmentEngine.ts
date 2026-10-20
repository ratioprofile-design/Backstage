import { TamilScene, TamilScriptItem, TamilScreenplayData } from './tamilLeftRightEngine';
import { callAiJson } from './gemini';

export interface AlignmentStats {
  actionsAligned: number;
  dialoguesAligned: number;
  dialoguesExtractedFromAction: number;
  characterMismatchesResolved: number;
  shotNumbersMerged: number;
  typosCorrected: number;
  headingsStandardized: number;
}

export interface ScriptCastRegistry {
  canonicalCharacters: string[];
  aliasMap: Record<string, string>;
  characterCounts: Record<string, number>;
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
  detectedCastCount?: number;
}

export interface AlignmentOptions {
  model?: string;
  openRouterApiKey?: string;
  mergeNumberedShots?: boolean;
  standardizeHeadings?: boolean;
  detectContinuousDialogue?: boolean;
  correctTamilTypos?: boolean;
  extractDialogueFromAction?: boolean;
  resolveCharacterMismatches?: boolean;
  startSceneIndex?: number;
  endSceneIndex?: number;
  castRegistry?: ScriptCastRegistry;
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
  [/நாற்காளியில்/g, 'நாற்காளியில்'],
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
 * Standard Levenshtein distance helper for typographical character name clustering.
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Phase 1: Studies the entire screenplay across all 200 pages.
 * Scans every scene, dialogue speaker, and action description to compile a script-wide
 * Canonical Cast Registry and Alias Map for resolving character name mismatches.
 */
export function studyScriptCastAndStructure(scenes: TamilScene[]): ScriptCastRegistry {
  const counts: Record<string, number> = {};

  const ignoreTerms = new Set([
    'காட்சி', 'இடம்', 'நேரம்', 'வகை', 'பகல்', 'இரவு', 'SCENE', 'LOCATION', 'TIME',
    'DAY', 'NIGHT', 'CUT TO', 'FADE IN', 'FADE OUT', 'MONTAGE', 'மாண்டேஜ்', 'வசனம்',
    'நடிகர்கள்', 'கதாபாத்திரங்கள்', 'EXT', 'INT', 'TITLE', 'SONG', 'NONE', 'None',
    'FIGHT', 'CHASE', 'CG', 'SFX', 'LIGHT', 'BGM'
  ]);

  const cleanRawName = (raw: string): string => {
    return raw
      .replace(/^[–—\-\s,:\(\)\[\]"“'‘n]+|[–—\-\s,:\(\)\[\]"”'’]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  scenes.forEach((scene) => {
    // 1. Explicit scene characters from metadata
    if (Array.isArray(scene.characters)) {
      scene.characters.forEach((c) => {
        const cleaned = cleanRawName(c);
        if (cleaned && !ignoreTerms.has(cleaned.toUpperCase()) && cleaned.length >= 2 && cleaned.length <= 35) {
          counts[cleaned] = (counts[cleaned] || 0) + 2;
        }
      });
    }

    // 2. Dialogue character speakers in scene items
    if (Array.isArray(scene.items)) {
      scene.items.forEach((item) => {
        if (item.rightCharacter) {
          const cleaned = cleanRawName(item.rightCharacter);
          if (cleaned && !ignoreTerms.has(cleaned.toUpperCase()) && cleaned.length >= 2 && cleaned.length <= 35) {
            counts[cleaned] = (counts[cleaned] || 0) + 4; // Weight dialogue speaker higher
          }
        }

        // 3. Scan action text for character names before colons (e.g. "பால்ராஜ்:")
        const actionText = item.leftAction || item.rawText || '';
        const colonMatches = actionText.matchAll(/(?:^|[\n.\s])([A-Za-z\u0B80-\u0BFF\s.'-]{2,25}):/g);
        for (const m of colonMatches) {
          const cleaned = cleanRawName(m[1]);
          if (cleaned && !ignoreTerms.has(cleaned.toUpperCase()) && cleaned.length >= 2 && cleaned.length <= 35) {
            counts[cleaned] = (counts[cleaned] || 0) + 3;
          }
        }
      });
    }
  });

  const canonicalMap: Record<string, string> = {};
  const aliasMap: Record<string, string> = {};

  // Sort by occurrence frequency descending
  const sortedNames = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  // Pass 1: Whitespace collapsing (e.g. 'ஆனந்து ராஜ்' -> 'ஆனந்துராஜ்')
  for (const name of sortedNames) {
    const collapsed = name.replace(/\s+/g, '');
    if (!canonicalMap[collapsed]) {
      canonicalMap[collapsed] = name;
    } else {
      aliasMap[name] = canonicalMap[collapsed];
    }
  }

  // Pass 2: Tamil typographical letters (ல் vs ள், ன vs ண, ர vs ற) and Levenshtein clustering
  for (let i = 0; i < sortedNames.length; i++) {
    const higher = sortedNames[i];
    const higherCanonical = aliasMap[higher] || higher;

    for (let j = i + 1; j < sortedNames.length; j++) {
      const lower = sortedNames[j];
      if (aliasMap[lower]) continue;

      const higherNorm = higherCanonical.replace(/\s+/g, '');
      const lowerNorm = lower.replace(/\s+/g, '');

      // Check common phonetic slip letters
      const typoMatched =
        higherNorm.replace(/ல்/g, 'ள்') === lowerNorm.replace(/ல்/g, 'ள்') ||
        higherNorm.replace(/ன/g, 'ண') === lowerNorm.replace(/ன/g, 'ண') ||
        higherNorm.replace(/ர/g, 'ற') === lowerNorm.replace(/ர/g, 'ற');

      const levDist = getLevenshteinDistance(higherNorm, lowerNorm);
      const isClose = levDist <= (higherNorm.length > 5 ? 2 : 1);

      if (typoMatched || isClose) {
        aliasMap[lower] = higherCanonical;
      }
    }
  }

  // Distinct canonical names
  const canonicalSet = new Set<string>();
  for (const name of sortedNames) {
    const canonical = aliasMap[name] || name;
    canonicalSet.add(canonical);
  }

  return {
    canonicalCharacters: Array.from(canonicalSet),
    aliasMap,
    characterCounts: counts,
  };
}

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
 * Merges split numbered shots like "1." on one row and "Long shot of village..." on next row.
 */
export function preMergeNumberedShots(items: TamilScriptItem[]): { items: TamilScriptItem[]; mergedCount: number } {
  const result: TamilScriptItem[] = [];
  let mergedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    const curText = (current.leftAction || current.rawText || '').trim();

    const isHangingNumber = /^(\(?\d+[\.\)]\s*)$/.test(curText);

    if (isHangingNumber && i + 1 < items.length) {
      const next = items[i + 1];
      const nextText = (next.leftAction || next.rawText || '').trim();
      if (nextText) {
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
        i++;
        continue;
      }
    }

    result.push(current);
  }

  return { items: result, mergedCount };
}

/**
 * Line-by-Line Disentanglement:
 * Studies each item and extracts embedded dialogue out of action descriptions,
 * or moves physical actions embedded in dialogue boxes to the Left column.
 * Resolves character name mismatches against the canonical cast list.
 */
export function disentangleItemsLineByLine(
  items: TamilScriptItem[],
  castRegistry?: ScriptCastRegistry
): { items: TamilScriptItem[]; extractedCount: number; mismatchCount: number } {
  const result: TamilScriptItem[] = [];
  let extractedCount = 0;
  let mismatchCount = 0;

  const aliasMap = castRegistry?.aliasMap || {};
  const canonicalChars = castRegistry?.canonicalCharacters || [];
  const knownCastSet = new Set(canonicalChars.map((c) => c.toLowerCase()));

  const resolveCharacter = (rawChar: string): string => {
    let cleaned = rawChar.replace(/^[–—\-\s,:\(\)\[\]"“'‘n]+|[–—\-\s,:\(\)\[\]"”'’]+$/g, '').trim();
    if (aliasMap[cleaned]) {
      mismatchCount++;
      return aliasMap[cleaned];
    }
    const noSpace = cleaned.replace(/\s+/g, '');
    for (const [alias, canonical] of Object.entries(aliasMap)) {
      if (alias.replace(/\s+/g, '') === noSpace) {
        mismatchCount++;
        return canonical;
      }
    }
    return cleaned;
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // CASE 1: Item is in Left Column (Action) or raw, but contains embedded dialogue!
    if (item.column === 'left' || item.type === 'action') {
      const text = (item.leftAction || item.rawText || '').trim();

      // Check for inline colon dialogue: e.g. "முத்துக்காளை அருகே சென்ற ஆனந்துராஜ் ஆனந்துராஜ்: Am sorry.."
      const colonMatch = text.match(/^(.*?)(?:,\s*|\.\s+|\s+|^)([A-Za-z\u0B80-\u0BFF\s.'-]{2,25}):\s*(.+)$/s);
      if (colonMatch) {
        const actionPart = colonMatch[1].trim();
        const rawSpeaker = colonMatch[2].trim();
        const diaPart = colonMatch[3].trim();

        const resolvedSpeaker = resolveCharacter(rawSpeaker);

        if (actionPart) {
          result.push({
            id: `action-${Date.now()}-${result.length}`,
            type: 'action',
            column: 'left',
            leftAction: actionPart,
            rawText: actionPart,
            updatedAt: Date.now(),
          });
        }

        result.push({
          id: `dia-${Date.now()}-${result.length}`,
          type: 'dialogue',
          column: 'right',
          rightCharacter: resolvedSpeaker,
          rightDialogue: diaPart,
          rawText: `${resolvedSpeaker} : ${diaPart}`,
          updatedAt: Date.now(),
        });

        extractedCount++;
        continue;
      }

      // Check for quoted dialogue inside action: e.g. 'சங்கிலி முறைத்து "மரியாதையா நில்லுடா" என்கிறான்.'
      const quoteMatch = text.match(/^(.*?)(?:["“'‘]([^"”'’]{3,})["”'’])\s*(?:என்று\s*(?:சொல்ல|கேட்க|கத்த|கூற|உறும|பதற)|என்கிறான்|என்கிறாள்|சொல்கிறான்|சொல்கிறாள்|கேட்கிறான்|கத்துகிறான்)?(.*)$/s);
      if (quoteMatch) {
        const actionBefore = quoteMatch[1].trim();
        const quotedSpeech = quoteMatch[2].trim();
        const actionAfter = quoteMatch[3].trim();

        // Attempt to identify speaker from preceding action or known cast
        let identifiedSpeaker = '';
        for (const castMember of canonicalChars) {
          if (actionBefore.includes(castMember)) {
            identifiedSpeaker = castMember;
            break;
          }
        }

        if (identifiedSpeaker) {
          const combinedAction = `${actionBefore} ${actionAfter}`.replace(/\s+/g, ' ').trim();
          if (combinedAction) {
            result.push({
              id: `action-${Date.now()}-${result.length}`,
              type: 'action',
              column: 'left',
              leftAction: combinedAction,
              rawText: combinedAction,
              updatedAt: Date.now(),
            });
          }

          result.push({
            id: `dia-${Date.now()}-${result.length}`,
            type: 'dialogue',
            column: 'right',
            rightCharacter: identifiedSpeaker,
            rightDialogue: quotedSpeech,
            rawText: `${identifiedSpeaker} : ${quotedSpeech}`,
            updatedAt: Date.now(),
          });

          extractedCount++;
          continue;
        }
      }
    }

    // CASE 2: Item is in Right Column (Dialogue), check character name mismatch and embedded physical action
    if (item.column === 'right' || item.type === 'dialogue') {
      let charName = (item.rightCharacter || '').trim();
      let dialogueText = (item.rightDialogue || item.rawText || '').trim();

      // Resolve character name mismatch
      if (charName) {
        const resolved = resolveCharacter(charName);
        if (resolved !== charName) {
          charName = resolved;
          mismatchCount++;
        }
      }

      // Check if dialogue text begins with physical action in parentheses e.g. "(அருள் விலங்கை மாட்டுவது) Arrest him!"
      const parenMatch = dialogueText.match(/^\(([^)]+)\)\s*(.+)$/s);
      if (parenMatch) {
        const parenContent = parenMatch[1].trim();
        const pureSpeech = parenMatch[2].trim();

        // If it's a physical action (longer than 12 chars or contains action verbs)
        const isPhysicalAction =
          parenContent.length > 12 ||
          /(?:சென்று|வந்து|எடுத்து|போட்டு|மாட்டுவது|ஓடி|குதித்து|நடந்து|அடிக்கிறான்|பார்க்கிறான்)/.test(parenContent);

        if (isPhysicalAction) {
          result.push({
            id: `action-${Date.now()}-${result.length}`,
            type: 'action',
            column: 'left',
            leftAction: parenContent,
            rawText: parenContent,
            updatedAt: Date.now(),
          });
          dialogueText = pureSpeech;
          extractedCount++;
        }
      }

      result.push({
        ...item,
        rightCharacter: charName,
        rightDialogue: dialogueText,
      });
      continue;
    }

    result.push(item);
  }

  return { items: result, extractedCount, mismatchCount };
}

/**
 * Formats and aligns a single scene using AI (Gemini / OpenRouter) with line-by-line
 * dialogue-action disentanglement and character mismatch resolution.
 */
export async function alignSingleScene(
  scene: TamilScene,
  options: AlignmentOptions = {}
): Promise<{ scene: TamilScene; stats: AlignmentStats }> {
  const model = options.model || 'gemini-flash-latest';
  const openRouterApiKey = options.openRouterApiKey;
  let typosCount = 0;
  let shotMergedCount = 0;
  let extractedDialogueCount = 0;
  let characterMismatchCount = 0;

  const castRegistry = options.castRegistry || studyScriptCastAndStructure([scene]);

  // 1. Pre-merge split numbered shots deterministically
  let preparedItems = [...scene.items];
  if (options.mergeNumberedShots !== false) {
    const mergeRes = preMergeNumberedShots(preparedItems);
    preparedItems = mergeRes.items;
    shotMergedCount += mergeRes.mergedCount;
  }

  // 2. Deterministic line-by-line disentanglement of dialogue & action
  if (options.extractDialogueFromAction !== false || options.resolveCharacterMismatches !== false) {
    const disentangleRes = disentangleItemsLineByLine(preparedItems, castRegistry);
    preparedItems = disentangleRes.items;
    extractedDialogueCount += disentangleRes.extractedCount;
    characterMismatchCount += disentangleRes.mismatchCount;
  }

  // 3. Apply deterministic typo corrections to existing fields
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

  // 4. Compact representation of the scene items for LLM
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

  const prompt = `You are an elite Kollywood Screenplay Script Supervisor & 2-Column Formatting AI Engine.
You must study this scene LINE-BY-LINE to disentangle mixed action descriptions, extract embedded dialogues,
and resolve character name mismatches so every element is positioned into its respective column.

SCRIPT-WIDE CANONICAL CAST REGISTRY (Use these exact standard character names):
${JSON.stringify(castRegistry.canonicalCharacters)}

KNOWN CHARACTER ALIASES / TYPO MAPPINGS:
${JSON.stringify(castRegistry.aliasMap)}

INPUT SCENE DETAILS:
- Scene Number: "${scene.sceneNumber || ''}"
- Script Location: "${cleanedLocation}"
- Real Location: "${cleanedRealLocation}"
- Time / Setting: "${cleanedTimeOfDay}"
- Existing Characters: ${JSON.stringify(scene.characters || [])}
- Effects: "${scene.effects || 'None'}"

RAW SCENE ITEMS TO STUDY LINE-BY-LINE:
${JSON.stringify(simplifiedItems, null, 2)}

STRICT LINE-BY-LINE STUDY & POSITIONING RULES:
1. EMBEDDED DIALOGUE IN ACTION DESCRIPTIONS:
   - Study every sentence of action description line-by-line.
   - If an action description contains spoken dialogue (e.g. quotes "...", colons 'Character: Dialogue', or reporting verbs like 'என்று சொல்ல', 'என்று கேட்க', 'என்கிறான்', 'கத்துகிறான்'), you MUST EXTRACT the dialogue out of the action description!
   - Position them into their RESPECTIVE COLUMNS:
     * Visual action / physical movement stays on the "left" column (காட்சி).
     * The spoken words go to the "right" column (வசனம்) with the speaking character.
2. EMBEDDED ACTION IN DIALOGUE:
   - If a dialogue item contains physical actions (e.g. "(அருள் விலங்கை மாட்டுவது) Arrest him!"), extract the physical action to the "left" column, and keep only the vocal speech on the "right" column.
3. CHARACTER NAME MISMATCH RESOLUTION:
   - Match all character names against the Canonical Cast Registry above.
   - Resolve all typos, spacing mismatches, and honorifics (e.g. 'பெருமால்சாமி' -> 'பெருமாள்சாமி', 'ஆனந்து ராஜ்' -> 'ஆனந்துராஜ்', 'paster' -> 'பாஸ்டர்').
   - If an action sentence introduces who speaks, assign the dialogue to that exact character.
4. RESPECTIVE COLUMNS:
   - "left" (காட்சி / Action): Visual action, camera direction, scene description, character movement, environment, numbered shots (e.g. "1. லாங் ஷாட் - காட்டின் நடுவே ஒரு புழுதி பாதை.-").
   - "right" (வசனம் / Dialogue): Character dialogue. Must have "rightCharacter" (Canonical Name) and "rightDialogue" (Spoken dialogue line). If dialogue has an audio cue (e.g. V.O., O.S., போனில்), put it in "rightAudioSfx".
   - "center" (மாண்டேஜ் / Transition): Scene transitions ("CUT TO:", "FADE OUT:", "மாண்டேஜ்", "TITLE", "இடைவேளை").
5. CONTINUOUS DIALOGUE:
   - If the same character speaks again immediately after an action beat without an intervening speaker, set "isContinuous": true.
6. HEADINGS STANDARDIZATION:
   - Standardize "sceneNumber", "location", "realLocation", "timeOfDay", "characters", "effects".
7. FIDELITY & NO DATA LOSS:
   - CRITICAL: DO NOT omit, truncate, summarize, or hallucinate content. Every single spoken word and action beat must be preserved verbatim.

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
    console.warn(`[AI Alignment] LLM call failed for Scene ${scene.sceneNumber}, using deterministic line-by-line alignment.`, err);
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
      finalCharacters = parsedResponse.characters.map((c: any) => {
        const cleaned = String(c).trim();
        return castRegistry.aliasMap[cleaned] || cleaned;
      }).filter(Boolean);
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

      // Canonicalize character name from alias map
      if (rightChar) {
        const canonical = castRegistry.aliasMap[rightChar] || rightChar;
        if (canonical !== rightChar) {
          characterMismatchCount++;
          rightChar = canonical;
        }
      }

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

      // Canonicalize character name from alias map
      if (rightChar && castRegistry.aliasMap[rightChar]) {
        rightChar = castRegistry.aliasMap[rightChar];
        characterMismatchCount++;
      }

      // Detect if leftAction looks like dialogue "Character : Dialogue"
      if (col === 'left' && leftAction && leftAction.includes(':')) {
        const parts = leftAction.split(':');
        const possibleChar = parts[0].trim();
        const possibleDia = parts.slice(1).join(':').trim();
        if (possibleChar.length <= 30 && possibleDia.length > 0 && !possibleChar.includes('.')) {
          col = 'right';
          itemType = 'dialogue';
          rightChar = castRegistry.aliasMap[possibleChar] || possibleChar;
          rightDia = possibleDia;
          leftAction = undefined;
          dialoguesAligned++;
          extractedDialogueCount++;
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
    dialoguesExtractedFromAction: extractedDialogueCount,
    characterMismatchesResolved: characterMismatchCount,
    shotNumbersMerged: shotMergedCount,
    typosCorrected: typosCount,
    headingsStandardized,
  };

  return { scene: updatedScene, stats };
}

/**
 * Background manager for batch alignment of the entire 200-page screenplay.
 * First studies the entire script across all 200 pages to build the Canonical Cast Registry,
 * then processes scene-by-scene line-by-line with full disentanglement.
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
    detectedCastCount: 0,
    stats: {
      actionsAligned: 0,
      dialoguesAligned: 0,
      dialoguesExtractedFromAction: 0,
      characterMismatchesResolved: 0,
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
  private castRegistry: ScriptCastRegistry | null = null;

  public getState(): AlignmentProgressState {
    return { ...this.state, stats: { ...this.state.stats } };
  }

  public getCastRegistry(): ScriptCastRegistry | null {
    return this.castRegistry;
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

    // STEP 1: Study entire script across all 200 pages to build Canonical Cast Registry
    console.log(`[AI Alignment] Studying all ${scenesToProcess.length} scenes line-by-line to build Cast Registry...`);
    this.castRegistry = studyScriptCastAndStructure(scenesToProcess);
    console.log(`[AI Alignment] Canonical Cast Registry established with ${this.castRegistry.canonicalCharacters.length} standard characters.`);

    this.queue = [...scenesToProcess];
    this.onSceneCompletedCb = onSceneCompleted;
    this.options = { ...options, castRegistry: this.castRegistry };
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
      detectedCastCount: this.castRegistry.canonicalCharacters.length,
      stats: {
        actionsAligned: 0,
        dialoguesAligned: 0,
        dialoguesExtractedFromAction: 0,
        characterMismatchesResolved: 0,
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
        dialoguesExtractedFromAction: 0,
        characterMismatchesResolved: 0,
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
            await new Promise((r) => setTimeout(r, retryCount * 1200));
          }
        }
      }

      if (success) {
        this.state.completedCount++;
        this.state.processedSceneIds.push(scene.id);
        this.state.stats.actionsAligned += sceneStats.actionsAligned;
        this.state.stats.dialoguesAligned += sceneStats.dialoguesAligned;
        this.state.stats.dialoguesExtractedFromAction += sceneStats.dialoguesExtractedFromAction;
        this.state.stats.characterMismatchesResolved += sceneStats.characterMismatchesResolved;
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

      const elapsedMs = Date.now() - this.state.startTime;
      const avgMsPerScene = elapsedMs / Math.max(1, this.state.completedCount);
      const remainingScenes = this.queue.length;
      this.state.estimatedSecondsRemaining = Math.max(0, Math.ceil((remainingScenes * avgMsPerScene) / 1000));
      this.state.percent = Math.min(
        100,
        Math.round(((this.state.totalScenes - remainingScenes) / this.state.totalScenes) * 100)
      );

      this.notify();

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    this.state.isRunning = false;
    this.state.isPaused = false;
    this.notify();
  }
}

export const aiScriptAlignmentManager = new AiScriptAlignmentManager();
