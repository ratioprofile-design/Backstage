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
  Plus,
  Trash2,
  ListOrdered,
} from 'lucide-react';

export interface TwoColumnSceneSidebarProps {
  screenplayData: TamilScreenplayData;
  isLight?: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeSceneId?: string | null;
  onSelectScene: (sceneId: string, pageNumber?: number) => void;
  onAddScene?: (targetSceneId?: string, position?: 'before' | 'after' | 'end') => void;
  onDeleteScene?: (sceneId: string) => void;
  onRenumberScenes?: () => void;
  /** Optional map of sceneId -> starting page number for paginated views */
  scenePageMap?: Record<string, number>;
  className?: string;
}

export interface SceneMetadataInfo {
  setting: 'INT' | 'EXT' | 'I/E';
  rawTime: string;
  displayTime: string;
  isNight: boolean;
  isDay: boolean;
  isEvening: boolean;
  isMorning: boolean;
}

/**
 * Universal metadata extractor for Kollywood / Tamil / Hollywood screenplays:
 * Detects INT / EXT / I/E from script text, scene headers, and timeOfDay.
 * Strips technical noise to yield clean time strings like "மாலை&இரவு", "DAY", "NIGHT".
 */
export function parseSceneMetadata(scene: TamilScene): SceneMetadataInfo {
  const timeRaw = (scene.timeOfDay || '').trim();
  const locRaw = (scene.location || '').trim();
  const realLocRaw = (scene.realLocation || '').trim();
  const slugRaw = (scene.sluglineText || '').trim();
  const combined = `${timeRaw} ${locRaw} ${realLocRaw} ${slugRaw}`;

  // 1. Setting: I/E, EXT, INT
  let setting: 'INT' | 'EXT' | 'I/E' = 'INT';
  const ieRegex = /\b(?:I\/E|INT[\s\/\\]*EXT|INT\.?[\s\/\\]*EXT\.?|I\s*[\/\\]\s*E|IE|உள்\s*[\/\\]\s*வெளி|உள்ளகம்\s*[\/\\]\s*வெளியகம்)\b/i;
  const extRegex = /\b(?:EXT|EXTERIOR|வெளி|வெளியகம்)\b|[\/\-_]EXT\b|\bEXT[\/\-_]/i;
  const intRegex = /\b(?:INT|INTERIOR|உள்|உள்ளகம்)\b|[\/\-_]INT\b|\bINT[\/\-_]/i;

  if (ieRegex.test(combined)) {
    setting = 'I/E';
  } else if (extRegex.test(combined)) {
    setting = 'EXT';
  } else if (intRegex.test(combined)) {
    setting = 'INT';
  } else {
    // Contextual clues from location when not explicitly marked
    const extClues = /(?:காடு|ரோடு|தெரு|சாலை|பாலம்|கடற்கரை|கடல்|மலை|தோட்டம்|மைதானம்|forest|road|street|beach|outside|ground|exterior)/i;
    const intClues = /(?:வீடு|அறை|அலுவலகம்|ஆபீஸ்|ஹால்|சமையலறை|பள்ளி|கல்லூரி|மருத்துவமனை|house|room|office|hall|hospital|home|kitchen|interior)/i;
    if (extClues.test(combined)) {
      setting = 'EXT';
    } else if (intClues.test(combined)) {
      setting = 'INT';
    } else {
      setting = 'INT';
    }
  }

  // 2. Clean display time (strip INT / EXT / IE / etc. while preserving compound times like மாலை&இரவு)
  let displayTime = timeRaw
    .replace(/\s*[\/\-–]\s*(?:INT|EXT|I\/E|IE|INTERIOR|EXTERIOR|உள்|வெளி|உள்ளகம்|வெளியகம்)\b/gi, '')
    .replace(/\b(?:INT|EXT|I\/E|IE|INTERIOR|EXTERIOR|உள்|வெளி|உள்ளகம்|வெளியகம்)\s*[\/\-–]\s*/gi, '')
    .replace(/\b(?:INT|EXT|I\/E|IE)\b/gi, '')
    .replace(/^[\/\-–|:]+|[\/\-–|:]+$/g, '')
    .trim();

  if (!displayTime) {
    if (/\b(?:NIG|NIGHT)\b/i.test(timeRaw)) displayTime = 'NIGHT';
    else if (/\bDAY\b/i.test(timeRaw)) displayTime = 'DAY';
    else displayTime = 'DAY';
  }

  const checkStr = `${timeRaw} ${displayTime}`.toLowerCase();
  const isNight =
    checkStr.includes('night') ||
    checkStr.includes('nig') ||
    checkStr.includes('dusk') ||
    checkStr.includes('midnight') ||
    checkStr.includes('இரவு') ||
    checkStr.includes('நள்ளிரவு') ||
    checkStr.includes('அந்தி');

  const isEvening =
    checkStr.includes('evening') ||
    checkStr.includes('eve') ||
    checkStr.includes('dusk') ||
    checkStr.includes('sunset') ||
    checkStr.includes('twilight') ||
    checkStr.includes('மாலை') ||
    checkStr.includes('அந்தி');

  const isMorning =
    checkStr.includes('morning') ||
    checkStr.includes('morn') ||
    checkStr.includes('dawn') ||
    checkStr.includes('sunrise') ||
    checkStr.includes('காலை') ||
    checkStr.includes('விடியல்');

  const isDay =
    checkStr.includes('day') ||
    checkStr.includes('noon') ||
    checkStr.includes('afternoon') ||
    checkStr.includes('பகல்') ||
    checkStr.includes('நண்பகல்') ||
    checkStr.includes('மதியம்') ||
    isMorning;

  return {
    setting,
    rawTime: timeRaw,
    displayTime,
    isNight,
    isDay,
    isEvening,
    isMorning,
  };
}

