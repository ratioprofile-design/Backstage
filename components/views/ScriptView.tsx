
import React, { useEffect, useRef, useState, useMemo, useLayoutEffect, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';
import { 
  Search, Plus, Sun, Moon, Coffee, Eye, ZoomIn, ZoomOut, Lock, Unlock, 
  AlignLeft, User, MessageSquare, Parentheses, ArrowRightLeft, Camera, 
  Music, Type, ListChecks, Sparkles, X, Package, Mic2, Shirt, Wand2, 
  Users, Flame, Map as MapIcon, EyeOff, PanelLeft, History, StickyNote, 
  RotateCcw, Save, Globe, Trash2, GripHorizontal, Bold, Italic, Heading, 
  List, CheckSquare, Underline, Strikethrough, Quote, LayoutGrid, Palette, 
  Check, Clock, MoreHorizontal, MousePointer2, Layers, Link2, AlertCircle, 
  ChevronRight, ChevronDown, Settings, Copy, PlusSquare, ArrowUp, ArrowDown,
  Highlighter, Tag, Scissors, ExternalLink, RefreshCw, FileText, ArrowRight,
  Volume2, Square, Hash, BookOpen, Scroll
} from 'lucide-react';
import { ScriptEditor, ScriptEditorHandle } from '../ScriptEditor';
import { SlugInput } from '../SlugInput';
import { generateBreakdown } from '../../services/gemini';
import { BreakdownData, BreakdownItem, BeatVersion, Note, Beat, Group, Connection, BeatStatus } from '../../types';
import { STORYLINE_COLORS, SUPPORTED_LANGUAGES } from '../../constants';
import { extractScriptCharacterSuggestions } from '../../utils/characterUtils';
import { BlockEditor } from '../BlockEditor';
import DiffModal from '../DiffModal';
import ScriptArchiveModal from '../ScriptArchiveModal';
import TamilTranscoderModal from '../TamilTranscoderModal';
import { Archive } from 'lucide-react';
import { runLinePaginationPass, estimateBeatHeight } from '../../utils/screenplayPaginationEngine';
import { isTauri } from '../../utils/desktop';

const DEFAULT_STORYLINE_COLORS = (typeof STORYLINE_COLORS !== 'undefined' && Array.isArray(STORYLINE_COLORS)) 
  ? STORYLINE_COLORS 
  : ['#e67e22', '#3498db', '#9b59b6', '#2ecc71', '#e74c3c'];
// --- CONSTANTS ---
const A4_WIDTH = 794;  
const A4_HEIGHT = 1123;
const MARGIN_LEFT = 144;
const MARGIN_RIGHT = 96;
const MARGIN_TOP = 96;
const MARGIN_BOTTOM = 96;
const PAGE_GAP = 20; 
const BEAT_SPACING = 0; 
const CONTINUOUS_OVERSCROLL = 400; 
const SLUG_PREFIXES = ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.', 'I./E.', 'E./I.'];
const SLUG_TIMES = ['DAY', 'NIGHT', 'CONTINUOUS', 'MOMENTS LATER', 'MORNING', 'EVENING', 'LATER', 'SAME TIME', 'DAWN', 'DUSK'];

const TEXT_COLORS = [
    { name: 'White', value: '#ffffff' },
    { name: 'Amber', value: '#f5a623' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Purple', value: '#a855f7' },
];

const HILITE_COLORS = [
    { name: 'None', value: 'transparent' },
    { name: 'Gray', value: 'rgba(120,120,120,0.3)' },
    { name: 'Yellow', value: 'rgba(245,166,35,0.3)' },
    { name: 'Red', value: 'rgba(239,68,68,0.3)' },
    { name: 'Green', value: 'rgba(34,197,94,0.3)' },
    { name: 'Blue', value: 'rgba(59,130,246,0.3)' },
];

// --- HELPERS ---
function useDebounce<T extends (...args: any[]) => void>(func: T, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: Parameters<T>) => { if (timeoutRef.current) clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(() => { func(...args); }, delay); }, [func, delay]);
}

interface SidebarErrorBoundaryProps {
  children: React.ReactNode;
  isLight: boolean;
  onReset?: () => void;
}

interface SidebarErrorBoundaryState {
  hasError: boolean;
}

class SidebarErrorBoundary extends (React.Component as any) {
  state = { hasError: false };

  constructor(props: any) {
    super(props);
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.error("Sidebar caught an error:", error);
  }
  render() {
    if ((this as any).state.hasError) {
      return (
        <div className="p-6 flex flex-col items-center justify-center h-full text-center gap-3">
          <AlertCircle size={32} style={{ color: 'var(--app-accent, #f5a623)' }} />
          <h4 className="text-xs font-bold uppercase tracking-wider">Sidebar Display Protected</h4>
          <p className="text-[11px] text-gray-500 max-w-xs">An error occurred while loading this sidebar panel. Click below to reload.</p>
          <button 
            onClick={() => { (this as any).setState({ hasError: false }); if ((this as any).props.onReset) (this as any).props.onReset(); }}
            className="px-3 py-1.5 text-black text-[10px] font-bold uppercase rounded transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--app-accent, #f5a623)' }}
          >
            Reload Panel
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const calculateGraphOrder = (beats: Beat[], connections: Connection[]) => {
    const adjDir: Record<number, number[]> = {};
    const inDegree: Record<number, number> = {};
    const beatMap = new Map<number, Beat>();
    const connectedSet = new Set<number>();

    beats.forEach(b => {
        adjDir[b.id] = [];
        inDegree[b.id] = 0;
        beatMap.set(b.id, b);
    });

    connections.forEach(c => {
        if (adjDir[c.from]) {
            adjDir[c.from].push(c.to);
            connectedSet.add(c.from);
            connectedSet.add(c.to);
        }
        if (inDegree[c.to] !== undefined) inDegree[c.to]++;
    });

    const orders: Record<number, number> = {};
    const queue: number[] = [];
    const currentInDegree = { ...inDegree };

    const sortedBeats = [...beats].sort((a,b) => {
        if ((a.boardId || 0) !== (b.boardId || 0)) return (a.boardId || 0) - (b.boardId || 0);
        if (Math.abs(a.x - b.x) > 100) return a.x - b.x;
        return a.y - b.y;
    });

    sortedBeats.forEach(b => {
        const hasManual = b.sceneNumber && !isNaN(parseInt(b.sceneNumber));
        const isConnected = connectedSet.has(b.id);
        if (currentInDegree[b.id] === 0) {
            if (isConnected || hasManual) {
                queue.push(b.id);
                orders[b.id] = hasManual ? parseInt(b.sceneNumber!) : 1;
            }
        }
    });

    while (queue.length > 0) {
        const u = queue.shift()!;
        const currentOrder = orders[u];
        if (adjDir[u]) {
            const children = adjDir[u].sort((a, b) => {
                const beatA = beatMap.get(a);
                const beatB = beatMap.get(b);
                if (!beatA || !beatB) return 0;
                return beatA.y - beatB.y;
            });
            children.forEach(v => {
                const nextOrder = currentOrder + 1;
                if (!orders[v] || nextOrder > orders[v]) {
                    orders[v] = nextOrder;
                }
                currentInDegree[v]--;
                if (currentInDegree[v] <= 0) {
                    queue.push(v);
                }
            });
        }
    }
    return { connectedSet, orders };
};

interface BeatEditorBlockProps { beat: Beat; isActive: boolean; isReady: boolean; uniqueCharacters: string[]; setActiveFormat: (format: string) => void; onUpdateContent: (id: number, content: string) => void; onFocus: () => void; editorRefCallback: (el: ScriptEditorHandle | null) => void; }
const BeatEditorBlock: React.FC<BeatEditorBlockProps> = React.memo(({ beat, isActive, isReady, uniqueCharacters, setActiveFormat, onUpdateContent, onFocus, editorRefCallback }) => {
    const debouncedSave = useDebounce((content: string) => { onUpdateContent(beat.id, content); }, 500);
    const handleImmediateSave = (content: string) => { onUpdateContent(beat.id, content); };
    return ( <ScriptEditor ref={editorRefCallback} id={`editor-${beat.id}`} initialHtml={beat.content} onSave={debouncedSave} onSaveImmediate={handleImmediateSave} suggestions={uniqueCharacters} readOnly={isReady} onFocus={onFocus} onActiveFormatChange={setActiveFormat} className="script-body min-h-[1.5em] outline-none" isActive={isActive} /> );
}, (prev, next) => { return prev.beat.id === next.beat.id && prev.beat.content === next.beat.content && prev.isActive === next.isActive && prev.isReady === next.isReady; });

const SummaryCardsPanel = ({ 
    beats, groups, connections, activeBeatId, onBeatClick, updateBeat, setBeats, captureSnapshot, reorderBeats, isLight, onSummaryDoubleClick, beatPageMap
}: { 
    beats: Beat[], groups: Group[], connections: Connection[], activeBeatId: number | null, 
    onBeatClick: (id: number) => void, updateBeat: (id: number, data: Partial<Beat>) => void, 
    setBeats: (val: Beat[] | ((prev: Beat[]) => Beat[])) => void, 
    captureSnapshot: () => void,
    reorderBeats: (draggedId: number, targetId: number, side: 'top' | 'bottom') => void,
    isLight?: boolean,
    onSummaryDoubleClick?: (beatId: number) => void,
    beatPageMap?: Record<number, number>
}) => {
    const { appAccentColor = '#f5a623' } = useProject();
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const [dropSide, setDropSide] = useState<'top' | 'bottom'>('top');

    const safeBeats = Array.isArray(beats) ? beats : [];

    const filteredBeats = useMemo(() => {
        if (!searchTerm.trim()) return safeBeats;
        const q = searchTerm.toLowerCase();
        return safeBeats.filter(beat => {
            const loc = (beat.slug?.location || '').toLowerCase();
            const time = (beat.slug?.time || '').toLowerCase();
            const prefix = (beat.slug?.prefix || '').toLowerCase();
            const summary = (beat.summary || '').toLowerCase();
            const title = (beat.title || '').toLowerCase();
            const num = (beat.sceneNumber || '').toLowerCase();
            return loc.includes(q) || summary.includes(q) || title.includes(q) || num.includes(q) || prefix.includes(q) || time.includes(q);
        });
    }, [safeBeats, searchTerm]);

    // Compute page numbers from word count
    const beatPageNumbers = useMemo(() => {
        const pageMap: Record<number, number> = {};
        let runningPages = 0;
        safeBeats.forEach((b) => {
            const startPg = Math.max(1, Math.floor(runningPages) + 1);
            pageMap[b.id] = startPg;
            const text = (b.content ? b.content.replace(/<[^>]*>/g, ' ') : '') + ' ' + (b.summary || '');
            const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
            const estimatedBeatPages = Math.max(0.125, wordCount / 180);
            runningPages += estimatedBeatPages;
        });
        return pageMap;
    }, [safeBeats]);

    // Build sequence info using the graph order logic
    const sequenceInfo = useMemo(() => {
        const connectedSet = new Set<number>();
        connections.forEach(c => { connectedSet.add(c.from); connectedSet.add(c.to); });
        
        // Compute graph order
        const orders = calculateGraphOrder(safeBeats, connections).orders;
        
        const info: Record<number, { isSequenced: boolean; seqOrder: number | null; fromCount: number; toCount: number }> = {};
        safeBeats.forEach(b => {
            const hasManual = b.sceneNumber && !isNaN(parseInt(b.sceneNumber));
            const isConnected = connectedSet.has(b.id);
            const isSeq = isConnected || !!hasManual || orders[b.id] !== undefined;
            info[b.id] = {
                isSequenced: isSeq,
                seqOrder: orders[b.id] ?? (hasManual ? parseInt(b.sceneNumber!) : null),
                fromCount: connections.filter(c => c.from === b.id).length,
                toCount: connections.filter(c => c.to === b.id).length,
            };
        });
        return info;
    }, [safeBeats, connections]);

    // Extract characters from beat content
    const extractCharacters = (content: string): string[] => {
        const div = document.createElement('div');
        div.innerHTML = content;
        const chars = new Set<string>();
        div.querySelectorAll('.sc-character').forEach(el => {
            const name = el.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
            if (name && name.length > 1) chars.add(name);
        });
        return Array.from(chars).slice(0, 4);
    };

    // Get word count from content
    const getWordCount = (content: string): number => {
        const text = content.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
        if (text.length === 0) return 0;
        return text.split(/\s+/).filter(w => w.length > 0).length;
    };

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, beatId: number } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, id: number) => {
        e.preventDefault(); e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, beatId: id });
    };

    const executeDelete = (e: React.MouseEvent, idToDelete: number) => {
        e.preventDefault(); e.stopPropagation();
        setContextMenu(null);
        setTimeout(() => {
            if (window.confirm("Permanently delete this scene?")) {
                captureSnapshot();
                setBeats((prev: Beat[]) => prev.filter(b => b.id !== idToDelete));
            }
        }, 50);
    };

    const setColor = (beatId: number, color: string) => { updateBeat(beatId, { color }); setContextMenu(null); };
    const setStatus = (beatId: number, status: BeatStatus) => { updateBeat(beatId, { status }); setContextMenu(null); };

