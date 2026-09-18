import React from 'react';
import { 
  Layers, 
  Grid, 
  X, 
  Maximize2, 
  Minus, 
  ExternalLink,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Beat } from '../types';

export interface FloatingWindowManagerProps {
  openBeatIds: number[];
  minimizedBeatIds: number[];
  activeBeatId: number | null;
  beats: Beat[];
  onFocusBeat: (id: number) => void;
  onToggleMinimizeBeat: (id: number) => void;
  onCloseBeat: (id: number) => void;
  onCloseAll: () => void;
  onCascade: () => void;
  onTile: () => void;
  isLight?: boolean;
}

export const FloatingWindowManager: React.FC<FloatingWindowManagerProps> = ({
  openBeatIds,
  minimizedBeatIds,
  activeBeatId,
  beats,
  onFocusBeat,
  onToggleMinimizeBeat,
  onCloseBeat,
  onCloseAll,
  onCascade,
  onTile,
  isLight = false,
}) => {
  if (openBeatIds.length === 0) return null;

  const beatMap = new Map<number, Beat>();
  beats.forEach(b => beatMap.set(b.id, b));

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9000] pointer-events-auto select-none animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div 
        className={`flex items-center gap-1.5 p-1.5 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all ${
          isLight
            ? 'bg-white/90 border-slate-300/80 shadow-slate-900/15 text-slate-800'
            : 'bg-[#14161f]/90 border-white/15 shadow-black/80 text-white'
        }`}
      >
        {/* WINDOW LIST CHIPS */}
        <div className="flex items-center gap-1 max-w-[55vw] overflow-x-auto custom-scrollbar px-1 py-0.5">
          {openBeatIds.map((id) => {
            const beat = beatMap.get(id);
            const isActive = activeBeatId === id;
            const isMinimized = minimizedBeatIds.includes(id);
            const title = beat?.title || `Beat #${id}`;
            const sceneNum = beat?.sceneNumber || '•';

            return (
              <div
                key={id}
                onClick={() => {
                  if (isMinimized) onToggleMinimizeBeat(id);
                  onFocusBeat(id);
                }}
                className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl text-xs cursor-pointer border transition-all duration-150 ${
                  isActive && !isMinimized
                    ? isLight
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-900 font-semibold shadow-sm'
                      : 'bg-amber-500/20 border-amber-500/70 text-amber-300 font-semibold shadow-[0_0_12px_rgba(245,166,35,0.25)]'
                    : isMinimized
                    ? isLight
                      ? 'bg-slate-100/80 border-dashed border-slate-300 text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                      : 'bg-[#1b1e2a]/60 border-dashed border-white/10 text-gray-400 hover:text-gray-200 hover:bg-[#202434]'
                    : isLight
                    ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                    : 'bg-[#1c1f2b] border-[#2c3042] text-gray-300 hover:text-white hover:bg-[#252a3a]'
                }`}
                title={`${title} (Click to focus / restore)`}
              >
                {/* Status Dot */}
                <span 
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    beat?.status === 'ready' 
                      ? 'bg-emerald-400' 
                      : beat?.status === 'in_progress'
                      ? 'bg-blue-400'
                      : 'bg-amber-400'
                  } ${isActive && !isMinimized ? 'animate-pulse' : ''}`}
                />

                {/* Scene label */}
                <span className="font-mono text-[10px] opacity-75 shrink-0">
                  SC {sceneNum}
                </span>

                {/* Title */}
                <span className="truncate max-w-[110px]">
                  {title}
                </span>

                {/* Minimize indicator */}
                {isMinimized && (
                  <span className="text-[9px] uppercase tracking-wider px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono">
                    min
                  </span>
                )}

                {/* Quick actions on chip */}
                <div className="flex items-center gap-0.5 ml-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMinimizeBeat(id);
                    }}
                    className={`p-0.5 rounded hover:bg-black/20 ${isLight ? 'hover:bg-slate-300' : 'hover:bg-white/20'}`}
                    title={isMinimized ? "Restore Window" : "Minimize Window"}
                  >
                    {isMinimized ? <ChevronUp size={11} /> : <Minus size={11} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseBeat(id);
                    }}
                    className="p-0.5 rounded hover:bg-red-500/20 hover:text-red-400"
                    title="Close Window"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* DIVIDER */}
        <div className={`w-px h-5 mx-0.5 ${isLight ? 'bg-slate-300' : 'bg-white/15'}`} />

        {/* BATCH ACTION CONTROLS */}
        <div className="flex items-center gap-1">
          {/* CASCADE */}
          <button
            onClick={onCascade}
            className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-medium transition-colors ${
              isLight 
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' 
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
            title="Cascade All Open Windows"
          >
            <Layers size={13} className="text-amber-500" />
            <span className="hidden sm:inline">Cascade</span>
          </button>

          {/* TILE */}
          <button
            onClick={onTile}
            className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-medium transition-colors ${
              isLight 
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' 
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
            title="Tile All Open Windows Side-by-Side"
          >
            <Grid size={13} className="text-amber-500" />
            <span className="hidden sm:inline">Tile</span>
          </button>

          {/* CLOSE ALL */}
          <button
            onClick={onCloseAll}
            className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-colors"
            title="Close All Open Windows"
          >
            <X size={13} />
            <span className="hidden sm:inline">Close All ({openBeatIds.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
