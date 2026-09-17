import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, X, Maximize2, Minimize2, ChevronLeft, ChevronRight,
  RotateCcw, ScrollText, Eye, EyeOff,
  LayoutTemplate, Compass, Sun, Moon, Coffee, Sliders
} from 'lucide-react';
import { Beat } from '../types';
import { useProject } from '../context/ProjectContext';
import { translateUi } from '../services/appTranslations';

interface ScriptRollingPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playheadPage: number;
  onSeek: (page: number) => void;
  beats: (Beat & { startPage?: number; durationPages?: number; timelineTrackIdx?: number; timelineSubtrackIdx?: number })[];
  totalScreenplayPages: number;
  appAccentColor?: string;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  dawThemeIsDark?: boolean;
}

// Industry Standard Screenplay Paper Constants
const PAPER_WIDTH = 780; // px
const PAPER_HEIGHT = 1040; // px (approx 55 standard screenplay lines at 1.3 line-height)
const PAPER_GAP = 28; // px gap between paper sheets
const TOTAL_PAGE_UNIT = PAPER_HEIGHT + PAPER_GAP;

export const ScriptRollingPreviewModal: React.FC<ScriptRollingPreviewModalProps> = ({
  isOpen,
  onClose,
  isPlaying,
  onTogglePlay,
  playheadPage,
  onSeek,
  beats,
  totalScreenplayPages: dawTotalPages,
  appAccentColor = '#f5a623',
  playbackSpeed,
  onPlaybackSpeedChange,
  dawThemeIsDark = true,
}) => {
  const { appLanguage = 'english' } = useProject();

  // Window controls
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [paperTheme, setPaperTheme] = useState<'white' | 'sepia' | 'dark'>('white');
  const [showReadingGuide, setShowReadingGuide] = useState(true);
  const [isAutoScrollLocked, setIsAutoScrollLocked] = useState(true);
  const [userScrolledAway, setUserScrolledAway] = useState(false);
  const [fontSize, setFontSize] = useState<number>(13);

  // Floating window position
  const [windowPos, setWindowPos] = useState<{ x: number; y: number }>({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  // References
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const lastProgrammaticScrollRef = useRef(0);
  const playRafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  // Initialize position to bottom-right
  useEffect(() => {
    if (typeof window !== 'undefined' && windowPos.x === -1) {
      const defaultW = 600;
      const defaultH = 680;
      const x = Math.max(20, window.innerWidth - defaultW - 32);
      const y = Math.max(60, window.innerHeight - defaultH - 32);
      setWindowPos({ x, y });
    }
  }, [windowPos.x]);

  // 1. FILTER OUT DISABLED BEATS (Excludes any beat marked isDisabled, omitted, or deleted)
  const activeBeats = useMemo(() => {
    return beats.filter(b => {
      if (b.isDisabled) return false;
      if (b.status === 'omitted' || (b.status as string) === 'DELETED') return false;
      if ((b as any).disabled === true) return false;
      return true;
    });
  }, [beats]);

  // Sort active beats in chronological screenplay order
  const sortedBeats = useMemo(() => {
    return [...activeBeats].sort((a, b) => {
      const pageA = typeof a.startPage === 'number' ? a.startPage : (typeof a.startTime === 'number' ? a.startTime : 1);
      const pageB = typeof b.startPage === 'number' ? b.startPage : (typeof b.startTime === 'number' ? b.startTime : 1);
      if (Math.abs(pageA - pageB) > 0.001) return pageA - pageB;
      return (a.timelineTrackIdx || 0) - (b.timelineTrackIdx || 0);
    });
  }, [activeBeats]);

  // 2. CALCULATE REAL SCREENPLAY PAPER PAGES FROM CONTENT
  // Evaluates words & lines to derive authentic physical screenplay sheets
  const { estimatedTotalPaperPages, beatPageMap } = useMemo(() => {
    if (sortedBeats.length === 0) return { estimatedTotalPaperPages: 1, beatPageMap: new Map<number, number>() };

    let currentAccumulatedLines = 0;
    const map = new Map<number, number>();

    sortedBeats.forEach((b) => {
      const pageNumber = Math.floor(currentAccumulatedLines / 54) + 1;
      map.set(b.id, pageNumber);

      // Estimate lines for this beat: scene heading (2 lines) + summary (2 lines) + content
      const plainContent = (b.content || '')
        .replace(/<[^>]+>/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      const linesCount = Math.max(8, plainContent.length + 3);
      currentAccumulatedLines += linesCount;
    });

    const totalPages = Math.max(1, Math.ceil(currentAccumulatedLines / 54));
    return { estimatedTotalPaperPages: Math.max(totalPages, Math.round(dawTotalPages || 1)), beatPageMap: map };
  }, [sortedBeats, dawTotalPages]);

  // Track current paper page (anchored directly to paper scrolling)
  const [currentPaperPage, setCurrentPaperPage] = useState<number>(() => Math.max(1, playheadPage));

  // Synchronize when external playheadPage jumps (e.g. from DAW seek)
  useEffect(() => {
    if (!isPlaying) {
      setCurrentPaperPage(Math.max(1, playheadPage));
    }
  }, [playheadPage, isPlaying]);

  // 3. PREVIEW PAPER ROLLING ENGINE
  // Rolls smoothly at authentic screenplay paper reading pace (1 page = 60 seconds at 1.0x)
  useEffect(() => {
    if (!isOpen || !isPlaying || isMinimized) {
      if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
      lastTimestampRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
      const deltaSec = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      // 1 screenplay paper page per 60 seconds (Standard screenwriting runtime pacing)
      const pagesPerSecond = (1 / 60) * playbackSpeed * 2.5; // 2.5x for responsive teleprompter reading
      const advance = deltaSec * pagesPerSecond;

      setCurrentPaperPage(prev => {
        const next = prev + advance;
        if (next > estimatedTotalPaperPages) {
          onTogglePlay();
          return 1.0;
        }

        // Keep DAW playhead synchronized with the paper roll
        onSeek(next);
        return next;
      });

      playRafRef.current = requestAnimationFrame(step);
    };

    playRafRef.current = requestAnimationFrame(step);
    return () => {
      if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
    };
  }, [isOpen, isPlaying, isMinimized, playbackSpeed, estimatedTotalPaperPages, onSeek, onTogglePlay]);

  // 4. SCROLL CONTAINER SYNCHRONIZATION WITH PREVIEW PAPER
  useEffect(() => {
    if (!isOpen || isMinimized || !scrollContainerRef.current) return;
    if (!isAutoScrollLocked || userScrolledAway) return;

    const container = scrollContainerRef.current;
    // Map paper page to scroll offset on physical paper
    const targetScrollY = (currentPaperPage - 1) * TOTAL_PAGE_UNIT;

    lastProgrammaticScrollRef.current = Date.now();
    container.scrollTo({
      top: Math.max(0, targetScrollY),
      behavior: isPlaying ? 'auto' : 'smooth',
    });
  }, [currentPaperPage, isOpen, isMinimized, isAutoScrollLocked, userScrolledAway, isPlaying]);

  // Detect manual scroll
  const handleScroll = () => {
    if (Date.now() - lastProgrammaticScrollRef.current < 90) return;
    if (isAutoScrollLocked && !userScrolledAway) {
      setUserScrolledAway(true);
    }
  };

  // Resume following paper roll
  const handleResumeAutoScroll = () => {
    setUserScrolledAway(false);
    setIsAutoScrollLocked(true);
    if (scrollContainerRef.current) {
      const targetScrollY = (currentPaperPage - 1) * TOTAL_PAGE_UNIT;
      lastProgrammaticScrollRef.current = Date.now();
      scrollContainerRef.current.scrollTo({ top: Math.max(0, targetScrollY), behavior: 'smooth' });
    }
  };

  // Dragging logic for floating window
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if (isDocked || isFullscreen || isMinimized) return;
    if ((e.target as HTMLElement).closest('button, select, input')) return;

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: windowPos.x,
      initY: windowPos.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 320, dragStartRef.current.initX + dx));
      const newY = Math.max(40, Math.min(window.innerHeight - 180, dragStartRef.current.initY + dy));
      setWindowPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Seek paper page directly
  const handleSeekPage = (page: number) => {
    const clamped = Math.max(1, Math.min(estimatedTotalPaperPages, page));
    setCurrentPaperPage(clamped);
    onSeek(clamped);
    handleResumeAutoScroll();
  };

  // Active scene on current paper page
  const activeScene = useMemo(() => {
    if (sortedBeats.length === 0) return null;
    let found = sortedBeats[0];
    for (const b of sortedBeats) {
      const p = beatPageMap.get(b.id) || 1;
      if (p <= currentPaperPage) {
        found = b;
      }
    }
    return found;
  }, [sortedBeats, beatPageMap, currentPaperPage]);

  // Formatted Screenplay Line Renderer
  const renderScreenplayLines = (content: string, summary?: string) => {
    if (!content || content.trim() === '') {
      return (
        <div className="py-2 text-xs italic text-gray-500 font-mono">
          {summary || 'Scene action underway.'}
        </div>
      );
    }

    const hasClasses = content.includes('sc-action') || content.includes('sc-character') || content.includes('sc-dialogue');
    if (hasClasses) {
      return (
        <div
          className="screenplay-rendered-body select-text space-y-1"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    // Clean plain text fallback
    const rawLines = content.replace(/<br\s*[\/]?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').split('\n').map(l => l.trim()).filter(Boolean);

    return (
      <div className="space-y-1.5 select-text">
        {rawLines.map((line, i) => {
          const isChar = line === line.toUpperCase() && line.length < 35 && !line.endsWith('.');
          const isParen = line.startsWith('(') && line.endsWith(')');

          if (isChar) {
            return (
              <div key={i} className="font-bold uppercase tracking-wider text-center text-xs mt-3 mb-0.5">
                {line}
              </div>
            );
          }
          if (isParen) {
            return (
              <div key={i} className="italic text-center text-xs opacity-75">
                {line}
              </div>
            );
          }
          return (
            <div key={i} className="text-xs leading-relaxed">
              {line}
            </div>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  // Paper Theme Colors
  const paperColors = {
    white: {
      sheetBg: '#ffffff',
      textColor: '#1e293b',
      shadow: '0 8px 32px rgba(0, 0, 0, 0.18), 0 1px 3px rgba(0, 0, 0, 0.1)',
      lineColor: '#64748b',
      pageNumColor: '#64748b',
      slugBg: '#f1f5f9',
      slugText: '#0f172a',
      dividerBorder: '#e2e8f0',
      windowBg: '#0f1118',
    },
    sepia: {
      sheetBg: '#fbf7ee',
      textColor: '#382a1d',
      shadow: '0 8px 32px rgba(60, 40, 20, 0.15), 0 1px 3px rgba(60, 40, 20, 0.1)',
      lineColor: '#85705d',
      pageNumColor: '#85705d',
      slugBg: '#f0e6d2',
      slugText: '#2e2013',
      dividerBorder: '#e4d5be',
      windowBg: '#151310',
    },
    dark: {
      sheetBg: '#161822',
      textColor: '#e2e8f0',
      shadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px #242838',
      lineColor: '#94a3b8',
      pageNumColor: '#94a3b8',
      slugBg: '#212534',
      slugText: '#f8fafc',
      dividerBorder: '#2a2f44',
      windowBg: '#0b0c12',
    },
  }[paperTheme];

  // MINIMIZED PILL
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-5 right-6 z-[9999] flex items-center gap-3 px-4 py-2.5 rounded-full shadow-2xl border backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-150 cursor-pointer select-none"
        style={{
          backgroundColor: dawThemeIsDark ? 'rgba(15, 17, 24, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: appAccentColor,
          color: dawThemeIsDark ? '#fff' : '#1e293b',
        }}
        onClick={() => setIsMinimized(false)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center font-bold shadow-md transition-transform hover:scale-105"
          style={{ backgroundColor: appAccentColor, color: '#000' }}
          title={isPlaying ? 'Pause Roll' : 'Play Roll'}
        >
          {isPlaying ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
        </button>

        <div className="flex items-center gap-2 text-xs font-mono">
          <ScrollText size={14} style={{ color: appAccentColor }} />
          <span className="font-bold">SCRIPT PAPER ROLL</span>
          <span className="text-gray-400 font-semibold">• p. {currentPaperPage.toFixed(1)} / {estimatedTotalPaperPages}</span>
          {activeScene && (
            <span className="hidden sm:inline px-2 py-0.5 rounded bg-white/10 text-[11px] truncate max-w-[200px]">
              SC. {activeScene.sceneNumber || 1}: {activeScene.title}
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(false);
          }}
          className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
          title="Expand Preview"
        >
          <Maximize2 size={13} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-1 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-400"
          title="Close Preview"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-[9999] flex flex-col shadow-2xl border overflow-hidden backdrop-blur-2xl transition-all duration-150 ${
        isDocked
          ? 'right-0 top-12 bottom-0 w-[500px] md:w-[580px] rounded-none border-y-0 border-r-0'
          : isFullscreen
            ? 'inset-4 rounded-xl'
            : 'w-[96vw] sm:w-[620px] md:w-[680px] h-[720px] max-h-[90vh] rounded-2xl'
      }`}
      style={{
        left: isDocked || isFullscreen ? undefined : windowPos.x,
        top: isDocked || isFullscreen ? undefined : windowPos.y,
        backgroundColor: paperColors.windowBg,
        borderColor: dawThemeIsDark ? '#262a3c' : '#cbd5e1',
        fontFamily: '"Courier Prime", Courier, monospace',
      }}
    >
      {/* 1. TOP TITLEBAR */}
      <div
        onMouseDown={handleMouseDownHeader}
        className={`px-4 py-3 flex items-center justify-between border-b select-none font-sans ${
          isDocked || isFullscreen ? 'cursor-default' : 'cursor-move'
        } ${
          dawThemeIsDark ? 'bg-[#10121a]/95 border-white/10 text-white' : 'bg-slate-100 border-slate-300 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold shadow-xs shrink-0"
            style={{ backgroundColor: `${appAccentColor}20`, color: appAccentColor }}
          >
            <ScrollText size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider truncate">
                {translateUi('Screenplay Preview Paper', appLanguage)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 shrink-0 ${
                  isPlaying
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-white/10 text-gray-400'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-amber-500 animate-ping' : 'bg-gray-400'}`} />
                {isPlaying ? translateUi('ROLLING', appLanguage) : translateUi('PAUSED', appLanguage)}
              </span>
            </div>

            <div className="text-[10px] font-mono text-gray-400 flex items-center gap-2 truncate">
              <span>{translateUi('Preview Paper Page', appLanguage)} {currentPaperPage.toFixed(1)} / {estimatedTotalPaperPages}</span>
              {activeScene && (
                <>
                  <span>•</span>
                  <span className="truncate font-bold" style={{ color: appAccentColor }}>
                    SC. {activeScene.sceneNumber || 1}: {activeScene.title}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsDocked(!isDocked);
              setIsFullscreen(false);
            }}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title={isDocked ? translateUi('Undock to Floating', appLanguage) : translateUi('Dock to Right Sidebar', appLanguage)}
          >
            <LayoutTemplate size={13} />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              setIsDocked(false);
            }}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title={isFullscreen ? translateUi('Exit Fullscreen', appLanguage) : translateUi('Fullscreen Preview', appLanguage)}
          >
            <Maximize2 size={13} />
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title={translateUi('Minimize to Scrubber Pill', appLanguage)}
          >
            <Minimize2 size={13} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
            title={translateUi('Close Preview', appLanguage)}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 2. TELEPROMPTER TOOLBAR */}
      <div
        className={`px-4 py-2 border-b flex items-center justify-between flex-wrap gap-2 text-xs font-sans select-none ${
          dawThemeIsDark ? 'bg-[#121522] border-white/5 text-gray-200' : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        {/* Left: Playback Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSeekPage(1.0)}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Return to Paper Page 1"
          >
            <RotateCcw size={13} />
          </button>

          <button
            type="button"
            onClick={() => handleSeekPage(currentPaperPage - 1.0)}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title={translateUi('Previous Page', appLanguage)}
          >
            <ChevronLeft size={14} />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            className="px-3 py-1 rounded-md flex items-center gap-1.5 font-bold text-xs shadow-md transition-all cursor-pointer"
            style={{
              backgroundColor: isPlaying ? '#ef4444' : appAccentColor,
              color: isPlaying ? '#fff' : '#000',
            }}
            title={isPlaying ? translateUi('PAUSE', appLanguage) : translateUi('ROLL SCRIPT', appLanguage)}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
            <span>{isPlaying ? translateUi('PAUSE', appLanguage) : translateUi('ROLL SCRIPT', appLanguage)}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSeekPage(currentPaperPage + 1.0)}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title={translateUi('Next Page', appLanguage)}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Center: Pacing Multipliers */}
        <div className="flex items-center gap-1 bg-black/20 p-0.5 rounded-lg border border-white/5 font-mono text-[11px]">
          <span className="text-[10px] text-gray-400 px-1 font-sans">{translateUi('SPEED:', appLanguage)}</span>
          {[0.5, 1.0, 1.5, 2.0].map(speed => (
            <button
              key={speed}
              type="button"
              onClick={() => onPlaybackSpeedChange(speed)}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                playbackSpeed === speed
                  ? 'font-bold shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              style={{
                backgroundColor: playbackSpeed === speed ? appAccentColor : undefined,
                color: playbackSpeed === speed ? '#000' : undefined,
              }}
              title={`Roll speed ${speed}x (1 page per ${Math.round(60 / (speed * 2.5))}s)`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Right: Paper Theme & Font Size */}
        <div className="flex items-center gap-2">
          {/* Paper Theme Buttons */}
          <div className="flex items-center rounded border border-white/10 p-0.5 gap-0.5 bg-black/20">
            <button
              type="button"
              onClick={() => setPaperTheme('white')}
              className={`p-1 rounded ${paperTheme === 'white' ? 'bg-white text-black shadow-xs font-bold' : 'text-gray-400 hover:text-white'}`}
              title="Classic White Paper"
            >
              <Sun size={12} />
            </button>
            <button
              type="button"
              onClick={() => setPaperTheme('sepia')}
              className={`p-1 rounded ${paperTheme === 'sepia' ? 'bg-[#fbf7ee] text-[#433422] shadow-xs font-bold' : 'text-gray-400 hover:text-white'}`}
              title="Sepia Parchment"
            >
              <Coffee size={12} />
            </button>
            <button
              type="button"
              onClick={() => setPaperTheme('dark')}
              className={`p-1 rounded ${paperTheme === 'dark' ? 'bg-[#1e2230] text-amber-400 shadow-xs font-bold' : 'text-gray-400 hover:text-white'}`}
              title="Cinema Dark Paper"
            >
              <Moon size={12} />
            </button>
          </div>

          {/* Reading Guide Toggle */}
          <button
            type="button"
            onClick={() => setShowReadingGuide(!showReadingGuide)}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              showReadingGuide ? 'text-amber-400 bg-amber-500/10' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Toggle Focus Reading Guide Beam"
          >
            <Eye size={13} />
          </button>
        </div>
      </div>

      {/* 3. MAIN SCRIPT VIEWPORT (Preview Paper Sheets Scrolling Layer) */}
      <div className="relative flex-1 overflow-hidden bg-black/40">
        {/* Teleprompter Focus / Reading Sweet-Spot Beam */}
        {showReadingGuide && (
          <div
            className="absolute inset-x-0 pointer-events-none z-30 flex items-center transition-all"
            style={{ top: '32%' }}
          >
            <div className="h-px flex-1 opacity-50 shadow-sm" style={{ backgroundColor: appAccentColor }} />
            <div
              className="px-2.5 py-0.5 rounded-full text-[9px] font-sans font-bold uppercase tracking-wider mx-4 shadow-xl flex items-center gap-1.5"
              style={{
                backgroundColor: appAccentColor,
                color: '#000',
              }}
            >
              <span>{translateUi('FOCUS • p.', appLanguage)} {currentPaperPage.toFixed(1)}</span>
            </div>
            <div className="h-px flex-1 opacity-50 shadow-sm" style={{ backgroundColor: appAccentColor }} />
          </div>
        )}

        {/* Floating "User Scrolled Away" Pill */}
        {userScrolledAway && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
            <button
              type="button"
              onClick={handleResumeAutoScroll}
              className="px-3 py-1.5 rounded-full text-xs font-sans font-bold shadow-2xl flex items-center gap-2 cursor-pointer transition-transform hover:scale-105"
              style={{
                backgroundColor: appAccentColor,
                color: '#000',
              }}
            >
              <Compass size={13} className="animate-spin" />
              <span>{translateUi('Scrolled Away • Follow Paper Roll', appLanguage)} (p. {currentPaperPage.toFixed(1)})</span>
            </button>
          </div>
        )}

        {/* Scrollable Canvas holding Physical Preview Paper Sheets */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto py-10 px-4 sm:px-6 custom-scrollbar"
        >
          <div
            ref={contentWrapperRef}
            className="mx-auto flex flex-col items-center gap-7 transition-colors"
            style={{
              width: `${PAPER_WIDTH}px`,
              maxWidth: '100%',
            }}
          >
            {/* Screenplay Paper Sheet Display */}
            {Array.from({ length: estimatedTotalPaperPages }).map((_, pageIdx) => {
              const pageNum = pageIdx + 1;
              // Filter beats that belong to this paper page
              const pageBeats = sortedBeats.filter(b => (beatPageMap.get(b.id) || 1) === pageNum);

              return (
                <div
                  key={`preview-paper-sheet-${pageNum}`}
                  className="relative w-full rounded-sm transition-all duration-200 select-text"
                  style={{
                    minHeight: `${PAPER_HEIGHT}px`,
                    backgroundColor: paperColors.sheetBg,
                    color: paperColors.textColor,
                    boxShadow: paperColors.shadow,
                    padding: '80px 84px 80px 96px', // Standard Screenplay Margins: Left 1.5 in, Right 1.0 in, Top/Bottom 1.0 in
                    boxSizing: 'border-box',
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.35,
                  }}
                >
                  {/* Top Right Production Screenplay Page Number (Starting page 2) */}
                  {pageNum > 1 && (
                    <div
                      className="absolute top-10 right-14 font-mono text-xs font-bold select-none tracking-widest pointer-events-none"
                      style={{ color: paperColors.pageNumColor }}
                    >
                      {pageNum}.
                    </div>
                  )}

                  {/* If no scenes on this page, render blank screenplay spacing */}
                  {pageBeats.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs italic opacity-30 font-sans">
                      (Page {pageNum} continues)
                    </div>
                  ) : (
                    pageBeats.map((beat, bIdx) => {
                      const sceneNum = beat.sceneNumber || String(bIdx + 1);

                      return (
                        <div key={beat.id} className="mb-8">
                          {/* Standard Screenplay Slugline / Scene Heading with Left & Right Scene Numbers */}
                          <div
                            className="flex items-center justify-between font-black uppercase tracking-wider text-xs mb-3.5 py-1 px-2.5 rounded-xs"
                            style={{
                              backgroundColor: paperColors.slugBg,
                              color: paperColors.slugText,
                            }}
                          >
                            <span className="font-mono text-[11px] font-bold opacity-80 select-none">
                              {sceneNum}
                            </span>
                            <span className="font-bold">
                              {beat.slug?.type || 'INT.'} {beat.slug?.location || beat.title} {beat.slug?.time ? `- ${beat.slug.time}` : ''}
                            </span>
                            <span className="font-mono text-[11px] font-bold opacity-80 select-none">
                              {sceneNum}
                            </span>
                          </div>

                          {/* Beat Summary Callout (if present) */}
                          {beat.summary && (
                            <div
                              className="mb-3 px-3 py-1.5 rounded-xs italic text-[11px] border"
                              style={{
                                backgroundColor: `${appAccentColor}08`,
                                borderColor: `${appAccentColor}30`,
                                color: paperColors.textColor,
                              }}
                            >
                              <span className="font-bold not-italic font-sans text-[10px] uppercase tracking-wider mr-1 text-amber-600">
                                {translateUi('NOTE:', appLanguage)}
                              </span>
                              {beat.summary}
                            </div>
                          )}

                          {/* Screenplay Content Body */}
                          <div className="screenplay-content">
                            {renderScreenplayLines(beat.content, beat.summary)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. FOOTER SCRUBBER (Based directly on Screenplay Paper Pages) */}
      <div
        className={`px-4 py-2.5 border-t flex items-center justify-between gap-4 font-sans select-none ${
          dawThemeIsDark ? 'bg-[#10121a] border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-3 text-xs font-mono shrink-0">
          <span className="font-bold">
            {translateUi('PAGE', appLanguage)} {currentPaperPage.toFixed(1)} <span className="text-gray-400 font-normal">/ {estimatedTotalPaperPages}</span>
          </span>
          <span className="text-gray-500 hidden sm:inline">•</span>
          <span className="text-gray-400 hidden sm:inline">
            {Math.round((currentPaperPage / Math.max(1, estimatedTotalPaperPages)) * 100)}% {translateUi('Complete', appLanguage)}
          </span>
        </div>

        {/* Paper Page Scrub Bar */}
        <div className="flex-1 max-w-md mx-2 relative flex items-center">
          <input
            type="range"
            min={1}
            max={estimatedTotalPaperPages}
            step={0.1}
            value={currentPaperPage}
            onChange={(e) => handleSeekPage(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-white/20 accent-amber-500"
            title="Scrub Preview Paper Page"
          />
        </div>

        <div className="flex items-center gap-2 text-[11px] shrink-0">
          <button
            type="button"
            onClick={() => setIsAutoScrollLocked(!isAutoScrollLocked)}
            className={`px-2 py-0.5 rounded flex items-center gap-1 font-mono transition-colors cursor-pointer ${
              isAutoScrollLocked
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-white/5 text-gray-400'
            }`}
            title="Toggle Auto-Roll lock to paper page"
          >
            <Compass size={11} />
            <span>{isAutoScrollLocked ? 'AUTO-ROLL' : 'MANUAL'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
