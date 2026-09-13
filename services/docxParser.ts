// @ts-ignore
import mammoth from 'mammoth';

/**
 * Parses Word (.docx) documents into clean screenplay text.
 * Works seamlessly with scripts exported from Google Docs, Final Draft to Word, or MS Word.
 */
export async function parseDocxFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  let text = result.value;

  // Clean up excessive blank lines and preserve slugline spacing
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}
