import JSZip from 'jszip';
import { isLegacyBamini, transcodeBaminiToUnicode } from './tamilTranscoder';
import { transcodeBaminiWithDict } from './baminiDictionary';

/**
 * Regex identifying legacy typewriter/non-Unicode Tamil font families commonly used in Word documents.
 * Includes Bamini, Akaram, Ranjani, Aabohi, Jaffna, Nallur, Amudham, Adhawin, Vanavil, Senthamil, etc.
 */
const LEGACY_TAMIL_FONTS_REGEX =
  /(Bamini|Baamini|Akaram|Ranjani|Aabohi|Jaffna|Nallur|Vanavil|Senthamil|SenTamil|Kaveri|Amudham|Mylai|Boomi|Kootu|SHREE|TAM|TAB|TAU|Diamond|Agasthiyar|Aabharan|Anandham|Inaiyamathalam|Tamil-Bible|Tamil|Adhawin|Tamil_Fancy|TamilFancy)/i;

/**
 * Standard English fonts whitelist
 */
const ENGLISH_FONTS_REGEX = /^(times new roman|arial|calibri|courier new|georgia|verdana|helvetica|segoe ui|roboto)$/i;

/**
 * Common English screenplay terms that should remain in English
 */
const ENGLISH_SCRIPT_TERMS = /^(cut|cut to:|fade in|fade out|fead in|fead out|dissolve|dissolve to:|beat|super:|title:|the end|int\.|ext\.|day|night|intercut)$/i;

/**
 * XML Entity Decoding & Encoding helpers
 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function encodeXmlEntities(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts an ArrayBuffer to a base64 Data URL for a Word document.
 */
