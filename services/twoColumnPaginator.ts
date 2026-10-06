import {
  TamilScreenplayData,
  TamilScene,
  TamilScriptItem,
  getSceneCharacters,
  getSceneEffects,
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
}

export const DEFAULT_TWO_COLUMN_PAGINATION_OPTIONS: TwoColumnPaginationOptions = {
  paperStandard: 'A4',
  marginTopMm: 22,
  marginBottomMm: 22,
  marginLeftMm: 22,
  marginRightMm: 22,
  gapSceneHeaderPx: 20,
  gapParagraphRowPx: 10,
  baseFontSizePx: 13.5,
  baseLineHeight: 1.6,
  baseFontFamily: "'Vijaya', 'Latha', 'Mukta Malar', 'Noto Sans Tamil', system-ui, sans-serif",
  columnSplitPercent: 48,
  sceneHeadingStyle: 'kollywood',
  transitionStyle: 'tracking',
  sceneHeadingFontFamily: "'Inter', system-ui, sans-serif",
  sceneHeadingFontSizePx: 12,
  characterColor: '#0284c7',
  showDivider: true,
  dividerStyle: 'dashed',
  freshPagePerScene: true,
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
  // Reserve ~32px for bottom page number footer (top running header removed)
  const headerFooterReservedPx = 32;
  const printableHeightPx = heightPx - paddingTopPx - paddingBottomPx - headerFooterReservedPx;

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

  screenplay.scenes.forEach((scene) => {
    const sceneChars = getSceneCharacters(scene);
    const sceneEffects = getSceneEffects(scene);
    const isKollywood = options.sceneHeadingStyle === 'kollywood';

    // Track pages belonging to this specific scene
    const scenePagesStartIndex = pages.length;
    let scenePageCount = 1;

    // 1. Scene Heading Element for Page 1 of this scene
    // Dynamically calculate box height based on character count and wrapping
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
    const headingHeightPx = (isKollywood ? (90 + extraCharHeightPx) : 36) + options.gapSceneHeaderPx;

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

    // 2. Scene Items
    scene.items.forEach((item) => {
      totalItemsCount++;

      let itemHeightPx = 0;

      if (item.column === 'center' || item.type === 'transition' || item.type === 'title') {
        // Center text (transition / title)
        const text = item.rawText || item.leftAction || item.rightDialogue || '';
        const lines = Math.ceil((getVisualGraphemeCount(text) * avgCharWidthPx) / (contentWidthPx * 0.8)) || 1;
        itemHeightPx = Math.max(30, lines * lineHeightPx + 16) + options.gapParagraphRowPx;
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
        itemHeightPx = Math.round(rowLines * lineHeightPx + 8) + options.gapParagraphRowPx;
      }

      // Check if item overflows current page
      if (currentHeightUsed + itemHeightPx > printableHeightPx && currentPageElements.length > 0) {
        flushPage(true); // Marks current page as continuing to next page (- Continues -)
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
        currentHeightUsed += (isKollywood ? 36 : 28) + options.gapSceneHeaderPx * 0.5;
      }

      currentPageElements.push({
        type: 'script_item',
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        item,
      });
      currentHeightUsed += itemHeightPx;
    });

    // Flush final page of this scene (fresh scene on fresh page: terminates here)
    if (currentPageElements.length > 0) {
      flushPage(false);
    }

    // Update scene total pages across all pages of THIS scene
    const totalPagesForScene = scenePageCount;
    for (let pIdx = scenePagesStartIndex; pIdx < pages.length; pIdx++) {
      const p = pages[pIdx];
      p.sceneTotalPages = totalPagesForScene;
      p.scenePageNumber = (pIdx - scenePagesStartIndex) + 1;
      p.sceneId = scene.id;
      p.sceneNumber = scene.sceneNumber;
      p.elements.forEach((elem) => {
        if (elem.type === 'scene_header') {
          elem.sceneTotalPages = totalPagesForScene;
        }
      });
    }
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
