import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useProject } from '../context/ProjectContext';
import { Beat } from '../types';
import { 
  Eye, EyeOff, Plus, Layers, Sparkles, Move, FileText, CheckCircle2, 
  Clock, MapPin, ExternalLink, Hash, Palette
} from 'lucide-react';

interface ExcalidrawBoardProps {
  isLight?: boolean;
  onEditBeat?: (id: number) => void;
}

export const ExcalidrawBoard: React.FC<ExcalidrawBoardProps> = ({ isLight = false, onEditBeat }) => {
  const { 
    currentProjectId, beats, updateBeat, addBeat, captureSnapshot, 
    activeBoardId, setActiveBoardId 
  } = useProject();
  
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  // Viewport tracking state from Excalidraw
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Overlay settings
  const [showBeats, setShowBeats] = useState(true);
  const [beatsFilter, setBeatsFilter] = useState<'board' | 'all'>('all');
  const [selectedBeatId, setSelectedBeatId] = useState<number | null>(null);

  // Dragging state for beat cards
  const [draggingBeatId, setDraggingBeatId] = useState<number | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; beatX: number; beatY: number } | null>(null);

  // Storage key per project (checks current and previous board4 keys)
  const storageKey = `backstage_excalidraw_${currentProjectId || 'default'}`;
  const legacyStorageKey = `backstage_excalidraw_board4_${currentProjectId || 'default'}`;

  // Initial scene load
  const [initialData] = useState<any>(() => {
    try {
      const saved = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load Excalidraw data:', e);
    }
    return null;
  });

  const saveTimeoutRef = useRef<any>(null);

  // Filter beats to display
  const displayedBeats = useMemo(() => {
    if (!beats || !Array.isArray(beats)) return [];
    if (beatsFilter === 'board') {
      return beats.filter(b => (b.boardId ?? 0) === activeBoardId);
    }
    return beats;
  }, [beats, beatsFilter, activeBoardId]);

  // Handle Excalidraw changes (updates viewport transform & auto-saves drawings)
  const handleChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    if (appState) {
      if (appState.scrollX !== undefined) setScrollX(appState.scrollX);
      if (appState.scrollY !== undefined) setScrollY(appState.scrollY);
      if (appState.zoom?.value !== undefined) setZoom(appState.zoom.value);
    }

    // Debounce save drawings to localStorage
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const sceneData = {
          elements: elements.filter(el => !el.isDeleted),
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            gridSize: appState.gridSize,
          },
          files: files,
        };
        localStorage.setItem(storageKey, JSON.stringify(sceneData));
      } catch (e) {
        console.error('Failed to save Excalidraw Board 4 data:', e);
      }
    }, 400);
  }, [storageKey]);

  // Card dragging handlers
  const handleCardMouseDown = (e: React.MouseEvent, beat: Beat) => {
    // Only trigger drag if clicked on header/drag handle or non-interactive parts
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    e.stopPropagation();
    setSelectedBeatId(beat.id);
    setDraggingBeatId(beat.id);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      beatX: beat.x || 0,
      beatY: beat.y || 0,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingBeatId || !dragStartRef.current) return;
      const dx = (e.clientX - dragStartRef.current.mouseX) / zoom;
      const dy = (e.clientY - dragStartRef.current.mouseY) / zoom;
      const newX = Math.round(dragStartRef.current.beatX + dx);
      const newY = Math.round(dragStartRef.current.beatY + dy);

      updateBeat(draggingBeatId, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (draggingBeatId) {
        setDraggingBeatId(null);
        dragStartRef.current = null;
        if (captureSnapshot) captureSnapshot();
      }
    };

    if (draggingBeatId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingBeatId, zoom, updateBeat, captureSnapshot]);

  // Create new beat right in the center of the current Excalidraw viewport
  const handleAddNewBeat = () => {
    // Calculate center coordinates in scene space
    const centerSceneX = Math.round((-scrollX) + (window.innerWidth / (2 * zoom)));
    const centerSceneY = Math.round((-scrollY) + (window.innerHeight / (2 * zoom)));

    const newBeatData: Partial<Beat> = {
      title: `Scene ${beats.length + 1}`,
      x: centerSceneX - 160,
      y: centerSceneY - 100,
      w: 320,
      h: 180,
      boardId: activeBoardId,
      status: 'not-ready',
      slug: { prefix: 'INT.', location: 'NEW LOCATION', time: 'DAY' },
      content: '',
      summary: 'Add scene notes or plot beat details...',
      color: '#f5a623',
    };

    addBeat(newBeatData);
    if (captureSnapshot) captureSnapshot();
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#121212] select-none">
      {/* 1. Underlying Excalidraw Infinite Canvas */}
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        theme={isLight ? 'light' : 'dark'}
        initialData={initialData}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            loadScene: true,
            saveToActiveFile: false,
            theme: true,
            saveAsImage: true,
          }
        }}
      />

      {/* 2. Floating Beats Controls Dock - Positioned at bottom center, safely above board switcher */}
      <div 
        className="absolute bottom-[68px] left-1/2 -translate-x-1/2 z-[200] flex items-center gap-1.5 p-1 rounded-xl backdrop-blur-md shadow-2xl border transition-all duration-200"
        style={{
          background: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(24, 24, 32, 0.92)',
          borderColor: isLight ? 'rgba(203, 213, 225, 0.8)' : 'rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* Toggle Beats Visibility */}
        <button
          onClick={() => setShowBeats(!showBeats)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            showBeats 
              ? (isLight ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs' : 'bg-amber-500 text-black border-amber-400 shadow-sm') 
              : (isLight ? 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200' : 'bg-[#2a2a36] text-slate-300 border-white/10 hover:bg-white/10')
          }`}
          title="Toggle screenplay beat cards overlay"
        >
          {showBeats ? <Eye size={13} strokeWidth={2.5} /> : <EyeOff size={13} strokeWidth={2.5} />}
          <span>{displayedBeats.length} {displayedBeats.length === 1 ? 'Beat' : 'Beats'}</span>
        </button>

        {/* Filter: All Beats vs Excalidraw Beats */}
        <button
          onClick={() => setBeatsFilter(f => f === 'all' ? 'board' : 'all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isLight 
              ? 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100' 
              : 'bg-[#2a2a36] border-white/10 text-slate-300 hover:bg-white/10'
          }`}
          title={beatsFilter === 'all' ? 'Showing: All Project Beats (Click to filter Excalidraw only)' : 'Showing: Excalidraw Beats Only (Click to show All Beats)'}
        >
          <Layers size={13} className="text-amber-500" />
          <span>{beatsFilter === 'all' ? 'All Beats' : 'Excalidraw'}</span>
        </button>

        {/* Quick Add Beat on Excalidraw Canvas */}
        <button
          onClick={handleAddNewBeat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black transition-all shadow-xs border border-emerald-600"
          title="Create a new beat card at current canvas center"
        >
          <Plus size={13} strokeWidth={2.5} />
          <span>Add Beat</span>
        </button>
      </div>

      {/* Ensure Excalidraw's native UI controls are always above canvas overlay */}
      <style>{`
        .excalidraw .layer-ui__wrapper {
          z-index: 150 !important;
        }
      `}</style>

      {/* 2. Synchronized Screenplay Beat Cards Layer */}
      {showBeats && (
        <div 
          className="absolute inset-0 pointer-events-none z-[100] origin-top-left"
          style={{
            transform: `translate(${scrollX * zoom}px, ${scrollY * zoom}px) scale(${zoom})`,
          }}
        >
          {displayedBeats.map((beat) => {
            const isSelected = selectedBeatId === beat.id;
            const isDragging = draggingBeatId === beat.id;
            const compColor = beat.color && beat.color !== '#444' ? beat.color : '#f5a623';
            const cardWidth = beat.w || 320;

            return (
              <div
                key={beat.id}
                onMouseDown={(e) => handleCardMouseDown(e, beat)}
                onClick={() => setSelectedBeatId(beat.id)}
                className={`absolute rounded-xl pointer-events-auto transition-shadow duration-150 flex flex-col overflow-hidden border backdrop-blur-md ${
                  isLight 
                    ? 'bg-white/95 border-slate-300 text-slate-900' 
                    : 'bg-[#18181f]/95 border-white/10 text-white'
                } ${
                  isSelected 
                    ? 'ring-2 ring-amber-500 shadow-2xl scale-[1.01] z-30' 
                    : 'shadow-lg hover:shadow-xl hover:border-amber-500/40 z-20'
                } ${isDragging ? 'cursor-grabbing opacity-90 shadow-2xl z-40' : 'cursor-grab'}`}
                style={{
                  left: `${beat.x || 0}px`,
                  top: `${beat.y || 0}px`,
                  width: `${cardWidth}px`,
                }}
              >
                {/* Header Banner & Drag Handle */}
                <div 
                  className="px-3 py-2 flex items-center justify-between border-b"
                  style={{
                    background: isLight 
                      ? `linear-gradient(135deg, ${compColor}18, ${compColor}08)` 
                      : `linear-gradient(135deg, ${compColor}28, ${compColor}0a)`,
                    borderColor: isLight ? `${compColor}30` : `${compColor}40`,
                  }}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                    {/* Scene Number Badge */}
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-black text-black shrink-0 shadow-xs"
                      style={{ backgroundColor: compColor }}
                    >
                      {beat.sceneNumber || `#${beat.id}`}
                    </span>

                    {/* Beat Title */}
                    <span className="font-bold text-xs truncate">
                      {beat.title || 'Untitled Scene'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Status Dot */}
                    <div 
                      className={`w-2 h-2 rounded-full ${beat.status === 'ready' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                      title={beat.status === 'ready' ? 'Status: Ready' : 'Status: In Progress'}
                    />
                    
                    {/* Edit in Script Button */}
                    {onEditBeat && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditBeat(beat.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          isLight ? 'hover:bg-black/10 text-slate-600' : 'hover:bg-white/10 text-slate-300'
                        }`}
                        title="Focus in Script View"
                      >
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Slugline Bar */}
                <div className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border-b ${
                  isLight ? 'bg-slate-50 border-slate-200/80 text-slate-600' : 'bg-white/[0.02] border-white/5 text-slate-400'
                }`}>
                  <MapPin size={10} className="text-amber-500 shrink-0" />
                  <span className="truncate">
                    {beat.slug?.prefix || 'INT.'} {beat.slug?.location || 'LOCATION'} — {beat.slug?.time || 'DAY'}
                  </span>
                </div>

                {/* Summary / Notes Snippet */}
                <div className="p-3 text-[11px] leading-relaxed line-clamp-3 opacity-80 select-text">
                  {beat.summary || (beat.content ? beat.content.replace(/<[^>]*>/g, ' ').slice(0, 120) : 'No summary added yet.')}
                </div>

                {/* Footer Metadata */}
                <div className={`px-3 py-1.5 border-t text-[9px] flex items-center justify-between font-mono ${
                  isLight ? 'bg-slate-50/50 border-slate-100 text-slate-500' : 'bg-white/[0.01] border-white/5 text-slate-500'
                }`}>
                  <span className="flex items-center gap-1">
                    <Move size={9} />
                    <span>Drag to move</span>
                  </span>
                  <span>{(beat.boardId ?? 0) === 1 ? 'Excalidraw' : 'Beatboard'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default ExcalidrawBoard;