export function arrayBufferToDocxDataUrl(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`;
}

/**
 * Converts a base64 Data URL to an ArrayBuffer.
 */
export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64Index = dataUrl.indexOf('base64,');
  const base64 = base64Index !== -1 ? dataUrl.slice(base64Index + 7) : dataUrl;
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface DocxTranscodeResult {
  convertedBuffer: ArrayBuffer;
  convertedDataUrl: string;
  isConverted: boolean;
  convertedCount: number;
}

/**
 * Checks if a string contains legacy Bamini typewriter characters
 */
function hasBaminiCharacters(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  // If already predominantly Tamil Unicode, skip
  if (/[\u0B80-\u0BFF]{4,}/.test(text) && !/[;\^~#\$&\%]/.test(text)) return false;
  // If pure English term
  if (ENGLISH_SCRIPT_TERMS.test(text.trim())) return false;
  // Bamini consonant pulli markers (e.g. f;, r;, l;, z;, j;, e;, g;, k;, y;, t;, o;, w;, ];)
  if (/[bcdfghjklmnpqrstvwxyz\]~\[\\];/.test(text)) return true;
  // Bamini vowel combos (e.g. Nf, nf, if, fh, kJ, eL, uT, etc.)
  if (/[Nni][bcdfghjklmnpqrstvwxyz]/.test(text)) return true;
  // Bamini special letters
  if (/[~#\$&\%L\^O]/.test(text)) return true;
  return isLegacyBamini(text);
}

/**
 * In-place XML transcoder for a Word (.docx) document XML string.
 * Transcodes Bamini / legacy Tamil text into Unicode using the canonical 352-entry dictionary,
 * while strictly preserving:
 * - Font sizes (<w:sz>, <w:szCs>)
 * - Text colors (<w:color>)
 * - Text styles (bold <w:b>, italic <w:i>, underline <w:u>, highlight, shading)
 * - Paragraph alignments (<w:jc>), indentations, line spacings
 * - Tables (<w:tbl>), 2-column layouts, table cell borders, background fills, widths, margins
 * - Images, bookmarks, page setup, margins, headers & footers
 */
export function transcodeWordXmlString(
  xmlContent: string,
  options?: { targetFont?: string }
): { newXml: string; wasConverted: boolean; count: number } {
  let wasConverted = false;
  let count = 0;

  const targetFont = options?.targetFont || 'Vijaya';

  // Process paragraph by paragraph (<w:p>...</w:p>) to preserve paragraph context
  const newXml = xmlContent.replace(
    /(<w:p(?:\s+[^>]*)?>)([\s\S]*?)(<\/w:p>)/g,
    (fullP, pOpen, pBody, pClose) => {
      // Check if this paragraph contains legacy Tamil fonts or Bamini text
      const pHasLegacyFont = LEGACY_TAMIL_FONTS_REGEX.test(pBody);
      const pHasBaminiText = hasBaminiCharacters(pBody);

      // If entire paragraph has zero Bamini markers and no legacy fonts, return as is
      if (!pHasLegacyFont && !pHasBaminiText) {
        return fullP;
      }

      // Process all runs (<w:r>...</w:r>) inside this paragraph
      const newPBody = pBody.replace(
        /(<w:r(?:\s+[^>]*)?>)([\s\S]*?)(<\/w:r>)/g,
        (fullRun, rOpen, rBody, rClose) => {
          // Check run's font
          const fontMatch = rBody.match(/<w:rFonts\s+([^>]*?)\/?>/i);
          const fontAttrs = fontMatch ? fontMatch[1] : '';
          const hasLegacyFont = LEGACY_TAMIL_FONTS_REGEX.test(fontAttrs);
          const hasEnglishFont = ENGLISH_FONTS_REGEX.test(fontAttrs);

          // Extract text from <w:t> tags
          const tRegex = /(<w:t(?:\s+[^>]*)?>)([\s\S]*?)(<\/w:t>)/g;
          let runText = '';
          let m: RegExpExecArray | null;
          while ((m = tRegex.exec(rBody)) !== null) {
            runText += decodeXmlEntities(m[2]);
          }

          const trimmedText = runText.trim();
          if (!trimmedText) return fullRun;

          // Pure English script direction (e.g. "cut", "fade in", "fade out")
          if (ENGLISH_SCRIPT_TERMS.test(trimmedText)) {
            return fullRun;
          }

          // If run is explicitly English font and contains no Bamini pullis or markers, skip
          if (hasEnglishFont && !hasBaminiCharacters(runText)) {
            return fullRun;
          }

          // If run is already predominantly Tamil Unicode, leave as is
          if (/[\u0B80-\u0BFF]{5,}/.test(runText) && !hasBaminiCharacters(runText)) {
            return fullRun;
          }

          // Transcode each <w:t> text node using the comprehensive Bamini dictionary
          const updatedBody = rBody.replace(tRegex, (_match, tOpen, textContent, tClose) => {
            const decoded = decodeXmlEntities(textContent);
            if (!decoded.trim()) return tOpen + textContent + tClose;

            // Use comprehensive 352-entry ordered dictionary mapping
            const converted = transcodeBaminiWithDict(decoded);
            if (converted !== decoded) {
              wasConverted = true;
              count++;
            }
            return tOpen + encodeXmlEntities(converted) + tClose;
          });

          let finalBody = updatedBody;

          // Update <w:rFonts> to standard Tamil Unicode font
          const unicodeFontTag = `<w:rFonts w:ascii="${targetFont}" w:hAnsi="${targetFont}" w:cs="${targetFont}" w:hint="cs"/>`;

          if (fontMatch) {
            finalBody = finalBody.replace(/<w:rFonts\s+[^>]*?\/?>/i, unicodeFontTag);
          } else {
            // Inject into <w:rPr>
            if (finalBody.includes('<w:rPr>')) {
              finalBody = finalBody.replace('<w:rPr>', `<w:rPr>${unicodeFontTag}`);
            } else {
              finalBody = `<w:rPr>${unicodeFontTag}</w:rPr>${finalBody}`;
            }
          }

          // Ensure <w:szCs> matches <w:sz> for uniform Tamil complex script font size
          const szMatch = finalBody.match(/<w:sz\s+w:val="(\d+)"/i);
          if (szMatch && !finalBody.includes('<w:szCs')) {
            finalBody = finalBody.replace(
              /(<w:sz\s+w:val="\d+"\s*\/?>)/i,
              `$1<w:szCs w:val="${szMatch[1]}"/>`
            );
          }

          return rOpen + finalBody + rClose;
        }
      );

      return pOpen + newPBody + pClose;
    }
  );

  return { newXml, wasConverted, count };
}

/**
 * Transcodes an authentic Word document (.docx) binary:
 * - Detects Bamini / legacy Tamil typewriter font text
 * - Transcodes all text to Tamil Unicode
 * - Retains 100% of all document formatting, text size, color, bold/italics, tables, columns, margins & styles
 */
export async function transcodeDocxBinaryBaminiToUnicode(
  docxInput: ArrayBuffer | Uint8Array | Blob | string
): Promise<DocxTranscodeResult> {
  let arrayBuffer: ArrayBuffer;

  if (typeof docxInput === 'string') {
    arrayBuffer = dataUrlToArrayBuffer(docxInput);
  } else if (docxInput instanceof Blob) {
    arrayBuffer = await docxInput.arrayBuffer();
  } else if (docxInput instanceof Uint8Array) {
    arrayBuffer = docxInput.buffer as ArrayBuffer;
  } else {
    arrayBuffer = docxInput;
  }

  const zip = await JSZip.loadAsync(arrayBuffer);
  let totalConverted = 0;
  let anyConverted = false;

  // Process all document content XMLs (body, headers, footers, footnotes, endnotes, comments)
  const xmlFileRegex = /^word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/i;
  const filesToProcess: string[] = [];

  zip.forEach((relativePath) => {
    if (xmlFileRegex.test(relativePath)) {
      filesToProcess.push(relativePath);
    }
  });

  for (const filePath of filesToProcess) {
    const file = zip.file(filePath);
    if (!file) continue;

    const xmlText = await file.async('text');
    const { newXml, wasConverted, count } = transcodeWordXmlString(xmlText);

    if (wasConverted) {
      anyConverted = true;
      totalConverted += count;
      zip.file(filePath, newXml);
    }
  }

  // Update styles.xml if legacy font is defined in document styles (e.g. Normal style)
  const stylesFile = zip.file('word/styles.xml');
  if (stylesFile) {
    const stylesXml = await stylesFile.async('text');
    if (LEGACY_TAMIL_FONTS_REGEX.test(stylesXml)) {
      const updatedStyles = stylesXml.replace(
        /<w:rFonts\s+([^>]*?)w:ascii="[^"]*(Bamini|Baamini|Vanavil|Senthamil|SenTamil|Kaveri)[^"]*"/gi,
        '<w:rFonts $1w:ascii="Vijaya" w:hAnsi="Vijaya" w:cs="Vijaya" w:hint="cs"'
      );
      zip.file('word/styles.xml', updatedStyles);
    }
  }

  // Ensure Vijaya and Latha fonts are registered in fontTable.xml
  const fontTableFile = zip.file('word/fontTable.xml');
  if (fontTableFile) {
    const fontTableXml = await fontTableFile.async('text');
    if (!fontTableXml.includes('name="Vijaya"')) {
      const vijayaFontEntry = `
  <w:font w:name="Vijaya">
    <w:charset w:val="00"/>
    <w:family w:val="auto"/>
    <w:pitch w:val="variable"/>
  </w:font>
  <w:font w:name="Latha">
    <w:charset w:val="00"/>
    <w:family w:val="auto"/>
    <w:pitch w:val="variable"/>
  </w:font>
</w:fonts>`;
      const updatedFontTable = fontTableXml.replace(/<\/w:fonts>/i, vijayaFontEntry);
      zip.file('word/fontTable.xml', updatedFontTable);
    }
  }

  const convertedBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const convertedDataUrl = arrayBufferToDocxDataUrl(convertedBuffer);

  return {
    convertedBuffer,
    convertedDataUrl,
    isConverted: anyConverted,
    convertedCount: totalConverted,
  };
}

/**
 * Downloads a Word (.docx) file from Data URL or Blob with given filename
 */
export function downloadConvertedDocxFile(dataUrlOrBlob: string | Blob, filename: string): void {
  const url =
    typeof dataUrlOrBlob === 'string'
      ? dataUrlOrBlob
      : URL.createObjectURL(dataUrlOrBlob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (typeof dataUrlOrBlob !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export const downloadDataUrlAsFile = downloadConvertedDocxFile;
