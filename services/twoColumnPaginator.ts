import {
  TamilScreenplayData,
  TamilScene,
  TamilScriptItem,
  getSceneCharacters,
  getSceneEffects,
  hasEndSceneTransition,
} from './tamilLeftRightEngine';

export type PaperStandard = 'A4' | 'US_Letter' | 'Legal';
export type SceneHeadingStyle = 'kollywood' | 'card' | 'typewriter' | 'underline' | 'boxed';
export type TransitionStyle = 'tracking' | 'dashed' | 'pill' | 'italic';

export interface TwoColumnPaginationOptions {
  paperStandard: PaperStandard;
  marginTopMm: number; // e.g. 25
  marginBottomMm: number; // e.g. 25
  marginLeftMm: number; // e.g. 25
  marginRightMm: number; // e.g. 25
  gapSceneHeaderPx: number; // e.g. 20
  gapParagraphRowPx: number; // e.g. 10
  baseFontSizePx: number; // e.g. 13.5
  baseLineHeight: number; // e.g. 1.6
  baseFontFamily: string; // e.g. 'Vijaya', 'Latha', sans-serif
  columnSplitPercent: number; // e.g. 48 for left
  sceneHeadingStyle: SceneHeadingStyle;
  transitionStyle: TransitionStyle;
  sceneHeadingFontFamily?: string;
  sceneHeadingFontSizePx?: number;
  characterColor?: string;
  showDivider?: boolean;
  dividerStyle?: 'hairline' | 'dashed' | 'none';
  freshPagePerScene?: boolean; // Every fresh scene starts on a new fresh page
  actionTextAlign?: 'left' | 'center' | 'right' | 'justify';
  dialogueTextAlign?: 'left' | 'center' | 'right' | 'justify';
  characterNameBold?: boolean; // Bold character names (default true)
  transitionBold?: boolean; // Bold transitions/titles (default true)
  columnGutterPx?: number; // Space/gutter between left and right columns (default 16px)
  showColumnGuides?: boolean; // Guide header banner (default false, removed everywhere)
  autoEndSceneCutTo?: boolean; // Auto append CUT TO: at the end of scenes if not present (default true)
  endSceneCutToText?: string; // Text for the end transition (default 'CUT TO:')
  transitionColor?: string; // Center / Transition text color (default #f59e0b)
  scriptEdition?: string; // Running footer edition/version name (default '1st Edition')
  scriptEditionDate?: string; // Running footer edition date (e.g. '09 Oct 2026')
}

export const DEFAULT_TWO_COLUMN_PAGINATION_OPTIONS: TwoColumnPaginationOptions = {
  paperStandard: 'A4',
  marginTopMm: 20,
  marginBottomMm: 20,
  marginLeftMm: 20,
  marginRightMm: 20,
  gapSceneHeaderPx: 16,
  gapParagraphRowPx: 8,
  baseFontSizePx: 13,
  baseLineHeight: 1.5,
  baseFontFamily: "'Vijaya', 'Latha', 'Mukta Malar', 'Noto Sans Tamil', system-ui, sans-serif",
  columnSplitPercent: 48,
  sceneHeadingStyle: 'kollywood',
  transitionStyle: 'tracking',
  sceneHeadingFontFamily: "'Inter', system-ui, sans-serif",
  sceneHeadingFontSizePx: 12,
  characterColor: '#0284c7',
  transitionColor: '#f59e0b',
  showDivider: true,
  dividerStyle: 'dashed',
  freshPagePerScene: true,
  actionTextAlign: 'justify',
  dialogueTextAlign: 'left',
  characterNameBold: true,
  transitionBold: true,
  columnGutterPx: 16,
  showColumnGuides: false,
  autoEndSceneCutTo: true,
  endSceneCutToText: 'CUT TO:',
  scriptEdition: '1st Edition',
  scriptEditionDate: '',
};

// Paper Dimensions in CSS pixels (96 DPI standard: 1 inch = 96px, 1mm = 3.7795px)
export const PAPER_DIMENSIONS: Record<PaperStandard, { widthPx: number; heightPx: number; name: string; desc: string }> = {
  A4: { widthPx: 794, heightPx: 1123, name: 'A4 Standard', desc: '210 × 297 mm (International / Kollywood standard)' },
  US_Letter: { widthPx: 816, heightPx: 1056, name: 'US Letter', desc: '8.5 × 11 in (216 × 279 mm)' },
  Legal: { widthPx: 816, heightPx: 1344, name: 'US Legal', desc: '8.5 × 14 in (216 × 356 mm)' },
};

