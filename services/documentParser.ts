// @ts-ignore
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { ProductionDocument, DocumentFormat } from '../types';
import { isLegacyBamini } from './tamilTranscoder';
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
  thumbnailDataUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  durationSeconds?: number;
  isBaminiConverted?: boolean;
  isBaminiDetected?: boolean;
  originalFileDataUrl?: string;
  originalFileName?: string;
  convertedDocxDataUrl?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Create optimized preview and lightweight thumbnail variants for uploaded images.
 * Guarantees that thumbnailDataUrl is <= 25KB and imageDataUrl is compressed (<= 150KB WebP)
 * so that both laptops can synchronize and preview them with 0 quota errors and 0 missing cards.
 */
async function createOptimizedImageVariants(dataUrl: string): Promise<{
  imageDataUrl: string;
  thumbnailDataUrl: string;
}> {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !dataUrl) {
    return { imageDataUrl: dataUrl, thumbnailDataUrl: dataUrl };
  }
  // SVG images are vector XML text, so keep as-is
  if (dataUrl.startsWith('data:image/svg+xml')) {
    return { imageDataUrl: dataUrl, thumbnailDataUrl: dataUrl };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        if (!origW || !origH) {
          return resolve({ imageDataUrl: dataUrl, thumbnailDataUrl: dataUrl });
        }

        // 1. Generate Full Canvas Preview (max 1600px width/height)
        const maxPreviewDim = 1600;
        let pW = origW;
        let pH = origH;
        if (pW > maxPreviewDim || pH > maxPreviewDim) {
          if (pW > pH) {
            pH = Math.round((pH * maxPreviewDim) / pW);
            pW = maxPreviewDim;
          } else {
            pW = Math.round((pW * maxPreviewDim) / pH);
            pH = maxPreviewDim;
          }
        }

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = pW;
        previewCanvas.height = pH;
        const pCtx = previewCanvas.getContext('2d');
        let compressedDataUrl = dataUrl;
        if (pCtx) {
          pCtx.imageSmoothingEnabled = true;
          pCtx.imageSmoothingQuality = 'high';
          pCtx.drawImage(img, 0, 0, pW, pH);
          compressedDataUrl = previewCanvas.toDataURL('image/webp', 0.82);
          if (!compressedDataUrl.startsWith('data:image/webp')) {
            compressedDataUrl = previewCanvas.toDataURL('image/jpeg', 0.82);
          }
        }

        // 2. Generate Ultra-Fast Thumbnail for Grand Gallery Card (max 380px, ~15KB)
        const maxThumbDim = 380;
        let tW = origW;
        let tH = origH;
        if (tW > maxThumbDim || tH > maxThumbDim) {
          if (tW > tH) {
            tH = Math.round((tH * maxThumbDim) / tW);
            tW = maxThumbDim;
          } else {
            tW = Math.round((tW * maxThumbDim) / tH);
            tH = maxThumbDim;
          }
        }

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = tW;
        thumbCanvas.height = tH;
        const tCtx = thumbCanvas.getContext('2d');
        let thumbnailDataUrl = compressedDataUrl;
        if (tCtx) {
          tCtx.imageSmoothingEnabled = true;
          tCtx.imageSmoothingQuality = 'medium';
          tCtx.drawImage(img, 0, 0, tW, tH);
          thumbnailDataUrl = thumbCanvas.toDataURL('image/webp', 0.72);
          if (!thumbnailDataUrl.startsWith('data:image/webp')) {
            thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);
          }
        }

        resolve({ imageDataUrl: compressedDataUrl, thumbnailDataUrl });
      } catch (e) {
        resolve({ imageDataUrl: dataUrl, thumbnailDataUrl: dataUrl });
      }
    };
    img.onerror = () => {
      resolve({ imageDataUrl: dataUrl, thumbnailDataUrl: dataUrl });
    };
    img.src = dataUrl;
  });
}

/**
 * Universal document parser for Production Vault.
 * Supports Word (.docx), PDF (.pdf), Excel/CSV (.xlsx, .csv), Images (.png, .jpg, .webp, .svg), and Plain Text/Markdown.
 * Detects legacy Bamini typewriter fonts so they can be converted to Tamil Unicode on user request.
 */
export async function parseUniversalFile(file: File, defaultCategory: ProductionDocument['category'] = 'OTHER'): Promise<ParsedDocumentResult> {
  const fileName = file.name;
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  const title = fileName.replace(/\.[^/.]+$/, '');
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
  const fileSize = file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${sizeMb} MB`;
  const originalFileDataUrl = await readFileAsDataUrl(file);

  // 1. Word Documents (.docx, .doc)
  if (extension === '.docx' || extension === '.doc') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      const textResult = await mammoth.extractRawText({ arrayBuffer });

      const rawText = textResult.value || '';
      const rawHtml = htmlResult.value || '';
      const isBamini = isLegacyBamini(rawText) || isLegacyBamini(rawHtml);

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
        isBaminiConverted: false,
        isBaminiDetected: isBamini,
        originalFileDataUrl,
        originalFileName: fileName,
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
        originalFileDataUrl,
        originalFileName: fileName,
      };
    } catch (err) {
      console.error('Spreadsheet parsing failed:', err);
    }
  }

  // 3. Images (.png, .jpg, .jpeg, .webp, .svg, .gif)
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(extension) || file.type.startsWith('image/')) {
    const rawDataUrl = await readFileAsDataUrl(file);
    const { imageDataUrl, thumbnailDataUrl } = await createOptimizedImageVariants(rawDataUrl);
    return {
      title,
      fileName,
      fileSize,
      fileType: 'image',
      category: defaultCategory === 'OTHER' ? 'LOOKBOOK' : defaultCategory,
      pageCount: 1,
      imageDataUrl,
      thumbnailDataUrl,
      textContent: `Visual asset: ${fileName}`,
      originalFileDataUrl: rawDataUrl,
      originalFileName: fileName,
    };
  }

  // 4. Audio Files (.mp3, .wav, .ogg, .m4a, .aac, .flac)
  if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(extension) || file.type.startsWith('audio/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        resolve({
          title,
          fileName,
          fileSize,
          fileType: 'audio',
          category: defaultCategory === 'OTHER' ? 'VOICE_NOTE' : defaultCategory,
          pageCount: 1,
          audioUrl: dataUrl,
          textContent: `Audio file: ${fileName}`,
          originalFileDataUrl: dataUrl,
          originalFileName: fileName,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // 5. Video Files (.mp4, .mov, .mkv, .webm, .avi)
  if (['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(extension) || file.type.startsWith('video/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        resolve({
          title,
          fileName,
          fileSize,
          fileType: 'video',
          category: defaultCategory === 'OTHER' ? 'VIDEO' : defaultCategory,
          pageCount: 1,
          videoUrl: dataUrl,
          textContent: `Video file: ${fileName}`,
          originalFileDataUrl: dataUrl,
          originalFileName: fileName,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // 6. PDF Documents (.pdf)
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
          originalFileDataUrl: dataUrl,
          originalFileName: fileName,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // 7. Text / Markdown / Fountain / HTML
  try {
    const text = await file.text();
    const isBamini = isLegacyBamini(text);

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
      isBaminiConverted: false,
      isBaminiDetected: isBamini,
      originalFileDataUrl,
      originalFileName: fileName,
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
      originalFileDataUrl,
      originalFileName: fileName,
    };
  }
}