    const handleDragStart = (e: React.DragEvent, id: number) => {
        e.dataTransfer.setData('application/backstage-beat-id', id.toString());
        e.dataTransfer.effectAllowed = 'move';
        const target = e.currentTarget as HTMLElement;
        setTimeout(() => { target.style.opacity = '0.4'; }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const target = e.currentTarget as HTMLElement;
        target.style.opacity = '1';
        setDragOverId(null);
    };

    const handleDragOver = (e: React.DragEvent, id: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const side = y < rect.height / 2 ? 'top' : 'bottom';
        setDragOverId(id);
        setDropSide(side);
    };

    const handleDrop = (e: React.DragEvent, targetId: number) => {
        e.preventDefault();
        setDragOverId(null);
        const draggedIdStr = e.dataTransfer.getData('application/backstage-beat-id');
        if (!draggedIdStr) return;
        const draggedId = parseInt(draggedIdStr);
        if (draggedId === targetId) return;
        reorderBeats(draggedId, targetId, dropSide);
    };

    return (
        <div 
            className={`w-full h-full overflow-y-auto custom-scrollbar relative ${isLight ? 'bg-slate-100/70 text-slate-800' : 'bg-[#08080c]'}`}
            onClick={() => setContextMenu(null)}
        >
            {/* Search Bar */}
            <div className="sticky top-0 z-20 px-3 pt-3 pb-1">
                <div className={`relative border backdrop-blur-xl shadow-xs ${isLight ? 'bg-white/95 border-slate-200/90' : 'bg-[#14141a]/95 border-slate-800/80'}`}>
                    <div className="relative flex items-center px-1.5 py-1">
                        <Search className={`absolute left-3.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} size={13} />
                        <input 
                            type="text" 
                            placeholder="Search scenes..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className={`w-full pl-8 pr-3 py-1 text-xs outline-none transition-colors border-none bg-transparent ${isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-500'}`} 
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className={`p-0.5 ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white'}`}>
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Cards */}
            <div className="px-3 pb-12 pt-2 space-y-2.5">
                {filteredBeats.map((beat, idx) => {
                    const isActive = beat.id === activeBeatId;
                    const isReady = beat.status === 'ready';
                    const isEditing = editingId === beat.id;
                    const isDragOver = dragOverId === beat.id;
                    const displayColor = beat.color && beat.color !== '#444' ? beat.color : appAccentColor;
                    const sceneNum = beat.sceneNumber || (idx + 1).toString();
                    const seqData = sequenceInfo[beat.id];
                    const boardNum = (beat.boardId || 0) + 1;
                    const pageNum = (beatPageMap && beatPageMap[beat.id]) || beatPageNumbers[beat.id] || 1;
                    const characters = extractCharacters(beat.content);
                    const wordCount = getWordCount(beat.content);
                    const summaryText = beat.summary || '';

                    return (
                        <div 
                            key={beat.id}
                            className={`transition-all duration-200 relative ${isDragOver && dropSide === 'top' ? 'pt-2' : ''} ${isDragOver && dropSide === 'bottom' ? 'pb-2' : ''}`}
                            draggable={!isEditing}
                            onDragStart={(e) => handleDragStart(e, beat.id)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, beat.id)}
                            onDrop={(e) => handleDrop(e, beat.id)}
                        >
                            {isDragOver && (
                                <div 
                                    className={`absolute left-2 right-2 h-[2px] z-50 ${dropSide === 'top' ? 'top-0' : 'bottom-0'}`} 
                                    style={{ backgroundColor: appAccentColor, boxShadow: `0 0 10px ${appAccentColor}99` }}
                                />
                            )}

                            <div 
                                className={`relative border overflow-hidden transition-all duration-200 cursor-pointer group
                                    ${isLight 
                                      ? (isActive 
                                          ? 'bg-white shadow-md' 
                                          : 'bg-white/90 hover:bg-white shadow-xs border-slate-200 hover:border-slate-300')
                                      : (isActive 
                                          ? 'bg-[#1a1a22] shadow-lg' 
                                          : 'bg-[#131318] hover:bg-[#1a1a22] shadow-xs border-white/[0.06] hover:border-white/[0.12]')
                                    }
                                `}
                                style={isActive ? {
                                    borderColor: appAccentColor,
                                    boxShadow: isLight
                                        ? `0 0 0 1px ${appAccentColor}80, 0 4px 14px -2px ${appAccentColor}30`
                                        : `0 0 0 1px ${appAccentColor}80, 0 10px 25px -5px ${appAccentColor}40`
                                } : undefined}
                                onClick={(e) => { e.stopPropagation(); onBeatClick(beat.id); }}
                                onContextMenu={(e) => handleContextMenu(e, beat.id)}
                                onBlur={(e) => {
                                    if (e.currentTarget.contains(e.relatedTarget as Node)) {
                                        return;
                                    }
                                    setEditingId(null);
                                }}
                            >
                                {/* ── Scene Number Banner ── */}
                                <div className="relative overflow-hidden">
                                    <div 
                                        className="px-3 py-2 flex items-center justify-between gap-3"
                                        style={{ 
                                            background: isLight 
                                                ? `linear-gradient(135deg, ${displayColor}14, ${displayColor}06)`
                                                : `linear-gradient(135deg, ${displayColor}20, ${displayColor}08)`,
                                            borderBottom: `1px solid ${isLight ? displayColor + '18' : displayColor + '20'}`
                                        }}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {/* Scene Number Badge (Sharp Edges) */}
                                            <div 
                                                className="shrink-0 w-8 h-8 flex items-center justify-center text-xs font-black text-white shadow-xs"
                                                style={{ 
                                                    background: `linear-gradient(135deg, ${displayColor}, ${displayColor}cc)`
                                                }}
                                            >
                                                {sceneNum}
                                            </div>
                                            {/* Title */}
                                            <div className="min-w-0 flex-1">
                                                {isEditing ? (
                                                    <input 
                                                        id={`card-title-input-${beat.id}`}
                                                        className={`font-bold text-[12px] bg-transparent border-b outline-none w-full ${isLight ? 'text-slate-900' : 'text-white'}`}
                                                        style={{ borderBottomColor: appAccentColor }}
                                                        value={beat.title}
                                                        onChange={(e) => updateBeat(beat.id, { title: e.target.value })}
                                                        autoFocus
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                document.getElementById(`card-summary-textarea-${beat.id}`)?.focus();
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <div 
                                                        className={`font-bold text-[12px] truncate ${isLight ? 'text-slate-900' : 'text-white'}`}
                                                        onDoubleClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setEditingId(beat.id); 
                                                            setTimeout(() => {
                                                                document.getElementById(`card-title-input-${beat.id}`)?.focus();
                                                            }, 80);
                                                        }}
                                                    >
                                                        {beat.title || 'Untitled Scene'}
                                                    </div>
                                                )}
                                                <div className={`font-screenplay text-[9.5px] font-bold uppercase truncate mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {beat.slug.prefix} {beat.slug.location || 'LOCATION'} — {beat.slug.time || 'DAY'}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Status Indicator */}
                                        <div 
                                            className="shrink-0 w-2 h-2 rounded-none" 
                                            style={{ backgroundColor: isReady ? '#34d399' : appAccentColor }} 
                                            title={isReady ? 'Ready' : 'Work in Progress'} 
                                        />
                                    </div>
                                </div>

                                {/* ── Metadata Ribbon (Sharp Badges) ── */}
                                <div className={`px-3 py-1.5 flex items-center gap-1.5 flex-wrap border-b ${isLight ? 'border-slate-100 bg-slate-50/60' : 'border-white/[0.03] bg-white/[0.01]'}`}>
                                    {/* Sequence Detail */}
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-[2px] border ${
                                        seqData?.isSequenced
                                            ? (isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-950/40 text-indigo-300 border-indigo-800/50')
                                            : (isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800/40 text-slate-500 border-slate-700/50')
                                    }`}>
                                        <Link2 size={8} />
                                        {seqData?.isSequenced ? `Seq #${seqData.seqOrder || '—'}` : 'Unsequenced'}
                                    </span>
                                    {/* Board Number */}
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-[2px] border ${
                                        isLight ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-violet-950/30 text-violet-300 border-violet-800/50'
                                    }`}>
                                        <Layers size={8} />
                                        Board {boardNum}
                                    </span>
                                    {/* Page Number */}
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-[2px] border ${
                                        isLight ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-sky-950/30 text-sky-300 border-sky-800/50'
                                    }`}>
                                        <FileText size={8} />
                                        Page {pageNum}
                                    </span>
                                    {/* Word Count */}
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-[2px] border ${
                                        isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950/30 text-emerald-300 border-emerald-800/50'
                                    }`}>
                                        {wordCount}w
                                    </span>
                                </div>

                                {/* ── Summary Body ── */}
                                <div className="px-4 py-3">
                                    {isEditing ? (
                                        <textarea 
                                            id={`card-summary-textarea-${beat.id}`}
                                            className={`w-full text-[12px] leading-relaxed bg-transparent border rounded-lg outline-none resize-none min-h-[80px] p-2 custom-scrollbar ${isLight ? 'text-slate-700 placeholder-slate-400' : 'text-slate-300 placeholder-slate-600'}`}
                                            style={{ borderColor: `color-mix(in srgb, ${appAccentColor} 50%, transparent)` }}
                                            value={summaryText}
                                            onChange={(e) => updateBeat(beat.id, { summary: e.target.value })}
                                            placeholder="Write a complete scene summary — story beats, emotional arc, key plot points..."
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <div 
                                            className={`text-[12px] leading-[1.7] whitespace-pre-wrap ${summaryText ? (isLight ? 'text-slate-700' : 'text-slate-300') : (isLight ? 'text-slate-400 italic' : 'text-slate-600 italic')}`}
                                            onDoubleClick={(e) => { 
                                                e.stopPropagation(); 
                                                setEditingId(beat.id); 
                                                setTimeout(() => {
                                                    document.getElementById(`card-title-input-${beat.id}`)?.focus();
                                                }, 80);
                                            }}
                                        >
                                            {summaryText || 'Double-click to add a summary…'}
                                        </div>
                                    )}
                                </div>

                                {/* ── Characters & Footer ── */}
                                {(characters.length > 0 || (beat.shots && beat.shots.length > 0) || (beat.versions && beat.versions.length > 0)) && (
                                    <div className={`px-4 py-2 flex items-center justify-between gap-2 border-t ${isLight ? 'border-slate-100 bg-slate-50/40' : 'border-white/[0.03] bg-white/[0.01]'}`}>
                                        {/* Characters */}
                                        <div className="flex items-center gap-1 min-w-0 flex-1">
                                            {characters.length > 0 && (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    <User size={9} className={isLight ? 'text-slate-400' : 'text-slate-600'} />
                                                    {characters.map((c, ci) => (
                                                        <span key={ci} className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800/60 text-slate-400'}`}>
                                                            {c}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {/* Shots & Versions */}
                                        <div className={`flex items-center gap-2.5 shrink-0 text-[9px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
                                            {beat.shots && beat.shots.length > 0 && (
                                                <span className="flex items-center gap-1"><Camera size={9} /> {beat.shots.length}</span>
                                            )}
                                            {beat.versions && beat.versions.length > 0 && (
                                                <span className="flex items-center gap-1"><History size={9} /> v{beat.versions.length}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {filteredBeats.length === 0 && (
                    <div className={`flex flex-col items-center justify-center py-16 gap-3 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
                        <Search size={28} strokeWidth={1.5} className="opacity-40" />
                        <span className="text-xs font-medium">
                            {searchTerm ? 'No scenes match your search' : 'No scenes yet'}
                        </span>
                    </div>
                )}
            </div>

            {contextMenu && (
                <div 
                    className={`fixed rounded-xl shadow-2xl z-[9999] py-1.5 w-48 animate-in fade-in zoom-in duration-100 backdrop-blur-xl ${isLight ? 'bg-white/95 border border-slate-200 text-slate-800' : 'bg-[#1a1a1a]/95 border border-[#333] text-white'}`}
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()} 
                >
                    <div className={`px-3 py-1.5 border-b mb-1 ${isLight ? 'border-slate-200 text-slate-500' : 'border-[#333] text-gray-500'}`}>
                        <span className="text-[9px] font-bold uppercase tracking-wider">Scene Options</span>
                    </div>
                    <div className="px-1 mb-1">
                        <button onClick={() => setStatus(contextMenu.beatId, 'ready')} className={`w-full text-left px-2 py-1.5 text-[10px] font-bold text-emerald-600 rounded flex items-center gap-2 ${isLight ? 'hover:bg-slate-100' : 'hover:bg-[#333]'}`}><Check size={10} /> Mark Ready</button>
                        <button onClick={() => setStatus(contextMenu.beatId, 'not-ready')} className={`w-full text-left px-2 py-1.5 text-[10px] font-bold rounded flex items-center gap-2 ${isLight ? 'hover:bg-slate-100' : 'hover:bg-[#333]'}`} style={{ color: appAccentColor }}><Clock size={10} /> Mark W.I.P</button>
                    </div>
                    <div className={`h-px my-1 ${isLight ? 'bg-slate-200' : 'bg-[#333]'}`}></div>
                    <div className="px-3 py-2">
                        <div className={`text-[9px] uppercase mb-1.5 font-bold ${isLight ? 'text-slate-400' : 'text-[#666]'}`}>Tag Color</div>
                        <div className="flex gap-1.5 flex-wrap">
                            {DEFAULT_STORYLINE_COLORS.slice(0, 5).map(c => (
                                <button key={c} onClick={() => setColor(contextMenu.beatId, c)} className="w-4 h-4 rounded-full border border-black/10 hover:scale-125 transition-transform" style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                    <div className={`h-px my-1 ${isLight ? 'bg-slate-200' : 'bg-[#333]'}`}></div>
                    <button onClick={(e) => executeDelete(e, contextMenu.beatId)} className={`w-full text-left px-3 py-2 text-[10px] font-bold text-red-500 flex items-center gap-2 ${isLight ? 'hover:bg-red-50' : 'hover:bg-red-950/30'}`}><Trash2 size={12} /> Delete Scene</button>
                </div>
            )}
        </div>
    );
};

const LocationNavPanel = ({ 
    beats, activeBeatId, onBeatClick, isLight
}: { 
    beats: Beat[], activeBeatId: number | null, 
    onBeatClick: (id: number) => void, isLight?: boolean
}) => {
    const { appAccentColor = '#f5a623' } = useProject();
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const safeBeats = Array.isArray(beats) ? beats : [];

    const locationGroups = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        const map: Record<string, Beat[]> = {};
        safeBeats.forEach(b => {
            const loc = (b.slug?.location || '').trim().toUpperCase() || 'UNKNOWN';
            if (q) {
                const hay = [loc, b.slug?.prefix || '', b.slug?.time || '', b.title || '', b.sceneNumber || ''].join(' ').toLowerCase();
                if (!hay.includes(q)) return;
            }
            if (!map[loc]) map[loc] = [];
            map[loc].push(b);
        });
        const orderOf = (b: Beat) => {
            const n = b.sceneNumber && !isNaN(parseInt(b.sceneNumber)) ? parseInt(b.sceneNumber) : null;
            if (n !== null) return n;
            const idx = safeBeats.findIndex(x => x.id === b.id);
            return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
        };
        const groups = Object.entries(map).map(([loc, locBeats]) => ({
            loc,
            beats: [...locBeats].sort((a, b) => orderOf(a) - orderOf(b)),
        }));
        return groups.sort((a, b) => orderOf(a.beats[0]) - orderOf(b.beats[0]));
    }, [safeBeats, searchTerm]);

    const toggleGroup = (loc: string) => setCollapsed(prev => ({ ...prev, [loc]: !prev[loc] }));