export const TwoColumnSceneSidebar: React.FC<TwoColumnSceneSidebarProps> = ({
  screenplayData,
  isLight = false,
  isOpen,
  onToggleOpen,
  activeSceneId,
  onSelectScene,
  onAddScene,
  onDeleteScene,
  onRenumberScenes,
  scenePageMap = {},
  className = '',
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [settingFilter, setSettingFilter] = useState<'all' | 'INT' | 'EXT' | 'I/E'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'night' | 'evening' | 'morning'>('all');

  // Pre-parse metadata for all scenes
  const sceneMetadataMap = useMemo(() => {
    const map = new Map<string, SceneMetadataInfo>();
    for (const sc of screenplayData.scenes) {
      map.set(sc.id, parseSceneMetadata(sc));
    }
    return map;
  }, [screenplayData.scenes]);

  // Precompute dynamic counts for filter chips
  const counts = useMemo(() => {
    let intCount = 0;
    let extCount = 0;
    let ieCount = 0;
    let dayCount = 0;
    let nightCount = 0;
    let eveningCount = 0;
    let morningCount = 0;

    for (const sc of screenplayData.scenes) {
      const meta = sceneMetadataMap.get(sc.id);
      if (!meta) continue;
      if (meta.setting === 'INT') intCount++;
      else if (meta.setting === 'EXT') extCount++;
      else if (meta.setting === 'I/E') ieCount++;

      if (meta.isDay) dayCount++;
      if (meta.isNight) nightCount++;
      if (meta.isEvening) eveningCount++;
      if (meta.isMorning) morningCount++;
    }

    return { intCount, extCount, ieCount, dayCount, nightCount, eveningCount, morningCount };
  }, [screenplayData.scenes, sceneMetadataMap]);

  // Filter scenes based on search query, setting filter, and time filter
  const filteredScenes = useMemo(() => {
    return screenplayData.scenes.filter((scene) => {
      const meta = sceneMetadataMap.get(scene.id) || parseSceneMetadata(scene);

      // 1. Setting Filter (INT / EXT / I/E)
      if (settingFilter !== 'all' && meta.setting !== settingFilter) {
        return false;
      }

      // 2. Time Filter (Day / Night / Evening / Morning)
      if (timeFilter !== 'all') {
        if (timeFilter === 'day' && !meta.isDay) return false;
        if (timeFilter === 'night' && !meta.isNight) return false;
        if (timeFilter === 'evening' && !meta.isEvening) return false;
        if (timeFilter === 'morning' && !meta.isMorning) return false;
      }

      // 3. Text Search Query
      if (!filterQuery.trim()) return true;
      const q = filterQuery.toLowerCase().trim();

      // Check scene number
      if (scene.sceneNumber.toLowerCase().includes(q)) return true;

      // Check location
      if (scene.location.toLowerCase().includes(q)) return true;
      if (scene.realLocation && scene.realLocation.toLowerCase().includes(q)) return true;

      // Check time & setting
      if (scene.timeOfDay.toLowerCase().includes(q)) return true;
      if (meta.displayTime.toLowerCase().includes(q)) return true;
      if (meta.setting.toLowerCase().includes(q)) return true;

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
  }, [screenplayData.scenes, sceneMetadataMap, settingFilter, timeFilter, filterQuery]);

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

        <div className="flex items-center gap-1">
          {/* Add Scene Button */}
          {onAddScene && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddScene(undefined, 'end');
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-xs transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Add fresh scene at end"
            >
              <Plus size={12} className="stroke-[3]" />
              <span>Add</span>
            </button>
          )}

          {/* Renumber All Scenes Button */}
          {onRenumberScenes && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenumberScenes();
              }}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-amber-50 text-slate-500 hover:text-amber-700'
                  : 'hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400'
              }`}
              title="Renumber all scenes sequentially (1, 2, 3...)"
            >
              <ListOrdered size={14} />
            </button>
          )}

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

        {/* Setting (INT / EXT / I/E) & Time Filter Controls */}
        <div className="space-y-1.5 pt-0.5">
          {/* Row 1: Setting Chips */}
          <div className="flex items-center gap-1 text-[10px] font-mono overflow-x-auto no-scrollbar">
            <span className="text-[9px] uppercase font-bold text-zinc-500 mr-0.5 shrink-0">SET:</span>
            <button
              onClick={() => setSettingFilter('all')}
              className={`px-1.5 py-0.5 rounded font-bold transition-all shrink-0 ${
                settingFilter === 'all'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : isLight
                  ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              All ({screenplayData.scenes.length})
            </button>
            <button
              onClick={() => setSettingFilter(settingFilter === 'INT' ? 'all' : 'INT')}
              className={`px-1.5 py-0.5 rounded font-bold transition-all shrink-0 ${
                settingFilter === 'INT'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : isLight
                  ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
              title="Filter Interior (உள் / INT) scenes"
            >
              INT ({counts.intCount})
            </button>
            <button
              onClick={() => setSettingFilter(settingFilter === 'EXT' ? 'all' : 'EXT')}
              className={`px-1.5 py-0.5 rounded font-bold transition-all shrink-0 ${
                settingFilter === 'EXT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : isLight
                  ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
              title="Filter Exterior (வெளி / EXT) scenes"
            >
              EXT ({counts.extCount})
            </button>
            {counts.ieCount > 0 && (
              <button
                onClick={() => setSettingFilter(settingFilter === 'I/E' ? 'all' : 'I/E')}
                className={`px-1.5 py-0.5 rounded font-bold transition-all shrink-0 ${
                  settingFilter === 'I/E'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : isLight
                    ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                }`}
                title="Filter Interior/Exterior (உள்/வெளி / I/E) scenes"
              >
                I/E ({counts.ieCount})
              </button>
            )}
          </div>

          {/* Row 2: Time of Day Chips */}
          <div className="flex items-center gap-1 text-[10px] font-mono overflow-x-auto no-scrollbar">
            <span className="text-[9px] uppercase font-bold text-zinc-500 mr-0.5 shrink-0">TIME:</span>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-1.5 py-0.5 rounded font-bold transition-all shrink-0 ${
                timeFilter === 'all'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : isLight
                  ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTimeFilter(timeFilter === 'day' ? 'all' : 'day')}
              className={`px-1.5 py-0.5 rounded font-bold transition-all shrink-0 ${
                timeFilter === 'day'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : isLight
                  ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
              title="Filter Day (பகல் / DAY) scenes"
            >
              Day ({counts.dayCount})
            </button>
            <button
              onClick={() => setTimeFilter(timeFilter === 'night' ? 'all' : 'night')}
              className={`px-1.5 py-0.5 rounded font-bold transition-all shrink-0 ${
                timeFilter === 'night'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isLight
                  ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
              title="Filter Night (இரவு / NIGHT) scenes"
            >
              Night ({counts.nightCount})
            </button>
            {counts.eveningCount > 0 && (
              <button
                onClick={() => setTimeFilter(timeFilter === 'evening' ? 'all' : 'evening')}
                className={`px-1.5 py-0.5 rounded font-bold transition-all shrink-0 ${
                  timeFilter === 'evening'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : isLight
                    ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                }`}
                title="Filter Evening / Dusk (மாலை / அந்தி) scenes"
              >
                Eve / மாலை ({counts.eveningCount})
              </button>
            )}
            {counts.morningCount > 0 && (
              <button
                onClick={() => setTimeFilter(timeFilter === 'morning' ? 'all' : 'morning')}
                className={`px-1.5 py-0.5 rounded font-bold transition-all shrink-0 ${
                  timeFilter === 'morning'
                    ? 'bg-yellow-500 text-black shadow-xs'
                    : isLight
                    ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                }`}
                title="Filter Morning / Dawn (காலை / விடியல்) scenes"
              >
                Morn / காலை ({counts.morningCount})
              </button>
            )}
          </div>
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
                setSettingFilter('all');
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

            const meta = sceneMetadataMap.get(scene.id) || parseSceneMetadata(scene);

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
                {/* Top Row: Scene Number Badge + Page # + Setting & Time Pills + Hover Actions */}
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

                  <div className="flex items-center gap-1 min-w-0">
                    {/* Hover scene card quick actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 mr-0.5 shrink-0">
                      {onAddScene && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddScene(scene.id, 'after');
                          }}
                          className={`p-1 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors ${
                            isLight
                              ? 'bg-slate-200 hover:bg-emerald-500 hover:text-black text-slate-700'
                              : 'bg-zinc-800 hover:bg-emerald-500 hover:text-black text-zinc-300'
                          }`}
                          title="Insert new scene after this scene (auto suffix e.g. 4A)"
                        >
                          <Plus size={10} className="stroke-[3]" />
                          <span>Add</span>
                        </button>
                      )}
                      {onDeleteScene && screenplayData.scenes.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteScene(scene.id);
                          }}
                          className={`p-1 rounded transition-colors ${
                            isLight
                              ? 'text-rose-500 hover:bg-rose-100'
                              : 'text-rose-400 hover:bg-rose-950/60 hover:text-rose-200'
                          }`}
                          title="Delete this scene"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>

                    {/* Setting & Time Metadata Badges */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Setting Badge: INT / EXT / I/E */}
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0 ${
                          meta.setting === 'INT'
                            ? isLight
                              ? 'bg-sky-100 text-sky-800 border border-sky-300'
                              : 'bg-sky-950/70 text-sky-300 border border-sky-800/60'
                            : meta.setting === 'EXT'
                            ? isLight
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                            : isLight
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-purple-950/70 text-purple-300 border border-purple-800/60'
                        }`}
                        title={`Setting: ${meta.setting}`}
                      >
                        {meta.setting}
                      </span>

                      {/* Time Metadata Badge (exact script time e.g. மாலை&இரவு / NIGHT / DAY) */}
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 truncate max-w-[85px] ${
                          meta.isNight
                            ? isLight
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                              : 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/50'
                            : meta.isEvening
                            ? isLight
                              ? 'bg-orange-100 text-orange-800 border border-orange-300'
                              : 'bg-orange-950/60 text-orange-300 border border-orange-800/50'
                            : isLight
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-amber-950/50 text-amber-300 border border-amber-800/50'
                        }`}
                        title={`Time: ${meta.displayTime}`}
                      >
                        {meta.displayTime}
                      </span>
                    </div>
                  </div>
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
