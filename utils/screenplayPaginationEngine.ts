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
export const A4_MARGIN_BOTTOM = 60; // Standard 0.625" screenplay bottom margin
export const A4_MARGIN_LEFT = 144;
export const A4_MARGIN_RIGHT = 96;
export const A4_PAGE_GAP = 20;
export const A4_PAGE_STRIDE = A4_PAGE_HEIGHT + A4_PAGE_GAP; // 1143
export const A4_PAGE_WRITABLE_HEIGHT = A4_PAGE_HEIGHT - A4_MARGIN_TOP - A4_MARGIN_BOTTOM; // 967

export interface LinePaginationResult {
  totalPages: number;
  beatPageMap: Record<number, number>;
}

/**
 * Performs a precision line-level screenplay pagination pass across all scenes.
 * Measures exact DOM bounding rects of scene headings and screenplay lines (.sc-line),
 * enforces orphan rules, and pushes overflowing elements across the dead zone (212px)
 * onto the top of the next A4 sheet with zero cumulative drift across any page count.
 */
export const runLinePaginationPass = (
  container: HTMLElement
): LinePaginationResult => {
  if (!container) return { totalPages: 1, beatPageMap: {} };

  // Step 1: Temporarily clear active page break margins to measure pure, natural DOM coordinates.
  const activeBreakElements = Array.from(
    container.querySelectorAll('[data-page-break], .slugline-banner, .sc-line')
  ) as HTMLElement[];
  activeBreakElements.forEach(el => {
    if (el.dataset.pageBreak || el.style.marginTop) {
      el.style.marginTop = '';
      el.removeAttribute('data-page-break');
    }
  });

  const containerRect = container.getBoundingClientRect();
  const zoom = Math.max(0.1, containerRect.width / A4_PAGE_WIDTH);

  const beatBlocks = Array.from(container.querySelectorAll('.beat-block')) as HTMLElement[];
  if (beatBlocks.length === 0) {
    return { totalPages: 1, beatPageMap: {} };
  }

  // Step 2: Measure natural coordinates of all elements in exact document order
  interface MeasItem {
    el: HTMLElement;
    type: 'slugline' | 'line';
    beatId: number;
    naturalTop: number;
    height: number;
    isCharacter: boolean;
    isDialogue: boolean;
    isParenthetical: boolean;
    isTransition: boolean;
  }

  const elements: MeasItem[] = [];

  beatBlocks.forEach(beatBlock => {
    const beatId = parseInt(beatBlock.id.replace('beat-', ''), 10);
    const slugBanner = beatBlock.querySelector('.slugline-banner') as HTMLElement | null;
    if (slugBanner) {
      const rect = slugBanner.getBoundingClientRect();
      elements.push({
        el: slugBanner,
        type: 'slugline',
        beatId,
        naturalTop: (rect.top - containerRect.top) / zoom,
        height: Math.max(24, rect.height / zoom),
        isCharacter: false,
        isDialogue: false,
        isParenthetical: false,
        isTransition: false,
      });
    }
    const scriptBody = beatBlock.querySelector('.script-body') as HTMLElement | null;
    if (scriptBody) {
      const children = Array.from(scriptBody.children) as HTMLElement[];
      children.forEach(child => {
        if (child.classList.contains('autocomplete-portal') || child.tagName === 'STYLE') return;
        const rect = child.getBoundingClientRect();
        const isChar = child.classList.contains('sc-character');
        const isDial = child.classList.contains('sc-dialogue');
        const isParen = child.classList.contains('sc-parenthetical');
        const isTrans = child.classList.contains('sc-transition') || /^(CUT TO|FADE OUT|DISSOLVE TO|SMASH CUT|FADE IN|MATCH CUT|TRANSITION)/i.test((child.textContent || '').trim());
        elements.push({
          el: child,
          type: 'line',
          beatId,
          naturalTop: (rect.top - containerRect.top) / zoom,
          height: Math.max(18, rect.height / zoom),
          isCharacter: isChar,
          isDialogue: isDial,
          isParenthetical: isParen,
          isTransition: isTrans,
        });
      });
    }
  });

  if (elements.length === 0) {
    return { totalPages: 1, beatPageMap: {} };
  }

  // Step 3: Pure mathematical simulation of page boundaries with exact realTop propagation.
  // By propagating realTop from element to element via naturalDelta and anchoring directly to
  // nextPageWritableStart upon page break, we guarantee zero cumulative drift across any page count.
  const beatPageMap: Record<number, number> = {};
  const breakMargins: number[] = new Array(elements.length).fill(0);
  const breakPageIndices: number[] = new Array(elements.length).fill(0);
  const realTop: number[] = new Array(elements.length).fill(0);

  let pageIndex = 0; // 0 = Page 1, 1 = Page 2...
  realTop[0] = elements[0].naturalTop;
  beatPageMap[elements[0].beatId] = 1;

  for (let i = 0; i < elements.length; i++) {
    const item = elements[i];

    if (i > 0) {
      const naturalDelta = Math.max(0, item.naturalTop - elements[i - 1].naturalTop);
      realTop[i] = realTop[i - 1] + naturalDelta;
    }

    const height = item.height;
    const pageWritableStart = pageIndex * A4_PAGE_STRIDE + A4_MARGIN_TOP;
    const pageWritableEnd = pageIndex * A4_PAGE_STRIDE + (A4_PAGE_HEIGHT - A4_MARGIN_BOTTOM);

    // Lookahead for orphans:
    let threshold = height;
    if (item.type === 'slugline') {
      // Heading requires banner + space for at least 3 lines of action (~110px)
      threshold = Math.max(height + 66, 110);
    } else if (item.isCharacter) {
      // Character cue requires cue + dialogue (or parenthetical + dialogue) below it
      const nextItem = i + 1 < elements.length ? elements[i + 1] : null;
      let dialogueHeight = 44;
      let parenHeight = 0;
      if (nextItem && nextItem.isParenthetical) {
        parenHeight = nextItem.height;
        const afterParen = i + 2 < elements.length ? elements[i + 2] : null;
        dialogueHeight = (afterParen && afterParen.isDialogue) ? afterParen.height : 44;
      } else if (nextItem && nextItem.isDialogue) {
        dialogueHeight = nextItem.height;
      }
      threshold = height + parenHeight + dialogueHeight;

      // If dialogue is followed by a scene-ending transition, protect the transition from orphaning
      const offsetAfterDial = (nextItem && nextItem.isParenthetical) ? 3 : 2;
      const afterDial = i + offsetAfterDial < elements.length ? elements[i + offsetAfterDial] : null;
      if (afterDial && afterDial.beatId === item.beatId && afterDial.isTransition) {
        threshold += afterDial.height;
      }
    } else if (item.isParenthetical) {
      // Parenthetical must not be orphaned without dialogue below it
      const nextItem = i + 1 < elements.length ? elements[i + 1] : null;
      const dialogueHeight = (nextItem && nextItem.isDialogue) ? nextItem.height : 44;
      threshold = height + dialogueHeight;
    }

    // Soft bottom flex: allow up to 24px into the bottom margin if finishing a scene or transition,
    // avoiding breaking a scene across pages when only 1-2 lines remain and preventing large empty gaps.
    const isLastOfBeat = (i + 1 >= elements.length || elements[i + 1].beatId !== item.beatId);
    const effectivePageEnd = (isLastOfBeat || item.isTransition)
      ? pageWritableEnd + 24
      : pageWritableEnd;

    let overflows = (realTop[i] + threshold > effectivePageEnd);

    // A transition ending a scene must not be orphaned alone at the top of the next page before a new scene heading
    const nextItem = i + 1 < elements.length ? elements[i + 1] : null;
    const isNextNewScene = nextItem && nextItem.type === 'slugline';
    if (overflows && item.isTransition && isNextNewScene && (realTop[i] + height <= pageIndex * A4_PAGE_STRIDE + (A4_PAGE_HEIGHT - 30))) {
      overflows = false;
    }

    // Jump to next page if overflowing and not already at the top writable line of the page
    if (overflows && realTop[i] > pageWritableStart + 5 && i > 0) {
      pageIndex++;
      const nextPageWritableStart = pageIndex * A4_PAGE_STRIDE + A4_MARGIN_TOP;
      const prevBottom = realTop[i - 1] + elements[i - 1].height;
      const jump = Math.max(0, Math.round(nextPageWritableStart - prevBottom));

      breakMargins[i] = jump;
      breakPageIndices[i] = pageIndex;
      realTop[i] = prevBottom + jump;
    } else {
      breakMargins[i] = 0;
      breakPageIndices[i] = pageIndex;
    }

    if (!beatPageMap[item.beatId]) {
      beatPageMap[item.beatId] = pageIndex + 1;
    }
  }

  // Step 4: Write pass - apply initial computed margins to the DOM
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i].el;
    const margin = breakMargins[i];

    if (margin > 0) {
      el.style.marginTop = `${margin}px`;
      el.dataset.pageBreak = 'true';
    } else {
      el.style.marginTop = '';
      el.removeAttribute('data-page-break');
    }
  }

  // Step 5: High-precision DOM calibration pass.
  // In real browser engines, font half-leading, subpixel anti-aliasing, and margin-collapse
  // dynamics introduce 1-3px of variance per page break. Over 50-100+ pages, this creates
  // cumulative drift that can push content into the page header and overlap page numbers.
  // We calibrate every page-break element in document order to snap EXACTLY to nextPageWritableStart.
  const calibContainerRect = container.getBoundingClientRect();
  for (let i = 0; i < elements.length; i++) {
    if (breakMargins[i] > 0) {
      const el = elements[i].el;
      const targetPage = breakPageIndices[i];
      const targetDomTop = targetPage * A4_PAGE_STRIDE + A4_MARGIN_TOP;

      const postRect = el.getBoundingClientRect();
      const currentDomTop = (postRect.top - calibContainerRect.top) / zoom;
      const error = Math.round(targetDomTop - currentDomTop);

      if (error !== 0) {
        const adjustedMargin = Math.max(0, breakMargins[i] + error);
        breakMargins[i] = adjustedMargin;
        el.style.marginTop = `${adjustedMargin}px`;
      }
    }
  }

  const totalPages = Math.max(1, pageIndex + 1);

  return { totalPages, beatPageMap };
};

