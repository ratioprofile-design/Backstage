/**
 * Screenplay Pagination Engine
 * Standard 54-line A4 page budgeting, AST tokenization, orphan prevention,
 * and automatic (MORE) / (CONT'D) dialogue continuation.
 */

import { Beat } from '../types';

export interface ScreenplayToken {
  id: string;
  beatId: number;
  type: 'slugline' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'shot' | 'lyrics' | 'more' | 'contd';
  text: string;
  html?: string;
  characterName?: string;
  linesNeeded: number;
  isContinuation?: boolean;
  slugData?: {
    prefix: string;
    location: string;
    time: string;
    sceneNumber?: string;
  };
}

export interface ScreenplayPage {
  pageNumber: number;
  tokens: ScreenplayToken[];
  totalLinesUsed: number;
  maxLines: number;
}

export interface PaginationConfig {
  paperSize?: 'a4' | 'letter';
  maxLinesPerPage?: number; // Standard is 54 lines for A4 screenplay
  charWidthAction?: number; // Characters per action line (default ~60)
  charWidthDialogue?: number; // Characters per dialogue line (default ~36)
  charWidthParenthetical?: number; // Characters per parenthetical line (default ~28)
}

const DEFAULT_CONFIG: Required<PaginationConfig> = {
  paperSize: 'a4',
  maxLinesPerPage: 54, // Standard 54-line A4 screenplay page budget
  charWidthAction: 60,
  charWidthDialogue: 36,
  charWidthParenthetical: 28,
};

/**
 * Strip HTML tags to extract raw plain text
 */
export const stripHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

/**
 * Parses beat HTML content into semantic screenplay tokens
 */