    return (
        <div className={`w-full h-full overflow-y-auto custom-scrollbar relative ${isLight ? 'bg-slate-100/70 text-slate-800' : 'bg-[#08080c]'}`}>
            {/* Search Bar */}
            <div className="sticky top-0 z-20 px-3 pt-3 pb-1">
                <div className={`relative border backdrop-blur-xl shadow-xs ${isLight ? 'bg-white/95 border-slate-200/90' : 'bg-[#14141a]/95 border-slate-800/80'}`}>
                    <div className="relative flex items-center px-1.5 py-1">
                        <Search className={`absolute left-3.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} size={13} />
                        <input 
                            type="text" 
                            placeholder="Search locations..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className={`w-full pl-8 pr-3 py-1 text-xs outline-none transition-colors border-none bg-transparent ${isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-500'}`} 
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className={`p-0.5 ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white'}`}>
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Location Groups */}
            <div className="px-3 pb-12 pt-2 space-y-2.5">
                {locationGroups.map(({ loc, beats: locBeats }) => {
                    const isCollapsed = collapsed[loc];
                    return (
                        <div key={loc} className={`border overflow-hidden transition-all ${isLight ? 'bg-white/90 border-slate-200' : 'bg-[#131318] border-white/[0.06]'}`}>
                            <button 
                                onClick={() => toggleGroup(loc)} 
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 border-b transition-colors ${isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-100' : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.03]'}`}
                            >
                                <span className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                                    <MapIcon size={11} style={{ color: appAccentColor }} />
                                    {loc}
                                </span>
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'}`}>{locBeats.length}</span>
                            </button>
                            {!isCollapsed && (
                                <div>
                                    {locBeats.map((beat) => {
                                        const globalIdx = safeBeats.findIndex(b => b.id === beat.id);
                                        const sceneNum = beat.sceneNumber || (globalIdx + 1).toString();
                                        const isActive = beat.id === activeBeatId;
                                        return (
                                            <button 
                                                key={beat.id} 
                                                onClick={() => onBeatClick(beat.id)}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${isActive ? 'border-l-2' : (isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]')}`}
                                                style={isActive ? {
                                                    borderLeftColor: appAccentColor,
                                                    backgroundColor: `color-mix(in srgb, ${appAccentColor} 12%, transparent)`
                                                } : undefined}
                                            >
                                                <span 
                                                    className={`shrink-0 w-7 h-7 flex items-center justify-center text-[10px] font-black ${isActive ? 'text-white' : isLight ? 'text-slate-500 bg-slate-100' : 'text-slate-400 bg-slate-800/60'}`}
                                                    style={isActive ? { background: `linear-gradient(135deg, ${appAccentColor}, ${appAccentColor}cc)` } : undefined}
                                                >
                                                    {sceneNum}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className={`block text-[11px] font-bold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{beat.title || 'Untitled Scene'}</span>
                                                    <span className={`block text-[9px] font-screenplay font-bold uppercase truncate ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{beat.slug.prefix} {beat.slug.location || 'LOCATION'} — {beat.slug.time || 'DAY'}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
                {locationGroups.length === 0 && (
                    <div className={`flex flex-col items-center justify-center py-16 gap-3 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
                        <MapIcon size={28} strokeWidth={1.5} className="opacity-40" />
                        <span className="text-xs font-medium">
                            {searchTerm ? 'No locations match your search' : 'No locations yet'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

const LanguageSettingsPopover = ({ 
  config, 
  onUpdate, 
  onClose,
  isLight
}: { 
  config: any, 
  onUpdate: (elm: string, lang: string) => void, 
  onClose: () => void,
  isLight?: boolean
}) => {
  const { appAccentColor = '#f5a623' } = useProject();
  const elements = [
    { id: 'slugline', label: 'Slugline' },
    { id: 'action', label: 'Action' },
    { id: 'character', label: 'Character' },
    { id: 'dialogue', label: 'Dialogue' },
    { id: 'parenthetical', label: 'Parenthetical' },
    { id: 'transition', label: 'Transition' },
    { id: 'shot', label: 'Shot' },
    { id: 'lyrics', label: 'Lyrics' },
  ];

  return (
    <div className={`absolute top-full left-0 mt-2 w-64 rounded-lg shadow-2xl z-[1000] p-3 animate-in fade-in zoom-in duration-150 ${isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-[#1a1a1a] border border-[#333] text-white'}`}>
      <div className={`flex items-center justify-between mb-3 pb-2 border-b ${isLight ? 'border-slate-200' : 'border-[#333]'}`}>
        <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-2" style={{ color: appAccentColor }}>
          <Globe size={12} /> Typing Languages
        </span>
        <button onClick={onClose} className={isLight ? "text-slate-400 hover:text-slate-700" : "text-gray-500 hover:text-white"}><X size={14} /></button>
      </div>
      <div className="space-y-2.5">
        {elements.map(elm => (
          <div key={elm.id} className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{elm.label}</span>
            <select 
              value={config[elm.id] || 'default'} 
              onChange={(e) => onUpdate(elm.id, e.target.value)}
              className={`text-[9px] font-bold rounded px-2 py-1 outline-none border transition-colors ${isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#0a0a0a] border-[#333] text-gray-300'}`}
              onFocus={(e) => { e.currentTarget.style.borderColor = appAccentColor; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className={`mt-4 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-[#333]'}`}>
        <p className={`text-[8px] leading-tight italic ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>Mappings for later macOS/Electron language API integration.</p>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS FOR NESTED CONTEXT MENU ---
const ContextMenuItem = ({ icon: Icon, label, onClick, danger, submenu, active, isLight }: any) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <div 
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <button 
                onClick={(e) => { 
                    if (onClick) { e.stopPropagation(); onClick(); }
                }}
                className={`w-full text-left px-3 py-2 text-[11px] font-bold flex items-center justify-between transition-colors ${
                  danger 
                    ? (isLight ? 'text-red-600 hover:bg-red-50' : 'text-red-400 hover:bg-red-900/20') 
                    : active 
                    ? 'text-black' 
                    : (isLight ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900' : 'text-gray-300 hover:bg-[#333] hover:text-white')
                }`}
                style={!danger && active ? { backgroundColor: 'var(--app-accent, #f5a623)', color: '#000000' } : undefined}
            >
                <span className="flex items-center gap-2">
                    {Icon && <Icon size={14} className={danger ? 'text-red-500/50' : ''} />}
                    {label}
                </span>
                {submenu && <ChevronRight size={10} className="opacity-50" />}
            </button>
            {submenu && isHovered && (
                <div className={`absolute left-full top-0 ml-px rounded-lg shadow-2xl py-1 w-48 animate-in slide-in-from-left-1 duration-100 backdrop-blur-md ${isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-[#1a1a1a] border border-[#333] text-white'}`}>
                    {React.Children.map(submenu, child => React.isValidElement(child) ? React.cloneElement(child, { isLight } as any) : child)}
                </div>
            )}
        </div>
    );
};

const ScriptView: React.FC<{ onNavigateToView?: (view: 'characterdesign' | 'casting') => void }> = ({ onNavigateToView }) => {
  const { beats, groups, connections, updateBeat, addBeat, setBeats, setConnections, scriptViewMode, setScriptViewMode, scriptConfig, setScriptConfig, scratchpadConfig, characterData, breakdownLanguage, setBreakdownLanguage, scratchpad, setScratchpad, globalNotes, setGlobalNotes, captureSnapshot, reorderBeats, setActiveBoardId, appTheme, appAccentColor = '#f5a623', generalAiModel, openrouterKey, userRole, isTamilMode, tamilFontFamily } = useProject();
  const { aiAvailable } = useAiKeyStatus();
  const isScriptReadOnly = false;

  const isLight = useMemo(() => {
    if (appTheme === 'light') return true;
    if (appTheme === 'dark') return false;
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    return false;
  }, [appTheme]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [scriptToast, setScriptToast] = useState<string | null>(null);
  const [activeBeatId, setActiveBeatId] = useState<number | null>(null);
  const [activeFormat, setActiveFormat] = useState('action');
  const [showNav, setShowNav] = useState(true);
  const [navMode, setNavMode] = useState<'list' | 'board'>('board');
  const [sidebarWidth, setSidebarWidth] = useState(380); 
  const [activeSidebar, setActiveSidebar] = useState<'none' | 'breakdown' | 'scratchpad' | 'history'>('none');
  const [scratchpadMode, setScratchpadMode] = useState<'global' | 'scene'>('global');
  const [draggedNoteIndex, setDraggedNoteIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null); 
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [showSourceHighlights, setShowSourceHighlights] = useState(false);
  const [showLanguageConfig, setShowLanguageConfig] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showTranscoderModal, setShowTranscoderModal] = useState(false);
  const [diffVersion, setDiffVersion] = useState<BeatVersion | null>(null);
  const isConstrained = activeSidebar !== 'none' || (showNav && sidebarWidth >= 300);
  
  const [scriptContextMenu, setScriptContextMenu] = useState<{ x: number, y: number, beatId: number, selectionText?: string } | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          const newNote: Note = {
            id: `note-audio-${Date.now()}`,
            content: `<div class="audio-note-container"><audio src="${base64Audio}" controls class="w-full mt-1"></audio></div>`,
            color: appAccentColor,
            timestamp: Date.now()
          };
          if (scratchpadMode === 'global') {
            setGlobalNotes([...(Array.isArray(globalNotes) ? globalNotes : []), newNote]);
          } else if (activeBeat) {
            const currentNotes = Array.isArray(activeBeat.notes) ? activeBeat.notes : [];
            updateBeat(activeBeat.id, { notes: [...currentNotes, newNote] });
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start voice recording", err);
      alert("Please allow microphone access to record voice ideas.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const editorRefs = useRef<Record<number, ScriptEditorHandle | null>>({});
  const isResizingRef = useRef(false);
  
  const getThemeStyles = () => {
      const accent = appAccentColor || '#f5a623';
      switch(scriptConfig.paperTheme) {
          case 'dark': 
              return { 
                  bg: '#16161a', 
                  text: '#e2e8f0', 
                  slug: '#38bdf8', 
                  slugText: '#a1a1aa', 
                  accent: '#222228', 
                  pageNum: '#94a3b8', 
                  shadow: '0 0 0 1px #2a2a32, 0 10px 30px rgba(0,0,0,0.5)', 
                  slugBg: '#27272a',
                  activeSlugBg: '#3f3f46',
                  activeSlugText: '#f1f5f9',
                  activeBorder: accent,
                  dropdownBg: '#1c1c22',
                  dropdownText: '#f1f5f9',
                  dropdownBorder: `color-mix(in srgb, ${accent} 45%, #33333d)`
              };
          case 'sepia': 
              return { 
                  bg: '#fbf7ee', 
                  text: '#433422', 
                  slug: '#b58900', 
                  slugText: '#71717a', 
                  accent: '#f4ede0', 
                  pageNum: '#8c7b69', 
                  shadow: '0 4px 20px rgba(80, 60, 40, 0.08)', 
                  slugBg: '#e4e4e7',
                  activeSlugBg: '#d4d4d8',
                  activeSlugText: '#433422',
                  activeBorder: accent,
                  dropdownBg: '#f8f2e3',
                  dropdownText: '#433422',
                  dropdownBorder: `color-mix(in srgb, ${accent} 45%, #d6c8a5)`
              };
          case 'red': 
              return { 
                  bg: '#0d0202', 
                  text: '#ff8888', 
                  slug: '#ff4d4d', 
                  slugText: '#a1a1aa', 
                  accent: '#1e0505', 
                  pageNum: '#993333', 
                  shadow: '0 0 0 1px #440000, 0 10px 30px rgba(0,0,0,0.7)', 
                  slugBg: '#27272a',
                  activeSlugBg: '#3f3f46',
                  activeSlugText: '#ff8888',
                  activeBorder: accent,
                  dropdownBg: '#1a0505',
                  dropdownText: '#ffaaaa',
                  dropdownBorder: `color-mix(in srgb, ${accent} 45%, #660000)`
              };
          default: 
              return { 
                  bg: '#ffffff', 
                  text: '#0f172a', 
                  slug: '#0f172a', 
                  slugText: '#71717a', 
                  accent: '#f8fafc', 
                  pageNum: '#64748b', 
                  shadow: '0 4px 20px rgba(0,0,0,0.06)', 
                  slugBg: '#e4e4e7',
                  activeSlugBg: '#d4d4d8',
                  activeSlugText: '#0f172a',
                  activeBorder: accent,
                  dropdownBg: '#ffffff',
                  dropdownText: '#0f172a',
                  dropdownBorder: `color-mix(in srgb, ${accent} 45%, #cbd5e1)`
              }; 
      }
  };
  const theme = getThemeStyles();
  const setPaperTheme = (theme: 'white' | 'dark' | 'sepia' | 'red') => { setScriptConfig({ ...scriptConfig, paperTheme: theme }); };

  const isSequenceBeat = (beat: Beat, connectedIds: Set<number>, orders: Record<number, number>) => {
      return connectedIds.has(beat.id) || (beat.sceneNumber !== undefined && beat.sceneNumber.trim() !== '') || orders[beat.id] !== undefined;
  };

  const { connectedSet, beatOrder } = useMemo(() => {
      const res = calculateGraphOrder(beats || [], connections || []);
      return { connectedSet: res.connectedSet, beatOrder: res.orders };
  }, [beats, connections]);

  const sortedBeats = useMemo(() => {
      if (!beats || beats.length === 0) return [];
      const list = [...beats];
      list.sort((a, b) => {
          if ((a.boardId || 0) !== (b.boardId || 0)) return (a.boardId || 0) - (b.boardId || 0);
          const isSeqA = isSequenceBeat(a, connectedSet, beatOrder);
          const isSeqB = isSequenceBeat(b, connectedSet, beatOrder);
          if (isSeqA !== isSeqB) return isSeqA ? -1 : 1;
          const orderA = beatOrder[a.id] ?? (parseInt(a.sceneNumber || '999999'));
          const orderB = beatOrder[b.id] ?? (parseInt(b.sceneNumber || '999999'));
          if (orderA !== orderB) return orderA - orderB;
          if (Math.abs((a.x || 0) - (b.x || 0)) > 50) return (a.x || 0) - (b.x || 0); 
          return (a.y || 0) - (b.y || 0); 
      });
      return list;
  }, [beats, connectedSet, beatOrder]);

  const sequenceCount = useMemo(() => {
      return beats.filter(b => isSequenceBeat(b, connectedSet, beatOrder)).length;
  }, [beats, connectedSet, beatOrder]);
  
  const filteredBeats = useMemo(() => {
      if (!searchTerm) return sortedBeats;
      const lower = searchTerm.toLowerCase();
      return sortedBeats.filter(b => 
          (b.title || '').toLowerCase().includes(lower) || 
          (b.slug.location || '').toLowerCase().includes(lower) ||
          (b.content || '').toLowerCase().includes(lower)
      );
  }, [sortedBeats, searchTerm]);

  const activeBeat = useMemo(() => beats.find(b => b.id === activeBeatId), [beats, activeBeatId]);


  const locationCount = useMemo(() => new Set(beats.map(b => (b.slug?.location || '').trim().toUpperCase()).filter(Boolean)).size, [beats]);
  const uniqueLocations = useMemo(() => { const locs = new Set<string>(); ['HOUSE', 'KITCHEN', 'BEDROOM', 'OFFICE', 'PARK', 'STREET', 'CAR', 'APARTMENT', 'SCHOOL', 'HOSPITAL'].forEach(l => locs.add(l)); beats.forEach(b => { if (b.slug.location && b.slug.location.trim()) { locs.add(b.slug.location.trim()); } }); return Array.from(locs).sort(); }, [beats]);
  const uniqueCharacters = useMemo(() => extractScriptCharacterSuggestions(beats), [beats]);

  // Initial estimate based on text metrics
  const estimatedInfo = useMemo(() => {
    let totalH = 0;
    const map: Record<number, number> = {};
    sortedBeats.forEach((b) => {
      const h = estimateBeatHeight(b);
      const pg = Math.max(1, Math.floor(totalH / 931) + 1);
      map[b.id] = pg;
      totalH += h;
    });
    const pgs = Math.max(1, Math.ceil(totalH / 931));
    return { totalPages: pgs, beatPageMap: map };
  }, [sortedBeats]);

  const [calculatedPages, setCalculatedPages] = useState<number>(estimatedInfo.totalPages);
  const [calculatedBeatPageMap, setCalculatedBeatPageMap] = useState<Record<number, number>>(estimatedInfo.beatPageMap);
  const isPaginatingRef = useRef<boolean>(false);
  const needsRepaginationRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  const performPagination = useCallback(() => {
    if (!contentRef.current) return;
    if (isPaginatingRef.current) {
      needsRepaginationRef.current = true;
      return;
    }
    isPaginatingRef.current = true;
    needsRepaginationRef.current = false;

    try {
      const res = runLinePaginationPass(contentRef.current);
      setCalculatedPages(prev => (prev !== res.totalPages ? res.totalPages : prev));
      setCalculatedBeatPageMap(prev => {
        const keys = Object.keys(res.beatPageMap);
        if (keys.length !== Object.keys(prev).length) return res.beatPageMap;
        for (const k of keys) {
          if (prev[Number(k)] !== res.beatPageMap[Number(k)]) return res.beatPageMap;
        }
        return prev;
      });
    } catch (err) {
      console.error('Pagination pass error:', err);
    } finally {
      isPaginatingRef.current = false;
      if (needsRepaginationRef.current) {
        needsRepaginationRef.current = false;
        rafIdRef.current = requestAnimationFrame(performPagination);
      }
    }
  }, []);

  const triggerPagination = useCallback(() => {
    if (isPaginatingRef.current) {
      needsRepaginationRef.current = true;
      return;
    }
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(performPagination);
  }, [performPagination]);

  useLayoutEffect(() => {
    triggerPagination();
  }, [sortedBeats, triggerPagination, zoom, scriptConfig.paperTheme]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    let prevWidth = el.getBoundingClientRect().width;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // Only trigger if container width changed (window/zoom/layout resize),
        // not when height changes due to internal margin-top pagination breaks.
        if (Math.abs(width - prevWidth) > 2) {
          prevWidth = width;
          triggerPagination();
        }
      }
    });
    observer.observe(el);

    const mutationObserver = new MutationObserver(() => {
      triggerPagination();
    });
    mutationObserver.observe(el, { childList: true, subtree: true, characterData: true });

    const handleWindowResize = () => triggerPagination();
    window.addEventListener('resize', handleWindowResize);

    if (document.fonts) {
      document.fonts.ready.then(() => triggerPagination());
    }

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [triggerPagination]);

  const totalPages = calculatedPages;
  const beatPageMap = calculatedBeatPageMap; 
  
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isResizingRef.current) {
              const newWidth = Math.max(260, Math.min(900, e.clientX));
              setSidebarWidth(newWidth);
          }
      };
      const handleMouseUp = () => {
          isResizingRef.current = false;
          document.body.style.cursor = 'default';
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, []);

  const handleFitZoom = () => { if (scrollerRef.current) { const w = scrollerRef.current.clientWidth; const fit = (w - 60) / A4_WIDTH; setZoom(Math.min(1.5, Math.max(0.2, fit))); } };
  const toggleFitZoom = () => { if (zoom === 1.0) handleFitZoom(); else setZoom(1.0); };
  const handleAddScene = () => { 
    captureSnapshot();
    let maxX = -Infinity; let maxY = 0; beats.forEach(b => { if (b.x > maxX) { maxX = b.x; maxY = b.y; } }); if (maxX === -Infinity) { maxX = 25000; maxY = 25000; } const newId = addBeat(maxX + 300, maxY); setTimeout(() => { const prefixInput = document.getElementById(`beat-prefix-${newId}`); if (prefixInput) prefixInput.focus(); const card = document.getElementById(`beat-${newId}`); card?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); 
  };

  const handleInsertScene = (referenceId: number, direction: 'above' | 'below') => {
    captureSnapshot();
    const refBeat = beats.find(b => b.id === referenceId);
    if (!refBeat) return;
    const newId = addBeat(refBeat.x + (direction === 'above' ? -100 : 100), refBeat.y + (direction === 'above' ? -100 : 100));
    setScriptContextMenu(null);
    setTimeout(() => scrollToBeat(newId), 100);
  };

  const handleDuplicateScene = (id: number) => {
    captureSnapshot();
    const source = beats.find(b => b.id === id);
    if (!source) return;
    const nextIdVal = Date.now();
    const clone: Beat = JSON.parse(JSON.stringify(source));
    clone.id = nextIdVal;
    clone.x += 40; clone.y += 40;
    clone.title += " (Copy)";
    setBeats(prev => [...prev, clone]);
    setScriptContextMenu(null);
    setTimeout(() => scrollToBeat(nextIdVal), 100);
  };

  const handleDeleteScene = (id: number) => {
    if (window.confirm("Permanently delete this scene?")) {
        captureSnapshot();
        setBeats(prev => prev.filter(b => b.id !== id));
        setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
        setScriptContextMenu(null);
    }
  };

  const handleAutoRenumberAll = () => {
    captureSnapshot();
    setBeats(prev => {
        return prev.map(b => {
            const index = sortedBeats.findIndex(sb => sb.id === b.id);
            const newNum = index !== -1 ? (index + 1).toString() : (b.sceneNumber || '1');
            return {
                ...b,
                sceneNumber: newNum,
                title: b.title.replace(/^\d+\.\s*/, `${newNum}. `)
            };
        });
    });
    setScriptToast(`Renumbered all ${sortedBeats.length} scenes (1-${sortedBeats.length})`);
    setTimeout(() => setScriptToast(null), 3000);
  };

  const handleSetSceneNumber = (id: number, currentVal: string) => {
    const input = window.prompt("Enter scene number (e.g. 1, 2A, 10):", currentVal);
    if (input === null) return;
    captureSnapshot();
    const trimmed = input.trim();
    updateBeat(id, { sceneNumber: trimmed });
    setScriptToast(trimmed ? `Scene numbered as ${trimmed}` : 'Scene number reset to automatic');
    setTimeout(() => setScriptToast(null), 3000);
  };

  const handleSlugChange = (id: number, field: string, val: string) => { const beat = beats.find(b => b.id === id); if (beat) updateBeat(id, { slug: { ...beat.slug, [field]: val } }); };
  const handleContentUpdate = useCallback((id: number, content: string) => { updateBeat(id, { content }); }, [updateBeat]);
  const handleFormat = (type: string) => { setActiveFormat(type); if (activeBeatId !== null && editorRefs.current[activeBeatId]) { editorRefs.current[activeBeatId]?.executeFormat(type); } };

  const scrollToBeat = (id: number) => {
      const el = document.getElementById(`beat-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveBeatId(id);
  };

  const updateLanguageConfig = (elmId: string, lang: string) => {
    setScriptConfig({
      ...scriptConfig,
      languageConfig: {
        ...scriptConfig.languageConfig,
        [elmId]: lang
      }
    });
  };

  const handleAnalyzeBreakdown = async () => { if (!activeBeat) return; setIsAnalyzing(true); const div = document.createElement('div'); div.innerHTML = activeBeat.content || ''; const text = div.textContent || div.innerText || ''; const result = await generateBreakdown(text, generalAiModel, breakdownLanguage, openrouterKey); if (result) { updateBeat(activeBeat.id, { breakdown: result }); } else { alert("Failed to analyze breakdown."); } setIsAnalyzing(false); };
  
  const addTag = (targetBeatId: number, category: keyof BreakdownData, tag: string, source: string = '') => { 
    const targetBeat = beats.find(b => b.id === targetBeatId);
    if (!targetBeat) return; 
    
    const current = targetBeat.breakdown || { props: [], sound: [], costume: [], vfx: [], practical: [], cast: [], location: [] }; 
    const list = current[category] || []; 
    const newItem: BreakdownItem = { name: tag, source: source }; 
    
    const exists = list.some(i => (typeof i === 'string' ? i : i.name).toLowerCase() === tag.toLowerCase()); 
    if (!exists) { 
        updateBeat(targetBeatId, { breakdown: { ...current, [category]: [...list, newItem] } }); 
    } 
  };

  const removeTag = (category: keyof BreakdownData, tag: string) => { 
    if (!activeBeat) return; 
    const current = activeBeat.breakdown || { props: [], sound: [], costume: [], vfx: [], practical: [], cast: [], location: [] }; 
    const list = current[category] || []; 
    const newList = list.filter(i => (typeof i === 'string' ? i : i.name) !== tag); 
    updateBeat(activeBeat.id, { breakdown: { ...current, [category]: newList } }); 
  };
  const handleCreateSnapshot = () => { if (!activeBeat) return; const newVersion: BeatVersion = { id: `v-${Date.now()}`, timestamp: Date.now(), title: activeBeat.title || 'Untitled', content: activeBeat.content, summary: activeBeat.summary }; const currentVersions = activeBeat.versions || []; updateBeat(activeBeat.id, { versions: [...currentVersions, newVersion] }); };
  const handleRestoreClick = (v: BeatVersion) => { if (!activeBeat) return; setDiffVersion(v); };
  const confirmRestoreVersion = () => { if (!activeBeat || !diffVersion) return; const backupVersion: BeatVersion = { id: `backup-${Date.now()}`, timestamp: Date.now(), title: activeBeat.title, content: activeBeat.content, summary: activeBeat.summary }; updateBeat(activeBeat.id, { title: diffVersion.title, content: diffVersion.content, summary: diffVersion.summary, versions: [...(activeBeat.versions || []), backupVersion] }); setDiffVersion(null); };
  const addNote = (content?: string) => { 
    const newNote: Note = { 
        id: `note-${Date.now()}`, 
        content: content || '<div class="nl-block"><br></div>', 
        color: '#d97706', 
        timestamp: Date.now() 
    }; 
    if (scratchpadMode === 'global') { 
      const currentNotes = Array.isArray(globalNotes) ? globalNotes : [];
      setGlobalNotes([...currentNotes, newNote]); 
    } else if (activeBeat) { 
      const currentNotes = Array.isArray(activeBeat.notes) ? activeBeat.notes : []; 
      updateBeat(activeBeat.id, { notes: [...currentNotes, newNote] }); 
    } 
  };
  const updateNote = (id: string, updates: Partial<Note>) => { 
    if (scratchpadMode === 'global') { 
      const currentNotes = Array.isArray(globalNotes) ? globalNotes : [];
      setGlobalNotes(currentNotes.map(n => (n && n.id === id ? { ...n, ...updates } : n))); 
    } else if (activeBeat) { 
      const currentNotes = Array.isArray(activeBeat.notes) ? activeBeat.notes : []; 
      updateBeat(activeBeat.id, { notes: currentNotes.map(n => (n && n.id === id ? { ...n, ...updates } : n)) }); 
    } 
  };
  const deleteNote = (id: string) => { 
    if (scratchpadMode === 'global') { 
      const currentNotes = Array.isArray(globalNotes) ? globalNotes : [];
      setGlobalNotes(currentNotes.filter(n => n && n.id !== id)); 
    } else if (activeBeat) { 
      const currentNotes = Array.isArray(activeBeat.notes) ? activeBeat.notes : []; 
      updateBeat(activeBeat.id, { notes: currentNotes.filter(n => n && n.id !== id) }); 
    } 
    setConfirmDeleteNoteId(null); 
  };
  const handleNoteDragStart = (e: React.DragEvent, index: number) => { setDraggedNoteIndex(index); e.dataTransfer.effectAllowed = 'move'; };
  const handleNoteDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index); };
  const handleNoteDragLeave = () => { setDragOverIndex(null); };
  const handleNoteDrop = (e: React.DragEvent, dropIndex: number) => { 
    e.preventDefault(); 
    setDragOverIndex(null); 
    if (draggedNoteIndex === null || draggedNoteIndex === dropIndex) return; 
    const currentNotes = scratchpadMode === 'global' ? [...(Array.isArray(globalNotes) ? globalNotes : [])] : [...(Array.isArray(activeBeat?.notes) ? activeBeat.notes : [])]; 
    const draggedNote = currentNotes[draggedNoteIndex]; 
    if (!draggedNote) return;
    currentNotes.splice(draggedNoteIndex, 1); 
    currentNotes.splice(dropIndex, 0, draggedNote); 
    if (scratchpadMode === 'global') { 
      setGlobalNotes(currentNotes); 
    } else if (activeBeat) { 
      updateBeat(activeBeat.id, { notes: currentNotes }); 
    } 
    setDraggedNoteIndex(null); 
  };
  const editorStyle = { '--color-action': theme.text, '--color-character': theme.text, '--color-dialogue': theme.text, '--color-parenthetical': theme.text, '--color-transition': theme.text } as React.CSSProperties;
  
  const FORMAT_BUTTONS = [ 
    { id: 'action', label: '1', short: 'Opt+1', icon: AlignLeft }, 
    { id: 'character', label: '2', short: 'Opt+2', icon: User }, 
    { id: 'dialogue', label: '3', short: 'Opt+3', icon: MessageSquare }, 
    { id: 'parenthetical', label: '4', short: 'Opt+4', icon: Parentheses }, 
    { id: 'transition', label: '5', short: 'Opt+5', icon: ArrowRightLeft }, 
    { id: 'shot', label: '6', short: 'Opt+6', icon: Camera }, 
    { id: 'lyrics', label: '7', short: 'Opt+7', icon: Music }, 
  ];

  const clearHighlight = () => { const editorEl = document.getElementById(`editor-${activeBeatId}`); if (!editorEl) return; const highlights = editorEl.querySelectorAll('.temp-source-highlight'); highlights.forEach(span => { const parent = span.parentNode; if (parent) { while (span.firstChild) { parent.insertBefore(span.firstChild, span); } parent.removeChild(span); parent.normalize(); } }); };
  const highlightSourceText = (text: string, category: keyof BreakdownData) => { if (!text || !activeBeatId || !showSourceHighlights) return; const editorEl = document.getElementById(`editor-${activeBeatId}`); if (!editorEl) return; clearHighlight(); const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase(); const search = normalize(text); if (!search) return; const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null); let node; while (node = walker.nextNode()) { const rawContent = node.textContent || ''; const rawIndex = rawContent.toLowerCase().indexOf(search); if (rawIndex !== -1) { const range = document.createRange(); range.setStart(node, rawIndex); range.setEnd(node, rawIndex + search.length); const span = document.createElement('span'); span.className = 'temp-source-highlight'; let rgb = '250, 204, 21'; switch(category) { case 'location': rgb = '251, 146, 60'; break; case 'vfx': rgb = '74, 222, 128'; break; case 'practical': rgb = '239, 68, 68'; break; case 'props': rgb = '248, 113, 113'; break; case 'sound': rgb = '96, 165, 250'; break; case 'costume': rgb = '244, 114, 182'; break; case 'cast': rgb = '250, 204, 21'; break; } const isDark = scriptConfig.paperTheme === 'dark' || scriptConfig.paperTheme === 'red'; const bgOpacity = isDark ? '0.3' : '0.5'; const borderOpacity = isDark ? '0.6' : '0.8'; span.style.backgroundColor = `rgba(${rgb}, ${bgOpacity})`; span.style.borderRadius = '2px'; span.style.padding = '0 2px'; span.style.borderBottom = `2px solid rgba(${rgb}, ${borderOpacity})`; span.style.color = 'inherit'; span.style.textShadow = 'none'; try { range.surroundContents(span); span.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; } catch (e) { console.warn("Highlight failed:", e); } } } };
  const handleTagDragStart = (e: React.DragEvent, category: keyof BreakdownData, item: string) => { e.dataTransfer.setData('text/plain', JSON.stringify({ category, item })); e.dataTransfer.effectAllowed = 'move'; };
  const handleTagDragOver = (e: React.DragEvent, category: keyof BreakdownData) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCategory(category); };
  const handleTagDragLeave = (e: React.DragEvent) => { setDragOverCategory(null); };
  const handleTagDrop = (e: React.DragEvent, targetCategory: keyof BreakdownData) => { e.preventDefault(); setDragOverCategory(null); const data = e.dataTransfer.getData('text/plain'); if (!data) return; try { const { category: sourceCategory, item: itemName } = JSON.parse(data); if (sourceCategory === targetCategory) return; if (activeBeat) { const current = activeBeat.breakdown || { props: [], sound: [], costume: [], vfx: [], practical: [], cast: [], location: [] }; const getName = (i: string | BreakdownItem) => typeof i === 'string' ? i : i.name; const sourceArray = current[sourceCategory as keyof BreakdownData] || []; const itemObj = sourceArray.find(i => getName(i) === itemName); const newSourceList = sourceArray.filter(i => getName(i) !== itemName); const targetList = current[targetCategory] || []; const newTargetList = targetList.some(i => getName(i) === itemName) ? targetList : [...targetList, itemObj || { name: itemName, source: '' }]; updateBeat(activeBeat.id, { breakdown: { ...current, [sourceCategory]: newSourceList, [targetCategory]: newTargetList } }); } } catch (err) { console.error("Drop failed", err); } };
  const TagInput = ({ category }: { category: keyof BreakdownData }) => { const [val, setVal] = useState(''); return ( <div className="flex gap-1 mt-2"> <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { addTag(activeBeatId!, category, val.trim()); setVal(''); } }} onFocus={(e) => { e.currentTarget.style.borderColor = appAccentColor; }} onBlur={(e) => { e.currentTarget.style.borderColor = ''; }} className={`flex-1 border rounded px-2 py-1 text-[10px] outline-none transition-colors ${isLight ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-[#111] border-[#333] text-white'}`} placeholder="Add..." /> <button onClick={() => { if(val.trim()) { addTag(activeBeatId!, category, val.trim()); setVal(''); } }} className={`px-2 rounded ${isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-[#222] hover:bg-[#333] text-gray-400'}`}><Plus size={10}/></button> </div> ); };
  const CATEGORY_STYLES: Record<string, { lightBadge: string, darkBadge: string, lightTag: string, darkTag: string }> = {
    location: {
      lightBadge: 'text-orange-900 bg-orange-100/90 border-orange-200 font-extrabold',
      darkBadge: 'text-orange-400 bg-orange-950/40 border-orange-800/50 font-bold',
      lightTag: 'bg-orange-50/90 text-orange-950 border-orange-200/90 hover:bg-orange-100 font-semibold shadow-2xs',
      darkTag: 'bg-orange-950/30 text-orange-200 border-orange-900/50 hover:bg-orange-900/40'
    },
    vfx: {
      lightBadge: 'text-emerald-900 bg-emerald-100/90 border-emerald-200 font-extrabold',
      darkBadge: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50 font-bold',
      lightTag: 'bg-emerald-50/90 text-emerald-950 border-emerald-200/90 hover:bg-emerald-100 font-semibold shadow-2xs',
      darkTag: 'bg-emerald-950/30 text-emerald-200 border-emerald-900/50 hover:bg-emerald-900/40'
    },
    practical: {
      lightBadge: 'text-red-900 bg-red-100/90 border-red-200 font-extrabold',
      darkBadge: 'text-red-400 bg-red-950/40 border-red-800/50 font-bold',
      lightTag: 'bg-red-50/90 text-red-950 border-red-200/90 hover:bg-red-100 font-semibold shadow-2xs',
      darkTag: 'bg-red-950/30 text-red-200 border-red-900/50 hover:bg-red-900/40'
    },
    props: {
      lightBadge: 'text-rose-900 bg-rose-100/90 border-rose-200 font-extrabold',
      darkBadge: 'text-rose-400 bg-rose-950/40 border-rose-800/50 font-bold',
      lightTag: 'bg-rose-50/90 text-rose-950 border-rose-200/90 hover:bg-rose-100 font-semibold shadow-2xs',
      darkTag: 'bg-rose-950/30 text-rose-200 border-rose-900/50 hover:bg-rose-900/40'
    },
    sound: {
      lightBadge: 'text-sky-900 bg-sky-100/90 border-sky-200 font-extrabold',
      darkBadge: 'text-sky-400 bg-sky-950/40 border-sky-800/50 font-bold',
      lightTag: 'bg-sky-50/90 text-sky-950 border-sky-200/90 hover:bg-sky-100 font-semibold shadow-2xs',
      darkTag: 'bg-sky-950/30 text-sky-200 border-sky-900/50 hover:bg-sky-900/40'
    },
    costume: {
      lightBadge: 'text-purple-900 bg-purple-100/90 border-purple-200 font-extrabold',
      darkBadge: 'text-purple-400 bg-purple-950/40 border-purple-800/50 font-bold',
      lightTag: 'bg-purple-50/90 text-purple-950 border-purple-200/90 hover:bg-purple-100 font-semibold shadow-2xs',
      darkTag: 'bg-purple-950/30 text-purple-200 border-purple-900/50 hover:bg-purple-900/40'
    },
    cast: {
      lightBadge: 'text-amber-950 bg-amber-100/90 border-amber-200 font-extrabold',
      darkBadge: 'text-amber-400 bg-amber-950/40 border-amber-800/50 font-bold',
      lightTag: 'bg-amber-50/90 text-amber-950 border-amber-200/90 hover:bg-amber-100 font-semibold shadow-2xs',
      darkTag: 'bg-amber-950/30 text-amber-200 border-amber-900/50 hover:bg-amber-900/40'
    }
  };

  const BreakdownSection = ({ title, category, icon: Icon }: any) => { 
    const items = activeBeat?.breakdown?.[category as keyof BreakdownData] || []; 
    const isDragOver = dragOverCategory === category; 
    const catStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.cast;

    return ( 
      <div className={`mb-3.5 border transition-all ${
        isLight 
          ? 'bg-slate-50/80 border-slate-200/90 shadow-2xs' 
          : 'bg-[#181818] border-[#2b2b2b]'
      }`} 
      style={isDragOver ? { borderColor: appAccentColor, boxShadow: `0 0 0 2px ${appAccentColor}80` } : undefined}
      onDragOver={(e) => handleTagDragOver(e, category)} 
      onDragLeave={handleTagDragLeave} 
      onDrop={(e) => handleTagDrop(e, category)}> 
        <div className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${isLight ? catStyle.lightBadge : catStyle.darkBadge}`}>
          <span className="text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5">
            <Icon size={12} /> {title}
          </span>
          <span className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 ${isLight ? 'bg-white/70 text-slate-600' : 'bg-black/30 text-slate-300'}`}>{items.length}</span>
        </div>
        
        <div className="p-3">
          <div className="flex flex-wrap gap-1.5 min-h-[28px] my-1"> 
          {items.length === 0 && <span className={`text-[10px] italic select-none py-1 px-1 ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>No items tagged</span>} 
          {items.map((item, i) => { 
            const name = typeof item === 'string' ? item : item.name; 
            const source = typeof item === 'string' ? undefined : item.source; 
            return ( 
              <div 
                key={i} 
                draggable 
                onDragStart={(e) => handleTagDragStart(e, category, name)} 
                onMouseEnter={() => (source || name) && highlightSourceText(source || name, category)} 
                onMouseLeave={clearHighlight} 
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10.5px] border group cursor-move transition-all ${
                  isLight ? catStyle.lightTag : catStyle.darkTag
                } ${showSourceHighlights && source ? 'font-bold' : ''}`} 
                style={showSourceHighlights && source ? { boxShadow: `0 0 0 2px ${appAccentColor}` } : undefined}
                title={source ? `Source: "${source}"` : "No source info"} 
              > 
                <span>{name}</span> 
                <button onClick={() => removeTag(category as keyof BreakdownData, name)} className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500 hover:text-white ${isLight ? 'text-slate-400' : 'text-gray-400'}`}><X size={10}/></button> 
              </div> 
            ); 
          })} 
          </div> 
          <TagInput category={category as keyof BreakdownData} /> 
        </div> 
      </div> 
    ); 
  };

  // --- EDITOR CONTEXT MENU HANDLERS ---
  const handleScriptContextMenu = (e: React.MouseEvent, beatId: number) => {
    e.preventDefault();
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    setScriptContextMenu({ x: e.clientX, y: e.clientY, beatId, selectionText: selectedText });
  };

  const applyInlineStyle = (command: string, value?: string) => {
      document.execCommand(command, false, value);
      setScriptContextMenu(null);
  };

  const applyTagging = (category: keyof BreakdownData) => {
      if (!scriptContextMenu?.selectionText || !scriptContextMenu?.beatId) return;
      
      // Update active beat focus to the tagged beat
      setActiveBeatId(scriptContextMenu.beatId);
      
      addTag(scriptContextMenu.beatId, category, scriptContextMenu.selectionText, scriptContextMenu.selectionText);
      setActiveSidebar('breakdown');
      setScriptContextMenu(null);
  };

  const handleSendSelectionToNote = () => {
      if (!scriptContextMenu?.selectionText) return;
      const html = `<div class="nl-block">${scriptContextMenu.selectionText}</div>`;
      addNote(html);
      setActiveSidebar('scratchpad');
      setScriptContextMenu(null);
  };

  const rightPanelCount = activeSidebar === 'breakdown'
      ? (() => {
          const b = activeBeat?.breakdown;
          if (!b) return 0;
          return (b.props?.length || 0) + (b.sound?.length || 0) + (b.costume?.length || 0) + (b.vfx?.length || 0) + (b.practical?.length || 0) + (b.cast?.length || 0) + (b.location?.length || 0);
      })()
      : activeSidebar === 'scratchpad'
          ? (scratchpadMode === 'global' ? (Array.isArray(globalNotes) ? globalNotes.length : 0) : (Array.isArray(activeBeat?.notes) ? activeBeat.notes.length : 0))
          : (Array.isArray(activeBeat?.versions) ? activeBeat.versions.length : 0);
  const rightPanelLabel = activeSidebar === 'breakdown' ? 'tags' : activeSidebar === 'scratchpad' ? 'notes' : 'versions';

  return (
    <div className={`flex w-full h-full overflow-hidden font-sans ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#0c0c0c] text-white'}`} onClick={() => setScriptContextMenu(null)}>
      
      {showNav && (
        <div 
            className={`flex flex-col shrink-0 z-20 shadow-2xl transition-all relative border-r ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0a0a0a] border-[#222]'}`}
            style={{ width: sidebarWidth }}
        >
            <div className={`flex-1 flex flex-col overflow-hidden ${isLight ? 'bg-slate-50' : 'bg-[#0a0a0a]'}`}>
                <div className={`px-4 py-3 border-b flex items-center justify-between ${isLight ? 'border-slate-200 bg-slate-100/50' : 'border-[#222] bg-[#121216]'}`}>
                    <div className="flex items-center gap-2">
                        {navMode === 'board' ? <FileText size={14} style={{ color: appAccentColor }} /> : <MapIcon size={14} style={{ color: appAccentColor }} />}
                        <span className={`text-xs font-black uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{navMode === 'board' ? 'Summary Cards' : 'Locations'}</span>
                    </div>
                    <span 
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition-colors"
                        style={{
                            backgroundColor: `color-mix(in srgb, ${appAccentColor} 14%, transparent)`,
                            borderColor: `color-mix(in srgb, ${appAccentColor} 40%, transparent)`,
                            color: appAccentColor,
                        }}
                    >
                        {navMode === 'board' ? `${beats.length} ${beats.length === 1 ? 'scene' : 'scenes'}` : `${locationCount} ${locationCount === 1 ? 'location' : 'locations'}`}
                    </span>
                </div>

                <div className={`px-2.5 py-2 border-b flex items-center gap-1 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#222] bg-[#0d0d0d]'}`}>
                    <button 
                        onClick={() => setNavMode('board')} 
                        className={`flex-1 py-1.5 rounded text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${navMode === 'board' ? 'shadow-xs' : (isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-gray-500 hover:text-white hover:bg-white/5')}`}
                        style={navMode === 'board' ? { backgroundColor: appAccentColor, color: '#000000' } : undefined}
                    >
                        <FileText size={10} /> Summary
                    </button>
                    <button 
                        onClick={() => setNavMode('list')} 
                        className={`flex-1 py-1.5 rounded text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${navMode === 'list' ? 'shadow-xs' : (isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-gray-500 hover:text-white hover:bg-white/5')}`}
                        style={navMode === 'list' ? { backgroundColor: appAccentColor, color: '#000000' } : undefined}
                    >
                        <MapIcon size={10} /> Locations
                    </button>
                </div>
                
                <div className="flex-1 overflow-hidden relative">
                    {navMode === 'board' ? (
                        <SummaryCardsPanel 
                            beats={beats} 
                            groups={groups}
                            connections={connections}
                            activeBeatId={activeBeatId}
                            onBeatClick={scrollToBeat}
                            updateBeat={updateBeat}
                            setBeats={setBeats}
                            captureSnapshot={captureSnapshot}
                            reorderBeats={reorderBeats}
                            isLight={isLight}
                            beatPageMap={beatPageMap}
                        />
                    ) : (
                        <LocationNavPanel 
                            beats={sortedBeats} 
                            activeBeatId={activeBeatId}
                            onBeatClick={scrollToBeat}
                            isLight={isLight}
                        />
                    )}
                </div>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize transition-colors z-50 group" onMouseDown={() => { isResizingRef.current = true; document.body.style.cursor = 'col-resize'; }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-12 flex flex-col gap-1 items-center justify-center pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity">
                    <div className="w-0.5 h-full" style={{ backgroundColor: appAccentColor }}></div>
                </div>
            </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className={`w-full border-b flex flex-col shrink-0 z-20 shadow-xs select-none ${isLight ? 'bg-white border-slate-200' : 'bg-[#111] border-[#222]'}`}>
            <div className={`flex items-center justify-between px-4 py-2 h-12 border-b ${isLight ? 'border-slate-200' : 'border-[#222]'}`}>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setShowNav(!showNav)} 
                        className={`w-8 h-8 flex items-center justify-center rounded border transition-all ${showNav ? '' : (isLight ? 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'bg-[#1a1a1a] border-[#333] text-gray-400 hover:text-white')}`} 
                        style={showNav ? { 
                            backgroundColor: `color-mix(in srgb, ${appAccentColor} 14%, transparent)`, 
                            borderColor: `color-mix(in srgb, ${appAccentColor} 45%, transparent)`, 
                            color: appAccentColor 
                        } : undefined}
                        title="Toggle Navigation"
                    >
                        <PanelLeft size={14} />
                    </button>
                    <div className={`flex items-center rounded border p-0.5 gap-0.5 relative ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#1a1a1a] border-[#333]'}`}>
                        {FORMAT_BUTTONS.map((btn) => {
                            const BtnIcon = btn.icon;
                            const isActive = activeFormat === btn.id;
                            return (
                                <button 
                                    key={btn.id} 
                                    onMouseDown={(e) => { e.preventDefault(); handleFormat(btn.id); }} 
                                    className={`px-2 py-1.5 text-[10px] font-bold uppercase rounded-xs transition-all duration-200 flex items-center gap-1.5 min-w-[28px] justify-center ${isActive ? 'shadow-xs font-bold' : (isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-gray-400 hover:text-white hover:bg-[#222]')}`} 
                                    style={isActive ? { backgroundColor: appAccentColor, color: '#000000' } : undefined}
                                    title={`${btn.id.charAt(0).toUpperCase() + btn.id.slice(1)} (${btn.short})`}
                                >
                                    <BtnIcon size={12} strokeWidth={2.5} />
                                    <span className={`font-black opacity-80 ${isConstrained ? 'hidden 2xl:inline' : 'hidden md:inline'}`}>{btn.label}</span>
                                </button>
                            );
                        })}
                        <div className={`w-px h-4 mx-1 ${isLight ? 'bg-slate-300' : 'bg-[#333]'}`}></div>
                        <button 
                            onClick={() => setShowLanguageConfig(!showLanguageConfig)}
                            className={`p-1.5 rounded transition-all flex items-center justify-center ${showLanguageConfig ? 'font-bold shadow-xs' : (isLight ? 'text-slate-500 hover:text-slate-900' : 'text-gray-500 hover:text-white')}`}
                            style={showLanguageConfig ? { backgroundColor: appAccentColor, color: '#000000' } : undefined}
                            title="Configure Element Languages"
                        >
                            <Settings size={14} />
                        </button>
                        {showLanguageConfig && (
                          <LanguageSettingsPopover 
                            config={scriptConfig.languageConfig} 
                            onUpdate={updateLanguageConfig} 
                            onClose={() => setShowLanguageConfig(false)}
                            isLight={isLight}
                          />
                        )}
                        <div className={`w-px h-4 mx-1 ${isLight ? 'bg-slate-300' : 'bg-[#333]'}`}></div>
                        {onNavigateToView && (
                            <button 
                                onClick={() => onNavigateToView('characterdesign')}
                                className={`px-2.5 py-1.5 rounded transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase ${isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-gray-400 hover:text-white hover:bg-[#222]'}`}
                                title="Open Writer Casting Page"
                            >
                                <Users size={13} strokeWidth={2.5} />
                                <span className={isConstrained ? 'hidden 2xl:inline' : 'hidden xl:inline'}>Characters</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">

                    {/* Page & Scene Stats Badge */}
                    <div 
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono select-none tracking-tight transition-colors ${
                            isLight 
                                ? 'bg-slate-100 border-slate-200 text-slate-600 shadow-xs' 
                                : 'bg-white/[0.04] border-white/10 text-slate-300 shadow-sm'
                        }`}
                        title={`Total: ${totalPages} Pages • ${sortedBeats.length} ${sortedBeats.length === 1 ? 'Scene' : 'Scenes'}`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: appAccentColor }} />
                        <span className="font-bold text-slate-900 dark:text-slate-100">P.{totalPages}</span>
                        <span className="opacity-40">•</span>
                        <span>{sortedBeats.length} {isConstrained ? 'sc' : (sortedBeats.length === 1 ? 'scene' : 'scenes')}</span>
                    </div>

                    {/* Studio Drawers (Notes, Breakdown, History) */}
                    <div className={`flex items-center rounded-lg border p-0.5 gap-0.5 ${
                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/[0.04] border-white/10'
                    }`}>
                        <button 
                            onClick={() => setActiveSidebar(activeSidebar === 'scratchpad' ? 'none' : 'scratchpad')} 
                            className={`px-2 py-1 rounded-md flex items-center gap-1.5 text-[11px] font-semibold transition-all duration-150 ${
                                activeSidebar === 'scratchpad' 
                                    ? (isLight ? 'bg-white shadow-xs font-bold' : 'bg-[#222] shadow-sm font-bold') 
                                    : (isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5')
                            }`} 
                            style={activeSidebar === 'scratchpad' ? { color: appAccentColor } : undefined}
                            title="Scene & Project Notes (Scratchpad)"
                        >
                            <StickyNote size={13} style={activeSidebar === 'scratchpad' ? { color: appAccentColor } : undefined} className={activeSidebar === 'scratchpad' ? '' : 'opacity-75'} />
                            <span className={isConstrained ? 'hidden' : 'hidden xl:inline'}>Notes</span>
                        </button>
                        <button 
                            onClick={() => setActiveSidebar(activeSidebar === 'breakdown' ? 'none' : 'breakdown')} 
                            className={`px-2 py-1 rounded-md flex items-center gap-1.5 text-[11px] font-semibold transition-all duration-150 ${
                                activeSidebar === 'breakdown' 
                                    ? (isLight ? 'bg-white shadow-xs font-bold' : 'bg-[#222] shadow-sm font-bold') 
                                    : (isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5')
                            }`} 
                            style={activeSidebar === 'breakdown' ? { color: appAccentColor } : undefined}
                            title="Scene Elements Breakdown"
                        >
                            <ListChecks size={13} style={activeSidebar === 'breakdown' ? { color: appAccentColor } : undefined} className={activeSidebar === 'breakdown' ? '' : 'opacity-75'} />
                            <span className={isConstrained ? 'hidden' : 'hidden xl:inline'}>Breakdown</span>
                        </button>
                        <button 
                            onClick={() => setActiveSidebar(activeSidebar === 'history' ? 'none' : 'history')} 
                            className={`px-2 py-1 rounded-md flex items-center gap-1.5 text-[11px] font-semibold transition-all duration-150 ${
                                activeSidebar === 'history' 
                                    ? (isLight ? 'bg-white shadow-xs font-bold' : 'bg-[#222] shadow-sm font-bold') 
                                    : (isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5')
                            }`} 
                            style={activeSidebar === 'history' ? { color: appAccentColor } : undefined}
                            title="Beat Snapshot History"
                        >
                            <History size={13} style={activeSidebar === 'history' ? { color: appAccentColor } : undefined} className={activeSidebar === 'history' ? '' : 'opacity-75'} />
                            <span className={isConstrained ? 'hidden' : 'hidden xl:inline'}>History</span>
                        </button>
                    </div>

                    {/* Script Production Tools (Revisions & Transcoder) */}
                    <div className={`flex items-center rounded-lg border p-0.5 gap-0.5 ${
                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/[0.04] border-white/10'
                    }`}>
                        <button 
                            onClick={() => setShowArchiveModal(true)} 
                            className={`px-2 py-1 rounded-md flex items-center gap-1.5 text-[11px] font-semibold transition-all duration-150 ${
                                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`} 
                            title="Hollywood Script Revisions (White, Blue, Pink...)"
                        >
                            <Archive size={13} style={{ color: appAccentColor }} />
                            <span className={isConstrained ? 'hidden' : 'hidden xl:inline'}>Revisions</span>
                        </button>
                        <button 
                            onClick={() => setShowTranscoderModal(true)} 
                            className={`px-2 py-1 rounded-md flex items-center gap-1.5 text-[11px] font-semibold transition-all duration-150 ${
                                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`} 
                            title="Tamil / Bamini Transcoder"
                        >
                            <Type size={13} style={{ color: appAccentColor }} />
                            <span className={isConstrained ? 'hidden' : 'hidden xl:inline'}>Tamil</span>
                        </button>
                    </div>

                    {/* Paper Theme Icons (Sun, Coffee, Moon, Eye) */}
                    <div className={`flex items-center rounded-lg border p-0.5 gap-0.5 ${
                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/[0.04] border-white/10'
                    }`} title="Screenplay Paper Theme">
                        <button 
                            onClick={() => setPaperTheme('white')} 
                            title="White Paper (Standard)" 
                            className={`p-1.5 rounded-md transition-all ${
                                scriptConfig.paperTheme === 'white' 
                                    ? (isLight ? 'bg-white shadow-xs font-bold' : 'bg-[#222] shadow-sm font-bold') 
                                    : (isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5')
                            }`}
                            style={scriptConfig.paperTheme === 'white' ? { color: appAccentColor } : undefined}
                        >
                            <Sun size={13} />
                        </button>
                        <button 
                            onClick={() => setPaperTheme('sepia')} 
                            title="Sepia Paper (Warm Daylight)" 
                            className={`p-1.5 rounded-md transition-all ${
                                scriptConfig.paperTheme === 'sepia' 
                                    ? (isLight ? 'bg-[#fdf6e3] text-[#586e75] shadow-xs font-bold' : 'bg-[#2a2419] text-[#e0a84e] shadow-sm font-bold') 
                                    : (isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5')
                            }`}
                        >
                            <Coffee size={13} />
                        </button>
                        <button 
                            onClick={() => setPaperTheme('dark')} 
                            title="Dark Paper (Midnight)" 
                            className={`p-1.5 rounded-md transition-all ${
                                scriptConfig.paperTheme === 'dark' 
                                    ? (isLight ? 'bg-slate-900 text-white shadow-xs font-bold' : 'bg-[#222] shadow-sm font-bold') 
                                    : (isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5')
                            }`}
                            style={scriptConfig.paperTheme === 'dark' && !isLight ? { color: appAccentColor } : undefined}
                        >
                            <Moon size={13} />
                        </button>
                        <button 
                            onClick={() => setPaperTheme('red')} 
                            title="Night Red Paper (Astro / Eye Saver)" 
                            className={`p-1.5 rounded-md transition-all ${
                                scriptConfig.paperTheme === 'red' 
                                    ? (isLight ? 'bg-black text-red-500 shadow-xs font-bold' : 'bg-[#2b0c0c] text-red-400 shadow-sm font-bold') 
                                    : (isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5')
                            }`}
                        >
                            <Eye size={13} />
                        </button>
                    </div>

                    {/* Modern Zoom Controls */}
                    <div className={`flex items-center rounded-lg border p-0.5 ${
                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/[0.04] border-white/10'
                    }`}>
                        <button 
                            onClick={() => setZoom(Math.max(0.2, zoom - 0.1))} 
                            className={`p-1 rounded-md transition-colors ${
                                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                            title="Zoom Out"
                        >
                            <ZoomOut size={12} />
                        </button>
                        <button 
                            onClick={() => setZoom(1.0)} 
                            title="Click to reset zoom to 100%" 
                            className={`px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-tight rounded-sm transition-colors text-center min-w-[36px] ${
                                Math.round(zoom * 100) === 100
                                    ? (isLight ? 'text-slate-700' : 'text-slate-300')
                                    : 'font-black'
                            } ${isLight ? 'hover:bg-slate-200/60' : 'hover:bg-white/5'}`}
                            style={Math.round(zoom * 100) !== 100 ? { color: appAccentColor } : undefined}
                        >
                            {Math.round(zoom * 100)}%
                        </button>
                        <button 
                            onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} 
                            className={`p-1 rounded-md transition-colors ${
                                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                            title="Zoom In"
                        >
                            <ZoomIn size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            <div ref={scrollerRef} className={`flex-1 overflow-y-auto relative flex flex-col items-center pb-96 custom-scrollbar ${isLight ? 'bg-slate-200/80' : 'bg-[#121212]'}`}>
                <div className="transition-transform duration-200 origin-top py-10" style={{ transform: `scale(${zoom})` }}>
                    <div className="flex flex-col items-center">
                        <style>{`
                            .screenplay-a4-sheet {
                                /* Action */
                                --font-action: ${isTamilMode && tamilFontFamily && tamilFontFamily !== scriptConfig.action.fontFamily ? `'${scriptConfig.action.fontFamily}', '${tamilFontFamily}', Courier, monospace` : `'${scriptConfig.action.fontFamily}', Courier, monospace`};
                                --size-action: ${scriptConfig.action.fontSize}px;
                                --lh-action: ${scriptConfig.action.lineHeight};
                                --margin-action: ${scriptConfig.action.marginLeft}%;
                                --width-action: ${scriptConfig.action.width}%;
                                --mt-action: ${scriptConfig.action.marginTop}rem;
                                --mb-action: ${scriptConfig.action.marginBottom}rem;
                                --align-action: ${scriptConfig.action.textAlign};
                                --weight-action: ${scriptConfig.action.bold ? 'bold' : 'normal'};
                                --style-action: ${scriptConfig.action.italic ? 'italic' : 'normal'};
                                --dec-action: ${scriptConfig.action.underline ? 'underline' : 'none'};
                                /* Character */
                                --font-character: ${isTamilMode && tamilFontFamily && tamilFontFamily !== scriptConfig.character.fontFamily ? `'${scriptConfig.character.fontFamily}', '${tamilFontFamily}', Courier, monospace` : `'${scriptConfig.character.fontFamily}', Courier, monospace`};
                                --size-character: ${scriptConfig.character.fontSize}px;
                                --lh-character: ${scriptConfig.character.lineHeight};
                                --margin-character: ${scriptConfig.character.marginLeft}%;
                                --width-character: ${scriptConfig.character.width}%;
                                --mt-character: ${scriptConfig.character.marginTop}rem;
                                --mb-character: ${scriptConfig.character.marginBottom}rem;
                                --align-character: ${scriptConfig.character.textAlign};
                                --weight-character: ${scriptConfig.character.bold ? 'bold' : 'normal'};
                                --style-character: ${scriptConfig.character.italic ? 'italic' : 'normal'};
                                --dec-character: ${scriptConfig.character.underline ? 'underline' : 'none'};
                                /* Dialogue */
                                --font-dialogue: ${isTamilMode && tamilFontFamily && tamilFontFamily !== scriptConfig.dialogue.fontFamily ? `'${scriptConfig.dialogue.fontFamily}', '${tamilFontFamily}', Courier, monospace` : `'${scriptConfig.dialogue.fontFamily}', Courier, monospace`};
                                --size-dialogue: ${scriptConfig.dialogue.fontSize}px;
                                --lh-dialogue: ${scriptConfig.dialogue.lineHeight};
                                --margin-dialogue: ${scriptConfig.dialogue.marginLeft}%;
                                --width-dialogue: ${scriptConfig.dialogue.width}%;
                                --mt-dialogue: ${scriptConfig.dialogue.marginTop}rem;
                                --mb-dialogue: ${scriptConfig.dialogue.marginBottom}rem;
                                --align-dialogue: ${scriptConfig.dialogue.textAlign};
                                --weight-dialogue: ${scriptConfig.dialogue.bold ? 'bold' : 'normal'};
                                --style-dialogue: ${scriptConfig.dialogue.italic ? 'italic' : 'normal'};
                                --dec-dialogue: ${scriptConfig.dialogue.underline ? 'underline' : 'none'};
                                /* Parenthetical */
                                --font-parenthetical: ${isTamilMode && tamilFontFamily && tamilFontFamily !== scriptConfig.parenthetical.fontFamily ? `'${scriptConfig.parenthetical.fontFamily}', '${tamilFontFamily}', Courier, monospace` : `'${scriptConfig.parenthetical.fontFamily}', Courier, monospace`};
                                --size-parenthetical: ${scriptConfig.parenthetical.fontSize}px;
                                --lh-parenthetical: ${scriptConfig.parenthetical.lineHeight};
                                --margin-parenthetical: ${scriptConfig.parenthetical.marginLeft}%;
                                --width-parenthetical: ${scriptConfig.parenthetical.width}%;
                                --mt-parenthetical: ${scriptConfig.parenthetical.marginTop}rem;
                                --mb-parenthetical: ${scriptConfig.parenthetical.marginBottom}rem;
                                --align-parenthetical: ${scriptConfig.parenthetical.textAlign};
                                --weight-parenthetical: ${scriptConfig.parenthetical.bold ? 'bold' : 'normal'};
                                --style-parenthetical: ${scriptConfig.parenthetical.italic ? 'italic' : 'normal'};
                                --dec-parenthetical: ${scriptConfig.parenthetical.underline ? 'underline' : 'none'};
                                /* Transition */
                                --font-transition: ${isTamilMode && tamilFontFamily && tamilFontFamily !== scriptConfig.transition.fontFamily ? `'${scriptConfig.transition.fontFamily}', '${tamilFontFamily}', Courier, monospace` : `'${scriptConfig.transition.fontFamily}', Courier, monospace`};
                                --size-transition: ${scriptConfig.transition.fontSize}px;
                                --lh-transition: ${scriptConfig.transition.lineHeight};
                                --margin-transition: ${scriptConfig.transition.marginLeft}%;
                                --width-transition: ${scriptConfig.transition.width}%;
                                --mt-transition: ${scriptConfig.transition.marginTop}rem;
                                --mb-transition: ${scriptConfig.transition.marginBottom}rem;
                                --align-transition: ${scriptConfig.transition.textAlign};
                                --weight-transition: ${scriptConfig.transition.bold ? 'bold' : 'normal'};
                                --style-transition: ${scriptConfig.transition.italic ? 'italic' : 'normal'};
                                --dec-transition: ${scriptConfig.transition.underline ? 'underline' : 'none'};
                                /* Shot */
                                --font-shot: ${isTamilMode && tamilFontFamily && tamilFontFamily !== scriptConfig.shot.fontFamily ? `'${scriptConfig.shot.fontFamily}', '${tamilFontFamily}', Courier, monospace` : `'${scriptConfig.shot.fontFamily}', Courier, monospace`};
                                --size-shot: ${scriptConfig.shot.fontSize}px;
                                --lh-shot: ${scriptConfig.shot.lineHeight};
                                --margin-shot: ${scriptConfig.shot.marginLeft}%;
                                --width-shot: ${scriptConfig.shot.width}%;
                                --mt-shot: ${scriptConfig.shot.marginTop}rem;
                                --mb-shot: ${scriptConfig.shot.marginBottom}rem;
                                --align-shot: ${scriptConfig.shot.textAlign};
                                --weight-shot: ${scriptConfig.shot.bold ? 'bold' : 'normal'};
                                --style-shot: ${scriptConfig.shot.italic ? 'italic' : 'normal'};
                                --dec-shot: ${scriptConfig.shot.underline ? 'underline' : 'none'};
                                /* Lyrics */
                                --font-lyrics: ${isTamilMode && tamilFontFamily && tamilFontFamily !== scriptConfig.lyrics.fontFamily ? `'${scriptConfig.lyrics.fontFamily}', '${tamilFontFamily}', Courier, monospace` : `'${scriptConfig.lyrics.fontFamily}', Courier, monospace`};
                                --size-lyrics: ${scriptConfig.lyrics.fontSize}px;
                                --lh-lyrics: ${scriptConfig.lyrics.lineHeight};
                                --margin-lyrics: ${scriptConfig.lyrics.marginLeft}%;
                                --width-lyrics: ${scriptConfig.lyrics.width}%;
                                --mt-lyrics: ${scriptConfig.lyrics.marginTop}rem;
                                --mb-lyrics: ${scriptConfig.lyrics.marginBottom}rem;
                                --align-lyrics: ${scriptConfig.lyrics.textAlign};
                                --weight-lyrics: ${scriptConfig.lyrics.bold ? 'bold' : 'normal'};
                                --style-lyrics: ${scriptConfig.lyrics.italic ? 'italic' : 'normal'};
                                --dec-lyrics: ${scriptConfig.lyrics.underline ? 'underline' : 'none'};
                            }
                            /* Slugline */
                            .screenplay-a4-sheet .sc-slugline {
                                font-family: ${isTamilMode && tamilFontFamily && tamilFontFamily !== scriptConfig.slugline.fontFamily ? `'${scriptConfig.slugline.fontFamily}', '${tamilFontFamily}', Courier, monospace` : `'${scriptConfig.slugline.fontFamily}', Courier, monospace`} !important;
                                font-size: ${scriptConfig.slugline.fontSize}px !important;
                                line-height: ${scriptConfig.slugline.lineHeight} !important;
                                letter-spacing: ${scriptConfig.slugline.letterSpacing}px !important;
                                margin-top: ${scriptConfig.slugline.marginTop}em !important;
                                margin-bottom: ${scriptConfig.slugline.marginBottom}em !important;
                                font-weight: ${scriptConfig.slugline.bold ? 'bold' : 'normal'} !important;
                                font-style: ${scriptConfig.slugline.italic ? 'italic' : 'normal'} !important;
                                text-decoration: ${scriptConfig.slugline.underline ? 'underline' : 'none'} !important;
                                text-align: ${scriptConfig.slugline.textAlign} !important;
                                background-color: ${theme.slugBg} !important;
                                color: ${theme.slugText} !important;
                            }
                            .screenplay-a4-sheet .sc-slug {
                                color: ${theme.slug} !important;
                            }
                            /* Base text color for everything else */
                            .screenplay-a4-sheet .script-body {
                                color: ${theme.text};
                            }

                            /* Explicit Element Font & Formatting Rules */
                            .screenplay-a4-sheet .sc-action,
                            .screenplay-a4-sheet .sc-line.sc-action {
                                font-family: var(--font-action) !important;
                                font-size: var(--size-action);
                                line-height: var(--lh-action);
                                margin-left: var(--margin-action);
                                width: var(--width-action);
                                margin-top: var(--mt-action);
                                margin-bottom: var(--mb-action);
                                text-align: var(--align-action);
                                font-weight: var(--weight-action);
                                font-style: var(--style-action);
                                text-decoration: var(--dec-action);
                                color: ${theme.text};
                            }

                            .screenplay-a4-sheet .sc-character,
                            .screenplay-a4-sheet .sc-line.sc-character {
                                font-family: var(--font-character) !important;
                                font-size: var(--size-character);
                                line-height: var(--lh-character);
                                margin-left: var(--margin-character);
                                width: var(--width-character);
                                margin-top: var(--mt-character);
                                margin-bottom: var(--mb-character);
                                text-align: var(--align-character);
                                font-weight: var(--weight-character);
                                font-style: var(--style-character);
                                text-decoration: var(--dec-character);
                                text-transform: uppercase;
                                color: ${theme.text};
                            }

                            .screenplay-a4-sheet .sc-dialogue,
                            .screenplay-a4-sheet .sc-line.sc-dialogue {
                                font-family: var(--font-dialogue) !important;
                                font-size: var(--size-dialogue);
                                line-height: var(--lh-dialogue);
                                margin-left: var(--margin-dialogue);
                                width: var(--width-dialogue);
                                margin-top: var(--mt-dialogue);
                                margin-bottom: var(--mb-dialogue);
                                text-align: var(--align-dialogue);
                                font-weight: var(--weight-dialogue);
                                font-style: var(--style-dialogue);
                                text-decoration: var(--dec-dialogue);
                                color: ${theme.text};
                            }

                            .screenplay-a4-sheet .sc-parenthetical,
                            .screenplay-a4-sheet .sc-line.sc-parenthetical {
                                font-family: var(--font-parenthetical) !important;
                                font-size: var(--size-parenthetical);
                                line-height: var(--lh-parenthetical);
                                margin-left: var(--margin-parenthetical);
                                width: var(--width-parenthetical);
                                margin-top: var(--mt-parenthetical);
                                margin-bottom: var(--mb-parenthetical);
                                text-align: var(--align-parenthetical);
                                font-weight: var(--weight-parenthetical);
                                font-style: var(--style-parenthetical);
                                text-decoration: var(--dec-parenthetical);
                                color: ${theme.text};
                            }

                            .screenplay-a4-sheet .sc-transition,
                            .screenplay-a4-sheet .sc-line.sc-transition {
                                font-family: var(--font-transition) !important;
                                font-size: var(--size-transition);
                                line-height: var(--lh-transition);
                                margin-left: var(--margin-transition);
                                width: var(--width-transition);
                                margin-top: var(--mt-transition);
                                margin-bottom: var(--mb-transition);
                                text-align: var(--align-transition);
                                font-weight: var(--weight-transition);
                                font-style: var(--style-transition);
                                text-decoration: var(--dec-transition);
                                text-transform: uppercase;
                                color: ${theme.text};
                            }

                            .screenplay-a4-sheet .sc-shot,
                            .screenplay-a4-sheet .sc-line.sc-shot {
                                font-family: var(--font-shot) !important;
                                font-size: var(--size-shot);
                                line-height: var(--lh-shot);
                                margin-left: var(--margin-shot);
                                width: var(--width-shot);
                                margin-top: var(--mt-shot);
                                margin-bottom: var(--mb-shot);
                                text-align: var(--align-shot);
                                font-weight: var(--weight-shot);
                                font-style: var(--style-shot);
                                text-decoration: var(--dec-shot);
                                text-transform: uppercase;
                                color: ${theme.text};
                            }

                            .screenplay-a4-sheet .sc-lyrics,
                            .screenplay-a4-sheet .sc-line.sc-lyrics {
                                font-family: var(--font-lyrics) !important;
                                font-size: var(--size-lyrics);
                                line-height: var(--lh-lyrics);
                                margin-left: var(--margin-lyrics);
                                width: var(--width-lyrics);
                                margin-top: var(--mt-lyrics);
                                margin-bottom: var(--mb-lyrics);
                                text-align: var(--align-lyrics);
                                font-weight: var(--weight-lyrics);
                                font-style: var(--style-lyrics);
                                text-decoration: var(--dec-lyrics);
                                color: ${theme.text};
                            }

                            .screenplay-a4-sheet .sc-line:not([class*="sc-action"]):not([class*="sc-character"]):not([class*="sc-dialogue"]):not([class*="sc-parenthetical"]):not([class*="sc-transition"]):not([class*="sc-shot"]):not([class*="sc-lyrics"]):not([class*="sc-slugline"]) {
                                font-family: var(--font-action, 'Courier Prime', Courier, monospace);
                            }
                        `}</style>
                        <div 
                            className="relative screenplay-a4-sheet"
                            style={{
                                width: `${A4_WIDTH}px`,
                                minHeight: `${totalPages * (A4_HEIGHT + PAGE_GAP) - PAGE_GAP}px`,
                            }}
                        >
                            {/* 1. Backdrop of Physical A4 Sheets with Authentic Screenplay Page Numbers */}
                            <div 
                                className="paper-backdrop pointer-events-none absolute left-0 top-0 select-none"
                                style={{ width: `${A4_WIDTH}px` }}
                            >
                                {Array.from({ length: totalPages }).map((_, index) => (
                                    <div 
                                        key={`screenplay-paper-sheet-${index + 1}`}
                                        className="screenplay-paper-sheet transition-[background-color,box-shadow] duration-200"
                                        style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: `${index * (A4_HEIGHT + PAGE_GAP)}px`,
                                            width: `${A4_WIDTH}px`,
                                            height: `${A4_HEIGHT}px`,
                                            backgroundColor: theme.bg,
                                            boxShadow: theme.shadow,
                                            boxSizing: 'border-box',
                                        }}
                                    >
                                        {/* Top-right standard screenplay page number (Starting from Page 2) */}
                                        {index > 0 && (
                                            <div 
                                                className="absolute font-mono text-xs font-bold select-none tracking-widest opacity-60 pointer-events-none"
                                                style={{ 
                                                    top: '48px', 
                                                    right: '96px', 
                                                    color: theme.pageNum,
                                                    fontFamily: "'Courier Prime', Courier, monospace"
                                                }}
                                            >
                                                {index + 1}.
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* 2. Live Continuous Screenplay Content Layer */}
                            <div 
                                ref={contentRef}
                                className="relative z-10 w-full"
                                style={{
                                    paddingTop: `${MARGIN_TOP}px`,
                                    paddingBottom: `${MARGIN_BOTTOM}px`,
                                    paddingLeft: `${MARGIN_LEFT}px`,
                                    paddingRight: `${MARGIN_RIGHT}px`,
                                    boxSizing: 'border-box',
                                    color: theme.text,
                                    ...editorStyle,
                                }}
                            >
                                {sortedBeats.map((beat, i) => {
                                    const isReady = beat.status === 'ready';
                                    const isSandbox = sequenceCount > 0 && !isSequenceBeat(beat, connectedSet, beatOrder);
                                    
                                    const globalIndex = sortedBeats.findIndex(b => b.id === beat.id);
                                    const isFirstSandbox = sequenceCount > 0 && globalIndex === sequenceCount;

                                    const autoNum = (beat.sceneNumber && beat.sceneNumber.trim()) 
                                        ? beat.sceneNumber.trim() 
                                        : (beatOrder[beat.id] !== undefined ? beatOrder[beat.id].toString() : (globalIndex + 1).toString());
                                    const displayNumber = isSandbox ? '•' : autoNum;

                                    return (
                                        <React.Fragment key={beat.id}>
                                            {isFirstSandbox && (
                                                <div className="w-full py-6 flex items-center justify-center select-none pointer-events-none">
                                                    <div className={`h-px w-24 mr-4 border-b border-dashed ${isLight ? 'border-slate-400' : 'border-gray-500'}`}></div>
                                                    <span className={`text-[10px] font-mono uppercase tracking-[0.2em] font-bold ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Unsequenced Fragments</span>
                                                    <div className={`h-px w-24 ml-4 border-b border-dashed ${isLight ? 'border-slate-400' : 'border-gray-500'}`}></div>
                                                </div>
                                            )}
                                            <div 
                                                id={`beat-${beat.id}`} 
                                                className={`beat-block group relative ${activeBeatId === beat.id ? 'z-20' : 'z-10'}`} 
                                                onFocusCapture={() => setActiveBeatId(beat.id)} 
                                                onClick={() => setActiveBeatId(beat.id)} 
                                                onContextMenu={(e) => handleScriptContextMenu(e, beat.id)}
                                            >
                                                {/* Slugline Banner with Left & Right Scene Numbering */}
                                                <div 
                                                    className={`slugline-banner group/slug flex items-center gap-2 my-1 px-2.5 py-0.5 transition-colors duration-150 border-l-2 ${
                                                        activeBeatId === beat.id 
                                                            ? 'font-black shadow-xs' 
                                                            : 'hover:brightness-95 opacity-90 hover:opacity-100'
                                                    }`}
                                                    style={{
                                                        backgroundColor: activeBeatId === beat.id ? theme.activeSlugBg : theme.slugBg,
                                                        borderColor: activeBeatId === beat.id ? theme.activeBorder : (scriptConfig.paperTheme === 'sepia' ? 'rgba(107,114,128,0.25)' : scriptConfig.paperTheme === 'dark' ? 'rgba(148,163,184,0.25)' : scriptConfig.paperTheme === 'red' ? 'rgba(148,163,184,0.25)' : 'rgba(107,114,128,0.25)'),
                                                    }}
                                                >
                                                    {/* Left Scene Number Badge (Clickable to customize) */}
                                                    {!isSandbox && (
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleSetSceneNumber(beat.id, beat.sceneNumber || autoNum); }}
                                                            className={`shrink-0 px-1.5 py-0 text-[11px] font-mono font-black transition-all select-none ${
                                                                activeBeatId === beat.id 
                                                                    ? 'shadow-xs' 
                                                                    : (isLight ? 'bg-black/5 text-slate-800 border border-black/10 hover:text-black' : 'bg-white/5 text-zinc-200 border border-white/10 hover:text-white')
                                                            }`}
                                                            style={activeBeatId === beat.id ? {
                                                                backgroundColor: appAccentColor,
                                                                borderColor: appAccentColor,
                                                                color: '#000000',
                                                                borderWidth: '1px',
                                                                borderStyle: 'solid'
                                                            } : undefined}
                                                            title="Click to edit scene number"
                                                        >
                                                            {displayNumber}
                                                        </button>
                                                    )}

                                                    <div className="flex-1 flex items-center gap-1.5 font-black uppercase font-screenplay text-[13px] tracking-wide min-w-0">
                                                        <SlugInput 
                                                            id={`beat-prefix-${beat.id}`} 
                                                            value={beat.slug.prefix} 
                                                            onChange={v => handleSlugChange(beat.id, 'prefix', v)} 
                                                            onNext={() => document.getElementById(`beat-location-${beat.id}`)?.focus()} 
                                                            suggestions={SLUG_PREFIXES} 
                                                            className="w-20 shrink-0 font-black" 
                                                            style={{ color: activeBeatId === beat.id ? theme.activeSlugText : theme.slugText, backgroundColor: 'transparent' }} 
                                                            placeholder="INT." 
                                                            dropdownStyle={{ backgroundColor: theme.dropdownBg, color: theme.dropdownText, borderColor: theme.dropdownBorder }} 
                                                            readOnly={isReady || isScriptReadOnly} 
                                                        />
                                                        <SlugInput 
                                                            id={`beat-location-${beat.id}`} 
                                                            value={beat.slug.location} 
                                                            onChange={v => handleSlugChange(beat.id, 'location', v)} 
                                                            onNext={() => document.getElementById(`beat-time-${beat.id}`)?.focus()} 
                                                            suggestions={uniqueLocations} 
                                                            className="flex-1 font-black" 
                                                            style={{ color: activeBeatId === beat.id ? theme.activeSlugText : theme.slugText, backgroundColor: 'transparent' }} 
                                                            placeholder="LOCATION" 
                                                            dropdownStyle={{ backgroundColor: theme.dropdownBg, color: theme.dropdownText, borderColor: theme.dropdownBorder }} 
                                                            readOnly={isReady || isScriptReadOnly} 
                                                        />
                                                        <span className="opacity-50 font-black px-1 select-none" style={{ color: activeBeatId === beat.id ? theme.activeSlugText : theme.slugText }}>—</span>
                                                        <SlugInput 
                                                            id={`beat-time-${beat.id}`} 
                                                            value={beat.slug.time} 
                                                            onChange={v => handleSlugChange(beat.id, 'time', v)} 
                                                            onNext={() => editorRefs.current[beat.id]?.focus()} 
                                                            suggestions={SLUG_TIMES} 
                                                            className="w-28 shrink-0 font-black" 
                                                            style={{ color: activeBeatId === beat.id ? theme.activeSlugText : theme.slugText, backgroundColor: 'transparent' }} 
                                                            placeholder="TIME" 
                                                            dropdownStyle={{ backgroundColor: theme.dropdownBg, color: theme.dropdownText, borderColor: theme.dropdownBorder }} 
                                                            readOnly={isReady || isScriptReadOnly} 
                                                        />
                                                    </div>

                                                    {/* Right Scene Number (Standard Industry Screenplay Format) */}
                                                    {!isSandbox && (
                                                        <div 
                                                            className="shrink-0 font-mono text-[11px] font-black select-none tracking-widest px-1 opacity-75 group-hover:opacity-100"
                                                            style={{ color: activeBeatId === beat.id ? theme.activeSlugText : theme.slugText }}
                                                            title="Standard production scene number"
                                                        >
                                                            {displayNumber}
                                                        </div>
                                                    )}

                                                    {(isReady || isScriptReadOnly) && <Lock size={12} style={{ color: activeBeatId === beat.id ? theme.activeSlugText : '#10b981' }} className="ml-2 shrink-0" />}
                                                </div>
                                                <div>
                                                    <BeatEditorBlock beat={beat} isActive={activeBeatId === beat.id} isReady={isReady || isScriptReadOnly} uniqueCharacters={uniqueCharacters} setActiveFormat={setActiveFormat} onUpdateContent={handleContentUpdate} onFocus={() => setActiveBeatId(beat.id)} editorRefCallback={(el) => { editorRefs.current[beat.id] = el; }} />
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}

                                {!isScriptReadOnly && (
                                    <div 
                                        onClick={handleAddScene} 
                                        className="mt-8 mx-auto w-full max-w-xl h-8 border-b border-dashed flex items-center justify-center cursor-pointer transition-all duration-300 group opacity-50 hover:opacity-100"
                                        style={{ borderColor: 'transparent' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${appAccentColor}80`; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                                    >
                                        <span 
                                            className={`text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-colors ${isLight ? 'text-slate-500' : 'text-[#888]'}`}
                                            onMouseEnter={(e) => { e.currentTarget.style.color = appAccentColor; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.color = ''; }}
                                        >
                                            <Plus size={10} /> Add Scene
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {activeSidebar !== 'none' && (
                <div className={`w-[400px] flex flex-col animate-in slide-in-from-right-10 duration-200 z-30 shadow-2xl relative overflow-hidden border-l ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#0a0a0a] border-[#222] text-white'}`}>
                    <div className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${isLight ? 'border-slate-200 bg-slate-100/50' : 'border-[#222] bg-[#121216]'}`}>
                        <div className="flex items-center gap-2">
                            <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                                {activeSidebar === 'breakdown' && <><ListChecks size={14} style={{ color: appAccentColor }} /> Scene Breakdown</>}
                                {activeSidebar === 'scratchpad' && <><StickyNote size={14} style={{ color: appAccentColor }} /> Note Blocks</>}
                                {activeSidebar === 'history' && <><History size={14} style={{ color: appAccentColor }} /> Version History</>}
                            </h3>
                            <span 
                                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition-colors"
                                style={{
                                    backgroundColor: `color-mix(in srgb, ${appAccentColor} 14%, transparent)`,
                                    borderColor: `color-mix(in srgb, ${appAccentColor} 40%, transparent)`,
                                    color: appAccentColor,
                                }}
                            >
                                {rightPanelCount} {rightPanelLabel}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                            {activeSidebar === 'breakdown' && (
                                <button 
                                    onClick={() => { setShowSourceHighlights(!showSourceHighlights); clearHighlight(); }} 
                                    className={`p-1.5 rounded transition-colors ${showSourceHighlights ? 'font-bold' : (isLight ? 'text-slate-400 hover:text-slate-800' : 'text-gray-500 hover:text-white')}`} 
                                    style={showSourceHighlights ? { backgroundColor: appAccentColor, color: '#000000' } : undefined}
                                    title="Highlight source text in script on hover"
                                >
                                    <Eye size={14}/>
                                </button>
                            )}
                            <button onClick={() => { setActiveSidebar('none'); clearHighlight(); }} className={isLight ? "text-slate-400 hover:text-slate-800" : "text-gray-500 hover:text-white"}><X size={14}/></button>
                        </div>
                    </div>
                    <div className="flex-1 relative overflow-hidden">
                        {activeSidebar === 'breakdown' && (
                            <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4">
                                {activeBeat ? (
                                    <>
                                        <div className={`mb-6 pb-4 border-b ${isLight ? 'border-slate-200' : 'border-[#333]'}`}>
                                            <span className={`text-[9px] uppercase tracking-wider font-bold ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Scene Breakdown Target</span>
                                            <h4 className={`text-sm font-black uppercase mt-0.5 mb-4 ${isLight ? 'text-slate-900' : 'text-white'}`}>{activeBeat.slug.location || 'Untitled Scene'}</h4>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Output Language</span>
                                                <div className={`flex rounded border p-0.5 ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#111] border-[#333]'}`}>
                                                    <button 
                                                        onClick={() => setBreakdownLanguage('english')} 
                                                        className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${breakdownLanguage === 'english' ? 'shadow-xs' : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-500 hover:text-white')}`}
                                                        style={breakdownLanguage === 'english' ? { backgroundColor: appAccentColor, color: '#000000' } : undefined}
                                                    >
                                                        ENG
                                                    </button>
                                                    <button 
                                                        onClick={() => setBreakdownLanguage('tamil')} 
                                                        className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${breakdownLanguage === 'tamil' ? 'shadow-xs' : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-500 hover:text-white')}`}
                                                        style={breakdownLanguage === 'tamil' ? { backgroundColor: appAccentColor, color: '#000000' } : undefined}
                                                    >
                                                        TAM
                                                    </button>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={handleAnalyzeBreakdown} 
                                                disabled={isAnalyzing || !aiAvailable} 
                                                className="w-full py-2 font-bold text-xs uppercase rounded flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-xs hover:brightness-110"
                                                style={{ backgroundColor: appAccentColor, color: '#000000' }}
                                            >
                                                {isAnalyzing ? <Sparkles size={14} className="animate-spin" /> : <Sparkles size={14} />} {isAnalyzing ? 'Analyzing...' : 'Auto-Analyze'}
                                            </button>
                                        </div>
                                        <BreakdownSection title="Location Scenario" category="location" icon={MapIcon} color="text-orange-500" />
                                        <BreakdownSection title="Visual Effects" category="vfx" icon={Wand2} color="text-emerald-500" />
                                        <BreakdownSection title="Practical Effects" category="practical" icon={Flame} color="text-red-500" />
                                        <BreakdownSection title="Props" category="props" icon={Package} color="text-rose-500" />
                                        <BreakdownSection title="Sound / SFX" category="sound" icon={Mic2} color="text-sky-500" />
                                        <BreakdownSection title="Wardrobe" category="costume" icon={Shirt} color="text-pink-500" />
                                        <BreakdownSection title="Cast / Extras" category="cast" icon={Users} color="text-amber-500" />
                                    </>
                                ) : (
                                    <div className={`flex flex-col items-center justify-center h-full gap-2 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                        <ListChecks size={32} opacity={0.3} />
                                        <span className="text-xs text-center px-4">Select a scene to view or create breakdown items.</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeSidebar === 'scratchpad' && (
                          <SidebarErrorBoundary isLight={isLight}>
                            <div className="absolute inset-0 flex flex-col">
                              <div className={`px-4 py-3 border-b ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#161616] border-[#333]'}`}>
                                <div className={`flex p-1 rounded-lg border relative ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-[#333]'}`}>
                                  <button 
                                    onClick={() => setScratchpadMode('global')} 
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all relative z-10 flex items-center justify-center gap-1.5 ${scratchpadMode === 'global' ? 'shadow-xs' : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-500 hover:text-gray-300')}`}
                                    style={scratchpadMode === 'global' ? { backgroundColor: appAccentColor, color: '#000000' } : undefined}
                                  >
                                    <Globe size={10} /> Global
                                  </button>
                                  <button 
                                    onClick={() => setScratchpadMode('scene')} 
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all relative z-10 flex items-center justify-center gap-1.5 ${scratchpadMode === 'scene' ? 'shadow-xs' : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-500 hover:text-gray-300')}`}
                                    style={scratchpadMode === 'scene' ? { backgroundColor: appAccentColor, color: '#000000' } : undefined}
                                  >
                                    <StickyNote size={10} /> Scene
                                  </button>
                                </div>
                              </div>
                              <div className={`flex-1 p-4 overflow-y-auto custom-scrollbar ${isLight ? 'bg-slate-50' : 'bg-[#111]'}`}>
                                {scratchpadMode === 'scene' && activeBeat && (
                                  <div className={`mb-4 pb-3 border-b ${isLight ? 'border-slate-200' : 'border-[#222]'}`}>
                                    <span className={`text-[9px] uppercase tracking-wider font-bold ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Scene Notes Target</span>
                                    <h4 className={`text-xs font-black uppercase mt-0.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>{activeBeat.slug?.location || 'Untitled Scene'}</h4>
                                  </div>
                                )}
                                {scratchpadMode === 'global' && (
                                  <div className={`mb-4 pb-3 border-b flex items-center justify-between ${isLight ? 'border-slate-200' : 'border-[#222]'}`}>
                                    <div>
                                      <span className={`text-[9px] uppercase tracking-wider font-bold ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Global Note Target</span>
                                      <h4 className={`text-xs font-black uppercase mt-0.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>Entire Screenplay</h4>
                                    </div>
                                  </div>
                                )}
                                {(scratchpadMode === 'global' ? (Array.isArray(globalNotes) ? globalNotes : []) : (Array.isArray(activeBeat?.notes) ? activeBeat.notes : [])).map((note, index) => {
                                  if (!note) return null;
                                  const noteId = note.id || `note-${index}`;
                                  const isConfirming = confirmDeleteNoteId === noteId;
                                  const borderColor = note.color || appAccentColor;
                                  const subtleBorder = `${borderColor}40`;
                                  const subtleBg = isLight ? '#ffffff' : `${borderColor}05`;
                                  const noteContent = typeof note.content === 'string' ? note.content : '';
                                  const isAudio = noteContent.includes('<audio');
                                  const enableDragAnim = scratchpadConfig?.enableDragAnimations ?? true;
                                  const dragScale = scratchpadConfig?.dragScale ?? 1.02;
                                  const dragOpacity = scratchpadConfig?.dragOpacity ?? 0.8;
                                  const glass = scratchpadConfig?.glassEffect ?? false;
                                  const lineHeight = scratchpadConfig?.lineHeight ?? 1.6;

                                  return (
                                    <div 
                                      key={noteId} 
                                      draggable={false} 
                                      onDragOver={(e) => handleNoteDragOver(e, index)} 
                                      onDrop={(e) => handleNoteDrop(e, index)} 
                                      onDragLeave={handleNoteDragLeave} 
                                      className={`mb-4 rounded-md overflow-hidden transition-all shadow-xs group relative ${glass ? 'backdrop-blur-md' : ''}`} 
                                      style={{ 
                                        transition: 'transform 0.2s, opacity 0.2s', 
                                        transform: dragOverIndex === index && enableDragAnim ? `scale(${dragScale})` : 'scale(1)', 
                                        opacity: dragOverIndex === index && enableDragAnim ? dragOpacity : 1, 
                                        border: `1px solid ${isLight ? '#e2e8f0' : subtleBorder}`, 
                                        backgroundColor: subtleBg, 
                                        boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : `0 1px 3px rgba(0,0,0,0.3), 0 0 2px ${subtleBorder}` 
                                      }}
                                    >
                                      <div 
                                        draggable={true} 
                                        onDragStart={(e) => handleNoteDragStart(e, index)} 
                                        className={`flex justify-between items-center px-2 py-1 border-b cursor-grab active:cursor-grabbing transition-colors ${isLight ? 'border-slate-100 bg-slate-100/70 hover:bg-slate-200/60' : 'border-white/5 bg-black/20 hover:bg-white/5'}`}
                                      >
                                        <div className="flex gap-1 items-center">
                                          <GripHorizontal size={12} className={isLight ? "text-slate-400 mr-2" : "text-gray-600 mr-2"} />
                                          {DEFAULT_STORYLINE_COLORS.slice(0, 5).map(c => (
                                            <div 
                                              key={c} 
                                              className={`w-2 h-2 rounded-full cursor-pointer transition-transform hover:scale-125 ${note.color === c ? 'ring-1 ring-slate-400' : 'opacity-50 hover:opacity-100'}`} 
                                              style={{ backgroundColor: c }} 
                                              onMouseDown={(e) => { e.stopPropagation(); updateNote(noteId, { color: c }); }}
                                            />
                                          ))}
                                        </div>
                                        <button 
                                          onMouseDown={(e) => { 
                                            e.stopPropagation(); 
                                            if (isConfirming) deleteNote(noteId); 
                                            else { 
                                              setConfirmDeleteNoteId(noteId); 
                                              setTimeout(() => setConfirmDeleteNoteId(null), 3000); 
                                            } 
                                          }} 
                                          className={`transition-colors ${isConfirming ? 'text-red-500 animate-pulse bg-red-50 px-1 rounded' : (isLight ? 'text-slate-400 hover:text-slate-800' : 'text-white/30 hover:text-white')}`} 
                                          title={isConfirming ? "Click again to delete" : "Delete Note"}
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      </div>
                                      <div style={{ backgroundColor: 'transparent' }}>
                                        {isAudio ? (
                                          <div className="p-3 bg-black/10 dark:bg-white/[0.02] rounded-md m-2 border border-white/5">
                                            <div className="text-[9px] uppercase tracking-wider font-black mb-2 flex items-center gap-1.5" style={{ color: appAccentColor }}>
                                              <Volume2 size={10} /> Voice Idea Memo
                                            </div>
                                            <div dangerouslySetInnerHTML={{ __html: noteContent }} />
                                          </div>
                                        ) : (
                                          <BlockEditor 
                                            value={noteContent} 
                                            onChange={(val) => updateNote(noteId, { content: val })} 
                                            className="bg-transparent border-none rounded-none text-slate-800" 
                                            minHeight="80px" 
                                            placeholder="Note content..." 
                                            config={scratchpadConfig} 
                                            style={{ lineHeight }} 
                                          />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {(scratchpadMode === 'scene' && !activeBeat) ? (
                                  <div className={`flex flex-col items-center justify-center h-full gap-2 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                    <StickyNote size={32} opacity={0.3} />
                                    <span className="text-xs text-center px-4">Select a scene to add notes.</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-2 mt-2">
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={() => addNote()} 
                                        className={`flex-1 py-3 border border-dashed rounded-none text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${isLight ? 'border-slate-300 text-slate-600' : 'border-[#333] text-gray-500'}`}
                                        style={{ borderColor: `color-mix(in srgb, ${appAccentColor} 40%, transparent)` }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = appAccentColor; e.currentTarget.style.color = appAccentColor; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = `color-mix(in srgb, ${appAccentColor} 40%, transparent)`; e.currentTarget.style.color = ''; }}
                                      >
                                        <Plus size={14} /> Add Note
                                      </button>
                                      <button 
                                        onClick={toggleRecording} 
                                        className={`px-4 border border-dashed rounded-none text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${isRecording ? 'border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20' : (isLight ? 'border-slate-300 text-slate-600' : 'border-[#333] text-gray-500')}`} 
                                        style={!isRecording ? { borderColor: `color-mix(in srgb, ${appAccentColor} 40%, transparent)` } : undefined}
                                        onMouseEnter={(e) => { if (!isRecording) { e.currentTarget.style.borderColor = appAccentColor; e.currentTarget.style.color = appAccentColor; } }}
                                        onMouseLeave={(e) => { if (!isRecording) { e.currentTarget.style.borderColor = `color-mix(in srgb, ${appAccentColor} 40%, transparent)`; e.currentTarget.style.color = ''; } }}
                                        title={isRecording ? "Stop Recording" : "Record Voice Idea"}
                                      >
                                        {isRecording ? (
                                          <>
                                            <Square size={14} className="text-red-500 animate-pulse" />
                                            <span className="text-[10px] font-mono text-red-500">{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                                          </>
                                        ) : (
                                          <Mic2 size={14} />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </SidebarErrorBoundary>
                        )}
                        {activeSidebar === 'history' && (<div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4">{activeBeat ? (<div className="flex flex-col h-full"><div className={`mb-4 p-3 rounded border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111] border-[#333]'}`}><span className={`text-[9px] uppercase tracking-wider font-bold ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Version History Target</span><h4 className={`text-xs font-black uppercase mt-0.5 mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>{activeBeat.slug.location || 'Untitled'}</h4><div className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Current Version</div></div><button onClick={handleCreateSnapshot} className={`w-full py-2 mb-6 border text-xs font-bold uppercase rounded flex items-center justify-center gap-2 transition-all ${isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-[#222] hover:bg-[#333] border-[#333] text-gray-300'}`}><Save size={12} /> Create Snapshot</button><div className="space-y-2">{activeBeat.versions && activeBeat.versions.length > 0 ? ([...activeBeat.versions].reverse().map((v, i) => (<div key={v.id} className={`border rounded p-3 group transition-colors ${isLight ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-[#111] border-[#222] hover:border-[#444]'}`}><div className="flex items-center justify-between mb-2"><span className="text-[10px] font-bold uppercase" style={{ color: appAccentColor }}>v{activeBeat.versions!.length - i}</span><span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{new Date(v.timestamp).toLocaleString()}</span></div><div className={`text-[10px] mb-3 line-clamp-2 italic opacity-80 ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>{v.summary || "No summary provided."}</div><button onClick={() => handleRestoreClick(v)} className={`w-full py-1.5 border rounded text-[9px] font-bold uppercase flex items-center justify-center gap-2 transition-colors ${isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900' : 'bg-[#1a1a1a] hover:bg-[#252525] border-[#333] text-gray-400 hover:text-white'}`}><RotateCcw size={10} /> Restore</button></div>))) : (<div className={`text-center py-10 ${isLight ? 'text-slate-400' : 'text-gray-600'}`}><History size={32} className="mx-auto mb-2 opacity-20" /><span className="text-xs">No snapshots yet.</span></div>)}</div></div>) : (<div className={`flex flex-col items-center justify-center h-full gap-2 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}><History size={32} opacity={0.3} /><span className="text-xs text-center px-4">Select a scene to view version history.</span></div>)}</div>)}
                    </div>
                </div>
            )}
        </div>

        {/* --- DYNAMIC SCRIPT CONTEXT MENU (TIERED) --- */}
        {scriptContextMenu && (
          <div 
            className={`fixed rounded-lg shadow-2xl z-[9999] py-1 w-56 animate-in fade-in zoom-in duration-100 backdrop-blur-xl ${isLight ? 'bg-white/95 border border-slate-200 text-slate-800' : 'bg-[#1a1a1a] border border-[#333] text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)]'}`}
            style={{ left: scriptContextMenu.x, top: scriptContextMenu.y }}
            onClick={(e) => e.stopPropagation()} 
          >
            {/* Header: Scene Context */}
            <div className={`px-3 py-2 border-b mb-1 flex items-center justify-between ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#222] bg-black/20'}`}>
                <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Script Terminal</span>
                <span className="text-[9px] font-mono font-bold" style={{ color: appAccentColor }}>SCN: {scriptContextMenu.beatId}</span>
            </div>

            {/* SELECTION-SPECIFIC SECTION */}
            {scriptContextMenu.selectionText && (
                <>
                    <div className="px-3 py-1.5">
                        <span className={`text-[8px] font-black uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-[#555]'}`}>Selection: "{scriptContextMenu.selectionText.substring(0,15)}..."</span>
                    </div>

                    {/* 1. Styling Submenu */}
                    <ContextMenuItem 
                        icon={Highlighter} 
                        label="Format Selection" 
                        isLight={isLight}
                        submenu={
                            <>
                                <ContextMenuItem icon={Bold} label="Bold" onClick={() => applyInlineStyle('bold')} isLight={isLight} />
                                <ContextMenuItem icon={Italic} label="Italic" onClick={() => applyInlineStyle('italic')} isLight={isLight} />
                                <ContextMenuItem icon={Underline} label="Underline" onClick={() => applyInlineStyle('underline')} isLight={isLight} />
                                <ContextMenuItem icon={X} label="Clear Styling" onClick={() => applyInlineStyle('removeFormat')} isLight={isLight} />
                            </>
                        }
                    />

                    {/* 2. Color Submenu */}
                    <ContextMenuItem 
                        icon={Palette} 
                        label="Color Palette" 
                        isLight={isLight}
                        submenu={
                            <>
                                <div className={`px-3 py-1 text-[8px] font-bold uppercase ${isLight ? 'text-slate-400' : 'text-[#555]'}`}>Text Tone</div>
                                {TEXT_COLORS.map(c => (
                                    <ContextMenuItem key={c.value} label={c.name} onClick={() => applyInlineStyle('foreColor', c.value)} isLight={isLight} />
                                ))}
                                <div className={`h-px mx-2 my-1 ${isLight ? 'bg-slate-200' : 'bg-[#222]'}`}></div>
                                <div className={`px-3 py-1 text-[8px] font-bold uppercase ${isLight ? 'text-slate-400' : 'text-[#555]'}`}>Highlighter</div>
                                {HILITE_COLORS.map(c => (
                                    <ContextMenuItem key={c.value} label={c.name} onClick={() => applyInlineStyle('hiliteColor', c.value)} isLight={isLight} />
                                ))}
                            </>
                        }
                    />

                    <ContextMenuItem icon={StickyNote} label="Send to Note Block" onClick={handleSendSelectionToNote} isLight={isLight} />
                    <div className={`h-px mx-2 my-1 ${isLight ? 'bg-slate-200' : 'bg-[#222]'}`}></div>

                    {/* 3. Breakdown Submenu */}
                    <ContextMenuItem 
                        icon={Tag} 
                        label="Production Tags" 
                        isLight={isLight}
                        submenu={
                            <>
                                <ContextMenuItem icon={MapIcon} label="Location Scenario" onClick={() => applyTagging('location')} isLight={isLight} />
                                <ContextMenuItem icon={Wand2} label="Visual Effects" onClick={() => applyTagging('vfx')} isLight={isLight} />
                                <ContextMenuItem icon={Flame} label="Special Effects" onClick={() => applyTagging('practical')} isLight={isLight} />
                                <ContextMenuItem icon={Package} label="Prop" onClick={() => applyTagging('props')} isLight={isLight} />
                                <ContextMenuItem icon={Mic2} label="Audio / SFX" onClick={() => applyTagging('sound')} isLight={isLight} />
                                <ContextMenuItem icon={Shirt} label="Wardrobe" onClick={() => applyTagging('costume')} isLight={isLight} />
                                <ContextMenuItem icon={Users} label="Cast / Extras" onClick={() => applyTagging('cast')} isLight={isLight} />
                            </>
                        }
                    />
                </>
            )}

            {/* SCENE OPERATIONS SECTION */}
            <div className="px-3 py-1.5">
                <span className={`text-[8px] font-black uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-[#555]'}`}>Scene Control</span>
            </div>

            <ContextMenuItem 
                icon={beats.find(b => b.id === scriptContextMenu.beatId)?.status === 'ready' ? Unlock : Lock} 
                label={beats.find(b => b.id === scriptContextMenu.beatId)?.status === 'ready' ? 'Unlock Scene' : 'Lock Scene'} 
                isLight={isLight}
                onClick={() => { 
                    const b = beats.find(b => b.id === scriptContextMenu.beatId);
                    if (b) updateBeat(scriptContextMenu.beatId, { status: b.status === 'ready' ? 'not-ready' : 'ready' });
                    setScriptContextMenu(null);
                }} 
            />

            <ContextMenuItem 
                icon={PlusSquare} 
                label="Insert Content" 
                isLight={isLight}
                submenu={
                    <>
                        <ContextMenuItem icon={ArrowUp} label="Insert Above" onClick={() => handleInsertScene(scriptContextMenu.beatId, 'above')} isLight={isLight} />
                        <ContextMenuItem icon={ArrowDown} label="Insert Below" onClick={() => handleInsertScene(scriptContextMenu.beatId, 'below')} isLight={isLight} />
                        <ContextMenuItem icon={Copy} label="Duplicate Scene" onClick={() => handleDuplicateScene(scriptContextMenu.beatId)} isLight={isLight} />
                    </>
                }
            />

            <ContextMenuItem 
                icon={History} 
                label="Restore Snapshot" 
                isLight={isLight}
                submenu={
                    <>
                        <div className={`px-3 py-1 text-[8px] font-bold uppercase ${isLight ? 'text-slate-400' : 'text-[#555]'}`}>Historical Versions</div>
                        {beats.find(b => b.id === scriptContextMenu.beatId)?.versions?.length ? (
                            [...(beats.find(b => b.id === scriptContextMenu.beatId)?.versions || [])].reverse().slice(0, 10).map((v, i) => (
                                <ContextMenuItem 
                                    key={v.id} 
                                    icon={Clock}
                                    label={`v${(beats.find(b => b.id === scriptContextMenu.beatId)?.versions?.length || 0) - i} - ${new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`} 
                                    onClick={() => handleRestoreClick(v)} 
                                    isLight={isLight}
                                />
                            ))
                        ) : (
                            <div className={`px-3 py-2 text-[9px] italic ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>No snapshots saved</div>
                        )}
                        <div className={`h-px mx-2 my-1 ${isLight ? 'bg-slate-200' : 'bg-[#222]'}`}></div>
                        <ContextMenuItem icon={Save} label="Create Current Snapshot" onClick={() => { setActiveBeatId(scriptContextMenu.beatId); handleCreateSnapshot(); setScriptContextMenu(null); }} isLight={isLight} />
                    </>
                }
            />

            <ContextMenuItem 
                icon={Layers} 
                label="Project Navigation" 
                isLight={isLight}
                submenu={
                    <>
                        <ContextMenuItem icon={MousePointer2} label="Focus on Board" onClick={() => { 
                            const b = beats.find(b => b.id === scriptContextMenu.beatId);
                            if (b) setActiveBoardId(b.boardId || 0);
                            setScriptContextMenu(null);
                        }} isLight={isLight} />
                        <ContextMenuItem icon={StickyNote} label="Open Scene Notes" onClick={() => { setActiveBeatId(scriptContextMenu.beatId); setScratchpadMode('scene'); setActiveSidebar('scratchpad'); setScriptContextMenu(null); }} isLight={isLight} />
                        <ContextMenuItem icon={ListChecks} label="View Scene Breakdown" onClick={() => { setActiveBeatId(scriptContextMenu.beatId); setActiveSidebar('breakdown'); setScriptContextMenu(null); }} isLight={isLight} />
                    </>
                }
            />

            <div className={`h-px mx-2 my-1 ${isLight ? 'bg-slate-200' : 'bg-[#222]'}`}></div>
            
            <ContextMenuItem 
                danger 
                icon={Trash2} 
                label="Delete Scene" 
                isLight={isLight}
                onClick={() => handleDeleteScene(scriptContextMenu.beatId)} 
            />
          </div>
        )}
      </div>
      {/* Quick Action Toast */}
      {scriptToast && (
        <div 
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 text-xs font-mono font-bold tracking-wide uppercase shadow-2xl border flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-150"
          style={{
            backgroundColor: isLight ? '#0f172a' : '#000000',
            color: appAccentColor,
            borderColor: `color-mix(in srgb, ${appAccentColor} 40%, transparent)`
          }}
        >
            <Check size={14} className="text-emerald-400" />
            <span>{scriptToast}</span>
        </div>
      )}
      {diffVersion && activeBeat && (<DiffModal currentContent={activeBeat.content} snapshotContent={diffVersion.content} timestamp={diffVersion.timestamp} snapshotTitle={diffVersion.summary} onRestore={confirmRestoreVersion} onClose={() => setDiffVersion(null)} />)}
      <ScriptArchiveModal isOpen={showArchiveModal} onClose={() => setShowArchiveModal(false)} />
      <TamilTranscoderModal isOpen={showTranscoderModal} onClose={() => setShowTranscoderModal(false)} onInsertText={(text) => {
        if (activeBeatId) {
          const beat = beats.find(b => b.id === activeBeatId);
          if (beat) {
            updateBeat(activeBeatId, { text: (beat.text || '') + '\n' + text });
          }
        }
      }} />
    </div>
  );
};

export default ScriptView;
