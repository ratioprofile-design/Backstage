
import React, { useEffect, useRef, useState, useMemo, useLayoutEffect, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Search, Plus, Sun, Moon, Coffee, Eye, ZoomIn, ZoomOut, Lock, AlignLeft, User, MessageSquare, Parentheses, ArrowRightLeft, Camera, Music, Type, ListChecks, Sparkles, X, Package, Mic2, Shirt, Wand2, Users, Flame, Map as MapIcon, EyeOff, PanelLeft, History, StickyNote, RotateCcw, Save, Globe, Trash2, GripHorizontal, Bold, Italic, Heading, List, CheckSquare, Underline, Strikethrough, Quote, LayoutGrid, Palette, Check, Clock, MoreHorizontal, MousePointer2, Layers, Link2, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { ScriptEditor, ScriptEditorHandle } from '../ScriptEditor';
import { SlugInput } from '../SlugInput';
import { generateBreakdown } from '../../services/gemini';
import { BreakdownData, BreakdownItem, BeatVersion, Note, Beat, Group, Connection, BeatStatus } from '../../types';
import { BlockEditor } from '../BlockEditor';
import DiffModal from '../DiffModal';
import { STORYLINE_COLORS } from '../../constants';

// --- CONSTANTS ---
const A4_WIDTH = 794;  
const A4_HEIGHT = 1123;
const MARGIN_LEFT = 144;
const MARGIN_RIGHT = 96;
const MARGIN_TOP = 96;
const MARGIN_BOTTOM = 96;
const PAGE_GAP = 40; 
const BEAT_SPACING = 0; 
const CONTINUOUS_OVERSCROLL = 400; 
const SLUG_PREFIXES = ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.', 'I./E.', 'E./I.'];
const SLUG_TIMES = ['DAY', 'NIGHT', 'CONTINUOUS', 'MOMENTS LATER', 'MORNING', 'EVENING', 'LATER', 'SAME TIME', 'DAWN', 'DUSK'];

const NOTE_COLORS = [
    { bg: '#222', border: '#333' },
    { bg: '#3a2a1a', border: '#d97706' },
    { bg: '#1a2e1a', border: '#16a34a' },
    { bg: '#1a2a3a', border: '#2563eb' },
    { bg: '#3a1a1a', border: '#dc2626' },
];

// --- HELPERS ---
function useDebounce<T extends (...args: any[]) => void>(func: T, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }; }, []);
  return useCallback((...args: Parameters<T>) => { if (timeoutRef.current) clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(() => { func(...args); }, delay); }, [func, delay]);
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

const runPaginationPass = (container: HTMLElement, paperLayer: HTMLElement, contentLayer: HTMLElement, theme: any, viewMode: 'continuous' | 'page') => {
    if (!container || !paperLayer || !contentLayer) return;
    const beats = Array.from(contentLayer.querySelectorAll('.beat-block')) as HTMLElement[];
    const totalPageHeight = A4_HEIGHT + PAGE_GAP;
    if (viewMode === 'continuous') {
        let currentY = MARGIN_TOP;
        beats.forEach((beat, i) => { const spacing = i === 0 ? 0 : BEAT_SPACING; beat.style.marginTop = `${spacing}px`; currentY += spacing + beat.offsetHeight; });
        const requiredHeight = Math.max(A4_HEIGHT, currentY + MARGIN_BOTTOM + CONTINUOUS_OVERSCROLL);
        const existingPages = paperLayer.querySelectorAll('.bg-page');
        if (existingPages.length !== 1 || paperLayer.dataset.theme !== theme.bg || paperLayer.dataset.mode !== 'continuous') {
            paperLayer.innerHTML = ''; paperLayer.dataset.theme = theme.bg; paperLayer.dataset.mode = 'continuous';
            const page = document.createElement('div'); page.className = 'bg-page'; page.style.position = 'absolute'; page.style.left = '0'; page.style.top = '0'; page.style.width = `${A4_WIDTH}px`; page.style.minHeight = `${requiredHeight}px`; page.style.height = '100%'; page.style.backgroundColor = theme.bg; page.style.boxShadow = theme.shadow; page.style.transition = 'background-color 0.3s'; paperLayer.appendChild(page);
        } else { const page = existingPages[0] as HTMLElement; page.style.minHeight = `${requiredHeight}px`; }
        return;
    }
    let prevBottom = MARGIN_TOP;
    beats.forEach((beat, i) => {
        const height = beat.offsetHeight; let targetTop = prevBottom + (i === 0 ? 0 : BEAT_SPACING); let pageIndex = Math.floor(targetTop / totalPageHeight);
        const pageStart = pageIndex * totalPageHeight; const pageWritableStart = pageStart + MARGIN_TOP; const pageWritableEnd = pageStart + A4_HEIGHT - MARGIN_BOTTOM;
        if (targetTop < pageWritableStart) { targetTop = pageWritableStart; }
        if (targetTop + height > pageWritableEnd) { if (targetTop > pageWritableStart) { pageIndex++; const nextPageStart = pageIndex * totalPageHeight; targetTop = nextPageStart + MARGIN_TOP; } }
        const margin = Math.max(0, targetTop - prevBottom); beat.style.marginTop = `${margin}px`; prevBottom = targetTop + height;
    });
    const lastPageNeeded = Math.floor((prevBottom - 1) / totalPageHeight); const requiredPages = Math.max(1, lastPageNeeded + 1);
    const existingPages = paperLayer.querySelectorAll('.bg-page');
    if (existingPages.length !== requiredPages || paperLayer.dataset.theme !== theme.bg || paperLayer.dataset.mode !== 'page') {
        paperLayer.innerHTML = ''; paperLayer.dataset.theme = theme.bg; paperLayer.dataset.mode = 'page';
        for (let i = 0; i < requiredPages; i++) {
            const page = document.createElement('div'); page.className = 'bg-page'; page.style.position = 'absolute'; page.style.left = '0'; page.style.top = `${i * totalPageHeight}px`; page.style.width = `${A4_WIDTH}px`; page.style.height = `${A4_HEIGHT}px`; page.style.backgroundColor = theme.bg; page.style.boxShadow = theme.shadow; page.style.transition = 'background-color 0.3s';
            const num = document.createElement('div'); num.textContent = `${i + 1}.`; num.style.position = 'absolute'; num.style.top = '40px'; num.style.right = '40px'; num.style.fontFamily = 'Courier Prime, monospace'; num.style.fontSize = '12px'; num.style.fontWeight = 'bold'; num.style.color = theme.pageNum; num.style.opacity = '0.5';
            page.appendChild(num); paperLayer.appendChild(page);
        }
    }
};

