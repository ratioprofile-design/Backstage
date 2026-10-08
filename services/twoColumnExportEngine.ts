import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  TamilScreenplayData,
  TamilScene,
  TamilScriptItem,
  getSceneCharacters,
  getSceneEffects,
} from './tamilLeftRightEngine';
import {
  paginateTwoColumnScript,
  TwoColumnPaginationOptions,
  DEFAULT_TWO_COLUMN_PAGINATION_OPTIONS,
  TwoColumnPage,
  TwoColumnPageElement,
  PAPER_DIMENSIONS,
} from './twoColumnPaginator';
import confetti from 'canvas-confetti';

export interface TwoColumnExportOptions extends TwoColumnPaginationOptions {
  watermarkText?: string;
  showWatermark?: boolean;
  projectDraftName?: string;
  authorName?: string;
  showFooter?: boolean;
}

export const DEFAULT_TWO_COLUMN_EXPORT_OPTIONS: TwoColumnExportOptions = {
  ...DEFAULT_TWO_COLUMN_PAGINATION_OPTIONS,
  watermarkText: 'CONFIDENTIAL',
  showWatermark: false,
  projectDraftName: 'DRAFT 1.0',
  authorName: 'Production',
  showFooter: true,
};

/**
 * Generates standalone, print-ready HTML for the 2-Column Kollywood Screenplay.
 * Uses robust flexbox & table layout to guarantee 100% rock-solid alignment in all browsers and PDF engines.
 */