export interface PageSceneHeadingElement {
  type: 'scene_header';
  sceneId: string;
  sceneNumber: string;
  location: string; // Script Location
  realLocation?: string; // Real Shooting Location
  timeOfDay: string;
  sluglineText: string;
  characters: string[];
  effects: string;
  scenePageNumber?: number; // e.g. 1
  sceneTotalPages?: number; // e.g. 3
  isContinued?: boolean;
}

export interface PageItemElement {
  type: 'script_item';
  sceneId: string;
  sceneNumber: string;
  item: TamilScriptItem;
}

export type TwoColumnPageElement = PageSceneHeadingElement | PageItemElement;

export interface TwoColumnPage {
  pageNumber: number;
  totalPages: number;
  sceneId?: string;
  sceneNumber?: string;
  scenePageNumber?: number; // Page X of Y for this scene
  sceneTotalPages?: number; // Total pages for this scene
  continuesToNextPage?: boolean; // True if scene continues onto the next page (- Continues -)
  paperStandard: PaperStandard;
  widthPx: number;
  heightPx: number;
  paddingTopPx: number;
  paddingBottomPx: number;
  paddingLeftPx: number;
  paddingRightPx: number;
  elements: TwoColumnPageElement[];
}

export interface TwoColumnPaginationResult {
  pages: TwoColumnPage[];
  totalPages: number;
  totalItems: number;
  totalScenes: number;
}

/**
 * Strips Tamil combining diacritics to measure true visual grapheme count
 */
function getVisualGraphemeCount(text: string): number {
  if (!text) return 0;
  const base = text.replace(/[\u0B82\u0BBE-\u0BCD\u0BD7\u0901-\u0903\u093E-\u094F\u0951-\u0957]/g, '');
  return Math.max(1, base.length);
}

/**
 * Detects if an item is a transition or centered heading/marker
 */
export function isTransitionOrCenterItem(item: TamilScriptItem): boolean {
  if (item.type === 'transition' || item.type === 'title' || item.column === 'center') {
    return true;
  }
  const raw = (item.rawText || item.leftAction || item.rightDialogue || '').trim();
  if (!raw) return true; // empty item

  const normalized = raw.toUpperCase().replace(/[-\s_:]+/g, ' ');
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
  return transitionPhrases.some((phrase) => normalized.includes(phrase) || raw.includes(phrase));
}

/**
 * Checks if all remaining items from fromIdx to the end of effectiveItems are only transitions or empty items.
 */
