
/**
 * Utility functions for handling clipboard paste operations in Backstage.
 * 
 * Goals:
 * 1. Screenplay paste: Preserve or accurately detect screenplay element types
 *    (action, character, dialogue, parenthetical, transition, shot, lyrics)
 *    whether copied from Backstage, another script software, HTML, or plain text.
 * 2. External content paste: Strip all foreign text styling (inline CSS styles,
 *    fonts, font-sizes, text colors, background colors, custom classes) from articles
 *    or web pages, keeping ONLY the element format (block type and bold/italic/underline)
 *    and the content.
 */

export type ScriptElementType = 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'shot' | 'lyrics';

export interface ParsedScreenplayBlock {
  type: ScriptElementType;
  html: string;
}

export interface ScreenplayPasteResult {
  blocks: ParsedScreenplayBlock[];
  isSingleInline: boolean;
  inlineHtml: string;
}

export interface ParsedNoteBlock {
  cls: string;
  html: string;
}

export interface NoteBlockPasteResult {
  blocks: ParsedNoteBlock[];
  isSingleInline: boolean;
  inlineHtml: string;
}

const TRANSITIONS = [
  'CUT TO:', 'FADE IN:', 'FADE OUT:', 'DISSOLVE TO:',
  'SMASH CUT TO:', 'MATCH CUT TO:', 'JUMP CUT TO:', 'TIME CUT:', 'FADE TO BLACK:'
];

const TRANSITIONS_REGEX = /^(CUT TO:|FADE IN:|FADE OUT:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|TIME CUT:|FADE TO BLACK:|[A-Z0-9\s'’-]+ TO:)$/i;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitizes inline HTML content:
 * - Keeps semantic inline markup: <b>, <strong>, <i>, <em>, <u>, <s>, <strike>, <del>, <br>
 * - Normalizes tags to <b>, <i>, <u>, <s>, <br>
 * - STRIPS ALL attributes (style, class, id, color, font, etc.)
 * - Unwraps all non-semantic elements (<span>, <font>, <a>, <div>, etc.)
 * - Discards unwanted elements (<script>, <style>, <meta>, <svg>, <img>, etc.)
 */
export function cleanInlineHtml(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent || '');
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();

    // Discard harmful or non-text tags completely
    if (['SCRIPT', 'STYLE', 'META', 'LINK', 'SVG', 'IMG', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'CANVAS', 'VIDEO', 'AUDIO', 'PICTURE', 'SOURCE'].includes(tag)) {
      return '';
    }

    if (tag === 'BR') {
      return '<br>';
    }

    // Process children recursively
    let inner = '';
    for (let i = 0; i < el.childNodes.length; i++) {
      inner += cleanInlineHtml(el.childNodes[i]);
    }

    // Preserve semantic inline formatting WITHOUT any attributes
    if (tag === 'B' || tag === 'STRONG') {
      return inner ? `<b>${inner}</b>` : '';
    }
    if (tag === 'I' || tag === 'EM') {
      return inner ? `<i>${inner}</i>` : '';
    }
    if (tag === 'U') {
      return inner ? `<u>${inner}</u>` : '';
    }
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') {
      return inner ? `<s>${inner}</s>` : '';
    }

    // Check for inline style hints on spans (like font-weight: bold) from articles before unwrapping
    const styleAttr = (el.getAttribute('style') || '').toLowerCase();
    let result = inner;
    if (styleAttr.includes('font-weight: bold') || styleAttr.includes('font-weight: 700') || styleAttr.includes('font-weight: 800') || styleAttr.includes('font-weight: 900')) {
      result = result ? `<b>${result}</b>` : '';
    }
    if (styleAttr.includes('font-style: italic')) {
      result = result ? `<i>${result}</i>` : '';
    }
    if (styleAttr.includes('text-decoration: underline') || styleAttr.includes('text-decoration-line: underline')) {
      result = result ? `<u>${result}</u>` : '';
    }

    return result;
  }

  return '';
}

export function isTransitionLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > 35 || trimmed.length < 4) return false;
  return TRANSITIONS_REGEX.test(trimmed);
}

export function isParentheticalLine(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')');
}

export function isSlugline(text: string): boolean {
  const trimmed = text.trim().toUpperCase();
  return (
    trimmed.startsWith('INT.') ||
    trimmed.startsWith('EXT.') ||
    trimmed.startsWith('INT/EXT') ||
    trimmed.startsWith('EXT/INT') ||
    trimmed.startsWith('INT./EXT.') ||
    trimmed.startsWith('EXT./INT.') ||
    trimmed.startsWith('I/E.') ||
    trimmed.startsWith('I/E ') ||
    trimmed.startsWith('INT ') ||
    trimmed.startsWith('EXT ')
  );
}

