import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Packer,
  UnderlineType,
} from 'docx';
import { ProductionDocument, BreakdownData } from '../types';

export interface TamilScriptItem {
  id: string;
  type: 'action' | 'dialogue' | 'transition' | 'title' | 'split_row' | 'slugline';
  column: 'left' | 'right' | 'center'; // 'left' = காட்சி (Action), 'right' = வசனம் (Dialogue), 'center' = Title/Transition
  leftAction?: string;
  rightCharacter?: string;
  rightDialogue?: string;
  rightAudioSfx?: string;
  rawText?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textColor?: string;
  isBold?: boolean;
  isItalic?: boolean;
  updatedAt?: number;
}

export interface TamilScene {
  id: string;
  sceneNumber: string;
  location: string; // Script Location (e.g. story world location)
  realLocation?: string; // Real Shooting Location (e.g. sets, live spot)
  timeOfDay: string;
  sluglineText: string;
  characters?: string[];
  effects?: string;
  items: TamilScriptItem[];
  breakdown?: BreakdownData;
}

export interface TamilScreenplayData {
  title: string;
  subtitle?: string;
  scenes: TamilScene[];
  rawText: string;
  hasDialogue: boolean;
}

/**
 * Parses Word (.docx) HTML output produced by Mammoth into structured 2-column Kollywood screenplay format.
 * Adopts standard Kollywood docx formatting conventions:
 * - Bold headings & metadata -> Scene Headings
 * - Bold short lines -> Character Cues
 * - Bold speech text -> Right Column Dialogue
 * - Parentheticals & regular texts -> Left Column Action / Description
 * - Centered markers / transitions -> Centered
 */
export function parseDocxHtmlToTamilLeftRight(rawHtml: string, defaultTitle = 'திரைக்கதை (Screenplay)'): TamilScreenplayData {
  const rawPs = rawHtml.split('</p>').map(p => p.replace(/<p>/g, '').trim()).filter(Boolean);

  const corrections: [RegExp, string][] = [
    [/பகள்/g, 'பகல்'],
    [/கிலை சிறைச்சாலை/g, 'கிளை சிறைச்சாலை'],
    [/வலாகம்/g, 'வளாகம்'],
    [/வளாகத்திற்குள்/g, 'வளாகத்திற்குள்'],
    [/பெருமால் சாமி/g, 'பெருமாள் சாமி'],
    [/முத்தணூர்/g, 'முத்தனூர்'],
    [/கருப்பணூர்/g, 'கருப்பனூர்'],
    [/முரப்படி/g, 'முறைப்படி'],
    [/பொருப்புல/g, 'பொறுப்புல'],
    [/புரோஜனம்/g, 'பிரயோஜனம்'],
    [/முயர்ச்சி/g, 'முயற்சி'],
    [/முயர்சி/g, 'முயற்சி'],
    [/உரவினர்கள்/g, 'உறவினர்கள்'],
    [/குரள்/g, 'குரல்'],
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
    [/DOCTER/g, 'DOCTOR'],
    [/PRESONER/g, 'PRISONER'],
    [/PRESONERS/g, 'PRISONERS'],
    [/DANGER PRESONER/g, 'DANGEROUS PRISONER'],
    [/TWO VILLAGE PEOPLES/g, 'VILLAGERS'],
    [/ATMOSPHERE/g, 'ATMOSPHERE CROWD']
  ];

  function cleanText(s: string): string {
    let t = s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\t+/g, ' | ').replace(/\s+/g, ' ').trim();
    for (const [re, val] of corrections) {
      t = t.replace(re, val);
    }
    return t;
  }

  const sceneHeaderRegex = /^(?:காட்சி(?:\s*எண்)?|Scene(?:\s*no\.?)?|sc\s*no\.?)\s*[:.\s\-]*(\d+(?:[A-Za-z]|[\/-][A-Za-z0-9]+)?)(.*)/i;
  const transitionRegex = /^(?:Fade\s*in:?|Fade\s*out:?|Cut\s*to:?|Dissolve\s*to:?|Montage:?|மாண்டேஜ்:?|காட்சி\s*மாற்றம்:?|இடைவேளை:?|முற்றும்:?|Animation\s*Ends[-:]?|ANIMATION\s*STORY|TITLE|SONG|\(\s*BIT\s*SCENE\s*\)|>\s*.*\s*<|[A-Z\s]+TO:?)$/i;
  const knownActors = new Set(['சசிகுமார்', 'பக்ஸ்', 'லைலா', 'ஜார்ஜ் மரியன்', 'குரு சோமசுந்தரம்', 'மா கா பா']);

  const scenes: TamilScene[] = [];
  let currentScene: TamilScene | null = null;
  let docTitle = defaultTitle;

  let activeChar = '';
  let activeDia: string[] = [];

  function flushActiveSpeech() {
    if (activeChar && activeDia.length > 0 && currentScene) {
      const diaJoined = activeDia.join(' ').trim();
      currentScene.items.push({
        id: `item-${Date.now()}-${currentScene.items.length}`,
        type: 'dialogue',
        column: 'right',
        rightCharacter: activeChar,
        rightDialogue: diaJoined,
        rawText: `${activeChar} : ${diaJoined}`
      });
      if (currentScene.characters && !currentScene.characters.includes(activeChar)) {
        currentScene.characters.push(activeChar);
      }
      activeDia = [];
    }
  }

  function createScene(scNum: string, headerLine: string) {
    flushActiveSpeech();
    activeChar = '';

    let location = '';
    let realLocation = '';
    let timeOfDay = 'Day / INT';
    let effects = 'None';
    let explicitChars: string[] | undefined;

    const locMatch = headerLine.match(/(?:Script\s*Location|Location|இடம்|Loc(?:ation)?)\s*[:\-]?\s*(.*?)(?=\s*(?:Real\s*Location|Time|நேரம்|பகல்|இரவு|EXT|INT|வகை|Type|Effects?|Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast|[-|]|$))/i);
    const realLocMatch = headerLine.match(/(?:Real\s*Location|Real\s*Loc)\s*[:\-]?\s*(.*?)(?=\s*(?:Time|நேரம்|Effects?|Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast|[-|]|$))/i);
    const timeMatch = headerLine.match(/(?:Time|நேரம்)\s*[:\-]?\s*(.*?)(?=\s*(?:Effects?|Real|Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast|[-|]|$))/i);
    const effMatch = headerLine.match(/(?:Effects?|Effect)\s*[:\-]?\s*(.*?)(?=\s*(?:Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast|[-|]|$))/i);
    const inlineCharMatch = headerLine.match(/(?:Characters?(?:\s*\([^)]*\))?|கதாபாத்திரங்கள்(?:\s*\([^)]*\))?|நடிகர்கள்(?:\s*\([^)]*\))?|Actors?|Cast)\s*[:\-]?\s*(.*?)(?=\s*(?:Script\s*Location|Location|Real\s*Location|Time|நேரம்|Effects?|[-|]|$))/i);

    if (locMatch && locMatch[1].trim()) location = locMatch[1].trim();
    if (realLocMatch && realLocMatch[1].trim()) realLocation = realLocMatch[1].trim();
    if (timeMatch && timeMatch[1].trim()) timeOfDay = timeMatch[1].trim();
    if (effMatch && effMatch[1].trim()) effects = effMatch[1].trim();
    if (inlineCharMatch && inlineCharMatch[1].trim()) {
      explicitChars = inlineCharMatch[1].split(/[,;]|\s+and\s+/i).map(c => c.trim().replace(/^[–—\-\s,:]+/, '')).filter(Boolean);
    }

    if (timeOfDay === 'Day / INT') {
      const tMatch = headerLine.match(/(?:பகல்|இரவு|மாலை|காலை|Day|Night|Evening|Morning)/i);
      const ieMatch = headerLine.match(/(?:EXT\/INT|INT\/EXT|EXT|INT)/i);
      if (tMatch || ieMatch) {
        const tStr = tMatch ? tMatch[0] : 'Day';
        const ieStr = ieMatch ? ieMatch[0] : 'INT';
        timeOfDay = `${tStr} / ${ieStr}`;
      }
    }

    const sluglineText = `sc no: ${scNum}${location ? `     Script Location: ${location}` : ''}${timeOfDay ? `     Time: ${timeOfDay}` : ''}`;
    const newScene: TamilScene = {
      id: `scene-${Date.now()}-${scenes.length + 1}`,
      sceneNumber: scNum,
      location: location.replace(/^[|:\-\s]+/, '').trim(),
      realLocation: (realLocation || location).replace(/^[|:\-\s]+/, '').trim(),
      timeOfDay,
      effects,
      sluglineText,
      characters: explicitChars || [],
      items: []
    };
    scenes.push(newScene);
    currentScene = newScene;
  }

  // Default Scene 1
  createScene('1', 'காட்சி: 1 | இடம்: முத்தனூர், கருப்பனூர்.. (split screen) | பகல்');

  for (let i = 0; i < rawPs.length; i++) {
    const raw = rawPs[i];
    const text = cleanText(raw);
    if (!text) continue;

    if (i === 0 && text.toUpperCase() === 'SANGILI') {
      docTitle = text;
      continue;
    }
    if (i === 1 && text.toLowerCase().includes('screenplay')) continue;

    const scMatch = text.match(sceneHeaderRegex);
    if (scMatch && (raw.includes('<strong>') || text.includes('|') || text.includes('இடம்'))) {
      createScene(scMatch[1], text);
      continue;
    }

    if (transitionRegex.test(text) || text === 'CUT TO' || text === 'CUT TO:' || text === 'ANIMATION STORY' || text === 'Animation Ends-' || text === '( BIT SCENE )' || text.startsWith('வருடம்:') || text.startsWith('காலம்:')) {
      flushActiveSpeech();
      activeChar = '';
      if (currentScene) {
        currentScene.items.push({
          id: `item-${Date.now()}-${currentScene.items.length}`,
          type: 'transition',
          column: 'center',
          rawText: text
        });
      }
      continue;
    }

    // Parentheticals: In Kollywood screenplay docx format, parentheticals are strictly action/description (Left column)
    // When placing inside description, remove enclosing brackets
    if (text.startsWith('(')) {
      flushActiveSpeech();
      const cleanedAction = text.replace(/^[(\s]+|[)\s]+$/g, '').trim();
      if (currentScene && cleanedAction) {
        currentScene.items.push({
          id: `item-${Date.now()}-${currentScene.items.length}`,
          type: 'action',
          column: 'left',
          leftAction: cleanedAction,
          rawText: cleanedAction
        });
      }
      continue;
    }

    // Regular unbolded text: Strictly action/description (Left column)
    if (!raw.includes('<strong>')) {
      flushActiveSpeech();
      activeChar = '';
      const cleanedAction = text.replace(/^[(\s]+|[)\s]+$/g, '').trim();
      if (currentScene && cleanedAction) {
        currentScene.items.push({
          id: `item-${Date.now()}-${currentScene.items.length}`,
          type: 'action',
          column: 'left',
          leftAction: cleanedAction,
          rawText: cleanedAction
        });
      }
      continue;
    }

    // Bold text:
    const wordCount = text.split(' ').length;
    const isPunct = /[.?!]$/.test(text) || text.includes('..') || text.includes('?') || text.includes('!');

    if (knownActors.has(text)) continue;

    const isChar = wordCount <= 4 && text.length <= 35 && !isPunct &&
      !text.includes('கொண்டு') && !text.includes('பார்த்து') && !text.includes('சொல்ல') &&
      !text.includes('அப்பொழுது') && !text.includes('நடந்து') && !text.includes('நின்று') &&
      !text.includes('வந்து') && !text.includes('போய்') && !text.includes('ஆரம்பித்த') &&
      !text.includes('சென்று') && !text.includes('கேட்க');

    if (isChar) {
      flushActiveSpeech();
      activeChar = text.replace(/:$/, '').trim();
      continue;
    }

    if (activeChar) {
      activeDia.push(text);
      continue;
    }

    if (currentScene) {
      const cleanedAction = text.replace(/^[(\s]+|[)\s]+$/g, '').trim();
      currentScene.items.push({
        id: `item-${Date.now()}-${currentScene.items.length}`,
        type: 'action',
        column: 'left',
        leftAction: cleanedAction || text,
        rawText: cleanedAction || text
      });
    }
  }
  flushActiveSpeech();

  // If a scene has no explicit metadata characters, fallback to dialogue speaking characters
  for (const sc of scenes) {
    if (!sc.characters || sc.characters.length === 0) {
      const speakingChars = getSceneCharacters(sc);
      if (speakingChars.length > 0) {
        sc.characters = [...speakingChars];
      }
    }
  }

  return {
    title: docTitle,
    scenes,
    rawText: rawHtml,
    hasDialogue: scenes.some(s => s.items.some(it => it.column === 'right'))
  };
}