export function generateTwoColumnPrintHtml(
  screenplay: TamilScreenplayData,
  options: TwoColumnExportOptions = DEFAULT_TWO_COLUMN_EXPORT_OPTIONS
): string {
  const pagination = paginateTwoColumnScript(screenplay, options);
  const { pages, totalPages } = pagination;
  const scriptTitle = (screenplay.title || 'Screenplay').trim();

  const pagesHtml = pages.map((page) => {
    const isFirstPage = page.pageNumber === 1;

    const elementsHtml = page.elements.map((elem) => {
      if (elem.type === 'scene_header') {
        const chars = elem.characters || [];
        const charsStr = chars.length > 0 ? chars.join(', ') : 'None';

        if (elem.isContinued) {
          return `
            <div style="border-bottom: 2px solid #0f172a; padding: 4px 0 6px 0; margin-bottom: 12px; font-weight: bold; font-size: 12px;">
              Sc no: ${elem.sceneNumber} &mdash; (Continued &bull; Page ${elem.scenePageNumber || 2}/${elem.sceneTotalPages || 2})
            </div>
          `;
        }

        return `
          <div style="border: 1px solid #1e293b; border-radius: 8px; background-color: #f8fafc; padding: 9px 12px; margin-bottom: 12px; box-sizing: border-box;">
            <!-- ROW 1: Scene No & Time -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: bold; margin-bottom: 5px;">
              <div><span>Sc no: </span><span style="font-weight: 900; font-size: 13px;">${elem.sceneNumber}</span></div>
              <div><span>Time: </span><span style="font-weight: 700;">${elem.timeOfDay || 'Day / INT'}</span></div>
            </div>

            <!-- ROW 2: Script Location (Left) | Pages: X/Y (Center Wireframe Pill) | Real Location (Right) -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; margin-bottom: 5px;">
              <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <span style="font-weight: bold;">Script Location: </span><span>${elem.location || 'xyz'}</span>
              </div>
              <div style="flex-shrink: 0; padding: 2px 10px; border: 1px solid #0f172a; border-radius: 6px; font-weight: bold; font-size: 10.5px; background-color: #ffffff; color: #0f172a; text-align: center;">
                Pages: ${elem.scenePageNumber || 1}/${elem.sceneTotalPages || 1}
              </div>
              <div style="flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <span style="font-weight: bold;">Real Location: </span><span>${elem.realLocation || elem.location || 'xyz'}</span>
              </div>
            </div>

            <!-- ROW 3: Characters & Effects -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: bold;">
              <div style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <span style="color: #475569;">Characters(${chars.length}): </span>
                <span style="color: #0284c7; font-weight: 600;">${charsStr}</span>
              </div>
              <div style="text-align: right; white-space: nowrap;">
                <span style="color: #475569;">Effect: </span>
                <span>${elem.effects || 'None'}</span>
              </div>
            </div>
          </div>
        `;
      }

      // Script Item Row
      const item = elem.item;
      if (item.column === 'center' || item.type === 'transition' || item.type === 'title') {
        const text = item.rawText || item.leftAction || item.rightDialogue || '';
        return `
          <div style="width: 100%; text-align: center; padding: 6px 0; margin: 8px 0; font-weight: bold; font-size: 12.5px; color: #b45309; border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1;">
            ${text}
          </div>
        `;
      }

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

      return `
        <div style="display: flex; align-items: flex-start; margin-bottom: 8px; font-size: ${options.baseFontSizePx}px; line-height: ${options.baseLineHeight};">
          <!-- Left Column (Visual Action or Character Name) -->
          <div style="width: ${options.columnSplitPercent}%; padding-right: 12px; box-sizing: border-box; text-align: ${isRight ? 'right' : 'left'};">
            ${
              isRight
                ? (charName ? `<span style="font-weight: 700; color: #0284c7; font-size: 12.5px;">${charName} :</span>` : '')
                : `<span style="color: #0f172a;">${leftActionText}</span>`
            }
          </div>

          <!-- Vertical Hairline Divider -->
          <div style="width: 1px; background-color: #cbd5e1; align-self: stretch; flex-shrink: 0; min-height: 20px;"></div>

          <!-- Right Column (Dialogue / Audio) -->
          <div style="width: ${100 - options.columnSplitPercent}%; padding-left: 12px; box-sizing: border-box; text-align: left;">
            ${isRight ? `<span style="color: #0f172a;">${diaText}</span>` : ''}
          </div>
        </div>
      `;
    }).join('\n');

    return `
      <div class="two-column-print-page" style="
        width: ${page.widthPx}px;
        min-height: ${page.heightPx}px;
        padding-top: ${page.paddingTopPx}px;
        padding-bottom: ${page.paddingBottomPx}px;
        padding-left: ${page.paddingLeftPx}px;
        padding-right: ${page.paddingRightPx}px;
        box-sizing: border-box;
        background-color: #ffffff;
        color: #0f172a;
        font-family: ${options.baseFontFamily};
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        page-break-after: always;
        break-after: page;
        margin: 0 auto;
      ">
        <div>
          ${
            isFirstPage
              ? `
              <!-- Document Title Banner on Page 1 -->
              <div style="text-align: center; padding-bottom: 16px; margin-bottom: 14px; border-bottom: 1.5px solid #e2e8f0;">
                <div style="font-size: 22px; font-weight: 900; color: #047857; letter-spacing: 0.5px;">${scriptTitle}</div>
                <div style="font-size: 11px; color: #64748b; font-family: monospace; margin-top: 4px;">
                  தமிழ் இருபக்க காட்சி-வசனம் வடிவம் &bull; Kollywood 2-Column Format
                </div>
              </div>

              <!-- Two-Column Header Banner -->
              <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; margin-bottom: 14px; border-bottom: 2px solid #10b981; font-size: 11px; font-family: monospace; font-weight: bold; text-transform: uppercase;">
                <div style="display: flex; align-items: center; gap: 6px; color: #059669;">
                  <span style="width: 7px; height: 7px; border-radius: 50%; background-color: #059669; display: inline-block;"></span>
                  <span>இடது: காட்சி விவரம் (Visual Action)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; color: #0284c7;">
                  <span>வலது: வசனம் & ஒலி (Dialogue & Audio)</span>
                  <span style="width: 7px; height: 7px; border-radius: 50%; background-color: #0284c7; display: inline-block;"></span>
                </div>
              </div>
            `
              : `
              <!-- Running Header on Subsequent Pages -->
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9.5px; font-family: monospace; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 14px;">
                <span>${scriptTitle.toUpperCase()}</span>
                <span>KOLLYWOOD 2-COLUMN FORMAT</span>
              </div>
            `
          }

          <!-- Page Body Elements -->
          <div style="width: 100%;">
            ${elementsHtml}
          </div>
        </div>

        <!-- Running Page Footer -->
        <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: #94a3b8; font-family: monospace;">
          <div>${scriptTitle} &bull; ${options.projectDraftName || 'Draft 1.0'}</div>
          <div>Page ${page.pageNumber} of ${totalPages}</div>
          <div>Backstage Screenplay Core</div>
        </div>
      </div>
    `;
  }).join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${scriptTitle} - Kollywood 2-Column Screenplay</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @font-face {
      font-family: 'Vijaya';
      src: local('Vijaya'), url('/fonts/vijaya.ttf') format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Vijaya';
      src: local('Vijaya Bold'), local('Vijaya-Bold'), url('/fonts/vijayab.ttf') format('truetype');
      font-weight: 700;
      font-style: normal;
    }
    @font-face {
      font-family: 'Meera Inimai';
      src: local('Meera Inimai'), local('MeeraInimai-Regular'), url('/fonts/MeeraInimai-Regular.ttf') format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    @page {
      size: A4 portrait;
      margin: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: ${options.baseFontFamily};
    }
    * {
      box-sizing: border-box;
      letter-spacing: normal !important;
    }
    .two-column-print-page {
      page-break-after: always;
      break-after: page;
    }
    @media screen {
      body {
        background: #f1f5f9;
        padding: 24px;
      }
      .two-column-print-page {
        margin-bottom: 32px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `.trim();
}

/**
 * Triggers Native Browser Vector Print Engine.
 * Creates an isolated, zero-UI printing frame that opens the browser print / Save to PDF dialog.
 * Output is 100% vector typography (crisp, selectable text, perfect Tamil ligatures, zero misalignment).
 */
export function printTwoColumnVector(
  screenplay: TamilScreenplayData,
  options: TwoColumnExportOptions = DEFAULT_TWO_COLUMN_EXPORT_OPTIONS
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const html = generateTwoColumnPrintHtml(screenplay, options);

      // Create an invisible iframe attached to body
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        throw new Error('Unable to create print document context');
      }

      doc.open();
      doc.write(html);
      doc.close();

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
              resolve();
            }, 1000);
          } catch (err) {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            reject(err);
          }
        }, 300);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates and downloads a direct high-resolution PDF file (.pdf)
 * using the newly dedicated off-screen Two-Column Engine.
 */
export async function downloadTwoColumnPdf(
  screenplay: TamilScreenplayData,
  options: TwoColumnExportOptions = DEFAULT_TWO_COLUMN_EXPORT_OPTIONS,
  onProgress?: (progressText: string) => void
): Promise<void> {
  const pagination = paginateTwoColumnScript(screenplay, options);
  const { pages, totalPages } = pagination;
  const scriptTitle = (screenplay.title || 'Screenplay').trim();

  onProgress?.(`Preparing ${totalPages} pages for PDF export...`);

  if (document.fonts) {
    await document.fonts.ready;
  }

  // Create an isolated container offscreen
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-99999px';
  container.style.width = '820px';
  container.style.zIndex = '-9999';
  container.style.backgroundColor = '#ffffff';
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidthMm = 210;
    const pageHeightMm = 297;

    for (let i = 0; i < pages.length; i++) {
      onProgress?.(`Rendering Page ${i + 1} of ${totalPages}...`);
      const page = pages[i];

      // Build single page HTML
      const singlePageHtml = generateTwoColumnPrintHtml(
        {
          ...screenplay,
          scenes: screenplay.scenes,
        },
        options
      );

      // Parse and extract page
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = singlePageHtml;
      const pageElements = tempDiv.querySelectorAll('.two-column-print-page');
      const targetPageEl = pageElements[i] as HTMLElement;

      if (!targetPageEl) continue;

      container.innerHTML = '';
      container.appendChild(targetPageEl);

      await new Promise((r) => setTimeout(r, 60));

      const canvas = await html2canvas(targetPageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: page.widthPx,
        height: page.heightPx,
      });

      if (i > 0) {
        pdf.addPage('a4', 'p');
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');
    }

    const filename = `${scriptTitle.replace(/\s+/g, '_')}_2Column_Script.pdf`;
    pdf.save(filename);
    confetti({ particleCount: 45, spread: 60, origin: { y: 0.7 } });
    onProgress?.(`✓ Exported "${filename}"!`);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
