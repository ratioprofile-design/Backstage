import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';
import { Beat, TimelineTrack } from '../../types';
import { 
  Play, Pause, RotateCcw, Activity, Terminal as TerminalIcon,
  Plus, Trash2, Copy, Edit3, Sparkles,
  Maximize2, Minimize2, ZoomIn, ZoomOut,
  FileText, X, ArrowUp, ArrowDown, Check,
  Settings2, ArrowLeftRight, CornerDownLeft, BarChart3, HelpCircle,
  ChevronDown, ChevronRight, Layers
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

export const getTrackTotalHeight = (track: TimelineTrack, globalLaneHeight: number): number => {
  const mainH = track.height || globalLaneHeight;
  const subCount = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, track.subtrackCount || 0));
  if (subCount === 0) return mainH;
  const subH = getSubtrackHeight(mainH);
  return mainH + (subCount * subH);
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
    currentProjectId
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

  // Dragging / Trimming Clip State (Tracks both master track and subtrack 0, 1, 2)
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
  }, [selectedBeatId, beats, zoomLevel, playheadPage, trackHeaderDock, pixelsPerPage]);

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
            const subH = getSubtrackHeight(mainH);
            const totalTrackH = mainH + (subCount * subH);

            if (relativeY >= cumulativeY && relativeY < cumulativeY + totalTrackH) {
              targetTrack = i;
              const relativeYInTrack = relativeY - cumulativeY;
              if (relativeYInTrack < mainH || subCount === 0) {
                targetSubtrack = 0; // Main Track
              } else {
                targetSubtrack = Math.min(subCount, Math.floor((relativeYInTrack - mainH) / subH) + 1);
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
      setDragHoverTrack(null);
      lastAppliedDragRef.current = null;
      pendingMouseCoordsRef.current = null;
      captureSnapshot();
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
  }, [dragState, effectivePxPerPage, tracks, globalLaneHeight]);

  // Scrub ruler
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
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

  // Helper to create a new beat clip on the active track and subtrack (0, 1, or 2)
  const handleCreateBeat = (trackIdx = 0, subtrackIdx = 0) => {
    const newBeatTitle = `Scene ${beats.length + 1}`;
    const newId = Date.now();
    const safeTrackIdx = Math.max(0, Math.min(tracks.length - 1, trackIdx));
    const curTrack = tracks[safeTrackIdx];
    const maxSub = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, curTrack?.subtrackCount || 0));
    const safeSubtrackIdx = Math.max(0, Math.min(maxSub, subtrackIdx));

    const newBeat: Beat = {
      id: newId,
      x: 100,
      y: 100,
      title: newBeatTitle,
      sceneNumber: String(beats.length + 1),
      summary: 'New dramatic sequence.',
      slug: { prefix: 'INT.', location: 'SCENE LOCATION', time: 'DAY' },
      content: '<p>Scene action begins...</p>',
      trackIndex: safeTrackIdx,
      subtrackIndex: safeSubtrackIdx,
      startTime: Math.round(playheadPage),
      durationWidth: 2.5 * pixelsPerPage,
      tension: 50
    };
    setBeats([...beats, newBeat]);
    setSelectedBeatId(newId);
    captureSnapshot();
    const subLabel = safeSubtrackIdx === 0 ? 'Main' : `Sub ${safeSubtrackIdx}`;
    logTerminal('info', `Created "${newBeatTitle}" in track V${safeTrackIdx + 1} (${subLabel}), page ${Math.round(playheadPage)}.`);
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
          className="px-3 pt-2.5 pb-2 flex flex-col justify-between border-b border-white/[0.06] bg-[#121420]/90"
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
        </div>

        {/* 2. Manually Created Subtrack Rows (up to 2) */}
        {subCount > 0 && (
          <div className="flex flex-col">
            {Array.from({ length: subCount }).map((_, sIdx) => {
              const subNum = sIdx + 1; // 1 or 2
              const subBeats = trackBeats.filter(b => b.timelineSubtrackIdx === subNum);
              const isSubHovered = dragState?.type === 'move' && dragHoverTrack?.trackIdx === trackIdx && dragHoverTrack?.subtrackIdx === subNum;

              return (
                <div
                  key={`strip-sub-${subNum}`}
                  style={{ height: `${subH}px` }}
                  className={`px-3 flex items-center justify-between border-t border-white/[0.05] transition-colors group/sub ${
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
    const isBeingDragged = dragState?.beatId === beat.id && dragState.type === 'move';
    const clipLeft = (beat.startPage - 1) * effectivePxPerPage;
    const clipWidth = Math.max(48, beat.durationPages * effectivePxPerPage);
    const mainH = track.height || globalLaneHeight;
    const subH = getSubtrackHeight(mainH);
    const subIdx = beat.timelineSubtrackIdx ?? 0; // 0 = Main, 1 = Sub 1, 2 = Sub 2
    
    let clipTop = 6;
    let clipHeight = Math.max(46, mainH - 12);

    if (subIdx === 1) {
      clipTop = mainH + 4;
      clipHeight = Math.max(44, subH - 8);
    } else if (subIdx === 2) {
      clipTop = mainH + subH + 4;
      clipHeight = Math.max(44, subH - 8);
    }

    const cleanSummary = (beat.summary || (beat.content || '').replace(/<[^>]*>/g, ' ')).trim();
    const subBadgeLabel = subIdx === 0 ? `V${beat.timelineTrackIdx + 1}` : `${beat.timelineTrackIdx + 1}.${subIdx}`;

    return (
      <div
        key={beat.id}
        style={{
          left: `${clipLeft}px`,
          width: `${clipWidth}px`,
          height: `${clipHeight}px`,
          top: `${clipTop}px`,
          borderColor: isSelected || isBeingDragged ? '#f59e0b' : `${track.color}50`,
          backgroundColor: isBeingDragged ? '#1a1d2e' : isSelected ? '#151826' : '#10121d',
          zIndex: isBeingDragged ? 50 : isSelected ? 20 : 2,
          transform: isBeingDragged ? 'scale(1.02)' : 'none',
          willChange: isBeingDragged ? 'left, top' : 'auto',
        }}
        onMouseDown={(e) => handleTimelineMouseDown(e, beat.id, 'move')}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEditBeat(beat.id);
        }}
        className={`absolute rounded-lg border shadow-sm select-none overflow-hidden flex flex-col justify-between ${
          isBeingDragged 
            ? 'shadow-[0_16px_36px_rgba(0,0,0,0.85)] ring-2 ring-amber-400 cursor-grabbing transition-none pointer-events-none' 
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

        {/* 1. Clip Top Header: Scene # Badge + Subtrack Pill + Slugline + Duration */}
        <div 
          className="h-6 px-2.5 flex items-center justify-between border-b border-white/5 shrink-0"
          style={{ backgroundColor: `${track.color}18` }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span 
              className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded text-black shrink-0 tracking-tight"
              style={{ backgroundColor: track.color }}
            >
              SC.{beat.sceneNumber || beat.id}
            </span>
            <span 
              className="text-[9px] font-mono font-bold px-1 py-0.2 rounded shrink-0 border"
              style={{ borderColor: `${track.color}40`, color: track.color, backgroundColor: `${track.color}15` }}
              title={subIdx === 0 ? 'Main Track' : `Subtrack ${subIdx}`}
            >
              {subBadgeLabel}
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-300 uppercase truncate">
              {beat.slug?.prefix || 'INT.'} {beat.slug?.location || 'SCENE'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
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

        {/* 2. Clip Body: Scene Title & Clean Synopsis Snippet (Detailed layout by default) */}
        <div className="px-2.5 py-1 flex-1 flex flex-col justify-center min-w-0 overflow-hidden">
          <div className="text-xs font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">
            {beat.title || 'Untitled Beat'}
          </div>
          {cleanSummary && clipHeight >= 64 && (
            <div className="text-[10px] text-slate-400 line-clamp-1 leading-tight mt-0.5">
              {cleanSummary}
            </div>
          )}
        </div>

        {/* 3. Clip Bottom Bar: Dramatic Tension Indicator & Quick Action */}
        {clipHeight >= 56 && (
          <div className="h-5 px-2.5 flex items-center justify-between bg-black/30 border-t border-white/5 text-[9px] font-mono shrink-0">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Activity size={10} className={beat.tension && beat.tension > 70 ? 'text-red-400' : 'text-amber-400'} />
              <span className="text-slate-300 font-semibold">{beat.tension || 50}%</span>
              <div className="w-8 h-1 bg-white/10 rounded-full overflow-hidden hidden sm:block">
                <div 
                  className={`h-full rounded-full ${beat.tension && beat.tension > 70 ? 'bg-red-400' : 'bg-amber-400'}`} 
                  style={{ width: `${beat.tension || 50}%` }} 
                />
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditBeat(beat.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-amber-400 text-slate-400 transition-opacity flex items-center gap-1 cursor-pointer pointer-events-auto"
              title="Open in Script Editor"
            >
              <span>Script</span>
              <FileText size={10} />
            </button>
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

          {/* Lane Height Selector */}
          <div className="flex items-center gap-1 bg-[#141622] px-2 py-1 rounded border border-[#24283b]">
            <span className="text-[10px] text-slate-500">HEIGHT:</span>
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
              <option value={112} className="bg-[#141622]">Detailed</option>
            </select>
          </div>

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

      {/* 2. UNIFIED SYNCHRONIZED TIMELINE ARRANGEMENT */}
      <div 
        ref={timelineScrollRef}
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

            {/* Unified Track Rows with Main Track and up to 2 Manual Subtracks */}
            {tracks.map((track, trackIdx) => {
              const mainH = track.height || globalLaneHeight;
              const subCount = Math.min(MAX_SUBTRACKS_PER_TRACK, Math.max(0, track.subtrackCount || 0));
              const subH = getSubtrackHeight(mainH);
              const totalLaneH = mainH + (subCount * subH);

              return (
                <div 
                  key={track.id}
                  style={{ height: `${totalLaneH}px` }}
                  className="flex w-full border-b border-[#181a26] relative group"
                >
                  {/* Left Docked Track Strip */}
                  {trackHeaderDock === 'left' && (
                    <div className="w-64 shrink-0 sticky left-0 z-20 border-r border-[#1c1f2e] shadow-md flex">
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
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleCreateBeat(trackIdx, 0);
                      }}
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
                      const topY = mainH + (sIdx * subH);
                      const isSubHovered = dragState?.type === 'move' && dragHoverTrack?.trackIdx === trackIdx && dragHoverTrack?.subtrackIdx === subNum;

                      return (
                        <div
                          key={`sublane-${subNum}`}
                          style={{
                            top: `${topY}px`,
                            height: `${subH}px`,
                          }}
                          className={`absolute left-0 right-0 border-b border-white/[0.04] transition-colors ${
                            isSubHovered ? 'bg-amber-400/[0.08]' : sIdx % 2 === 0 ? 'bg-white/[0.012]' : 'bg-transparent'
                          }`}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleCreateBeat(trackIdx, subNum);
                          }}
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
                    <div className="w-64 shrink-0 sticky right-0 z-20 border-l border-[#1c1f2e] shadow-md flex">
                      {renderTrackStripItem(track, trackIdx)}
                    </div>
                  )}
                </div>
              );
            })}

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