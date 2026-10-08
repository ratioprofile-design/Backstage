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
import { ProductionDocument } from '../types';

export interface TamilScriptItem {
  id: string;
  type: 'action' | 'dialogue' | 'transition' | 'title' | 'split_row' | 'slugline';
  column: 'left' | 'right' | 'center'; // 'left' = காட்சி (Action), 'right' = வசனம் (Dialogue), 'center' = Title/Transition
  leftAction?: string;
  rightCharacter?: string;
  rightDialogue?: string;
  rightAudioSfx?: string;
  rawText?: string;
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
}

export interface TamilScreenplayData {
  title: string;
  subtitle?: string;
  scenes: TamilScene[];
  rawText: string;
  hasDialogue: boolean;
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

  const lines = clean.split('\n').map(l => l.trim());

  let docTitle = defaultTitle;
  let subtitle = '';
  const scenes: TamilScene[] = [];
  let currentScene: TamilScene | null = null;

  // Regex patterns for Tamil & standard cinema conventions
  const tamilSceneHeaderRegex = /^(?:காட்சி(?:\s*எண்)?|Scene(?:\s*no\.?)?|SCENE(?:\s*NO\.?)?|sc\s*no\.?|sc\.?\s*no\.?)\s*[:.\s\-]*(\d+[A-Za-z]?)(.*)/i;
  const intExtHeaderRegex = /^(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+(.+?)(?:[-–—]\s*(NIGHT|DAY|EVENING|MORNING|DAWN|DUSK|LATER|CONTINUOUS|NIG|EXT))?$/i;
  const transitionRegex = /^(?:Fade\s*in|Fade\s*out|Cut\s*to|Dissolve\s*to|Fade\s*out\s*[-–—]\s*Fade\s*in|காட்சி\s*மாற்றம்|இடைவேளை|முற்றும்|>.*<|.*TO:)$/i;
  
  // Dialogue matching: "சுரேஷ் :" or "சுரேஷ்:" or "கதாபாத்திரம்: வசனம்"
  const dialogueLineRegex = /^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,35})\s*:\s*(.*)$/;
  const sfxRegex = /^(\(.*\)|SFX\s*:|BGM\s*:|ஒலி\s*:)/i;

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

      let location = 'xyz';
      let realLocation = 'xyz';
      let timeOfDay = 'Day / INT';
      let effects = 'None';
      let explicitChars: string[] | undefined = undefined;

      const locMatch = rest.match(/(?:Script\s*Location|Location|இடம்|Loc(?:ation)?)\s*[:\-]?\s*(.*?)(?=\s*(?:Real\s*Location|Time|நேரம்|Effects?|[-|]|$))/i);
      const realLocMatch = rest.match(/(?:Real\s*Location|Real\s*Loc)\s*[:\-]?\s*(.*?)(?=\s*(?:Time|நேரம்|Effects?|[-|]|$))/i);
      const timeMatch = rest.match(/(?:Time|நேரம்)\s*[:\-]?\s*(.*?)(?=\s*(?:Effects?|Real|[-|]|$))/i);
      const effMatch = rest.match(/(?:Effects?|Effect)\s*[:\-]?\s*(.*?)(?=\s*(?:[-|]|$))/i);

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

        const isScriptLoc = nextLine.match(/(?:Script\s*Location|Location|இடம்)\s*[:\-]?\s*(.*?)(?=\s*(?:Real\s*Location|Time|நேரம்|Effects?|[-|]|$))/i);
        const isRealLoc = nextLine.match(/(?:Real\s*Location|Real\s*Loc)\s*[:\-]?\s*(.*?)(?=\s*(?:Time|நேரம்|Effects?|[-|]|$))/i);
        const isTime = nextLine.match(/(?:Time|நேரம்)\s*[:\-]?\s*(.*?)(?=\s*(?:Effects?|Real|[-|]|$))/i);
        const isEff = nextLine.match(/(?:Effects?|Effect)\s*[:\-]?\s*(.*)/i);
        const isChar = nextLine.match(/(?:Characters?(?:\s*\([^)]*\))?|கதாபாத்திரங்கள்(?:\s*\([^)]*\))?)\s*[:\-]?\s*(.*)/i);

        if (isScriptLoc || isRealLoc || isTime || isEff || isChar) {
          if (isScriptLoc && isScriptLoc[1].trim()) location = isScriptLoc[1].trim();
          if (isRealLoc && isRealLoc[1].trim()) realLocation = isRealLoc[1].trim();
          if (isTime && isTime[1].trim()) timeOfDay = isTime[1].trim();
          if (isEff && isEff[1].trim()) effects = isEff[1].trim();
          if (isChar && isChar[1].trim()) {
            explicitChars = isChar[1].split(',').map((c) => c.trim()).filter(Boolean);
          }
          nextIdx++;
        } else {
          break;
        }
      }

      if (location === 'xyz' && !locMatch && rest.trim()) {
        const cleanedRest = rest.replace(/^[|:\s]+/, '').trim();
        if (cleanedRest) location = cleanedRest;
      }

      const sluglineText = `sc no: ${scNum}     Script Location: ${location}     Time: ${timeOfDay}`;
      currentScene = {
        id: `scene-${Date.now()}-${scenes.length + 1}`,
        sceneNumber: scNum,
        location,
        realLocation: realLocation !== 'xyz' ? realLocation : location,
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

    // If no scene has been created yet, detect title or create initial scene
    if (!currentScene) {
      if (line.includes('பைலட்') || line.includes('ரங்கா') || (line.length < 35 && !line.includes('இடம்') && !line.includes('.'))) {
        docTitle = line;
      }
      currentScene = {
        id: `scene-${Date.now()}-1`,
        sceneNumber: '1',
        location: 'காட்சி அமைப்பு',
        timeOfDay: 'Nig/Ext',
        sluglineText: `காட்சி : 1     இடம் : காட்சி அமைப்பு     நேரம் : Nig/Ext`,
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

    // Check for prominent title card indicators (e.g., "பைலட் ரங்கா", "டைட்டல் வருவது", "2011...")
    if (line.includes('டைட்டல்') || line.includes('Title') || (line.length < 28 && /^[A-Z\u0B80-\u0BFF\s]+$/.test(line) && (line.includes('ரங்கா') || line.includes('PILOT')))) {
      currentScene.items.push({
        id: `item-${Date.now()}-${lineIdx}`,
        type: 'title',
        column: 'center',
        rawText: line
      });
      lineIdx++;
      continue;
    }

    // 4. Dialogue check (கதாபாத்திரம்: வசனம்)
    const diaMatch = line.match(dialogueLineRegex);
    const isHeaderKeyword = /^(?:காட்சி|இடம்|நேரம்|sc\s*no|scene|location|time|effects?|characters?)/i.test(line);
    if (diaMatch && !isHeaderKeyword) {
      const charName = diaMatch[1].trim();
      let diaText = diaMatch[2].trim();

      // Check subsequent lines for dialogue continuation
      let nextIdx = lineIdx + 1;
      while (nextIdx < lines.length && lines[nextIdx] && !lines[nextIdx].match(dialogueLineRegex) && !lines[nextIdx].match(tamilSceneHeaderRegex) && !lines[nextIdx].match(intExtHeaderRegex) && !transitionRegex.test(lines[nextIdx])) {
        if (lines[nextIdx].length < 120 && !lines[nextIdx].includes('போவது') && !lines[nextIdx].includes('நிற்பது') && !lines[nextIdx].includes('சுடுகிறார்')) {
          diaText += (diaText ? ' ' : '') + lines[nextIdx];
          nextIdx++;
        } else {
          break;
        }
      }

      currentScene.items.push({
        id: `item-${Date.now()}-${lineIdx}`,
        type: 'dialogue',
        column: 'right',
        rightCharacter: charName,
        rightDialogue: diaText
      });
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
    let actionText = line;
    let extractedAudio = '';

    if (actionText.includes('துப்பாக்கி வெடிக்கும் சத்தம்') || actionText.includes('அலறும் சத்தம்')) {
      const sfxPart = actionText.match(/(?:எல்லாரும் அலறும் சத்தம் கேட்கிறது[.\s\-]*|துப்பாக்கி வெடிக்கும் சத்தம் கேட்கிறது[.\s\-]*)+/);
      if (sfxPart && sfxPart.index && sfxPart.index > 20) {
        extractedAudio = sfxPart[0].trim();
        actionText = actionText.slice(0, sfxPart.index).trim();
      }
    }

    currentScene.items.push({
      id: `item-${Date.now()}-${lineIdx}`,
      type: 'action',
      column: 'left',
      leftAction: actionText,
      rightAudioSfx: extractedAudio || undefined
    });
    lineIdx++;
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
  if (scene.characters && scene.characters.length > 0) {
    return scene.characters;
  }
  const set = new Set<string>();
  for (const item of scene.items) {
    let name = (item.rightCharacter || '').trim();
    if (!name && item.column === 'right') {
      const text = (item.rightDialogue || item.rawText || '').trim();
      const m = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:/);
      if (m) name = m[1].trim();
    }
    if (name) {
      if (name.endsWith(':')) name = name.slice(0, -1).trim();
      name = name.replace(/\s*\([^)]*\)$/, '').trim(); // Remove parentheticals like (V.O.)
      if (name && name !== 'கதாபாத்திரம்') {
        set.add(name);
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

        const actionContent = !isRight ? (item.leftAction || item.rawText || '') : '';

        html += `
          <tr style="vertical-align: top;">
            <!-- Left Column: Action OR Right-Aligned Character Name -->
            <td style="padding: 8px 12px 8px 0; font-size: 13.5px; line-height: 1.6; border-right: 1px dashed rgba(148, 163, 184, 0.35);">
              ${isRight ? `
                <div style="text-align: right; font-weight: 800; color: #0284c7;">
                  ${charName || 'கதாபாத்திரம்'} :
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

  // Column split widths (total 10000 DXA)
  const splitPercent = options?.columnSplitPercent ?? 48;
  const totalWidthDxa = 10000;
  const leftColWidth = Math.round(totalWidthDxa * (splitPercent / 100));
  const rightColWidth = totalWidthDxa - leftColWidth;

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

    // 3-Column Scene Heading Box
    children.push(
      new Table({
        width: { size: totalWidthDxa, type: WidthType.DXA },
        borders: headingBorders,
        rows: [
          // Row 1: Sc no: (Left) | empty (Center) | Time: (Right)
          new TableRow({
            children: [
              new TableCell({
                width: { size: 4200, type: WidthType.DXA },
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
                width: { size: 1600, type: WidthType.DXA },
                borders: NO_CELL_BORDERS,
                children: [new Paragraph({ children: [] })],
              }),
              new TableCell({
                width: { size: 4200, type: WidthType.DXA },
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
                width: { size: 4200, type: WidthType.DXA },
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
                width: { size: 1600, type: WidthType.DXA },
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
                width: { size: 4200, type: WidthType.DXA },
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
          // Row 3: Characters(n): (Left) | Effect: (Right)
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 2,
                width: { size: 6500, type: WidthType.DXA },
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
                width: { size: 3500, type: WidthType.DXA },
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

    // Two-Column Content Rows (Completely borderless, zero boxes)
    const tableRows: TableRow[] = [];

    // Subtle Column Header Row (NO cell boxes)
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftColWidth, type: WidthType.DXA },
            borders: NO_CELL_BORDERS,
            children: [
              new Paragraph({
                spacing: { before: 100, after: 60 },
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
            children: [
              new Paragraph({
                spacing: { before: 100, after: 60 },
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

    // Content rows
    scene.items.forEach((item) => {
      if (item.column === 'center' || item.type === 'transition' || item.type === 'title') {
        const centerText = item.rawText || item.leftAction || item.rightDialogue || '';
        tableRows.push(
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                columnSpan: 2,
                width: { size: totalWidthDxa, type: WidthType.DXA },
                borders: NO_CELL_BORDERS,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 160, after: 160 },
                    children: parseFormattedRuns(centerText, {
                      font: fontObj,
                      size: fontSizeHalfPt + 2,
                      bold: true,
                      color: '16A34A',
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

        const leftParas: Paragraph[] = [];
        if (isRight) {
          // Dialogue Row: Character Name on Left TableCell, Right-Aligned with ":"
          leftParas.push(
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 70, after: 70 },
              children: [
                new TextRun({
                  text: `${charName || 'கதாபாத்திரம்'} :`,
                  bold: true,
                  boldComplexScript: true,
                  size: fontSizeHalfPt,
                  sizeComplexScript: fontSizeHalfPt,
                  color: charColor,
                  font: fontObj,
                }),
              ],
            })
          );
        } else {
          // Action Row: Action on Left TableCell, Left-Aligned
          const actionText = item.leftAction || item.rawText || '';
          if (actionText) {
            leftParas.push(
              new Paragraph({
                spacing: { before: 70, after: 90 },
                children: parseFormattedRuns(actionText, {
                  font: fontObj,
                  size: fontSizeHalfPt,
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
              alignment: AlignmentType.LEFT,
              spacing: { before: 70, after: 70 },
              children: parseFormattedRuns(diaText, {
                font: fontObj,
                size: fontSizeHalfPt,
              }),
            })
          );
        } else {
          rightParas.push(new Paragraph({ children: [] }));
        }

        if (item.rightAudioSfx) {
          rightParas.push(
            new Paragraph({
              spacing: { before: 30, after: 60 },
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
              }),
              new TableCell({
                width: { size: rightColWidth, type: WidthType.DXA },
                children: rightParas,
                borders: NO_CELL_BORDERS,
              }),
            ],
          })
        );
      }
    });

    // Push 2-Column Content Table with ZERO borders
    children.push(
      new Table({
        width: { size: totalWidthDxa, type: WidthType.DXA },
        borders: NO_TABLE_BORDERS,
        rows: tableRows,
      })
    );

    children.push(new Paragraph({ spacing: { after: 180 }, children: [] }));
  });

  // Calculate margins in DXA (1mm = 56.7 dxa)
  const marginTop = Math.round((options?.marginTopMm ?? 22) * 56.7);
  const marginBottom = Math.round((options?.marginBottomMm ?? 22) * 56.7);
  const marginLeft = Math.round((options?.marginLeftMm ?? 22) * 56.7);
  const marginRight = Math.round((options?.marginRightMm ?? 22) * 56.7);

  // Paper standard sizes in DXA (twentieths of a point)
  const PAGE_DIMENSIONS_DXA: Record<string, { width: number; height: number }> = {
    A4: { width: 11906, height: 16838 },
    US_Letter: { width: 12240, height: 15840 },
    Legal: { width: 12240, height: 20160 },
  };
  const pageDim = PAGE_DIMENSIONS_DXA[options?.paperStandard || 'A4'] || PAGE_DIMENSIONS_DXA.A4;

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
