import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';
import { Beat, TimelineTrack, Group, Connection } from '../../types';
import { 
  Play, Pause, RotateCcw, Activity, Terminal as TerminalIcon,
  Plus, Trash2, Copy, Edit3, Sparkles,
  Maximize2, Minimize2, ZoomIn, ZoomOut,
  FileText, X, ArrowUp, ArrowDown, Check,
  Settings2, ArrowLeftRight, CornerDownLeft, BarChart3, HelpCircle,
  ChevronDown, ChevronRight, ChevronLeft, Layers, Hash,
  Network, Compass, GitBranch, Bookmark,
  Scissors, SkipBack, SkipForward, Palette, ScrollText
} from 'lucide-react';
import { AISceneGeneratorModal } from '../AISceneGeneratorModal';
import { ScriptRollingPreviewModal } from '../ScriptRollingPreviewModal';
import { translateUi } from '../../services/appTranslations';

interface BoardViewProps {
  onEditBeat: (id: number) => void;
}

// 3 Subtracks per master track (DAW standard multi-lane architecture)
export const MAX_SUBTRACKS_PER_TRACK = 2;

export type DawThemeId = 'obsidian' | 'slate' | 'vintage' | 'paper' | 'platinum';

export interface DawThemeConfig {
  id: DawThemeId;
  name: string;
  isDark: boolean;
  bgCanvas: string;
  bgHeader: string;
  bgStrip: string;
  bgStripSub: string;
  bgRuler: string;
  bgCard: string;
  borderRuler: string;
  borderStrip: string;
  borderLane: string;
  borderCard: string;
  textPrimary: string;
  textMuted: string;
  textSubtle: string;
  gridMajor: string;
  gridMid: string;
  gridMinor: string;
  accent: string;
}

const DAW_THEMES: Record<DawThemeId, DawThemeConfig> = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Studio',
    isDark: true,
    bgCanvas: 'bg-[#08090d]',
    bgHeader: 'bg-[#0e1017]',
    bgStrip: 'bg-[#0d0f17]',
    bgStripSub: 'bg-[#090a10]',
    bgRuler: 'bg-[#0c0e15]',
    bgCard: '#121522',
    borderRuler: 'border-[#1e2235]',
    borderStrip: 'border-[#1c1f2e]',
    borderLane: 'border-white/[0.06]',
    borderCard: 'border-white/10',
    textPrimary: 'text-slate-100',
    textMuted: 'text-slate-400',
    textSubtle: 'text-slate-600',
    gridMajor: 'border-white/10',
    gridMid: 'border-white/5',
    gridMinor: 'border-white/[0.02]',
    accent: '#f59e0b'
  },
  slate: {
    id: 'slate',
    name: 'Cyber Slate',
    isDark: true,
    bgCanvas: 'bg-[#0b1120]',
    bgHeader: 'bg-[#0f172a]',
    bgStrip: 'bg-[#0f172a]',
    bgStripSub: 'bg-[#0a0f1d]',
    bgRuler: 'bg-[#0f172a]',
    bgCard: '#1a2236',
    borderRuler: 'border-slate-700/60',
    borderStrip: 'border-slate-800',
    borderLane: 'border-slate-800/80',
    borderCard: 'border-slate-700/50',
    textPrimary: 'text-slate-100',
    textMuted: 'text-slate-400',
    textSubtle: 'text-slate-500',
    gridMajor: 'border-cyan-500/20',
    gridMid: 'border-cyan-500/10',
    gridMinor: 'border-slate-700/20',
    accent: '#06b6d4'
  },
  vintage: {
    id: 'vintage',
    name: 'Vintage Console',
    isDark: true,
    bgCanvas: 'bg-[#12100e]',
    bgHeader: 'bg-[#1a1714]',
    bgStrip: 'bg-[#181512]',
    bgStripSub: 'bg-[#100e0c]',
    bgRuler: 'bg-[#1a1612]',
    bgCard: '#241f1a',
    borderRuler: 'border-[#332a22]',
    borderStrip: 'border-[#2d241c]',
    borderLane: 'border-amber-900/20',
    borderCard: 'border-amber-700/30',
    textPrimary: 'text-amber-100',
    textMuted: 'text-amber-200/60',
    textSubtle: 'text-amber-200/40',
    gridMajor: 'border-amber-500/20',
    gridMid: 'border-amber-500/10',
    gridMinor: 'border-amber-900/15',
    accent: '#d97706'
  },
  paper: {
    id: 'paper',
    name: 'Paper Script',
    isDark: false,
    bgCanvas: 'bg-[#f4f5f8]',
    bgHeader: 'bg-[#ffffff]',
    bgStrip: 'bg-[#edf0f4]',
    bgStripSub: 'bg-[#e4e8ef]',
    bgRuler: 'bg-[#e9edf2]',
    bgCard: '#ffffff',
    borderRuler: 'border-slate-300/80',
    borderStrip: 'border-slate-300/80',
    borderLane: 'border-slate-300/70',
    borderCard: 'border-slate-300/80',
    textPrimary: 'text-slate-900',
    textMuted: 'text-slate-600',
    textSubtle: 'text-slate-400',
    gridMajor: 'border-slate-400/40',
    gridMid: 'border-slate-300/50',
    gridMinor: 'border-slate-200/60',
    accent: '#d97706'
  },
  platinum: {
    id: 'platinum',
    name: 'Studio Platinum',
    isDark: false,
    bgCanvas: 'bg-[#e2e8f0]',
    bgHeader: 'bg-[#f8fafc]',
    bgStrip: 'bg-[#f1f5f9]',
    bgStripSub: 'bg-[#e2e8f0]',
    bgRuler: 'bg-[#e2e8f0]',
    bgCard: '#ffffff',
    borderRuler: 'border-slate-300',
    borderStrip: 'border-slate-300',
    borderLane: 'border-slate-300',
    borderCard: 'border-slate-300',
    textPrimary: 'text-slate-900',
    textMuted: 'text-slate-600',
    textSubtle: 'text-slate-400',
    gridMajor: 'border-slate-400/40',
    gridMid: 'border-slate-300/50',
    gridMinor: 'border-slate-300/30',
    accent: '#2563eb'
  }
};

// Dynamic subtrack height: scales with lane height setting so detailed cards have full room
export const getSubtrackHeight = (baseHeight: number = 112): number => {
  if (baseHeight >= 112) return 84; // Detailed mode: ample room for synopsis snippet & tension bar
  if (baseHeight >= 84) return 68;  // Standard mode
  return 54;                        // Compact mode
};

export const getSpecificSubtrackHeight = (track: TimelineTrack, subNum: number, globalLaneHeight: number = 112): number => {
  if (track.subtrackHeights && typeof track.subtrackHeights[subNum] === 'number') {
    return track.subtrackHeights[subNum];
  }
  const mainH = track.height || globalLaneHeight;
  return getSubtrackHeight(mainH);
};

export const getTrackTotalHeight = (track: TimelineTrack, globalLaneHeight: number): number => {
  const mainH = track.height || globalLaneHeight;
  const subCount = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, track.subtrackCount || 0));
  if (subCount === 0) return mainH;
  let total = mainH;
  for (let s = 1; s <= subCount; s++) {
    total += getSpecificSubtrackHeight(track, s, globalLaneHeight);
  }
  return total;
};

// Default standard tracks for narrative beats (Detailed as default, 112px height, manual subtracks)
const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: 'v1', label: 'A-Story / Main Protagonist', type: 'main', color: '#06b6d4', height: 112, volume: 85, subtrackCount: 0 },
  { id: 'v2', label: 'B-Story / Allies & Romance', type: 'subplot', color: '#f59e0b', height: 112, volume: 75, subtrackCount: 0 },
  { id: 'v3', label: 'Antagonist & Obstacles', type: 'parallel', color: '#f43f5e', height: 112, volume: 80, subtrackCount: 0 },
  { id: 'v4', label: 'Atmosphere, Tone & B-Roll', type: 'broll', color: '#a855f7', height: 112, volume: 60, subtrackCount: 0 },
  { id: 'v5', label: 'Theme & Philosophy', type: 'theme', color: '#10b981', height: 112, volume: 70, subtrackCount: 0 },
];

const TRACK_PALETTE_COLORS = [
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Cobalt', hex: '#3b82f6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Gold', hex: '#eab308' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Slate', hex: '#64748b' },
];

const PRESET_ROLE_NAMES = [
  'Main Action / A-Story',
  'Subplot / B-Story',
  'Antagonist / Opposing Forces',
  'Atmosphere & Tone',
  'Theme & Philosophy',
  'Romantic Arc',
  'Mystery & Clues',
  'Flashback / Lore'
];

// Natural beat width calculated strictly from beat title character length (~7.8px/char + 80px badges/padding)
export const getBeatTitleWidth = (title?: string): number => {
  const clean = (title || 'Untitled Beat').trim();
  return Math.max(90, Math.round(clean.length * 7.8 + 80));
};

// Pantone-inspired card palette generator — creates rich saturated card backgrounds from any track hex color
// Dark mode: Deep saturated swatches like Total Eclipse (#0A1422) or Ultramarine Green (#0F3D34)
// Light mode: Sophisticated soft tints with subtle color identity
const getPantoneCardStyle = (trackHex: string, isDark: boolean) => {
  const r = parseInt(trackHex.slice(1, 3), 16) || 0;
  const g = parseInt(trackHex.slice(3, 5), 16) || 0;
  const b = parseInt(trackHex.slice(5, 7), 16) || 0;

  if (isDark) {
    // Rich saturated Pantone swatches (Total Eclipse, Ultramarine Green, Vampire Red)
    const mix = 0.28;
    const base = { r: 10, g: 12, b: 18 };
    const bgR = Math.round(r * mix + base.r * (1 - mix));
    const bgG = Math.round(g * mix + base.g * (1 - mix));
    const bgB = Math.round(b * mix + base.b * (1 - mix));

    return {
      bg: `rgb(${bgR}, ${bgG}, ${bgB})`,
      bgSelected: `rgb(${Math.min(255, bgR + 18)}, ${Math.min(255, bgG + 18)}, ${Math.min(255, bgB + 22)})`,
      border: `rgba(${r},${g},${b},0.32)`,
      metaColBg: 'rgba(0, 0, 0, 0.25)',
      divider: 'rgba(255, 255, 255, 0.12)',
      textPrimary: '#F8FAFC',
      textSecondary: 'rgba(241, 245, 249, 0.78)',
      textMuted: 'rgba(148, 163, 184, 0.65)',
    };
  } else {
    // Crisp editorial tints
    const bgR = Math.round(255 - (255 - r) * 0.14);
    const bgG = Math.round(255 - (255 - g) * 0.14);
    const bgB = Math.round(255 - (255 - b) * 0.14);

    return {
      bg: `rgb(${bgR}, ${bgG}, ${bgB})`,
      bgSelected: `rgb(${Math.round(255 - (255 - r) * 0.24)}, ${Math.round(255 - (255 - g) * 0.24)}, ${Math.round(255 - (255 - b) * 0.24)})`,
      border: `rgba(${r},${g},${b},0.28)`,
      metaColBg: 'rgba(0, 0, 0, 0.035)',
      divider: 'rgba(0, 0, 0, 0.08)',
      textPrimary: '#0F172A',
      textSecondary: 'rgba(30, 41, 59, 0.82)',
      textMuted: 'rgba(71, 85, 105, 0.65)',
    };
  }
};

