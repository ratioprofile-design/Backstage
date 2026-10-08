/**
 * Universal Document Pagination Engine for Production Vault & Word Documents.
 * Accurately breaks Word HTML, plain text, and script documents into discrete A4 pages
 * exactly matching Microsoft Word print layout using cumulative DOM layout measurement,
 * intelligent table row splitting, sentence-level breaking, and orphan prevention.
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
  fontFamily?: 'sans' | 'serif' | 'mono' | 'calibri' | 'inter' | 'vijaya'; // Document font family
  targetHeightPx?: number; // Target printable content height in pixels (~880px - 940px for A4)
  contentWidthPx?: number; // Printable content width (~670px - 700px)
  isWordDocument?: boolean; // Apply Microsoft Word paragraph and line spacing rules
}

export const FONT_STACK_MAP: Record<string, string> = {
  inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  calibri: "'Calibri', 'Aptos', 'Segoe UI', Arial, sans-serif",
  serif: "'Georgia', 'Cambria', 'Times New Roman', serif",
  mono: "'JetBrains Mono', 'Courier Prime', Menlo, Consolas, monospace",
  vijaya: "'Vijaya', 'Noto Sans Tamil', 'Mukta Malar', sans-serif",
};

const FONT_METRICS_MAP = {
  sm: { targetHeightPx: 880, charsPerLine: 82, lineHeightPx: 17.5, pMarginPx: 6.0 },
  md: { targetHeightPx: 880, charsPerLine: 70, lineHeightPx: 20.0, pMarginPx: 7.0 },
  lg: { targetHeightPx: 880, charsPerLine: 58, lineHeightPx: 24.0, pMarginPx: 8.0 },
  xl: { targetHeightPx: 880, charsPerLine: 46, lineHeightPx: 28.0, pMarginPx: 9.0 },
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
  fontFamily: 'sans' | 'serif' | 'mono' | 'calibri' | 'inter' | 'vijaya' = 'sans'
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
    measurer.style.fontFamily = FONT_STACK_MAP[fontFamily] || FONT_STACK_MAP.sans;
    measurer.className = `prose prose-sm max-w-none text-slate-800 ${
      fontSize === 'sm'
        ? 'text-[11px] leading-relaxed'
        : fontSize === 'lg'
        ? 'text-[14px] leading-relaxed'
        : fontSize === 'xl'
        ? 'text-[16px] leading-normal'
        : 'text-[12px] leading-relaxed'
    } [&_p]:my-1.5 [&_p]:leading-relaxed [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-1.5 [&_table]:w-full [&_table]:border-collapse [&_th]:p-2 [&_td]:p-2`;

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
      // fallback
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
 * Measuring cumulatively is critical to properly account for CSS paragraph margin collapsing and table layouts.
 */
function measureBlocksCumulativeHeight(
  blocksHtml: string[],
  widthPx: number,
  fontSize: 'sm' | 'md' | 'lg' | 'xl',
  fontFamily: 'sans' | 'serif' | 'mono' | 'calibri' | 'inter' | 'vijaya'
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

interface ContentBlock {
  html: string;
  text: string;
  isHeading: boolean;
  vChars: number;
  wordCount: number;
  isTable?: boolean;
}

/**
 * Recursively extracts granular block-level elements from a container.
 * Unwraps outer wrappers (<div class="doc-document-wrapper">, sections, etc.)
 * so each paragraph, heading, list, or table can be independently paginated across pages.
 */
function extractBlockElementsFromNode(node: Element): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const tag = node.tagName.toLowerCase();

  // If node is a TABLE, check if it's large and can be row-split, or keep as atomic table block
  if (tag === 'table') {
    const text = node.textContent || '';
    blocks.push({
      html: node.outerHTML,
      text,
      isHeading: false,
      vChars: getVisualLength(text),
      wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      isTable: true,
    });
    return blocks;
  }

  // Pure leaf block elements
  if (/^(p|h[1-6]|blockquote|pre|hr|ul|ol)$/i.test(tag)) {
    const html = node.outerHTML;
    const text = node.textContent || '';
    const isHeading = isSceneHeadingBlock(text, html);
    const vChars = getVisualLength(text);
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    blocks.push({ html, text, isHeading, vChars, wordCount });
    return blocks;
  }

  // Wrapper containers (div, section, article, main, header, footer)
  const children = Array.from(node.children);
  if (children.length > 0) {
    children.forEach((child) => {
      blocks.push(...extractBlockElementsFromNode(child));
    });
    return blocks;
  }

  // Leaf container with text only
  const text = node.textContent || '';
  if (text.trim()) {
    const html = node.outerHTML;
    const isHeading = isSceneHeadingBlock(text, html);
    const vChars = getVisualLength(text);
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    blocks.push({ html, text, isHeading, vChars, wordCount });
  }

  return blocks;
}