export const tokenizeBeatContent = (beat: Beat, autoNum?: string): ScreenplayToken[] => {
  const tokens: ScreenplayToken[] = [];
  let tokenIdx = 0;

  // 1. Slugline / Scene Heading Token
  const slugText = `${beat.slug?.prefix || 'INT.'} ${beat.slug?.location || 'UNTITLED SCENE'} - ${beat.slug?.time || 'DAY'}`.toUpperCase();
  tokens.push({
    id: `beat-${beat.id}-slug`,
    beatId: beat.id,
    type: 'slugline',
    text: slugText,
    slugData: {
      prefix: beat.slug?.prefix || 'INT.',
      location: beat.slug?.location || 'UNTITLED SCENE',
      time: beat.slug?.time || 'DAY',
      sceneNumber: beat.sceneNumber || autoNum || beat.id.toString(),
    },
    linesNeeded: 3, // Heading + spacing
  });

  if (!beat.content || !beat.content.trim()) {
    // Empty scene placeholder
    tokens.push({
      id: `beat-${beat.id}-empty`,
      beatId: beat.id,
      type: 'action',
      text: '',
      html: '<div class="sc-line sc-action"><br></div>',
      linesNeeded: 1,
    });
    return tokens;
  }

  // Parse HTML elements inside beat.content
  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
  if (!parser) return tokens;

  const doc = parser.parseFromString(`<div>${beat.content}</div>`, 'text/html');
  const container = doc.body.firstElementChild;
  if (!container) return tokens;

  const children = Array.from(container.children);
  if (children.length === 0) {
    const raw = stripHtml(beat.content);
    if (raw) {
      const lineCount = Math.max(1, Math.ceil(raw.length / DEFAULT_CONFIG.charWidthAction));
      tokens.push({
        id: `beat-${beat.id}-el-${tokenIdx++}`,
        beatId: beat.id,
        type: 'action',
        text: raw,
        html: `<div class="sc-line sc-action">${beat.content}</div>`,
        linesNeeded: lineCount + 1, // Text lines + paragraph gap
      });
    }
    return tokens;
  }

  let lastCharacterName = '';

  children.forEach((child) => {
    const classList = child.className || '';
    const text = stripHtml(child.innerHTML);
    if (!text && !child.querySelector('br')) return;

    let type: ScreenplayToken['type'] = 'action';
    let charsPerLine = DEFAULT_CONFIG.charWidthAction;
    let extraSpacingLines = 1; // paragraph spacing

    if (classList.includes('sc-character')) {
      type = 'character';
      lastCharacterName = text.replace(/\s*\(CONT'D\)/gi, '').trim().toUpperCase();
      charsPerLine = 35;
      extraSpacingLines = 1; // Space before character cue
    } else if (classList.includes('sc-dialogue')) {
      type = 'dialogue';
      charsPerLine = DEFAULT_CONFIG.charWidthDialogue;
      extraSpacingLines = 0; // Tight under character / parenthetical
    } else if (classList.includes('sc-parenthetical')) {
      type = 'parenthetical';
      charsPerLine = DEFAULT_CONFIG.charWidthParenthetical;
      extraSpacingLines = 0;
    } else if (classList.includes('sc-transition')) {
      type = 'transition';
      charsPerLine = 30;
      extraSpacingLines = 1;
    } else if (classList.includes('sc-shot')) {
      type = 'shot';
      charsPerLine = DEFAULT_CONFIG.charWidthAction;
      extraSpacingLines = 1;
    } else if (classList.includes('sc-lyrics')) {
      type = 'lyrics';
      charsPerLine = 40;
      extraSpacingLines = 0;
    }

    const calculatedLines = Math.max(1, Math.ceil((text.length || 1) / charsPerLine));
    const linesNeeded = calculatedLines + extraSpacingLines;

    tokens.push({
      id: `beat-${beat.id}-el-${tokenIdx++}`,
      beatId: beat.id,
      type,
      text,
      html: child.outerHTML,
      characterName: type === 'dialogue' || type === 'character' ? lastCharacterName : undefined,
      linesNeeded,
    });
  });

  return tokens;
};

/**
 * Splits a dialogue token cleanly at a sentence or word boundary when it crosses a page budget
 */
const splitDialogueToken = (
  token: ScreenplayToken,
  availableLines: number,
  charWidth: number
): { fitPart: ScreenplayToken; overflowPart: ScreenplayToken } => {
  const maxChars = Math.max(20, (availableLines - 1) * charWidth);
  const words = token.text.split(/\s+/);
  
  let currentLen = 0;
  let splitIndex = 0;
  
  for (let i = 0; i < words.length; i++) {
    if (currentLen + words[i].length + 1 > maxChars && i > 0) {
      break;
    }
    currentLen += words[i].length + 1;
    splitIndex = i + 1;
  }

  // If couldn't split cleanly, split at half
  if (splitIndex <= 0 || splitIndex >= words.length) {
    splitIndex = Math.max(1, Math.floor(words.length / 2));
  }

  const fitText = words.slice(0, splitIndex).join(' ');
  const overflowText = words.slice(splitIndex).join(' ');

  const fitLines = Math.max(1, Math.ceil(fitText.length / charWidth));
  const overflowLines = Math.max(1, Math.ceil(overflowText.length / charWidth));

  const fitPart: ScreenplayToken = {
    ...token,
    id: `${token.id}-p1`,
    text: fitText,
    html: `<div class="sc-line sc-dialogue">${fitText}</div>`,
    linesNeeded: fitLines,
  };

  const overflowPart: ScreenplayToken = {
    ...token,
    id: `${token.id}-p2`,
    text: overflowText,
    html: `<div class="sc-line sc-dialogue">${overflowText}</div>`,
    linesNeeded: overflowLines,
    isContinuation: true,
  };

  return { fitPart, overflowPart };
};

/**
 * Main Pagination Engine Algorithm:
 * Distributes all screenplay tokens into discrete pages respecting
 * the 54-line budget, orphan rules, and (MORE)/(CONT'D) dialogue splits.
 */
export const paginateScreenplay = (
  beats: Beat[],
  config: PaginationConfig = {}
): ScreenplayPage[] => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const pages: ScreenplayPage[] = [];

  // 1. Gather all tokens from all beats in order
  const allTokens: ScreenplayToken[] = [];
  beats.forEach((beat, i) => {
    const autoNum = (beat.sceneNumber && beat.sceneNumber.trim())
      ? beat.sceneNumber.trim()
      : (i + 1).toString();
    const beatTokens = tokenizeBeatContent(beat, autoNum);
    allTokens.push(...beatTokens);
  });

  if (allTokens.length === 0) {
    return [{ pageNumber: 1, tokens: [], totalLinesUsed: 0, maxLines: cfg.maxLinesPerPage }];
  }

  let currentPageNumber = 1;
  let currentTokens: ScreenplayToken[] = [];
  let currentLinesUsed = 0;

  const pushCurrentPage = () => {
    pages.push({
      pageNumber: currentPageNumber,
      tokens: currentTokens,
      totalLinesUsed: currentLinesUsed,
      maxLines: cfg.maxLinesPerPage,
    });
    currentPageNumber++;
    currentTokens = [];
    currentLinesUsed = 0;
  };

  for (let i = 0; i < allTokens.length; i++) {
    const token = allTokens[i];
    const linesRemaining = cfg.maxLinesPerPage - currentLinesUsed;

    // RULE 1: Scene Heading (Slugline) Orphan Prevention
    // A scene heading must have room for heading (3 lines) + at least 2 lines of action or dialogue
    if (token.type === 'slugline') {
      const minRequired = 5;
      if (linesRemaining < minRequired && currentTokens.length > 0) {
        pushCurrentPage();
      }
      currentTokens.push(token);
      currentLinesUsed += token.linesNeeded;
      continue;
    }

    // RULE 2: Character Cue Orphan Prevention
    // A character cue must have room for cue (2 lines) + at least 1-2 lines of dialogue
    if (token.type === 'character') {
      const nextToken = allTokens[i + 1];
      const nextNeeded = nextToken ? Math.min(3, nextToken.linesNeeded) : 2;
      const minRequired = token.linesNeeded + nextNeeded;

      if (linesRemaining < minRequired && currentTokens.length > 0) {
        pushCurrentPage();
      }
      currentTokens.push(token);
      currentLinesUsed += token.linesNeeded;
      continue;
    }

    // RULE 3: Parenthetical Orphan Prevention
    // Parenthetical must stay attached to dialogue
    if (token.type === 'parenthetical') {
      if (linesRemaining < 3 && currentTokens.length > 0) {
        pushCurrentPage();
      }
      currentTokens.push(token);
      currentLinesUsed += token.linesNeeded;
      continue;
    }

    // RULE 4: Token fits completely on current page
    if (currentLinesUsed + token.linesNeeded <= cfg.maxLinesPerPage) {
      currentTokens.push(token);
      currentLinesUsed += token.linesNeeded;
      continue;
    }

    // RULE 5: Token does NOT fit completely. Can it be split? (Dialogue splitting)
    if (token.type === 'dialogue' && linesRemaining >= 4 && token.linesNeeded >= 5) {
      // Split dialogue cleanly: reserve 1 line for (MORE)
      const linesForFirstHalf = linesRemaining - 1;
      const { fitPart, overflowPart } = splitDialogueToken(token, linesForFirstHalf, cfg.charWidthDialogue);

      currentTokens.push(fitPart);
      // Append industry standard (MORE)
      currentTokens.push({
        id: `${token.id}-more`,
        beatId: token.beatId,
        type: 'more',
        text: '(MORE)',
        html: '<div class="sc-line sc-parenthetical select-none opacity-80" style="text-align: center; margin-left: 20%; width: 60%; font-style: italic;">(MORE)</div>',
        linesNeeded: 1,
      });

      pushCurrentPage();

      // Begin new page with CHARACTER (CONT'D)
      const speaker = token.characterName || 'SPEAKER';
      currentTokens.push({
        id: `${token.id}-contd`,
        beatId: token.beatId,
        type: 'contd',
        text: `${speaker} (CONT'D)`,
        html: `<div class="sc-line sc-character font-bold uppercase" style="margin-left: 35%; width: 40%;">${speaker} (CONT'D)</div>`,
        linesNeeded: 2,
      });
      currentLinesUsed += 2;

      // Push remaining dialogue
      currentTokens.push(overflowPart);
      currentLinesUsed += overflowPart.linesNeeded;
      continue;
    }

    // Default: Push token to next page
    if (currentTokens.length > 0) {
      pushCurrentPage();
    }
    currentTokens.push(token);
    currentLinesUsed += token.linesNeeded;
  }

  // Final page
  if (currentTokens.length > 0 || pages.length === 0) {
    pushCurrentPage();
  }

  return pages;
};

export interface ScreenplayBeatPage {
  pageNumber: number;
  beats: Beat[];
  estimatedLines: number;
}

/**
 * Calculates estimated vertical height for a beat in pixels based on standard Courier Prime metrics
 * Heading banner: ~46px
 * Action / Transition: 60 chars per line (~22px line height)
 * Character: 35 chars per line (~22px line height + 10px spacing)
 * Dialogue: 36 chars per line (~22px line height)
 * Parenthetical: 28 chars per line (~22px line height)
 */
export const estimateBeatHeight = (beat: Beat): number => {
  const headingHeight = 46;
  if (!beat.content || !beat.content.trim()) return headingHeight + 50;

  if (typeof DOMParser === 'undefined') {
    const raw = stripHtml(beat.content);
    const lines = Math.max(1, Math.ceil(raw.length / 50));
    return headingHeight + (lines * 22) + 20;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${beat.content}</div>`, 'text/html');
  const container = doc.body.firstElementChild;
  if (!container) return headingHeight + 50;

  const children = Array.from(container.children);
  if (children.length === 0) {
    const raw = stripHtml(beat.content);
    const lines = Math.max(1, Math.ceil(raw.length / 50));
    return headingHeight + (lines * 22) + 20;
  }

  let totalLines = 0;
  children.forEach((child) => {
    const text = stripHtml(child.innerHTML);
    const classList = child.className || '';
    let charsPerLine = 60;
    let extraLines = 1;

    if (classList.includes('sc-character')) {
      charsPerLine = 35;
      extraLines = 1;
    } else if (classList.includes('sc-dialogue')) {
      charsPerLine = 36;
      extraLines = 0;
    } else if (classList.includes('sc-parenthetical')) {
      charsPerLine = 28;
      extraLines = 0;
    } else if (classList.includes('sc-transition')) {
      charsPerLine = 30;
      extraLines = 1;
    }

    const lines = Math.max(1, Math.ceil((text.length || 1) / charsPerLine));
    totalLines += lines + extraLines;
  });

  return headingHeight + (totalLines * 22) + 16;
};

/**
 * Distributes screenplay beats into discrete A4 pages respecting:
 * 1. A4 Writable Height (~920px, equivalent to ~48-52 lines)
 * 2. Scene Heading orphan prevention (if less than 120px remains on page, moves to next page)
 */
export const A4_PAGE_WIDTH = 794;
export const A4_PAGE_HEIGHT = 1123;
export const A4_MARGIN_TOP = 96;
export const A4_MARGIN_BOTTOM = 96;
export const A4_MARGIN_LEFT = 144;
export const A4_MARGIN_RIGHT = 96;
export const A4_PAGE_GAP = 20;
export const A4_PAGE_STRIDE = A4_PAGE_HEIGHT + A4_PAGE_GAP; // 1143
export const A4_PAGE_WRITABLE_HEIGHT = A4_PAGE_HEIGHT - A4_MARGIN_TOP - A4_MARGIN_BOTTOM; // 931

export interface LinePaginationResult {
  totalPages: number;
  beatPageMap: Record<number, number>;
}

/**
 * Performs a precision line-level screenplay pagination pass across all scenes.
 * Measures exact DOM bounding rects of scene headings and screenplay lines (.sc-line),
 * enforces orphan rules, and pushes overflowing elements across the dead zone (232px)
 * onto the top of the next A4 sheet.
 */
export const runLinePaginationPass = (
  container: HTMLElement
): LinePaginationResult => {
  if (!container) return { totalPages: 1, beatPageMap: {} };

  const containerRect = container.getBoundingClientRect();
  const zoom = Math.max(0.1, containerRect.width / A4_PAGE_WIDTH);

  const beatBlocks = Array.from(container.querySelectorAll('.beat-block')) as HTMLElement[];
  if (beatBlocks.length === 0) {
    return { totalPages: 1, beatPageMap: {} };
  }

  // Measure natural continuous coordinates of all elements without mutating the DOM.
  // We account for any active page-break margins in the DOM by tracking currentDomShift.
  interface MeasItem {
    el: HTMLElement;
    type: 'slugline' | 'line';
    beatId: number;
    naturalTop: number;
    height: number;
    isCharacter: boolean;
    isDialogue: boolean;
  }

  const elements: MeasItem[] = [];
  let currentDomShift = 0;

  beatBlocks.forEach(beatBlock => {
    const beatId = parseInt(beatBlock.id.replace('beat-', ''), 10);
    const slugBanner = beatBlock.querySelector('.slugline-banner') as HTMLElement | null;
    if (slugBanner) {
      if (slugBanner.dataset.pageBreak === 'true') {
        currentDomShift += parseFloat(slugBanner.style.marginTop || '0') || 0;
      }
      const rect = slugBanner.getBoundingClientRect();
      elements.push({
        el: slugBanner,
        type: 'slugline',
        beatId,
        naturalTop: ((rect.top - containerRect.top) / zoom) - currentDomShift,
        height: Math.max(24, rect.height / zoom),
        isCharacter: false,
        isDialogue: false,
      });
    }
    const scriptBody = beatBlock.querySelector('.script-body') as HTMLElement | null;
    if (scriptBody) {
      const children = Array.from(scriptBody.children) as HTMLElement[];
      children.forEach(child => {
        if (child.classList.contains('autocomplete-portal') || child.tagName === 'STYLE') return;
        if (child.dataset.pageBreak === 'true') {
          currentDomShift += parseFloat(child.style.marginTop || '0') || 0;
        }
        const rect = child.getBoundingClientRect();
        const isChar = child.classList.contains('sc-character');
        const isDial = child.classList.contains('sc-dialogue');
        elements.push({
          el: child,
          type: 'line',
          beatId,
          naturalTop: ((rect.top - containerRect.top) / zoom) - currentDomShift,
          height: Math.max(18, rect.height / zoom),
          isCharacter: isChar,
          isDialogue: isDial,
        });
      });
    }
  });

  if (elements.length === 0) {
    return { totalPages: 1, beatPageMap: {} };
  }

  // Step 3: Pure mathematical simulation of page boundaries
  const beatPageMap: Record<number, number> = {};
  const breakMargins: number[] = new Array(elements.length).fill(0);
  let shift = 0;
  let pageIndex = 0; // 0 = Page 1, 1 = Page 2...

  for (let i = 0; i < elements.length; i++) {
    const item = elements[i];
    const currentTop = item.naturalTop + shift;
    const height = item.height;

    const pageWritableStart = pageIndex * A4_PAGE_STRIDE + A4_MARGIN_TOP;
    const pageWritableEnd = pageIndex * A4_PAGE_STRIDE + (A4_PAGE_HEIGHT - A4_MARGIN_BOTTOM);

    // Lookahead for orphans:
    let threshold = height;
    if (item.type === 'slugline') {
      // Heading requires banner + space for at least 3 lines of action (~110px)
      threshold = Math.max(height + 66, 110);
    } else if (item.isCharacter) {
      // Character cue requires cue + dialogue below it
      const nextItem = i + 1 < elements.length ? elements[i + 1] : null;
      const dialogueHeight = (nextItem && nextItem.isDialogue) ? nextItem.height : 44;
      threshold = height + dialogueHeight;
    }

    const overflows = (currentTop + threshold > pageWritableEnd);

    // Only jump if we are not already at the top writable line of the page
    if (overflows && currentTop > pageWritableStart + 5) {
      pageIndex++;
      const nextPageWritableStart = pageIndex * A4_PAGE_STRIDE + A4_MARGIN_TOP;
      const jump = Math.max(0, Math.round(nextPageWritableStart - currentTop));

      breakMargins[i] = jump;
      shift += jump;
    } else {
      breakMargins[i] = 0;
    }

    if (!beatPageMap[item.beatId]) {
      beatPageMap[item.beatId] = pageIndex + 1;
    }
  }

  // Step 4: Write pass - apply the computed margins to the DOM with subpixel deadband
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i].el;
    const margin = Math.round(breakMargins[i]);
    const currentMargin = parseFloat(el.style.marginTop || '0') || 0;

    // Subpixel deadband: do not mutate DOM if the change is negligible (<= 1.5px)
    const needsUpdate = (margin === 0 && currentMargin > 0) ||
                        (margin > 0 && currentMargin === 0) ||
                        (margin > 0 && Math.abs(margin - currentMargin) > 1.5);

    if (needsUpdate) {
      const targetMargin = margin > 0 ? `${margin}px` : '';
      el.style.marginTop = targetMargin;
      if (margin > 0) {
        el.dataset.pageBreak = 'true';
      } else {
        el.removeAttribute('data-page-break');
      }
    }
  }

  const totalPages = Math.max(1, pageIndex + 1);
  return { totalPages, beatPageMap };
};

