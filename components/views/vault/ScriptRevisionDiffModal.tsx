import React, { useState, useMemo } from 'react';
import { ProductionDocument } from '../../../types';
import { 
  diffLines, 
  createHunks, 
  formatUnifiedDiff, 
  compareScriptDrafts,
  DiffOp, 
  DiffHunk, 
  ScriptDiffSummary, 
  ScriptSceneInput 
} from '../../../services/vault/VaultDiffEngine';
import { 
  X, 
  GitCompare, 
  Layers, 
  FileText, 
  ArrowRight, 
  Download, 
  Copy, 
  Check, 
  Zap, 
  Plus, 
  Minus, 
  AlertCircle,
  Columns,
  List
} from 'lucide-react';

interface ScriptRevisionDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: ProductionDocument[];
  initialDocIdA?: string;
  initialDocIdB?: string;
  isLight?: boolean;
}

export const ScriptRevisionDiffModal: React.FC<ScriptRevisionDiffModalProps> = ({
  isOpen,
  onClose,
  documents,
  initialDocIdA,
  initialDocIdB,
  isLight = false
}) => {
  if (!isOpen) return null;

  // Filter documents that contain text or script content
  const eligibleDocs = useMemo(() => {
    return documents.filter(d => !d.isArchived && (d.htmlContent || d.textContent || d.twoColumnData));
  }, [documents]);

  const [docAId, setDocAId] = useState<string>(() => {
    if (initialDocIdA && eligibleDocs.some(d => d.id === initialDocIdA)) return initialDocIdA;
    return eligibleDocs[0]?.id || '';
  });

  const [docBId, setDocBId] = useState<string>(() => {
    if (initialDocIdB && eligibleDocs.some(d => d.id === initialDocIdB)) return initialDocIdB;
    if (eligibleDocs.length > 1) return eligibleDocs[1].id;
    return eligibleDocs[0]?.id || '';
  });

  const [viewMode, setViewMode] = useState<'unified' | 'side-by-side' | 'scene-summary'>('unified');
  const [copied, setCopied] = useState<boolean>(false);

  const docA = useMemo(() => eligibleDocs.find(d => d.id === docAId), [eligibleDocs, docAId]);
  const docB = useMemo(() => eligibleDocs.find(d => d.id === docBId), [eligibleDocs, docBId]);

  // Extract clean text
  const textA = useMemo(() => {
    if (!docA) return '';
    if (docA.textContent) return docA.textContent;
    if (docA.htmlContent) return docA.htmlContent.replace(/<[^>]+>/g, '\n').replace(/\n\s*\n/g, '\n');
    return '';
  }, [docA]);

  const textB = useMemo(() => {
    if (!docB) return '';
    if (docB.textContent) return docB.textContent;
    if (docB.htmlContent) return docB.htmlContent.replace(/<[^>]+>/g, '\n').replace(/\n\s*\n/g, '\n');
    return '';
  }, [docB]);

  // Calculate Myers Line Diff
  const diffResult = useMemo(() => {
    const t0 = performance.now();
    const lines = diffLines(textA, textB);
    const hunks = createHunks(lines, 3);
    const unified = formatUnifiedDiff(
      docA?.title || 'Draft_A.fountain', 
      docB?.title || 'Draft_B.fountain', 
      hunks
    );
    const executionTimeMs = performance.now() - t0;

    let totalInserts = 0;
    let totalDeletes = 0;
    for (const l of lines) {
      if (l.op === DiffOp.INSERT) totalInserts++;
      if (l.op === DiffOp.DELETE) totalDeletes++;
    }

    return {
      lines,
      hunks,
      unified,
      executionTimeMs,
      totalInserts,
      totalDeletes
    };
  }, [textA, textB, docA?.title, docB?.title]);

  const handleCopyUnified = () => {
    navigator.clipboard.writeText(diffResult.unified);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPatch = () => {
    const blob = new Blob([diffResult.unified], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Revision_Diff_${docA?.title || 'DraftA'}_vs_${docB?.title || 'DraftB'}.patch`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className={`w-full max-w-6xl h-[88vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#111115] border-[#292932] text-zinc-100'
      }`}>
        
        {/* Header */}
        <div className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 shrink-0 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#16161b] border-[#222228]'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f5a623]/20 border border-[#f5a623]/40 flex items-center justify-center text-[#f5a623] shadow-sm">
              <GitCompare size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">Script Revision & Document Diff Studio</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#f5a623]/20 text-[#f5a623] border border-[#f5a623]/30 flex items-center gap-1">
                  <Zap size={10} /> Myers C++ Engine
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono">
                Compare screenplay versions, production revisions, and text changes in real time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyUnified}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all ${
                isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
              }`}
              title="Copy Unified Diff patch to clipboard"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied Patch!' : 'Copy Patch'}</span>
            </button>

            <button
              onClick={handleDownloadPatch}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all ${
                isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
              }`}
              title="Download .patch file"
            >
              <Download size={14} />
              <span>Download .patch</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors ml-2"
              title="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Document Selectors & Comparison Bar */}
        <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#131317] border-[#1f1f26]'
        }`}>
          {/* Doc Pickers */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Base Draft (A):</span>
              <select
                value={docAId}
                onChange={(e) => setDocAId(e.target.value)}
                className={`px-2.5 py-1.5 rounded-lg font-bold border outline-none text-xs max-w-xs truncate ${
                  isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                }`}
              >
                {eligibleDocs.map(d => (
                  <option key={d.id} value={d.id}>[{d.category}] {d.title}</option>
                ))}
              </select>
            </div>

            <ArrowRight size={16} className="text-zinc-500" />

            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Revised Draft (B):</span>
              <select
                value={docBId}
                onChange={(e) => setDocBId(e.target.value)}
                className={`px-2.5 py-1.5 rounded-lg font-bold border outline-none text-xs max-w-xs truncate ${
                  isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                }`}
              >
                {eligibleDocs.map(d => (
                  <option key={d.id} value={d.id}>[{d.category}] {d.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <button
              onClick={() => setViewMode('unified')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                viewMode === 'unified' 
                  ? 'bg-[#f5a623] text-black shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List size={13} />
              <span>Unified Diff</span>
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                viewMode === 'side-by-side' 
                  ? 'bg-[#f5a623] text-black shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Columns size={13} />
              <span>Side-by-Side</span>
            </button>
          </div>
        </div>

        {/* Diff Metrics Banner */}
        <div className={`px-6 py-2 border-b flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs font-mono ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#0f0f13] border-[#1d1d24]'
        }`}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <Plus size={13} /> {diffResult.totalInserts} additions
            </span>
            <span className="flex items-center gap-1 text-red-400 font-bold">
              <Minus size={13} /> {diffResult.totalDeletes} deletions
            </span>
            <span className="text-zinc-400">
              {diffResult.hunks.length} changed hunks
            </span>
          </div>

          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Computed in <strong>{diffResult.executionTimeMs.toFixed(2)} ms</strong></span>
          </div>
        </div>

        {/* Diff Content Viewer */}
        <div className="flex-1 overflow-auto font-mono text-xs p-4 scrollbar-thin">
          {viewMode === 'unified' ? (
            <div className="space-y-4">
              {diffResult.hunks.length === 0 ? (
                <div className="py-20 text-center text-zinc-500">
                  <Check size={36} className="mx-auto mb-2 text-emerald-400" />
                  <p className="text-sm font-bold text-zinc-300">Documents are identical!</p>
                  <p className="text-xs mt-1">No textual differences found between Draft A and Draft B.</p>
                </div>
              ) : (
                diffResult.hunks.map((hunk, hIdx) => (
                  <div key={hIdx} className="rounded-xl border border-zinc-800/80 overflow-hidden bg-[#0a0a0d]">
                    <div className="px-4 py-1.5 bg-[#17171e] border-b border-zinc-800 text-cyan-400 font-bold text-[11px] select-none flex items-center justify-between">
                      <span>@@ -{hunk.startLineA},{hunk.countA} +{hunk.startLineB},{hunk.countB} @@</span>
                      <span className="text-zinc-500 text-[10px]">Hunk #{hIdx + 1}</span>
                    </div>
                    <div className="divide-y divide-zinc-900/60">
                      {hunk.lines.map((line, lIdx) => {
                        const isInsert = line.op === DiffOp.INSERT;
                        const isDelete = line.op === DiffOp.DELETE;
                        return (
                          <div 
                            key={lIdx} 
                            className={`flex items-start px-3 py-0.5 leading-relaxed transition-colors ${
                              isInsert 
                                ? 'bg-emerald-950/30 text-emerald-300' 
                                : isDelete 
                                ? 'bg-red-950/30 text-red-300' 
                                : 'text-zinc-300 hover:bg-white/[0.02]'
                            }`}
                          >
                            <span className="w-12 text-right pr-3 select-none text-[10px] text-zinc-600 shrink-0 font-bold">
                              {line.lineA || ''}
                            </span>
                            <span className="w-12 text-right pr-3 select-none text-[10px] text-zinc-600 shrink-0 font-bold">
                              {line.lineB || ''}
                            </span>
                            <span className="w-5 select-none font-bold shrink-0">
                              {isInsert ? '+' : isDelete ? '-' : ' '}
                            </span>
                            <span className="whitespace-pre-wrap break-all flex-1 font-mono">
                              {line.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Side-by-Side View */
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* Left: Doc A */}
              <div className="rounded-xl border border-zinc-800 bg-[#0a0a0d] overflow-y-auto p-4 scrollbar-thin">
                <div className="font-bold text-xs pb-2 mb-3 border-b border-zinc-800 text-zinc-400 flex items-center justify-between">
                  <span>Draft A: {docA?.title}</span>
                  <span className="text-[10px] font-mono text-zinc-500">{splitLines(textA).length} lines</span>
                </div>
                <div className="space-y-1">
                  {splitLines(textA).map((line, idx) => (
                    <div key={idx} className="flex gap-3 leading-relaxed hover:bg-white/[0.02]">
                      <span className="text-zinc-600 select-none text-[10px] w-8 text-right shrink-0">{idx + 1}</span>
                      <span className="whitespace-pre-wrap break-all text-zinc-300">{line}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Doc B */}
              <div className="rounded-xl border border-zinc-800 bg-[#0a0a0d] overflow-y-auto p-4 scrollbar-thin">
                <div className="font-bold text-xs pb-2 mb-3 border-b border-zinc-800 text-[#f5a623] flex items-center justify-between">
                  <span>Draft B: {docB?.title}</span>
                  <span className="text-[10px] font-mono text-zinc-500">{splitLines(textB).length} lines</span>
                </div>
                <div className="space-y-1">
                  {splitLines(textB).map((line, idx) => (
                    <div key={idx} className="flex gap-3 leading-relaxed hover:bg-white/[0.02]">
                      <span className="text-zinc-600 select-none text-[10px] w-8 text-right shrink-0">{idx + 1}</span>
                      <span className="whitespace-pre-wrap break-all text-zinc-200">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-3 border-t flex items-center justify-between shrink-0 text-xs ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#16161b] border-[#222228]'
        }`}>
          <div className="text-zinc-500 flex items-center gap-2">
            <AlertCircle size={14} className="text-[#f5a623]" />
            <span>Screenplay revisions preserve full audit history; no original text is ever deleted.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#f5a623] hover:bg-[#e09612] text-black font-bold text-xs transition-all shadow-md cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].endsWith('\r')) {
      lines[i] = lines[i].slice(0, -1);
    }
  }
  return lines;
}