/**
 * Splits an oversized <table> element across pages by rows (<tr>).
 * Preserves the <thead> or header row on each page so the table looks authentic to Microsoft Word.
 */
function splitTableIntoPageChunks(
  tableHtml: string,
  availableHeightPx: number,
  pageHeightPx: number,
  contentWidthPx: number,
  fontSize: 'sm' | 'md' | 'lg' | 'xl',
  fontFamily: 'sans' | 'serif' | 'mono' | 'calibri' | 'inter' | 'vijaya'
): string[] {
  if (typeof DOMParser === 'undefined') return [tableHtml];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(tableHtml, 'text/html');
    const tableEl = doc.querySelector('table');
    if (!tableEl) return [tableHtml];

    // Extract table attributes, classes, and styles
    const tableAttrs = Array.from(tableEl.attributes)
      .map((a) => `${a.name}="${a.value}"`)
      .join(' ');

    // Extract the header (either <thead> or first <tr> with <th>)
    let theadHtml = '';
    const thead = tableEl.querySelector('thead');
    if (thead) {
      theadHtml = thead.outerHTML;
    } else {
      const firstTr = tableEl.querySelector('tr');
      if (firstTr && firstTr.querySelector('th')) {
        theadHtml = `<thead>${firstTr.outerHTML}</thead>`;
      }
    }

    // Extract all data rows
    const allRows = Array.from(tableEl.querySelectorAll('tbody tr, tr:not(thead tr)'));
    // If the first row was used as thead, exclude it
    const dataRows = thead ? allRows : (allRows[0]?.querySelector('th') ? allRows.slice(1) : allRows);

    if (dataRows.length <= 1) return [tableHtml];

    const tableChunks: string[] = [];
    let currentRowChunk: string[] = [];
    let currentLimitPx = availableHeightPx;

    const buildTableChunkHtml = (rowsHtml: string[]): string => {
      return `<table ${tableAttrs}>\n${theadHtml}\n<tbody>\n${rowsHtml.join('\n')}\n</tbody>\n</table>`;
    };

    for (let i = 0; i < dataRows.length; i++) {
      const rowHtml = dataRows[i].outerHTML;
      const testChunkRows = [...currentRowChunk, rowHtml];
      const testTableHtml = buildTableChunkHtml(testChunkRows);

      const measuredH = measureBlocksCumulativeHeight(
        [testTableHtml],
        contentWidthPx,
        fontSize,
        fontFamily
      );

      if (measuredH <= currentLimitPx || currentRowChunk.length === 0) {
        currentRowChunk.push(rowHtml);
      } else {
        // Current chunk is full; push completed table chunk and start a fresh page chunk
        tableChunks.push(buildTableChunkHtml(currentRowChunk));
        currentRowChunk = [rowHtml];
        currentLimitPx = pageHeightPx - 60; // Fresh page gets full height (with margin for table header)
      }
    }

    if (currentRowChunk.length > 0) {
      tableChunks.push(buildTableChunkHtml(currentRowChunk));
    }

    return tableChunks.length > 0 ? tableChunks : [tableHtml];
  } catch (err) {
    console.warn('Table pagination error:', err);
    return [tableHtml];
  }
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
  const fontFamily = options.fontFamily || 'sans';
  const targetHeightPx = options.targetHeightPx || 880;
  const contentWidthPx = options.contentWidthPx || 676;

  const pages: DocumentPage[] = [];

  // 1. Extract discrete block elements from incoming HTML with deep wrapper unwrapping
  let blocks: ContentBlock[] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const bodyChildren = Array.from(doc.body.children);

      if (bodyChildren.length > 0) {
        bodyChildren.forEach((child) => {
          blocks.push(...extractBlockElementsFromNode(child));
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

    // SPECIAL HANDLING: Multi-row Tables that exceed available page room
    if (block.isTable || /<table\b/i.test(block.html)) {
      const currentHeightBefore = measureBlocksCumulativeHeight(
        currentPageBlocks,
        contentWidthPx,
        fontSize,
        fontFamily
      );
      const remainingRoomPx = Math.max(0, targetHeightPx - currentHeightBefore);

      const tableHeight = measureBlocksCumulativeHeight(
        [block.html],
        contentWidthPx,
        fontSize,
        fontFamily
      );

      // Fits on current page
      if (tableHeight <= remainingRoomPx) {
        currentPageBlocks.push(block.html);
        currentWords += block.wordCount;
        currentChars += block.vChars;
        continue;
      }

      // Doesn't fit on current page. Can it fit on an empty fresh page?
      if (tableHeight <= targetHeightPx) {
        if (currentPageBlocks.length > 0) {
          pushCurrentPage();
        }
        currentPageBlocks.push(block.html);
        currentWords = block.wordCount;
        currentChars = block.vChars;
        continue;
      }

      // Large multi-row table: split across pages row-by-row
      const tableChunks = splitTableIntoPageChunks(
        block.html,
        remainingRoomPx > 140 ? remainingRoomPx : targetHeightPx,
        targetHeightPx,
        contentWidthPx,
        fontSize,
        fontFamily
      );

      if (remainingRoomPx <= 140 && currentPageBlocks.length > 0) {
        pushCurrentPage();
      }

      tableChunks.forEach((chunk, chunkIdx) => {
        if (chunkIdx > 0 && currentPageBlocks.length > 0) {
          pushCurrentPage();
        }
        currentPageBlocks.push(chunk);
        currentWords += Math.round(block.wordCount / tableChunks.length);
        currentChars += Math.round(block.vChars / tableChunks.length);
      });
      continue;
    }

    // Standard Block: Check if adding this block to the current page exceeds target height
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

    // Case C: Short block or page is nearly full (> 85% target)
    const currentHeightBefore = measureBlocksCumulativeHeight(
      currentPageBlocks,
      contentWidthPx,
      fontSize,
      fontFamily
    );
    const remainingRoomPx = targetHeightPx - currentHeightBefore;

    if (remainingRoomPx < 50 || block.vChars <= 60 || block.text.length <= 60) {
      if (currentPageBlocks.length > 0) {
        pushCurrentPage();
      }
      currentPageBlocks.push(block.html);
      currentWords = block.wordCount;
      currentChars = block.vChars;
      continue;
    }

    // Case D: Multi-sentence paragraph that can be split across the page boundary to fill the page snuggly
    const isSplittableText = !/<(?:table|tbody|thead|tr|td|th|ul|ol|li|div|blockquote|pre)/i.test(block.html);
    if (!isSplittableText) {
      if (currentPageBlocks.length > 0) {
        pushCurrentPage();
      }
      currentPageBlocks.push(block.html);
      currentWords = block.wordCount;
      currentChars = block.vChars;
      continue;
    }

    const sentences = block.text.match(/[^.!?\n;:,]+[.!?\n;:,]+(\s+|$)|[^.!?\n;:,]+$/g) || [block.text];
    let part1Sentences: string[] = [];
    let part2Sentences: string[] = [];
    let fillingPart1 = true;

    for (const s of sentences) {
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