/**
 * Universal Screenplay & Document Parser
 * Parses single-column Word files, Final Draft / Fountain / Highland, and raw Tamil scripts:
 * - Automatically classifies into Left (Action), Right (Dialogue), or Center (Transition/Title)
 * - Assigns explicit `column` property to every block so user has 100% touch-up control
 */
export function parseScreenplayToTamilLeftRight(text: string, defaultTitle = 'திரைக்கதை (Screenplay)'): TamilScreenplayData {
  const clean = (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!clean) {
    return {
      title: defaultTitle,
      scenes: [],
      rawText: '',
      hasDialogue: false,
    };
  }

  // If text is HTML exported from docx (contains <p> or <strong> tags), route to specialized docx parser
  if (clean.includes('<p>') || clean.includes('<strong>') || clean.includes('</p>')) {
    return parseDocxHtmlToTamilLeftRight(clean, defaultTitle);
  }

  const lines = clean.split('\n').map(l => l.trim());

  let docTitle = defaultTitle;
  let subtitle = '';
  const scenes: TamilScene[] = [];
  let currentScene: TamilScene | null = null;

  // Regex patterns for Tamil & standard cinema conventions
  const tamilSceneHeaderRegex = /^(?:காட்சி(?:\s*எண்)?|Scene(?:\s*no\.?)?|SCENE(?:\s*NO\.?)?|sc\s*no\.?|sc\.?\s*no\.?)\s*[:.\s\-]*(\d+(?:[A-Za-z]|[\/-][A-Za-z0-9]+)?)(.*)/i;
  const intExtHeaderRegex = /^(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+(.+?)(?:[-–—]\s*(NIGHT|DAY|EVENING|MORNING|DAWN|DUSK|LATER|CONTINUOUS|NIG|EXT))?$/i;
  const transitionRegex = /^(?:Fade\s*in:?|Fade\s*out:?|Cut\s*to:?|Dissolve\s*to:?|Fade\s*out\s*[-–—]\s*Fade\s*in|Montage:?|மாண்டேஜ்:?|காட்சி\s*மாற்றம்:?|இடைவேளை:?|முற்றும்:?|>.*<|[A-Z\s]+TO:?)$/i;
  const titleCardRegex = /^(?:TITLE\s*CARD:?|TITLE:?|டைட்டல்\s*கார்டு:?|டைட்டல்:?)$/i;
  
  // Dialogue matching: "சுரேஷ் :" or "சுரேஷ்:" or "கதாபாத்திரம்: வசனம்" or "பாஸ்டர் சேவியர் (சசிகுமார்):"
  const dialogueLineRegex = /^([\u0B80-\u0BFFa-zA-Z0-9\s.()'\-]{2,50})\s*:\s*(.*)$/;
  const sfxRegex = /^(?:SFX\s*:|BGM\s*:|ஒலி\s*:|\[SFX\b|\[BGM\b)/i;

  const knownCharacters = new Set<string>([
    'ஜெயிலர்', 'பாஸ்டர்', 'பாஸ்டர் சேவியர்', 'டாக்டர்', 'சிறை அதிகாரி', 'எஸ்.ஐ', 'காவலர்',
    'அம்மா', 'அப்பா', 'மகன்', 'மகள்', 'மனைவி', 'கணவன்', 'நீதிபதி', 'வக்கீல்'
  ]);

  let lineIdx = 0;
  while (lineIdx < lines.length) {
    const line = lines[lineIdx];
    if (!line) {
      lineIdx++;
      continue;
    }

    // 1. Check for Tamil / Industry Scene Heading (sc no: 1 / காட்சி : 1 ...)
    const tamilSceneMatch = line.match(tamilSceneHeaderRegex);
    if (tamilSceneMatch) {
      const scNum = tamilSceneMatch[1] || `${scenes.length + 1}`;
      const rest = tamilSceneMatch[2] || '';

      let location = '';
      let realLocation = '';
      let timeOfDay = 'Day / INT';
      let effects = 'None';
      let explicitChars: string[] | undefined = undefined;

      // Extract explicit characters/actors from the same line if present (e.g. நடிகர்கள்: YOGIBABU...)
      const inlineCharMatch = rest.match(/(?:Characters?(?:\s*\([^)]*\))?|கதாபாத்திரங்கள்(?:\s*\([^)]*\))?|நடிகர்கள்(?:\s*\([^)]*\))?|Actors?|Cast)\s*[:\-]?\s*(.*?)(?=\s*(?:Script\s*Location|Location|Real\s*Location|Time|நேரம்|Effects?|[-|]|$))/i);
      if (inlineCharMatch && inlineCharMatch[1].trim()) {
        const rawC = inlineCharMatch[1].replace(/\s+(?:Effect|Time|நேரம்)\s*:.*/i, '').trim();
        explicitChars = rawC.split(/[,;]|\s+and\s+/i).map(c => c.trim().replace(/^[–—\-\s,:]+/, '')).filter(Boolean);
      }

      const locMatch = rest.match(/(?:Script\s*Location|Location|இடம்|Loc(?:ation)?)\s*[:\-]?\s*(.*?)(?=\s*(?:Real\s*Location|Time|நேரம்|வகை|Type|Effects?|Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast|[-|]|$))/i);
      const realLocMatch = rest.match(/(?:Real\s*Location|Real\s*Loc)\s*[:\-]?\s*(.*?)(?=\s*(?:Time|நேரம்|Effects?|Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast|[-|]|$))/i);
      const timeMatch = rest.match(/(?:Time|நேரம்)\s*[:\-]?\s*(.*?)(?=\s*(?:Effects?|Real|Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast|[-|]|$))/i);
      const effMatch = rest.match(/(?:Effects?|Effect)\s*[:\-]?\s*(.*?)(?=\s*(?:Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast|[-|]|$))/i);

      if (locMatch && locMatch[1].trim()) location = locMatch[1].trim();
      if (realLocMatch && realLocMatch[1].trim()) realLocation = realLocMatch[1].trim();
      if (timeMatch && timeMatch[1].trim()) timeOfDay = timeMatch[1].trim();
      if (effMatch && effMatch[1].trim()) effects = effMatch[1].trim();

      // Check subsequent lines for multi-line scene headers (e.g. Line 2: Location/Effects, Line 3: Characters)
      let nextIdx = lineIdx + 1;
      while (nextIdx < lines.length) {
        const nextLine = lines[nextIdx];
        if (!nextLine) {
          nextIdx++;
          continue;
        }

        const isScriptLoc = nextLine.match(/(?:Script\s*Location|Location|இடம்)\s*[:\-]?\s*(.*?)(?=\s*(?:Real\s*Location|Time|நேரம்|Effects?|Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast|[-|]|$))/i);
        const isRealLoc = nextLine.match(/(?:Real\s*Location|Real\s*Loc)\s*[:\-]?\s*(.*?)(?=\s*(?:Time|நேரம்|Effects?|Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast|[-|]|$))/i);
        const isTime = nextLine.match(/(?:Time|நேரம்)\s*[:\-]?\s*(.*?)(?=\s*(?:Effects?|Real|Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast|[-|]|$))/i);
        const isEff = nextLine.match(/(?:Effects?|Effect)\s*[:\-]?\s*(.*)/i);
        const isChar = nextLine.match(/(?:Characters?(?:\s*\([^)]*\))?|கதாபாத்திரங்கள்(?:\s*\([^)]*\))?|நடிகர்கள்(?:\s*\([^)]*\))?|Actors?|Cast)\s*[:\-]?\s*(.*)/i);

        if (isScriptLoc || isRealLoc || isTime || isEff || isChar) {
          if (isScriptLoc && isScriptLoc[1].trim()) location = isScriptLoc[1].trim();
          if (isRealLoc && isRealLoc[1].trim()) realLocation = isRealLoc[1].trim();
          if (isTime && isTime[1].trim()) timeOfDay = isTime[1].trim();
          if (isEff && isEff[1].trim()) effects = isEff[1].trim();
          if (isChar && isChar[1].trim()) {
            const rawC = isChar[1].replace(/\s+(?:Effect|Time|நேரம்)\s*:.*/i, '').trim();
            const parsed = rawC.split(/[,;]|\s+and\s+/i).map((c) => c.trim().replace(/^[–—\-\s,:]+/, '')).filter(Boolean);
            explicitChars = explicitChars ? Array.from(new Set([...explicitChars, ...parsed])) : parsed;
          }
          nextIdx++;
        } else {
          break;
        }
      }

      if (!location && !locMatch && rest.trim()) {
        const cleanedRest = rest.replace(/^[|:\s]+/, '').trim();
        if (cleanedRest) location = cleanedRest;
      }

      // Sanitize location & realLocation to strip out actor names, times, and INT/EXT keywords
      const sanitizeLoc = (l: string) => {
        if (!l) return '';
        return l
          .replace(/(?:Characters?|கதாபாத்திரங்கள்|நடிகர்கள்|Actors?|Cast)\s*[:\-]?\s*.*$/i, '')
          .replace(/(?:Real\s*Location|Real\s*Loc)\s*[:\-]?\s*.*$/i, '')
          .replace(/\s*(?:பகல்|பகள்|இரவு|மாலை|காலை|அதிகாலை|Day|Night|Evening|Morning)(?=[^\u0B80-\u0BFFa-zA-Z]|$)/gi, '')
          .replace(/\s*(?:EXT\/INT|INT\/EXT|EXT|INT)\b/gi, '')
          .replace(/[|:\-\s\t]+$/, '')
          .replace(/^[|:\-\s\t]+/, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      location = sanitizeLoc(location);
      realLocation = sanitizeLoc(realLocation) || location;

      // Infer timeOfDay if still default
      if (timeOfDay === 'Day / INT') {
        const fullHeaderContext = `${rest} ${line}`;
        const tMatch = fullHeaderContext.match(/(?:பகல்|பகள்|இரவு|மாலை|காலை|Day|Night|Evening|Morning)/i);
        const ieMatch = fullHeaderContext.match(/(?:EXT\/INT|INT\/EXT|EXT|INT)/i);
        if (tMatch || ieMatch) {
          const tStr = tMatch ? (tMatch[0] === 'பகள்' ? 'பகல்' : tMatch[0]) : 'Day';
          const ieStr = ieMatch ? ieMatch[0] : 'INT';
          timeOfDay = `${tStr} / ${ieStr}`;
        }
      }

      const sluglineText = `sc no: ${scNum}${location ? `     Script Location: ${location}` : ''}${timeOfDay ? `     Time: ${timeOfDay}` : ''}`;
      currentScene = {
        id: `scene-${Date.now()}-${scenes.length + 1}`,
        sceneNumber: scNum,
        location,
        realLocation: realLocation || location,
        timeOfDay,
        sluglineText,
        effects,
        characters: explicitChars,
        items: []
      };
      scenes.push(currentScene);
      lineIdx = nextIdx;
      continue;
    }

    // 2. Check for International / Fountain Sluglines (EXT. ANDHRA FOREST - NIGHT)
    const intExtMatch = line.match(intExtHeaderRegex);
    if (intExtMatch) {
      const scNum = `${scenes.length + 1}`;
      const location = intExtMatch[1].trim();
      const timeOfDay = (intExtMatch[2] || 'DAY').trim();
      const sluglineText = `காட்சி : ${scNum}     இடம் : ${location}     நேரம் : ${timeOfDay}`;

      currentScene = {
        id: `scene-${Date.now()}-${scenes.length + 1}`,
        sceneNumber: scNum,
        location,
        timeOfDay,
        sluglineText,
        items: []
      };
      scenes.push(currentScene);
      lineIdx++;
      continue;
    }

    // If no scene has been created yet, detect document title or subtitle
    if (!currentScene) {
      if (!docTitle || docTitle === defaultTitle) {
        if (line.length < 50 && !line.includes('இடம்') && !line.includes('.')) {
          docTitle = line;
          lineIdx++;
          continue;
        }
      }
      currentScene = {
        id: `scene-${Date.now()}-1`,
        sceneNumber: '1',
        location: '',
        timeOfDay: 'Day / INT',
        sluglineText: `காட்சி : 1`,
        items: []
      };
      scenes.push(currentScene);
    }

    // 3. Transitions / Titles
    if (transitionRegex.test(line)) {
      currentScene.items.push({
        id: `item-${Date.now()}-${lineIdx}`,
        type: 'transition',
        column: 'center',
        rawText: line
      });
      lineIdx++;
      continue;
    }

    // Explicit title card indicators only (never classify arbitrary Tamil words as titles)
    if (titleCardRegex.test(line) || (/^[>].*[<]$/.test(line))) {
      currentScene.items.push({
        id: `item-${Date.now()}-${lineIdx}`,
        type: 'title',
        column: 'center',
        rawText: line
      });
      lineIdx++;
      continue;
    }

    // 4. Character / Dialogue check
    const diaMatch = line.match(dialogueLineRegex);
    const isHeaderKeyword = /^(?:காட்சி|இடம்|நேரம்|வகை|கதாபாத்திரங்கள்|நடிகர்கள்|வருடம்|காலம்|டைட்டல்|பாடல்|sc\s*no|scene|location|time|effects?|characters?|cast|shot|angle)/i.test(line);

    let charName = '';
    let diaText = '';
    let isDialogue = false;

    if (diaMatch && !isHeaderKeyword) {
      charName = diaMatch[1].trim();
      diaText = diaMatch[2].trim();
      isDialogue = true;
    } else {
      // Check for character name on its own line without colon (e.g. "ஜெயிலர்", "பாஸ்டர்", "JOHN")
      const trimmed = line.replace(/:$/, '').trim();
      const wordCount = trimmed.split(/\s+/).length;
      const isActionVerb = /(?:வருவது|போவது|நடப்பது|நிற்பது|பார்ப்பது|செய்வது|இருப்பது|செய்கிறார்|பார்த்து|சொல்கிறார்|நிற்கிறான்|சுடுகிறார்|கத்துகிறார்|ஓடுகிறான்|பிடித்துக்கொண்டு)/.test(trimmed);
      const isActionStarter = /^(?:செல்லிற்குள்|அப்பொழுது|உடனே|அந்த|அவர்கள்|மக்கள்|இருவரும்|என்று|மீண்டும்|அங்கு|இங்கு|கம்பிகளுக்கிடையே)/.test(trimmed);

      if (
        trimmed.length >= 2 &&
        trimmed.length <= 40 &&
        wordCount <= 4 &&
        !/[.,!?;]$/.test(trimmed) &&
        !isHeaderKeyword &&
        !isActionVerb &&
        !isActionStarter &&
        !transitionRegex.test(line) &&
        !titleCardRegex.test(line)
      ) {
        // Look ahead to the next non-empty line
        let nextNonEmpty = lineIdx + 1;
        while (nextNonEmpty < lines.length && !lines[nextNonEmpty]) nextNonEmpty++;
        if (nextNonEmpty < lines.length) {
          const nextL = lines[nextNonEmpty];
          const isNextParenthetical = nextL.startsWith('(');
          const isNextSpeech = /[?\"\'!]|(\.\.)/.test(nextL);
          const isKnown = knownCharacters.has(trimmed);
          const isAllUpperEnglish = trimmed.toUpperCase() === trimmed && /[A-Z]/.test(trimmed);

          if (isNextParenthetical || isNextSpeech || isKnown || isAllUpperEnglish || (!tamilSceneHeaderRegex.test(nextL) && !intExtHeaderRegex.test(nextL) && !transitionRegex.test(nextL) && nextL.length < 250)) {
            charName = trimmed;
            isDialogue = true;
          }
        }
      }
    }

    if (isDialogue) {
      knownCharacters.add(charName);
      if (currentScene.characters && !currentScene.characters.includes(charName)) {
        currentScene.characters.push(charName);
      }

      let nextIdx = lineIdx + 1;
      // Skip empty lines immediately following the character cue
      while (nextIdx < lines.length && !lines[nextIdx]) nextIdx++;

      // If the very next line is a parenthetical action before dialogue (e.g. character cue then (crying)), emit as Action (Left column)
      // When placing inside description, remove enclosing brackets
      while (nextIdx < lines.length && lines[nextIdx] && lines[nextIdx].startsWith('(') && lines[nextIdx].endsWith(')')) {
        const parenAction = lines[nextIdx];
        const cleanedAction = parenAction.replace(/^[(\s]+|[)\s]+$/g, '').trim();
        if (cleanedAction) {
          currentScene.items.push({
            id: `item-${Date.now()}-${nextIdx}`,
            type: 'action',
            column: 'left',
            leftAction: cleanedAction,
            rawText: cleanedAction,
          });
        }
        nextIdx++;
        while (nextIdx < lines.length && !lines[nextIdx]) nextIdx++;
      }

      while (nextIdx < lines.length) {
        const curL = lines[nextIdx];
        if (!curL) {
          // If empty line, check if the next non-empty line continues this speech or starts something new
          let peek = nextIdx + 1;
          while (peek < lines.length && !lines[peek]) peek++;
          if (
            peek >= lines.length ||
            tamilSceneHeaderRegex.test(lines[peek]) ||
            intExtHeaderRegex.test(lines[peek]) ||
            transitionRegex.test(lines[peek]) ||
            dialogueLineRegex.test(lines[peek]) ||
            lines[peek].startsWith('(') ||
            knownCharacters.has(lines[peek].replace(/:$/, '').trim())
          ) {
            break;
          }
          nextIdx = peek;
          continue;
        }

        // Stop if we hit scene headers, transitions, or a new dialogue cue
        if (tamilSceneHeaderRegex.test(curL) || intExtHeaderRegex.test(curL) || transitionRegex.test(curL)) break;
        const curDiaMatch = curL.match(dialogueLineRegex);
        if (curDiaMatch && !/^(?:காட்சி|இடம்|நேரம்|வகை)/i.test(curL)) break;
        const cand = curL.replace(/:$/, '').trim();
        if (knownCharacters.has(cand)) break;

        // If line is a parenthetical (starts with '('), it is strictly Action/Description (Left column) and must not be swallowed into dialogue
        if (curL.startsWith('(')) {
          break;
        }

        // If line is clearly narrative action (e.g. long line with narrative action verbs, not in parens)
        if (curL.length > 90 && /(?:வருவது|போவது|நடப்பது|நிற்பது|செய்கிறார்|சுடுகிறார்|பார்த்து)/.test(curL)) {
          break;
        }

        diaText += (diaText ? '\n' : '') + curL;
        nextIdx++;
      }

      if (diaText || !currentScene.items.some(it => it.rightCharacter === charName)) {
        currentScene.items.push({
          id: `item-${Date.now()}-${lineIdx}`,
          type: 'dialogue',
          column: 'right',
          rightCharacter: charName,
          rightDialogue: diaText || undefined,
          rawText: diaText ? `${charName} : ${diaText}` : charName,
        });
      }
      lineIdx = nextIdx;
      continue;
    }

    // 5. Standalone SFX / Sound cues
    if (sfxRegex.test(line)) {
      currentScene.items.push({
        id: `item-${Date.now()}-${lineIdx}`,
        type: 'dialogue',
        column: 'right',
        rightAudioSfx: line
      });
      lineIdx++;
      continue;
    }

    // 6. Action / Scene narrative (Left column)
    // If inside bracket, it is description; remove enclosing brackets
    let actionText = line.replace(/^[(\s]+|[)\s]+$/g, '').trim();
    let extractedAudio = '';

    if (actionText.includes('துப்பாக்கி வெடிக்கும் சத்தம்') || actionText.includes('அலறும் சத்தம்')) {
      const sfxPart = actionText.match(/(?:எல்லாரும் அலறும் சத்தம் கேட்கிறது[.\s\-]*|துப்பாக்கி வெடிக்கும் சத்தம் கேட்கிறது[.\s\-]*)+/);
      if (sfxPart && sfxPart.index && sfxPart.index > 20) {
        extractedAudio = sfxPart[0].trim();
        actionText = actionText.slice(0, sfxPart.index).trim();
      }
    }

    if (actionText) {
      currentScene.items.push({
        id: `item-${Date.now()}-${lineIdx}`,
        type: 'action',
        column: 'left',
        leftAction: actionText,
        rightAudioSfx: extractedAudio || undefined
      });
    }
    lineIdx++;
  }

  // If a scene has no explicit metadata characters, fallback to dialogue speaking characters
  for (const sc of scenes) {
    if (!sc.characters || sc.characters.length === 0) {
      const speakingChars = getSceneCharacters(sc);
      if (speakingChars.length > 0) {
        sc.characters = [...speakingChars];
      }
    }
  }

  // Count dialogues
  let hasDialogue = false;
  for (const sc of scenes) {
    if (sc.items.some(i => i.column === 'right' || i.rightCharacter || i.rightDialogue)) {
      hasDialogue = true;
      break;
    }
  }

  return {
    title: docTitle,
    subtitle,
    scenes,
    rawText: clean,
    hasDialogue
  };
}

/**
 * Auto-extracts unique character names that appear in a scene
 */
export function getSceneCharacters(scene: TamilScene): string[] {
  const set = new Set<string>();

  // 1. Explicit scene characters from metadata (கதாபாத்திரங்கள் / நடிகர்கள் / Characters)
  if (Array.isArray(scene.characters) && scene.characters.length > 0) {
    scene.characters.forEach(c => {
      const clean = c.replace(/^[–—\-\s,:]+/, '').trim();
      if (clean && !clean.toLowerCase().startsWith('effect') && !clean.toLowerCase().startsWith('time')) {
        set.add(clean);
      }
    });
  }

  // 2. Check if scene.location, scene.realLocation, or scene.sluglineText has embedded 'நடிகர்கள்:' or 'கதாபாத்திரங்கள்:'
  const fullMetaText = `${scene.location || ''} ${scene.realLocation || ''} ${scene.sluglineText || ''}`;
  const embeddedCharMatch = fullMetaText.match(/(?:Characters?(?:\s*\([^)]*\))?|கதாபாத்திரங்கள்(?:\s*\([^)]*\))?|நடிகர்கள்(?:\s*\([^)]*\))?|Actors?|Cast)\s*[:\-]?\s*([^|\n]+)/i);
  if (embeddedCharMatch && embeddedCharMatch[1]) {
    const rawC = embeddedCharMatch[1].replace(/\s+(?:Effect|Time|நேரம்)\s*:.*/i, '').trim();
    const chars = rawC.split(/[,;]|\s+and\s+/i).map(c => c.trim().replace(/^[–—\-\s,:]+/, '')).filter(Boolean);
    chars.forEach(c => {
      if (c && !c.toLowerCase().startsWith('effect') && !c.toLowerCase().startsWith('time')) {
        set.add(c);
      }
    });
  }

  // 3. Speaking characters from scene dialogue items
  if (Array.isArray(scene.items)) {
    for (const item of scene.items) {
      let name = (item.rightCharacter || '').trim();
      if (!name && item.column === 'right') {
        const text = (item.rightDialogue || item.rawText || '').trim();
        const m = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.()'\-]{2,35})\s*:/);
        if (m) name = m[1].trim();
      }
      if (name) {
        if (name.endsWith(':')) name = name.slice(0, -1).trim();
        name = name.replace(/\s*\([^)]*\)$/, '').trim(); // Remove parentheticals like (V.O.)
        if (name && name !== 'கதாபாத்திரம்' && name !== 'நடிகர்கள்' && name !== 'வசனம்') {
          set.add(name);
        }
      }
    }
  }

  return Array.from(set);
}

