/**
 * Universal Document Pagination Engine for Production Vault.
 * Accurately breaks Word HTML, plain text, and script documents into discrete A4 pages
 * using cumulative DOM layout measurement, sentence-level splitting, and orphan prevention.
 */

export interface DocumentPage {
  pageNumber: number;
  html: string;
  wordCount: number;
  charCount: number;
}

export interface DocumentPaginationResult {
  totalPages: number;
  pages: DocumentPage[];
  totalWordCount: number;
  totalCharCount: number;
}

export interface PaginationOptions {
  fontSize?: 'sm' | 'md' | 'lg' | 'xl'; // Document font size scaling
  fontFamily?: 'serif' | 'sans' | 'mono'; // Document font family
  targetHeightPx?: number; // Target printable content height in pixels (~860px for A4)
  contentWidthPx?: number; // Printable content width (~676px)
}

const FONT_METRICS_MAP = {
  sm: { targetHeightPx: 860, charsPerLine: 78, lineHeightPx: 17.5, pMarginPx: 6.0 },
  md: { targetHeightPx: 860, charsPerLine: 66, lineHeightPx: 20.0, pMarginPx: 6.5 },
  lg: { targetHeightPx: 860, charsPerLine: 56, lineHeightPx: 24.0, pMarginPx: 7.5 },
  xl: { targetHeightPx: 860, charsPerLine: 44, lineHeightPx: 28.0, pMarginPx: 8.5 },
};

/**
 * Strips combining diacritics to measure true visual grapheme width (especially for Tamil / Indic text)
 */
function getVisualLength(text: string): number {
  if (!text) return 0;
  const baseChars = text.replace(/[\u0B82\u0BBE-\u0BCD\u0BD7\u0901-\u0903\u093E-\u094F\u0951-\u0957]/g, '');
  return Math.max(1, baseChars.length);
}

/**
 * Detects if a text block represents a scene heading, slugline, or character cue that should not be orphaned at page bottom
 */
function isSceneHeadingBlock(text: string, html: string): boolean {
  const clean = text.trim();
  if (/^<h[1-6]/i.test(html)) return true;
  if (/^(காட்சி|இடம்|நேரம்|நடிகர்கள்|உரவு|scene|slug|int\.|ext\.|voice\s*over)/i.test(clean)) return true;
  if (clean.length < 40 && (clean.endsWith(':') || clean.includes('காட்சி') || clean.includes('இடம்') || clean.includes('நேரம்'))) return true;
  return false;
}

/**
 * Gets or creates the hidden off-screen measurer element styled identically to the document sheet
 */
function getMeasurer(
  widthPx: number,
  fontSize: 'sm' | 'md' | 'lg' | 'xl',
  fontFamily: 'serif' | 'sans' | 'mono'
): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  try {
    let measurer = document.getElementById('backstage-paginate-measurer');
    if (!measurer) {
      measurer = document.createElement('div');
      measurer.id = 'backstage-paginate-measurer';
      measurer.style.position = 'absolute';
      measurer.style.top = '-99999px';
      measurer.style.left = '0px';
      measurer.style.visibility = 'hidden';
      measurer.style.pointerEvents = 'none';
      measurer.style.zIndex = '-9999';
      measurer.style.boxSizing = 'border-box';
      document.body.appendChild(measurer);
    }

    measurer.style.width = `${widthPx}px`;
    measurer.className = `prose prose-sm max-w-none text-slate-800 ${
      fontFamily === 'sans' ? 'font-sans' : fontFamily === 'mono' ? 'font-mono' : 'font-serif'
    } ${
      fontSize === 'sm'
        ? 'text-[11px] leading-relaxed'
        : fontSize === 'lg'
        ? 'text-[14px] leading-relaxed'
        : fontSize === 'xl'
        ? 'text-[16px] leading-normal'
        : 'text-[12px] leading-relaxed'
    } [&_p]:my-1.5 [&_p]:leading-relaxed [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-1.5`;

    return measurer;
  } catch {
    return null;
  }
}

/**
 * Fallback mathematical height calculation when DOM is unavailable (Node.js / SSR / Unit Tests)
 */
function estimateHtmlHeightFallback(html: string, fontSize: 'sm' | 'md' | 'lg' | 'xl'): number {
  const metrics = FONT_METRICS_MAP[fontSize] || FONT_METRICS_MAP.md;
  
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      let total = 0;
      Array.from(doc.body.children).forEach((el) => {
        const text = el.textContent || '';
        const vLen = getVisualLength(text);
        const lines = Math.max(1, Math.ceil(vLen / metrics.charsPerLine));
        total += lines * metrics.lineHeightPx + metrics.pMarginPx;
      });
      return Math.max(total, 20);
    } catch {
      // fallback to regex
    }
  }

  const pCount = (html.match(/<p\b/gi) || []).length || 1;
  const clean = html.replace(/<[^>]+>/g, ' ').trim();
  const vLen = getVisualLength(clean);
  const lines = Math.max(1, Math.ceil(vLen / metrics.charsPerLine));
  return lines * metrics.lineHeightPx + pCount * metrics.pMarginPx;
}

