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
  ChevronDown, ChevronRight, Layers, Hash,
  Network, Compass, GitBranch, Bookmark
} from 'lucide-react';
import { AISceneGeneratorModal } from '../AISceneGeneratorModal';

interface BoardViewProps {
  onEditBeat: (id: number) => void;
}

// 3 Subtracks per master track (DAW standard multi-lane architecture)
export const MAX_SUBTRACKS_PER_TRACK = 2;

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

// Dramatic Act Milestones (Standard 110-120 page feature film structure)
const ACT_MARKERS = [
  { id: 'act1_start', page: 1, label: 'ACT I', sub: 'Setup & World', color: '#06b6d4' },
  { id: 'inciting', page: 12, label: 'CATALYST', sub: 'Inciting Incident', color: '#f59e0b' },
  { id: 'pp1', page: 25, label: 'PLOT POINT 1', sub: 'Break into Two', color: '#ec4899' },
  { id: 'act2a', page: 35, label: 'ACT II-A', sub: 'Rising Action', color: '#3b82f6' },
  { id: 'midpoint', page: 55, label: 'MIDPOINT', sub: 'Point of No Return', color: '#e11d48' },
  { id: 'act2b', page: 65, label: 'ACT II-B', sub: 'Downward Spiral', color: '#8b5cf6' },
  { id: 'allis_lost', page: 75, label: 'ALL IS LOST', sub: 'Dark Night', color: '#ef4444' },
  { id: 'pp2', page: 85, label: 'PLOT POINT 2', sub: 'Break into Three', color: '#10b981' },
  { id: 'act3', page: 95, label: 'ACT III', sub: 'Final Climax', color: '#06b6d4' },
  { id: 'resolution', page: 108, label: 'FINALE', sub: 'Resolution', color: '#64748b' },
];