export function isCharacterLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 35) return false;

  // Remove extensions like (V.O.), (O.S.), (CONT'D)
  const base = trimmed.replace(/\s*\([^)]*\)/g, '').trim();
  if (!base || base.length < 2) return false;

  // Characters should not end with punctuation marks like period, comma, question mark
  if (/[.,!?:;]$/.test(base)) return false;

  // Must have at least one alphabetic letter
  if (!/[a-zA-Z]/.test(base)) return false;

  // Must be uppercase (standard screenplay format)
  return base === base.toUpperCase();
}

function detectTypeFromClass(className: string): ScriptElementType | null {
  const lower = className.toLowerCase();
  if (lower.includes('sc-character') || lower.includes('character') || lower.includes('dialogue-character')) return 'character';
  if (lower.includes('sc-dialogue') || lower.includes('dialogue') || lower.includes('dialog')) return 'dialogue';
  if (lower.includes('sc-parenthetical') || lower.includes('parenthetical') || lower.includes('paren')) return 'parenthetical';
  if (lower.includes('sc-transition') || lower.includes('transition')) return 'transition';
  if (lower.includes('sc-shot') || lower.includes('shot')) return 'shot';
  if (lower.includes('sc-lyrics') || lower.includes('lyrics') || lower.includes('lyric')) return 'lyrics';
  if (lower.includes('sc-action') || lower.includes('action') || lower.includes('general') || lower.includes('slugline') || lower.includes('sceneheading') || lower.includes('scene-heading')) return 'action';
  return null;
}

/**
 * Parses pasted screenplay content from clipboard.
 */
export function parsePastedScreenplay(clipboardData: DataTransfer): ScreenplayPasteResult {
  const html = clipboardData.getData('text/html');
  const plainText = clipboardData.getData('text/plain') || '';

  // 1. Try parsing HTML if available
  if (html && html.trim()) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Remove style and script tags
      doc.querySelectorAll('style, script, meta, link, svg, noscript').forEach(el => el.remove());

      // Check if this HTML contains explicit screenplay classes (from Backstage or screenplay apps)
      const scNodes = doc.querySelectorAll('.sc-line, .sc-action, .sc-character, .sc-dialogue, .sc-parenthetical, .sc-transition, .sc-shot, .sc-lyrics, .sc-slugline, [class*="character"], [class*="dialogue"], [class*="parenthetical"], [class*="transition"], [class*="action"]');

      if (scNodes.length > 0) {
        const blocks: ParsedScreenplayBlock[] = [];
        scNodes.forEach(node => {
          const el = node as HTMLElement;
          const cls = el.getAttribute('class') || '';
          const detectedType = detectTypeFromClass(cls) || 'action';
          let inner = cleanInlineHtml(el).trim();

          // Handle slugline class
          if (cls.toLowerCase().includes('slugline') || cls.toLowerCase().includes('sceneheading')) {
            inner = inner ? `<b>${inner}</b>` : '';
          }

          blocks.push({
            type: detectedType,
            html: inner || '<br>'
          });
        });

        if (blocks.length > 0) {
          return {
            blocks,
            isSingleInline: false,
            inlineHtml: blocks[0].html
          };
        }
      }

      // 2. Generic HTML (e.g. from web articles, Word, Google Docs)
      // Collect block-level elements
      const blockSelectors = 'h1, h2, h3, h4, h5, h6, p, blockquote, li, tr, div';
      const allBlocks = doc.body.querySelectorAll(blockSelectors);

      // Filter to top-level blocks to avoid duplicates from nested divs
      const topLevelBlocks: HTMLElement[] = [];
      allBlocks.forEach(node => {
        const el = node as HTMLElement;
        const parentBlock = el.parentElement?.closest(blockSelectors);
        if (!parentBlock || parentBlock === doc.body) {
          topLevelBlocks.push(el);
        }
      });

      if (topLevelBlocks.length > 0) {
        const blocks: ParsedScreenplayBlock[] = [];
        let lastType: ScriptElementType = 'action';

        topLevelBlocks.forEach(el => {
          const rawText = el.textContent?.trim() || '';
          if (!rawText) return;

          // Check if block contains <br> separating distinct screenplay lines
          const hasBr = el.querySelector('br') !== null;
          if (hasBr) {
            // Split by <br>
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = el.innerHTML;
            const subNodes: Node[] = Array.from(tempDiv.childNodes);
            let currentLineNodes: Node[] = [];

            const processCurrentLine = () => {
              if (currentLineNodes.length === 0) return;
              const lineWrapper = document.createElement('div');
              currentLineNodes.forEach(n => lineWrapper.appendChild(n.cloneNode(true)));
              const lineText = lineWrapper.textContent?.trim() || '';
              if (lineText) {
                const type = determineBlockType(lineText, el.tagName, lastType);
                lastType = type;
                blocks.push({
                  type,
                  html: cleanInlineHtml(lineWrapper).trim() || '<br>'
                });
              }
              currentLineNodes = [];
            };

            subNodes.forEach(n => {
              if (n.nodeName === 'BR') {
                processCurrentLine();
              } else {
                currentLineNodes.push(n);
              }
            });
            processCurrentLine();
          } else {
            const type = determineBlockType(rawText, el.tagName, lastType);
            lastType = type;
            blocks.push({
              type,
              html: cleanInlineHtml(el).trim() || '<br>'
            });
          }
        });

        if (blocks.length > 0) {
          // If only 1 block and plain text has no newlines, check if it's single inline
          const isSingle = blocks.length === 1 && !plainText.includes('\n') && blocks[0].type === 'action';
          return {
            blocks,
            isSingleInline: isSingle,
            inlineHtml: blocks[0].html
          };
        }
      }
    } catch {
      // Fall through to plain text parsing
    }
  }

  // 3. Fallback: Parse plain text
  return parsePlainTextScreenplay(plainText);
}