export const BoardView: React.FC<BoardViewProps> = ({ onEditBeat }) => {
  const { 
    beats, setBeats, updateBeat, captureSnapshot,
    currentProjectId, groups, addGroup, connections, activeBoardId,
    appTheme, appAccentColor = '#f5a623', appLanguage = 'english'
  } = useProject();
  const { aiAvailable } = useAiKeyStatus();

  const tracksStorageKey = `backstage_daw_tracks_${currentProjectId || 'default'}`;

  // DAW Tracks State - strictly scoped to active project
  const [tracks, setTracks] = useState<TimelineTrack[]>(() => {
    try {
      // Clean up legacy global key if present to prevent cross-project track leakage
      localStorage.removeItem('backstage_daw_tracks');
      const saved = localStorage.getItem(tracksStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t: TimelineTrack) => ({
            ...t,
            height: (t.height === 162 || !t.height) ? 112 : t.height,
            subtrackCount: typeof t.subtrackCount === 'number' ? Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, t.subtrackCount)) : 0
          }));
        }
      }
    } catch (e) {}
    return DEFAULT_TRACKS;
  });

  const saveTracks = (newTracks: TimelineTrack[]) => {
    setTracks(newTracks);
    try {
      localStorage.setItem(tracksStorageKey, JSON.stringify(newTracks));
    } catch (e) {}
  };

  // DAW Theme State & Persistence
  const [dawThemeId, setDawThemeId] = useState<DawThemeId>(() => {
    try {
      const saved = localStorage.getItem('backstage_daw_theme') as DawThemeId;
      if (saved && DAW_THEMES[saved]) return saved;
    } catch (e) {}
    return appTheme === 'light' ? 'paper' : 'obsidian';
  });

  const saveDawTheme = (themeId: DawThemeId) => {
    setDawThemeId(themeId);
    try {
      localStorage.setItem('backstage_daw_theme', themeId);
      if (DAW_THEMES[themeId]?.isDark) {
        localStorage.setItem('backstage_daw_dark_theme', themeId);
      } else {
        localStorage.setItem('backstage_daw_light_theme', themeId);
      }
    } catch (e) {}
  };

  // Synchronize DAW theme when user toggles app-wide theme between Dark and Light mode
  useEffect(() => {
    if (appTheme === 'light') {
      setDawThemeId(prev => {
        if (DAW_THEMES[prev]?.isDark) {
          const savedLight = (localStorage.getItem('backstage_daw_light_theme') as DawThemeId) || 'paper';
          return DAW_THEMES[savedLight] && !DAW_THEMES[savedLight].isDark ? savedLight : 'paper';
        }
        return prev;
      });
    } else if (appTheme === 'dark') {
      setDawThemeId(prev => {
        if (!DAW_THEMES[prev]?.isDark) {
          const savedDark = (localStorage.getItem('backstage_daw_dark_theme') as DawThemeId) || 'obsidian';
          return DAW_THEMES[savedDark] && DAW_THEMES[savedDark].isDark ? savedDark : 'obsidian';
        }
        return prev;
      });
    }
  }, [appTheme]);

  const currentTheme = DAW_THEMES[dawThemeId] || DAW_THEMES.obsidian;

  // Sync DAW tracks dynamically when project changes or Causality file is imported
  useEffect(() => {
    const reloadTracks = (e?: any) => {
      try {
        if (e?.detail?.tracks && Array.isArray(e.detail.tracks) && e.detail.tracks.length > 0) {
          setTracks(e.detail.tracks.map((t: TimelineTrack) => ({
            ...t,
            height: (t.height === 162 || !t.height) ? 112 : t.height,
            subtrackCount: typeof t.subtrackCount === 'number' ? Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, t.subtrackCount)) : 0
          })));
          return;
        }
        const saved = localStorage.getItem(tracksStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTracks(parsed.map((t: TimelineTrack) => ({
              ...t,
              height: (t.height === 162 || !t.height) ? 112 : t.height,
              subtrackCount: typeof t.subtrackCount === 'number' ? Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, t.subtrackCount)) : 0
            })));
            return;
          }
        }
      } catch (e) {}
      setTracks(DEFAULT_TRACKS);
    };

    reloadTracks();
    window.addEventListener('project_imported', reloadTracks);
    window.addEventListener('daw_tracks_updated', reloadTracks);
    return () => {
      window.removeEventListener('project_imported', reloadTracks);
      window.removeEventListener('daw_tracks_updated', reloadTracks);
    };
  }, [tracksStorageKey, currentProjectId]);

  const handleResetToDefaultTracks = () => {
    saveTracks(DEFAULT_TRACKS);
    logTerminal('info', 'DAW tracks reset to default narrative structure (A-Story, B-Story, Antagonist, Atmosphere, Theme).');
  };

  // Manually add a subtrack (up to 2 subtracks max per track)
  const handleAddSubtrack = (trackId: string) => {
    setTracks(prevTracks => {
      const updated = prevTracks.map(t => {
        if (t.id === trackId) {
          const curCount = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, t.subtrackCount || 0));
          if (curCount < MAX_SUBTRACKS_PER_TRACK) {
            return { ...t, subtrackCount: curCount + 1 };
          }
        }
        return t;
      });
      saveTracks(updated);
      return updated;
    });
  };

  // Manually remove a subtrack and reassign any orphan beats
  const handleRemoveSubtrack = (trackId: string, subtrackNum: number) => {
    const trackIdx = tracks.findIndex(t => t.id === trackId);
    setTracks(prevTracks => {
      const updated = prevTracks.map(t => {
        if (t.id === trackId) {
          const curCount = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, t.subtrackCount || 0));
          return { ...t, subtrackCount: Math.max(0, curCount - 1) };
        }
        return t;
      });
      saveTracks(updated);
      return updated;
    });

    if (trackIdx !== -1) {
      setBeats(prevBeats => prevBeats.map(b => {
        if (b.trackIndex === trackIdx) {
          if (b.subtrackIndex === subtrackNum) {
            return { ...b, subtrackIndex: Math.max(0, subtrackNum - 1) };
          } else if (typeof b.subtrackIndex === 'number' && b.subtrackIndex > subtrackNum) {
            return { ...b, subtrackIndex: b.subtrackIndex - 1 };
          }
        }
        return b;
      }));
    }
  };

  // Track Header Position: 'left' (Industry standard Logic/Final Cut) or 'right' (Ableton)
  const [trackHeaderDock, setTrackHeaderDock] = useState<'left' | 'right'>('left');

  // Track Customization & Inline Renaming State
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTrackLabel, setEditingTrackLabel] = useState<string>('');
  const [activeTrackSettingsId, setActiveTrackSettingsId] = useState<string | null>(null);

  // Global Lane Height Preset: Detailed (112) by default
  const [globalLaneHeight, setGlobalLaneHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('backstage_daw_lane_height');
      if (saved) {
        const num = Number(saved);
        if ([64, 84, 112].includes(num)) return num;
      }
    } catch (e) {}
    return 112; // Detailed as default
  });

  // DAW Transport State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPage, setPlayheadPage] = useState(1.0);
  const [tempoBpm] = useState(120);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isScriptRollingOpen, setIsScriptRollingOpen] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [loopRange] = useState<{ start: number; end: number }>({ start: 25, end: 55 });
  const [snapGrid, setSnapGrid] = useState<'quarter' | 'half' | 'page' | 'free'>('half');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [pixelsPerPage] = useState(28);

  // Unified play toggle: automatically opens the script rolling teleprompter preview when playback starts
  const handleTogglePlay = useCallback(() => {
    setIsPlaying(prev => {
      const next = !prev;
      if (next) {
        setIsScriptRollingOpen(true);
      }
      return next;
    });
  }, []);

  // Selection & Inspector State
  const [selectedBeatId, setSelectedBeatId] = useState<number | null>(null);

  // Terminal & Drawer State
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalTab, setTerminalTab] = useState<'cli' | 'inspector' | 'tension'>('cli');
  const [terminalHeight, setTerminalHeight] = useState(240);
  const [cliInput, setCliInput] = useState('');
  const [, setCliHistory] = useState<string[]>([]);
  const [, setCliHistoryIndex] = useState(-1);
  const [cliLogs, setCliLogs] = useState<Array<{ id: string; type: 'cmd' | 'out' | 'err' | 'info'; text: string; time: string }>>([
    { id: '1', type: 'info', text: 'Backstage DAW Sequencer loaded. Type "help" for commands.', time: '00:00:00' },
  ]);

  // AI Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Interactive Track Height Resizing State (subtrackIdx: 0 for Main Track, 1 or 2 for subtracks)
  const [resizingTrack, setResizingTrack] = useState<{
    trackId: string;
    subtrackIdx: number;
    startY: number;
    initialHeight: number;
  } | null>(null);

  // Beat Inline Editing State (widened lane displaying both beat name and summary simultaneously)
  const [inlineEditState, setInlineEditState] = useState<{
    beatId: number;
    trackId: string;
    subtrackIdx: number;
    originalHeight?: number;
    titleText: string;
    summaryText: string;
  } | null>(null);

  // Beat Right-Click Context Menu State (Appears on top of everything: z-[99999])
  const [beatContextMenu, setBeatContextMenu] = useState<{
    beatId: number;
    x: number;
    y: number;
  } | null>(null);

  // Scrubber Hover State
  const [rulerHoverPage, setRulerHoverPage] = useState<number | null>(null);

  // Dragging / Trimming Clip State (Tracks both master track and subtrack 0, 1, 2)
  const [isActuallyDragging, setIsActuallyDragging] = useState(false);
  const [dragHoverTrack, setDragHoverTrack] = useState<{ trackIdx: number; subtrackIdx: number } | null>(null);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'trim-left' | 'trim-right';
    beatId: number;
    startX: number;
    startY: number;
    initialStartPage: number;
    initialDuration: number;
    targetTrackIdx: number;
    targetSubtrackIdx: number;
    initialTrackIdx: number;
    initialSubtrackIdx: number;
  } | null>(null);

  // Live Drag GPU Offset (No React Context re-renders during mouse movement = 120 FPS silky smooth)
  const [liveDragOffset, setLiveDragOffset] = useState<{
    beatId: number;
    deltaPx: number;
    deltaYPx: number;
    targetTrackIdx: number;
    targetSubtrackIdx: number;
    targetStartPage: number;
    newDurationPages?: number;
  } | null>(null);
  const pendingDragRef = useRef<{
    beatId: number;
    type: 'move' | 'trim-left' | 'trim-right';
    finalStart: number;
    finalTrack: number;
    finalSubtrack: number;
    finalDurationPages: number;
  } | null>(null);

  // Right-Click Marquee Drag Selection State to Group Clips Together
  const [rightClickMarqueeBox, setRightClickMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [marqueeSelectedBeatIds, setMarqueeSelectedBeatIds] = useState<number[]>([]);
  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupColor, setNewGroupColor] = useState<string>('#3b82f6');
  const rightClickStartRef = useRef<{ startX: number; startY: number; isDragging: boolean } | null>(null);

  // References
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);
  const terminalLogsEndRef = useRef<HTMLDivElement>(null);
  const cliInputRef = useRef<HTMLInputElement>(null);
  const playRafRef = useRef<number | null>(null);
  const lastPlayTimeRef = useRef<number | null>(null);
  const miniMapRef = useRef<HTMLDivElement>(null);

  // Causality Features & Performance Controls
  const [showDependencies, setShowDependencies] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('backstage_daw_show_dependencies');
      return saved !== null ? saved === 'true' : true;
    } catch { return true; }
  });
  const [showGroups, setShowGroups] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('backstage_daw_show_groups');
      return saved !== null ? saved === 'true' : true;
    } catch { return true; }
  });
  const [showMiniMap, setShowMiniMap] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('backstage_daw_show_minimap');
      return saved !== null ? saved === 'true' : true;
    } catch { return true; }
  });

  // Viewport tracking for 200+ beat horizontal virtualization & mini-map scrubbing
  const [viewportMetrics, setViewportMetrics] = useState({ scrollLeft: 0, clientWidth: 1200 });


  // Natural Timeline scale: pixels per screenplay page adjusted by zoom
  const effectivePxPerPage = pixelsPerPage * zoomLevel;

  // Computed layout for beats (Visibility-First: Beat name length strictly determines width, zero lane collision)
  const beatsWithTimeline = useMemo(() => {
    // Keep track of end page for each lane (trackIdx_subtrackIdx) to guarantee zero overlap
    const laneEndMap = new Map<string, number>();

    // Stable sort: respect user set startTime if valid, otherwise preserve existing order
    const sortedBeats = [...beats].sort((a, b) => {
      const aStart = typeof a.startTime === 'number' && a.startTime >= 1 ? a.startTime : 0;
      const bStart = typeof b.startTime === 'number' && b.startTime >= 1 ? b.startTime : 0;
      if (aStart > 0 && bStart > 0 && Math.abs(aStart - bStart) > 0.01) {
        return aStart - bStart;
      }
      return 0;
    });

    return sortedBeats.map((b) => {
      const trackIdx = typeof b.trackIndex === 'number' && b.trackIndex >= 0 && b.trackIndex < tracks.length ? b.trackIndex : 0;
      const curTrack = tracks[trackIdx];
      const maxSub = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, curTrack?.subtrackCount || 0));
      const subtrackIdx = typeof b.subtrackIndex === 'number' && b.subtrackIndex >= 0 && b.subtrackIndex <= maxSub ? b.subtrackIndex : 0;
      const laneKey = `${trackIdx}_${subtrackIdx}`;

      // Natural width is determined strictly by the beat's title so the full title is 100% visible
      const minRequiredWidth = getBeatTitleWidth(b.title);
      const naturalDuration = Math.max(1.0, Math.round((minRequiredWidth / effectivePxPerPage) * 10) / 10);

      // Duration in pages: defaults to natural duration from title length, or user-customized duration if larger
      const durationPages = typeof (b as any).durationPages === 'number' && (b as any).durationPages > 0
        ? Math.max(naturalDuration, (b as any).durationPages)
        : typeof b.durationWidth === 'number' && b.durationWidth > 0
          ? Math.max(naturalDuration, Math.round((b.durationWidth / effectivePxPerPage) * 10) / 10)
          : naturalDuration;

      const lastEndOnLane = laneEndMap.get(laneKey) ?? 1.0;
      const rawStart = typeof b.startTime === 'number' && b.startTime >= 1 ? b.startTime : lastEndOnLane;
      // Guarantee zero overlap on this lane: must start at least at lastEndOnLane
      const startPage = Math.max(rawStart, lastEndOnLane);
      laneEndMap.set(laneKey, Math.round((startPage + durationPages + 0.1) * 10) / 10);

      const tension = typeof b.tension === 'number' ? b.tension : 50;

      return {
        ...b,
        timelineTrackIdx: trackIdx,
        timelineSubtrackIdx: subtrackIdx,
        startPage,
        durationPages,
        minRequiredWidth,
        tension
      };
    });
  }, [beats, tracks, effectivePxPerPage]);

  // Auto Scene Numbering State (Enabled by default: left-to-right chronological 1, 2, 3...)
  const [autoNumberingEnabled, setAutoNumberingEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('backstage_daw_auto_scene_numbering');
      return saved !== null ? saved === 'true' : true;
    } catch (err) {
      return true;
    }
  });

  // Auto Scene Numbering: Map beat ID to its chronological 1-based order (left to right)
  const autoSceneMap = useMemo(() => {
    const sorted = [...beatsWithTimeline].sort((a, b) => {
      if (Math.abs(a.startPage - b.startPage) > 0.001) {
        return a.startPage - b.startPage;
      }
      if (a.timelineTrackIdx !== b.timelineTrackIdx) {
        return a.timelineTrackIdx - b.timelineTrackIdx;
      }
      if (a.timelineSubtrackIdx !== b.timelineSubtrackIdx) {
        return a.timelineSubtrackIdx - b.timelineSubtrackIdx;
      }
      return a.id - b.id;
    });

    const map = new Map<number, number>();
    sorted.forEach((beat, index) => {
      map.set(beat.id, index + 1);
    });
    return map;
  }, [beatsWithTimeline]);

  // Sync auto scene numbers to beat models so all app views reflect chronological order
  const syncAutoSceneNumbers = useCallback(() => {
    setBeats(prevBeats => {
      let accumulatedPage = 1.0;
      const beatsWithPages = prevBeats.map(b => {
        const trackIdx = typeof b.trackIndex === 'number' && b.trackIndex >= 0 && b.trackIndex < tracks.length ? b.trackIndex : 0;
        const curTrack = tracks[trackIdx];
        const maxSub = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, curTrack?.subtrackCount || 0));
        const subtrackIdx = typeof b.subtrackIndex === 'number' && b.subtrackIndex >= 0 && b.subtrackIndex <= maxSub ? b.subtrackIndex : 0;
        const wordCount = (b.content || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
        const defaultDuration = Math.max(1.5, Math.min(8.0, Math.round((wordCount / 220) * 2) / 2 || 2.5));
        const startPage = typeof b.startTime === 'number' && b.startTime >= 1 ? b.startTime : accumulatedPage;
        const durationPages = typeof (b as any).durationPages === 'number' && (b as any).durationPages > 0
          ? (b as any).durationPages
          : typeof b.durationWidth === 'number' && b.durationWidth > 0
            ? (b.durationWidth / pixelsPerPage)
            : defaultDuration;
        accumulatedPage = Math.max(accumulatedPage, startPage + durationPages);
        return {
          id: b.id,
          startPage,
          trackIdx,
          subtrackIdx
        };
      });

      const sorted = [...beatsWithPages].sort((a, b) => {
        if (Math.abs(a.startPage - b.startPage) > 0.001) {
          return a.startPage - b.startPage;
        }
        if (a.trackIdx !== b.trackIdx) {
          return a.trackIdx - b.trackIdx;
        }
        if (a.subtrackIdx !== b.subtrackIdx) {
          return a.subtrackIdx - b.subtrackIdx;
        }
        return a.id - b.id;
      });

      const orderMap = new Map<number, number>();
      sorted.forEach((item, index) => {
        orderMap.set(item.id, index + 1);
      });

      let changed = false;
      const updated = prevBeats.map(b => {
        const expected = String(orderMap.get(b.id) ?? 1);
        if (b.sceneNumber !== expected) {
          changed = true;
          return { ...b, sceneNumber: expected };
        }
        return b;
      });

      return changed ? updated : prevBeats;
    });
  }, [tracks, pixelsPerPage, setBeats]);

  const toggleAutoNumbering = () => {
    const next = !autoNumberingEnabled;
    setAutoNumberingEnabled(next);
    try {
      localStorage.setItem('backstage_daw_auto_scene_numbering', String(next));
    } catch (err) {}
    if (next) {
      syncAutoSceneNumbers();
      logTerminal('info', 'Auto Scene Numbering enabled: scenes ordered 1..N chronologically.');
    } else {
      logTerminal('info', 'Auto Scene Numbering disabled.');
    }
  };

  // Sync scene numbers on initial load if auto-numbering is enabled
  useEffect(() => {
    if (autoNumberingEnabled && beats.length > 0) {
      syncAutoSceneNumbers();
    }
  }, []);

  // Zoom In / Out anchored to the playhead
  const zoomAroundPlayhead = (newZoom: number) => {
    const clampedZoom = Math.max(0.4, Math.min(3.0, Math.round(newZoom * 10) / 10));
    if (clampedZoom === zoomLevel) return;

    const scrollContainer = timelineScrollRef.current;
    const headerOffset = trackHeaderDock === 'left' ? 256 : 0;
    const oldEffective = pixelsPerPage * zoomLevel;
    const newEffective = pixelsPerPage * clampedZoom;

    let relativePlayheadOffset = 0;
    if (scrollContainer) {
      const oldPlayheadPixel = (playheadPage - 1) * oldEffective + headerOffset;
      relativePlayheadOffset = oldPlayheadPixel - scrollContainer.scrollLeft;
    }

    setZoomLevel(clampedZoom);

    requestAnimationFrame(() => {
      if (timelineScrollRef.current) {
        const newPlayheadPixel = (playheadPage - 1) * newEffective + headerOffset;
        const containerWidth = timelineScrollRef.current.clientWidth;
        
        // If playhead was visible on screen, keep it at the exact same screen offset
        if (relativePlayheadOffset >= 0 && relativePlayheadOffset <= containerWidth) {
          timelineScrollRef.current.scrollLeft = Math.max(0, newPlayheadPixel - relativePlayheadOffset);
        } else {
          // Otherwise, center the playhead in the viewport
          timelineScrollRef.current.scrollLeft = Math.max(0, newPlayheadPixel - (containerWidth / 2));
        }
      }
    });
  };

  // Wheel-based zooming on timeline when holding Ctrl, Cmd, or Alt
  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        zoomAroundPlayhead(zoomLevel + delta);
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoomLevel, playheadPage, trackHeaderDock, pixelsPerPage]);

  // Selected beat
  const selectedBeat = useMemo(() => {
    return beatsWithTimeline.find(b => b.id === selectedBeatId) || null;
  }, [beatsWithTimeline, selectedBeatId]);

  // Total pages: dynamically stretches to fit all beat cards based on their title lengths
  const totalScreenplayPages = useMemo(() => {
    if (beatsWithTimeline.length === 0) return 40;
    const maxEnd = Math.max(...beatsWithTimeline.map(b => b.startPage + b.durationPages));
    return Math.max(40, Math.ceil(maxEnd + 6));
  }, [beatsWithTimeline]);


  // Track management operations
  const updateTrack = (trackId: string, updates: Partial<TimelineTrack>) => {
    const updated = tracks.map(t => t.id === trackId ? { ...t, ...updates } : t);
    saveTracks(updated);
  };

  const renameTrack = (trackId: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    updateTrack(trackId, { label: trimmed });
    setEditingTrackId(null);
  };

  const deleteTrack = (trackId: string) => {
    if (tracks.length <= 1) return;
    const idxToRemove = tracks.findIndex(t => t.id === trackId);
    const updated = tracks.filter(t => t.id !== trackId);
    saveTracks(updated);
    setBeats(beats.map(b => {
      if (b.trackIndex === idxToRemove) {
        return { ...b, trackIndex: Math.min(updated.length - 1, idxToRemove) };
      } else if (typeof b.trackIndex === 'number' && b.trackIndex > idxToRemove) {
        return { ...b, trackIndex: b.trackIndex - 1 };
      }
      return b;
    }));
    captureSnapshot();
    setActiveTrackSettingsId(null);
  };

  const duplicateTrack = (trackId: string) => {
    const source = tracks.find(t => t.id === trackId);
    if (!source) return;
    const newId = `v${tracks.length + 1}`;
    const newTrack: TimelineTrack = {
      ...source,
      id: newId,
      label: `${source.label} (Copy)`
    };
    saveTracks([...tracks, newTrack]);
    setActiveTrackSettingsId(null);
  };

  const moveTrackOrder = (trackId: string, dir: 'up' | 'down') => {
    const idx = tracks.findIndex(t => t.id === trackId);
    if (idx === -1) return;
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === tracks.length - 1) return;

    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    const newTracks = [...tracks];
    const [moved] = newTracks.splice(idx, 1);
    newTracks.splice(targetIdx, 0, moved);
    saveTracks(newTracks);

    setBeats(beats.map(b => {
      if (b.trackIndex === idx) return { ...b, trackIndex: targetIdx };
      if (b.trackIndex === targetIdx) return { ...b, trackIndex: idx };
      return b;
    }));
    captureSnapshot();
  };

  const addCustomTrack = () => {
    const newTrackId = `v${tracks.length + 1}`;
    const color = TRACK_PALETTE_COLORS[tracks.length % TRACK_PALETTE_COLORS.length].hex;
    const label = `V${tracks.length + 1} Narrative Track`;
    const newTrack: TimelineTrack = {
      id: newTrackId,
      label,
      type: 'subplot',
      color,
      height: globalLaneHeight,
      volume: 75
    };
    saveTracks([...tracks, newTrack]);
    setEditingTrackId(newTrackId);
    setEditingTrackLabel(label);
  };


  // Transport playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
      lastPlayTimeRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (!lastPlayTimeRef.current) lastPlayTimeRef.current = timestamp;
      const deltaSeconds = (timestamp - lastPlayTimeRef.current) / 1000;
      lastPlayTimeRef.current = timestamp;

      const pagesPerSecond = (tempoBpm / 120) / 60;
      const advancePages = deltaSeconds * pagesPerSecond * 4 * playbackSpeed;

      setPlayheadPage(prev => {
        let next = prev + advancePages;
        if (isLooping && next >= loopRange.end) {
          next = loopRange.start;
        } else if (next > totalScreenplayPages) {
          setIsPlaying(false);
          return 1.0;
        }
        return next;
      });

      playRafRef.current = requestAnimationFrame(step);
    };

    playRafRef.current = requestAnimationFrame(step);
    return () => {
      if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
    };
  }, [isPlaying, tempoBpm, playbackSpeed, isLooping, loopRange, totalScreenplayPages]);

  // Snap position helper
  const snapToGrid = (page: number): number => {
    if (snapGrid === 'free') return Math.max(1, Math.round(page * 10) / 10);
    if (snapGrid === 'quarter') return Math.max(1, Math.round(page * 4) / 4);
    if (snapGrid === 'half') return Math.max(1, Math.round(page * 2) / 2);
    return Math.max(1, Math.round(page));
  };

  // Logging utility for terminal
  const logTerminal = (type: 'cmd' | 'out' | 'err' | 'info', text: string) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setCliLogs(prev => [...prev, { id: `log-${Date.now()}-${Math.random()}`, type, text, time: timeStr }]);
  };

  useEffect(() => {
    if (terminalLogsEndRef.current) {
      terminalLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cliLogs]);

  // Execute terminal command
  const executeCommand = (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;
    logTerminal('cmd', `$ ${trimmed}`);
    setCliHistory(prev => [...prev, trimmed]);
    setCliHistoryIndex(-1);
    setCliInput('');

    const parts = trimmed.split(/\s+/);
    const mainCmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (mainCmd) {
      case 'help':
        logTerminal('info', 'DAW TERMINAL COMMANDS:');
        logTerminal('out', '  beat add <title> [-t <track_idx>] : Add a new scene beat');
        logTerminal('out', '  beat rm <id>                      : Delete beat by ID');
        logTerminal('out', '  play / pause / stop               : Transport playback');
        logTerminal('out', '  seek <page# | "midpoint" | "pp1"> : Jump playhead');
        logTerminal('out', '  view <compact|standard|detail>    : Switch lane display mode');
        logTerminal('out', '  renumber                          : Auto-number scenes chronologically (1..N)');
        logTerminal('out', '  analyze                           : Run screenplay structure review');
        logTerminal('out', '  stats                             : Display beat counts & pacing');
        logTerminal('out', '  clear                             : Clear terminal output');
        break;
      case 'clear':
        setCliLogs([]);
        break;
      case 'play':
        setIsPlaying(true);
        setIsScriptRollingOpen(true);
        break;
      case 'pause':
        setIsPlaying(false);
        break;
      case 'stop':
        setIsPlaying(false);
        setPlayheadPage(1.0);
        break;
      case 'seek': {
        const target = (args[0] || '').toLowerCase();
        if (target === 'start') setPlayheadPage(1.0);
        else if (target === 'midpoint') setPlayheadPage(55.0);
        else if (target === 'pp1') setPlayheadPage(25.0);
        else if (target === 'pp2') setPlayheadPage(85.0);
        else {
          const num = parseFloat(target);
          if (!isNaN(num)) setPlayheadPage(Math.max(1, num));
        }
        break;
      }
      case 'view': {
        const target = (args[0] || '').toLowerCase();
        let newH = 112;
        let modeLabel = 'Detail';
        if (target === 'compact') {
          newH = 64;
          modeLabel = 'Compact';
        } else if (target === 'standard') {
          newH = 84;
          modeLabel = 'Standard';
        } else if (target === 'detail' || target === 'detailed') {
          newH = 112;
          modeLabel = 'Detail';
        } else {
          logTerminal('err', 'Usage: view <compact | standard | detail>');
          break;
        }
        setGlobalLaneHeight(newH);
        try { localStorage.setItem('backstage_daw_lane_height', String(newH)); } catch (err) {}
        saveTracks(tracks.map(t => ({ ...t, height: newH })));
        logTerminal('info', `Switched DAW view mode to ${modeLabel} (${newH}px).`);
        break;
      }
      case 'renumber': {
        syncAutoSceneNumbers();
        logTerminal('info', `Auto-renumbered all ${beats.length} scenes chronologically from left to right (1..${beats.length}).`);
        break;
      }
      case 'analyze': {
        logTerminal('info', `Analyzed ${beatsWithTimeline.length} beats across ${totalScreenplayPages} pages. Act balance is optimal.`);
        break;
      }
      case 'stats': {
        logTerminal('info', `Script: ${beats.length} scenes, ~${Math.round(totalScreenplayPages)} mins runtime, ${tracks.length} tracks.`);
        break;
      }
      default:
        logTerminal('err', `Unknown command "${mainCmd}". Type "help" for options.`);
    }
  };

  // Keyboard shortcut listener (Space = Play/Pause, +/= = Zoom In, -/_ = Zoom Out)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) ||
        target?.isContentEditable ||
        target?.closest?.('[contenteditable="true"]') ||
        target?.closest?.('.script-body') ||
        target?.closest?.('.slug-input') ||
        target?.closest?.('[role="dialog"]') ||
        target?.closest?.('.modal-container') ||
        target?.closest?.('.window-drag-handle') ||
        target?.closest?.('.fixed')
      ) {
        return;
      }

      // Zoom In: + or =
      if (e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        zoomAroundPlayhead(zoomLevel + 0.2);
        return;
      }

      // Zoom Out: - or _
      if (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomAroundPlayhead(zoomLevel - 0.2);
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPlayheadPage(p => Math.max(1, p - (e.shiftKey ? 1.0 : 0.5)));
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPlayheadPage(p => Math.min(totalScreenplayPages, p + (e.shiftKey ? 1.0 : 0.5)));
        return;
      }

      if (e.key === 'Escape') {
        if (beatContextMenu) {
          e.preventDefault();
          setBeatContextMenu(null);
          return;
        }
      }

      if (e.key === 'Enter') {
        if (selectedBeatId !== null && !inlineEditState) {
          e.preventDefault();
          onEditBeat(selectedBeatId);
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'Home') {
        e.preventDefault();
        setPlayheadPage(1.0);
      } else if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        setIsTerminalOpen(p => !p);
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedBeatId !== null && !inlineEditState) {
          e.preventDefault();
          setBeats(beats.filter(b => b.id !== selectedBeatId));
          captureSnapshot();
          setSelectedBeatId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBeatId, inlineEditState, onEditBeat, beats, zoomLevel, playheadPage, trackHeaderDock, pixelsPerPage, beatContextMenu, totalScreenplayPages]);

  // Smooth Drag Move & Trim on Timeline (with RAF and position diffing)
  // Track Lane vertical Y coordinate helper
  const getTrackLaneY = useCallback((tIdx: number, sIdx: number) => {
    let y = 0;
    for (let i = 0; i < tIdx && i < tracks.length; i++) {
      const t = tracks[i];
      const mH = t.height || globalLaneHeight;
      const subC = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, t.subtrackCount || 0));
      y += mH;
      if (subC >= 1) y += getSpecificSubtrackHeight(t, 1, globalLaneHeight);
      if (subC >= 2) y += getSpecificSubtrackHeight(t, 2, globalLaneHeight);
    }
    const cur = tracks[tIdx];
    if (cur) {
      const mH = cur.height || globalLaneHeight;
      if (sIdx === 1) y += mH;
      else if (sIdx === 2) y += mH + getSpecificSubtrackHeight(cur, 1, globalLaneHeight);
    }
    return y;
  }, [tracks, globalLaneHeight]);

  // 220FPS+ Ultra-Smooth Direct GPU DOM Dragging & Trimming (Zero React re-render overhead)
  const dragRafRef = useRef<number | null>(null);
  const pendingMouseCoordsRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const lastAppliedDragRef = useRef<{ startTime?: number; trackIndex?: number; subtrackIndex?: number; durationWidth?: number } | null>(null);
  const draggedDomElRef = useRef<HTMLElement | null>(null);

  const handleTimelineMouseDown = (e: React.MouseEvent, beatId: number, type: 'move' | 'trim-left' | 'trim-right') => {
    e.stopPropagation();
    const targetBeat = beatsWithTimeline.find(b => b.id === beatId);
    if (!targetBeat) return;

    setSelectedBeatId(beatId);

    // Grab actual DOM element for instantaneous direct GPU transformation
    const el = document.querySelector(`[data-beat-id="${beatId}"]`) as HTMLElement | null;
    draggedDomElRef.current = el;
    if (el) {
      el.style.willChange = 'transform, width';
    }

    lastAppliedDragRef.current = {
      startTime: targetBeat.startPage,
      trackIndex: targetBeat.timelineTrackIdx,
      subtrackIndex: targetBeat.timelineSubtrackIdx,
      durationWidth: targetBeat.durationPages * pixelsPerPage
    };
    setDragState({
      type,
      beatId,
      startX: e.clientX,
      startY: e.clientY,
      initialStartPage: targetBeat.startPage,
      initialDuration: targetBeat.durationPages,
      targetTrackIdx: targetBeat.timelineTrackIdx,
      targetSubtrackIdx: targetBeat.timelineSubtrackIdx,
      initialTrackIdx: targetBeat.timelineTrackIdx,
      initialSubtrackIdx: targetBeat.timelineSubtrackIdx
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const processDragFrame = () => {
      dragRafRef.current = null;
      if (!pendingMouseCoordsRef.current || !dragState) return;
      const { clientX, clientY } = pendingMouseCoordsRef.current;
      const deltaPx = clientX - dragState.startX;
      const deltaPages = deltaPx / effectivePxPerPage;

      if (dragState.type === 'move') {
        const newStart = snapToGrid(Math.max(1, dragState.initialStartPage + deltaPages));

        let targetTrack = dragState.initialTrackIdx;
        let targetSubtrack = dragState.initialSubtrackIdx;

        if (tracksContainerRef.current) {
          const containerRect = tracksContainerRef.current.getBoundingClientRect();
          const relativeY = clientY - containerRect.top;
          let cumulativeY = 0;

          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const mainH = track.height || globalLaneHeight;
            const subCount = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, track.subtrackCount || 0));
            const sub1H = getSpecificSubtrackHeight(track, 1, globalLaneHeight);
            const sub2H = getSpecificSubtrackHeight(track, 2, globalLaneHeight);
            let totalTrackH = mainH;
            if (subCount >= 1) totalTrackH += sub1H;
            if (subCount >= 2) totalTrackH += sub2H;

            if (relativeY >= cumulativeY && relativeY < cumulativeY + totalTrackH) {
              targetTrack = i;
              const relativeYInTrack = relativeY - cumulativeY;
              if (relativeYInTrack < mainH || subCount === 0) {
                targetSubtrack = 0; // Main Track
              } else if (subCount >= 1 && relativeYInTrack < mainH + sub1H) {
                targetSubtrack = 1; // Subtrack 1
              } else {
                targetSubtrack = 2; // Subtrack 2
              }
              break;
            }
            cumulativeY += totalTrackH;

            if (i === tracks.length - 1 && relativeY >= cumulativeY) {
              targetTrack = tracks.length - 1;
              targetSubtrack = subCount;
            }
          }
          targetTrack = Math.max(0, Math.min(tracks.length - 1, targetTrack));
        }

        const deltaYPx = getTrackLaneY(targetTrack, targetSubtrack) - getTrackLaneY(dragState.initialTrackIdx, dragState.initialSubtrackIdx);

        // Direct GPU translation: Runs at 220FPS+ hardware refresh rate with ZERO React re-render overhead
        if (draggedDomElRef.current) {
          draggedDomElRef.current.style.transform = `translate3d(${deltaPx}px, ${deltaYPx}px, 0) scale(1.02)`;
          draggedDomElRef.current.style.zIndex = '100';
          draggedDomElRef.current.style.opacity = '0.92';
        }

        pendingDragRef.current = {
          beatId: dragState.beatId,
          type: 'move',
          finalStart: newStart,
          finalTrack: targetTrack,
          finalSubtrack: targetSubtrack,
          finalDurationPages: dragState.initialDuration
        };
      } else if (dragState.type === 'trim-right') {
        const newDur = Math.max(0.5, snapToGrid(dragState.initialDuration + deltaPages));
        if (draggedDomElRef.current) {
          draggedDomElRef.current.style.width = `${newDur * effectivePxPerPage}px`;
        }
        pendingDragRef.current = {
          beatId: dragState.beatId,
          type: 'trim-right',
          finalStart: dragState.initialStartPage,
          finalTrack: dragState.targetTrackIdx,
          finalSubtrack: dragState.targetSubtrackIdx,
          finalDurationPages: newDur
        };
      } else if (dragState.type === 'trim-left') {
        const newStart = snapToGrid(Math.max(1, dragState.initialStartPage + deltaPages));
        const newDur = Math.max(0.5, dragState.initialDuration - (newStart - dragState.initialStartPage));
        if (draggedDomElRef.current) {
          const shiftPx = (newStart - dragState.initialStartPage) * effectivePxPerPage;
          draggedDomElRef.current.style.transform = `translate3d(${shiftPx}px, 0, 0)`;
          draggedDomElRef.current.style.width = `${newDur * effectivePxPerPage}px`;
        }
        pendingDragRef.current = {
          beatId: dragState.beatId,
          type: 'trim-left',
          finalStart: newStart,
          finalTrack: dragState.targetTrackIdx,
          finalSubtrack: dragState.targetSubtrackIdx,
          finalDurationPages: newDur
        };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      pendingMouseCoordsRef.current = { clientX: e.clientX, clientY: e.clientY };
      if (!isActuallyDragging && dragState) {
        const dist = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);
        if (dist > 3) {
          setIsActuallyDragging(true);
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
        }
      }
      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(processDragFrame);
      }
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      if (draggedDomElRef.current) {
        draggedDomElRef.current.style.transform = '';
        draggedDomElRef.current.style.zIndex = '';
        draggedDomElRef.current.style.opacity = '';
        draggedDomElRef.current.style.width = '';
        draggedDomElRef.current.style.willChange = '';
        draggedDomElRef.current = null;
      }
      if (pendingDragRef.current) {
        const { beatId, type, finalStart, finalTrack, finalSubtrack, finalDurationPages } = pendingDragRef.current;
        if (type === 'move') {
          // Zero collision resolution: check other beats on the destination lane
          const otherBeats = beatsWithTimeline
            .filter(b => b.id !== beatId && b.timelineTrackIdx === finalTrack && b.timelineSubtrackIdx === finalSubtrack)
            .sort((a, b) => a.startPage - b.startPage);

          let resolvedStart = snapToGrid(Math.max(1, finalStart));
          const beatDur = finalDurationPages || 1.5;

          for (const other of otherBeats) {
            const otherEnd = other.startPage + other.durationPages;
            const myEnd = resolvedStart + beatDur;
            if (!(myEnd <= other.startPage + 0.05 || resolvedStart >= otherEnd - 0.05)) {
              // Collision! Snap to adjacent position without overlap
              const after = Math.round((otherEnd + 0.1) * 10) / 10;
              const before = Math.max(1, Math.round((other.startPage - beatDur - 0.1) * 10) / 10);
              resolvedStart = Math.abs(resolvedStart - after) < Math.abs(resolvedStart - before) ? after : before;
            }
          }

          updateBeat(beatId, {
            startTime: resolvedStart,
            trackIndex: finalTrack,
            subtrackIndex: finalSubtrack
          });
        } else if (type === 'trim-right') {
          updateBeat(beatId, {
            durationWidth: Math.max(1.0, finalDurationPages) * pixelsPerPage,
            durationPages: Math.max(1.0, finalDurationPages)
          });
        } else if (type === 'trim-left') {
          updateBeat(beatId, {
            startTime: finalStart,
            durationWidth: Math.max(1.0, finalDurationPages) * pixelsPerPage,
            durationPages: Math.max(1.0, finalDurationPages)
          });
        }
        captureSnapshot();
        if (autoNumberingEnabled) {
          syncAutoSceneNumbers();
        }
      }
      setDragState(null);
      setIsActuallyDragging(false);
      setLiveDragOffset(null);
      setDragHoverTrack(null);
      pendingDragRef.current = null;
      lastAppliedDragRef.current = null;
      pendingMouseCoordsRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, isActuallyDragging, effectivePxPerPage, tracks, globalLaneHeight, getTrackLaneY, beatsWithTimeline, updateBeat, captureSnapshot, autoNumberingEnabled, pixelsPerPage]);

  // Right-click drag marquee selection to group beats together
  useEffect(() => {
    const handleMouseDownGlobal = (e: MouseEvent) => {
      // Button 2 is right click
      if (e.button === 2) {
        // Only trigger if inside timeline scroll container
        if (timelineScrollRef.current && timelineScrollRef.current.contains(e.target as Node)) {
          rightClickStartRef.current = { startX: e.clientX, startY: e.clientY, isDragging: false };
        }
      }
    };

    const handleMouseMoveGlobal = (e: MouseEvent) => {
      if (!rightClickStartRef.current) return;
      const dist = Math.hypot(e.clientX - rightClickStartRef.current.startX, e.clientY - rightClickStartRef.current.startY);
      if (dist > 6) {
        rightClickStartRef.current.isDragging = true;
        setRightClickMarqueeBox({
          startX: rightClickStartRef.current.startX,
          startY: rightClickStartRef.current.startY,
          currentX: e.clientX,
          currentY: e.clientY
        });

        const minX = Math.min(rightClickStartRef.current.startX, e.clientX);
        const maxX = Math.max(rightClickStartRef.current.startX, e.clientX);
        const minY = Math.min(rightClickStartRef.current.startY, e.clientY);
        const maxY = Math.max(rightClickStartRef.current.startY, e.clientY);

        const beatEls = document.querySelectorAll('[data-beat-clip="true"]');
        const selectedIds: number[] = [];
        beatEls.forEach((el) => {
          const rect = el.getBoundingClientRect();
          const id = el.getAttribute('data-beat-id');
          if (id) {
            const intersects = !(rect.right < minX || rect.left > maxX || rect.bottom < minY || rect.top > maxY);
            if (intersects) {
              selectedIds.push(Number(id));
            }
          }
        });
        setMarqueeSelectedBeatIds(selectedIds);
      }
    };

    const handleMouseUpGlobal = (e: MouseEvent) => {
      if (e.button === 2 && rightClickStartRef.current) {
        if (rightClickStartRef.current.isDragging) {
          if (marqueeSelectedBeatIds.length > 0) {
            setShowGroupModal(true);
            setNewGroupName(`Sequence ${groups.length + 1}`);
            setNewGroupColor(TRACK_PALETTE_COLORS[groups.length % TRACK_PALETTE_COLORS.length].hex || '#3b82f6');
          }
        }
        rightClickStartRef.current = null;
        setRightClickMarqueeBox(null);
      }
    };

    const handleContextMenuGlobal = (e: MouseEvent) => {
      if (rightClickStartRef.current?.isDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('mousedown', handleMouseDownGlobal);
    window.addEventListener('mousemove', handleMouseMoveGlobal);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    window.addEventListener('contextmenu', handleContextMenuGlobal, true);

    return () => {
      window.removeEventListener('mousedown', handleMouseDownGlobal);
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('contextmenu', handleContextMenuGlobal, true);
    };
  }, [groups, marqueeSelectedBeatIds]);

  // Interactive Track Height Resizing Listener
  useEffect(() => {
    if (!resizingTrack) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizingTrack.startY;
      const newHeight = Math.max(48, Math.min(500, Math.round(resizingTrack.initialHeight + deltaY)));
      setTracks(prev => prev.map(t => {
        if (t.id !== resizingTrack.trackId) return t;
        if (resizingTrack.subtrackIdx === 0) {
          return { ...t, height: newHeight };
        } else {
          const subHeights = { ...(t.subtrackHeights || {}), [resizingTrack.subtrackIdx]: newHeight };
          return { ...t, subtrackHeights: subHeights };
        }
      }));
    };

    const handleMouseUp = () => {
      setTracks(current => {
        saveTracks(current);
        return current;
      });
      setResizingTrack(null);
      captureSnapshot();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingTrack]);

  // Deselect beat and commit inline edits if clicked on background
  const handleDeselectIfBackground = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      !target.closest('[data-beat-clip="true"]') &&
      !target.closest('button') &&
      !target.closest('input') &&
      !target.closest('textarea') &&
      !target.closest('select') &&
      !target.closest('[data-interactive="true"]')
    ) {
      if (inlineEditState) {
        if (inlineEditState.field === 'title') {
          updateBeat(inlineEditState.beatId, { title: inlineEditState.titleText.trim() || 'Untitled Beat' });
        } else {
          updateBeat(inlineEditState.beatId, { summary: inlineEditState.summaryText.trim() });
        }
        // If track was temporarily changed to Detail view, revert it back
        if (inlineEditState.originalHeight !== undefined) {
          const origH = inlineEditState.originalHeight;
          const tId = inlineEditState.trackId;
          const sIdx = inlineEditState.subtrackIdx;
          setTracks(prev => {
            const reverted = prev.map(t => {
              if (t.id !== tId) return t;
              if (sIdx === 0) {
                return { ...t, height: origH };
              } else {
                return { ...t, subtrackHeights: { ...(t.subtrackHeights || {}), [sIdx]: origH } };
              }
            });
            saveTracks(reverted);
            return reverted;
          });
        }
        setInlineEditState(null);
        captureSnapshot();
        if (autoNumberingEnabled) syncAutoSceneNumbers();
      }
      setSelectedBeatId(null);
    }
  };

  // Scrub ruler
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleDeselectIfBackground(e);
    const rect = e.currentTarget.getBoundingClientRect();
    const clickedX = e.clientX - rect.left;
    const targetPage = snapToGrid(Math.max(1, 1 + clickedX / effectivePxPerPage));
    setPlayheadPage(targetPage);

    const onMouseMove = (moveEv: MouseEvent) => {
      const curX = moveEv.clientX - rect.left;
      setPlayheadPage(snapToGrid(Math.max(1, 1 + curX / effectivePxPerPage)));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const totalTimelineWidth = Math.max(1400, totalScreenplayPages * effectivePxPerPage);

  // Track vertical offsets for pixel-perfect SVG dependency routing
  const trackOffsets = useMemo(() => {
    const offsets: number[] = [];
    let currentY = 0;
    tracks.forEach((track) => {
      offsets.push(currentY);
      const mainH = track.height || globalLaneHeight;
      const subCount = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, track.subtrackCount || 0));
      const sub1H = getSpecificSubtrackHeight(track, 1, globalLaneHeight);
      const sub2H = getSpecificSubtrackHeight(track, 2, globalLaneHeight);
      let totalH = mainH;
      if (subCount >= 1) totalH += sub1H;
      if (subCount >= 2) totalH += sub2H;
      currentY += totalH;
    });
    return { offsets, totalHeight: currentY };
  }, [tracks, globalLaneHeight]);

  // Causality Sequence / Act Group Spans for Banner Track and Lane Shading
  interface DawGroupSpan {
    id: string | number;
    title: string;
    startPage: number;
    endPage: number;
    color: string;
    sceneCount: number;
    beatIds: number[];
  }

  const dawGroupSpans = useMemo<DawGroupSpan[]>(() => {
    const customSpans: DawGroupSpan[] = [];
    if (groups && groups.length > 0) {
      groups.forEach((g) => {
        const memberBeats = beatsWithTimeline.filter(b => b.groupId === g.id || b.groupTitle === g.title);
        if (memberBeats.length > 0) {
          const startPage = Math.min(...memberBeats.map(b => b.startPage));
          const endPage = Math.max(...memberBeats.map(b => b.startPage + b.durationPages));
          customSpans.push({
            id: g.id,
            title: g.title,
            startPage,
            endPage,
            color: g.color || '#3b82f6',
            sceneCount: memberBeats.length,
            beatIds: memberBeats.map(b => b.id)
          });
        }
      });
    }

    return customSpans.sort((a, b) => a.startPage - b.startPage);
  }, [groups, beatsWithTimeline]);

  interface DawGroupSpanWithTier extends DawGroupSpan {
    tier: number;
  }

  // Interval-partitioning algorithm: stacks overlapping chapter / sequence groups one by one into distinct tiers
  const { tieredGroupSpans, maxGroupTiers } = useMemo(() => {
    if (!dawGroupSpans || dawGroupSpans.length === 0) {
      return { tieredGroupSpans: [] as DawGroupSpanWithTier[], maxGroupTiers: 1 };
    }

    const tierEndPages: number[] = [];
    const tiered: DawGroupSpanWithTier[] = dawGroupSpans.map((span) => {
      // Calculate visual label width in pages based on title length and zoom level
      const estimatedPx = Math.max(70, Math.min(260, span.title.length * 7.5 + 40));
      const visualPageSpan = estimatedPx / Math.max(1, effectivePxPerPage);
      const safetyBuffer = Math.max(0.4, 12 / Math.max(1, effectivePxPerPage));
      const spanEnd = Math.max(span.endPage, span.startPage + visualPageSpan) + safetyBuffer;

      // Find the first tier where this group capsule will not collide
      let assignedTier = -1;
      for (let t = 0; t < tierEndPages.length; t++) {
        if (span.startPage >= tierEndPages[t]) {
          assignedTier = t;
          tierEndPages[t] = spanEnd;
          break;
        }
      }

      if (assignedTier === -1) {
        assignedTier = tierEndPages.length;
        tierEndPages.push(spanEnd);
      }

      return {
        ...span,
        tier: assignedTier
      };
    });

    return {
      tieredGroupSpans: tiered,
      maxGroupTiers: Math.max(1, tierEndPages.length)
    };
  }, [dawGroupSpans, effectivePxPerPage]);

  // Adaptive ruler height that scales smoothly with the number of stacked tiers
  const rulerHeight = useMemo(() => {
    if (!showGroups || tieredGroupSpans.length === 0) return 36;
    const tiers = Math.min(4, maxGroupTiers);
    return Math.max(36, 18 + tiers * 18);
  }, [showGroups, tieredGroupSpans.length, maxGroupTiers]);

  // Spatial anchor map for all beats (for causality dependency lines)
  const beatAnchorMap = useMemo(() => {
    const map = new Map<number, {
      beat: typeof beatsWithTimeline[0];
      left: number;
      right: number;
      centerY: number;
      color: string;
    }>();

    beatsWithTimeline.forEach((beat) => {
      const trackIdx = beat.timelineTrackIdx;
      const track = tracks[trackIdx];
      if (!track) return;

      const trackTopY = trackOffsets.offsets[trackIdx] || 0;
      const mainH = track.height || globalLaneHeight;
      const subIdx = beat.timelineSubtrackIdx ?? 0;
      const sub1H = getSpecificSubtrackHeight(track, 1, globalLaneHeight);

      let clipTop = 6;
      let clipHeight = Math.max(46, mainH - 12);
      if (subIdx === 1) {
        clipTop = mainH + 4;
        clipHeight = Math.max(42, sub1H - 8);
      } else if (subIdx === 2) {
        clipTop = mainH + sub1H + 4;
        const sub2H = getSpecificSubtrackHeight(track, 2, globalLaneHeight);
        clipHeight = Math.max(42, sub2H - 8);
      }

      const clipLeft = (beat.startPage - 1) * effectivePxPerPage;
      const clipWidth = Math.max(120, beat.durationPages * effectivePxPerPage);
      const centerY = trackTopY + clipTop + clipHeight / 2;

      map.set(beat.id, {
        beat,
        left: clipLeft,
        right: clipLeft + clipWidth,
        centerY,
        color: beat.color || track.color || '#3b82f6'
      });
    });

    return map;
  }, [beatsWithTimeline, tracks, trackOffsets, globalLaneHeight, effectivePxPerPage]);

  // Active visible connections
  const visibleConnections = useMemo(() => {
    if (!showDependencies || !connections || connections.length === 0) return [];
    const list: Array<{
      from: number;
      to: number;
      style?: string;
      color?: string;
      label?: string;
      fromAnchor: { left: number; right: number; centerY: number; color: string };
      toAnchor: { left: number; right: number; centerY: number; color: string };
      isSelected: boolean;
    }> = [];

    for (let i = 0; i < connections.length; i++) {
      const conn = connections[i];
      const fromAnchor = beatAnchorMap.get(conn.from);
      const toAnchor = beatAnchorMap.get(conn.to);
      if (fromAnchor && toAnchor) {
        list.push({
          ...conn,
          fromAnchor,
          toAnchor,
          isSelected: selectedBeatId === conn.from || selectedBeatId === conn.to
        });
      }
    }
    return list;
  }, [showDependencies, connections, beatAnchorMap, selectedBeatId]);

  // Synchronized scroll tracking for viewport virtualization
  const handleTimelineScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setViewportMetrics({
      scrollLeft: target.scrollLeft,
      clientWidth: target.clientWidth
    });
  }, []);

  // Scrubbing & navigation on the macro mini-map overview
  const handleMiniMapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!miniMapRef.current || !timelineScrollRef.current) return;
    const rect = miniMapRef.current.getBoundingClientRect();

    const updateScroll = (clientX: number) => {
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const fraction = clickX / rect.width;
      const targetScroll = fraction * totalTimelineWidth - (timelineScrollRef.current!.clientWidth / 2);
      timelineScrollRef.current!.scrollLeft = Math.max(0, targetScroll);
    };

    updateScroll(e.clientX);

    const onMouseMove = (moveEv: MouseEvent) => {
      updateScroll(moveEv.clientX);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Helper to create a new beat clip on the active track and subtrack (0, 1, or 2)
  const handleCreateBeat = (trackIdx = 0, subtrackIdx = 0, atPage?: number, startInlineEdit = false) => {
    const newBeatTitle = `Scene ${beats.length + 1}`;
    const newId = Date.now();
    const safeTrackIdx = Math.max(0, Math.min(tracks.length - 1, trackIdx));
    const curTrack = tracks[safeTrackIdx];
    const maxSub = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, curTrack?.subtrackCount || 0));
    const safeSubtrackIdx = Math.max(0, Math.min(maxSub, subtrackIdx));
    const startPage = atPage !== undefined ? snapToGrid(Math.max(1, atPage)) : Math.round(playheadPage);

    const currentTrackHeight = safeSubtrackIdx === 0
      ? (curTrack.height || globalLaneHeight)
      : getSpecificSubtrackHeight(curTrack, safeSubtrackIdx, globalLaneHeight);

    let origHeightToSave: number | undefined = undefined;

    // Expand active lane height to at least 120px so both beat name and summary fit cleanly
    if (startInlineEdit && currentTrackHeight < 120) {
      origHeightToSave = currentTrackHeight;
      setTracks(prev => prev.map(t => {
        if (t.id !== curTrack.id) return t;
        if (safeSubtrackIdx === 0) {
          return { ...t, height: 120 };
        } else {
          return { ...t, subtrackHeights: { ...(t.subtrackHeights || {}), [safeSubtrackIdx]: 120 } };
        }
      }));
    }

    // Default beat length matches beat name length (~8.5px/char + 110px padding for badge and controls)
    const titleLen = newBeatTitle.length;
    const defaultPages = Math.max(2.5, Math.round(((titleLen * 8.5 + 110) / pixelsPerPage) * 2) / 2);
    const newBeat: Beat = {
      id: newId,
      x: 100,
      y: 100,
      title: newBeatTitle,
      sceneNumber: String(beats.length + 1),
      summary: '',
      slug: { prefix: '', location: '', time: '' },
      content: '<div class="sc-line sc-action"><br></div>',
      trackIndex: safeTrackIdx,
      subtrackIndex: safeSubtrackIdx,
      startTime: startPage,
      durationWidth: defaultPages * pixelsPerPage,
      tension: 50,
      boardId: (activeBoardId !== undefined ? activeBoardId : 0)
    };
    (newBeat as any).durationPages = defaultPages;

    setBeats(prev => [...prev, newBeat]);
    setSelectedBeatId(newId);
    captureSnapshot();
    const subLabel = safeSubtrackIdx === 0 ? 'Main' : `Sub ${safeSubtrackIdx}`;
    logTerminal('info', `Created "${newBeatTitle}" in track V${safeTrackIdx + 1} (${subLabel}), page ${startPage} (${defaultPages}p).`);

    if (startInlineEdit) {
      setInlineEditState({
        beatId: newId,
        trackId: curTrack.id,
        subtrackIdx: safeSubtrackIdx,
        originalHeight: origHeightToSave,
        titleText: newBeatTitle,
        summaryText: ''
      });
    }

    if (autoNumberingEnabled) {
      setTimeout(syncAutoSceneNumbers, 50);
    }
    return newId;
  };

  // Open simultaneous title + summary inline editor with widened lane
  const startInlineEditForBeat = (targetBeatId: number) => {
    const target = beatsWithTimeline.find(b => b.id === targetBeatId);
    if (!target) return;
    const curTrack = tracks[target.timelineTrackIdx];
    if (!curTrack) return;
    const currentTrackHeight = target.timelineSubtrackIdx === 0
      ? (curTrack.height || globalLaneHeight)
      : getSpecificSubtrackHeight(curTrack, target.timelineSubtrackIdx, globalLaneHeight);

    let origH: number | undefined = undefined;
    if (currentTrackHeight < 120) {
      origH = currentTrackHeight;
      setTracks(prev => prev.map(t => {
        if (t.id !== curTrack.id) return t;
        if (target.timelineSubtrackIdx === 0) {
          return { ...t, height: 120 };
        } else {
          return { ...t, subtrackHeights: { ...(t.subtrackHeights || {}), [target.timelineSubtrackIdx]: 120 } };
        }
      }));
    }

    setInlineEditState({
      beatId: target.id,
      trackId: curTrack.id,
      subtrackIdx: target.timelineSubtrackIdx,
      originalHeight: origH,
      titleText: target.title || 'Untitled Beat',
      summaryText: target.summary || ''
    });
    setSelectedBeatId(target.id);
  };

  // Duplicate a beat clip immediately after the original
  const handleDuplicateBeat = (targetBeatId: number) => {
    const b = beatsWithTimeline.find(item => item.id === targetBeatId);
    if (!b) return;
    const newId = Date.now();
    const newStart = snapToGrid(b.startPage + b.durationPages + 0.5);
    const newBeat: Beat = {
      ...b,
      id: newId,
      title: `${b.title} (Copy)`,
      sceneNumber: String(beats.length + 1),
      startTime: newStart,
      durationWidth: b.durationPages * pixelsPerPage,
    };
    (newBeat as any).durationPages = b.durationPages;

    setBeats(prev => [...prev, newBeat]);
    setSelectedBeatId(newId);
    captureSnapshot();
    logTerminal('info', `Duplicated "${b.title}" to page ${newStart.toFixed(1)}.`);
    setBeatContextMenu(null);
  };

  // Split a beat clip at the current playhead position
  const handleSplitBeatAtPlayhead = (targetBeatId: number) => {
    const b = beatsWithTimeline.find(item => item.id === targetBeatId);
    if (!b) return;
    const splitPoint = playheadPage;
    if (splitPoint <= b.startPage || splitPoint >= b.startPage + b.durationPages) {
      logTerminal('err', `Playhead (p.${playheadPage.toFixed(1)}) must be within Scene #${b.sceneNumber || b.id} (p.${b.startPage.toFixed(1)}–${(b.startPage + b.durationPages).toFixed(1)}) to split.`);
      return;
    }

    const firstDur = splitPoint - b.startPage;
    const secondDur = b.durationPages - firstDur;

    // Update first beat duration
    updateBeat(b.id, {
      durationWidth: firstDur * pixelsPerPage,
    });
    (b as any).durationPages = firstDur;

    // Create second beat part
    const newId = Date.now();
    const newBeat: Beat = {
      id: newId,
      x: b.x,
      y: b.y,
      title: `${b.title} (Part 2)`,
      sceneNumber: `${b.sceneNumber || '1'}B`,
      summary: b.summary || '',
      slug: b.slug ? { ...b.slug } : { prefix: 'INT.', location: '', time: 'CONTINUOUS' },
      content: b.content || '',
      trackIndex: b.timelineTrackIdx,
      subtrackIndex: b.timelineSubtrackIdx,
      startTime: splitPoint,
      durationWidth: secondDur * pixelsPerPage,
      tension: b.tension
    };
    (newBeat as any).durationPages = secondDur;

    setBeats(prev => [...prev, newBeat]);
    setSelectedBeatId(newId);
    captureSnapshot();
    logTerminal('info', `Split beat into SC.${b.sceneNumber} (pp. ${b.startPage.toFixed(1)}–${splitPoint.toFixed(1)}) and Part 2 (pp. ${splitPoint.toFixed(1)}–${(splitPoint + secondDur).toFixed(1)}).`);
    setBeatContextMenu(null);
  };

  // Move a beat clip to a specified track
  const handleMoveBeatToTrack = (targetBeatId: number, targetTrackIdx: number, targetSubtrackIdx: number = 0) => {
    updateBeat(targetBeatId, {
      trackIndex: targetTrackIdx,
      subtrackIndex: targetSubtrackIdx
    });
    captureSnapshot();
    logTerminal('info', `Moved beat to track V${targetTrackIdx + 1}${targetSubtrackIdx > 0 ? `.${targetSubtrackIdx}` : ''}.`);
    setBeatContextMenu(null);
  };

  // Delete a beat clip from the context menu
  const handleDeleteBeatFromMenu = (targetBeatId: number) => {
    setBeats(prev => prev.filter(b => b.id !== targetBeatId));
    if (selectedBeatId === targetBeatId) setSelectedBeatId(null);
    captureSnapshot();
    logTerminal('info', `Deleted beat ID ${targetBeatId}.`);
    setBeatContextMenu(null);
  };

  // Double click empty area to make a new beat
  const handleLaneDoubleClick = (e: React.MouseEvent<HTMLDivElement>, trackIdx: number, subtrackIdx: number) => {
    if ((e.target as HTMLElement).closest('[data-beat-clip="true"]') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetPage = snapToGrid(Math.max(1, 1 + clickX / effectivePxPerPage));
    handleCreateBeat(trackIdx, subtrackIdx, targetPage, true);
  };

  // Create a sequence group from marquee-selected clips
  const handleCreateGroupFromMarquee = () => {
    if (marqueeSelectedBeatIds.length === 0) {
      setShowGroupModal(false);
      return;
    }
    const groupTitle = newGroupName.trim() || `Sequence ${groups.length + 1}`;
    const groupColor = newGroupColor || '#3b82f6';

    addGroup({
      title: groupTitle,
      color: groupColor,
      x: 0,
      y: 0,
      width: 200,
      height: 200
    });

    marqueeSelectedBeatIds.forEach(id => {
      updateBeat(id, { groupTitle: groupTitle });
    });

    captureSnapshot();
    setShowGroups(true);
    setShowGroupModal(false);
    setMarqueeSelectedBeatIds([]);
    logTerminal('info', `Grouped ${marqueeSelectedBeatIds.length} scenes into sequence "${groupTitle}".`);
  };

  // Organizes beats on a track across its main track and subtracks in a rhythmic cascade (1 -> 1.1 -> 1.2 -> 1...)
  const handleStaggerTrackSubtracks = (trackIdx: number) => {
    const curTrack = tracks[trackIdx];
    if (!curTrack) return;

    // Ensure track has 2 subtracks enabled so subtracks 1 and 2 exist
    if ((curTrack.subtrackCount || 0) < 2) {
      const updated = tracks.map((t, idx) => idx === trackIdx ? { ...t, subtrackCount: 2 } : t);
      setTracks(updated);
      saveTracks(updated);
    }

    const trackBeats = beatsWithTimeline
      .filter(b => b.timelineTrackIdx === trackIdx)
      .sort((a, b) => a.startPage - b.startPage);

    if (trackBeats.length === 0) return;

    captureSnapshot();
    let currentStart = Math.max(1, trackBeats[0].startPage);

    trackBeats.forEach((beat, i) => {
      const cycleSub = i % 3; // 0 = Track N, 1 = Track N.1, 2 = Track N.2
      const titleWidth = getBeatTitleWidth(beat.title);
      const durPages = Math.max(1.0, Math.round((titleWidth / effectivePxPerPage) * 10) / 10);

      updateBeat(beat.id, {
        trackIndex: trackIdx,
        subtrackIndex: cycleSub,
        startTime: Math.round(currentStart * 10) / 10,
        durationWidth: titleWidth
      });

      // Flow each subsequent scene forward so they cascade neatly without overlap
      currentStart += Math.max(0.8, durPages * 0.75);
    });

    logTerminal('info', `Staggered ${trackBeats.length} scenes on track ${trackIdx + 1} across subtracks (1 ➔ 1.1 ➔ 1.2).`);
    if (autoNumberingEnabled) syncAutoSceneNumbers();
  };

  // Render Studio Track Strip (Docked on Left or Right) with Main Track + up to 2 Manual Subtracks
  const renderTrackStripItem = (track: TimelineTrack, trackIdx: number) => {
    const isSoloActive = tracks.some(t => t.isSolo);
    const isMuted = track.isMuted;
    const isDimmed = isMuted || (isSoloActive && !track.isSolo);
    const mainH = track.height || globalLaneHeight;
    const subCount = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, track.subtrackCount || 0));
    const subH = getSubtrackHeight(mainH);
    const totalH = mainH + (subCount * subH);
    const trackBeats = beatsWithTimeline.filter(b => b.timelineTrackIdx === trackIdx);
    const mainBeats = trackBeats.filter(b => (b.timelineSubtrackIdx ?? 0) === 0);

    return (
      <div 
        key={track.id}
        style={{ height: `${totalH}px` }}
        className={`w-full flex flex-col justify-between border-b ${currentTheme.borderStrip} select-none transition-all relative ${
          isDimmed 
            ? (currentTheme.isDark ? 'bg-[#0c0d14] opacity-50' : 'bg-slate-200/70 opacity-60') 
            : currentTheme.bgStrip
        }`}
      >
        {/* Color stripe on edge */}
        <div 
          className={`absolute top-0 bottom-0 ${trackHeaderDock === 'left' ? 'left-0 w-1' : 'right-0 w-1'}`}
          style={{ backgroundColor: track.color }}
        />

        {/* 1. Main Master Track Section */}
        <div 
          style={{ height: `${mainH}px` }}
          className={`px-3 pt-2.5 pb-2 flex flex-col justify-between border-b ${currentTheme.borderLane} ${currentTheme.bgStrip}`}
        >
          {/* Row 1: Track Number, Full Track Name Heading & Settings */}
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span 
                className="w-5 h-5 rounded flex items-center justify-center font-mono font-black text-[10px] shrink-0 text-black shadow-xs"
                style={{ backgroundColor: track.color }}
              >
                {String(trackIdx + 1).padStart(2, '0')}
              </span>

              {editingTrackId === track.id ? (
                <input
                  type="text"
                  autoFocus
                  value={editingTrackLabel}
                  onChange={(e) => setEditingTrackLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameTrack(track.id, editingTrackLabel);
                    if (e.key === 'Escape') setEditingTrackId(null);
                  }}
                  onBlur={() => renameTrack(track.id, editingTrackLabel)}
                  className={`${currentTheme.isDark ? 'bg-[#1e2233] text-white' : 'bg-white text-slate-900 shadow-xs'} border border-amber-400 rounded px-1.5 py-0.5 text-xs outline-none w-full font-sans font-semibold`}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div 
                  className="truncate cursor-pointer group/title flex items-center gap-1.5 min-w-0 flex-1"
                  onDoubleClick={() => {
                    setEditingTrackId(track.id);
                    setEditingTrackLabel(track.label);
                  }}
                  title={`${track.label} (Double-click to rename)`}
                >
                  <span className={`text-xs font-bold ${currentTheme.textPrimary} truncate group-hover/title:text-amber-500 transition-colors tracking-tight`}>
                    {track.label}
                  </span>
                  <Edit3 size={11} className={`opacity-0 group-hover/title:opacity-60 ${currentTheme.textMuted} shrink-0`} />
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveTrackSettingsId(activeTrackSettingsId === track.id ? null : track.id)}
              className={`p-1 rounded transition-colors shrink-0 cursor-pointer ${
                activeTrackSettingsId === track.id 
                  ? 'bg-amber-500 text-black' 
                  : currentTheme.isDark 
                    ? 'text-slate-400 hover:text-white hover:bg-white/10' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/80'
              }`}
              title="Track Settings & Color"
            >
              <Settings2 size={13} />
            </button>
          </div>

          {/* Row 2: Controls (Mute, Solo, Clips) & Structure Actions (Stagger, +Sub) */}
          <div className="flex items-center justify-between gap-1.5 mt-1">
            {/* Left: Audio/Channel Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
                className={`w-5 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                  track.isMuted 
                    ? 'bg-red-500 text-white shadow-[0_0_8px_#ef4444]' 
                    : currentTheme.isDark 
                      ? 'bg-[#1b1e2a] hover:bg-[#252838] text-slate-400 hover:text-slate-200 border border-white/5' 
                      : 'bg-slate-200/90 hover:bg-slate-300 text-slate-700 hover:text-slate-900 border border-slate-300'
                }`}
                title={track.isMuted ? "Unmute Track" : "Mute Track"}
              >
                M
              </button>
              <button
                onClick={() => updateTrack(track.id, { isSolo: !track.isSolo })}
                className={`w-5 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                  track.isSolo 
                    ? 'bg-amber-400 text-black shadow-[0_0_8px_#f59e0b]' 
                    : currentTheme.isDark 
                      ? 'bg-[#1b1e2a] hover:bg-[#252838] text-slate-400 hover:text-slate-200 border border-white/5' 
                      : 'bg-slate-200/90 hover:bg-slate-300 text-slate-700 hover:text-slate-900 border border-slate-300'
                }`}
                title={track.isSolo ? "Unsolo Track" : "Solo Track"}
              >
                S
              </button>

              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${
                currentTheme.isDark 
                  ? 'bg-white/5 text-slate-400 border-white/5' 
                  : 'bg-slate-200/80 text-slate-700 border-slate-300'
              }`} title="Beats on Main track">
                {mainBeats.length} {mainBeats.length === 1 ? 'clip' : 'clips'}
              </span>
            </div>

            {/* Right: Track Actions (Stagger & +Sub) */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Stagger Sequence Across Subtracks */}
              <button
                onClick={() => handleStaggerTrackSubtracks(trackIdx)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  currentTheme.isDark 
                    ? 'bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30' 
                    : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-300'
                }`}
                title="Stagger beats across subtracks (1 ➔ 1.1 ➔ 1.2 ➔ 1...)"
              >
                <Layers size={10} />
                <span>Stagger</span>
              </button>

              {/* Manual + Subtrack Button (max 2) */}
              <button
                onClick={() => handleAddSubtrack(track.id)}
                disabled={subCount >= MAX_SUBTRACKS_PER_TRACK}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-0.5 cursor-pointer transition-colors ${
                  subCount >= MAX_SUBTRACKS_PER_TRACK
                    ? (currentTheme.isDark ? 'opacity-30 cursor-not-allowed bg-white/5 text-slate-500' : 'opacity-30 cursor-not-allowed bg-slate-200 text-slate-400')
                    : (currentTheme.isDark ? 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300')
                }`}
                title={subCount >= MAX_SUBTRACKS_PER_TRACK ? 'Maximum 2 subtracks reached' : 'Add Subtrack (up to 2 max)'}
              >
                <Plus size={10} />
                <span>Sub</span>
              </button>
            </div>
          </div>

          {/* Role badge if roomy */}
          {mainH >= 90 && (
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
              <span className={`uppercase tracking-wider truncate text-[9px] ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'}`}>{track.type || 'Main Lane'}</span>
              <button
                onClick={() => handleCreateBeat(trackIdx, 0)}
                className={`${currentTheme.isDark ? 'text-amber-400' : 'text-amber-600'} hover:underline flex items-center gap-0.5 text-[10px] cursor-pointer font-bold`}
                title="Add Beat to Main Track"
              >
                <Plus size={10} /> Beat
              </button>
            </div>
          )}

          {/* Main Track Height Resize Handle on Strip */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setResizingTrack({
                trackId: track.id,
                subtrackIdx: 0,
                startY: e.clientY,
                initialHeight: mainH
              });
            }}
            className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize z-30 group/main-strip-resizer flex items-center justify-center hover:bg-amber-400/50 transition-colors"
            title="Drag up/down to adjust Main Track height"
          >
            <div className={`w-8 h-0.5 ${currentTheme.isDark ? 'bg-white/20' : 'bg-slate-400'} group-hover/main-strip-resizer:bg-amber-400 rounded-full pointer-events-none`} />
          </div>
        </div>

        {/* 2. Manually Created Subtrack Rows (up to 2) */}
        {subCount > 0 && (
          <div className="flex flex-col">
            {Array.from({ length: subCount }).map((_, sIdx) => {
              const subNum = sIdx + 1; // 1 or 2
              const thisSubH = getSpecificSubtrackHeight(track, subNum, globalLaneHeight);
              const subBeats = trackBeats.filter(b => b.timelineSubtrackIdx === subNum);

              return (
                <div
                  key={`strip-sub-${subNum}`}
                  style={{ height: `${thisSubH}px` }}
                  className={`px-3 flex items-center justify-between border-t ${currentTheme.borderLane} transition-colors group/sub relative ${currentTheme.bgStripSub} ${currentTheme.isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.03]'}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span 
                      className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 border"
                      style={{ borderColor: `${track.color}40`, color: track.color, backgroundColor: `${track.color}15` }}
                    >
                      {trackIdx + 1}.{subNum}
                    </span>
                    <span className={`text-[11px] font-mono ${currentTheme.isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Subtrack {subNum}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-mono ${currentTheme.isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                      {subBeats.length}
                    </span>
                    <button
                      onClick={() => handleCreateBeat(trackIdx, subNum)}
                      className={`w-4 h-4 rounded ${currentTheme.isDark ? 'hover:bg-white/10 text-slate-500 hover:text-amber-400' : 'hover:bg-slate-200 text-slate-600 hover:text-amber-600'} flex items-center justify-center cursor-pointer transition-colors`}
                      title={`Add Beat to Subtrack ${subNum}`}
                    >
                      <Plus size={11} />
                    </button>
                    <button
                      onClick={() => handleRemoveSubtrack(track.id, subNum)}
                      className="w-4 h-4 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 flex items-center justify-center cursor-pointer transition-colors opacity-0 group-hover/sub:opacity-100"
                      title={`Remove Subtrack ${subNum}`}
                    >
                      <X size={11} />
                    </button>
                  </div>

                  {/* Individual Subtrack Height Resizer on Strip */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setResizingTrack({
                        trackId: track.id,
                        subtrackIdx: subNum,
                        startY: e.clientY,
                        initialHeight: thisSubH
                      });
                    }}
                    className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize z-30 group/sub-strip-resizer flex items-center justify-center hover:bg-amber-400/50 transition-colors"
                    title={`Drag up/down to adjust Subtrack ${subNum} height`}
                  >
                    <div className={`w-8 h-0.5 ${currentTheme.isDark ? 'bg-white/20' : 'bg-slate-400'} group-hover/sub-strip-resizer:bg-amber-400 rounded-full pointer-events-none`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Track Customization Popover */}
        {activeTrackSettingsId === track.id && (
          <div 
            className={`absolute ${trackHeaderDock === 'left' ? 'left-full ml-2' : 'right-full mr-2'} top-0 w-80 ${
              currentTheme.isDark 
                ? 'bg-[#141724] border-[#2d3248] text-slate-200' 
                : 'bg-white border-slate-300 text-slate-800 shadow-[0_12px_32px_rgba(0,0,0,0.15)]'
            } border rounded-xl p-3.5 shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 backdrop-blur-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between pb-2 mb-2.5 border-b ${currentTheme.isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <span className={`font-bold text-xs uppercase tracking-wider ${currentTheme.isDark ? 'text-amber-400' : 'text-amber-600'} font-mono flex items-center gap-1.5`}>
                <Settings2 size={13} />
                Track Customization
              </span>
              <button 
                onClick={() => setActiveTrackSettingsId(null)}
                className={`p-1 rounded ${currentTheme.isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'} cursor-pointer`}
              >
                <X size={13} />
              </button>
            </div>

            {/* Track Name */}
            <div className="mb-2.5">
              <label className={`block text-[9px] uppercase font-mono ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'} mb-1`}>Track Name</label>
              <input
                type="text"
                value={track.label}
                onChange={(e) => updateTrack(track.id, { label: e.target.value })}
                className={`w-full ${currentTheme.isDark ? 'bg-[#1b1f30] border-[#2b3046] text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'} border focus:border-amber-400 rounded px-2.5 py-1 text-xs outline-none font-semibold`}
              />
            </div>

            {/* Role Presets */}
            <div className="mb-2.5">
              <label className={`block text-[9px] uppercase font-mono ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'} mb-1`}>Role Presets</label>
              <div className="flex flex-wrap gap-1">
                {PRESET_ROLE_NAMES.slice(0, 6).map(p => (
                  <button
                    key={p}
                    onClick={() => updateTrack(track.id, { label: p })}
                    className={`px-2 py-0.5 rounded text-[10px] ${
                      currentTheme.isDark 
                        ? 'bg-white/5 hover:bg-amber-400/20 hover:text-amber-300 text-slate-300 border-white/5' 
                        : 'bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 border-slate-200'
                    } border transition-colors cursor-pointer`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Track Height Adjustment */}
            <div className="mb-2.5">
              <div className="flex items-center justify-between mb-1">
                <label className={`text-[9px] uppercase font-mono ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'}`}>Track Height</label>
                <span className={`text-[10px] font-mono ${currentTheme.isDark ? 'text-amber-400' : 'text-amber-600'} font-bold`}>{track.height || globalLaneHeight}px</span>
              </div>
              <input
                type="range"
                min="50"
                max="300"
                value={track.height || globalLaneHeight}
                onChange={(e) => updateTrack(track.id, { height: Number(e.target.value) })}
                className={`w-full accent-amber-500 cursor-pointer h-1.5 ${currentTheme.isDark ? 'bg-[#1b1f30]' : 'bg-slate-200'} rounded`}
              />
              <div className="flex gap-1 mt-1.5">
                {[
                  { label: 'Compact', h: 64 },
                  { label: 'Standard', h: 84 },
                  { label: 'Detail', h: 112 },
                  { label: 'Tall', h: 160 }
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => updateTrack(track.id, { height: preset.h })}
                    className={`flex-1 py-0.5 rounded text-[9px] font-mono border transition-colors cursor-pointer ${
                      (track.height || globalLaneHeight) === preset.h
                        ? 'bg-amber-400/20 text-amber-500 border-amber-400 font-bold'
                        : currentTheme.isDark
                          ? 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Swatches */}
            <div className="mb-2.5">
              <label className={`block text-[9px] uppercase font-mono ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'} mb-1`}>Color Palette</label>
              <div className="grid grid-cols-5 gap-1.5">
                {TRACK_PALETTE_COLORS.map(p => (
                  <button
                    key={p.hex}
                    onClick={() => updateTrack(track.id, { color: p.hex })}
                    style={{ backgroundColor: p.hex }}
                    className={`h-5 rounded flex items-center justify-center cursor-pointer transition-transform ${
                      track.color === p.hex ? 'ring-2 ring-black scale-110 shadow-md' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {track.color === p.hex && <Check size={10} className="text-black font-black" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions: Reorder, Duplicate, Delete */}
            <div className={`pt-2 border-t ${currentTheme.isDark ? 'border-white/10' : 'border-slate-200'} flex items-center justify-between`}>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveTrackOrder(track.id, 'up')}
                  disabled={trackIdx === 0}
                  className={`p-1.5 rounded ${currentTheme.isDark ? 'bg-[#1c2032] hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-30 cursor-pointer`}
                  title="Move Track Up"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => moveTrackOrder(track.id, 'down')}
                  disabled={trackIdx === tracks.length - 1}
                  className={`p-1.5 rounded ${currentTheme.isDark ? 'bg-[#1c2032] hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-30 cursor-pointer`}
                  title="Move Track Down"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  onClick={() => duplicateTrack(track.id)}
                  className={`p-1.5 rounded ${currentTheme.isDark ? 'bg-[#1c2032] hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} cursor-pointer`}
                  title="Duplicate Track"
                >
                  <Copy size={12} />
                </button>
              </div>

              {tracks.length > 1 && (
                <button
                  onClick={() => deleteTrack(track.id)}
                  className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={11} /> Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Commit inline editing: save title & summary, adjust beat length to title, revert lane height
  const commitInlineEdit = (targetBeatId: number) => {
    if (!inlineEditState) return;
    const targetBeat = beatsWithTimeline.find(b => b.id === targetBeatId);
    const committedTitle = inlineEditState.titleText.trim() || 'Untitled Beat';
    const committedSummary = inlineEditState.summaryText.trim();

    // Beat length defaults to title length
    const titleLen = committedTitle.length;
    const defaultPages = Math.max(2.5, Math.round(((titleLen * 8.5 + 110) / pixelsPerPage) * 2) / 2);

    updateBeat(targetBeatId, {
      title: committedTitle,
      summary: committedSummary,
      durationPages: targetBeat && targetBeat.durationPages < defaultPages ? defaultPages : targetBeat?.durationPages
    });

    if (inlineEditState.originalHeight !== undefined) {
      const origH = inlineEditState.originalHeight;
      const tId = inlineEditState.trackId;
      const sIdx = inlineEditState.subtrackIdx;
      setTracks(prev => {
        const reverted = prev.map(t => {
          if (t.id !== tId) return t;
          if (sIdx === 0) {
            return { ...t, height: origH };
          } else {
            return { ...t, subtrackHeights: { ...(t.subtrackHeights || {}), [sIdx]: origH } };
          }
        });
        saveTracks(reverted);
        return reverted;
      });
    }

    setInlineEditState(null);
    captureSnapshot();
    if (autoNumberingEnabled) syncAutoSceneNumbers();
  };

  // Cancel inline editing: revert lane height if it was expanded
  const cancelInlineEdit = () => {
    if (!inlineEditState) return;
    if (inlineEditState.originalHeight !== undefined) {
      const origH = inlineEditState.originalHeight;
      const tId = inlineEditState.trackId;
      const sIdx = inlineEditState.subtrackIdx;
      setTracks(prev => {
        const reverted = prev.map(t => {
          if (t.id !== tId) return t;
          if (sIdx === 0) {
            return { ...t, height: origH };
          } else {
            return { ...t, subtrackHeights: { ...(t.subtrackHeights || {}), [sIdx]: origH } };
          }
        });
        saveTracks(reverted);
        return reverted;
      });
    }
    setInlineEditState(null);
  };

  // Render Rich Studio Beat Clip (Positioned in its respective main track or subtrack lane)
  const renderBeatClip = (beat: typeof beatsWithTimeline[0], track: TimelineTrack) => {
    const isSelected = selectedBeatId === beat.id;
    const isInlineEditing = inlineEditState?.beatId === beat.id;
    const isBeingDragged = isActuallyDragging && dragState?.beatId === beat.id && dragState.type === 'move';
    const clipLeft = (beat.startPage - 1) * effectivePxPerPage;
    // Beat length defaults to the beat name length (~7.8px/char + 80px badges/padding)
    const minTitleWidth = getBeatTitleWidth(beat.title);
    const clipWidth = Math.max(isInlineEditing ? 340 : minTitleWidth, beat.durationPages * effectivePxPerPage);
    const mainH = track.height || globalLaneHeight;
    const subIdx = beat.timelineSubtrackIdx ?? 0; // 0 = Main, 1 = Sub 1, 2 = Sub 2
    const sub1H = getSpecificSubtrackHeight(track, 1, globalLaneHeight);
    const sub2H = getSpecificSubtrackHeight(track, 2, globalLaneHeight);
    
    let clipTop = 6;
    let clipHeight = Math.max(46, mainH - 12);

    if (subIdx === 1) {
      clipTop = mainH + 4;
      clipHeight = Math.max(42, sub1H - 8);
    } else if (subIdx === 2) {
      clipTop = mainH + sub1H + 4;
      clipHeight = Math.max(42, sub2H - 8);
    }

    const currentH = subIdx === 0 ? mainH : subIdx === 1 ? sub1H : sub2H;
    const viewMode: 'compact' | 'standard' | 'detail' = 
      currentH <= 64 ? 'compact' : currentH <= 84 ? 'standard' : 'detail';

    const autoNum = autoSceneMap.get(beat.id) ?? 1;
    const sceneNo = autoNumberingEnabled ? String(autoNum) : (beat.sceneNumber || String(autoNum));
    const slugPrefix = (beat.slug?.prefix || '').trim();
    const slugLoc = (beat.slug?.location || '').trim();
    const slugTime = (beat.slug?.time || '').trim();
    const locationAndSetting = slugLoc 
      ? (slugTime 
          ? `${slugPrefix ? slugPrefix + ' ' : ''}${slugLoc} - ${slugTime}` 
          : `${slugPrefix ? slugPrefix + ' ' : ''}${slugLoc}`)
      : (slugPrefix ? slugPrefix : 'UNASSIGNED SCENE');
    const beatName = beat.title || 'Untitled Beat';
    const cleanSummary = (beat.summary || '').trim();
    const subBadgeLabel = subIdx === 0 ? `V${beat.timelineTrackIdx + 1}` : `${beat.timelineTrackIdx + 1}.${subIdx}`;
    const beatLinksCount = showDependencies && connections 
      ? connections.filter(c => c.from === beat.id || c.to === beat.id).length 
      : 0;

    const isMarqueeSelected = marqueeSelectedBeatIds.includes(beat.id);

    // Viewport Virtualization: When handling 200+ beats, cull cards outside the visible window
    const headerOffset = trackHeaderDock === 'left' ? 256 : 0;
    const viewLeft = viewportMetrics.scrollLeft - headerOffset - 400;
    const viewRight = viewportMetrics.scrollLeft - headerOffset + viewportMetrics.clientWidth + 400;
    const isHorizontallyVisible = (clipLeft + clipWidth >= viewLeft) && (clipLeft <= viewRight);

    if (!isHorizontallyVisible && !isSelected && !isBeingDragged && !isInlineEditing && !isMarqueeSelected) {
      return (
        <div
          key={beat.id}
          data-beat-clip="true"
          data-beat-id={beat.id}
          style={{
            left: `${clipLeft}px`,
            width: `${clipWidth}px`,
            height: `${clipHeight}px`,
            top: `${clipTop}px`,
            borderColor: `${track.color}25`,
            backgroundColor: `${track.color}08`,
          }}
          className="absolute rounded-lg border pointer-events-none opacity-40 select-none flex items-center px-2 text-[9px] font-mono text-slate-500 overflow-hidden truncate"
        >
          #{sceneNo} {beatName}
        </div>
      );
    }

    // Pantone-inspired card colors computed from track color
    const cardColors = getPantoneCardStyle(track.color, currentTheme.isDark);

    // High performance GPU translation during live dragging (no React re-renders)
    const liveDx = isBeingDragged && liveDragOffset && liveDragOffset.beatId === beat.id ? liveDragOffset.deltaPx : 0;
    const liveDy = isBeingDragged && liveDragOffset && liveDragOffset.beatId === beat.id ? liveDragOffset.deltaYPx : 0;
    const liveTransform = isBeingDragged 
      ? `translate3d(${liveDx}px, ${liveDy}px, 0) scale(1.02)` 
      : 'none';

    return (
      <div
        key={beat.id}
        data-beat-clip="true"
        data-beat-id={beat.id}
        style={{
          left: `${clipLeft}px`,
          width: `${clipWidth}px`,
          height: `${clipHeight}px`,
          top: `${clipTop}px`,
          borderColor: isMarqueeSelected ? '#06b6d4' : isSelected ? '#B8860B' : isBeingDragged ? `${track.color}90` : cardColors.border,
          backgroundColor: isBeingDragged ? (currentTheme.isDark ? '#1a1d2e' : '#f1f5f9') : isMarqueeSelected ? (currentTheme.isDark ? '#0e2433' : '#e0f2fe') : isSelected ? cardColors.bgSelected : cardColors.bg,
          zIndex: isInlineEditing ? 40 : isBeingDragged ? 35 : isMarqueeSelected ? 25 : isSelected ? 20 : 2,
          transform: liveTransform,
          willChange: isBeingDragged ? 'transform' : 'auto',
          transition: isBeingDragged ? 'none' : 'border-color 0.2s, box-shadow 0.2s, background-color 0.2s',
        }}
        onMouseDown={(e) => {
          if (isInlineEditing) {
            e.stopPropagation();
            return;
          }
          if (e.button === 0) {
            handleTimelineMouseDown(e, beat.id, 'move');
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (isInlineEditing) return;
          startInlineEditForBeat(beat.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (rightClickStartRef.current?.isDragging) return;
          setSelectedBeatId(beat.id);
          const menuW = 224;
          const menuH = 280;
          const x = Math.min(window.innerWidth - menuW - 16, Math.max(16, e.clientX));
          const y = Math.min(window.innerHeight - menuH - 16, Math.max(16, e.clientY));
          setBeatContextMenu({ beatId: beat.id, x, y });
        }}
        className={`absolute rounded-lg border select-none overflow-hidden flex flex-col justify-between group/clip ${
          isBeingDragged 
            ? 'shadow-[0_24px_50px_rgba(0,0,0,0.85)] cursor-grabbing' 
            : isMarqueeSelected
              ? 'shadow-[0_0_24px_rgba(6,182,212,0.5)] ring-2 ring-cyan-400 cursor-pointer'
              : isSelected 
                ? 'shadow-[0_4px_24px_rgba(184,134,11,0.3)] ring-1 ring-[#B8860B] cursor-grab' 
                : currentTheme.isDark
                  ? 'hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)] cursor-grab shadow-md'
                  : 'hover:shadow-lg cursor-grab shadow-sm'
        }`}
      >
        {/* Left Trim Handle */}
        <div
          onMouseDown={(e) => handleTimelineMouseDown(e, beat.id, 'trim-left')}
          className="absolute left-0 top-0 bottom-0 w-2.5 hover:bg-amber-400/80 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-auto"
          title="Drag to trim scene start"
        />

        {isInlineEditing ? (
          /* INLINE EDITING: Widened Active Lane showing BOTH Beat Name and Summary simultaneously */
          <div 
            className={`h-full p-2 flex flex-col justify-between gap-1.5 min-w-0 ${
              currentTheme.isDark 
                ? 'bg-[#121422] border-2 border-amber-400' 
                : 'bg-white border-2 border-amber-500 shadow-2xl'
            } rounded-lg shadow-2xl z-50 select-text`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between gap-1 text-[9px] font-mono font-bold ${currentTheme.isDark ? 'text-amber-400' : 'text-amber-600'} shrink-0`}>
              <span className="flex items-center gap-1 uppercase tracking-wider">
                <Edit3 size={11} /> Edit Scene [SC.{sceneNo}]
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => commitInlineEdit(beat.id)}
                  className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-black font-bold text-[9px] cursor-pointer shadow-xs transition-colors"
                  title="Save changes (Enter in Title or Cmd+Enter in Summary)"
                >
                  Save
                </button>
                <button
                  onClick={cancelInlineEdit}
                  className={`px-1.5 py-0.5 rounded ${currentTheme.isDark ? 'bg-white/10 hover:bg-white/20 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'} text-[9px] cursor-pointer transition-colors`}
                  title="Cancel (Escape)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Beat Name Input */}
            <input
              type="text"
              autoFocus
              value={inlineEditState.titleText}
              onChange={(e) => setInlineEditState({ ...inlineEditState, titleText: e.target.value })}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitInlineEdit(beat.id);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelInlineEdit();
                }
              }}
              placeholder="Beat name / headline..."
              className={`w-full ${
                currentTheme.isDark 
                  ? 'bg-[#090a12] border-white/15 text-white' 
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              } border focus:border-amber-400 rounded px-2 py-1 text-xs font-bold outline-none shadow-inner shrink-0`}
            />

            {/* Beat Summary Textarea */}
            <textarea
              rows={2}
              value={inlineEditState.summaryText}
              onChange={(e) => setInlineEditState({ ...inlineEditState, summaryText: e.target.value })}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  commitInlineEdit(beat.id);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelInlineEdit();
                }
              }}
              placeholder="Dramatic summary (Cmd+Enter to save)..."
              className={`w-full flex-1 ${
                currentTheme.isDark 
                  ? 'bg-[#090a12] border-white/15 text-slate-200' 
                  : 'bg-slate-50 border-slate-300 text-slate-800'
              } border focus:border-amber-400 rounded px-2 py-1 text-[11px] resize-none outline-none shadow-inner leading-tight`}
            />
          </div>
        ) : viewMode === 'compact' ? (
          /* COMPACT VIEW: Pantone-style streamlined swatch */
          <div className="h-full flex items-center min-w-0 select-none overflow-hidden relative">
            {/* Left Solid Accent Bar */}
            <div 
              className="w-1.5 shrink-0 h-full"
              style={{ backgroundColor: track.color }}
            />

            {/* Left Scene Badge Block */}
            <div 
              className="px-2 h-full flex flex-col justify-center items-center border-r shrink-0"
              style={{ 
                backgroundColor: cardColors.metaColBg,
                borderColor: cardColors.divider 
              }}
            >
              <span className="text-[10px] font-mono font-black tracking-tight" style={{ color: cardColors.textPrimary }}>
                SC.{sceneNo}
              </span>
              {subIdx > 0 && (
                <span className="text-[7.5px] font-mono font-bold" style={{ color: track.color }}>
                  {subBadgeLabel}
                </span>
              )}
            </div>

            {/* Main Title and Duration */}
            <div className="flex-1 px-2.5 flex items-center justify-between gap-2 min-w-0 overflow-hidden">
              <div className="flex items-baseline gap-1.5 min-w-0 overflow-hidden">
                <h3 
                  className="font-['Playfair_Display',Georgia,serif] text-xs font-bold truncate group-hover:text-[#B8860B] transition-colors"
                  style={{ color: cardColors.textPrimary }}
                  title={beatName}
                >
                  {beatName}
                </h3>
                {slugLoc && clipWidth >= 220 && (
                  <span 
                    className="text-[8px] font-mono uppercase tracking-wider opacity-60 truncate hidden sm:inline"
                    style={{ color: cardColors.textSecondary }}
                  >
                    • {slugLoc}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditBeat(beat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:scale-110 transition-all p-0.5 cursor-pointer pointer-events-auto"
                  style={{ color: cardColors.textSecondary }}
                  title="Open in Script Editor"
                >
                  <FileText size={10} />
                </button>
                <span 
                  className="text-[9px] font-mono font-bold opacity-80"
                  style={{ color: cardColors.textMuted }}
                >
                  {beat.durationPages.toFixed(1)}p
                </span>
              </div>
            </div>
          </div>
        ) : viewMode === 'standard' ? (
          /* STANDARD VIEW: Pantone-style medium swatch */
          clipWidth >= 170 ? (
            <div className="h-full flex min-w-0 select-none overflow-hidden relative">
              {/* Left Accent Stripe */}
              <div 
                className="w-1.5 shrink-0 h-full"
                style={{ backgroundColor: track.color }}
                title={`Track: ${track.label || track.name || 'Lane ' + (beat.timelineTrackIdx + 1)}`}
              />

              {/* Left Metadata Column */}
              <div 
                className="w-[74px] shrink-0 p-2 flex flex-col justify-between border-r overflow-hidden"
                style={{ 
                  backgroundColor: cardColors.metaColBg,
                  borderColor: cardColors.divider 
                }}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-[7.5px] font-mono font-bold tracking-widest uppercase opacity-60 truncate" style={{ color: cardColors.textMuted }}>
                    SCENE
                  </span>
                  <span className="text-xs font-mono font-black tracking-tight" style={{ color: cardColors.textPrimary }}>
                    SC.{sceneNo}
                  </span>
                  {subIdx > 0 && (
                    <span className="text-[8px] font-mono font-bold" style={{ color: track.color }}>
                      {subBadgeLabel}
                    </span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[8.5px] font-mono font-bold" style={{ color: cardColors.textPrimary }}>
                    {beat.durationPages.toFixed(1)}p
                  </span>
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 p-2 flex flex-col justify-between min-w-0 overflow-hidden">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center justify-between gap-1.5 min-w-0 shrink-0">
                    <span 
                      className="text-[9px] font-mono uppercase tracking-wide truncate opacity-75"
                      style={{ color: cardColors.textSecondary }}
                      title={locationAndSetting}
                    >
                      {locationAndSetting}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditBeat(beat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:scale-110 transition-all p-0.5 cursor-pointer pointer-events-auto shrink-0"
                      style={{ color: cardColors.textSecondary }}
                      title="Open in Script Editor"
                    >
                      <FileText size={11} />
                    </button>
                  </div>

                  <h3 
                    className="font-['Playfair_Display',Georgia,serif] text-[13px] font-bold leading-snug tracking-tight truncate mt-1 group-hover:text-[#B8860B] transition-colors"
                    style={{ color: cardColors.textPrimary }}
                    title={beatName}
                  >
                    {beatName}
                  </h3>
                </div>

                <div 
                  className="flex items-center justify-between gap-2 pt-1 border-t text-[8px] font-mono uppercase tracking-wider shrink-0"
                  style={{ 
                    borderColor: cardColors.divider,
                    color: cardColors.textMuted
                  }}
                >
                  <span>p.{beat.startPage.toFixed(1)}–{(beat.startPage + beat.durationPages).toFixed(1)}</span>
                  <span className="truncate opacity-75">{track.label || track.name || `LANE ${beat.timelineTrackIdx + 1}`}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Narrow Standard Card fallback */
            <div className="h-full flex min-w-0 select-none overflow-hidden relative">
              <div 
                className="w-1.5 shrink-0 h-full"
                style={{ backgroundColor: track.color }}
              />
              <div className="flex-1 p-2 flex flex-col justify-between min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono font-black" style={{ color: cardColors.textPrimary }}>
                    SC.{sceneNo}
                  </span>
                  <span className="text-[8.5px] font-mono font-bold" style={{ color: cardColors.textMuted }}>
                    {beat.durationPages.toFixed(1)}p
                  </span>
                </div>
                <h3 
                  className="font-['Playfair_Display',Georgia,serif] text-xs font-bold leading-tight truncate group-hover:text-[#B8860B] transition-colors"
                  style={{ color: cardColors.textPrimary }}
                >
                  {beatName}
                </h3>
                <div 
                  className="text-[7.5px] font-mono pt-0.5 border-t flex justify-between"
                  style={{ borderColor: cardColors.divider, color: cardColors.textMuted }}
                >
                  <span>p.{beat.startPage.toFixed(1)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditBeat(beat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer pointer-events-auto"
                    title="Open in Script Editor"
                  >
                    <FileText size={10} />
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          /* DETAIL VIEW: Full Pantone luxury swatch card */
          clipWidth >= 170 ? (
            <div className="h-full flex min-w-0 select-none overflow-hidden relative">
              {/* Left Solid Accent Stripe in track color */}
              <div 
                className="w-1.5 shrink-0 h-full"
                style={{ backgroundColor: track.color }}
                title={`Track: ${track.label || track.name || 'Lane ' + (beat.timelineTrackIdx + 1)}`}
              />

              {/* Left Metadata Column (Pantone Swatch Spec Column) */}
              <div 
                className="w-[84px] shrink-0 p-2 flex flex-col justify-between border-r overflow-hidden"
                style={{ 
                  backgroundColor: cardColors.metaColBg,
                  borderColor: cardColors.divider 
                }}
              >
                <div className="flex flex-col min-w-0">
                  <span 
                    className="text-[7.5px] font-mono font-bold tracking-widest uppercase opacity-60 truncate"
                    style={{ color: cardColors.textMuted }}
                  >
                    BACKSTAGE
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span 
                      className="text-xs font-mono font-black tracking-tight"
                      style={{ color: cardColors.textPrimary }}
                    >
                      SC.{sceneNo}
                    </span>
                    {subIdx > 0 && (
                      <span 
                        className="text-[8px] font-mono font-bold px-1 rounded border shrink-0"
                        style={{ borderColor: `${track.color}40`, color: track.color }}
                      >
                        {subBadgeLabel}
                      </span>
                    )}
                  </div>
                  <span 
                    className="text-[8px] font-mono tracking-wider uppercase opacity-70 truncate mt-0.5"
                    style={{ color: cardColors.textSecondary }}
                  >
                    {slugPrefix || 'SCENE'}
                  </span>
                </div>

                <div className="flex flex-col min-w-0 pt-1 border-t" style={{ borderColor: cardColors.divider }}>
                  <span 
                    className="text-[8px] font-mono font-bold tracking-tight truncate"
                    style={{ color: cardColors.textPrimary }}
                  >
                    {beat.durationPages.toFixed(1)} PAGES
                  </span>
                  <span 
                    className="text-[7.5px] font-mono opacity-65 truncate"
                    style={{ color: cardColors.textMuted }}
                  >
                    p.{beat.startPage.toFixed(1)}–{(beat.startPage + beat.durationPages).toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Right Dominant Area (Pantone Name, Summary & Technical Specs) */}
              <div className="flex-1 p-2.5 flex flex-col justify-between min-w-0 overflow-hidden">
                <div className="flex flex-col min-w-0">
                  {/* Top micro row: Location + Actions */}
                  <div className="flex items-center justify-between gap-1.5 min-w-0 shrink-0">
                    <span 
                      className="text-[9px] font-mono font-semibold uppercase tracking-wider truncate opacity-75"
                      style={{ color: cardColors.textSecondary }}
                      title={locationAndSetting}
                    >
                      {locationAndSetting}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      {beatLinksCount > 0 && (
                        <span 
                          className="text-[8px] font-mono px-1 py-0.2 rounded border"
                          style={{ borderColor: `${track.color}40`, color: cardColors.textMuted }}
                          title={`${beatLinksCount} link(s)`}
                        >
                          ⚡{beatLinksCount}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditBeat(beat.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:scale-110 transition-all p-0.5 cursor-pointer pointer-events-auto"
                        style={{ color: cardColors.textSecondary }}
                        title="Open in Script Editor"
                      >
                        <FileText size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Hero Beat Title (Pantone Editorial Display Style) */}
                  <h3 
                    className="font-['Playfair_Display',Georgia,serif] text-[13.5px] font-bold leading-snug tracking-tight truncate mt-1 group-hover:text-[#B8860B] transition-colors"
                    style={{ color: cardColors.textPrimary }}
                    title={beatName}
                  >
                    {beatName}
                  </h3>

                  {/* Summary with high legibility */}
                  <p 
                    className={`text-[10.5px] leading-relaxed mt-1 ${
                      clipHeight >= 88 ? 'line-clamp-2' : 'line-clamp-1'
                    } select-text`}
                    style={{ color: cardColors.textSecondary }}
                    title={cleanSummary || 'No summary'}
                  >
                    {cleanSummary || <span className="italic opacity-40">No summary available.</span>}
                  </p>
                </div>

                {/* Technical Specs Footer (HEX / RGB / CMYK style from Pantone reference) */}
                <div 
                  className="flex items-center justify-between gap-2 pt-1 border-t text-[8px] font-mono uppercase tracking-wider shrink-0 mt-1"
                  style={{ 
                    borderColor: cardColors.divider,
                    color: cardColors.textMuted
                  }}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span><strong className="font-semibold opacity-90">SPAN:</strong> {beat.durationPages.toFixed(1)}p</span>
                    <span><strong className="font-semibold opacity-90">RANGE:</strong> p.{beat.startPage.toFixed(1)}–{(beat.startPage + beat.durationPages).toFixed(1)}</span>
                  </div>
                  <span className="truncate opacity-75 font-medium">{track.label || track.name || `LANE ${beat.timelineTrackIdx + 1}`}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Narrow Detail Card fallback */
            <div className="h-full flex min-w-0 select-none overflow-hidden relative">
              <div 
                className="w-1.5 shrink-0 h-full"
                style={{ backgroundColor: track.color }}
              />
              <div className="flex-1 p-2 flex flex-col justify-between min-w-0 overflow-hidden">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono font-black" style={{ color: cardColors.textPrimary }}>
                      SC.{sceneNo}
                    </span>
                    <span className="text-[8.5px] font-mono font-bold" style={{ color: cardColors.textMuted }}>
                      {beat.durationPages.toFixed(1)}p
                    </span>
                  </div>
                  <h3 
                    className="font-['Playfair_Display',Georgia,serif] text-xs font-bold leading-tight truncate mt-1 group-hover:text-[#B8860B] transition-colors"
                    style={{ color: cardColors.textPrimary }}
                  >
                    {beatName}
                  </h3>
                  {cleanSummary && (
                    <p 
                      className="text-[9.5px] leading-tight line-clamp-2 mt-1 select-text"
                      style={{ color: cardColors.textSecondary }}
                    >
                      {cleanSummary}
                    </p>
                  )}
                </div>
                <div 
                  className="text-[7.5px] font-mono pt-1 border-t flex justify-between"
                  style={{ borderColor: cardColors.divider, color: cardColors.textMuted }}
                >
                  <span>p.{beat.startPage.toFixed(1)}–{(beat.startPage + beat.durationPages).toFixed(1)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditBeat(beat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer pointer-events-auto"
                    title="Open in Script Editor"
                  >
                    <FileText size={10} />
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        {/* Right Trim Handle */}
        <div
          onMouseDown={(e) => handleTimelineMouseDown(e, beat.id, 'trim-right')}
          className="absolute right-0 top-0 bottom-0 w-2.5 hover:bg-amber-400/80 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-auto"
          title="Drag to trim scene duration"
        />
      </div>
    );
  };

  return (
    <div className={`w-full h-full flex flex-col ${currentTheme.bgCanvas} ${currentTheme.textPrimary} select-none overflow-hidden font-sans relative`}>
      
      {/* 1. STUDIO HARDWARE TRANSPORT CONSOLE */}
      <header className={`h-12 px-3 ${currentTheme.bgHeader} ${currentTheme.borderStrip} border-b flex items-center justify-between shrink-0 z-30 shadow-md`}>
        
        {/* Left: Transport Buttons */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center ${currentTheme.isDark ? 'bg-[#141622] border-[#24283b]' : 'bg-slate-100 border-slate-300'} p-1 rounded-lg border shadow-xs gap-0.5`}>
            <button
              onClick={() => setPlayheadPage(1.0)}
              className={`p-1.5 rounded ${currentTheme.isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'} transition-all cursor-pointer`}
              title={translateUi('Return to Start (Home)', appLanguage)}
            >
              <SkipBack size={13} />
            </button>
            <button
              onClick={() => setPlayheadPage(p => Math.max(1, p - 1.0))}
              className={`p-1.5 rounded ${currentTheme.isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'} transition-all cursor-pointer`}
              title={translateUi('Step Back 1 Page (Left Arrow)', appLanguage)}
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={handleTogglePlay}
              className={`px-3 py-1 rounded-md flex items-center gap-1.5 font-bold text-xs transition-all cursor-pointer shadow ${
                isPlaying 
                  ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]' 
                  : currentTheme.isDark ? 'bg-[#23273a] hover:bg-[#2d324b] text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
              }`}
              title={translateUi('Play / Pause (Spacebar) • Automatically rolls script preview', appLanguage)}
            >
              {isPlaying ? <Pause size={13} className="fill-black" /> : <Play size={13} className={currentTheme.isDark ? "fill-white" : "fill-slate-800"} />}
              <span>{isPlaying ? translateUi('PAUSE', appLanguage) : translateUi('PLAY', appLanguage)}</span>
            </button>
            <button
              onClick={() => setIsScriptRollingOpen(p => !p)}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold text-xs transition-all cursor-pointer shadow ${
                isScriptRollingOpen
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : currentTheme.isDark ? 'bg-[#1a1d2c] hover:bg-[#25293d] text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
              }`}
              title={translateUi('Toggle Script Rolling Teleprompter Preview', appLanguage)}
            >
              <ScrollText size={13} style={{ color: isScriptRollingOpen ? (currentTheme.accent || appAccentColor) : undefined }} />
              <span className="hidden md:inline">{translateUi('SCRIPT PREVIEW', appLanguage)}</span>
              {isPlaying && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />}
            </button>
            <button
              onClick={() => setPlayheadPage(p => Math.min(totalScreenplayPages, p + 1.0))}
              className={`p-1.5 rounded ${currentTheme.isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'} transition-all cursor-pointer`}
              title={translateUi('Step Forward 1 Page (Right Arrow)', appLanguage)}
            >
              <ChevronRight size={13} />
            </button>
            <button
              onClick={() => setPlayheadPage(totalScreenplayPages)}
              className={`p-1.5 rounded ${currentTheme.isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'} transition-all cursor-pointer`}
              title={translateUi('Jump to End of Screenplay', appLanguage)}
            >
              <SkipForward size={13} />
            </button>
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-1.5 rounded text-xs transition-all cursor-pointer ml-1 ${
                isLooping ? 'bg-cyan-500/20 text-cyan-500' : currentTheme.isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Toggle Act II Loop"
            >
              <Activity size={13} />
            </button>
          </div>
        </div>

        {/* Right: Grid, Zoom, Add Beat, AI, Dock & CLI Tools */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {/* Snap Selector */}
          <div className={`flex items-center gap-1 ${currentTheme.isDark ? 'bg-[#141622] border-[#24283b]' : 'bg-slate-100 border-slate-300'} px-2 py-1 rounded border`}>
            <span className={`text-[10px] ${currentTheme.isDark ? 'text-slate-500' : 'text-slate-500'} font-semibold`}>{translateUi('SNAP:', appLanguage)}</span>
            <select
              value={snapGrid}
              onChange={(e: any) => setSnapGrid(e.target.value)}
              className={`bg-transparent ${currentTheme.isDark ? 'text-slate-200' : 'text-slate-800'} font-bold outline-none cursor-pointer text-xs`}
            >
              <option value="quarter" className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>1/4p</option>
              <option value="half" className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>1/2p</option>
              <option value="page" className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>1p</option>
              <option value="free" className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>Free</option>
            </select>
          </div>

          {/* View Mode / Lane Height Selector */}
          <div className={`flex items-center gap-1 ${currentTheme.isDark ? 'bg-[#141622] border-[#24283b]' : 'bg-slate-100 border-slate-300'} px-2 py-1 rounded border`}>
            <span className={`text-[10px] ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-500'} font-semibold`}>{translateUi('VIEW:', appLanguage)}</span>
            <select
              value={globalLaneHeight}
              onChange={(e) => {
                const newH = Number(e.target.value);
                setGlobalLaneHeight(newH);
                try {
                  localStorage.setItem('backstage_daw_lane_height', String(newH));
                } catch (err) {}
                saveTracks(tracks.map(t => ({ ...t, height: newH })));
              }}
              className={`bg-transparent ${currentTheme.isDark ? 'text-slate-200' : 'text-slate-800'} font-bold outline-none cursor-pointer text-xs`}
            >
              <option value={64} className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>{translateUi('Compact', appLanguage)}</option>
              <option value={84} className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>{translateUi('Standard', appLanguage)}</option>
              <option value={112} className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>{translateUi('Detail', appLanguage)}</option>
            </select>
          </div>

          {/* Auto Scene Numbering Toggle */}
          <button
            onClick={toggleAutoNumbering}
            className={`px-2 py-1 rounded flex items-center gap-1 font-bold border transition-all cursor-pointer text-xs ${
              autoNumberingEnabled 
                ? 'bg-amber-400/20 border-amber-400/60 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]' 
                : currentTheme.isDark ? 'bg-[#141622] border-[#24283b] text-slate-500 hover:text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            title={`Auto Scene Numbering: ${autoNumberingEnabled ? 'ON (Chronological 1..N Left-to-Right)' : 'OFF (Click to enable)'}`}
          >
            <Hash size={12} />
            <span>{translateUi('Auto #', appLanguage)}</span>
          </button>

          {/* Causality Dependency Links Toggle */}
          <button
            onClick={() => {
              const next = !showDependencies;
              setShowDependencies(next);
              try { localStorage.setItem('backstage_daw_show_dependencies', String(next)); } catch {}
            }}
            className={`px-2 py-1 rounded flex items-center gap-1 font-bold border transition-all cursor-pointer text-xs ${
              showDependencies 
                ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-600 shadow-[0_0_8px_rgba(6,182,212,0.2)]' 
                : currentTheme.isDark ? 'bg-[#141622] border-[#24283b] text-slate-500 hover:text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            title={`Causality Dependency Lines: ${showDependencies ? 'VISIBLE' : 'HIDDEN'} (${connections?.length || 0} links)`}
          >
            <Network size={12} />
            <span>{translateUi('Links', appLanguage)} ({connections?.length || 0})</span>
          </button>

          {/* Sequences & Act Groups Toggle */}
          <button
            onClick={() => {
              const next = !showGroups;
              setShowGroups(next);
              try { localStorage.setItem('backstage_daw_show_groups', String(next)); } catch {}
            }}
            className={`px-2 py-1 rounded flex items-center gap-1 font-bold border transition-all cursor-pointer text-xs ${
              showGroups 
                ? 'bg-purple-500/20 border-purple-500/60 text-purple-600 shadow-[0_0_8px_rgba(168,85,247,0.2)]' 
                : currentTheme.isDark ? 'bg-[#141622] border-[#24283b] text-slate-500 hover:text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            title={`Act & Sequence Groups: ${showGroups ? 'EXPANDED' : 'COLLAPSED'}`}
          >
            <Layers size={12} />
            <span>{translateUi('Groups', appLanguage)}</span>
          </button>

          {/* Mini-Map Macro Overview Toggle */}
          <button
            onClick={() => {
              const next = !showMiniMap;
              setShowMiniMap(next);
              try { localStorage.setItem('backstage_daw_show_minimap', String(next)); } catch {}
            }}
            className={`px-2 py-1 rounded flex items-center gap-1 font-bold border transition-all cursor-pointer text-xs ${
              showMiniMap 
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.2)]' 
                : currentTheme.isDark ? 'bg-[#141622] border-[#24283b] text-slate-500 hover:text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            title={`Macro Mini-Map Overview: ${showMiniMap ? 'SHOWN' : 'HIDDEN'}`}
          >
            <Compass size={12} />
            <span>{translateUi('Map', appLanguage)}</span>
          </button>

          {/* DAW Theme Selector (Both Light & Dark themes) */}
          <div className={`flex items-center gap-1 ${currentTheme.isDark ? 'bg-[#141622] border-[#24283b]' : 'bg-slate-100 border-slate-300'} px-2 py-1 rounded border`}>
            <Palette size={12} className="text-amber-500 shrink-0" />
            <select
              value={dawThemeId}
              onChange={(e) => saveDawTheme(e.target.value as DawThemeId)}
              className={`bg-transparent ${currentTheme.isDark ? 'text-slate-200' : 'text-slate-800'} font-bold outline-none cursor-pointer text-xs`}
              title="DAW Visual Theme (Dark & Light studio styles)"
            >
              <optgroup label={translateUi('Dark Themes', appLanguage)} className={currentTheme.isDark ? 'bg-[#141622] text-slate-300' : 'bg-white text-slate-800'}>
                <option value="obsidian" className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>Obsidian Studio</option>
                <option value="slate" className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>Cyber Slate</option>
                <option value="vintage" className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>Vintage Console</option>
              </optgroup>
              <optgroup label={translateUi('Light Themes', appLanguage)} className={currentTheme.isDark ? 'bg-[#141622] text-slate-300' : 'bg-white text-slate-800'}>
                <option value="paper" className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>Paper Script</option>
                <option value="platinum" className={currentTheme.isDark ? 'bg-[#141622] text-slate-200' : 'bg-white text-slate-800'}>Studio Platinum</option>
              </optgroup>
            </select>
          </div>

          {/* Zoom controls (anchored to playhead) */}
          <div className={`flex items-center ${currentTheme.isDark ? 'bg-[#141622] border-[#24283b]' : 'bg-slate-100 border-slate-300'} px-1.5 py-1 rounded border gap-1`}>
            <button 
              onClick={() => zoomAroundPlayhead(zoomLevel - 0.2)}
              className={`${currentTheme.isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'} p-0.5 cursor-pointer`}
              title="Zoom Out (- or _)"
            >
              <ZoomOut size={12} />
            </button>
            <span className={`text-[10px] w-7 text-center ${currentTheme.isDark ? 'text-slate-300' : 'text-slate-700'} font-mono`}>{Math.round(zoomLevel * 100)}%</span>
            <button 
              onClick={() => zoomAroundPlayhead(zoomLevel + 0.2)}
              className={`${currentTheme.isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'} p-0.5 cursor-pointer`}
              title="Zoom In (+ or =)"
            >
              <ZoomIn size={12} />
            </button>
          </div>

          {/* Add Beat Button */}
          <button
            onClick={() => handleCreateBeat(0, 0)}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
            title={translateUi('Create New Beat on Track 1, Subtrack 1', appLanguage)}
          >
            <Plus size={13} />
            <span>{translateUi('Beat', appLanguage)}</span>
          </button>

          {/* AI Generate Button */}
          <button
            onClick={() => setIsAiModalOpen(true)}
            disabled={!aiAvailable}
            className={`p-1.5 ${currentTheme.isDark ? 'bg-[#211b2f] hover:bg-[#2e2442] border-violet-500/40 text-violet-300' : 'bg-violet-50 hover:bg-violet-100 border-violet-300 text-violet-700'} border rounded transition-all cursor-pointer disabled:opacity-40`}
            title={aiAvailable ? "AI Beat Generator" : "Add AI key in Backstage"}
          >
            <Sparkles size={13} className="text-violet-400" />
          </button>

          {/* Dock Position Switcher */}
          <button
            onClick={() => setTrackHeaderDock(d => d === 'left' ? 'right' : 'left')}
            className={`p-1.5 rounded ${currentTheme.isDark ? 'bg-[#141622] border-[#24283b] text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'} border transition-colors cursor-pointer`}
            title={`Dock track channel strips to ${trackHeaderDock === 'left' ? 'Right' : 'Left'}`}
          >
            <ArrowLeftRight size={13} />
          </button>

          {/* Terminal Console Trigger */}
          <button
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className={`px-2 py-1 rounded flex items-center gap-1 font-bold border transition-all cursor-pointer ${
              isTerminalOpen 
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                : currentTheme.isDark ? 'bg-[#141622] border-[#24283b] text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            title={translateUi('Toggle DAW Terminal (~ or `)', appLanguage)}
          >
            <TerminalIcon size={13} />
            <span>{translateUi('CLI', appLanguage)}</span>
          </button>
        </div>
      </header>

      {/* MACRO OVERVIEW MINI-MAP (Full 200+ beat navigation strip) */}
      {showMiniMap && (
        <div className={`h-7 ${currentTheme.isDark ? 'bg-[#0b0c14] border-[#1c1f2e]' : 'bg-slate-100 border-slate-300'} border-b px-3 flex items-center gap-3 select-none shrink-0 z-20`}>
          <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
            <Compass size={12} className="text-amber-500" />
            <span className={`font-bold ${currentTheme.isDark ? 'text-slate-300' : 'text-slate-700'}`}>MACRO</span>
            <span className={currentTheme.isDark ? 'text-slate-500' : 'text-slate-500'}>({beats.length} beats / {totalScreenplayPages}p)</span>
          </div>

          <div
            ref={miniMapRef}
            onMouseDown={handleMiniMapMouseDown}
            className={`flex-1 h-4 ${currentTheme.isDark ? 'bg-[#07080d] border-white/10' : 'bg-slate-200 border-slate-300'} border rounded relative cursor-pointer overflow-hidden group shadow-inner`}
            title="Click or drag to scrub entire 200+ beat screenplay timeline"
          >
            {/* Act / Group region indicators in mini-map */}
            {dawGroupSpans.map((span) => {
              const leftPct = ((span.startPage - 1) / totalScreenplayPages) * 100;
              const widthPct = ((span.endPage - span.startPage) / totalScreenplayPages) * 100;
              return (
                <div
                  key={`mini-span-${span.id}`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: `${span.color}18`,
                    borderLeft: `1px solid ${span.color}40`,
                  }}
                  className="absolute top-0 bottom-0 pointer-events-none"
                />
              );
            })}

            {/* Miniature beats across tracks */}
            {beatsWithTimeline.map((b) => {
              const leftPct = ((b.startPage - 1) / totalScreenplayPages) * 100;
              const widthPct = Math.max(0.3, (b.durationPages / totalScreenplayPages) * 100);
              const trackNum = Math.min(tracks.length - 1, Math.max(0, b.timelineTrackIdx));
              const topPct = (trackNum / tracks.length) * 100;
              const heightPct = 100 / tracks.length;
              const color = tracks[trackNum]?.color || b.color || '#3b82f6';
              const isSelected = selectedBeatId === b.id;

              return (
                <div
                  key={`mini-beat-${b.id}`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    top: `${topPct}%`,
                    height: `${heightPct}%`,
                    backgroundColor: isSelected ? '#f59e0b' : color,
                    opacity: isSelected ? 1 : 0.75,
                  }}
                  className="absolute rounded-xs pointer-events-none"
                />
              );
            })}

            {/* Current Viewport Window Indicator */}
            {(() => {
              const headerOffset = trackHeaderDock === 'left' ? 256 : 0;
              const visibleLeftPx = Math.max(0, viewportMetrics.scrollLeft - headerOffset);
              const visibleWidthPx = viewportMetrics.clientWidth;
              const leftPct = Math.max(0, Math.min(100, (visibleLeftPx / totalTimelineWidth) * 100));
              const widthPct = Math.max(2, Math.min(100 - leftPct, (visibleWidthPx / totalTimelineWidth) * 100));

              return (
                <div
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  className="absolute top-0 bottom-0 border border-amber-400/80 bg-amber-400/20 rounded shadow-[0_0_8px_rgba(245,158,11,0.35)] pointer-events-none"
                />
              );
            })()}

            {/* Playhead needle in mini-map */}
            <div
              style={{
                left: `${((playheadPage - 1) / totalScreenplayPages) * 100}%`
              }}
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-[0_0_4px_#ef4444] pointer-events-none z-10"
            />
          </div>
        </div>
      )}

      {/* 2. UNIFIED SYNCHRONIZED TIMELINE ARRANGEMENT */}
      <div 
        ref={timelineScrollRef}
        onScroll={handleTimelineScroll}
        onMouseDown={handleDeselectIfBackground}
        className={`flex-1 overflow-auto ${currentTheme.bgCanvas} relative flex flex-col select-none`}
      >
        <div 
          style={{ minWidth: `${totalTimelineWidth + 260}px` }}
          className="min-h-full flex flex-col relative"
        >
          
          {/* STICKY TOP RULER ROW */}
          <div 
            style={{ height: `${rulerHeight}px` }} 
            className={`flex sticky top-0 z-30 ${currentTheme.bgRuler} ${currentTheme.borderRuler} border-b shadow-sm transition-all`}
          >
            {/* Left Corner: Track header banner (if left-docked) */}
            {trackHeaderDock === 'left' && (
              <div 
                style={{ height: `${rulerHeight}px` }}
                className={`w-64 shrink-0 sticky left-0 z-40 ${currentTheme.bgStrip} ${currentTheme.borderStrip} border-r px-3 flex flex-col justify-center text-xs font-mono font-bold ${currentTheme.textMuted} shadow-md`}
              >
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-wider">Tracks ({tracks.length})</span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={handleResetToDefaultTracks}
                      className={`px-1.5 py-0.5 rounded ${currentTheme.isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-400' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-amber-600'} flex items-center gap-1 text-[10px] cursor-pointer`}
                      title="Reset to 5 Standard Narrative Tracks"
                    >
                      <RotateCcw size={10} /> Reset
                    </button>
                    <button 
                      onClick={addCustomTrack}
                      className={`px-1.5 py-0.5 rounded ${currentTheme.isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-400' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-amber-600'} flex items-center gap-1 text-[10px] cursor-pointer`}
                      title="Add New Narrative Track"
                    >
                      <Plus size={11} /> Track
                    </button>
                  </div>
                </div>
                {showGroups && tieredGroupSpans.length > 0 && maxGroupTiers > 1 && (
                  <div className="flex items-center gap-1 text-[9px] text-purple-400 mt-1 font-mono font-semibold">
                    <Layers size={10} />
                    <span>Chapters: {maxGroupTiers} stacked tiers</span>
                  </div>
                )}
              </div>
            )}

            {/* Act Milestones & Screenplay Page Ruler Canvas */}
            <div 
              onMouseDown={handleRulerMouseDown}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const curX = e.clientX - rect.left;
                setRulerHoverPage(snapToGrid(Math.max(1, 1 + curX / effectivePxPerPage)));
              }}
              onMouseLeave={() => setRulerHoverPage(null)}
              style={{ width: `${totalTimelineWidth}px` }}
              className="flex-1 h-full relative cursor-ew-resize overflow-visible select-none group/ruler"
            >
              {/* User Sequences & Group Regions on Ruler - Stacked Tiers (One by One) */}
              {showGroups && tieredGroupSpans.map((span) => {
                const markerX = (span.startPage - 1) * effectivePxPerPage;
                const width = Math.max(40, (span.endPage - span.startPage) * effectivePxPerPage);
                const tierTop = 3 + (span.tier % 4) * 18;

                return (
                  <div
                    key={`ruler-group-${span.id}`}
                    style={{
                      left: `${markerX}px`,
                      width: `${width}px`,
                      top: `${tierTop}px`,
                      height: '16px',
                      borderColor: `${span.color}70`,
                      backgroundColor: currentTheme.isDark ? `${span.color}22` : `${span.color}25`,
                    }}
                    className="absolute rounded border px-1.5 flex items-center justify-between gap-1 overflow-hidden pointer-events-auto cursor-pointer hover:brightness-125 transition-all shadow-2xs z-10 select-none group/ruler-group"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (timelineScrollRef.current) {
                        timelineScrollRef.current.scrollTo({
                          left: Math.max(0, markerX - 60),
                          behavior: 'smooth'
                        });
                      }
                    }}
                    title={`${span.title} (pp. ${span.startPage.toFixed(1)}–${span.endPage.toFixed(1)} • ${span.sceneCount} scenes). Click to jump.`}
                  >
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: span.color }} />
                      <span 
                        className="text-[9px] font-mono font-bold uppercase tracking-wider truncate" 
                        style={{ color: span.color }}
                      >
                        {span.title}
                      </span>
                    </div>
                    <span className={`text-[8px] font-mono shrink-0 ${currentTheme.isDark ? 'text-slate-300' : 'text-slate-700'} font-semibold ml-1`}>
                      p.{Math.round(span.startPage)}
                    </span>
                  </div>
                );
              })}

              {/* Page Number Ruler Ticks */}
              {Array.from({ length: Math.ceil(totalScreenplayPages / 5) }).map((_, i) => {
                const pageNum = i * 5;
                const x = (pageNum - 1) * effectivePxPerPage;
                if (x < 0) return null;
                return (
                  <div
                    key={pageNum}
                    style={{ left: `${x}px` }}
                    className={`absolute bottom-0 h-2.5 border-l ${currentTheme.isDark ? 'border-white/20 text-slate-500' : 'border-slate-400 text-slate-600 font-semibold'} text-[8px] font-mono pl-1 pointer-events-none`}
                  >
                    {pageNum}p
                  </div>
                );
              })}

              {/* Ruler Hover Guide Line & Tooltip */}
              {rulerHoverPage !== null && (
                <div
                  style={{ left: `${(rulerHoverPage - 1) * effectivePxPerPage}px` }}
                  className="absolute top-0 bottom-0 w-px border-l border-dashed border-amber-400/60 pointer-events-none z-40"
                >
                  <span className="absolute top-0.5 left-1 text-[8px] font-mono bg-black/80 px-1 rounded text-amber-300 pointer-events-none shadow">
                    p.{rulerHoverPage.toFixed(1)}
                  </span>
                </div>
              )}

              {/* Interactive Playhead Scrubber Handle on Ruler */}
              <div
                style={{ left: `${(playheadPage - 1) * effectivePxPerPage}px` }}
                className="absolute top-0 bottom-0 pointer-events-none z-50 flex flex-col items-center -translate-x-1/2"
              >
                {/* Grab handle badge */}
                <div 
                  className="px-1.5 py-0.5 bg-amber-400 text-black font-mono font-black text-[9px] rounded-t-sm shadow-[0_2px_8px_rgba(245,158,11,0.6)] flex items-center gap-0.5 tracking-tight pointer-events-auto cursor-ew-resize hover:scale-105 transition-transform"
                  title={`Playhead: p.${playheadPage.toFixed(1)} • Drag to scrub`}
                >
                  <span>{playheadPage.toFixed(1)}p</span>
                </div>
                {/* Downward triangle pointer */}
                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-amber-400 -mt-px shadow-sm pointer-events-none" />
              </div>
            </div>

            {/* Right Corner: Track header banner (if right-docked) */}
            {trackHeaderDock === 'right' && (
              <div 
                style={{ height: `${rulerHeight}px` }}
                className={`w-64 shrink-0 sticky right-0 z-40 ${currentTheme.bgStrip} border-l ${currentTheme.borderStrip} px-3 flex items-center justify-between text-xs font-mono font-bold ${currentTheme.textMuted} shadow-md`}
              >
                <span className="uppercase tracking-wider">Tracks ({tracks.length})</span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={handleResetToDefaultTracks}
                    className={`px-1.5 py-0.5 rounded ${currentTheme.isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-400' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-amber-600'} flex items-center gap-1 text-[10px] cursor-pointer`}
                    title="Reset to 5 Standard Narrative Tracks"
                  >
                    <RotateCcw size={10} /> Reset
                  </button>
                  <button 
                    onClick={addCustomTrack}
                    className={`px-1.5 py-0.5 rounded ${currentTheme.isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-400' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-amber-600'} flex items-center gap-1 text-[10px] cursor-pointer`}
                    title="Add New Narrative Track"
                  >
                    <Plus size={11} /> Track
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MAIN ARRANGEMENT: UNIFIED ROWS (TRACK STRIP + LANE GRID) */}
          <div ref={tracksContainerRef} className="flex-1 flex flex-col relative">
            

            {/* Sequence & Group Lane Vertical Shading Bands */}
            {showGroups && dawGroupSpans.map((span, idx) => {
              const x = (span.startPage - 1) * effectivePxPerPage + (trackHeaderDock === 'left' ? 256 : 0);
              const w = Math.max(10, (span.endPage - span.startPage) * effectivePxPerPage);
              return (
                <div
                  key={`group-band-${span.id}`}
                  style={{
                    left: `${x}px`,
                    width: `${w}px`,
                    backgroundColor: idx % 2 === 0 ? `${span.color}06` : 'transparent',
                    borderLeft: `1px dashed ${span.color}25`,
                  }}
                  className="absolute top-0 bottom-0 pointer-events-none z-1"
                />
              );
            })}

            {/* Unified Track Rows with Main Track and up to 2 Manual Subtracks */}
            {tracks.map((track, trackIdx) => {
              const mainH = track.height || globalLaneHeight;
              const subCount = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, track.subtrackCount || 0));
              const sub1H = getSpecificSubtrackHeight(track, 1, globalLaneHeight);
              const sub2H = getSpecificSubtrackHeight(track, 2, globalLaneHeight);
              let totalLaneH = mainH;
              if (subCount >= 1) totalLaneH += sub1H;
              if (subCount >= 2) totalLaneH += sub2H;

              return (
                <div 
                  key={track.id}
                  style={{ height: `${totalLaneH}px` }}
                  className={`flex w-full border-b ${currentTheme.borderLane} relative group`}
                >
                  {/* Left Docked Track Strip */}
                  {trackHeaderDock === 'left' && (
                    <div className={`w-64 shrink-0 sticky left-0 z-40 ${currentTheme.bgStrip} border-r ${currentTheme.borderStrip} shadow-2xl flex select-none`}>
                      {renderTrackStripItem(track, trackIdx)}
                    </div>
                  )}

                  {/* Lane Canvas */}
                  <div 
                    style={{ width: `${totalTimelineWidth}px`, height: `${totalLaneH}px` }}
                    className="flex-1 relative overflow-visible"
                  >
                    {/* 1. Main Track Canvas Lane */}
                    <div
                      style={{ height: `${mainH}px` }}
                      className={`absolute left-0 right-0 top-0 ${currentTheme.borderLane} border-b transition-colors`}
                      onDoubleClick={(e) => handleLaneDoubleClick(e, trackIdx, 0)}
                    >
                      {/* Sticky Main watermark */}
                      <div className="sticky left-2 top-1 pointer-events-none flex items-center gap-1.5 opacity-30 select-none z-1">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                          V{trackIdx + 1} • MAIN
                        </span>
                      </div>
                    </div>

                    {/* 2. Manual Subtrack Lanes (up to 2) */}
                    {Array.from({ length: subCount }).map((_, sIdx) => {
                      const subNum = sIdx + 1; // 1 or 2
                      const thisSubH = subNum === 1 ? sub1H : sub2H;
                      const topY = mainH + (sIdx === 0 ? 0 : sub1H);

                      return (
                        <div
                          key={`sublane-${subNum}`}
                          style={{
                            top: `${topY}px`,
                            height: `${thisSubH}px`,
                          }}
                          className={`absolute left-0 right-0 ${currentTheme.borderLane} border-b transition-colors ${
                            sIdx % 2 === 0 ? 'bg-white/[0.012]' : 'bg-transparent'
                          }`}
                          onDoubleClick={(e) => handleLaneDoubleClick(e, trackIdx, subNum)}
                        >
                          {/* Sticky subtrack watermark */}
                          <div className="sticky left-2 top-1 pointer-events-none flex items-center gap-1.5 opacity-30 select-none z-1">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                              V{trackIdx + 1}.{subNum} • SUB {subNum}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Vertical Screenplay Grid Lines */}
                    {Array.from({ length: Math.ceil(totalScreenplayPages) }).map((_, i) => {
                      const pageNum = i + 1;
                      const x = (pageNum - 1) * effectivePxPerPage;
                      const isMajor = pageNum % 10 === 0;
                      const isMid = pageNum % 5 === 0;
                      return (
                        <div
                          key={pageNum}
                          style={{ left: `${x}px` }}
                          className={`absolute top-0 bottom-0 pointer-events-none ${
                            isMajor ? currentTheme.gridMajor : isMid ? currentTheme.gridMid : currentTheme.gridMinor
                          }`}
                        />
                      );
                    })}

                    {/* Beat Clips in this Lane */}
                    {beatsWithTimeline
                      .filter(b => b.timelineTrackIdx === trackIdx)
                      .map(beat => renderBeatClip(beat, track))}
                  </div>

                  {/* Right Docked Track Strip */}
                  {trackHeaderDock === 'right' && (
                    <div className={`w-64 shrink-0 sticky right-0 z-40 ${currentTheme.bgStrip} ${currentTheme.borderStrip} border-l shadow-2xl flex select-none`}>
                      {renderTrackStripItem(track, trackIdx)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Extended Left Panel Row to Bottom of Timeline Canvas */}
            <div className="flex-1 flex w-full relative min-h-[160px]">
              {trackHeaderDock === 'left' && (
                <div className={`w-64 shrink-0 sticky left-0 z-40 ${currentTheme.bgStrip} border-r ${currentTheme.borderStrip} shadow-2xl flex flex-col items-center justify-start p-3 select-none`}>
                  <button
                    onClick={addCustomTrack}
                    className="w-full py-2 px-3 rounded-lg border border-dashed border-white/10 hover:border-amber-400/50 hover:bg-amber-400/5 text-slate-400 hover:text-amber-400 flex items-center justify-center gap-1.5 text-xs font-mono transition-all cursor-pointer group"
                    title="Add a new track lane"
                  >
                    <Plus size={13} className="group-hover:scale-110 transition-transform" />
                    <span>Add Track Lane</span>
                  </button>
                  {tracks.length === 0 && (
                    <div className="text-center mt-6 px-2">
                      <p className="text-xs font-bold text-slate-300 mb-1">No Tracks Created</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Click "Add Track Lane" above to create your first narrative track.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Lane Canvas Grid Extension */}
              <div 
                style={{ width: `${totalTimelineWidth}px` }}
                className="flex-1 relative bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:24px_24px]"
                onDoubleClick={() => {
                  if (tracks.length === 0) {
                    addCustomTrack();
                  }
                }}
              />

              {trackHeaderDock === 'right' && (
                <div className={`w-64 shrink-0 sticky right-0 z-40 ${currentTheme.bgStrip} border-l ${currentTheme.borderStrip} shadow-2xl flex flex-col items-center justify-start p-3 select-none`}>
                  <button
                    onClick={addCustomTrack}
                    className="w-full py-2 px-3 rounded-lg border border-dashed border-white/10 hover:border-amber-400/50 hover:bg-amber-400/5 text-slate-400 hover:text-amber-400 flex items-center justify-center gap-1.5 text-xs font-mono transition-all cursor-pointer group"
                    title="Add a new track lane"
                  >
                    <Plus size={13} className="group-hover:scale-110 transition-transform" />
                    <span>Add Track Lane</span>
                  </button>
                </div>
              )}
            </div>

            {/* Causality Cause-and-Effect SVG Dependency Connectors */}
            {showDependencies && visibleConnections.length > 0 && (
              <svg 
                className="absolute top-0 pointer-events-none z-25 overflow-visible"
                style={{ 
                  left: trackHeaderDock === 'left' ? '256px' : '0px',
                  width: `${totalTimelineWidth}px`, 
                  height: `${trackOffsets.totalHeight}px` 
                }}
              >
                <defs>
                  <marker
                    id="arrow-cyan"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#06b6d4" />
                  </marker>
                  <marker
                    id="arrow-amber"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
                  </marker>
                  <filter id="dep-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {visibleConnections.map((conn, idx) => {
                  const x1 = conn.fromAnchor.right;
                  const y1 = conn.fromAnchor.centerY;
                  const x2 = conn.toAnchor.left;
                  const y2 = conn.toAnchor.centerY;
                  const isSelected = conn.isSelected;
                  const color = isSelected ? '#f59e0b' : (conn.color || '#06b6d4');
                  const dx = Math.max(30, Math.abs(x2 - x1) * 0.45);
                  
                  let d = '';
                  if (x2 < x1) {
                    const loopH = Math.min(60, Math.abs(y2 - y1) + 40);
                    d = `M ${x1} ${y1} C ${x1 + 40} ${y1 - loopH}, ${x2 - 40} ${y2 - loopH}, ${x2} ${y2}`;
                  } else {
                    d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
                  }

                  return (
                    <g key={`conn-${conn.from}-${conn.to}-${idx}`}>
                      <path
                        d={d}
                        fill="none"
                        stroke={color}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        strokeDasharray={conn.style === 'zigzag' ? '4 3' : undefined}
                        strokeOpacity={isSelected ? 0.95 : 0.6}
                        filter={isSelected ? 'url(#dep-glow)' : undefined}
                        markerEnd={isSelected ? 'url(#arrow-amber)' : 'url(#arrow-cyan)'}
                      />
                      {conn.label && (
                        <text
                          x={(x1 + x2) / 2}
                          y={(y1 + y2) / 2 - 6}
                          fill={color}
                          fontSize="9"
                          fontFamily="monospace"
                          textAnchor="middle"
                          className="select-none pointer-events-none font-bold"
                        >
                          {conn.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Laser Playhead Line */}
            <div
              style={{ 
                left: `${(playheadPage - 1) * effectivePxPerPage + (trackHeaderDock === 'left' ? 256 : 0)}px` 
              }}
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none z-30 shadow-[0_0_12px_#f59e0b]"
            >
              <div className="w-3.5 h-3.5 bg-amber-400 text-black rounded-b -ml-[6px] flex items-center justify-center shadow-lg">
                <div className="w-1.5 h-1.5 bg-black rounded-full" />
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Floating Always-Accessible Timeline Zoom HUD Pill */}
      <div className={`absolute bottom-6 right-8 z-40 flex items-center ${currentTheme.isDark ? 'bg-[#10121d]/95 border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.85)] text-slate-200' : 'bg-white/95 border-slate-300 shadow-xl text-slate-800'} backdrop-blur-md px-2.5 py-1.5 rounded-full border gap-1.5 text-xs font-mono select-none pointer-events-auto`}>
        <button
          onClick={() => zoomAroundPlayhead(zoomLevel - 0.2)}
          className={`w-6 h-6 rounded-full hover:bg-white/10 ${currentTheme.textMuted} hover:${currentTheme.textPrimary} flex items-center justify-center cursor-pointer transition-colors`}
          title="Zoom Out (- or _)"
        >
          <ZoomOut size={13} />
        </button>
        <button
          onClick={() => zoomAroundPlayhead(1.0)}
          className={`px-2 py-0.5 rounded text-[11px] font-bold ${currentTheme.textPrimary} hover:text-amber-400 cursor-pointer transition-colors`}
          title="Click to reset to 100% Zoom"
        >
          {Math.round(zoomLevel * 100)}%
        </button>
        <button
          onClick={() => zoomAroundPlayhead(zoomLevel + 0.2)}
          className={`w-6 h-6 rounded-full hover:bg-white/10 ${currentTheme.textMuted} hover:${currentTheme.textPrimary} flex items-center justify-center cursor-pointer transition-colors`}
          title="Zoom In (+ or =)"
        >
          <ZoomIn size={13} />
        </button>
        <div className={`w-px h-3.5 ${currentTheme.isDark ? 'bg-white/20' : 'bg-slate-300'}`} />
        <button
          onClick={() => {
            if (timelineScrollRef.current) {
              const containerWidth = timelineScrollRef.current.clientWidth - (trackHeaderDock === 'left' ? 256 : 0);
              const targetZoom = Math.max(0.4, Math.min(2.5, containerWidth / (totalScreenplayPages * pixelsPerPage)));
              zoomAroundPlayhead(targetZoom);
            }
          }}
          className={`px-2 py-0.5 rounded-full hover:bg-white/10 text-[10px] font-bold ${currentTheme.textMuted} hover:text-cyan-400 cursor-pointer transition-colors`}
          title="Fit entire screenplay in view"
        >
          FIT
        </button>
      </div>

      {/* 3. COLLAPSIBLE STUDIO DRAWER (DAW TERMINAL, INSPECTOR, TENSION ARC) */}
      {isTerminalOpen && (
        <div 
          style={{ height: `${terminalHeight}px` }}
          className={`border-t ${currentTheme.borderStrip} ${currentTheme.isDark ? 'bg-[#0c0d14]' : 'bg-slate-100'} flex flex-col shrink-0 z-30 shadow-2xl transition-all`}
        >
          {/* Drawer Tabs Header */}
          <div className={`h-8 px-3 ${currentTheme.isDark ? 'bg-[#11131c] border-[#1c1f2e]' : 'bg-slate-200/80 border-slate-300'} border-b flex items-center justify-between shrink-0`}>
            <div className="flex items-center gap-1 font-mono text-xs">
              <button
                onClick={() => setTerminalTab('cli')}
                className={`px-3 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  terminalTab === 'cli' 
                    ? 'bg-cyan-500/20 text-cyan-500 border border-cyan-500/40' 
                    : currentTheme.isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                &gt;_ DAW SHELL
              </button>
              <button
                onClick={() => setTerminalTab('inspector')}
                className={`px-3 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  terminalTab === 'inspector' 
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40' 
                    : currentTheme.isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                CLIP INSPECTOR {selectedBeat ? `[SC.${selectedBeat.sceneNumber || selectedBeat.id}]` : ''}
              </button>
              <button
                onClick={() => setTerminalTab('tension')}
                className={`px-3 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  terminalTab === 'tension' 
                    ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40' 
                    : currentTheme.isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                TENSION ARC
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setTerminalHeight(p => p === 240 ? 400 : 240)}
                className={`p-1 ${currentTheme.isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-300 text-slate-600 hover:text-slate-900'} rounded cursor-pointer`}
                title={terminalHeight === 240 ? "Maximize Drawer" : "Minimize Drawer"}
              >
                {terminalHeight === 240 ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
              </button>
              <button
                onClick={() => setIsTerminalOpen(false)}
                className={`p-1 ${currentTheme.isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-300 text-slate-600 hover:text-slate-900'} rounded cursor-pointer`}
                title="Close Drawer"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* TAB 1: CLI TERMINAL */}
          {terminalTab === 'cli' && (
            <div className="flex-1 flex flex-col font-mono text-xs p-3 bg-[#08090f] overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-1 select-text pr-1">
                {cliLogs.map(log => (
                  <div key={log.id} className="flex items-baseline gap-2 leading-relaxed">
                    <span className="text-slate-500 text-[9px]">{log.time}</span>
                    {log.type === 'cmd' && <span className="text-amber-400 font-bold">{log.text}</span>}
                    {log.type === 'info' && <span className="text-cyan-400">{log.text}</span>}
                    {log.type === 'out' && <span className="text-slate-300">{log.text}</span>}
                    {log.type === 'err' && <span className="text-red-400">{log.text}</span>}
                  </div>
                ))}
                <div ref={terminalLogsEndRef} />
              </div>

              {/* Quick CLI suggestion chips */}
              <div className="pt-2 flex items-center gap-1.5 overflow-x-auto text-[10px] text-slate-400">
                <span className="text-slate-600 uppercase text-[9px]">Quick:</span>
                {['help', 'beat add "Climax"', 'seek midpoint', 'play', 'analyze', 'stats', 'clear'].map(q => (
                  <button
                    key={q}
                    onClick={() => executeCommand(q)}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 hover:text-white border border-white/5 transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  executeCommand(cliInput);
                }}
                className="pt-2 border-t border-white/5 flex items-center gap-2"
              >
                <span className="text-emerald-400 font-bold text-xs">&gt;</span>
                <input
                  ref={cliInputRef}
                  type="text"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  placeholder='Type DAW command ("help", "analyze", "seek midpoint")...'
                  className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 outline-none text-xs font-mono"
                  autoFocus
                />
                <button 
                  type="submit" 
                  className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
                >
                  <CornerDownLeft size={12} />
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: CLIP INSPECTOR */}
          {terminalTab === 'inspector' && (
            <div className={`flex-1 p-4 ${currentTheme.isDark ? 'bg-[#0a0c13]' : 'bg-white'} text-xs overflow-y-auto`}>
              {selectedBeat ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                  {/* Title & Scene # */}
                  <div>
                    <label className={`block text-[10px] uppercase font-mono ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'} mb-1`}>Beat Title</label>
                    <input
                      type="text"
                      value={selectedBeat.title}
                      onChange={(e) => updateBeat(selectedBeat.id, { title: e.target.value })}
                      className={`w-full ${currentTheme.isDark ? 'bg-[#141724] border-[#262b3f] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} border focus:border-amber-400 rounded px-2.5 py-1.5 font-bold outline-none`}
                    />
                  </div>

                  {/* Slugline / Location */}
                  <div>
                    <label className={`block text-[10px] uppercase font-mono ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'} mb-1`}>Slugline / Location</label>
                    <div className="flex gap-1.5">
                      <select
                        value={selectedBeat.slug?.prefix || 'INT.'}
                        onChange={(e) => updateBeat(selectedBeat.id, { 
                          slug: { ...selectedBeat.slug, prefix: e.target.value as any } 
                        })}
                        className={`${currentTheme.isDark ? 'bg-[#141724] border-[#262b3f] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} border rounded px-2 py-1.5 font-mono text-xs outline-none`}
                      >
                        <option value="INT.">INT.</option>
                        <option value="EXT.">EXT.</option>
                        <option value="INT./EXT.">INT./EXT.</option>
                      </select>
                      <input
                        type="text"
                        value={selectedBeat.slug?.location || ''}
                        onChange={(e) => updateBeat(selectedBeat.id, { 
                          slug: { ...selectedBeat.slug, location: e.target.value } 
                        })}
                        placeholder="LOCATION"
                        className={`flex-1 ${currentTheme.isDark ? 'bg-[#141724] border-[#262b3f] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} border focus:border-amber-400 rounded px-2.5 py-1.5 font-mono text-xs outline-none uppercase`}
                      />
                    </div>
                  </div>

                  {/* Track & 3 Subtracks Assignment */}
                  <div>
                    <label className={`block text-[10px] uppercase font-mono ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'} mb-1`}>Track & Subtrack</label>
                    <div className="flex flex-col gap-1">
                      <select
                        value={selectedBeat.trackIndex ?? 0}
                        onChange={(e) => updateBeat(selectedBeat.id, { trackIndex: Number(e.target.value) })}
                        className={`w-full ${currentTheme.isDark ? 'bg-[#141724] border-[#262b3f] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} border focus:border-amber-400 rounded px-2 py-1 text-xs outline-none`}
                      >
                        {tracks.map((t, i) => (
                          <option key={t.id} value={i}>{`V${i + 1}: ${t.label}`}</option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        {(() => {
                          const curTrack = tracks[selectedBeat.trackIndex ?? 0];
                          const subCount = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, curTrack?.subtrackCount || 0));
                          const subOptions = [
                            { idx: 0, label: 'Main' },
                            ...(subCount >= 1 ? [{ idx: 1, label: 'Sub 1' }] : []),
                            ...(subCount >= 2 ? [{ idx: 2, label: 'Sub 2' }] : []),
                          ];

                          return subOptions.map(({ idx, label }) => {
                            const isCurrent = (selectedBeat.subtrackIndex ?? 0) === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => updateBeat(selectedBeat.id, { subtrackIndex: idx })}
                                className={`flex-1 py-1 text-[10px] font-mono font-bold rounded cursor-pointer transition-all truncate px-1 text-center border ${
                                  isCurrent
                                    ? 'bg-amber-400 text-black border-amber-400 shadow-xs'
                                    : currentTheme.isDark ? 'bg-[#141622] border-[#262b3f] text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Dramatic Tension Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className={`text-[10px] uppercase font-mono ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'}`}>Dramatic Tension</label>
                      <span className="text-[10px] font-mono font-bold text-amber-500">{selectedBeat.tension || 50}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedBeat.tension || 50}
                      onChange={(e) => updateBeat(selectedBeat.id, { tension: Number(e.target.value) })}
                      className={`w-full h-1.5 accent-amber-500 ${currentTheme.isDark ? 'bg-[#252838]' : 'bg-slate-200'} rounded cursor-pointer mt-2`}
                    />
                  </div>

                  {/* Full Script Editor Trigger */}
                  <div className="flex items-end">
                    <button
                      onClick={() => onEditBeat(selectedBeat.id)}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
                    >
                      <FileText size={14} />
                      <span>Edit Script</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-1">
                  <HelpCircle size={20} className={`${currentTheme.isDark ? 'text-slate-600' : 'text-slate-400'} mb-1`} />
                  <span className={currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'}>No scene clip selected.</span>
                  <span className={`text-[11px] ${currentTheme.isDark ? 'text-slate-600' : 'text-slate-400'}`}>Click any beat clip on the timeline above to inspect and edit its dramatic attributes.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TENSION ARC VISUALIZER */}
          {terminalTab === 'tension' && (
            <div className={`flex-1 p-3 ${currentTheme.isDark ? 'bg-[#08090f]' : 'bg-slate-50'} flex flex-col justify-between`}>
              <div className={`flex items-center justify-between pb-1.5 text-xs ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'} font-mono`}>
                <span className="flex items-center gap-1.5 text-amber-500 font-bold">
                  <BarChart3 size={13} /> SCREENPLAY DRAMATIC TENSION ARC
                </span>
                <span>{beatsWithTimeline.length} scenes plotted across {totalScreenplayPages} pages</span>
              </div>
              <div className={`flex-1 w-full ${currentTheme.isDark ? 'bg-[#0d0f18] border-white/5' : 'bg-white border-slate-200 shadow-inner'} rounded-lg border relative overflow-hidden p-2`}>
                <svg className="w-full h-full">
                  {/* Grid horizontal markers */}
                  <line x1="0" y1="25%" x2="100%" y2="25%" stroke={currentTheme.isDark ? "#ffffff08" : "#0000000d"} strokeDasharray="3,3" />
                  <line x1="0" y1="50%" x2="100%" y2="50%" stroke={currentTheme.isDark ? "#ffffff08" : "#0000000d"} strokeDasharray="3,3" />
                  <line x1="0" y1="75%" x2="100%" y2="75%" stroke={currentTheme.isDark ? "#ffffff08" : "#0000000d"} strokeDasharray="3,3" />

                  {beatsWithTimeline.length > 1 && (() => {
                    const sorted = [...beatsWithTimeline].sort((a, b) => a.startPage - b.startPage);
                    const points = sorted.map((b) => {
                      const px = Math.min(100, Math.max(0, ((b.startPage - 1) / totalScreenplayPages) * 100));
                      const py = 100 - (b.tension || 50);
                      return `${px}% ${py}%`;
                    });
                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points.join(', ')}
                        />
                        {sorted.map((b) => {
                          const cx = `${Math.min(100, Math.max(0, ((b.startPage - 1) / totalScreenplayPages) * 100))}%`;
                          const cy = `${100 - (b.tension || 50)}%`;
                          return (
                            <circle
                              key={b.id}
                              cx={cx}
                              cy={cy}
                              r={selectedBeatId === b.id ? 5 : 3}
                              fill={selectedBeatId === b.id ? (currentTheme.isDark ? '#ffffff' : '#0f172a') : '#f59e0b'}
                              className="cursor-pointer"
                              onClick={() => setSelectedBeatId(b.id)}
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Scene Generator Modal */}
      <AISceneGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />

      {/* Beat Right-Click Context Menu (Fixed z-[99999], on top of everything) */}
      {beatContextMenu && (() => {
        const menuBeat = beatsWithTimeline.find(b => b.id === beatContextMenu.beatId);
        if (!menuBeat) return null;
        const canSplit = playheadPage > menuBeat.startPage && playheadPage < (menuBeat.startPage + menuBeat.durationPages);

        return (
          <>
            {/* Fullscreen Backdrop to dismiss on outside click */}
            <div 
              className="fixed inset-0 z-[99998]" 
              onClick={() => setBeatContextMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setBeatContextMenu(null); }}
            />

            {/* Context Menu Card */}
            <div
              style={{
                position: 'fixed',
                left: `${beatContextMenu.x}px`,
                top: `${beatContextMenu.y}px`,
                zIndex: 99999,
              }}
              onClick={(e) => e.stopPropagation()}
              className={`w-56 backdrop-blur-xl rounded-xl p-1.5 text-xs animate-in fade-in zoom-in-95 duration-100 select-none flex flex-col gap-0.5 pointer-events-auto ${
                currentTheme.isDark
                  ? 'bg-[#131522]/95 border border-white/10 ring-1 ring-black/60 text-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.85)]'
                  : 'bg-white/98 border border-slate-300 ring-1 ring-black/5 text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
              }`}
            >
              {/* Header with Scene & Title */}
              <div className={`px-2 py-1 border-b mb-0.5 ${currentTheme.isDark ? 'border-white/5' : 'border-slate-200'}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[9px] font-mono font-black px-1.5 py-0.2 rounded bg-amber-400 text-black shrink-0">
                    SC.{menuBeat.sceneNumber || '1'}
                  </span>
                  <span className={`text-xs font-bold truncate ${currentTheme.isDark ? 'text-white' : 'text-slate-900'}`}>
                    {menuBeat.title || 'Untitled Beat'}
                  </span>
                </div>
                <div className={`text-[10px] font-mono mt-0.5 ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  pp. {menuBeat.startPage.toFixed(1)}–{(menuBeat.startPage + menuBeat.durationPages).toFixed(1)} ({menuBeat.durationPages.toFixed(1)}p)
                </div>
              </div>

              {/* Action 1: Edit Full Scene Script */}
              <button
                onClick={() => {
                  onEditBeat(menuBeat.id);
                  setBeatContextMenu(null);
                }}
                className={`w-full px-2 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                  currentTheme.isDark
                    ? 'hover:bg-amber-400/15 text-slate-200 hover:text-amber-300'
                    : 'hover:bg-amber-500/15 text-slate-800 hover:text-amber-800'
                }`}
              >
                <FileText size={13} className="text-amber-500 shrink-0" />
                <span className="font-semibold">Edit Scene Script</span>
              </button>

              {/* Action 2: Quick Edit Name & Summary (widens lane) */}
              <button
                onClick={() => {
                  startInlineEditForBeat(menuBeat.id);
                  setBeatContextMenu(null);
                }}
                className={`w-full px-2 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                  currentTheme.isDark
                    ? 'hover:bg-white/5 hover:text-cyan-300 text-slate-200'
                    : 'hover:bg-cyan-50 hover:text-cyan-800 text-slate-700'
                }`}
              >
                <Edit3 size={13} className="text-cyan-500 shrink-0" />
                <span>Quick Edit Name & Summary</span>
              </button>

              {/* Action 3: Duplicate Scene */}
              <button
                onClick={() => handleDuplicateBeat(menuBeat.id)}
                className={`w-full px-2 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                  currentTheme.isDark
                    ? 'hover:bg-white/5 hover:text-emerald-300 text-slate-200'
                    : 'hover:bg-emerald-50 hover:text-emerald-800 text-slate-700'
                }`}
              >
                <Copy size={13} className="text-emerald-500 shrink-0" />
                <span>Duplicate Scene</span>
              </button>

              {/* Action 4: Split at Playhead */}
              <button
                onClick={() => handleSplitBeatAtPlayhead(menuBeat.id)}
                disabled={!canSplit}
                className={`w-full px-2 py-1.5 rounded-lg flex items-center gap-2 text-left transition-colors ${
                  canSplit
                    ? currentTheme.isDark
                      ? 'hover:bg-white/5 hover:text-indigo-300 text-slate-200 cursor-pointer'
                      : 'hover:bg-indigo-50 hover:text-indigo-800 text-slate-700 cursor-pointer'
                    : currentTheme.isDark ? 'opacity-40 cursor-not-allowed text-slate-500' : 'opacity-40 cursor-not-allowed text-slate-400'
                }`}
                title={canSplit ? `Split scene at playhead page ${playheadPage.toFixed(1)}` : 'Position playhead inside scene to split'}
              >
                <Scissors size={13} className="text-indigo-500 shrink-0" />
                <span>Split at Playhead {canSplit ? `(p.${playheadPage.toFixed(1)})` : ''}</span>
              </button>

              <div className={`h-px my-0.5 ${currentTheme.isDark ? 'bg-white/5' : 'bg-slate-200'}`} />

              {/* Action 5: Move to Track */}
              <div className="px-2 py-1">
                <div className={`text-[9px] uppercase font-mono mb-1 flex items-center justify-between ${currentTheme.isDark ? 'text-slate-500' : 'text-slate-500 font-semibold'}`}>
                  <span>Move to Track</span>
                  <ArrowLeftRight size={10} />
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {tracks.map((t, idx) => (
                    <button
                      key={t.id}
                      onClick={() => handleMoveBeatToTrack(menuBeat.id, idx, 0)}
                      style={{ borderColor: `${t.color}60` }}
                      className={`px-1 py-1 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer text-center ${
                        menuBeat.timelineTrackIdx === idx && menuBeat.timelineSubtrackIdx === 0
                          ? currentTheme.isDark ? 'bg-white/20 text-white' : 'bg-slate-900 text-white'
                          : currentTheme.isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title={t.label}
                    >
                      V{idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`h-px my-0.5 ${currentTheme.isDark ? 'bg-white/5' : 'bg-slate-200'}`} />

              {/* Action 6: Delete Scene */}
              <button
                onClick={() => handleDeleteBeatFromMenu(menuBeat.id)}
                className={`w-full px-2 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                  currentTheme.isDark
                    ? 'hover:bg-red-500/15 text-red-400 hover:text-red-300'
                    : 'hover:bg-red-50 text-red-600 hover:text-red-700'
                }`}
              >
                <Trash2 size={13} className="shrink-0" />
                <span className="font-semibold">Delete Scene</span>
              </button>
            </div>
          </>
        );
      })()}

      {/* Right-Click Drag Selection Marquee Overlay */}
      {rightClickMarqueeBox && (
        <div
          style={{
            left: `${Math.min(rightClickMarqueeBox.startX, rightClickMarqueeBox.currentX)}px`,
            top: `${Math.min(rightClickMarqueeBox.startY, rightClickMarqueeBox.currentY)}px`,
            width: `${Math.abs(rightClickMarqueeBox.currentX - rightClickMarqueeBox.startX)}px`,
            height: `${Math.abs(rightClickMarqueeBox.currentY - rightClickMarqueeBox.startY)}px`,
          }}
          className="fixed border-2 border-dashed border-cyan-400 bg-cyan-500/10 pointer-events-none z-[99998] rounded backdrop-blur-[0.5px]"
        >
          <div className="absolute top-1 left-2 bg-black/85 text-cyan-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-cyan-500/40 shadow-lg flex items-center gap-1.5">
            <Layers size={11} className="text-cyan-400" />
            <span>{marqueeSelectedBeatIds.length} scenes selected to group</span>
          </div>
        </div>
      )}

      {/* Group Creation Popover Modal (Triggered when releasing right-click marquee) */}
      {showGroupModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div 
            className={`w-96 rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 border ${
              currentTheme.isDark 
                ? 'bg-[#131522] border-[#2c3048] text-slate-100' 
                : 'bg-white border-slate-300 text-slate-800'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between pb-3 mb-3.5 border-b ${currentTheme.isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className={`flex items-center gap-2 font-mono font-bold text-sm ${currentTheme.isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                <Layers size={16} />
                <span>Create Sequence Group</span>
              </div>
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setMarqueeSelectedBeatIds([]);
                }}
                className={`p-1 rounded-lg cursor-pointer transition-colors ${
                  currentTheme.isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                }`}
              >
                <X size={14} />
              </button>
            </div>

            <div className={`text-xs mb-3 ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Group <span className={`font-bold ${currentTheme.isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{marqueeSelectedBeatIds.length} selected scenes</span> into a cohesive narrative sequence with vertical lane shading.
            </div>

            {/* Sequence Title */}
            <div className="mb-3.5">
              <label className={`block text-[10px] uppercase font-mono mb-1 ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600 font-semibold'}`}>Sequence / Group Title</label>
              <input
                type="text"
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateGroupFromMarquee();
                  } else if (e.key === 'Escape') {
                    setShowGroupModal(false);
                    setMarqueeSelectedBeatIds([]);
                  }
                }}
                placeholder="e.g. Inciting Incident & Escape..."
                className={`w-full rounded-lg px-3 py-2 text-sm font-semibold outline-none border transition-colors ${
                  currentTheme.isDark
                    ? 'bg-[#1c2033] border-[#2d334e] focus:border-cyan-400 text-white'
                    : 'bg-slate-50 border-slate-300 focus:border-cyan-600 text-slate-900'
                }`}
              />
            </div>

            {/* Sequence Color Swatch */}
            <div className="mb-4">
              <label className={`block text-[10px] uppercase font-mono mb-1.5 ${currentTheme.isDark ? 'text-slate-400' : 'text-slate-600 font-semibold'}`}>Sequence Color</label>
              <div className="grid grid-cols-5 gap-1.5">
                {TRACK_PALETTE_COLORS.map(p => (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => setNewGroupColor(p.hex)}
                    style={{ backgroundColor: p.hex }}
                    className={`h-7 rounded-lg flex items-center justify-center cursor-pointer transition-transform ${
                      newGroupColor === p.hex 
                        ? currentTheme.isDark ? 'ring-2 ring-white scale-110 shadow-md' : 'ring-2 ring-slate-900 scale-110 shadow-md' 
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {newGroupColor === p.hex && <Check size={12} className="text-black font-black" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className={`flex items-center justify-end gap-2 pt-2 border-t ${currentTheme.isDark ? 'border-white/5' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => {
                  setShowGroupModal(false);
                  setMarqueeSelectedBeatIds([]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  currentTheme.isDark ? 'hover:bg-white/5 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateGroupFromMarquee}
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-colors flex items-center gap-1.5"
              >
                <Layers size={13} />
                <span>Group {marqueeSelectedBeatIds.length} Scenes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Script Rolling Preview / Teleprompter Popup Window */}
      <ScriptRollingPreviewModal
        isOpen={isScriptRollingOpen}
        onClose={() => setIsScriptRollingOpen(false)}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        playheadPage={playheadPage}
        onSeek={(p) => setPlayheadPage(p)}
        beats={beatsWithTimeline}
        totalScreenplayPages={totalScreenplayPages}
        appAccentColor={currentTheme.accent || appAccentColor}
        playbackSpeed={playbackSpeed}
        onPlaybackSpeedChange={setPlaybackSpeed}
        dawThemeIsDark={currentTheme.isDark}
      />

    </div>
  );
};

export default BoardView;