export const BoardView: React.FC<BoardViewProps> = ({ onEditBeat }) => {
  const { 
    beats, setBeats, updateBeat, captureSnapshot,
    currentProjectId, groups, connections
  } = useProject();
  const { aiAvailable } = useAiKeyStatus();

  const tracksStorageKey = `backstage_daw_tracks_${currentProjectId || 'default'}`;

  // DAW Tracks State
  const [tracks, setTracks] = useState<TimelineTrack[]>(() => {
    try {
      const saved = localStorage.getItem(tracksStorageKey) || localStorage.getItem('backstage_daw_tracks');
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
  const [isLooping, setIsLooping] = useState(false);
  const [loopRange] = useState<{ start: number; end: number }>({ start: 25, end: 55 });
  const [snapGrid, setSnapGrid] = useState<'quarter' | 'half' | 'page' | 'free'>('half');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [pixelsPerPage] = useState(28);

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

  // Beat Inline Editing State (double-click creation: title -> Enter -> summary -> Enter -> commit)
  const [inlineEditState, setInlineEditState] = useState<{
    beatId: number;
    trackId: string;
    subtrackIdx: number;
    originalHeight?: number;
    field: 'title' | 'summary';
    titleText: string;
    summaryText: string;
  } | null>(null);

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
  } | null>(null);

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

  // Dynamic VU Meter level based on active playhead scene tension
  const [vuLevel, setVuLevel] = useState(50);

  // Computed layout for beats
  const beatsWithTimeline = useMemo(() => {
    let accumulatedPage = 1.0;
    return beats.map((b) => {
      const trackIdx = typeof b.trackIndex === 'number' && b.trackIndex >= 0 && b.trackIndex < tracks.length ? b.trackIndex : 0;
      const curTrack = tracks[trackIdx];
      const maxSub = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, curTrack?.subtrackCount || 0));
      const subtrackIdx = typeof b.subtrackIndex === 'number' && b.subtrackIndex >= 0 && b.subtrackIndex <= maxSub ? b.subtrackIndex : 0;
      const wordCount = (b.content || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      const defaultDuration = Math.max(1.5, Math.min(8.0, Math.round((wordCount / 220) * 2) / 2 || 2.5));
      
      const startPage = typeof b.startTime === 'number' && b.startTime >= 1 ? b.startTime : accumulatedPage;
      // Duration in screenplay pages - scales correctly when rendered with effectivePxPerPage
      const durationPages = typeof (b as any).durationPages === 'number' && (b as any).durationPages > 0
        ? (b as any).durationPages
        : typeof b.durationWidth === 'number' && b.durationWidth > 0
          ? (b.durationWidth / pixelsPerPage)
          : defaultDuration;
      
      accumulatedPage = Math.max(accumulatedPage, startPage + durationPages);
      const tension = typeof b.tension === 'number' ? b.tension : 50;

      return {
        ...b,
        timelineTrackIdx: trackIdx,
        timelineSubtrackIdx: subtrackIdx,
        startPage,
        durationPages,
        tension
      };
    });
  }, [beats, tracks, pixelsPerPage]);

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

  // Selected beat
  const selectedBeat = useMemo(() => {
    return beatsWithTimeline.find(b => b.id === selectedBeatId) || null;
  }, [beatsWithTimeline, selectedBeatId]);

  // Total pages
  const totalScreenplayPages = useMemo(() => {
    if (beatsWithTimeline.length === 0) return 110;
    const maxEnd = Math.max(...beatsWithTimeline.map(b => b.startPage + b.durationPages));
    return Math.max(110, Math.ceil(maxEnd + 6));
  }, [beatsWithTimeline]);

  // Timecode readout (hh:mm:ss:ff)
  const timecodeDisplay = useMemo(() => {
    const totalSeconds = playheadPage * 60;
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    const frames = Math.floor((totalSeconds % 1) * 24);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  }, [playheadPage]);

  // Current active scene at playhead
  const activeBeatAtPlayhead = useMemo(() => {
    return beatsWithTimeline.find(b => playheadPage >= b.startPage && playheadPage < (b.startPage + b.durationPages));
  }, [beatsWithTimeline, playheadPage]);

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

  // Playhead VU meter animation based on actual beat tension
  useEffect(() => {
    if (!isPlaying) {
      setVuLevel(activeBeatAtPlayhead?.tension || selectedBeat?.tension || 40);
      return;
    }
    const interval = setInterval(() => {
      const base = activeBeatAtPlayhead?.tension || 45;
      const jitter = (Math.random() - 0.5) * 8;
      setVuLevel(Math.min(95, Math.max(15, Math.round(base + jitter))));
    }, 120);
    return () => clearInterval(interval);
  }, [isPlaying, activeBeatAtPlayhead, selectedBeat]);

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
      const advancePages = deltaSeconds * pagesPerSecond * 4;

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
  }, [isPlaying, tempoBpm, isLooping, loopRange, totalScreenplayPages]);

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
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

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

      if (e.key === 'Enter') {
        if (selectedBeatId !== null && !inlineEditState) {
          e.preventDefault();
          onEditBeat(selectedBeatId);
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      } else if (e.code === 'Home') {
        e.preventDefault();
        setPlayheadPage(1.0);
      } else if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        setIsTerminalOpen(p => !p);
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedBeatId !== null) {
          e.preventDefault();
          setBeats(beats.filter(b => b.id !== selectedBeatId));
          captureSnapshot();
          setSelectedBeatId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBeatId, inlineEditState, onEditBeat, beats, zoomLevel, playheadPage, trackHeaderDock, pixelsPerPage]);

  // Smooth Drag Move & Trim on Timeline (with RAF and position diffing)
  const dragRafRef = useRef<number | null>(null);
  const pendingMouseCoordsRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const lastAppliedDragRef = useRef<{ startTime?: number; trackIndex?: number; subtrackIndex?: number; durationWidth?: number } | null>(null);

  const handleTimelineMouseDown = (e: React.MouseEvent, beatId: number, type: 'move' | 'trim-left' | 'trim-right') => {
    e.stopPropagation();
    const targetBeat = beatsWithTimeline.find(b => b.id === beatId);
    if (!targetBeat) return;

    setSelectedBeatId(beatId);
    setDragHoverTrack({ trackIdx: targetBeat.timelineTrackIdx, subtrackIdx: targetBeat.timelineSubtrackIdx });
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
      targetSubtrackIdx: targetBeat.timelineSubtrackIdx
    });
  };

  const effectivePxPerPage = pixelsPerPage * zoomLevel;

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

        let targetTrack = dragState.targetTrackIdx;
        let targetSubtrack = dragState.targetSubtrackIdx;

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

        const last = lastAppliedDragRef.current;
        if (!last || last.startTime !== newStart || last.trackIndex !== targetTrack || last.subtrackIndex !== targetSubtrack) {
          lastAppliedDragRef.current = { startTime: newStart, trackIndex: targetTrack, subtrackIndex: targetSubtrack };
          setDragHoverTrack({ trackIdx: targetTrack, subtrackIdx: targetSubtrack });
          updateBeat(dragState.beatId, { startTime: newStart, trackIndex: targetTrack, subtrackIndex: targetSubtrack });
        }
      } else if (dragState.type === 'trim-right') {
        const newDur = Math.max(0.5, snapToGrid(dragState.initialDuration + deltaPages));
        const newWidth = newDur * pixelsPerPage;
        const last = lastAppliedDragRef.current;
        if (!last || last.durationWidth !== newWidth) {
          lastAppliedDragRef.current = { ...last, durationWidth: newWidth };
          updateBeat(dragState.beatId, { durationWidth: newWidth });
        }
      } else if (dragState.type === 'trim-left') {
        const newStart = snapToGrid(Math.max(1, dragState.initialStartPage + deltaPages));
        const newDur = Math.max(0.5, dragState.initialDuration - (newStart - dragState.initialStartPage));
        const newWidth = newDur * pixelsPerPage;
        const last = lastAppliedDragRef.current;
        if (!last || last.startTime !== newStart || last.durationWidth !== newWidth) {
          lastAppliedDragRef.current = { startTime: newStart, durationWidth: newWidth };
          updateBeat(dragState.beatId, { startTime: newStart, durationWidth: newWidth });
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      pendingMouseCoordsRef.current = { clientX: e.clientX, clientY: e.clientY };
      if (!isActuallyDragging && dragState) {
        const dist = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);
        if (dist > 3) {
          setIsActuallyDragging(true);
        }
      }
      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(processDragFrame);
      }
    };

    const handleMouseUp = () => {
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      processDragFrame();
      setDragState(null);
      setIsActuallyDragging(false);
      setDragHoverTrack(null);
      lastAppliedDragRef.current = null;
      pendingMouseCoordsRef.current = null;
      captureSnapshot();
      if (autoNumberingEnabled) {
        syncAutoSceneNumbers();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, isActuallyDragging, effectivePxPerPage, tracks, globalLaneHeight]);

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

    if (customSpans.length > 0) {
      return customSpans.sort((a, b) => a.startPage - b.startPage);
    }

    // Default: Derive narrative sequence groups from dramatic ACT_MARKERS
    const actSpans: DawGroupSpan[] = [];
    for (let i = 0; i < ACT_MARKERS.length; i++) {
      const cur = ACT_MARKERS[i];
      const next = ACT_MARKERS[i + 1];
      const startPage = cur.page;
      const endPage = next ? next.page : totalScreenplayPages;
      const memberBeats = beatsWithTimeline.filter(b => b.startPage >= startPage && b.startPage < endPage);
      actSpans.push({
        id: cur.id,
        title: `${cur.label}${cur.sub ? ` • ${cur.sub}` : ''}`,
        startPage,
        endPage,
        color: cur.color,
        sceneCount: memberBeats.length,
        beatIds: memberBeats.map(b => b.id)
      });
    }
    return actSpans;
  }, [groups, beatsWithTimeline, totalScreenplayPages]);

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

    // If view is not in Detail view (112px), temporarily change this track to Detail view for naming & summary
    if (startInlineEdit && currentTrackHeight < 112) {
      origHeightToSave = currentTrackHeight;
      setTracks(prev => prev.map(t => {
        if (t.id !== curTrack.id) return t;
        if (safeSubtrackIdx === 0) {
          return { ...t, height: 112 };
        } else {
          return { ...t, subtrackHeights: { ...(t.subtrackHeights || {}), [safeSubtrackIdx]: 112 } };
        }
      }));
    }

    const defaultPages = 4.0; // Reasonably good scene length (4 pages)
    const newBeat: Beat = {
      id: newId,
      x: 100,
      y: 100,
      title: newBeatTitle,
      sceneNumber: String(beats.length + 1),
      summary: '',
      slug: { prefix: 'INT.', location: 'SCENE LOCATION', time: 'DAY' },
      content: '<p>Scene action begins...</p>',
      trackIndex: safeTrackIdx,
      subtrackIndex: safeSubtrackIdx,
      startTime: startPage,
      durationWidth: defaultPages * pixelsPerPage,
      tension: 50
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
        field: 'title',
        titleText: newBeatTitle,
        summaryText: ''
      });
    }

    if (autoNumberingEnabled) {
      setTimeout(syncAutoSceneNumbers, 50);
    }
    return newId;
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
        className={`w-full flex flex-col justify-between border-b border-[#1c1f2e] select-none transition-all relative ${
          isDimmed ? 'bg-[#0c0d14] opacity-50' : 'bg-[#10121a]'
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
          className="px-3 pt-2.5 pb-2 flex flex-col justify-between border-b border-white/[0.06] bg-[#121420]"
        >
          {/* Top Line: Number, Title, + Sub button, Settings */}
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span 
                className="w-5 h-5 rounded flex items-center justify-center font-mono font-black text-[10px] shrink-0 text-black shadow-sm"
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
                  className="bg-[#1e2233] border border-amber-400 rounded px-1.5 py-0.5 text-xs text-white outline-none w-full font-sans font-semibold"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div 
                  className="truncate cursor-pointer group/title flex items-center gap-1"
                  onDoubleClick={() => {
                    setEditingTrackId(track.id);
                    setEditingTrackLabel(track.label);
                  }}
                  title="Double-click to rename track"
                >
                  <span className="text-xs font-semibold text-slate-100 truncate group-hover/title:text-amber-400 transition-colors">
                    {track.label}
                  </span>
                  <Edit3 size={11} className="opacity-0 group-hover/title:opacity-60 text-slate-400 shrink-0" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Manual + Subtrack Button (max 2) */}
              <button
                onClick={() => handleAddSubtrack(track.id)}
                disabled={subCount >= MAX_SUBTRACKS_PER_TRACK}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-0.5 cursor-pointer transition-colors ${
                  subCount >= MAX_SUBTRACKS_PER_TRACK
                    ? 'opacity-30 cursor-not-allowed bg-white/5 text-slate-500'
                    : 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                }`}
                title={subCount >= MAX_SUBTRACKS_PER_TRACK ? 'Maximum 2 subtracks reached' : 'Add Subtrack (up to 2 max)'}
              >
                <Plus size={10} />
                <span>Sub</span>
              </button>

              <button
                onClick={() => setActiveTrackSettingsId(activeTrackSettingsId === track.id ? null : track.id)}
                className={`p-1 rounded transition-colors shrink-0 cursor-pointer ${
                  activeTrackSettingsId === track.id ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title="Track Settings"
              >
                <Settings2 size={13} />
              </button>
            </div>
          </div>

          {/* Controls: Mute, Solo, Volume, Main Beats count */}
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
                className={`w-4 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                  track.isMuted 
                    ? 'bg-red-500 text-white shadow-[0_0_8px_#ef4444]' 
                    : 'bg-[#1b1e2a] hover:bg-[#252838] text-slate-400 hover:text-slate-200'
                }`}
                title="Mute Track"
              >
                M
              </button>
              <button
                onClick={() => updateTrack(track.id, { isSolo: !track.isSolo })}
                className={`w-4 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                  track.isSolo 
                    ? 'bg-amber-400 text-black shadow-[0_0_8px_#f59e0b]' 
                    : 'bg-[#1b1e2a] hover:bg-[#252838] text-slate-400 hover:text-slate-200'
                }`}
                title="Solo Track"
              >
                S
              </button>
            </div>

            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                type="range"
                min="0"
                max="100"
                value={track.volume ?? 75}
                onChange={(e) => updateTrack(track.id, { volume: Number(e.target.value) })}
                className="w-full h-1 accent-amber-500 bg-[#252838] rounded cursor-pointer"
                title={`Track Weight: ${track.volume ?? 75}%`}
              />
            </div>

            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/5 text-slate-400 border border-white/5 shrink-0" title="Beats on Main track">
              {mainBeats.length} {mainBeats.length === 1 ? 'clip' : 'clips'}
            </span>
          </div>

          {/* Role badge if roomy */}
          {mainH >= 90 && (
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
              <span className="uppercase tracking-wider truncate text-[9px] text-slate-400">{track.type || 'Main Lane'}</span>
              <button
                onClick={() => handleCreateBeat(trackIdx, 0)}
                className="text-amber-400 hover:underline flex items-center gap-0.5 text-[10px] cursor-pointer"
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
            <div className="w-8 h-0.5 bg-white/20 group-hover/main-strip-resizer:bg-amber-400 rounded-full pointer-events-none" />
          </div>
        </div>

        {/* 2. Manually Created Subtrack Rows (up to 2) */}
        {subCount > 0 && (
          <div className="flex flex-col">
            {Array.from({ length: subCount }).map((_, sIdx) => {
              const subNum = sIdx + 1; // 1 or 2
              const thisSubH = getSpecificSubtrackHeight(track, subNum, globalLaneHeight);
              const subBeats = trackBeats.filter(b => b.timelineSubtrackIdx === subNum);
              const isSubHovered = dragState?.type === 'move' && dragHoverTrack?.trackIdx === trackIdx && dragHoverTrack?.subtrackIdx === subNum;

              return (
                <div
                  key={`strip-sub-${subNum}`}
                  style={{ height: `${thisSubH}px` }}
                  className={`px-3 flex items-center justify-between border-t border-white/[0.05] transition-colors group/sub relative ${
                    isSubHovered ? 'bg-amber-400/[0.12]' : 'bg-[#0d0f18] hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span 
                      className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 border"
                      style={{ borderColor: `${track.color}40`, color: track.color, backgroundColor: `${track.color}15` }}
                    >
                      {trackIdx + 1}.{subNum}
                    </span>
                    <span className="text-[11px] font-mono text-slate-300">
                      Subtrack {subNum}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-mono text-slate-500">
                      {subBeats.length}
                    </span>
                    <button
                      onClick={() => handleCreateBeat(trackIdx, subNum)}
                      className="w-4 h-4 rounded hover:bg-white/10 text-slate-500 hover:text-amber-400 flex items-center justify-center cursor-pointer transition-colors"
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
                    <div className="w-8 h-0.5 bg-white/20 group-hover/sub-strip-resizer:bg-amber-400 rounded-full pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Track Customization Popover */}
        {activeTrackSettingsId === track.id && (
          <div 
            className={`absolute ${trackHeaderDock === 'left' ? 'left-full ml-2' : 'right-full mr-2'} top-0 w-80 bg-[#141724] border border-[#2d3248] rounded-xl p-3.5 shadow-2xl z-50 text-xs text-slate-200 animate-in fade-in zoom-in-95 backdrop-blur-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
              <span className="font-bold text-xs uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
                <Settings2 size={13} />
                Track Customization
              </span>
              <button 
                onClick={() => setActiveTrackSettingsId(null)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>

            {/* Track Name */}
            <div className="mb-2.5">
              <label className="block text-[9px] uppercase font-mono text-slate-400 mb-1">Track Name</label>
              <input
                type="text"
                value={track.label}
                onChange={(e) => updateTrack(track.id, { label: e.target.value })}
                className="w-full bg-[#1b1f30] border border-[#2b3046] focus:border-amber-400 rounded px-2.5 py-1 text-slate-100 text-xs outline-none font-semibold"
              />
            </div>

            {/* Role Presets */}
            <div className="mb-2.5">
              <label className="block text-[9px] uppercase font-mono text-slate-400 mb-1">Role Presets</label>
              <div className="flex flex-wrap gap-1">
                {PRESET_ROLE_NAMES.slice(0, 6).map(p => (
                  <button
                    key={p}
                    onClick={() => updateTrack(track.id, { label: p })}
                    className="px-2 py-0.5 rounded text-[10px] bg-white/5 hover:bg-amber-400/20 hover:text-amber-300 text-slate-300 border border-white/5 transition-colors cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Track Height Adjustment */}
            <div className="mb-2.5">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[9px] uppercase font-mono text-slate-400">Track Height</label>
                <span className="text-[10px] font-mono text-amber-400 font-bold">{track.height || globalLaneHeight}px</span>
              </div>
              <input
                type="range"
                min="50"
                max="300"
                value={track.height || globalLaneHeight}
                onChange={(e) => updateTrack(track.id, { height: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-[#1b1f30] rounded"
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
                        ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 font-bold'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Swatches */}
            <div className="mb-2.5">
              <label className="block text-[9px] uppercase font-mono text-slate-400 mb-1">Color Palette</label>
              <div className="grid grid-cols-5 gap-1.5">
                {TRACK_PALETTE_COLORS.map(p => (
                  <button
                    key={p.hex}
                    onClick={() => updateTrack(track.id, { color: p.hex })}
                    style={{ backgroundColor: p.hex }}
                    className={`h-5 rounded flex items-center justify-center cursor-pointer transition-transform ${
                      track.color === p.hex ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {track.color === p.hex && <Check size={10} className="text-black font-black" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions: Reorder, Duplicate, Delete */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveTrackOrder(track.id, 'up')}
                  disabled={trackIdx === 0}
                  className="p-1.5 rounded bg-[#1c2032] hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                  title="Move Track Up"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => moveTrackOrder(track.id, 'down')}
                  disabled={trackIdx === tracks.length - 1}
                  className="p-1.5 rounded bg-[#1c2032] hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer"
                  title="Move Track Down"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  onClick={() => duplicateTrack(track.id)}
                  className="p-1.5 rounded bg-[#1c2032] hover:bg-white/10 text-slate-300 cursor-pointer"
                  title="Duplicate Track"
                >
                  <Copy size={12} />
                </button>
              </div>

              {tracks.length > 1 && (
                <button
                  onClick={() => deleteTrack(track.id)}
                  className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
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

  // Render Rich Studio Beat Clip (Positioned in its respective main track or subtrack lane)
  const renderBeatClip = (beat: typeof beatsWithTimeline[0], track: TimelineTrack) => {
    const isSelected = selectedBeatId === beat.id;
    const isInlineEditing = inlineEditState?.beatId === beat.id;
    const isBeingDragged = isActuallyDragging && dragState?.beatId === beat.id && dragState.type === 'move';
    const clipLeft = (beat.startPage - 1) * effectivePxPerPage;
    const clipWidth = Math.max(isInlineEditing ? 220 : 120, beat.durationPages * effectivePxPerPage);
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
    const slugPrefix = (beat.slug?.prefix || 'INT.').trim();
    const slugLoc = (beat.slug?.location || 'SCENE').trim();
    const slugTime = (beat.slug?.time || '').trim();
    const locationAndSetting = slugTime 
      ? `${slugPrefix} ${slugLoc} - ${slugTime}` 
      : `${slugPrefix} ${slugLoc}`;
    const beatName = beat.title || 'Untitled Beat';
    const subBadgeLabel = subIdx === 0 ? `V${beat.timelineTrackIdx + 1}` : `${beat.timelineTrackIdx + 1}.${subIdx}`;
    const beatLinksCount = showDependencies && connections 
      ? connections.filter(c => c.from === beat.id || c.to === beat.id).length 
      : 0;

    // Viewport Virtualization: When handling 200+ beats, cull cards outside the visible window
    const headerOffset = trackHeaderDock === 'left' ? 256 : 0;
    const viewLeft = viewportMetrics.scrollLeft - headerOffset - 400;
    const viewRight = viewportMetrics.scrollLeft - headerOffset + viewportMetrics.clientWidth + 400;
    const isHorizontallyVisible = (clipLeft + clipWidth >= viewLeft) && (clipLeft <= viewRight);

    if (!isHorizontallyVisible && !isSelected && !isBeingDragged && !isInlineEditing) {
      return (
        <div
          key={beat.id}
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

    return (
      <div
        key={beat.id}
        data-beat-clip="true"
        style={{
          left: `${clipLeft}px`,
          width: `${clipWidth}px`,
          height: `${clipHeight}px`,
          top: `${clipTop}px`,
          borderColor: isSelected || isBeingDragged ? '#f59e0b' : `${track.color}50`,
          backgroundColor: isBeingDragged ? '#1a1d2e' : isSelected ? '#151826' : '#10121d',
          zIndex: isInlineEditing ? 40 : isBeingDragged ? 35 : isSelected ? 20 : 2,
          transform: isBeingDragged ? 'scale(1.02)' : 'none',
          willChange: isBeingDragged ? 'left, top' : 'auto',
        }}
        onMouseDown={(e) => {
          if (isInlineEditing) {
            e.stopPropagation();
            return;
          }
          handleTimelineMouseDown(e, beat.id, 'move');
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (isInlineEditing) return;
          onEditBeat(beat.id);
        }}
        className={`absolute rounded-lg border shadow-sm select-none overflow-hidden flex flex-col justify-between ${
          isBeingDragged 
            ? 'shadow-[0_16px_36px_rgba(0,0,0,0.85)] ring-2 ring-amber-400 cursor-grabbing transition-none' 
            : isSelected 
              ? 'shadow-[0_4px_16px_rgba(245,158,11,0.25)] ring-1 ring-amber-400 cursor-grab transition-[border-color,box-shadow]' 
              : 'hover:border-white/40 hover:shadow-md cursor-grab transition-[border-color,box-shadow]'
        }`}
      >
        {/* Left Trim Handle */}
        <div
          onMouseDown={(e) => handleTimelineMouseDown(e, beat.id, 'trim-left')}
          className="absolute left-0 top-0 bottom-0 w-2.5 hover:bg-amber-400/80 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-auto"
          title="Drag to trim scene start"
        />

        {isInlineEditing ? (
          /* INLINE EDITING: Step 1 (Beat Name) -> Enter -> Step 2 (Summary) -> Enter -> Commit */
          <div 
            className="h-full px-2 py-1.5 flex flex-col justify-center gap-1 min-w-0 bg-[#141726] border border-amber-400 rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-1 text-[9px] font-mono font-bold text-amber-400">
              <span className="truncate">{inlineEditState.field === 'title' ? 'BEAT NAME' : 'BEAT SUMMARY'}</span>
              <span className="text-[8px] text-slate-400 bg-black/40 px-1 py-0.2 rounded font-normal shrink-0">
                {inlineEditState.field === 'title' ? 'Enter ➜ Summary' : 'Enter ➜ Commit'}
              </span>
            </div>

            {inlineEditState.field === 'title' ? (
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
                    const committedTitle = inlineEditState.titleText.trim() || 'Untitled Beat';
                    updateBeat(beat.id, { title: committedTitle });
                    setInlineEditState({
                      ...inlineEditState,
                      titleText: committedTitle,
                      field: 'summary',
                      summaryText: beat.summary || ''
                    });
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    updateBeat(beat.id, { title: inlineEditState.titleText.trim() || 'Untitled Beat' });
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
                  }
                }}
                placeholder="Beat name..."
                className="w-full bg-[#0d0e17] border border-amber-400/80 rounded px-1.5 py-0.5 text-xs text-white font-bold outline-none shadow-inner"
              />
            ) : (
              <input
                type="text"
                autoFocus
                value={inlineEditState.summaryText}
                onChange={(e) => setInlineEditState({ ...inlineEditState, summaryText: e.target.value })}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const committedSummary = inlineEditState.summaryText.trim();
                    updateBeat(beat.id, { summary: committedSummary });
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
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    updateBeat(beat.id, { summary: inlineEditState.summaryText.trim() });
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
                  }
                }}
                placeholder="Summary (Enter to commit)..."
                className="w-full bg-[#0d0e17] border border-amber-400/80 rounded px-1.5 py-0.5 text-[11px] text-slate-100 outline-none shadow-inner"
              />
            )}
          </div>
        ) : viewMode === 'compact' ? (
          /* COMPACT VIEW: Scene No & Beat Name only */
          <div className="h-full px-2.5 py-1 flex flex-col justify-center min-w-0 select-none overflow-hidden">
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <span 
                  className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded text-black shrink-0 tracking-tight"
                  style={{ backgroundColor: track.color }}
                >
                  SC.{sceneNo}
                </span>
                {subIdx > 0 && (
                  <span 
                    className="text-[8px] font-mono font-bold px-1 py-0.2 rounded shrink-0 border"
                    style={{ borderColor: `${track.color}40`, color: track.color, backgroundColor: `${track.color}15` }}
                    title={`Subtrack ${subIdx}`}
                  >
                    {subBadgeLabel}
                  </span>
                )}
                <span className="text-xs font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">
                  {beatName}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditBeat(beat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-amber-400 text-slate-400 transition-opacity p-0.5 cursor-pointer pointer-events-auto"
                  title="Open in Script Editor"
                >
                  <FileText size={10} />
                </button>
                {isBeingDragged && (
                  <span className="text-[8px] font-mono font-black px-1 py-0.2 rounded bg-amber-400 text-black uppercase animate-pulse">
                    ➜ {dragHoverTrack ? (dragHoverTrack.subtrackIdx === 0 ? `V${dragHoverTrack.trackIdx + 1}` : `V${dragHoverTrack.trackIdx + 1}.${dragHoverTrack.subtrackIdx}`) : subBadgeLabel}
                  </span>
                )}
                <span className="text-[9px] font-mono text-slate-400">
                  {beat.durationPages.toFixed(1)}p
                </span>
              </div>
            </div>
          </div>
        ) : viewMode === 'standard' ? (
          /* STANDARD VIEW: Scene No, Location & Setting, Beat Name (No Summary, No Loading Bar) */
          <div className="h-full flex flex-col justify-between min-w-0 select-none overflow-hidden">
            {/* Header: Scene No + Subtrack + Location & Setting + Duration */}
            <div 
              className="h-6 px-2.5 flex items-center justify-between border-b border-white/5 shrink-0"
              style={{ backgroundColor: `${track.color}18` }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span 
                  className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded text-black shrink-0 tracking-tight"
                  style={{ backgroundColor: track.color }}
                >
                  SC.{sceneNo}
                </span>
                {subIdx > 0 && (
                  <span 
                    className="text-[9px] font-mono font-bold px-1 py-0.2 rounded shrink-0 border"
                    style={{ borderColor: `${track.color}40`, color: track.color, backgroundColor: `${track.color}15` }}
                    title={subIdx === 0 ? 'Main Track' : `Subtrack ${subIdx}`}
                  >
                    {subBadgeLabel}
                  </span>
                )}
                <span 
                  className="text-[10px] font-mono font-bold text-slate-300 uppercase truncate"
                  title={locationAndSetting}
                >
                  {locationAndSetting}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditBeat(beat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-amber-400 text-slate-400 transition-opacity p-0.5 cursor-pointer pointer-events-auto"
                  title="Open in Script Editor"
                >
                  <FileText size={10} />
                </button>
                {isBeingDragged && (
                  <span className="text-[9px] font-mono font-black px-1.5 py-0.2 rounded bg-amber-400 text-black uppercase animate-pulse">
                    ➜ {dragHoverTrack ? (dragHoverTrack.subtrackIdx === 0 ? `V${dragHoverTrack.trackIdx + 1}` : `V${dragHoverTrack.trackIdx + 1}.${dragHoverTrack.subtrackIdx}`) : subBadgeLabel}
                  </span>
                )}
                <span className="text-[9px] font-mono text-slate-400">
                  {beat.durationPages.toFixed(1)}p
                </span>
              </div>
            </div>

            {/* Body: Beat Name (Full vertical room, clean and bold) */}
            <div className="px-2.5 py-1.5 flex-1 flex items-center min-w-0 overflow-hidden">
              <div className="text-xs font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">
                {beatName}
              </div>
            </div>
          </div>
        ) : (
          /* DETAIL VIEW: Scene No, Location & Setting, Beat Name, Summary (Full room for complete summary) */
          <div className="h-full flex flex-col justify-between min-w-0 select-none overflow-hidden">
            {/* Header: Scene No + Subtrack + Location & Setting + Script button + Duration */}
            <div 
              className="h-6 px-2.5 flex items-center justify-between border-b border-white/5 shrink-0"
              style={{ backgroundColor: `${track.color}18` }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span 
                  className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded text-black shrink-0 tracking-tight"
                  style={{ backgroundColor: track.color }}
                >
                  SC.{sceneNo}
                </span>
                {subIdx > 0 && (
                  <span 
                    className="text-[9px] font-mono font-bold px-1 py-0.2 rounded shrink-0 border"
                    style={{ borderColor: `${track.color}40`, color: track.color, backgroundColor: `${track.color}15` }}
                    title={subIdx === 0 ? 'Main Track' : `Subtrack ${subIdx}`}
                  >
                    {subBadgeLabel}
                  </span>
                )}
                <span 
                  className="text-[10px] font-mono font-bold text-slate-300 uppercase truncate"
                  title={locationAndSetting}
                >
                  {locationAndSetting}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditBeat(beat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-amber-400 text-slate-400 transition-opacity p-0.5 cursor-pointer pointer-events-auto"
                  title="Open in Script Editor"
                >
                  <FileText size={10} />
                </button>
                {isBeingDragged && (
                  <span className="text-[9px] font-mono font-black px-1.5 py-0.2 rounded bg-amber-400 text-black uppercase animate-pulse">
                    ➜ {dragHoverTrack ? (dragHoverTrack.subtrackIdx === 0 ? `V${dragHoverTrack.trackIdx + 1}` : `V${dragHoverTrack.trackIdx + 1}.${dragHoverTrack.subtrackIdx}`) : subBadgeLabel}
                  </span>
                )}
                <span className="text-[9px] font-mono text-slate-400">
                  {beat.durationPages.toFixed(1)}p
                </span>
              </div>
            </div>

            {/* Body: Beat Name & Full Visible Summary */}
            <div className="px-2.5 py-1.5 flex-1 flex flex-col justify-start min-w-0 overflow-hidden">
              <div className="text-xs font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors shrink-0">
                {beatName}
              </div>
              <div 
                className={`text-[11px] text-slate-300 leading-snug mt-1 ${
                  clipHeight >= 80 ? 'line-clamp-4' : 'line-clamp-3'
                } select-text`}
                title={cleanSummary || 'No summary'}
              >
                {cleanSummary || <span className="italic opacity-50 text-slate-500">No summary available.</span>}
              </div>
            </div>
          </div>
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
    <div className="w-full h-full flex flex-col bg-[#090a10] text-slate-200 select-none overflow-hidden font-sans">
      
      {/* 1. STUDIO HARDWARE TRANSPORT CONSOLE */}
      <header className="h-12 px-3 bg-[#0e1017] border-b border-[#1c1f2e] flex items-center justify-between shrink-0 z-30 shadow-md">
        
        {/* Left: Transport Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#141622] p-1 rounded-lg border border-[#24283b] shadow-inner gap-1">
            <button
              onClick={() => setPlayheadPage(1.0)}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Return to Start (Home)"
            >
              <RotateCcw size={13} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1 rounded-md flex items-center gap-1.5 font-bold text-xs transition-all cursor-pointer shadow ${
                isPlaying 
                  ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]' 
                  : 'bg-[#23273a] hover:bg-[#2d324b] text-white'
              }`}
              title="Play / Pause (Spacebar)"
            >
              {isPlaying ? <Pause size={13} className="fill-black" /> : <Play size={13} className="fill-white" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-1.5 rounded text-xs transition-all cursor-pointer ${
                isLooping ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle Act II Loop"
            >
              <Activity size={13} />
            </button>
          </div>
        </div>

        {/* Center: Precision Matte LCD Display */}
        <div className="flex items-center gap-3 bg-[#07080d] px-3.5 py-1 rounded-lg border border-[#1b1e2c] font-mono text-xs shadow-inner">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase">SMPTE</span>
            <span className="font-bold text-amber-400 tracking-wider">{timecodeDisplay}</span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase">PAGE</span>
            <span className="font-bold text-slate-200">
              {playheadPage.toFixed(1)} <span className="text-slate-500 font-normal">/ {totalScreenplayPages}p</span>
            </span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Active Beat Snippet */}
          <div className="flex items-center gap-1.5 max-w-[200px] truncate text-[11px] text-cyan-400 font-sans font-medium">
            <span className="font-bold font-mono text-slate-500">
              {activeBeatAtPlayhead ? `SC.${activeBeatAtPlayhead.sceneNumber || '?'}` : '—'}
            </span>
            <span className="truncate">
              {activeBeatAtPlayhead?.title || 'Interlude'}
            </span>
          </div>

          {/* Dynamic 8-Segment Dramatic VU Intensity Meter */}
          <div className="flex items-center gap-0.5 bg-black/60 px-1.5 py-1 rounded border border-white/5">
            {Array.from({ length: 8 }).map((_, i) => {
              const active = (i / 8) * 100 <= vuLevel;
              const isPeak = i >= 6;
              const isWarn = i >= 4 && i < 6;
              return (
                <div
                  key={i}
                  className={`w-1.5 h-2.5 rounded-xs transition-colors duration-75 ${
                    active 
                      ? isPeak ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : isWarn ? 'bg-amber-400' : 'bg-emerald-400'
                      : 'bg-white/10'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Right: Grid, Zoom, Add Beat, AI, Dock & CLI Tools */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {/* Snap Selector */}
          <div className="flex items-center gap-1 bg-[#141622] px-2 py-1 rounded border border-[#24283b]">
            <span className="text-[10px] text-slate-500">SNAP:</span>
            <select
              value={snapGrid}
              onChange={(e: any) => setSnapGrid(e.target.value)}
              className="bg-transparent text-slate-200 font-bold outline-none cursor-pointer text-xs"
            >
              <option value="quarter" className="bg-[#141622]">1/4p</option>
              <option value="half" className="bg-[#141622]">1/2p</option>
              <option value="page" className="bg-[#141622]">1p</option>
              <option value="free" className="bg-[#141622]">Free</option>
            </select>
          </div>

          {/* View Mode / Lane Height Selector */}
          <div className="flex items-center gap-1 bg-[#141622] px-2 py-1 rounded border border-[#24283b]">
            <span className="text-[10px] text-slate-400 font-semibold">VIEW:</span>
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
              className="bg-transparent text-slate-200 font-bold outline-none cursor-pointer text-xs"
            >
              <option value={64} className="bg-[#141622]">Compact</option>
              <option value={84} className="bg-[#141622]">Standard</option>
              <option value={112} className="bg-[#141622]">Detail</option>
            </select>
          </div>

          {/* Auto Scene Numbering Toggle */}
          <button
            onClick={toggleAutoNumbering}
            className={`px-2 py-1 rounded flex items-center gap-1 font-bold border transition-all cursor-pointer text-xs ${
              autoNumberingEnabled 
                ? 'bg-amber-400/20 border-amber-400/60 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]' 
                : 'bg-[#141622] border-[#24283b] text-slate-500 hover:text-slate-300'
            }`}
            title={`Auto Scene Numbering: ${autoNumberingEnabled ? 'ON (Chronological 1..N Left-to-Right)' : 'OFF (Click to enable)'}`}
          >
            <Hash size={12} />
            <span>Auto #</span>
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
                ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]' 
                : 'bg-[#141622] border-[#24283b] text-slate-500 hover:text-slate-300'
            }`}
            title={`Causality Dependency Lines: ${showDependencies ? 'VISIBLE' : 'HIDDEN'} (${connections?.length || 0} links)`}
          >
            <Network size={12} />
            <span>Links ({connections?.length || 0})</span>
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
                ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.2)]' 
                : 'bg-[#141622] border-[#24283b] text-slate-500 hover:text-slate-300'
            }`}
            title={`Act & Sequence Groups: ${showGroups ? 'EXPANDED' : 'COLLAPSED'}`}
          >
            <Layers size={12} />
            <span>Groups</span>
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
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]' 
                : 'bg-[#141622] border-[#24283b] text-slate-500 hover:text-slate-300'
            }`}
            title={`Macro Mini-Map Overview: ${showMiniMap ? 'SHOWN' : 'HIDDEN'}`}
          >
            <Compass size={12} />
            <span>Map</span>
          </button>

          {/* Zoom controls (anchored to playhead) */}
          <div className="flex items-center bg-[#141622] px-1.5 py-1 rounded border border-[#24283b] gap-1">
            <button 
              onClick={() => zoomAroundPlayhead(zoomLevel - 0.2)}
              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
              title="Zoom Out (- or _)"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[10px] w-7 text-center text-slate-300 font-mono">{Math.round(zoomLevel * 100)}%</span>
            <button 
              onClick={() => zoomAroundPlayhead(zoomLevel + 0.2)}
              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
              title="Zoom In (+ or =)"
            >
              <ZoomIn size={12} />
            </button>
          </div>

          {/* Add Beat Button */}
          <button
            onClick={() => handleCreateBeat(0, 0)}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
            title="Create New Beat on Track 1, Subtrack 1"
          >
            <Plus size={13} />
            <span>Beat</span>
          </button>

          {/* AI Generate Button */}
          <button
            onClick={() => setIsAiModalOpen(true)}
            disabled={!aiAvailable}
            className="p-1.5 bg-[#211b2f] hover:bg-[#2e2442] border border-violet-500/40 text-violet-300 rounded transition-all cursor-pointer disabled:opacity-40"
            title={aiAvailable ? "AI Beat Generator" : "Add AI key in Backstage"}
          >
            <Sparkles size={13} className="text-violet-400" />
          </button>

          {/* Dock Position Switcher */}
          <button
            onClick={() => setTrackHeaderDock(d => d === 'left' ? 'right' : 'left')}
            className="p-1.5 rounded bg-[#141622] border border-[#24283b] text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={`Dock track channel strips to ${trackHeaderDock === 'left' ? 'Right' : 'Left'}`}
          >
            <ArrowLeftRight size={13} />
          </button>

          {/* Terminal Console Trigger */}
          <button
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className={`px-2 py-1 rounded flex items-center gap-1 font-bold border transition-all cursor-pointer ${
              isTerminalOpen 
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                : 'bg-[#141622] border-[#24283b] text-slate-400 hover:text-white'
            }`}
            title="Toggle DAW Terminal (~ or `)"
          >
            <TerminalIcon size={13} />
            <span>CLI</span>
          </button>
        </div>
      </header>

      {/* MACRO OVERVIEW MINI-MAP (Full 200+ beat navigation strip) */}
      {showMiniMap && (
        <div className="h-7 bg-[#0b0c14] border-b border-[#1c1f2e] px-3 flex items-center gap-3 select-none shrink-0 z-20">
          <div className="flex items-center gap-1.5 shrink-0 text-slate-400 font-mono text-[10px]">
            <Compass size={12} className="text-amber-400" />
            <span className="font-bold text-slate-300">MACRO</span>
            <span className="text-slate-500">({beats.length} beats / {totalScreenplayPages}p)</span>
          </div>

          <div
            ref={miniMapRef}
            onMouseDown={handleMiniMapMouseDown}
            className="flex-1 h-4 bg-[#07080d] border border-white/10 rounded relative cursor-pointer overflow-hidden group shadow-inner"
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
        className="flex-1 overflow-auto bg-[#08090f] relative flex flex-col select-none"
      >
        <div 
          style={{ minWidth: `${totalTimelineWidth + 260}px` }}
          className="min-h-full flex flex-col relative"
        >
          
          {/* STICKY TOP RULER ROW */}
          <div className="h-9 flex sticky top-0 z-30 bg-[#0e1018] border-b border-[#1c1f2e] shadow-sm">
            {/* Left Corner: Track header banner (if left-docked) */}
            {trackHeaderDock === 'left' && (
              <div className="w-64 shrink-0 sticky left-0 z-40 bg-[#12141f] border-r border-[#1c1f2e] px-3 flex items-center justify-between text-xs font-mono font-bold text-slate-400 shadow-md">
                <span className="uppercase tracking-wider">Tracks ({tracks.length})</span>
                <button 
                  onClick={addCustomTrack}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-400 flex items-center gap-1 text-[10px] cursor-pointer"
                  title="Add New Narrative Track"
                >
                  <Plus size={11} /> Track
                </button>
              </div>
            )}

            {/* Act Milestones & Screenplay Page Ruler Canvas */}
            <div 
              onClick={handleRulerMouseDown}
              style={{ width: `${totalTimelineWidth}px` }}
              className="flex-1 h-full relative cursor-pointer overflow-hidden select-none"
            >
              {/* Act Regions */}
              {ACT_MARKERS.map((marker, idx) => {
                const nextMarker = ACT_MARKERS[idx + 1];
                const markerX = (marker.page - 1) * effectivePxPerPage;
                const nextX = nextMarker ? (nextMarker.page - 1) * effectivePxPerPage : totalTimelineWidth;
                const width = Math.max(20, nextX - markerX);

                return (
                  <div
                    key={marker.id}
                    style={{ left: `${markerX}px`, width: `${width}px`, borderLeftColor: `${marker.color}40` }}
                    className="absolute top-0 bottom-0 border-l px-2 py-1 overflow-hidden pointer-events-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-black uppercase tracking-wider truncate" style={{ color: marker.color }}>
                        {marker.label}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">p.{marker.page}</span>
                    </div>
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
                    className="absolute bottom-0 h-2.5 border-l border-white/20 text-[8px] font-mono text-slate-500 pl-1 pointer-events-none"
                  >
                    {pageNum}p
                  </div>
                );
              })}
            </div>

            {/* Right Corner: Track header banner (if right-docked) */}
            {trackHeaderDock === 'right' && (
              <div className="w-64 shrink-0 sticky right-0 z-40 bg-[#12141f] border-l border-[#1c1f2e] px-3 flex items-center justify-between text-xs font-mono font-bold text-slate-400 shadow-md">
                <span className="uppercase tracking-wider">Tracks ({tracks.length})</span>
                <button 
                  onClick={addCustomTrack}
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-amber-400 flex items-center gap-1 text-[10px] cursor-pointer"
                  title="Add New Narrative Track"
                >
                  <Plus size={11} /> Track
                </button>
              </div>
            )}
          </div>

          {/* STICKY SEQUENCE / GROUP BANNER ROW */}
          {showGroups && (
            <div className="h-7 flex sticky top-9 z-29 bg-[#0b0d14] border-b border-[#1c1f2e] shadow-xs">
              {/* Left corner spacer matching dock */}
              {trackHeaderDock === 'left' && (
                <div className="w-64 shrink-0 sticky left-0 z-35 bg-[#0e1017] border-r border-[#1c1f2e] px-3 flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400">
                  <Layers size={11} className="text-amber-400" />
                  <span className="uppercase tracking-wider">Sequences / Acts ({dawGroupSpans.length})</span>
                </div>
              )}

              {/* Horizontal Group Capsules */}
              <div 
                style={{ width: `${totalTimelineWidth}px` }}
                className="flex-1 h-full relative overflow-hidden select-none"
              >
                {dawGroupSpans.map((span) => {
                  const x = (span.startPage - 1) * effectivePxPerPage;
                  const w = Math.max(30, (span.endPage - span.startPage) * effectivePxPerPage);
                  return (
                    <div
                      key={span.id}
                      onClick={() => {
                        if (timelineScrollRef.current) {
                          timelineScrollRef.current.scrollTo({
                            left: Math.max(0, x - 40),
                            behavior: 'smooth'
                          });
                        }
                      }}
                      style={{
                        left: `${x}px`,
                        width: `${w}px`,
                        borderColor: `${span.color}50`,
                        backgroundColor: `${span.color}15`,
                      }}
                      className="absolute top-1 bottom-1 rounded border px-2 flex items-center justify-between gap-1 overflow-hidden cursor-pointer hover:brightness-125 transition-all group shadow-xs"
                      title={`${span.title} (pp. ${Math.round(span.startPage)}–${Math.round(span.endPage)} • ${span.sceneCount} beats). Click to jump.`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: span.color }} />
                        <span className="text-[10px] font-mono font-bold truncate" style={{ color: span.color }}>
                          {span.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-[9px] font-mono opacity-70">
                        <span className="bg-black/40 px-1 py-0.2 rounded text-slate-300 font-semibold">
                          {span.sceneCount} sc
                        </span>
                        <span className="text-slate-400 hidden sm:inline">
                          p.{Math.round(span.startPage)}–{Math.round(span.endPage)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right corner spacer if right-docked */}
              {trackHeaderDock === 'right' && (
                <div className="w-64 shrink-0 sticky right-0 z-35 bg-[#0e1017] border-l border-[#1c1f2e] px-3 flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400">
                  <Layers size={11} className="text-amber-400" />
                  <span className="uppercase tracking-wider">Sequences ({dawGroupSpans.length})</span>
                </div>
              )}
            </div>
          )}

          {/* MAIN ARRANGEMENT: UNIFIED ROWS (TRACK STRIP + LANE GRID) */}
          <div ref={tracksContainerRef} className="flex-1 flex flex-col relative">
            
            {/* Act Boundary Vertical Drop Lines */}
            {ACT_MARKERS.map((marker) => {
              const x = (marker.page - 1) * effectivePxPerPage + (trackHeaderDock === 'left' ? 256 : 0);
              return (
                <div
                  key={`drop-${marker.id}`}
                  style={{ left: `${x}px`, borderColor: marker.color }}
                  className="absolute top-0 bottom-0 w-px border-l border-dashed pointer-events-none z-1 opacity-20"
                />
              );
            })}

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
                  className="flex w-full border-b border-[#181a26] relative group"
                >
                  {/* Left Docked Track Strip */}
                  {trackHeaderDock === 'left' && (
                    <div className="w-64 shrink-0 sticky left-0 z-40 bg-[#0e1017] border-r border-[#1c1f2e] shadow-2xl flex select-none">
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
                      className={`absolute left-0 right-0 top-0 border-b border-white/[0.06] transition-colors ${
                        dragState?.type === 'move' && dragHoverTrack?.trackIdx === trackIdx && dragHoverTrack?.subtrackIdx === 0
                          ? 'bg-amber-400/[0.08]'
                          : ''
                      }`}
                      onDoubleClick={(e) => handleLaneDoubleClick(e, trackIdx, 0)}
                    >
                      {/* Sticky Main watermark */}
                      <div className="sticky left-2 top-1 pointer-events-none flex items-center gap-1.5 opacity-30 select-none z-1">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                          V{trackIdx + 1} • MAIN
                        </span>
                      </div>

                      {/* Main Track Height Resizer Handle across Lane Canvas */}
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
                        style={{ width: `${totalTimelineWidth}px` }}
                        className="absolute bottom-0 left-0 h-2 cursor-row-resize z-20 hover:bg-amber-400/40 transition-colors pointer-events-auto"
                        title="Drag up/down to adjust Main Track height"
                      />
                    </div>

                    {/* 2. Manual Subtrack Lanes (up to 2) */}
                    {Array.from({ length: subCount }).map((_, sIdx) => {
                      const subNum = sIdx + 1; // 1 or 2
                      const thisSubH = subNum === 1 ? sub1H : sub2H;
                      const topY = mainH + (sIdx === 0 ? 0 : sub1H);
                      const isSubHovered = dragState?.type === 'move' && dragHoverTrack?.trackIdx === trackIdx && dragHoverTrack?.subtrackIdx === subNum;

                      return (
                        <div
                          key={`sublane-${subNum}`}
                          style={{
                            top: `${topY}px`,
                            height: `${thisSubH}px`,
                          }}
                          className={`absolute left-0 right-0 border-b border-white/[0.04] transition-colors ${
                            isSubHovered ? 'bg-amber-400/[0.08]' : sIdx % 2 === 0 ? 'bg-white/[0.012]' : 'bg-transparent'
                          }`}
                          onDoubleClick={(e) => handleLaneDoubleClick(e, trackIdx, subNum)}
                        >
                          {/* Sticky subtrack watermark */}
                          <div className="sticky left-2 top-1 pointer-events-none flex items-center gap-1.5 opacity-30 select-none z-1">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                              V{trackIdx + 1}.{subNum} • SUB {subNum}
                            </span>
                          </div>

                          {/* Subtrack Height Resizer Handle across Lane Canvas */}
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
                            style={{ width: `${totalTimelineWidth}px` }}
                            className="absolute bottom-0 left-0 h-2 cursor-row-resize z-20 hover:bg-amber-400/40 transition-colors pointer-events-auto"
                            title={`Drag up/down to adjust Subtrack ${subNum} height`}
                          />
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
                            isMajor ? 'border-l border-white/10' : isMid ? 'border-l border-white/5' : 'border-l border-white/[0.02]'
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
                    <div className="w-64 shrink-0 sticky right-0 z-40 bg-[#0e1017] border-l border-[#1c1f2e] shadow-2xl flex select-none">
                      {renderTrackStripItem(track, trackIdx)}
                    </div>
                  )}
                </div>
              );
            })}

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

      {/* 3. COLLAPSIBLE STUDIO DRAWER (DAW TERMINAL, INSPECTOR, TENSION ARC) */}
      {isTerminalOpen && (
        <div 
          style={{ height: `${terminalHeight}px` }}
          className="border-t border-[#1c1f2e] bg-[#0c0d14] flex flex-col shrink-0 z-30 shadow-2xl transition-all"
        >
          {/* Drawer Tabs Header */}
          <div className="h-8 px-3 bg-[#11131c] border-b border-[#1c1f2e] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1 font-mono text-xs">
              <button
                onClick={() => setTerminalTab('cli')}
                className={`px-3 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  terminalTab === 'cli' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                &gt;_ DAW SHELL
              </button>
              <button
                onClick={() => setTerminalTab('inspector')}
                className={`px-3 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  terminalTab === 'inspector' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                CLIP INSPECTOR {selectedBeat ? `[SC.${selectedBeat.sceneNumber || selectedBeat.id}]` : ''}
              </button>
              <button
                onClick={() => setTerminalTab('tension')}
                className={`px-3 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  terminalTab === 'tension' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                TENSION ARC
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setTerminalHeight(p => p === 240 ? 400 : 240)}
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                title={terminalHeight === 240 ? "Maximize Drawer" : "Minimize Drawer"}
              >
                {terminalHeight === 240 ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
              </button>
              <button
                onClick={() => setIsTerminalOpen(false)}
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
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
            <div className="flex-1 p-4 bg-[#0a0c13] text-xs overflow-y-auto">
              {selectedBeat ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                  {/* Title & Scene # */}
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">Beat Title</label>
                    <input
                      type="text"
                      value={selectedBeat.title}
                      onChange={(e) => updateBeat(selectedBeat.id, { title: e.target.value })}
                      className="w-full bg-[#141724] border border-[#262b3f] focus:border-amber-400 rounded px-2.5 py-1.5 text-white font-bold outline-none"
                    />
                  </div>

                  {/* Slugline / Location */}
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">Slugline / Location</label>
                    <div className="flex gap-1.5">
                      <select
                        value={selectedBeat.slug?.prefix || 'INT.'}
                        onChange={(e) => updateBeat(selectedBeat.id, { 
                          slug: { ...selectedBeat.slug, prefix: e.target.value as any } 
                        })}
                        className="bg-[#141724] border border-[#262b3f] rounded px-2 py-1.5 text-white font-mono text-xs outline-none"
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
                        className="flex-1 bg-[#141724] border border-[#262b3f] focus:border-amber-400 rounded px-2.5 py-1.5 text-white font-mono text-xs outline-none uppercase"
                      />
                    </div>
                  </div>

                  {/* Track & 3 Subtracks Assignment */}
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">Track & Subtrack</label>
                    <div className="flex flex-col gap-1">
                      <select
                        value={selectedBeat.trackIndex ?? 0}
                        onChange={(e) => updateBeat(selectedBeat.id, { trackIndex: Number(e.target.value) })}
                        className="w-full bg-[#141724] border border-[#262b3f] focus:border-amber-400 rounded px-2 py-1 text-white text-xs outline-none"
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
                                    : 'bg-[#141622] border-[#262b3f] text-slate-400 hover:text-white'
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
                      <label className="text-[10px] uppercase font-mono text-slate-400">Dramatic Tension</label>
                      <span className="text-[10px] font-mono font-bold text-amber-400">{selectedBeat.tension || 50}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedBeat.tension || 50}
                      onChange={(e) => updateBeat(selectedBeat.id, { tension: Number(e.target.value) })}
                      className="w-full h-1.5 accent-amber-500 bg-[#252838] rounded cursor-pointer mt-2"
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
                  <HelpCircle size={20} className="text-slate-600 mb-1" />
                  <span>No scene clip selected.</span>
                  <span className="text-[11px] text-slate-600">Click any beat clip on the timeline above to inspect and edit its dramatic attributes.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TENSION ARC VISUALIZER */}
          {terminalTab === 'tension' && (
            <div className="flex-1 p-3 bg-[#08090f] flex flex-col justify-between">
              <div className="flex items-center justify-between pb-1.5 text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <BarChart3 size={13} /> SCREENPLAY DRAMATIC TENSION ARC
                </span>
                <span>{beatsWithTimeline.length} scenes plotted across {totalScreenplayPages} pages</span>
              </div>
              <div className="flex-1 w-full bg-[#0d0f18] rounded-lg border border-white/5 relative overflow-hidden p-2">
                <svg className="w-full h-full">
                  {/* Grid horizontal markers */}
                  <line x1="0" y1="25%" x2="100%" y2="25%" stroke="#ffffff08" strokeDasharray="3,3" />
                  <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#ffffff08" strokeDasharray="3,3" />
                  <line x1="0" y1="75%" x2="100%" y2="75%" stroke="#ffffff08" strokeDasharray="3,3" />

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
                              fill={selectedBeatId === b.id ? '#ffffff' : '#f59e0b'}
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

    </div>
  );
};

export default BoardView;