function determineBlockType(text: string, tagName: string, previousType: ScriptElementType): ScriptElementType {
  const upperTag = tagName.toUpperCase();
  const trimmed = text.trim();

  if (isTransitionLine(trimmed)) {
    return 'transition';
  }
  if (isParentheticalLine(trimmed)) {
    return 'parenthetical';
  }
  if (isSlugline(trimmed)) {
    return 'action';
  }
  if (isCharacterLine(trimmed)) {
    return 'character';
  }
  if (previousType === 'character' || previousType === 'parenthetical') {
    return 'dialogue';
  }
  if (upperTag === 'BLOCKQUOTE') {
    return 'dialogue';
  }
  return 'action';
}

function parsePlainTextScreenplay(plainText: string): ScreenplayPasteResult {
  const clean = plainText.replace(/\r\n/g, '\n');
  const lines = clean.split('\n');

  // Single line check
  if (lines.length <= 1) {
    const trimmed = clean.trim();
    if (!trimmed) {
      return { blocks: [], isSingleInline: true, inlineHtml: '' };
    }
    if (isCharacterLine(trimmed)) {
      return { blocks: [{ type: 'character', html: escapeHtml(trimmed) }], isSingleInline: false, inlineHtml: escapeHtml(trimmed) };
    }
    if (isTransitionLine(trimmed)) {
      return { blocks: [{ type: 'transition', html: escapeHtml(trimmed) }], isSingleInline: false, inlineHtml: escapeHtml(trimmed) };
    }
    if (isParentheticalLine(trimmed)) {
      return { blocks: [{ type: 'parenthetical', html: escapeHtml(trimmed) }], isSingleInline: false, inlineHtml: escapeHtml(trimmed) };
    }
    // Standard inline snippet
    return {
      blocks: [{ type: 'action', html: escapeHtml(clean) }],
      isSingleInline: true,
      inlineHtml: escapeHtml(clean)
    };
  }

  // Multi-line script
  const blocks: ParsedScreenplayBlock[] = [];
  let lastType: ScriptElementType = 'action';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      // Empty line: reset lastType so that subsequent lines don't falsely stay dialogue
      lastType = 'action';
      continue;
    }

    let type: ScriptElementType = 'action';

    if (isTransitionLine(trimmed)) {
      type = 'transition';
    } else if (isParentheticalLine(trimmed)) {
      type = 'parenthetical';
    } else if (isSlugline(trimmed)) {
      type = 'action';
    } else if (isCharacterLine(trimmed)) {
      type = 'character';
    } else if (lastType === 'character' || lastType === 'parenthetical') {
      type = 'dialogue';
    } else {
      type = 'action';
    }

    lastType = type;
    blocks.push({
      type,
      html: escapeHtml(trimmed)
    });
  }

  return {
    blocks,
    isSingleInline: false,
    inlineHtml: blocks.map(b => b.html).join('<br>')
  };
}

/**
 * Parses pasted content for BlockEditor (notes / scratchpad).
 * Strips all external fonts, colors, and inline styles.
 * Maps headings to nl-h1, nl-h2, quotes to nl-quote, lists to nl-list, checks to nl-check.
 */