const InteractiveBoardPanel = ({ 
    beats, connections, groups, activeBeatId, onBeatClick, updateBeat, setBeats, setConnections, captureSnapshot, reorderBeats
}: { 
    beats: Beat[], connections: Connection[], groups: Group[], activeBeatId: number | null, 
    onBeatClick: (id: number) => void, updateBeat: (id: number, data: Partial<Beat>) => void, 
    setBeats: (val: Beat[] | ((prev: Beat[]) => Beat[])) => void, 
    setConnections: (val: Connection[] | ((prev: Connection[]) => Connection[])) => void, 
    captureSnapshot: () => void,
    reorderBeats: (draggedId: number, targetId: number, side: 'top' | 'bottom') => void
}) => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const [dropSide, setDropSide] = useState<'top' | 'bottom'>('top');

    const safeBeats = Array.isArray(beats) ? beats : [];
    const safeConnections = Array.isArray(connections) ? connections : [];
    const safeGroups = Array.isArray(groups) ? groups : [];

    const { connectedSet, orders } = useMemo(() => calculateGraphOrder(safeBeats, safeConnections), [safeBeats, safeConnections]);

    const sortedBeats = useMemo(() => {
        const list = [...safeBeats];
        list.sort((a, b) => {
            if ((a.boardId || 0) !== (b.boardId || 0)) return (a.boardId || 0) - (b.boardId || 0);
            
            const isSeqA = connectedSet.has(a.id) || (a.sceneNumber && a.sceneNumber !== '');
            const isSeqB = connectedSet.has(b.id) || (b.sceneNumber && b.sceneNumber !== '');
            if (isSeqA !== isSeqB) return isSeqA ? -1 : 1;

            const orderA = orders[a.id] ?? (parseInt(a.sceneNumber || '999999'));
            const orderB = orders[b.id] ?? (parseInt(b.sceneNumber || '999999'));
            if (orderA !== orderB) orderA - orderB;
            
            if (Math.abs((a.x || 0) - (b.x || 0)) > 50) return (a.x || 0) - (b.x || 0); 
            return (a.y || 0) - (b.y || 0); 
        });
        return list;
    }, [safeBeats, connectedSet, orders]);

    const beatHierarchyMap = useMemo(() => {
        const map = new Map<number, Group[]>();
        safeBeats.forEach(beat => {
            const bx = (beat.x || 0) + 120; 
            const by = (beat.y || 0) + 70;
            const currentBoard = beat.boardId || 0;
            const parents = safeGroups.filter(g => 
                (g.boardId || 0) === currentBoard &&
                bx >= (g.x || 0) && bx <= (g.x || 0) + (g.width || 0) &&
                by >= (g.y || 0) && by <= (g.y || 0) + (g.height || 0)
            ).sort((a, b) => (a.width * a.height) - (b.width * b.height));
            map.set(beat.id, parents);
        });
        return map;
    }, [safeBeats, safeGroups]);

    const { chainColors, autoSceneNumbers, connectionStatus } = useMemo(() => {
        const adjUndir: Record<number, number[]> = {}; 
        safeBeats.forEach(b => { adjUndir[b.id] = []; });
        safeConnections.forEach(c => {
            if (adjUndir[c.from]) adjUndir[c.from].push(c.to);
            if (adjUndir[c.to]) adjUndir[c.to].push(c.from);
        });
        const chainMap: Record<number, string> = {};
        const visited = new Set<number>();
        let colorIdx = 0;
        const idSorted = [...safeBeats].sort((a,b) => a.id - b.id);
        idSorted.forEach(startNode => {
            if (!visited.has(startNode.id)) {
                const componentNodes: number[] = [];
                const queue = [startNode.id];
                visited.add(startNode.id);
                componentNodes.push(startNode.id);
                while(queue.length > 0) {
                    const u = queue.shift()!;
                    if(adjUndir[u]) {
                        adjUndir[u].forEach(v => {
                            if(!visited.has(v)) { visited.add(v); queue.push(v); componentNodes.push(v); }
                        });
                    }
                }
                let chosenColor = STORYLINE_COLORS[colorIdx % STORYLINE_COLORS.length];
                if (componentNodes.length === 1) chosenColor = '#444';
                else colorIdx++;
                componentNodes.forEach(id => { chainMap[id] = chosenColor; });
            }
        });
        const connStatus: Record<number, boolean> = {};
        safeBeats.forEach(b => { connStatus[b.id] = (adjUndir[b.id] && adjUndir[b.id].length > 0); });
        return { chainColors: chainMap, autoSceneNumbers: orders, connectionStatus: connStatus };
    }, [safeBeats, safeConnections, orders]);

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
                setConnections((prev: Connection[]) => prev.filter(c => c.from !== idToDelete && c.to !== idToDelete));
            }
        }, 50);
    };

    const moveToGroup = (beatId: number, groupId: number) => {
        const beat = safeBeats.find(b => b.id === beatId);
        const group = safeGroups.find(g => g.id === groupId);
        if (!beat || !group) return;
        const beatsInGroup = safeBeats.filter(b => 
            b.id !== beatId &&
            (b.x || 0) >= (group.x || 0) && (b.x || 0) <= (group.x || 0) + (group.width || 0) &&
            (b.y || 0) >= (group.y || 0) && (b.y || 0) <= (group.y || 0) + (group.height || 0)
        );
        let targetY = (group.y || 0) + 60; 
        if (beatsInGroup.length > 0) {
            const lowestBeat = beatsInGroup.reduce((prev, curr) => ((curr.y || 0) > (prev.y || 0) ? curr : prev));
            targetY = (lowestBeat.y || 0) + 160; 
        }
        updateBeat(beatId, { x: (group.x || 0) + 20, y: targetY });
        setContextMenu(null);
    };

    const setColor = (beatId: number, color: string) => { updateBeat(beatId, { color }); setContextMenu(null); };
    const setStatus = (beatId: number, status: BeatStatus) => { updateBeat(beatId, { status }); setContextMenu(null); };
    const handleBeatDoubleClicks = (id: number) => { setEditingId(id); };

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
            className="w-full h-full bg-[#0a0a0a] overflow-y-auto custom-scrollbar relative pb-10"
            onClick={() => { setContextMenu(null); setEditingId(null); }}
        >
            <div className="flex flex-col gap-3 pt-4 relative z-10 min-h-full px-4 pb-20">
                {/* Fixed vertical line that grows with content */}
                <div className="absolute left-[22px] top-4 bottom-0 w-[2px] bg-[#222] z-0"></div>

                {sortedBeats.map((beat) => {
                    const isActive = beat.id === activeBeatId;
                    const isReady = beat.status === 'ready';
                    const isEditing = editingId === beat.id;
                    const isDragOver = dragOverId === beat.id;
                    
                    const hierarchy = beatHierarchyMap.get(beat.id) || [];
                    const immediateParent = hierarchy[0];
                    const isConnected = connectionStatus[beat.id];

                    let displayColor = chainColors[beat.id] || '#444';
                    if (immediateParent && immediateParent.color) displayColor = immediateParent.color;
                    if (beat.color && beat.color !== '#444') displayColor = beat.color;

                    const isSandbox = !isConnected && (!beat.sceneNumber || beat.sceneNumber === '');
                    const sceneNum = isSandbox ? '•' : (beat.sceneNumber || autoSceneNumbers[beat.id] || '#');

                    return (
                        <div 
                            key={beat.id}
                            className={`flex gap-4 group/row transition-all duration-200 relative ${isDragOver && dropSide === 'top' ? 'pt-4' : ''} ${isDragOver && dropSide === 'bottom' ? 'pb-4' : ''}`}
                            draggable={!isEditing}
                            onDragStart={(e) => handleDragStart(e, beat.id)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, beat.id)}
                            onDrop={(e) => handleDrop(e, beat.id)}
                        >
                            <div className="flex flex-col items-center mt-[10px] relative">
                                {!isConnected && !isSandbox && (
                                    <div className="absolute -left-2 top-0.5 text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity" title="Orphaned Sequence Scene">
                                        <AlertCircle size={10} />
                                    </div>
                                )}
                                <div 
                                    className={`w-3 h-3 rounded-full border-2 transition-all z-10 ${isActive ? 'scale-125' : ''}`}
                                    style={{ 
                                        backgroundColor: isActive ? '#f5a623' : '#1a1a1a', 
                                        borderColor: isActive ? '#f5a623' : displayColor 
                                    }}
                                ></div>
                            </div>
                            
                            <div 
                                className={`flex-1 bg-[#2d2d2d] border rounded-md flex flex-col shadow-lg transition-all cursor-grab active:cursor-grabbing group relative 
                                    ${isActive ? 'border-[#f5a623] ring-1 ring-[#f5a623]/20' : 'border-[#3d3d3d] hover:border-[#666]'} 
                                    ${isEditing ? 'ring-1 ring-[#f5a623] border-[#f5a623] cursor-default' : ''}
                                    ${isDragOver ? 'ring-2 ring-[#f5a623] scale-[1.02]' : ''}
                                `}
                                onClick={(e) => { e.stopPropagation(); onBeatClick(beat.id); }}
                                onDoubleClick={(e) => { e.stopPropagation(); handleBeatDoubleClicks(beat.id); }}
                                onContextMenu={(e) => handleContextMenu(e, beat.id)}
                                style={{ backgroundColor: beat.tint || '#2d2d2d' }}
                            >
                                {isDragOver && (
                                    <div className={`absolute left-0 right-0 h-1 bg-[#f5a623] shadow-[0_0_10px_#f5a623] z-50 ${dropSide === 'top' ? '-top-[2px]' : '-bottom-[2px]'}`} />
                                )}

                                <div className="h-2 w-full flex items-center px-1 gap-1 rounded-t-md" style={{ backgroundColor: displayColor }}>
                                    {hierarchy.length > 0 && (
                                         <div className="flex items-center gap-1 overflow-hidden">
                                            {[...hierarchy].reverse().map((g, i) => (
                                                <React.Fragment key={g.id}>
                                                    {i > 0 && <span className="text-white/40 text-[5px]">/</span>}
                                                    <span className="text-[6px] font-black uppercase text-white truncate max-w-[80px]">
                                                        {g.title}
                                                    </span>
                                                </React.Fragment>
                                            ))}
                                         </div>
                                    )}
                                    <span className="ml-auto text-[7px] font-black uppercase text-white/50 bg-black/40 border border-white/10 px-1.5 py-0 rounded-full flex items-center gap-1 shadow-sm">
                                        P{(beat.boardId || 0) + 1}
                                    </span>
                                </div>

                                <div className="absolute -top-2 -left-2 flex gap-1 z-30">
                                     <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-sm border border-white/20 text-white bg-black/80 min-w-[20px] text-center`}>
                                        {sceneNum}
                                     </span>
                                </div>

                                <div className="p-2 flex-grow flex flex-col gap-1">
                                    <input 
                                        className={`font-bold text-xs bg-transparent border border-transparent rounded px-1 outline-none text-white placeholder-gray-500 transition-colors ${isEditing ? 'focus:border-[#f5a623] hover:border-[#444]' : 'pointer-events-none'}`}
                                        value={beat.title}
                                        onChange={(e) => updateBeat(beat.id, { title: e.target.value })}
                                        placeholder="Untitled Beat"
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={() => setEditingId(null)}
                                        onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                                    />
                                    <div className={`font-screenplay text-[9px] font-bold uppercase pb-0.5 border-b border-[#444] mb-0.5 ${(!beat.slug.prefix && !beat.slug.location) ? 'text-white/20' : 'text-[#ccc]'}`}>
                                        {(!beat.slug.prefix && !beat.slug.location && !beat.slug.time) ? 'INT. LOCATION - DAY' : `${beat.slug.prefix} ${beat.slug.location} - ${beat.slug.time}`}
                                    </div>
                                    <textarea 
                                        className={`font-sans text-[10px] text-[#ccc] bg-transparent border border-transparent rounded px-1 outline-none w-full resize-none leading-relaxed h-10 transition-colors custom-scrollbar placeholder-gray-600 ${isEditing ? 'focus:border-[#f5a623] hover:border-[#444]' : 'pointer-events-none'}`}
                                        value={beat.summary || ''}
                                        onChange={(e) => updateBeat(beat.id, { summary: e.target.value })}
                                        placeholder="Write a short summary..."
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={() => setEditingId(null)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && setEditingId(null)}
                                    />
                                </div>

                                <div className="mt-auto border-t border-[#3d3d3d] bg-[#222] p-1 flex justify-between items-center rounded-b-md">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); updateBeat(beat.id, { status: isReady ? 'not-ready' : 'ready' }); }}
                                        className={`flex items-center gap-1.5 text-[8px] font-bold uppercase px-2 py-1 rounded transition-colors ${isReady ? 'text-green-400 bg-green-900/20 hover:bg-green-900/30' : 'text-orange-400 bg-orange-900/20 hover:bg-orange-900/30'}`}
                                    >
                                        {isReady ? <Check size={8} /> : <Clock size={8} />}
                                        {isReady ? 'Ready' : 'WIP'}
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 text-[8px] font-bold text-gray-500 px-1">
                                            <History size={8} />
                                            <span>v{beat.versions?.length || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {contextMenu && (
                <div 
                    className="fixed bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl z-[9999] py-1 w-48 animate-in fade-in zoom-in duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()} 
                >
                    <div className="px-3 py-1.5 border-b border-[#333] mb-1">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Beat Options</span>
                    </div>
                    <div className="px-1 mb-1">
                        <button onClick={() => setStatus(contextMenu.beatId, 'ready')} className="w-full text-left px-2 py-1.5 text-[10px] font-bold text-green-400 hover:bg-[#333] rounded flex items-center gap-2"><Check size={10} /> Mark Ready</button>
                        <button onClick={() => setStatus(contextMenu.beatId, 'not-ready')} className="w-full text-left px-2 py-1.5 text-[10px] font-bold text-orange-400 hover:bg-[#333] rounded flex items-center gap-2"><Clock size={10} /> Mark W.I.P</button>
                    </div>
                    <div className="h-px bg-[#333] my-1"></div>
                    <div className="px-3 py-2">
                        <div className="text-[9px] text-[#666] uppercase mb-1.5 font-bold">Tag Color</div>
                        <div className="flex gap-1.5 flex-wrap">
                            {STORYLINE_COLORS.slice(0, 5).map(c => (
                                <button key={c} onClick={() => setColor(contextMenu.beatId, c)} className="w-4 h-4 rounded-full border border-white/10 hover:scale-125 transition-transform" style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                    <div className="h-px bg-[#333] my-1"></div>
                    <div className="px-1">
                        <div className="text-[9px] px-2 py-1 text-[#666] uppercase font-bold">Move to Sequence</div>
                        {safeGroups.length > 0 ? (
                            <div className="max-h-32 overflow-y-auto custom-scrollbar">
                                {safeGroups.map(g => (
                                    <button key={g.id} onClick={() => moveToGroup(contextMenu.beatId, g.id)} className="w-full text-left px-2 py-1.5 text-[10px] font-bold text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2 truncate"><Layers size={10} className="shrink-0" /> {g.title}</button>
                                ))}
                            </div>
                        ) : (
                            <div className="px-2 py-1 text-[9px] text-gray-600 italic">No sequences created</div>
                        )}
                    </div>
                    <div className="h-px bg-[#333] my-1"></div>
                    <button onClick={(e) => executeDelete(e, contextMenu.beatId)} className="w-full text-left px-3 py-2 text-[10px] font-bold text-red-500 hover:bg-red-900/20 flex items-center gap-2"><Trash2 size={12} /> Delete Scene</button>
                </div>
            )}
        </div>
    );
};

const ScriptView: React.FC = () => {
  const { beats, groups, connections, updateBeat, addBeat, setBeats, setConnections, scriptViewMode, scriptConfig, setScriptConfig, scratchpadConfig, characterData, geminiApiKey, breakdownLanguage, setBreakdownLanguage, scratchpad, setScratchpad, globalNotes, setGlobalNotes, captureSnapshot, reorderBeats } = useProject();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [activeBeatId, setActiveBeatId] = useState<number | null>(null);
  const [activeFormat, setActiveFormat] = useState('action');
  const [showNav, setShowNav] = useState(true);
  const [navMode, setNavMode] = useState<'list' | 'board'>('board');
  const [sidebarWidth, setSidebarWidth] = useState(300); 
  const [activeSidebar, setActiveSidebar] = useState<'none' | 'breakdown' | 'scratchpad' | 'history'>('none');
  const [scratchpadMode, setScratchpadMode] = useState<'global' | 'scene'>('global');
  const [draggedNoteIndex, setDraggedNoteIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null); 
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [showSourceHighlights, setShowSourceHighlights] = useState(false);
  const [diffVersion, setDiffVersion] = useState<BeatVersion | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const paperLayerRef = useRef<HTMLDivElement>(null);
  const editorRefs = useRef<Record<number, ScriptEditorHandle | null>>({});
  const isResizingRef = useRef(false);
  
  const getThemeStyles = () => {
      switch(scriptConfig.paperTheme) {
          case 'dark': return { bg: '#1a1a1a', text: '#e5e5e5', slug: '#bbbbbb', accent: '#333333', pageNum: '#555', shadow: '0 0 0 1px #333', slugBg: '#2a2a2a' };
          case 'sepia': return { bg: '#fdf6e3', text: '#586e75', slug: '#b58900', accent: '#eee8d5', pageNum: '#93a1a1', shadow: '0 2px 10px rgba(0,0,0,0.1)', slugBg: '#eee8d5' };
          case 'red': return { bg: '#000000', text: '#ff5555', slug: '#ff0000', accent: '#1a0000', pageNum: '#330000', shadow: '0 0 0 1px #330000', slugBg: '#111111' };
          default: return { bg: 'white', text: 'black', slug: '#555555', accent: '#f5f5f5', pageNum: '#ccc', shadow: '0 4px 12px rgba(0,0,0,0.15)', slugBg: '#e5e7eb' }; 
      }
  };
  const theme = getThemeStyles();
  const setPaperTheme = (theme: 'white' | 'dark' | 'sepia' | 'red') => { setScriptConfig({ ...scriptConfig, paperTheme: theme }); };

  const isSequenceBeat = (beat: Beat, connectedIds: Set<number>, orders: Record<number, number>) => {
      return connectedIds.has(beat.id) || (beat.sceneNumber !== undefined && beat.sceneNumber.trim() !== '') || orders[beat.id] !== undefined;
  };

  const { connectedSet, beatOrder } = useMemo(() => {
      const safeBeats = beats || [];
      const safeConnections = connections || [];
      const res = calculateGraphOrder(safeBeats, safeConnections);
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
  const uniqueLocations = useMemo(() => { const locs = new Set<string>(); ['HOUSE', 'KITCHEN', 'BEDROOM', 'OFFICE', 'PARK', 'STREET', 'CAR', 'APARTMENT', 'SCHOOL', 'HOSPITAL'].forEach(l => locs.add(l)); beats.forEach(b => { if (b.slug.location && b.slug.location.trim()) { locs.add(b.slug.location.trim()); } }); return Array.from(locs).sort(); }, [beats]);
  const uniqueCharacters = useMemo(() => { const chars = new Set<string>(); Object.values(characterData).forEach((c: any) => { if (c.name) chars.add(c.name.toUpperCase()); }); beats.forEach(b => { const div = document.createElement('div'); div.innerHTML = b.content; div.querySelectorAll('.sc-character').forEach(el => { const name = el.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase(); if (name && name.length > 1) chars.add(name); }); }); return Array.from(chars).sort(); }, [beats, characterData]);

  useLayoutEffect(() => { const container = scrollerRef.current; const paper = paperLayerRef.current; const content = contentRef.current; if (!container || !paper || !content) return; const run = () => runPaginationPass(container, paper, content, theme, scriptViewMode); run(); const observer = new ResizeObserver(() => window.requestAnimationFrame(run)); const beatEls = content.querySelectorAll('.beat-block'); beatEls.forEach(el => observer.observe(el)); observer.observe(content); return () => observer.disconnect(); }, [sortedBeats, theme, zoom, scriptViewMode]); 
  
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isResizingRef.current) {
              const newWidth = Math.max(200, Math.min(800, e.clientX));
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
  const handleAddScene = () => { let maxX = -Infinity; let maxY = 0; beats.forEach(b => { if (b.x > maxX) { maxX = b.x; maxY = b.y; } }); if (maxX === -Infinity) { maxX = 25000; maxY = 25000; } const newId = addBeat(maxX + 300, maxY); setTimeout(() => { const prefixInput = document.getElementById(`beat-prefix-${newId}`); if (prefixInput) prefixInput.focus(); const card = document.getElementById(`beat-${newId}`); card?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); };
  const handleSlugChange = (id: number, field: string, val: string) => { const beat = beats.find(b => b.id === id); if (beat) updateBeat(id, { slug: { ...beat.slug, [field]: val } }); };
  const handleContentUpdate = useCallback((id: number, content: string) => { updateBeat(id, { content }); }, [updateBeat]);
  const handleFormat = (type: string) => { setActiveFormat(type); if (activeBeatId !== null && editorRefs.current[activeBeatId]) { editorRefs.current[activeBeatId]?.executeFormat(type); } };

  const scrollToBeat = (id: number) => {
      const el = document.getElementById(`beat-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveBeatId(id);
  };

  const handleAnalyzeBreakdown = async () => { if (!activeBeat || !geminiApiKey) return; setIsAnalyzing(true); const div = document.createElement('div'); div.innerHTML = activeBeat.content; const text = div.innerText; const result = await generateBreakdown(text, 'gemini-3-flash-preview', geminiApiKey, breakdownLanguage); if (result) { updateBeat(activeBeat.id, { breakdown: result }); } else { alert("Failed to analyze breakdown. Check API key."); } setIsAnalyzing(false); };
  const addTag = (category: keyof BreakdownData, tag: string) => { if (!activeBeat) return; const current = activeBeat.breakdown || { props: [], sound: [], costume: [], vfx: [], practical: [], cast: [], location: [] }; const list = current[category] || []; const newItem: BreakdownItem = { name: tag, source: '' }; const exists = list.some(i => (typeof i === 'string' ? i : i.name) === tag); if (!exists) { updateBeat(activeBeat.id, { breakdown: { ...current, [category]: [...list, newItem] } }); } };
  const removeTag = (category: keyof BreakdownData, tag: string) => { if (!activeBeat) return; const current = activeBeat.breakdown || { props: [], sound: [], costume: [], vfx: [], practical: [], cast: [], location: [] }; const list = current[category] || []; const newList = list.filter(i => (typeof i === 'string' ? i : i.name) !== tag); updateBeat(activeBeat.id, { breakdown: { ...current, [category]: newList } }); };
  const handleCreateSnapshot = () => { if (!activeBeat) return; const newVersion: BeatVersion = { id: `v-${Date.now()}`, timestamp: Date.now(), title: activeBeat.title || 'Untitled', content: activeBeat.content, summary: activeBeat.summary }; const currentVersions = activeBeat.versions || []; updateBeat(activeBeat.id, { versions: [...currentVersions, newVersion] }); };
  const handleRestoreClick = (v: BeatVersion) => { if (!activeBeat) return; setDiffVersion(v); };
  const confirmRestoreVersion = () => { if (!activeBeat || !diffVersion) return; const backupVersion: BeatVersion = { id: `backup-${Date.now()}`, timestamp: Date.now(), title: activeBeat.title, content: activeBeat.content, summary: activeBeat.summary }; updateBeat(activeBeat.id, { title: diffVersion.title, content: diffVersion.content, summary: diffVersion.summary, versions: [...(activeBeat.versions || []), backupVersion] }); setDiffVersion(null); };
  const addNote = () => { const newNote: Note = { id: `note-${Date.now()}`, content: '<div class="nl-block"><br></div>', color: '#d97706', timestamp: Date.now() }; if (scratchpadMode === 'global') { setGlobalNotes([...globalNotes, newNote]); } else if (activeBeat) { const currentNotes = activeBeat.notes || []; updateBeat(activeBeat.id, { notes: [...currentNotes, newNote] }); } };
  const updateNote = (id: string, updates: Partial<Note>) => { if (scratchpadMode === 'global') { setGlobalNotes(globalNotes.map(n => n.id === id ? { ...n, ...updates } : n)); } else if (activeBeat) { const currentNotes = activeBeat.notes || []; updateBeat(activeBeat.id, { notes: currentNotes.map(n => n.id === id ? { ...n, ...updates } : n) }); } };
  const deleteNote = (id: string) => { if (scratchpadMode === 'global') { setGlobalNotes(globalNotes.filter(n => n.id !== id)); } else if (activeBeat) { const currentNotes = activeBeat.notes || []; updateBeat(activeBeat.id, { notes: currentNotes.filter(n => n.id !== id) }); } setConfirmDeleteNoteId(null); };
  const handleNoteDragStart = (e: React.DragEvent, index: number) => { setDraggedNoteIndex(index); e.dataTransfer.effectAllowed = 'move'; };
  const handleNoteDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index); };
  const handleNoteDragLeave = () => { setDragOverIndex(null); };
  const handleNoteDrop = (e: React.DragEvent, dropIndex: number) => { e.preventDefault(); setDragOverIndex(null); if (draggedNoteIndex === null || draggedNoteIndex === dropIndex) return; const currentNotes = scratchpadMode === 'global' ? [...globalNotes] : [...(activeBeat?.notes || [])]; const draggedNote = currentNotes[draggedNoteIndex]; currentNotes.splice(draggedNoteIndex, 1); currentNotes.splice(dropIndex, 0, draggedNote); if (scratchpadMode === 'global') { setGlobalNotes(currentNotes); } else if (activeBeat) { updateBeat(activeBeat.id, { notes: currentNotes }); } setDraggedNoteIndex(null); };
  const editorStyle = { '--color-action': theme.text, '--color-character': theme.text, '--color-dialogue': theme.text, '--color-parenthetical': theme.text, '--color-transition': theme.text, } as React.CSSProperties;
  
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
  const TagInput = ({ category }: { category: keyof BreakdownData }) => { const [val, setVal] = useState(''); return ( <div className="flex gap-1 mt-2"> <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { addTag(category, val.trim()); setVal(''); } }} className="flex-1 bg-[#111] border border-[#333] rounded px-2 py-1 text-[10px] text-white focus:border-[#f5a623] outline-none" placeholder="Add..." /> <button onClick={() => { if(val.trim()) { addTag(category, val.trim()); setVal(''); } }} className="px-2 bg-[#222] hover:bg-[#333] text-gray-400 rounded"><Plus size={10}/></button> </div> ); };
  const BreakdownSection = ({ title, category, icon: Icon, color }: any) => { const items = activeBeat?.breakdown?.[category as keyof BreakdownData] || []; const isDragOver = dragOverCategory === category; return ( <div className={`mb-4 rounded-md transition-all ${isDragOver ? 'ring-2 ring-dashed ring-[#f5a623] bg-[#222]' : ''}`} onDragOver={(e) => handleTagDragOver(e, category)} onDragLeave={handleTagDragLeave} onDrop={(e) => handleTagDrop(e, category)}> <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${color}`}><Icon size={12} /> {title}</div> <div className="flex flex-wrap gap-1.5 min-h-[30px]"> {items.length === 0 && <span className="text-[10px] text-gray-700 italic select-none">None</span>} {items.map((item, i) => { const name = typeof item === 'string' ? item : item.name; const source = typeof item === 'string' ? undefined : item.source; return ( <div key={i} draggable onDragStart={(e) => handleTagDragStart(e, category, name)} onMouseEnter={() => source && highlightSourceText(source, category)} onMouseLeave={clearHighlight} className={`flex items-center gap-1 bg-[#222] px-2 py-1 rounded text-[10px] text-gray-300 border border-[#333] group cursor-move hover:border-[#f5a623] transition-colors ${showSourceHighlights && source ? 'hover:bg-[#f5a623] hover:text-black' : ''}`} title={source ? `Source: "${source}"` : "No source info"} > {name} <button onClick={() => removeTag(category as keyof BreakdownData, name)} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={10}/></button> </div> ); })} </div> <TagInput category={category as keyof BreakdownData} /> </div> ); };

  return (
    <div className="flex w-full h-full bg-[#0c0c0c] overflow-hidden font-sans">
      
      {showNav && (
        <div 
            className="flex flex-col shrink-0 z-20 shadow-2xl transition-all relative border-r border-[#222]"
            style={{ width: sidebarWidth }}
        >
            <div className="bg-[#0a0a0a] flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[#222]">
                    <div className="flex bg-[#111] p-1 rounded-md border border-[#222] mb-3">
                        <button onClick={() => setNavMode('list')} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded transition-colors flex items-center justify-center gap-2 ${navMode === 'list' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><List size={12} /> List</button>
                        <button onClick={() => setNavMode('board')} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded transition-colors flex items-center justify-center gap-2 ${navMode === 'board' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><LayoutGrid size={12} /> Board</button>
                    </div>
                    {navMode === 'list' && (
                        <div className="relative animate-in fade-in">
                            <Search className="absolute left-2.5 top-2 text-[#555]" size={14} />
                            <input type="text" placeholder="Find Scene..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#333] rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-[#f5a623] transition-colors" />
                        </div>
                    )}
                </div>
                
                <div className="flex-1 overflow-hidden relative">
                    {navMode === 'list' ? (
                        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-2 space-y-0.5 animate-in slide-in-from-left-2 duration-200">
                            {filteredBeats.map((beat, i) => {
                                const isSandbox = !isSequenceBeat(beat, connectedSet, beatOrder);
                                const sceneNum = isSandbox ? '•' : (beat.sceneNumber || beatOrder[beat.id] || (i + 1).toString());
                                const prevBeat = i > 0 ? filteredBeats[i - 1] : null;
                                const showBoardHeader = !prevBeat || prevBeat.boardId !== beat.boardId;

                                return (
                                    <React.Fragment key={beat.id}>
                                        {showBoardHeader && (
                                            <div className="flex items-center gap-2 px-3 py-4 first:pt-2">
                                                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">Page { (beat.boardId || 0) + 1 }</span>
                                                <div className="h-px w-full bg-[#222]"></div>
                                            </div>
                                        )}
                                        <button onClick={() => scrollToBeat(beat.id)} className={`w-full text-left p-2.5 rounded group transition-all flex items-center gap-3 border-l-2 ${activeBeatId === beat.id ? 'bg-[#1a1a1a] border-[#f5a623]' : 'border-transparent hover:bg-[#151515] hover:border-[#333]'}`}>
                                            <span className={`text-[10px] font-bold font-mono w-5 shrink-0 text-right ${isSandbox ? 'text-gray-600' : 'text-[#444] group-hover:text-[#f5a623]'}`}>{sceneNum}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className={`text-xs font-bold truncate uppercase flex-1 ${isSandbox ? 'text-gray-500 italic' : 'text-gray-400 group-hover:text-white'}`}>{beat.slug.location || 'UNTITLED SCENE'}</div>
                                                    {beat.status === 'ready' && <Lock size={10} className="text-green-500" />}
                                                </div>
                                            </div>
                                        </button>
                                    </React.Fragment>
                                )
                            })}
                        </div>
                    ) : (
                        <InteractiveBoardPanel 
                            beats={beats} 
                            groups={groups}
                            connections={connections}
                            activeBeatId={activeBeatId}
                            onBeatClick={scrollToBeat}
                            updateBeat={updateBeat}
                            setBeats={setBeats}
                            setConnections={setConnections}
                            captureSnapshot={captureSnapshot}
                            reorderBeats={reorderBeats}
                        />
                    )}
                </div>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#f5a623] transition-colors z-50 group" onMouseDown={() => { isResizingRef.current = true; document.body.style.cursor = 'col-resize'; }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-12 flex flex-col gap-1 items-center justify-center pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity">
                    <div className="w-0.5 h-full bg-[#f5a623]"></div>
                </div>
            </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="w-full bg-[#111] border-b border-[#222] flex flex-col shrink-0 z-20 shadow-sm select-none">
            <div className="flex items-center justify-between px-4 py-2 h-12 border-b border-[#222]">
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowNav(!showNav)} className={`w-8 h-8 flex items-center justify-center rounded border transition-all ${showNav ? 'bg-[#222] border-[#333] text-[#f5a623]' : 'bg-[#1a1a1a] border-[#333] text-gray-400 hover:text-white'}`} title="Toggle Navigation"><PanelLeft size={14} /></button>
                    <div className="flex items-center bg-[#1a1a1a] rounded border border-[#333] p-0.5 gap-0.5">
                        {FORMAT_BUTTONS.map((btn) => (
                            <button 
                                key={btn.id} 
                                onMouseDown={(e) => { e.preventDefault(); handleFormat(btn.id); }} 
                                className={`px-2 py-1.5 text-[10px] font-bold uppercase rounded-sm transition-all duration-200 flex items-center gap-2 min-w-[32px] justify-center ${activeFormat === btn.id ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-400 hover:text-white hover:bg-[#222]'}`} 
                                title={`${btn.id.charAt(0).toUpperCase() + btn.id.slice(1)} (${btn.short})`}
                            >
                                <btn.icon size={12} strokeWidth={2.5} />
                                <span className="font-black opacity-80">{btn.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-[#1a1a1a] rounded border border-[#333] p-0.5">
                        <button onClick={() => setActiveSidebar(activeSidebar === 'scratchpad' ? 'none' : 'scratchpad')} className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${activeSidebar === 'scratchpad' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-500 hover:text-white'}`} title="Scratchpad"><StickyNote size={14} /></button>
                        <button onClick={() => setActiveSidebar(activeSidebar === 'breakdown' ? 'none' : 'breakdown')} className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${activeSidebar === 'breakdown' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-400 hover:text-white'}`} title="Scene Breakdown"><ListChecks size={14} /></button>
                        <button onClick={() => setActiveSidebar(activeSidebar === 'history' ? 'none' : 'history')} className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${activeSidebar === 'history' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-400 hover:text-white'}`} title="Version History"><History size={14} /></button>
                    </div>
                    <div className="w-[1px] h-4 bg-[#333]"></div>
                    <div className="flex bg-[#1a1a1a] rounded border border-[#333] p-0.5">
                        <button onClick={() => setPaperTheme('white')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'white' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}><Sun size={12}/></button>
                        <button onClick={() => setPaperTheme('sepia')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'sepia' ? 'bg-[#fdf6e3] text-[#586e75]' : 'text-gray-500 hover:text-white'}`}><Coffee size={12}/></button>
                        <button onClick={() => setPaperTheme('dark')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'dark' ? 'bg-[#1a1a1a] text-white' : 'text-gray-500 hover:text-white'}`}><Moon size={12}/></button>
                        <button onClick={() => setPaperTheme('red')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'red' ? 'bg-[#000] text-red-500' : 'text-gray-500 hover:text-white'}`}><Eye size={12}/></button>
                    </div>
                    <div className="w-[1px] h-4 bg-[#333]"></div>
                    <div className="flex items-center bg-[#1a1a1a] rounded border border-[#333]">
                        <button onClick={() => setZoom(Math.max(0.2, zoom - 0.1))} className="p-1.5 hover:bg-[#333] text-gray-400 hover:text-white border-r border-[#333]"><ZoomOut size={12} /></button>
                        <button onClick={toggleFitZoom} className="px-3 py-1 text-[10px] font-bold text-gray-300 hover:text-white hover:bg-[#333] border-r border-[#333] transition-colors w-16 text-center">{Math.round(zoom * 100)}%</button>
                        <button onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} className="p-1.5 hover:bg-[#333] text-gray-400 hover:text-white border-l border-[#333]"><ZoomIn size={12} /></button>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            <div ref={scrollerRef} className="flex-1 overflow-y-auto bg-[#121212] relative flex flex-col items-center pb-96 custom-scrollbar">
                <div className="transition-transform duration-200 origin-top py-10" style={{ transform: `scale(${zoom})` }}>
                    <div style={{ position: 'relative', width: `${A4_WIDTH}px`, minHeight: `${A4_HEIGHT}px` }}>
                        <div ref={paperLayerRef} className="absolute top-0 left-0 w-full flex flex-col pointer-events-none z-0"></div>
                        <div ref={contentRef} className="relative z-10 w-full h-full" style={{ ...editorStyle, paddingTop: `${MARGIN_TOP}px`, paddingBottom: `${MARGIN_BOTTOM}px`, paddingLeft: `${MARGIN_LEFT}px`, paddingRight: `${MARGIN_RIGHT}px`, }}>
                            <style>{`.sc-line { color: ${theme.text}; } .sc-slug { color: ${theme.slug}; }`}</style>
                            {sortedBeats.map((beat, i) => {
                                const isReady = beat.status === 'ready';
                                const isSandbox = !isSequenceBeat(beat, connectedSet, beatOrder);
                                const isFirstSandbox = i === sequenceCount;
                                const displayNumber = isSandbox ? '•' : (beat.sceneNumber || beatOrder[beat.id] || (i + 1).toString());

                                return (
                                    <React.Fragment key={beat.id}>
                                        {isFirstSandbox && (
                                            <div className="w-full py-12 flex items-center justify-center opacity-40 select-none pointer-events-none page-break-avoid">
                                                <div className="h-px bg-dashed bg-gray-500 w-32 mr-4 border-b border-dashed border-gray-500"></div>
                                                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 font-bold">Unsequenced Fragments</span>
                                                <div className="h-px bg-dashed bg-gray-500 w-32 ml-4 border-b border-dashed border-gray-500"></div>
                                            </div>
                                        )}
                                        <div id={`beat-${beat.id}`} className={`beat-block group relative ${activeBeatId === beat.id ? 'z-20' : 'z-10'}`} onFocusCapture={() => setActiveBeatId(beat.id)} onClick={() => setActiveBeatId(beat.id)}>
                                            <div className={`absolute -left-16 top-0.5 w-12 text-right font-mono text-xs font-bold select-none opacity-50 group-hover:opacity-100 transition-opacity ${isSandbox ? 'text-gray-600' : ''}`} style={{ color: isSandbox ? undefined : theme.pageNum }}>{displayNumber}</div>
                                            <div className="flex items-center gap-2 mb-2 px-2 py-0.5 transition-colors -ml-2 -mr-2" style={{ backgroundColor: activeBeatId === beat.id ? '#f5a623' : theme.slugBg }}>
                                                <div className="flex-1 flex items-center gap-2 font-bold uppercase font-screenplay text-sm">
                                                    <SlugInput id={`beat-prefix-${beat.id}`} value={beat.slug.prefix} onChange={v => handleSlugChange(beat.id, 'prefix', v)} onNext={() => document.getElementById(`beat-location-${beat.id}`)?.focus()} suggestions={SLUG_PREFIXES} className="w-20 shrink-0" style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }} placeholder="INT." />
                                                    <SlugInput id={`beat-location-${beat.id}`} value={beat.slug.location} onChange={v => handleSlugChange(beat.id, 'location', v)} onNext={() => document.getElementById(`beat-time-${beat.id}`)?.focus()} suggestions={uniqueLocations} className="flex-1" style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }} placeholder="LOCATION" />
                                                    <span style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }}>-</span>
                                                    <SlugInput id={`beat-time-${beat.id}`} value={beat.slug.time} onChange={v => handleSlugChange(beat.id, 'time', v)} onNext={() => editorRefs.current[beat.id]?.focus()} suggestions={SLUG_TIMES} className="w-32 shrink-0" style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }} placeholder="TIME" />
                                                </div>
                                                {isReady && <Lock size={12} className={activeBeatId === beat.id ? "text-black" : "text-green-500 ml-2"} />}
                                            </div>
                                            <div>
                                                <BeatEditorBlock beat={beat} isActive={activeBeatId === beat.id} isReady={isReady} uniqueCharacters={uniqueCharacters} setActiveFormat={setActiveFormat} onUpdateContent={handleContentUpdate} onFocus={() => setActiveBeatId(beat.id)} editorRefCallback={(el) => { editorRefs.current[beat.id] = el; }} />
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                            <div onClick={handleAddScene} className="mt-8 mx-auto w-full max-w-xl h-6 border-b border-transparent hover:border-[#f5a623]/30 flex items-center justify-center cursor-pointer transition-all duration-300 group opacity-20 hover:opacity-100"><span className="text-[9px] font-bold text-[#666] group-hover:text-[#f5a623] uppercase tracking-[0.2em] flex items-center gap-2 transition-colors"><Plus size={8} /> Add Scene</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {activeSidebar !== 'none' && (
                <div className="w-[400px] bg-[#161616] border-l border-[#333] flex flex-col animate-in slide-in-from-right-10 duration-200 z-30 shadow-2xl relative overflow-hidden">
                    <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#1a1a1a] shrink-0">
                        <div className="flex items-center gap-2"><h3 className="text-xs font-black text-[#f5a623] uppercase tracking-widest flex items-center gap-2">{activeSidebar === 'breakdown' && <><ListChecks size={14} /> Scene Breakdown</>}{activeSidebar === 'scratchpad' && <><StickyNote size={14} /> Note Blocks</>}{activeSidebar === 'history' && <><History size={14} /> Version History</>}</h3></div>
                        <div className="flex gap-2 ml-4">{activeSidebar === 'breakdown' && (<button onClick={() => { setShowSourceHighlights(!showSourceHighlights); clearHighlight(); }} className={`p-1.5 rounded transition-colors ${showSourceHighlights ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`} title="Highlight source text in script on hover"><Eye size={14}/></button>)}<button onClick={() => { setActiveSidebar('none'); clearHighlight(); }} className="text-gray-500 hover:text-white"><X size={14}/></button></div>
                    </div>
                    <div className="flex-1 relative overflow-hidden">
                        {activeSidebar === 'breakdown' && (<div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4">{activeBeat ? (<><div className="mb-6 pb-4 border-b border-[#333]"><h4 className="text-sm font-bold text-white uppercase mb-4">{activeBeat.slug.location || 'Untitled Scene'}</h4><div className="flex items-center justify-between mb-2"><span className="text-[10px] font-bold text-gray-500 uppercase">Output Language</span><div className="flex bg-[#111] rounded border border-[#333] p-0.5"><button onClick={() => setBreakdownLanguage('english')} className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${breakdownLanguage === 'english' ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`}>ENG</button><button onClick={() => setBreakdownLanguage('tamil')} className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${breakdownLanguage === 'tamil' ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`}>TAM</button></div></div><button onClick={handleAnalyzeBreakdown} disabled={isAnalyzing || !geminiApiKey} className={`w-full py-2 font-bold text-xs uppercase rounded flex items-center justify-center gap-2 transition-all ${!geminiApiKey ? 'bg-[#222] text-gray-600 cursor-not-allowed' : 'bg-[#f5a623] hover:bg-[#e09612] text-black disabled:opacity-50'}`}>{isAnalyzing ? <Sparkles size={14} className="animate-spin" /> : <Sparkles size={14} />} {isAnalyzing ? 'Analyzing...' : (geminiApiKey ? 'Auto-Analyze' : 'API Key Missing')}</button></div><BreakdownSection title="Location Scenario" category="location" icon={MapIcon} color="text-orange-400" /><BreakdownSection title="Visual Effects" category="vfx" icon={Wand2} color="text-green-400" /><BreakdownSection title="Practical Effects" category="practical" icon={Flame} color="text-red-500" /><BreakdownSection title="Props" category="props" icon={Package} color="text-red-400" /><BreakdownSection title="Sound / SFX" category="sound" icon={Mic2} color="text-blue-400" /><BreakdownSection title="Wardrobe" category="costume" icon={Shirt} color="text-pink-400" /><BreakdownSection title="Cast / Extras" category="cast" icon={Users} color="text-yellow-400" /></>) : (<div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2"><ListChecks size={32} opacity={0.2} /><span className="text-xs text-center px-4">Select a scene to view or create breakdown items.</span></div>)}</div>)}
                        {activeSidebar === 'scratchpad' && (<div className="absolute inset-0 flex flex-col"><div className="px-4 py-3 border-b border-[#333] bg-[#161616]"><div className="flex bg-black/40 p-1 rounded-lg border border-[#333] relative"><button onClick={() => setScratchpadMode('global')} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all relative z-10 flex items-center justify-center gap-2 ${scratchpadMode === 'global' ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><Globe size={10} /> Global Notes</button><button onClick={() => setScratchpadMode('scene')} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all relative z-10 flex items-center justify-center gap-2 ${scratchpadMode === 'scene' ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><StickyNote size={10} /> Scene Notes</button></div></div><div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-[#111]">{(scratchpadMode === 'global' ? globalNotes : (activeBeat?.notes || [])).map((note, index) => { const isConfirming = confirmDeleteNoteId === note.id; const borderColor = note.color; const subtleBorder = `${borderColor}40`; const subtleBg = `${borderColor}05`; return (<div key={note.id} draggable={false} onDragOver={(e) => handleNoteDragOver(e, index)} onDrop={(e) => handleNoteDrop(e, index)} onDragLeave={handleNoteDragLeave} className={`mb-4 rounded-md overflow-hidden transition-all shadow-sm group relative ${scratchpadConfig.glassEffect ? 'backdrop-blur-md' : ''}`} style={{ transition: 'transform 0.2s, opacity 0.2s', transform: dragOverIndex === index && scratchpadConfig.enableDragAnimations ? `scale(${scratchpadConfig.dragScale})` : 'scale(1)', opacity: dragOverIndex === index && scratchpadConfig.enableDragAnimations ? scratchpadConfig.dragOpacity : 1, border: `1px solid ${subtleBorder}`, backgroundColor: subtleBg, boxShadow: `0 1px 3px rgba(0,0,0,0.3), 0 0 2px ${subtleBorder}` }}><div draggable={true} onDragStart={(e) => handleNoteDragStart(e, index)} className="flex justify-between items-center px-2 py-1 border-b border-white/5 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}><div className="flex gap-1 items-center"><GripHorizontal size={12} className="text-gray-600 mr-2" />{NOTE_COLORS.map(c => (<div key={c.bg} className={`w-2 h-2 rounded-full cursor-pointer transition-transform hover:scale-125 ${note.color === c.border ? 'ring-1 ring-white' : 'opacity-50 hover:opacity-100'}`} style={{ backgroundColor: c.border }} onMouseDown={(e) => { e.stopPropagation(); updateNote(note.id, { color: c.border }); }}></div>))}</div><button onMouseDown={(e) => { e.stopPropagation(); if(isConfirming) deleteNote(note.id); else { setConfirmDeleteNoteId(note.id); setTimeout(() => setConfirmDeleteNoteId(null), 3000); } }} className={`transition-colors ${isConfirming ? 'text-red-500 animate-pulse bg-red-900/20 px-1 rounded' : 'text-white/30 hover:text-white'}`} title={isConfirming ? "Click again to delete" : "Delete Note"}><Trash2 size={10} /></button></div><div style={{ backgroundColor: 'transparent' }}><BlockEditor value={note.content} onChange={(val) => updateNote(note.id, { content: val })} className="bg-transparent border-none rounded-none" minHeight="80px" placeholder="Note content..." config={scratchpadConfig} style={{ lineHeight: scratchpadConfig.lineHeight }} /></div></div>); })} {(scratchpadMode === 'scene' && !activeBeat) ? (<div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2"><StickyNote size={32} opacity={0.2} /><span className="text-xs text-center px-4">Select a scene to add notes.</span></div>) : (<button onClick={addNote} className="w-full py-3 mt-2 border border-dashed border-[#333] hover:border-[#f5a623] hover:bg-[#f5a623]/10 text-gray-500 hover:text-[#f5a623] rounded-none text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"><Plus size={14} /> Add Note</button>)}</div></div>)}
                        {activeSidebar === 'history' && (<div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4">{activeBeat ? (<div className="flex flex-col h-full"><div className="mb-4 bg-[#111] p-3 rounded border border-[#333]"><h4 className="text-xs font-bold text-white uppercase mb-1">{activeBeat.slug.location || 'Untitled'}</h4><div className="text-[10px] text-gray-500 font-mono">Current Version</div></div><button onClick={handleCreateSnapshot} className="w-full py-2 mb-6 bg-[#222] hover:bg-[#333] border border-[#333] text-gray-300 text-xs font-bold uppercase rounded flex items-center justify-center gap-2 transition-all"><Save size={12} /> Create Snapshot</button><div className="space-y-2">{activeBeat.versions && activeBeat.versions.length > 0 ? ([...activeBeat.versions].reverse().map((v, i) => (<div key={v.id} className="bg-[#111] border border-[#222] rounded p-3 group hover:border-[#444] transition-colors"><div className="flex items-center justify-between mb-2"><span className="text-[10px] font-bold text-[#f5a623] uppercase">v{activeBeat.versions!.length - i}</span><span className="text-[9px] text-gray-500 font-mono">{new Date(v.timestamp).toLocaleString()}</span></div><div className="text-[10px] text-gray-400 mb-3 line-clamp-2 italic opacity-70">{v.summary || "No summary provided."}</div><button onClick={() => handleRestoreClick(v)} className="w-full py-1.5 bg-[#1a1a1a] hover:bg-[#252525] text-gray-400 hover:text-white border border-[#333] rounded text-[9px] font-bold uppercase flex items-center justify-center gap-2 transition-colors"><RotateCcw size={10} /> Restore</button></div>))) : (<div className="text-center py-10 text-gray-600"><History size={32} className="mx-auto mb-2 opacity-20" /><span className="text-xs">No snapshots yet.</span></div>)}</div></div>) : (<div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2"><History size={32} opacity={0.2} /><span className="text-xs text-center px-4">Select a scene to view version history.</span></div>)}</div>)}
                    </div>
                </div>
            )}
        </div>
      </div>
      {diffVersion && activeBeat && (<DiffModal currentContent={activeBeat.content} snapshotContent={diffVersion.content} timestamp={diffVersion.timestamp} snapshotTitle={diffVersion.summary} onRestore={confirmRestoreVersion} onClose={() => setDiffVersion(null)} />)}
    </div>
  );
};

export default ScriptView;