/**
 * Auto-extracts or formats effect tags for a scene (e.g. FIGHT, CG, SFX)
 */
export function getSceneEffects(scene: TamilScene): string {
  if (scene.effects !== undefined && scene.effects !== null && scene.effects.trim() !== '') {
    return scene.effects;
  }
  const detected: string[] = [];
  for (const item of scene.items) {
    const sfx = (item.rightAudioSfx || '').toUpperCase();
    const act = (item.leftAction || '').toUpperCase();
    const raw = (item.rawText || '').toUpperCase();
    const combined = `${sfx} ${act} ${raw}`;

    if ((combined.includes('FIGHT') || combined.includes('சண்டை') || combined.includes('அடிக்கிற') || combined.includes('துப்பாக்கி')) && !detected.includes('FIGHT')) {
      detected.push('FIGHT');
    }
    if ((combined.includes('CG') || combined.includes('VFX') || combined.includes('கிராபிக்ஸ்')) && !detected.includes('CG')) {
      detected.push('CG');
    }
    if ((combined.includes('SFX') || combined.includes('ஒலி') || combined.includes('சத்தம்') || sfx.length > 0) && !detected.includes('SFX')) {
      detected.push('SFX');
    }
    if ((combined.includes('BGM') || combined.includes('பாடல்') || combined.includes('SONG')) && !detected.includes('BGM')) {
      detected.push('BGM');
    }
  }
  return detected.length > 0 ? detected.join(', ') : 'FIGHT, CG, SFX';
}

