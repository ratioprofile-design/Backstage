import React, { useState, useMemo } from 'react';
import {
  TamilScreenplayData,
  generateTamilLeftRightDocx,
  downloadBlobAsFile,
} from '../services/tamilLeftRightEngine';
import {
  downloadTwoColumnPdf,
  printTwoColumnVector,
  TwoColumnExportOptions,
  DEFAULT_TWO_COLUMN_EXPORT_OPTIONS,
} from '../services/twoColumnExportEngine';
import {
  paginateTwoColumnScript,
  PAPER_DIMENSIONS,
} from '../services/twoColumnPaginator';
import {
  X,
  Download,
  FileDown,
  Printer,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Layers,
  FileText,
  Sliders,
  Check,
  Loader2,
} from 'lucide-react';

export interface TwoColumnExportModalProps {
  screenplayData: TamilScreenplayData;
  isOpen: boolean;
  onClose: () => void;
  isLight?: boolean;
}

export const TwoColumnExportModal: React.FC<TwoColumnExportModalProps> = ({
  screenplayData,
  isOpen,
  onClose,
  isLight = false,
}) => {
  const [exportOptions, setExportOptions] = useState<TwoColumnExportOptions>(
    DEFAULT_TWO_COLUMN_EXPORT_OPTIONS
  );
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(90);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportStatusText, setExportStatusText] = useState<string>('');
  const [isGeneratingDocx, setIsGeneratingDocx] = useState<boolean>(false);

  // Paginate with current export options
  const paginationResult = useMemo(() => {
    return paginateTwoColumnScript(screenplayData, exportOptions);
  }, [screenplayData, exportOptions]);

  const { pages, totalPages, totalItems, totalScenes } = paginationResult;
  const activePage = pages[currentPageNum - 1] || pages[0];

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      await downloadTwoColumnPdf(screenplayData, exportOptions, (status) => {
        setExportStatusText(status);
      });
    } catch (err) {
      console.error(err);
      setExportStatusText('Failed to export PDF.');
    } finally {
      setIsExportingPdf(false);
      setTimeout(() => setExportStatusText(''), 3000);
    }
  };

  const handlePrintVector = async () => {
    try {
      setExportStatusText('Opening Native Vector Print Engine...');
      await printTwoColumnVector(screenplayData, exportOptions);
    } catch (err) {
      console.error(err);
      setExportStatusText('Failed to open print dialog.');
    } finally {
      setTimeout(() => setExportStatusText(''), 3000);
    }
  };

  const handleDownloadWordDocx = async () => {
    try {
      setIsGeneratingDocx(true);
      setExportStatusText('Generating Word (.docx)...');
      const blob = await generateTamilLeftRightDocx(screenplayData, exportOptions);
      const filename = `${(screenplayData.title || 'Screenplay').replace(/\s+/g, '_')}_Tamil_Left_Right.docx`;
      downloadBlobAsFile(blob, filename);
      setExportStatusText(`✓ Downloaded "${filename}"!`);
    } catch (err) {
      console.error(err);
      setExportStatusText('Failed to export Word document.');
    } finally {
      setIsGeneratingDocx(false);
      setTimeout(() => setExportStatusText(''), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in duration-200">
      
      {/* =========================================================================
          TOP COMMAND RIBBON
         ========================================================================= */}
      <header className="h-16 px-6 bg-[#121217] border-b border-zinc-800 flex items-center justify-between shrink-0 shadow-lg z-30">
        
        {/* Left: Engine Title & Script Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
            <Layers size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide truncate max-w-sm">
                {screenplayData.title || 'Screenplay'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                2-Column Engine
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              {totalScenes} Scene(s) &bull; {totalItems} Script Items &bull; {totalPages} Formatted Page(s)
            </p>
          </div>
        </div>

        {/* Center: Page Stepper & Zoom */}
        <div className="flex items-center gap-4">
          {/* Page Stepper */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-xl text-xs font-mono">
            <button
              onClick={() => setCurrentPageNum((p) => Math.max(1, p - 1))}
              disabled={currentPageNum <= 1}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-zinc-200 px-2 font-bold">
              Page {currentPageNum} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPageNum((p) => Math.min(totalPages, p + 1))}
              disabled={currentPageNum >= totalPages}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg">
            <button
              onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
              className="p-1 text-zinc-400 hover:text-white rounded cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-zinc-300">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              className="p-1 text-zinc-400 hover:text-white rounded cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
          </div>
        </div>

        {/* Right: Export Actions & Close */}
        <div className="flex items-center gap-2.5">
          {exportStatusText && (
            <span className="text-xs font-mono text-emerald-400 font-bold animate-pulse mr-2">
              {exportStatusText}
            </span>
          )}

          {/* Download Word (.docx) */}
          <button
            onClick={handleDownloadWordDocx}
            disabled={isGeneratingDocx}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Download Microsoft Word (.docx) file"
          >
            <FileText size={13} className="text-emerald-400" />
            <span>Word (.docx)</span>
          </button>

          {/* Direct PDF Download (.pdf) */}
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="Download high-resolution 2-Column PDF"
          >
            {isExportingPdf ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <FileDown size={14} />
            )}
            <span>{isExportingPdf ? 'Exporting PDF...' : 'Download PDF'}</span>
          </button>

          {/* Native Script Vector Print (Browser Print to PDF) */}
          <button
            onClick={handlePrintVector}
            className="px-4 py-1.5 rounded-xl bg-[#f5a623] hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            title="Open Native Vector Print Engine (Save as PDF / Print with 100% Crisp Fonts & Layout)"
          >
            <Printer size={14} />
            <span>Print / Vector PDF</span>
          </button>

          <div className="w-[1px] h-6 bg-zinc-800 mx-1" />

          {/* Close Modal */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Close Preview"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* =========================================================================
          MAIN PREVIEW WORKSPACE
         ========================================================================= */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center bg-[#0a0a0d] scrollbar-thin">
        {activePage && (
          <div
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              width: `${activePage.widthPx}px`,
              minHeight: `${activePage.heightPx}px`,
              paddingTop: `${activePage.paddingTopPx}px`,
              paddingBottom: `${activePage.paddingBottomPx}px`,
              paddingLeft: `${activePage.paddingLeftPx}px`,
              paddingRight: `${activePage.paddingRightPx}px`,
              fontFamily: exportOptions.baseFontFamily,
              fontSize: `${exportOptions.baseFontSizePx}px`,
              lineHeight: exportOptions.baseLineHeight,
            }}
            className="relative bg-white text-[#0f172a] shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-xs border border-slate-300 flex flex-col justify-between transition-transform"
          >
            {/* Top Page Content */}
            <div>
              {/* Document Title Banner on Page 1 */}
              {activePage.pageNumber === 1 && (
                <div className="text-center pb-4 mb-4 border-b border-slate-200">
                  <h1 className="text-2xl font-black text-emerald-800 tracking-wide">
                    {screenplayData.title || 'திரைக்கதை (Screenplay)'}
                  </h1>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">
                    தமிழ் இருபக்க காட்சி-வசனம் வடிவம் &bull; Kollywood 2-Column Format
                  </p>
                </div>
              )}

              {/* Two-Column Header Banner on Page 1 */}
              {activePage.pageNumber === 1 ? (
                <div className="flex items-center justify-between pb-2 mb-4 border-b-2 border-emerald-500 text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  <div className="flex items-center gap-2 text-emerald-700 min-w-0">
                    <span className="shrink-0 inline-block w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span className="truncate">இடது: காட்சி விவரம் (Visual Action)</span>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-sky-700 min-w-0">
                    <span className="truncate">வலது: வசனம் & ஒலி (Dialogue & Audio)</span>
                    <span className="shrink-0 inline-block w-2 h-2 rounded-full bg-sky-600"></span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-200 pb-1.5 mb-4 uppercase">
                  <span>{(screenplayData.title || 'Screenplay').toUpperCase()}</span>
                  <span>KOLLYWOOD 2-COLUMN FORMAT</span>
                </div>
              )}

              {/* Elements on this page */}
              <div className="space-y-4">
                {activePage.elements.map((elem, idx) => {
                  if (elem.type === 'scene_header') {
                    const chars = elem.characters || [];
                    const charsStr = chars.length > 0 ? chars.join(', ') : 'None';

                    if (elem.isContinued) {
                      return (
                        <div
                          key={`hdr-${elem.sceneId}-${idx}`}
                          className="pt-1 pb-2 mb-3 border-b-2 border-slate-900 font-bold text-xs"
                        >
                          Sc no: {elem.sceneNumber} &mdash; (Continued &bull; Page {elem.scenePageNumber || 2}/{elem.sceneTotalPages || 2})
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`hdr-${elem.sceneId}-${idx}`}
                        className="p-3 rounded-lg border border-slate-800 bg-slate-50 text-slate-900 mb-3 shadow-2xs"
                      >
                        {/* ROW 1: Sc no & Time */}
                        <div className="flex items-center justify-between font-bold text-xs mb-1.5">
                          <div>
                            <span>Sc no: </span>
                            <span className="font-black text-sm">{elem.sceneNumber}</span>
                          </div>
                          <div>
                            <span>Time: </span>
                            <span className="font-bold">{elem.timeOfDay || 'Day / INT'}</span>
                          </div>
                        </div>

                        {/* ROW 2: Script Location | Pages: 1/1 (Centered Box) | Real Location */}
                        <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                          <div className="flex-1 text-left min-w-0 truncate">
                            <span className="font-bold mr-1">Script Location: </span>
                            <span>{elem.location || 'xyz'}</span>
                          </div>
                          <div className="shrink-0 px-3 py-0.5 rounded-lg border border-slate-900 font-bold text-[11px] bg-white text-center shadow-2xs">
                            Pages: {elem.scenePageNumber || 1}/{elem.sceneTotalPages || 1}
                          </div>
                          <div className="flex-1 text-right min-w-0 truncate">
                            <span className="font-bold mr-1">Real Location: </span>
                            <span>{elem.realLocation || elem.location || 'xyz'}</span>
                          </div>
                        </div>

                        {/* ROW 3: Characters & Effects */}
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <div className="flex-1 text-left min-w-0 truncate">
                            <span className="text-slate-600 mr-1">Characters({chars.length}): </span>
                            <span className="text-sky-700 font-semibold">{charsStr}</span>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <span className="text-slate-600 mr-1">Effect: </span>
                            <span>{elem.effects || 'None'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // SCRIPT ROW ITEM
                  const item = elem.item;
                  const isCenter = item.column === 'center' || item.type === 'transition' || item.type === 'title';
                  if (isCenter) {
                    const text = item.rawText || item.leftAction || item.rightDialogue || '';
                    return (
                      <div
                        key={`item-${item.id}-${idx}`}
                        className="w-full text-center py-1.5 my-2 font-bold text-xs text-amber-800 border-y border-dashed border-slate-300"
                      >
                        {text}
                      </div>
                    );
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

                  return (
                    <div
                      key={`item-${item.id}-${idx}`}
                      className="flex items-start text-xs leading-relaxed"
                    >
                      {/* Left Column (48%) */}
                      <div
                        style={{ width: `${exportOptions.columnSplitPercent}%` }}
                        className={`pr-3 ${isRight ? 'text-right' : 'text-left'}`}
                      >
                        {isRight ? (
                          charName ? (
                            <span className="font-bold text-sky-700 text-xs">
                              {charName} :
                            </span>
                          ) : null
                        ) : (
                          <span className="text-slate-900">{leftActionText}</span>
                        )}
                      </div>

                      {/* Hairline Divider */}
                      <div className="w-[1px] bg-slate-300 self-stretch shrink-0 min-h-[18px]" />

                      {/* Right Column (52%) */}
                      <div
                        style={{ width: `${100 - exportOptions.columnSplitPercent}%` }}
                        className="pl-3 text-left"
                      >
                        {isRight ? (
                          <span className="text-slate-900">{diaText}</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Running Footer */}
            <div className="mt-8 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <div>{screenplayData.title || 'Screenplay'} &bull; Draft 1.0</div>
              <div className="font-bold text-slate-600">Page {activePage.pageNumber} of {totalPages}</div>
              <div>Kollywood 2-Column Format</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