/**
 * Measures the exact cumulative rendered height of an array of HTML blocks rendered together.
 * Measuring cumulatively is critical to properly account for CSS paragraph margin collapsing.
 */
function measureBlocksCumulativeHeight(
  blocksHtml: string[],
  widthPx: number,
  fontSize: 'sm' | 'md' | 'lg' | 'xl',
  fontFamily: 'serif' | 'sans' | 'mono'
): number {
  if (blocksHtml.length === 0) return 0;
  const combinedHtml = blocksHtml.join('\n');

  const measurer = getMeasurer(widthPx, fontSize, fontFamily);
  if (measurer) {
    measurer.innerHTML = combinedHtml;
    const h = measurer.getBoundingClientRect().height || measurer.offsetHeight;
    if (h > 0) return Math.ceil(h);
  }

  return estimateHtmlHeightFallback(combinedHtml, fontSize);
}

/**
 * Paginates HTML content from Word (.docx), rich text, or HTML files into discrete A4 pages using true cumulative DOM pixel heights.
 */
export function paginateDocumentHtml(
  htmlContent: string,
  options: PaginationOptions = {}
): DocumentPaginationResult {
  if (!htmlContent || !htmlContent.trim()) {
    return {
      totalPages: 1,
      pages: [{ pageNumber: 1, html: '<p class="text-slate-400 italic">Empty document</p>', wordCount: 0, charCount: 0 }],
      totalWordCount: 0,
      totalCharCount: 0,
    };
  }

  const fontSize = options.fontSize || 'md';
  const fontFamily = options.fontFamily || 'serif';
  const targetHeightPx = options.targetHeightPx || 860;
  const contentWidthPx = options.contentWidthPx || 676;

  const pages: DocumentPage[] = [];

  // 1. Extract discrete block elements from incoming HTML
  interface ContentBlock {
    html: string;
    text: string;
    isHeading: boolean;
    vChars: number;
    wordCount: number;
  }
  let blocks: ContentBlock[] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const bodyChildren = Array.from(doc.body.children);

      if (bodyChildren.length > 0) {
        bodyChildren.forEach((child) => {
          const html = child.outerHTML;
          const text = child.textContent || '';
          const isHeading = isSceneHeadingBlock(text, html);
          const vChars = getVisualLength(text);
          const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
          blocks.push({ html, text, isHeading, vChars, wordCount });
        });
      }
    } catch (e) {
      console.warn('DOMParser fallback in paginateDocumentHtml:', e);
    }
  }

  // Fallback splitting if DOMParser returned no children
  if (blocks.length === 0) {
    const rawParagraphs = htmlContent.split(/(?:<\/p>|<\/div>|<\/h[1-6]>|<br\s*[\/]?>|\n\n+)/gi);
    rawParagraphs.forEach((p) => {
      const clean = p.trim();
      if (!clean) return;
      const html = clean.startsWith('<') ? clean : `<p>${clean}</p>`;
      const text = clean.replace(/<[^>]+>/g, '');
      const isHeading = isSceneHeadingBlock(text, html);
      const vChars = getVisualLength(text);
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      blocks.push({ html, text, isHeading, vChars, wordCount });
    });
  }

  if (blocks.length === 0) {
    const text = htmlContent.replace(/<[^>]+>/g, '');
    blocks = [{
      html: `<p>${htmlContent}</p>`,
      text,
      isHeading: false,
      vChars: getVisualLength(text),
      wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
    }];
  }

  // 2. Distribute blocks across pages using cumulative DOM measurement
  let currentPageBlocks: string[] = [];
  let currentWords = 0;
  let currentChars = 0;
  let totalWordCount = 0;
  let totalCharCount = 0;

  const pushCurrentPage = () => {
    if (currentPageBlocks.length === 0) return;
    const pageHtml = currentPageBlocks.join('\n');
    pages.push({
      pageNumber: pages.length + 1,
      html: pageHtml,
      wordCount: currentWords,
      charCount: currentChars,
    });
    totalWordCount += currentWords;
    totalCharCount += currentChars;
    currentPageBlocks = [];
    currentWords = 0;
    currentChars = 0;
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Check if adding this block to the current page exceeds target height
    const testCumulativeHtml = [...currentPageBlocks, block.html];
    const candidateHeight = measureBlocksCumulativeHeight(
      testCumulativeHtml,
      contentWidthPx,
      fontSize,
      fontFamily
    );

    // Case A: Block fits cleanly on current page
    if (candidateHeight <= targetHeightPx) {
      currentPageBlocks.push(block.html);
      currentWords += block.wordCount;
      currentChars += block.vChars;
      continue;
    }

    // Case B: Block does not fit on current page.
    // If this is a Scene Heading / Slugline and we already have content on this page, push to next page to keep with scene
    if (block.isHeading && currentPageBlocks.length > 0) {
      pushCurrentPage();
      currentPageBlocks.push(block.html);
      currentWords = block.wordCount;
      currentChars = block.vChars;
      continue;
    }

    // Case C: Short block (single line dialogue or heading <= 60 chars) or page is nearly full (> 85% target)
    const currentHeightBefore = measureBlocksCumulativeHeight(
      currentPageBlocks,
      contentWidthPx,
      fontSize,
      fontFamily
    );
    const remainingRoomPx = targetHeightPx - currentHeightBefore;

    if (remainingRoomPx < 45 || block.vChars <= 60 || block.text.length <= 60) {
      if (currentPageBlocks.length > 0) {
        pushCurrentPage();
      }
      currentPageBlocks.push(block.html);
      currentWords = block.wordCount;
      currentChars = block.vChars;
      continue;
    }

    // Case D: Multi-sentence paragraph that can be split across the page boundary to fill the page snuggly
    const sentences = block.text.match(/[^.!?\n;:,]+[.!?\n;:,]+(\s+|$)|[^.!?\n;:,]+$/g) || [block.text];
    let part1Sentences: string[] = [];
    let part2Sentences: string[] = [];
    let fillingPart1 = true;

    for (let s of sentences) {
      if (fillingPart1) {
        const testP1 = [...part1Sentences, s].join(' ').trim();
        const testP1Html = `<p class="mb-1.5 leading-relaxed">${testP1}</p>`;
        const testH = measureBlocksCumulativeHeight(
          [...currentPageBlocks, testP1Html],
          contentWidthPx,
          fontSize,
          fontFamily
        );

        if (testH <= targetHeightPx) {
          part1Sentences.push(s);
        } else {
          fillingPart1 = false;
          part2Sentences.push(s);
        }
      } else {
        part2Sentences.push(s);
      }
    }

    const part1Text = part1Sentences.join(' ').trim();
    const part2Text = part2Sentences.join(' ').trim();

    // If part 1 filled a meaningful portion of the page
    if (part1Text && part1Sentences.length > 0) {
      const part1Html = `<p class="mb-1.5 leading-relaxed">${part1Text}</p>`;
      currentPageBlocks.push(part1Html);
      currentWords += part1Text.split(/\s+/).length;
      currentChars += getVisualLength(part1Text);

      pushCurrentPage(); // Complete this page uniformly!

      if (part2Text) {
        const part2Html = `<p class="mb-1.5 leading-relaxed">${part2Text}</p>`;
        currentPageBlocks.push(part2Html);
        currentWords = part2Text.split(/\s+/).length;
        currentChars = getVisualLength(part2Text);
      }
    } else {
      // Could not split cleanly; push entire block to next page
      if (currentPageBlocks.length > 0) {
        pushCurrentPage();
      }
      currentPageBlocks.push(block.html);
      currentWords = block.wordCount;
      currentChars = block.vChars;
    }
  }

  // Final page
  pushCurrentPage();

  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      html: htmlContent,
      wordCount: htmlContent.replace(/<[^>]+>/g, '').split(/\s+/).length,
      charCount: htmlContent.length,
    });
  }

  return {
    totalPages: pages.length,
    pages,
    totalWordCount,
    totalCharCount,
  };
}

/**
 * Paginates plain text or markdown scripts into discrete A4 pages.
 */
export function paginatePlainText(
  text: string,
  options: PaginationOptions = {}
): DocumentPaginationResult {
  if (!text || !text.trim()) {
    return {
      totalPages: 1,
      pages: [{ pageNumber: 1, html: '<p class="text-slate-400 italic">Empty text</p>', wordCount: 0, charCount: 0 }],
      totalWordCount: 0,
      totalCharCount: 0,
    };
  }

  const paragraphs = text.split(/\n\n+/);
  const htmlParagraphs = paragraphs
    .map((p) => `<p class="mb-1.5 leading-relaxed">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  return paginateDocumentHtml(htmlParagraphs, options);
}