function areRemainingItemsOnlyTransitions(items: TamilScriptItem[], fromIdx: number): boolean {
  for (let k = fromIdx; k < items.length; k++) {
    const it = items[k];
    const isTrans = isTransitionOrCenterItem(it);
    if (!isTrans) {
      const hasAction = Boolean((it.leftAction || '').trim());
      const hasDialogue = Boolean((it.rightDialogue || '').trim() || (it.rightCharacter || '').trim());
      if (hasAction || hasDialogue) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Core Two-Column Pagination Engine
 * Measures height of each scene heading, transition, and 2-column row,
 * and splits items across discrete standardized pages with orphan prevention.
 */
export function paginateTwoColumnScript(
  screenplay: TamilScreenplayData,
  options: TwoColumnPaginationOptions = DEFAULT_TWO_COLUMN_PAGINATION_OPTIONS
): TwoColumnPaginationResult {
  const paper = PAPER_DIMENSIONS[options.paperStandard] || PAPER_DIMENSIONS.A4;
  const widthPx = paper.widthPx;
  const heightPx = paper.heightPx;

  // Convert mm margins to px (1mm = 3.7795px)
  const paddingTopPx = Math.round(options.marginTopMm * 3.7795);
  const paddingBottomPx = Math.round(options.marginBottomMm * 3.7795);
  const paddingLeftPx = Math.round(options.marginLeftMm * 3.7795);
  const paddingRightPx = Math.round(options.marginRightMm * 3.7795);

  const contentWidthPx = widthPx - paddingLeftPx - paddingRightPx;
  // Symmetrical printable area: exactly equal top and bottom boundaries
  const printableHeightPx = heightPx - paddingTopPx - paddingBottomPx - 8;

  const leftColWidthPx = Math.round(contentWidthPx * (options.columnSplitPercent / 100)) - 16;
  const rightColWidthPx = Math.round(contentWidthPx * ((100 - options.columnSplitPercent) / 100)) - 16;

  // Approximate character width in pixels based on base font size
  const avgCharWidthPx = options.baseFontSizePx * 0.58;
  const lineHeightPx = options.baseFontSizePx * options.baseLineHeight;

  const pages: TwoColumnPage[] = [];
  let currentPageElements: TwoColumnPageElement[] = [];
  let currentHeightUsed = 0;
  let pageNum = 1;

  const flushPage = (continuesToNext = false) => {
    pages.push({
      pageNumber: pageNum,
      totalPages: 1, // Will update at end
      paperStandard: options.paperStandard,
      widthPx,
      heightPx,
      paddingTopPx,
      paddingBottomPx,
      paddingLeftPx,
      paddingRightPx,
      continuesToNextPage: continuesToNext,
      elements: [...currentPageElements],
    });
    currentPageElements = [];
    currentHeightUsed = 0;
    pageNum++;
  };

  let totalItemsCount = 0;
  const isFreshPage = options.freshPagePerScene === true;

  screenplay.scenes.forEach((scene) => {
    const sceneChars = getSceneCharacters(scene);
    const sceneEffects = getSceneEffects(scene);
    const isKollywood = options.sceneHeadingStyle === 'kollywood';

    // 1. Calculate heading height
    let extraCharHeightPx = 0;
    if (isKollywood) {
      const charText = `Characters(${sceneChars.length}): ${sceneChars.join(', ')}`;
      const effectText = `Effect: ${sceneEffects || 'None'}`;
      const approxEffectWidthPx = Math.max(140, Math.ceil(getVisualGraphemeCount(effectText) * avgCharWidthPx) + 20);
      const availCharWidthPx = Math.max(220, contentWidthPx - approxEffectWidthPx - 24);
      const charLines = Math.max(1, Math.ceil((getVisualGraphemeCount(charText) * avgCharWidthPx) / availCharWidthPx));
      if (charLines > 1) {
        extraCharHeightPx = (charLines - 1) * Math.round(options.baseFontSizePx * 1.35);
      }
    }
    const headingHeightPx = (isKollywood ? (78 + extraCharHeightPx) : 32) + options.gapSceneHeaderPx;

    // Check whether to start a new page before this scene:
    if (isFreshPage && currentPageElements.length > 0) {
      flushPage(false);
    } else if (!isFreshPage && currentPageElements.length > 0) {
      // Continuous mode: require heading + at least 1 item to prevent orphan heading at page bottom
      const minRequiredSpacePx = headingHeightPx + 48;
      if (currentHeightUsed + minRequiredSpacePx > printableHeightPx) {
        flushPage(false);
      } else {
        // Fits comfortably on current page! Add small inter-scene separator gap
        currentHeightUsed += 14;
      }
    }

    let scenePageCount = 1;

    const page1Header: PageSceneHeadingElement = {
      type: 'scene_header',
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      location: scene.location,
      realLocation: scene.realLocation,
      timeOfDay: scene.timeOfDay,
      sluglineText: scene.sluglineText,
      characters: sceneChars,
      effects: sceneEffects,
      scenePageNumber: 1,
      sceneTotalPages: 1, // updated below
      isContinued: false,
    };

    currentPageElements.push(page1Header);
    currentHeightUsed += headingHeightPx;

    // 2. Scene Items (with auto end-of-scene CUT TO if enabled and not already ending with a transition)
    const effectiveItems: TamilScriptItem[] = [...scene.items];
    if (options.autoEndSceneCutTo !== false && !hasEndSceneTransition(scene.items)) {
      effectiveItems.push({
        id: `auto-cut-to-${scene.id}`,
        type: 'transition',
        column: 'center',
        rawText: options.endSceneCutToText || 'CUT TO:',
      });
    }

    effectiveItems.forEach((item, itemIdx) => {
      totalItemsCount++;

      let itemHeightPx = 0;

      if (item.column === 'center' || item.type === 'transition' || item.type === 'title') {
        // Center text (transition / title)
        const text = item.rawText || item.leftAction || item.rightDialogue || '';
        const lines = Math.ceil((getVisualGraphemeCount(text) * avgCharWidthPx) / (contentWidthPx * 0.8)) || 1;
        itemHeightPx = Math.max(28, lines * lineHeightPx + 14) + options.gapParagraphRowPx;
      } else {
        // Two-column row:
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

        const leftActionText = !isRight ? (item.leftAction || item.rawText || '') : '';

        const leftLines = isRight
          ? (charName ? Math.max(1, Math.ceil((getVisualGraphemeCount(charName) * avgCharWidthPx) / leftColWidthPx)) : 1)
          : Math.ceil((getVisualGraphemeCount(leftActionText) * avgCharWidthPx) / leftColWidthPx);

        const rightLines = isRight
          ? Math.ceil((getVisualGraphemeCount(diaText) * avgCharWidthPx) / rightColWidthPx)
          : 0;

        const rowLines = Math.max(leftLines, rightLines, 1);
        itemHeightPx = Math.round(rowLines * lineHeightPx + 6) + options.gapParagraphRowPx;
      }

      // Check if item overflows current page
      if (currentHeightUsed + itemHeightPx > printableHeightPx && currentPageElements.length > 0) {
        // If all remaining items in this scene are only transitions (e.g. CUT TO:, DISSOLVE TO:),
        // NEVER orphan the transition onto a new page alone and NEVER show "- Continues -"!
        // Instead, squeeze the transition onto the current page so the scene concludes properly.
        if (areRemainingItemsOnlyTransitions(effectiveItems, itemIdx)) {
          currentPageElements.push({
            type: 'script_item',
            sceneId: scene.id,
            sceneNumber: scene.sceneNumber,
            item,
          });
          currentHeightUsed += itemHeightPx;
          return;
        }

        flushPage(true); // Marks current page as continuing to next page
        scenePageCount++;

        // On new continued page of this scene:
        const continuedHeader: PageSceneHeadingElement = {
          type: 'scene_header',
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          location: scene.location,
          realLocation: scene.realLocation,
          timeOfDay: scene.timeOfDay,
          sluglineText: `Sc No: ${scene.sceneNumber} - Page ${scenePageCount}`,
          characters: sceneChars,
          effects: sceneEffects,
          scenePageNumber: scenePageCount,
          sceneTotalPages: 1, // updated below
          isContinued: true,
        };

        currentPageElements.push(continuedHeader);
        currentHeightUsed += (isKollywood ? 32 : 24) + options.gapSceneHeaderPx * 0.4;
      }

      currentPageElements.push({
        type: 'script_item',
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        item,
      });
      currentHeightUsed += itemHeightPx;
    });

    // If explicit freshPagePerScene requested, flush page at the end of this scene
    if (isFreshPage && currentPageElements.length > 0) {
      flushPage(false);
    }
  });

  // Flush remaining elements on final page
  if (currentPageElements.length > 0) {
    flushPage(false);
  }

  // Consolidate orphan transition pages (where a page consists ONLY of a continued header and transitions)
  for (let i = pages.length - 1; i >= 1; i--) {
    const p = pages[i];
    const hasStoryItems = p.elements.some((elem) => {
      if (elem.type === 'script_item') {
        return !isTransitionOrCenterItem(elem.item);
      }
      return false;
    });

    if (!hasStoryItems) {
      // This entire page has no action and no dialogue!
      // Move any transition items back to the previous page and remove this redundant page
      const prevPage = pages[i - 1];
      const transitionsToMove = p.elements.filter((elem) => elem.type === 'script_item');
      if (transitionsToMove.length > 0) {
        prevPage.elements.push(...transitionsToMove);
      }
      prevPage.continuesToNextPage = false;
      pages.splice(i, 1);
    }
  }

  // Safety check: A page should NEVER display "- Continues -" if the subsequent page
  // contains only a transition or no active action/dialogue story content.
  for (let i = 0; i < pages.length - 1; i++) {
    const p = pages[i];
    if (p.continuesToNextPage) {
      const nextPage = pages[i + 1];
      const nextPageHasStoryContent = nextPage.elements.some((elem) => {
        if (elem.type === 'script_item') {
          return !isTransitionOrCenterItem(elem.item);
        }
        return false;
      });

      if (!nextPageHasStoryContent) {
        p.continuesToNextPage = false;
      }
    }
  }

  // Re-number pages after consolidation
  pages.forEach((p, idx) => {
    p.pageNumber = idx + 1;
  });

  // Calculate accurate scene pages mapping across all pages
  const scenePageMap = new Map<string, number[]>();
  pages.forEach((p) => {
    p.elements.forEach((elem) => {
      const sId = elem.sceneId;
      if (sId) {
        if (!scenePageMap.has(sId)) {
          scenePageMap.set(sId, []);
        }
        const list = scenePageMap.get(sId)!;
        if (!list.includes(p.pageNumber)) {
          list.push(p.pageNumber);
        }
      }
    });
  });

  // Assign accurate scenePageNumber and sceneTotalPages
  pages.forEach((p) => {
    p.elements.forEach((elem) => {
      if (elem.type === 'scene_header') {
        const pageList = scenePageMap.get(elem.sceneId) || [p.pageNumber];
        const pageIdxInScene = pageList.indexOf(p.pageNumber);
        elem.scenePageNumber = pageIdxInScene >= 0 ? pageIdxInScene + 1 : 1;
        elem.sceneTotalPages = pageList.length;
      }
    });
  });

  // Update overall totalPages across all pages
  const finalTotalPages = pages.length;
  pages.forEach((p) => {
    p.totalPages = finalTotalPages;
  });

  return {
    pages,
    totalPages: finalTotalPages,
    totalItems: totalItemsCount,
    totalScenes: screenplay.scenes.length,
  };
}