/**
 * Extracts unique character names from all scenes to power fast autocomplete chips
 */
export function getAllScriptCharacters(scenes: TamilScene[]): string[] {
  const set = new Set<string>();
  scenes.forEach(scene => {
    getSceneCharacters(scene).forEach(char => set.add(char));
  });
  return Array.from(set);
}

/**
 * Detects if a scene already ends with a transition element (e.g. CUT TO:, FADE OUT., காட்சி மாற்றம், etc.)
 */
export function hasEndSceneTransition(items: TamilScriptItem[]): boolean {
  if (!items || items.length === 0) return false;

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const text = (item.rawText || item.leftAction || item.rightDialogue || '').trim();
    if (!text && item.type !== 'transition') {
      continue;
    }

    if (item.type === 'transition') return true;

    const upper = text.toUpperCase();
    const normalized = upper.replace(/[-\s_:]+/g, ' ');
    const transitionPhrases = [
      'CUT TO',
      'DISSOLVE TO',
      'FADE OUT',
      'FADE TO',
      'FADE IN',
      'SMASH CUT',
      'MATCH CUT',
      'JUMP CUT',
      'TIME CUT',
      'CROSSFADE',
      'IRIS OUT',
      'WIPE TO',
      'FLASH CUT',
      'கட் டூ',
      'காட்சி மாற்றம்',
      'முடிவு',
      'முற்றும்',
      'திரை மறைவு',
    ];

    if (transitionPhrases.some((phrase) => normalized.includes(phrase) || upper.includes(phrase) || text.includes(phrase))) {
      return true;
    }

    // Hit the last non-empty item and it's not a transition
    return false;
  }

  return false;
}

