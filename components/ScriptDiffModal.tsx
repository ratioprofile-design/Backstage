import React from 'react';
import { DiffResult } from '../types';
import { VersionComparisonSummary } from '../services/diffEngine';
import { X, ArrowRight, Plus, Trash2, Edit3, CheckCircle, Package, Flame, Users, AlertCircle } from 'lucide-react';

interface ScriptDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftAName: string;
  draftBName: string;
  diffSummary: VersionComparisonSummary;
}

export const ScriptDiffModal: React.FC<ScriptDiffModalProps> = ({
  isOpen,
  onClose,
  draftAName,
  draftBName,
  diffSummary,
}) => {
  if (!isOpen) return null;

  const {
    results,
    addedScenesCount,
    removedScenesCount,
    modifiedScenesCount,
    unchangedScenesCount,
    newProps,
    newStunts,
    newCast,
    netPageShiftEighths,
  } = diffSummary;

  const formatEighths = (eighths: number) => {
    const abs = Math.abs(eighths);
    const sign = eighths > 0 ? '+' : eighths < 0 ? '-' : '';
    if (abs === 0) return '0';
    const pages = Math.floor(abs / 8);
    const rem = abs % 8;
    if (pages === 0) return `${sign}${rem}/8 pages`;
    if (rem === 0) return `${sign}${pages} pages`;
    return `${sign}${pages} ${rem}/8 pages`;
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141416] border border-[#27272a] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-gray-100">
        {/* Header */}
        <div className="p-5 px-6 border-b border-[#222] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
              <span>{draftAName}</span>
              <ArrowRight size={13} className="text-[#f5a623]" />
              <span className="text-[#f5a623]">{draftBName}</span>
            </div>
            <h2 className="text-lg font-black text-white mt-0.5 tracking-tight">
              Screenplay Revision Comparison
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[#333] hover:bg-[#222] text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Diff Metrics Banner */}
        <div className="p-4 px-6 bg-[#18181f] border-b border-[#222] grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-bold text-gray-400">Net Page Shift</div>
            <div className={`text-base font-black font-mono mt-0.5 ${netPageShiftEighths > 0 ? 'text-amber-400' : netPageShiftEighths < 0 ? 'text-emerald-400' : 'text-gray-300'}`}>
              {formatEighths(netPageShiftEighths)}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-bold text-emerald-400">Added Scenes</div>
            <div className="text-base font-black text-emerald-400 font-mono mt-0.5">+{addedScenesCount}</div>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-bold text-red-400">Removed Scenes</div>
            <div className="text-base font-black text-red-400 font-mono mt-0.5">-{removedScenesCount}</div>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-bold text-sky-400">Modified Scenes</div>
            <div className="text-base font-black text-sky-400 font-mono mt-0.5">{modifiedScenesCount}</div>
          </div>
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-bold text-gray-400">Unchanged</div>
            <div className="text-base font-black text-gray-400 font-mono mt-0.5">{unchangedScenesCount}</div>
          </div>
        </div>

        {/* New Production Elements Alert */}
        {(newProps.length > 0 || newStunts.length > 0 || newCast.length > 0) && (
          <div className="p-3 px-6 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <AlertCircle size={14} />
              <span>Production Asset Changes in this Revision:</span>
            </div>
            {newProps.length > 0 && (
              <div className="flex items-center gap-1 text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                <Package size={12} />
                <span>{newProps.length} New Props</span>
              </div>
            )}
            {newStunts.length > 0 && (
              <div className="flex items-center gap-1 text-orange-300 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                <Flame size={12} />
                <span>{newStunts.length} New Stunts / SFX</span>
              </div>
            )}
            {newCast.length > 0 && (
              <div className="flex items-center gap-1 text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <Users size={12} />
                <span>{newCast.length} New Cast</span>
              </div>
            )}
          </div>
        )}

        {/* Scene List Diffs */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {results.map((res) => {
            const isAdded = res.status === 'ADDED';
            const isRemoved = res.status === 'REMOVED';
            const isModified = res.status === 'MODIFIED';

            return (
              <div
                key={res.sceneId || res.sceneNumber}
                className={`p-4 rounded-xl border transition-all ${
                  isAdded
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : isRemoved
                    ? 'bg-red-500/5 border-red-500/30 opacity-70'
                    : isModified
                    ? 'bg-sky-500/5 border-sky-500/30'
                    : 'bg-[#18181f] border-[#222]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white">
                      SCENE {res.sceneNumber}
                    </span>
                    <span className="font-bold text-xs">
                      {res.titleB || res.titleA || 'Scene Title'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdded && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                        <Plus size={11} /> ADDED SCENE
                      </span>
                    )}
                    {isRemoved && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                        <Trash2 size={11} /> REMOVED SCENE
                      </span>
                    )}
                    {isModified && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center gap-1">
                        <Edit3 size={11} /> TEXT MODIFIED
                      </span>
                    )}
                    {!isAdded && !isRemoved && !isModified && (
                      <span className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
                        <CheckCircle size={11} /> Unchanged
                      </span>
                    )}
                  </div>
                </div>

                {/* Script Snippet / Text Diff Preview */}
                {(isModified || isAdded || isRemoved) && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px] leading-relaxed">
                    {res.textA && (
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1 font-sans font-bold">
                          {draftAName}
                        </div>
                        <div className="line-clamp-4 text-gray-400">{res.textA}</div>
                      </div>
                    )}
                    {res.textB && (
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <div className="text-[9px] uppercase tracking-wider text-[#f5a623] mb-1 font-sans font-bold">
                          {draftBName}
                        </div>
                        <div className="line-clamp-4 text-gray-200">{res.textB}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ScriptDiffModal;
