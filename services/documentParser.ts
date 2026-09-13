// @ts-ignore
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { ProductionDocument, DocumentFormat } from '../types';
import { isLegacyBamini, transcodeBaminiToUnicode, transcodeHtmlBaminiToUnicode } from './tamilTranscoder';
import { paginateDocumentHtml, paginatePlainText } from './documentPaginator';

export interface ParsedDocumentResult {
  title: string;
  fileName: string;
  fileSize: string;
  fileType: DocumentFormat;
  category: ProductionDocument['category'];
  pageCount: number;
  htmlContent?: string;
  textContent?: string;
  sheetData?: any[][];
  pdfDataUrl?: string;
  imageDataUrl?: string;
  isBaminiConverted?: boolean;
}

/**
 * Universal document parser for Production Vault.
 * Supports Word (.docx), PDF (.pdf), Excel/CSV (.xlsx, .csv), Images (.png, .jpg, .webp, .svg), and Plain Text/Markdown.
 * Automatically detects and transcodes legacy Bamini typewriter scripts to Tamil Unicode.
 */
export async function parseUniversalFile(file: File, defaultCategory: ProductionDocument['category'] = 'OTHER'): Promise<ParsedDocumentResult> {
  const fileName = file.name;
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const title = fileName.replace(/\.[^/.]+$/, '');
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
  const fileSize = file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${sizeMb} MB`;

  // 1. Word Documents (.docx, .doc)
  if (extension === '.docx' || extension === '.doc') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      const textResult = await mammoth.extractRawText({ arrayBuffer });

      let rawText = textResult.value || '';
      let rawHtml = htmlResult.value || '';
      let isBamini = isLegacyBamini(rawText);

      // Auto-transcode Bamini script to Unicode by default
      if (isBamini) {
        rawText = transcodeBaminiToUnicode(rawText);
        rawHtml = transcodeHtmlBaminiToUnicode(rawHtml);
      }

      // Calculate precision A4 page count using our pagination engine
      const pagination = paginateDocumentHtml(rawHtml);
      const pageCount = Math.max(1, pagination.totalPages);

      return {
        title,
        fileName,
        fileSize,
        fileType: 'docx',
        category: defaultCategory === 'OTHER' ? 'SCRIPT' : defaultCategory,
        pageCount,
        htmlContent: rawHtml,
        textContent: rawText,
        isBaminiConverted: isBamini,
      };
    } catch (err) {
      console.error('Word Document parsing failed:', err);
    }
  }

  // 2. Spreadsheets (.xlsx, .xls, .csv)
  if (extension === '.xlsx' || extension === '.xls' || extension === '.csv') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0] || '';
      const sheet = workbook.Sheets[firstSheetName];
      const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      const htmlContent = XLSX.utils.sheet_to_html(sheet);

      return {
        title,
        fileName,
        fileSize,
        fileType: 'sheet',
        category: defaultCategory === 'OTHER' ? 'SCHEDULE' : defaultCategory,
        pageCount: workbook.SheetNames.length,
        sheetData,
        htmlContent,
        textContent: `Spreadsheet: ${fileName} (${sheetData.length} rows)`,
      };
    } catch (err) {
      console.error('Spreadsheet parsing failed:', err);
    }
  }

  // 3. Images (.png, .jpg, .jpeg, .webp, .svg, .gif)
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(extension) || file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        resolve({
          title,
          fileName,
          fileSize,
          fileType: 'image',
          category: defaultCategory === 'OTHER' ? 'LOOKBOOK' : defaultCategory,
          pageCount: 1,
          imageDataUrl: dataUrl,
          textContent: `Visual asset: ${fileName}`,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // 4. PDF Documents (.pdf)
  if (extension === '.pdf' || file.type === 'application/pdf') {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        resolve({
          title,
          fileName,
          fileSize,
          fileType: 'pdf',
          category: defaultCategory === 'OTHER' ? 'PERMIT' : defaultCategory,
          pageCount: 3, // Initial estimate for multi-page viewer
          pdfDataUrl: dataUrl,
          textContent: `PDF Document: ${fileName}`,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // 5. Text / Markdown / Fountain / HTML
  try {
    let text = await file.text();
    let isBamini = isLegacyBamini(text);

    if (isBamini) {
      text = transcodeBaminiToUnicode(text);
    }

    const htmlContent = `<div class="whitespace-pre-wrap font-mono text-xs leading-relaxed">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
    const pagination = paginatePlainText(text);

    return {
      title,
      fileName,
      fileSize,
      fileType: 'text',
      category: defaultCategory,
      pageCount: pagination.totalPages,
      textContent: text,
      htmlContent,
      isBaminiConverted: isBamini,
    };
  } catch (err) {
    console.error('File reading failed:', err);
    return {
      title,
      fileName,
      fileSize,
      fileType: 'other',
      category: defaultCategory,
      pageCount: 1,
      textContent: `File: ${fileName}`,
    };
  }
}