export function parsePastedBlocks(clipboardData: DataTransfer): NoteBlockPasteResult {
  const html = clipboardData.getData('text/html');
  const plainText = clipboardData.getData('text/plain') || '';

  if (html && html.trim()) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      doc.querySelectorAll('style, script, meta, link, svg, noscript').forEach(el => el.remove());

      // Check if Backstage nl-blocks exist
      const nlNodes = doc.querySelectorAll('.nl-block');
      if (nlNodes.length > 0) {
        const blocks: ParsedNoteBlock[] = [];
        nlNodes.forEach(node => {
          const el = node as HTMLElement;
          let cls = '';
          if (el.classList.contains('nl-h1')) cls = 'nl-h1';
          else if (el.classList.contains('nl-h2')) cls = 'nl-h2';
          else if (el.classList.contains('nl-quote')) cls = 'nl-quote';
          else if (el.classList.contains('nl-list')) cls = 'nl-list';
          else if (el.classList.contains('nl-num')) cls = 'nl-num';
          else if (el.classList.contains('nl-check')) cls = el.classList.contains('nl-checked') ? 'nl-check nl-checked' : 'nl-check';

          blocks.push({
            cls,
            html: cleanInlineHtml(el).trim() || '<br>'
          });
        });

        if (blocks.length > 0) {
          return {
            blocks,
            isSingleInline: false,
            inlineHtml: blocks[0].html
          };
        }
      }

      // Generic HTML from articles / web pages
      const blockSelectors = 'h1, h2, h3, h4, h5, h6, p, blockquote, li, tr, div';
      const allBlocks = doc.body.querySelectorAll(blockSelectors);

      const topLevelBlocks: HTMLElement[] = [];
      allBlocks.forEach(node => {
        const el = node as HTMLElement;
        const parentBlock = el.parentElement?.closest(blockSelectors);
        if (!parentBlock || parentBlock === doc.body) {
          topLevelBlocks.push(el);
        }
      });

      if (topLevelBlocks.length > 0) {
        const blocks: ParsedNoteBlock[] = [];

        topLevelBlocks.forEach(el => {
          const rawText = el.textContent?.trim() || '';
          if (!rawText) return;

          const tag = el.tagName.toUpperCase();
          let cls = '';
          if (tag === 'H1') cls = 'nl-h1';
          else if (tag === 'H2' || tag === 'H3') cls = 'nl-h2';
          else if (tag === 'BLOCKQUOTE') cls = 'nl-quote';
          else if (tag === 'LI') cls = 'nl-list';

          blocks.push({
            cls,
            html: cleanInlineHtml(el).trim() || '<br>'
          });
        });

        if (blocks.length > 0) {
          const isSingle = blocks.length === 1 && !plainText.includes('\n');
          return {
            blocks,
            isSingleInline: isSingle,
            inlineHtml: blocks[0].html
          };
        }
      }
    } catch {
      // Fall through to plain text
    }
  }

  // Plain text fallback
  const clean = plainText.replace(/\r\n/g, '\n');
  const lines = clean.split('\n');

  if (lines.length <= 1) {
    const trimmed = clean.trim();
    return {
      blocks: [{ cls: '', html: escapeHtml(trimmed) || '<br>' }],
      isSingleInline: true,
      inlineHtml: escapeHtml(trimmed)
    };
  }

  const blocks: ParsedNoteBlock[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      blocks.push({ cls: '', html: '<br>' });
      continue;
    }

    let cls = '';
    let content = trimmed;

    if (content.startsWith('# ')) {
      cls = 'nl-h1';
      content = content.substring(2);
    } else if (content.startsWith('## ') || content.startsWith('### ')) {
      cls = 'nl-h2';
      content = content.replace(/^#{2,3}\s*/, '');
    } else if (content.startsWith('> ')) {
      cls = 'nl-quote';
      content = content.substring(2);
    } else if (content.startsWith('- ') || content.startsWith('* ') || /^\d+\.\s*/.test(content)) {
      cls = 'nl-list';
      content = content.replace(/^[-*]\s*|^\d+\.\s*/, '');
    } else if (content.startsWith('[ ] ') || content.startsWith('[] ')) {
      cls = 'nl-check';
      content = content.replace(/^\[\s*\]\s*/, '');
    } else if (content.startsWith('[x] ') || content.startsWith('[X] ')) {
      cls = 'nl-check nl-checked';
      content = content.replace(/^\[[xX]\]\s*/, '');
    }

    blocks.push({
      cls,
      html: escapeHtml(content) || '<br>'
    });
  }

  return {
    blocks,
    isSingleInline: false,
    inlineHtml: blocks.map(b => b.html).join('<br>')
  };
}
