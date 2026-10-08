import React, { useState, useMemo } from 'react';
import { TamilScreenplayData, TamilScene } from '../services/tamilLeftRightEngine';
import {
  Layers,
  Search,
  X,
  Clock,
  MapPin,
  Users,
  ChevronRight,
  ChevronLeft,
  FileText,
  SlidersHorizontal,
  Sparkles,
  ArrowRight,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

export interface TwoColumnSceneSidebarProps {
  screenplayData: TamilScreenplayData;
  isLight?: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeSceneId?: string | null;
  onSelectScene: (sceneId: string, pageNumber?: number) => void;
  /** Optional map of sceneId -> starting page number for paginated views */
  scenePageMap?: Record<string, number>;
  className?: string;
}

export const TwoColumnSceneSidebar: React.FC<TwoColumnSceneSidebarProps> = ({
  screenplayData,
  isLight = false,
  isOpen,
  onToggleOpen,
  activeSceneId,
  onSelectScene,
  scenePageMap = {},
  className = '',
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'night'>('all');

  // Filter scenes based on search query and time filter
  const filteredScenes = useMemo(() => {
    return screenplayData.scenes.filter((scene) => {
      // 1. Time Filter
      if (timeFilter !== 'all') {
        const timeLower = (scene.timeOfDay || '').toLowerCase();
        if (timeFilter === 'day' && !timeLower.includes('day') && !timeLower.includes('morning')) {
          return false;
        }
        if (timeFilter === 'night' && !timeLower.includes('night') && !timeLower.includes('evening') && !timeLower.includes('dusk')) {
          return false;
        }
      }

      // 2. Text Search
      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase().trim();

      // Check scene number
      if (scene.sceneNumber.toLowerCase().includes(q)) return true;

      // Check location
      if (scene.location.toLowerCase().includes(q)) return true;
      if (scene.realLocation && scene.realLocation.toLowerCase().includes(q)) return true;

      // Check time
      if (scene.timeOfDay.toLowerCase().includes(q)) return true;

      // Check characters
      if (scene.characters?.some((c) => c.toLowerCase().includes(q))) return true;

      // Check item snippets
      const hasMatchingItem = scene.items.some((item) => {
        return (
          (item.leftAction && item.leftAction.toLowerCase().includes(q)) ||
          (item.rightDialogue && item.rightDialogue.toLowerCase().includes(q)) ||
          (item.rightCharacter && item.rightCharacter.toLowerCase().includes(q)) ||
          (item.rawText && item.rawText.toLowerCase().includes(q))
        );
      });

      return hasMatchingItem;
    });
  }, [screenplayData.scenes, filterQuery, timeFilter]);

  if (!isOpen) {
    return (
      <div className="relative z-20">
        <button
          onClick={onToggleOpen}
          className={`flex items-center gap-1.5 px-2.5 py-2 m-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer border ${
            isLight
              ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-slate-200'
              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 shadow-black'
          }`}
          title="Open Scene Cards Navigator"
        >
          <PanelLeft size={15} className="text-emerald-500" />
          <span className="hidden sm:inline font-mono text-[11px]">Scenes ({screenplayData.scenes.length})</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      className={`w-72 sm:w-80 shrink-0 h-full flex flex-col border-r transition-all z-20 select-none ${
        isLight ? 'bg-slate-50/95 border-slate-200 text-slate-800' : 'bg-[#121216]/95 border-zinc-800 text-zinc-200'
      } ${className}`}
    >
      {/* 1. Header Bar */}
      <div
        className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 ${
          isLight ? 'border-slate-200 bg-white' : 'border-zinc-800/80 bg-zinc-900/60'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-500">
            <Layers size={14} className="stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black tracking-wide truncate flex items-center gap-1.5 uppercase font-mono">
              <span>Scene Cards</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-bold">
                {screenplayData.scenes.length}
              </span>
            </h3>
          </div>
        </div>

        <button
          onClick={onToggleOpen}
          className={`p-1.5 rounded-lg transition-colors ${
            isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
          title="Close Scene Navigator"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* 2. Filter & Search Controls */}
      <div
        className={`p-2.5 border-b space-y-2 ${
          isLight ? 'border-slate-200 bg-white/70' : 'border-zinc-800/80 bg-zinc-900/30'
        }`}
      >
        {/* Search input */}
        <div className="relative">
          <Search
            size={13}
            className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${
              isLight ? 'text-slate-400' : 'text-zinc-500'
            }`}
          />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search scene #, location, character..."
            className={`w-full pl-8 pr-7 py-1.5 text-xs rounded-lg outline-none transition-all border ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
                : 'bg-zinc-950/80 border-zinc-700/80 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
            }`}
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-400 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Day / Night Filter Chips */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-2 py-0.5 rounded-md font-bold transition-all ${
              timeFilter === 'all'
                ? 'bg-emerald-500 text-white shadow-xs'
                : isLight
                ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            All ({screenplayData.scenes.length})
          </button>
          <button
            onClick={() => setTimeFilter('day')}
            className={`px-2 py-0.5 rounded-md font-bold transition-all ${
              timeFilter === 'day'
                ? 'bg-amber-500 text-black shadow-xs'
                : isLight
                ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            Day
          </button>
          <button
            onClick={() => setTimeFilter('night')}
            className={`px-2 py-0.5 rounded-md font-bold transition-all ${
              timeFilter === 'night'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isLight
                ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            Night
          </button>
        </div>
      </div>

      {/* 3. Scene Cards List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredScenes.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
            <Search size={22} className="opacity-30" />
            <p>No scenes match "{filterQuery}"</p>
            <button
              onClick={() => {
                setFilterQuery('');
                setTimeFilter('all');
              }}
              className="text-emerald-500 hover:underline text-[11px] font-bold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredScenes.map((scene, index) => {
            const isActive = activeSceneId === scene.id;
            const pageNum = scenePageMap[scene.id];
            const characters = scene.characters || [];

            // Grab the first action and first dialogue snippet for the visual thumbnail
            const firstActionItem = scene.items.find((it) => it.leftAction || (it.column === 'left' && it.rawText));
            const firstDialogueItem = scene.items.find(
              (it) => it.rightDialogue || it.rightCharacter || (it.column === 'right' && it.rawText)
            );

            const isNight = (scene.timeOfDay || '').toLowerCase().includes('night');

            return (
              <div
                key={scene.id}
                onClick={() => onSelectScene(scene.id, pageNum)}
                className={`group relative rounded-xl p-2.5 transition-all cursor-pointer border ${
                  isActive
                    ? isLight
                      ? 'bg-emerald-50 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-emerald-950/30 border-emerald-500 shadow-lg ring-1 ring-emerald-500/30'
                    : isLight
                    ? 'bg-white hover:bg-slate-100/90 border-slate-200 hover:border-slate-300 shadow-xs'
                    : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800 hover:border-zinc-700 shadow-xs'
                }`}
              >
                {/* Top Row: Scene Number Badge + Page # + Time Pill */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded font-black font-mono text-[11px] tracking-wider shrink-0 ${
                        isActive
                          ? 'bg-emerald-500 text-black'
                          : isLight
                          ? 'bg-slate-900 text-white'
                          : 'bg-zinc-800 text-emerald-400 group-hover:bg-emerald-500/20'
                      }`}
                    >
                      SC {scene.sceneNumber || index + 1}
                    </span>

                    {pageNum !== undefined && (
                      <span className="text-[10px] font-mono font-bold text-zinc-400">
                        Pg {pageNum}
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                      isNight
                        ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/40'
                        : 'bg-amber-950/50 text-amber-300 border border-amber-800/40'
                    }`}
                  >
                    {scene.timeOfDay || 'Day / INT'}
                  </span>
                </div>

                {/* Location Heading */}
                <div className="flex items-start gap-1 text-xs font-bold leading-tight mb-1.5">
                  <MapPin size={11} className="shrink-0 mt-0.5 text-emerald-500" />
                  <span className="truncate">{scene.location || 'காட்சி இடம்'}</span>
                </div>

                {/* Character Pills */}
                {characters.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mb-2">
                    {characters.slice(0, 3).map((char, i) => (
                      <span
                        key={i}
                        className={`text-[9.5px] px-1.5 py-0.2 rounded-md font-medium truncate max-w-[90px] ${
                          isLight ? 'bg-slate-100 text-slate-700' : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {char}
                      </span>
                    ))}
                    {characters.length > 3 && (
                      <span className="text-[9px] text-zinc-400 font-mono">
                        +{characters.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Visual Thumbnail: Mini Two-Column Snapshot */}
                <div
                  className={`p-1.5 rounded-lg border text-[10px] leading-relaxed grid grid-cols-2 gap-2 relative overflow-hidden ${
                    isLight
                      ? 'bg-slate-50 border-slate-200/80 text-slate-600'
                      : 'bg-zinc-950/60 border-zinc-800/70 text-zinc-400'
                  }`}
                >
                  {/* Subtle vertical divider in thumbnail */}
                  <div className="absolute inset-y-1 left-1/2 w-[1px] -translate-x-1/2 bg-zinc-700/20 pointer-events-none" />

                  {/* Left Action Snapshot */}
                  <div className="line-clamp-2 pr-1 text-left font-serif">
                    {firstActionItem?.leftAction || firstActionItem?.rawText || (
                      <span className="italic opacity-40 text-[9px]">காட்சி விவரம்...</span>
                    )}
                  </div>

                  {/* Right Dialogue Snapshot */}
                  <div className="line-clamp-2 pl-1 text-left font-serif">
                    {firstDialogueItem ? (
                      <>
                        <span className="font-bold text-sky-400 text-[9px] mr-0.5 uppercase">
                          {firstDialogueItem.rightCharacter || 'கதாபாத்திரம்'}:
                        </span>
                        <span>{firstDialogueItem.rightDialogue || firstDialogueItem.rawText}</span>
                      </>
                    ) : (
                      <span className="italic opacity-40 text-[9px]">வசனம்...</span>
                    )}
                  </div>
                </div>

                {/* Bottom Metadata & Hover Jump Indicator */}
                <div className="flex items-center justify-between pt-1.5 text-[9.5px] text-zinc-400 font-mono">
                  <span>{scene.items.length} blocks</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 text-emerald-400 font-bold">
                    <span>Jump</span>
                    <ChevronRight size={11} className="stroke-[3]" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