/**
 * Generates an authentic Kollywood Left-Right HTML layout from curated user items
 */
export function generateTamilLeftRightHtml(data: TamilScreenplayData): string {
  let html = `
    <div class="tamil-left-right-screenplay font-tamil-script" style="font-family: 'Vijaya', 'Latha', 'Nirmala UI', sans-serif; line-height: 1.6; color: inherit;">
      <div style="text-align: center; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 2px dashed rgba(148, 163, 184, 0.3);">
        <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 6px 0; color: #16a34a; letter-spacing: 0.5px;">${data.title || 'திரைக்கதை'}</h1>
        <p style="font-size: 13px; opacity: 0.75; margin: 0;">தமிழ் இருபக்க திரைக்கதை வடிவம் (Kollywood Left-Right Shooting Format)</p>
      </div>
  `;

  data.scenes.forEach((scene, scIdx) => {
    const chars = getSceneCharacters(scene);
    const effects = getSceneEffects(scene);

    html += `
      <div class="tamil-scene-block" style="${scIdx > 0 ? 'page-break-before: always; ' : ''}margin-bottom: 36px;">
        <!-- Scene Header Box (Exact Wireframe Layout) -->
        <div style="border: 1px solid #1e293b; background: rgba(34, 197, 94, 0.03); padding: 10px 14px; margin-bottom: 20px; border-radius: 6px; font-weight: 700; font-size: 12px; line-height: 1.5;">
          <table style="width: 100%; border-collapse: collapse; border: none;">
            <tbody>
              <tr>
                <td style="text-align: left; vertical-align: top; width: 42%;">Sc no: ${scene.sceneNumber}</td>
                <td style="text-align: center; vertical-align: middle; width: 16%; font-size: 11px;"></td>
                <td style="text-align: right; vertical-align: top; width: 42%;">Time: ${scene.timeOfDay || 'Day / INT'}</td>
              </tr>
              <tr>
                <td style="text-align: left; vertical-align: middle; width: 42%; word-break: break-word;">Script Location: <span style="font-weight: 500;">${scene.location}</span></td>
                <td style="text-align: center; vertical-align: middle; width: 16%;">
                  <span style="display: inline-block; border: 1.5px solid #000; border-radius: 6px; padding: 2px 10px; font-weight: 800; font-size: 11px; letter-spacing: 0.5px; white-space: nowrap;">
                    Pages: 1/1
                  </span>
                </td>
                <td style="text-align: right; vertical-align: middle; width: 42%; word-break: break-word;">Real Location: <span style="font-weight: 500;">${scene.realLocation || scene.location || 'xyz'}</span></td>
              </tr>
              <tr>
                <td colspan="2" style="text-align: left; vertical-align: top; padding-top: 4px; word-break: break-word;">
                  Characters(${chars.length}): <span style="font-weight: 500;">${chars.length > 0 ? chars.join(', ') : 'None'}</span>
                </td>
                <td style="text-align: right; vertical-align: top; padding-top: 4px; white-space: nowrap;">Effect: ${effects || 'None'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Two Column Screenplay Table -->
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 14px;">
          <colgroup>
            <col style="width: 47%;" />
            <col style="width: 6%;" />
            <col style="width: 47%;" />
          </colgroup>
          <thead>
            <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.25); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.65;">
              <th style="text-align: left; padding: 4px 8px 8px 0; font-weight: 700;">காட்சி விவரம் (Visual Action)</th>
              <th></th>
              <th style="text-align: left; padding: 4px 0 8px 8px; font-weight: 700;">வசனம் & ஒலி (Dialogue & Audio)</th>
            </tr>
          </thead>
          <tbody>
    `;

    let lastSpeakerInHtmlScene = '';

    scene.items.forEach((item) => {
      if (item.column === 'center' || item.type === 'transition' || item.type === 'title') {
        html += `
          <tr>
            <td colspan="3" style="text-align: center; padding: 18px 0; font-weight: 800; color: #16a34a; font-size: 15px; letter-spacing: 1px;">
              ${item.rawText || item.leftAction || item.rightDialogue || ''}
            </td>
          </tr>
        `;
      } else {
        const isRight = item.column === 'right';
        let charName = (item.rightCharacter || '').trim();
        let diaText = (item.rightDialogue || (isRight ? item.rawText : '') || '').trim();
        if (isRight && !charName && diaText) {
          const m = diaText.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
          if (m) {
            charName = m[1].trim();
            diaText = m[2].trim();
          }
        }
        if (charName.endsWith(':')) charName = charName.slice(0, -1).trim();

        const contdRegex = /\s*\(\s*(?:CONT['’.]?D\.?|CONTINUES|CONTINUED|தொடர்ச்சி|தொடர்கிறது)\s*\)/i;
        const charHasContd = contdRegex.test(charName);
        const normSpeaker = charName ? charName.replace(/\s*\([^)]*\)$/, '').trim().toUpperCase() : '';
        const isContinuous = Boolean(normSpeaker && lastSpeakerInHtmlScene && lastSpeakerInHtmlScene === normSpeaker);
        if (normSpeaker && (isRight || diaText)) {
          lastSpeakerInHtmlScene = normSpeaker;
        }

        const displayHtmlChar = isContinuous && !charHasContd
          ? `${charName || 'கதாபாத்திரம்'} <span style="font-style: italic; font-size: 11px; opacity: 0.85;">(continues)</span>`
          : (charName || 'கதாபாத்திரம்');

        const actionContent = !isRight ? (item.leftAction || item.rawText || '') : '';

        html += `
          <tr style="vertical-align: top;">
            <!-- Left Column: Action OR Right-Aligned Character Name -->
            <td style="padding: 8px 12px 8px 0; font-size: 13.5px; line-height: 1.6; border-right: 1px dashed rgba(148, 163, 184, 0.35);">
              ${isRight ? `
                <div style="text-align: right; font-weight: 800; color: #0284c7;">
                  ${displayHtmlChar} :
                </div>
              ` : actionContent ? `
                <div style="text-align: justify;">${actionContent}</div>
              ` : ''}
            </td>

            <!-- Spacer column -->
            <td style="padding: 0;"></td>

            <!-- Right Column: Dialogue starts immediately next to character name -->
            <td style="padding: 8px 0 8px 12px; font-size: 13.5px; line-height: 1.6;">
              ${isRight && diaText ? `
                <div style="text-align: left;">${diaText}</div>
              ` : ''}
              ${item.rightAudioSfx ? `
                <div style="font-size: 12px; font-style: italic; color: #e11d48; margin-top: 4px;">
                  SFX: ${item.rightAudioSfx}
                </div>
              ` : ''}
            </td>
          </tr>
        `;
      }
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

export interface DocxExportOptions {
  baseFontFamily?: string;
  baseFontSizePx?: number;
  baseLineHeight?: number;
  characterColor?: string;
  columnSplitPercent?: number;
  sceneHeadingStyle?: 'kollywood' | 'card' | 'typewriter' | 'underline' | 'boxed' | 'none';
  gapSceneHeaderPx?: number;
  gapParagraphRowPx?: number;
  sceneHeadingFontFamily?: string;
  sceneHeadingFontSizePx?: number;
  marginTopMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
  marginRightMm?: number;
  paperStandard?: 'A4' | 'US_Letter' | 'Legal';
  freshPagePerScene?: boolean;
  showDivider?: boolean;
  dividerStyle?: 'hairline' | 'dashed' | 'none';
  actionTextAlign?: 'left' | 'center' | 'right' | 'justify';
  dialogueTextAlign?: 'left' | 'center' | 'right' | 'justify';
  characterNameBold?: boolean;
  transitionBold?: boolean;
  columnGutterPx?: number;
  showColumnGuides?: boolean;
  autoEndSceneCutTo?: boolean;
  endSceneCutToText?: string;
  transitionColor?: string;
}

/**
 * Helper to parse text containing formatting (bold, italic, underline, newlines)
 * and generate accurate docx TextRun elements with preserved styles & complex script support.
 */
function parseFormattedRuns(
  text: string,
  baseOpts: {
    font: { ascii: string; hAnsi: string; cs: string; hint?: string };
    size: number;
    color?: string;
    bold?: boolean;
    italics?: boolean;
    underline?: boolean;
  }
): TextRun[] {
  if (!text) return [];

  // Normalize newlines
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const runs: TextRun[] = [];

  lines.forEach((line, lineIdx) => {
    const isFirstLine = lineIdx === 0;

    // Check if line contains markdown or html formatting tags:
    // e.g. **bold**, *italic*, <b>bold</b>, <strong>bold</strong>, <i>italic</i>, <em>italic</em>, <u>underline</u>
    const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|<b>.*?<\/b>|<strong>.*?<\/strong>|<i>.*?<\/i>|<em>.*?<\/em>|<u>.*?<\/u>)/g;
    const parts = line.split(tokenRegex);

    if (parts.length === 1) {
      runs.push(
        new TextRun({
          text: line,
          break: isFirstLine ? undefined : 1,
          font: baseOpts.font,
          size: baseOpts.size,
          sizeComplexScript: baseOpts.size,
          bold: baseOpts.bold,
          boldComplexScript: baseOpts.bold,
          italics: baseOpts.italics,
          italicsComplexScript: baseOpts.italics,
          underline: baseOpts.underline ? { type: UnderlineType.SINGLE } : undefined,
          color: baseOpts.color,
        })
      );
    } else {
      let isFirstPartInLine = true;
      for (const part of parts) {
        if (!part) continue;
        const lineBreak = isFirstPartInLine && !isFirstLine ? 1 : undefined;
        isFirstPartInLine = false;

        let content = part;
        let isBold = baseOpts.bold || false;
        let isItalic = baseOpts.italics || false;
        let isUnderline = baseOpts.underline || false;

        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          isBold = true;
          content = part.slice(2, -2);
        } else if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
          isItalic = true;
          content = part.slice(1, -1);
        } else if (part.startsWith('<b>') && part.endsWith('</b>')) {
          isBold = true;
          content = part.slice(3, -4);
        } else if (part.startsWith('<strong>') && part.endsWith('</strong>')) {
          isBold = true;
          content = part.slice(8, -9);
        } else if (part.startsWith('<i>') && part.endsWith('</i>')) {
          isItalic = true;
          content = part.slice(3, -4);
        } else if (part.startsWith('<em>') && part.endsWith('</em>')) {
          isItalic = true;
          content = part.slice(4, -5);
        } else if (part.startsWith('<u>') && part.endsWith('</u>')) {
          isUnderline = true;
          content = part.slice(3, -4);
        }

        runs.push(
          new TextRun({
            text: content,
            break: lineBreak,
            font: baseOpts.font,
            size: baseOpts.size,
            sizeComplexScript: baseOpts.size,
            bold: isBold,
            boldComplexScript: isBold,
            italics: isItalic,
            italicsComplexScript: isItalic,
            underline: isUnderline ? { type: UnderlineType.SINGLE } : undefined,
            color: baseOpts.color,
          })
        );
      }
    }
  });

  return runs;
}

/**
 * Generates an authentic Microsoft Word (.docx) file:
 * - Completely borderless 2-column rows (zero boxes, zero table gridlines)
 * - Preserves font styles, font sizes, complex script formatting, and character colors
 */
export async function generateTamilLeftRightDocx(
  data: TamilScreenplayData,
  options?: Partial<DocxExportOptions>
): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];

  // Paper standard sizes in DXA (twentieths of a point)
  const PAGE_DIMENSIONS_DXA: Record<string, { width: number; height: number }> = {
    A4: { width: 11906, height: 16838 },
    US_Letter: { width: 12240, height: 15840 },
    Legal: { width: 12240, height: 20160 },
  };
  const pageDim = PAGE_DIMENSIONS_DXA[options?.paperStandard || 'A4'] || PAGE_DIMENSIONS_DXA.A4;

  // Calculate margins in DXA (1mm = 56.7 dxa)
  const marginTop = Math.round((options?.marginTopMm ?? 20) * 56.7);
  const marginBottom = Math.round((options?.marginBottomMm ?? 20) * 56.7);
  const marginLeft = Math.round((options?.marginLeftMm ?? 20) * 56.7);
  const marginRight = Math.round((options?.marginRightMm ?? 20) * 56.7);

  // Exact printable content width in DXA (prevents table right edge overflow/clipping in Word)
  const contentWidthDxa = Math.max(6800, pageDim.width - marginLeft - marginRight);

  // Extract clean primary font name
  const rawFont = options?.baseFontFamily || "'Vijaya', 'Latha', 'Mukta Malar', 'Noto Sans Tamil', system-ui, sans-serif";
  const fontMatch = rawFont.match(/['"]([^'"]+)['"]/);
  const primaryFont = fontMatch ? fontMatch[1] : (rawFont.includes('Latha') ? 'Latha' : 'Vijaya');

  // OpenXML Font mapping for both Latin (ascii, hAnsi) and Tamil Complex Script (cs)
  const fontObj = {
    name: primaryFont,
    ascii: primaryFont,
    hAnsi: primaryFont,
    cs: primaryFont,
    hint: 'cs',
  };

  // Base font size in half-points (22 = 11pt, 24 = 12pt)
  const basePx = options?.baseFontSizePx || 13.5;
  const fontSizeHalfPt = Math.round(basePx * 1.63);

  // Character name color in hex
  let charColor = (options?.characterColor || '#0284c7').replace('#', '').toUpperCase();
  if (!/^[0-9A-F]{6}$/i.test(charColor)) charColor = '0284C7';

  let transColor = (options?.transitionColor || '#16a34a').replace('#', '').toUpperCase();
  if (!/^[0-9A-F]{6}$/i.test(transColor)) transColor = '16A34A';

  // Column split widths (total matches printable contentWidthDxa)
  const splitPercent = options?.columnSplitPercent ?? 48;
  const leftColWidth = Math.round(contentWidthDxa * (splitPercent / 100));
  const rightColWidth = contentWidthDxa - leftColWidth;

  // Element spacing in DXA: gives comfortable, distinct vertical separation between consecutive beats
  const elemSpacingBefore = Math.max(140, Math.round((options?.gapParagraphRowPx ?? 10) * 16));
  const elemSpacingAfter = Math.max(120, Math.round((options?.gapParagraphRowPx ?? 10) * 14));

  // Zero-border definitions to eliminate table boxes in Microsoft Word
  const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' };
  const NO_CELL_BORDERS = {
    top: NO_BORDER,
    bottom: NO_BORDER,
    left: NO_BORDER,
    right: NO_BORDER,
  };
  const NO_TABLE_BORDERS = {
    top: NO_BORDER,
    bottom: NO_BORDER,
    left: NO_BORDER,
    right: NO_BORDER,
    insideHorizontal: NO_BORDER,
    insideVertical: NO_BORDER,
  };

  // Title Banner
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: data.title || 'திரைக்கதை',
          bold: true,
          boldComplexScript: true,
          size: fontSizeHalfPt + 14,
          sizeComplexScript: fontSizeHalfPt + 14,
          color: '16A34A',
          font: fontObj,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 350 },
      children: [
        new TextRun({
          text: 'தமிழ் இருபக்க திரைக்கதை வடிவம் (Kollywood Left-Right Screenplay Format)',
          italics: true,
          italicsComplexScript: true,
          size: fontSizeHalfPt - 2,
          sizeComplexScript: fontSizeHalfPt - 2,
          color: '64748B',
          font: fontObj,
        }),
      ],
    })
  );

  // Scenes
  data.scenes.forEach((scene, scIdx) => {
    const chars = getSceneCharacters(scene);
    const effects = getSceneEffects(scene);

    // Page break between scenes if configured or after scene 1
    if (scIdx > 0 && options?.freshPagePerScene !== false) {
      children.push(
        new Paragraph({
          pageBreakBefore: true,
          children: [],
        })
      );
    }

    // Scene Heading style
    const headingBorders =
      options?.sceneHeadingStyle === 'underline' || options?.sceneHeadingStyle === 'typewriter'
        ? {
            top: NO_BORDER,
            bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
            left: NO_BORDER,
            right: NO_BORDER,
            insideHorizontal: NO_BORDER,
            insideVertical: NO_BORDER,
          }
        : options?.sceneHeadingStyle === 'none'
        ? NO_TABLE_BORDERS
        : {
            top: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
            right: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
            insideHorizontal: NO_BORDER,
            insideVertical: NO_BORDER,
          };

    const isBoxedHeader =
      !options?.sceneHeadingStyle ||
      options?.sceneHeadingStyle === 'kollywood' ||
      options?.sceneHeadingStyle === 'boxed' ||
      options?.sceneHeadingStyle === 'card';

    // 3-Column Scene Heading Box widths: Col 1 (44%), Col 2 (14%), Col 3 (42%)
    const hdrCol1 = Math.round(contentWidthDxa * 0.44);
    const hdrCol2 = Math.round(contentWidthDxa * 0.14);
    const hdrCol3 = contentWidthDxa - hdrCol1 - hdrCol2;

    // 3-Column Scene Heading Box (Properly enclosed, exact table grid widths & inner cell padding)
    children.push(
      new Table({
        width: { size: contentWidthDxa, type: WidthType.DXA },
        columnWidths: [hdrCol1, hdrCol2, hdrCol3],
        margins: {
          top: 100,
          bottom: 100,
          left: 140,
          right: 140,
        },
        borders: headingBorders,
        rows: [
          // Row 1: Sc no: (Left) | empty (Center) | Time: (Right)
          new TableRow({
            children: [
              new TableCell({
                width: { size: hdrCol1, type: WidthType.DXA },
                borders: NO_CELL_BORDERS,
                children: [
                  new Paragraph({
                    spacing: { before: 80, after: 40 },
                    children: [
                      new TextRun({
                        text: `Sc no: ${scene.sceneNumber}`,
                        bold: true,
                        boldComplexScript: true,
                        size: fontSizeHalfPt,
                        sizeComplexScript: fontSizeHalfPt,
                        font: fontObj,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: hdrCol2, type: WidthType.DXA },
                borders: NO_CELL_BORDERS,
                children: [new Paragraph({ children: [] })],
              }),
              new TableCell({
                width: { size: hdrCol3, type: WidthType.DXA },
                borders: NO_CELL_BORDERS,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 80, after: 40 },
                    children: [
                      new TextRun({
                        text: `Time: ${scene.timeOfDay || 'Day / INT'}`,
                        bold: true,
                        boldComplexScript: true,
                        size: fontSizeHalfPt,
                        sizeComplexScript: fontSizeHalfPt,
                        font: fontObj,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // Row 2: Script Location: (Left) | Pages: 1/1 (Center) | Real Location: (Right)
          new TableRow({
            children: [
              new TableCell({
                width: { size: hdrCol1, type: WidthType.DXA },
                borders: NO_CELL_BORDERS,
                children: [
                  new Paragraph({
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({
                        text: `Script Location: ${scene.location}`,
                        bold: true,
                        boldComplexScript: true,
                        size: fontSizeHalfPt,
                        sizeComplexScript: fontSizeHalfPt,
                        font: fontObj,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: hdrCol2, type: WidthType.DXA },
                borders: isBoxedHeader
                  ? {
                      top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
                      bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
                      left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
                      right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
                    }
                  : NO_CELL_BORDERS,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 30, after: 30 },
                    children: [
                      new TextRun({
                        text: 'Pages: 1/1',
                        bold: true,
                        boldComplexScript: true,
                        size: fontSizeHalfPt - 2,
                        sizeComplexScript: fontSizeHalfPt - 2,
                        font: fontObj,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: hdrCol3, type: WidthType.DXA },
                borders: NO_CELL_BORDERS,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({
                        text: `Real Location: ${scene.realLocation || scene.location || 'xyz'}`,
                        bold: true,
                        boldComplexScript: true,
                        size: fontSizeHalfPt,
                        sizeComplexScript: fontSizeHalfPt,
                        font: fontObj,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // Row 3: Characters(n): (Left ColSpan 2) | Effect: (Right)
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 2,
                width: { size: hdrCol1 + hdrCol2, type: WidthType.DXA },
                borders: NO_CELL_BORDERS,
                children: [
                  new Paragraph({
                    spacing: { before: 40, after: 80 },
                    children: [
                      new TextRun({
                        text: `Characters(${chars.length}): `,
                        bold: true,
                        boldComplexScript: true,
                        size: fontSizeHalfPt,
                        sizeComplexScript: fontSizeHalfPt,
                        font: fontObj,
                      }),
                      new TextRun({
                        text: chars.length > 0 ? chars.join(', ') : 'None',
                        size: fontSizeHalfPt,
                        sizeComplexScript: fontSizeHalfPt,
                        font: fontObj,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: hdrCol3, type: WidthType.DXA },
                borders: NO_CELL_BORDERS,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 40, after: 80 },
                    children: [
                      new TextRun({
                        text: `Effect: ${effects || 'None'}`,
                        bold: true,
                        boldComplexScript: true,
                        size: fontSizeHalfPt,
                        sizeComplexScript: fontSizeHalfPt,
                        font: fontObj,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    // Clean vertical breathing room between Scene Heading Box and Two-Column Content
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 120 },
        children: [],
      })
    );

    // Two-Column Content Rows (Completely borderless, zero boxes)
    const tableRows: TableRow[] = [];

    // Generous gutter separation between Left (Action) and Right (Dialogue) columns
    const gutterDxa = Math.max(220, Math.round((options?.columnGutterPx ?? 16) * 14));
    const isCharBold = options?.characterNameBold !== false;
    const isTransBold = options?.transitionBold !== false;

    // Optional column guide banner (Omitted by default)
    if (options?.showColumnGuides) {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: leftColWidth, type: WidthType.DXA },
              borders: NO_CELL_BORDERS,
              margins: { top: 60, bottom: 60, left: 40, right: gutterDxa },
              children: [
                new Paragraph({
                  spacing: { before: 120, after: 100 },
                  children: [
                    new TextRun({
                      text: 'காட்சி விவரம் (Visual Action)',
                      bold: true,
                      boldComplexScript: true,
                      size: fontSizeHalfPt - 2,
                      sizeComplexScript: fontSizeHalfPt - 2,
                      color: '16A34A',
                      font: fontObj,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: rightColWidth, type: WidthType.DXA },
              borders: NO_CELL_BORDERS,
              margins: { top: 60, bottom: 60, left: gutterDxa, right: 40 },
              children: [
                new Paragraph({
                  spacing: { before: 120, after: 100 },
                  children: [
                    new TextRun({
                      text: 'வசனம் & ஒலி (Dialogue & Audio)',
                      bold: true,
                      boldComplexScript: true,
                      size: fontSizeHalfPt - 2,
                      sizeComplexScript: fontSizeHalfPt - 2,
                      color: '0284C7',
                      font: fontObj,
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    }

    // Content rows (with auto end-of-scene CUT TO if enabled)
    const effectiveItems: TamilScriptItem[] = [...scene.items];
    if (options?.autoEndSceneCutTo === true && !hasEndSceneTransition(scene.items)) {
      effectiveItems.push({
        id: `auto-cut-to-${scene.id}`,
        type: 'transition',
        column: 'center',
        rawText: options?.endSceneCutToText || 'CUT TO:',
      });
    }

    let lastSpeakerInDocxScene = '';

    effectiveItems.forEach((item) => {
      const itemColor = item.textColor ? item.textColor.replace('#', '').toUpperCase() : undefined;
      const validItemColor = itemColor && /^[0-9A-F]{6}$/i.test(itemColor) ? itemColor : undefined;

      if (item.column === 'center' || item.type === 'transition' || item.type === 'title') {
        const centerText = item.rawText || item.leftAction || item.rightDialogue || '';
        tableRows.push(
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                columnSpan: 2,
                width: { size: contentWidthDxa, type: WidthType.DXA },
                borders: NO_CELL_BORDERS,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 240, after: 200 },
                    children: parseFormattedRuns(centerText, {
                      font: fontObj,
                      size: fontSizeHalfPt + 2,
                      bold: item.isBold !== undefined ? item.isBold : isTransBold,
                      italics: item.isItalic,
                      color: validItemColor || transColor,
                    }),
                  }),
                ],
              }),
            ],
          })
        );
      } else {
        const isRight = item.column === 'right';
        let charName = (item.rightCharacter || '').trim();
        let diaText = (item.rightDialogue || (isRight ? item.rawText : '') || '').trim();
        if (isRight && !charName && diaText) {
          const m = diaText.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
          if (m) {
            charName = m[1].trim();
            diaText = m[2].trim();
          }
        }
        if (charName.endsWith(':')) charName = charName.slice(0, -1).trim();

        // Alignment resolution: item-specific -> option fallback -> default
        const actionAlign = item.textAlign || options?.actionTextAlign || 'justify';
        const docxActionAlign =
          actionAlign === 'left'
            ? AlignmentType.LEFT
            : actionAlign === 'center'
            ? AlignmentType.CENTER
            : actionAlign === 'right'
            ? AlignmentType.RIGHT
            : AlignmentType.BOTH;

        const diaAlign = item.textAlign || options?.dialogueTextAlign || 'left';
        const docxDiaAlign =
          diaAlign === 'justify'
            ? AlignmentType.BOTH
            : diaAlign === 'center'
            ? AlignmentType.CENTER
            : diaAlign === 'right'
            ? AlignmentType.RIGHT
            : AlignmentType.LEFT;

        const contdRegex = /\s*\(\s*(?:CONT['’.]?D\.?|CONTINUES|CONTINUED|தொடர்ச்சி|தொடர்கிறது)\s*\)/i;
        const charHasContd = contdRegex.test(charName);
        const normSpeaker = charName ? charName.replace(/\s*\([^)]*\)$/, '').trim().toUpperCase() : '';
        const isContinuous = Boolean(normSpeaker && lastSpeakerInDocxScene && lastSpeakerInDocxScene === normSpeaker);
        if (normSpeaker && (isRight || diaText)) {
          lastSpeakerInDocxScene = normSpeaker;
        }

        const leftParas: Paragraph[] = [];
        if (isRight) {
          // Dialogue Row: Character Name on Left TableCell, Right-Aligned with ":"
          const charChildren: TextRun[] = [
            new TextRun({
              text: charName || 'கதாபாத்திரம்',
              bold: isCharBold,
              boldComplexScript: isCharBold,
              size: fontSizeHalfPt,
              sizeComplexScript: fontSizeHalfPt,
              color: charColor,
              font: fontObj,
            }),
          ];
          if (isContinuous && !charHasContd) {
            charChildren.push(
              new TextRun({
                text: ' (continues)',
                italics: true,
                bold: false,
                boldComplexScript: false,
                size: Math.max(16, fontSizeHalfPt - 4),
                sizeComplexScript: Math.max(16, fontSizeHalfPt - 4),
                color: charColor,
                font: fontObj,
              })
            );
          }
          charChildren.push(
            new TextRun({
              text: ' :',
              bold: isCharBold,
              boldComplexScript: isCharBold,
              size: fontSizeHalfPt,
              sizeComplexScript: fontSizeHalfPt,
              color: charColor,
              font: fontObj,
            })
          );

          leftParas.push(
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: elemSpacingBefore, after: 60 },
              children: charChildren,
            })
          );
        } else {
          // Action Row: Action on Left TableCell with configured alignment
          const actionText = item.leftAction || item.rawText || '';
          if (actionText) {
            leftParas.push(
              new Paragraph({
                alignment: docxActionAlign,
                spacing: { before: elemSpacingBefore, after: elemSpacingAfter, line: 280 },
                children: parseFormattedRuns(actionText, {
                  font: fontObj,
                  size: fontSizeHalfPt,
                  bold: item.isBold,
                  italics: item.isItalic,
                  color: validItemColor,
                }),
              })
            );
          } else {
            leftParas.push(new Paragraph({ children: [] }));
          }
        }

        const rightParas: Paragraph[] = [];
        if (isRight && diaText) {
          // Dialogue starts directly next to the character name on right TableCell
          rightParas.push(
            new Paragraph({
              alignment: docxDiaAlign,
              spacing: { before: elemSpacingBefore, after: elemSpacingAfter, line: 280 },
              children: parseFormattedRuns(diaText, {
                font: fontObj,
                size: fontSizeHalfPt,
                bold: item.isBold,
                italics: item.isItalic,
                color: validItemColor,
              }),
            })
          );
        } else {
          rightParas.push(new Paragraph({ children: [] }));
        }

        if (item.rightAudioSfx) {
          rightParas.push(
            new Paragraph({
              spacing: { before: 40, after: 80 },
              children: parseFormattedRuns(item.rightAudioSfx, {
                font: fontObj,
                size: fontSizeHalfPt - 2,
                italics: true,
                color: 'BE123C',
              }),
            })
          );
        }
        if (rightParas.length === 0) {
          rightParas.push(new Paragraph({ children: [] }));
        }

        tableRows.push(
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: leftColWidth, type: WidthType.DXA },
                children: leftParas,
                borders: NO_CELL_BORDERS,
                margins: {
                  top: 40,
                  bottom: 40,
                  left: 40,
                  right: gutterDxa,
                },
              }),
              new TableCell({
                width: { size: rightColWidth, type: WidthType.DXA },
                children: rightParas,
                borders: NO_CELL_BORDERS,
                margins: {
                  top: 40,
                  bottom: 40,
                  left: gutterDxa,
                  right: 40,
                },
              }),
            ],
          })
        );
      }
    });

    // Push 2-Column Content Table with ZERO borders
    children.push(
      new Table({
        width: { size: contentWidthDxa, type: WidthType.DXA },
        columnWidths: [leftColWidth, rightColWidth],
        borders: NO_TABLE_BORDERS,
        rows: tableRows,
      })
    );

    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pageDim.width,
              height: pageDim.height,
            },
            margin: {
              top: marginTop,
              bottom: marginBottom,
              left: marginLeft,
              right: marginRight,
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Triggers instant browser download for any Blob with given filename
 */
export function downloadBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Downloads the original untouched file (e.g. original .docx) that was stored in the document vault
 */
export function downloadOriginalDocumentFile(doc: ProductionDocument): boolean {
  if (doc.originalFileDataUrl) {
    const a = document.createElement('a');
    a.href = doc.originalFileDataUrl;
    a.download = doc.originalFileName || doc.fileName || `${doc.title}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }
  return false;
}
