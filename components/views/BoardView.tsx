
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BeatStatus, Group, Annotation, Beat, Connection, ConnectionStyle } from '../../types';
import { 
    MousePointer2, Square, Circle, Pen, Minus, ArrowRight, Eraser, Trash2, 
    Type, X, PenTool, GripHorizontal, Heading, ZoomIn, ZoomOut, Maximize, FileText, Loader2, Sparkles,
    Music, Play, Pause, AlertTriangle, ArrowRightLeft, Replace, Layers, Copy, ClipboardPaste, CopyPlus,
    RotateCw, RotateCcw, Zap, PlusCircle, Wand2, Plus, ArrowLeftRight, Workflow, Activity, MoreHorizontal
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import BeatCard from '../BeatCard';
import { STORYLINE_COLORS } from '../../constants';
import { extractRawTextFromPdf } from '../../services/pdfImport';
import { analyzeScriptBatch, convertTextToScript } from '../../services/gemini';
import { AISceneGeneratorModal } from '../AISceneGeneratorModal';

const ANNOTATION_COLORS = ['#f5a623', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ffffff'];

interface BoardViewProps {
  onEditBeat: (id: number) => void;
}

const BoardView: React.FC<BoardViewProps> = ({ onEditBeat }) => {
  const { 
    beats, groups, connections, panX, panY, scale, annotations, activeBoardId, nextId,
    setPan, setScale, updateBeat, setConnections, addBeat, setBeats, setGroups, addGroup, updateGroup, removeGroup,
    setAnnotations, captureSnapshot, geminiApiKey, isPdfDropEnabled, setActiveBoardId, setNextId,
    autoGenerate5Scenes, undo, redo,
    boardLayerOrder = ['annotations', 'text', 'connections', 'groups', 'beats']
  } = useProject();

  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const minimapContainerRef = useRef<HTMLDivElement>(null);
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eraserCursorRef = useRef<HTMLDivElement>(null);
  const rafPendingRef = useRef(false);
  const connRafPendingRef = useRef(false);
  
  // Local UI State for Toolbar
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [toolMode, setToolMode] = useState<'none' | 'pencil' | 'rect' | 'circle' | 'line' | 'arrow' | 'eraser' | 'text' | 'bigtext'>('none');
  const [drawColor, setDrawColor] = useState('#f5a623');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokeStyle, setStrokeStyle] = useState<'solid' | 'dashed'>('solid'); 
  const [defaultConnStyle, setDefaultConnStyle] = useState<ConnectionStyle>('zigzag');
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [isBeautifying, setIsBeautifying] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  
  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<Beat[]>([]);
  
  // Context Menu State
  const [ctxMenu, setCtxMenu] = useState<{x: number, y: number, worldX: number, worldY: number, beatId?: number | null, groupId?: number | null, linkIndex?: number | null, annotationId?: number | null} | null>(null);
  
  // Duplicate Fix Menu State
  const [fixMenu, setFixMenu] = useState<{x: number, y: number, beatId: number, currentNum: string, suggestions: string[]} | null>(null);

  // Text Editing State
  const [editingAnnoId, setEditingAnnoId] = useState<number | null>(null);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false); 
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Spacebar pan tracking
  const isSpacePressedRef = useRef(false);

  // Scrubbing State
  const [scrubbingData, setScrubbingData] = useState<{
      beatId: number,
      currentVal: number,
      x: number,
      y: number,
      startX: number,
      existingNums: number[]
  } | null>(null);

  // Engine Ref (Mutable state for high-perf interactions)
  const engine = useRef({
    beats: [] as Beat[],
    groups: [] as Group[],
    connections: [] as Connection[],
    annotations: [] as Annotation[],
    scale: 1,
    panX: 0,
    panY: 0,
    
    selectedBeatIds: new Set<number>(),
    selectedAnnoId: null as number | null,
    selectedConnIndex: null as number | null,
    dragTarget: null as number | null,
    dragGroupTarget: null as number | null, 
    dragGroupChildIds: new Set<number>(),
    groupResizeTarget: null as number | null,
    
    imageResizeTarget: null as { 
        id: number, 
        corner: 'nw' | 'ne' | 'sw' | 'se',
        startX: number,
        startY: number,
        startW: number,
        startH: number,
        startMouseX: number,
        startMouseY: number,
        aspectRatio: number
    } | null,
    
    dragAnnotationId: null as number | null,

    isScrubbing: false,
    scrubBeatId: null as number | null,
    scrubStartX: 0,
    scrubStartVal: 0,
    scrubCurrentVal: 0,

    isDragging: false,
    isPanning: false,
    lastMouseX: 0,
    lastMouseY: 0,
    lastClickBeatId: null as number | null,
    lastClickTime: 0,
    
    creationState: null as { id: number, step: 'title' | 'summary' } | null,

    isLassoing: false,
    hasLassoMoved: false, 
    lassoStart: { x: 0, y: 0 },
    
    isLinking: false,
    linkingSourceId: null as number | null,
    tempLinkEndX: 0,
    tempLinkEndY: 0,
    relinkData: null as { type: 'source' | 'target', fixedBeatId: number } | null,
    
    isDrawing: false,
    drawStart: { x: 0, y: 0 },
    currentPoints: [] as {x: number, y: number}[], 
    currentAnnoId: null as number | null,

    sceneMap: {} as Record<number, number>,
    componentMap: {} as Record<number, string>,
    errorIds: new Set<number>(),
  });

  const styles = `
    :root {
        --bg-canvas: #1e1e1e;
        --bg-grid: #2a2a2a;
    }
    .board-wrapper {
        width: 100%; height: 100%; overflow: hidden; background-color: #1e1e1e; font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #e0e0e0; position: relative; outline: none;
        -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;
    }
    #viewport {
        width: 100%; height: 100%; cursor: grab; position: absolute; top: 0; left: 0; overflow: hidden; display: block;
        background-color: #1e1e1e;
        background-image: linear-gradient(#2a2a2a 1px, transparent 1px), linear-gradient(90deg, #2a2a2a 1px, transparent 1px);
        background-size: 50px 50px;
        background-position: 0px 0px;
    }
    #viewport:active { cursor: grabbing; }
    .tool-pencil #viewport, .tool-rect #viewport, .tool-circle #viewport, .tool-line #viewport, .tool-arrow #viewport, .tool-text #viewport, .tool-bigtext #viewport { cursor: crosshair !important; }
    .tool-eraser #viewport { cursor: none !important; }
    #canvas-surface {
        position: absolute; top: 0; left: 0; width: 0; height: 0;
        background: transparent;
        transform-origin: 0 0;
        isolation: isolate; 
        overflow: visible;
        will-change: transform;
        transform-style: preserve-3d;
        backface-visibility: hidden;
    }
    .is-dragging *, .is-panning *, .is-dragging .beat-card, .is-panning #canvas-surface * {
        transition: none !important;
        animation: none !important;
    }
    #groups-layer { position: absolute; top: 0; left: 0; width: 100000px; height: 100000px; pointer-events: none; z-index: 5; }
    #connections-layer { position: absolute; top: 0; left: 0; width: 100000px; height: 100000px; pointer-events: none; z-index: 10; overflow: visible; }
    #annotations-layer { position: absolute; top: 0; left: 0; width: 100000px; height: 100000px; pointer-events: none; z-index: 15; overflow: visible; }
    #text-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 20; }
    #beats-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 100; }
    
    /* --- PAGE TRANSITION ANIMATION --- */
    @keyframes boardPageIn {
        0% { opacity: 0; transform: translateX(30px) scale(0.99); filter: blur(8px); }
        100% { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
    }
    .is-transitioning #beats-layer, 
    .is-transitioning #groups-layer, 
    .is-transitioning #connections-layer, 
    .is-transitioning #annotations-layer, 
    .is-transitioning #text-layer {
        animation: boardPageIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .group-container, .beat-card, .link-handle, .input-handle-visual, .annotation-hit-area, .handle-hit-area, .connection-line, .connection-hit-path, .image-resize-handle { pointer-events: auto !important; }
    .text-annotation-card { pointer-events: auto !important; }
    .tool-pencil #annotations-layer, .tool-rect #annotations-layer, .tool-circle #annotations-layer, .tool-line #annotations-layer, .tool-arrow #annotations-layer, .tool-eraser #annotations-layer, .tool-text #annotations-layer, .tool-bigtext #annotations-layer { pointer-events: auto !important; }
    #selection-lasso { position: fixed; border: 1px solid rgba(245, 166, 35, 0.8); background-color: rgba(245, 166, 35, 0.15); display: none; pointer-events: none; z-index: 9999; }
    .connection-line { fill: none; stroke: #f5a623; stroke-width: 3.5px; stroke-linecap: round; pointer-events: visibleStroke; cursor: pointer; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)); }
    .connection-line:hover { stroke-width: 5.5px; opacity: 0.95; }
    .connection-line.selected { stroke: #fff !important; stroke-width: 4.5px; filter: drop-shadow(0 0 6px rgba(255,255,255,0.8)); }
    .connection-line.temp { stroke: #f5a623 !important; stroke-dasharray: 6, 6; opacity: 1 !important; stroke-width: 3.5px !important; pointer-events: none; filter: drop-shadow(0 0 4px rgba(245, 166, 35, 0.9)); }
    .annotation-path { fill: none; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
    .annotation-rect { fill: none; pointer-events: none; }
    .annotation-circle { fill: none; pointer-events: none; }
    .annotation-line { fill: none; stroke-linecap: round; pointer-events: none; }
    .annotation-image { pointer-events: none; }
    .image-resize-handle { fill: #f5a623; stroke: white; stroke-width: 1px; opacity: 0; transition: opacity 0.2s; }
    g[data-type="annotation"]:hover .image-resize-handle { opacity: 1; }
    .text-annotation-card { position: absolute; min-width: 50px; min-height: 1.2em; background: transparent; border: 1px dashed transparent; padding: 4px 8px; cursor: grab; transition: border-color 0.2s, background 0.2s; }
    .text-annotation-card:hover { border-color: rgba(255,255,255,0.3); background: rgba(0,0,0,0.3); }
    .text-annotation-card.editing { background: rgba(20,20,20,0.95); border: 1px solid #f5a623; box-shadow: 0 4px 25px rgba(0,0,0,0.8); cursor: text; z-index: 1000; min-width: 220px; border-radius: 6px; }
    .text-annotation-input { width: 100%; height: 100%; background: transparent; border: none; outline: none; resize: none; font-family: 'Inter', system-ui, sans-serif; line-height: 1.25; overflow: hidden; }
    .text-annotation-display { white-space: pre-wrap; font-family: 'Inter', system-ui, sans-serif; line-height: 1.25; user-select: none; }
    .annotation-hit-area { fill: none; stroke: rgba(255,0,0,0.001); stroke-width: 20px; stroke-linecap: round; stroke-linejoin: round; pointer-events: visibleStroke; cursor: default; }
    .tool-eraser .annotation-hit-area { cursor: none; }
    .eraser-cursor { position: fixed; pointer-events: none; z-index: 9999; width: 20px; height: 20px; border: 2px solid #ef4444; background-color: rgba(239, 68, 68, 0.2); border-radius: 50%; transform: translate(-50%, -50%); display: none; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
    .tool-eraser .eraser-cursor { display: block; }
    .connection-handle { fill: #f5a623; stroke: #fff; stroke-width: 1.5px; opacity: 0; pointer-events: none; transition: transform 0.1s, fill 0.1s, stroke 0.1s, opacity 0.2s; }
    .handle-hit-area { fill: transparent; cursor: grab; pointer-events: auto; }
    .handle-hit-area:hover + .connection-handle { opacity: 1; fill: #fff; stroke: #f5a623; transform: scale(1.5); }
    .handle-hit-area:active + .connection-handle { opacity: 1; cursor: grabbing; }
    .beat-card { position: absolute; width: 200px; min-height: 120px; background: #2d2d2d; border: 1px solid #3d3d3d; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; flex-direction: column; user-select: none; transition: box-shadow 0.1s, border-color 0.1s; cursor: default; }
    .beat-card:hover { border-color: #666; }
    .beat-card.selected { border-color: #f5a623; box-shadow: 0 0 0 1px #f5a623, 0 8px 20px rgba(0,0,0,0.5); z-index: 125; }
    .beat-card.creating { border-color: #f5a623; box-shadow: 0 0 15px rgba(245, 166, 35, 0.5); z-index: 125; }
    .beat-card.target-mode { border-color: #4caf50; box-shadow: 0 0 0 2px #4caf50, 0 0 20px rgba(76, 175, 80, 0.4); z-index: 115; }
    .beat-card:active { z-index: 126; } 
    .beat-header { height: 10px; border-radius: 5px 5px 0 0; background-color: #444; cursor: grab; display: flex; align-items: center; justify-content: space-between; padding: 0 6px; position: relative; }
    .beat-header:active { cursor: grabbing; }
    .seq-badge { background: rgba(0,0,0,0.5); color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; margin-top: -8px; margin-right: -4px; box-shadow: 0 2px 4px rgba(0,0,0,0.4); pointer-events: auto; cursor: ew-resize; z-index: 200; border: 1px solid rgba(255,255,255,0.2); transition: all 0.2s; }
    .seq-badge.error { background-color: #ef4444; border-color: #fca5a5; animation: pulse-red 2s infinite; }
    .seq-badge:hover { transform: scale(1.1); background-color: #f5a623; color: black; border-color: white; }
    .seq-badge.scrubbing { transform: scale(1.1); background-color: #f5a623; color: black; border-color: white; z-index: 1000; }
    @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
    .beat-content { padding: 8px 8px 4px 8px; flex-grow: 1; display: flex; flex-direction: column; }
    .beat-title { font-weight: 700; font-size: 13px; margin-bottom: 6px; padding: 2px 4px; border-radius: 3px; min-height: 20px; color: #ffffff; letter-spacing: 0.3px; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
    .beat-slug-preview { font-family: 'Courier Prime', monospace; font-size: 10px; font-weight: bold; color: #e0e0e0; text-transform: uppercase; margin-bottom: 4px; border-bottom: 1px solid #444; padding-bottom: 4px; }
    .beat-preview { font-family: 'Courier Prime', monospace; font-size: 9px; color: #b0b0b0; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; pointer-events: none; }
    .beat-footer { margin-top: auto; border-top: 1px solid #3d3d3d; background: #252525; padding: 4px 8px; display: flex; justify-content: space-between; align-items: center; border-radius: 0 0 6px 6px; height: 24px; }
    .beat-status { font-size: 9px; font-weight: 800; text-transform: uppercase; display: flex; align-items: center; gap: 4px; letter-spacing: 0.5px; color: #555; }
    .beat-version { font-size: 9px; font-weight: 700; color: #555; display: flex; align-items: center; gap: 3px; }
    .title-input { background: #111; color: white; border: 1px solid #f5a623; border-radius: 4px; width: 100%; font-weight: 700; font-size: 13px; padding: 2px 4px; outline: none; margin-bottom: 6px; }
    .summary-input { background: #111; color: #e0e0e0; border: 1px solid #f5a623; border-radius: 4px; width: 100%; font-family: sans-serif; font-size: 10px; padding: 4px; outline: none; resize: none; height: 70px; line-height: 1.4; }
    .link-handle { position: absolute; right: -10px; top: 20px; width: 20px; height: 20px; background: #f5a623; border: 2px solid #2a2a2a; border-radius: 50%; cursor: crosshair; z-index: 20; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px rgba(245, 166, 35, 0.6); opacity: 0; pointer-events: auto; }
    .beat-card:hover .link-handle { opacity: 1; }
    .link-handle::after { content: ''; width: 6px; height: 6px; background: #ffffff; border-radius: 50%; }
    .link-handle:hover { background: #ffffff; transform: scale(1.3); border-color: #f5a623; opacity: 1; }
    .input-handle-visual { position: absolute; left: -10px; top: 20px; width: 20px; height: 20px; background: #2a2a2a; border: 2px solid #555; border-radius: 50%; pointer-events: auto; z-index: 20; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; opacity: 0; }
    .input-handle-visual::after { content: ''; width: 6px; height: 6px; background: #777; border-radius: 50%; }
    .target-mode .input-handle-visual { opacity: 1; background: #4caf50; border-color: #fff; transform: scale(1.2); box-shadow: 0 0 10px #4caf50; cursor: pointer; }
    .group-container { position: absolute; border-radius: 8px; border: 2px solid; background: rgba(40,40,40,0.3); backdrop-filter: blur(2px); display: flex; flex-direction: column; transition: border-color 0.2s, box-shadow 0.2s; }
    .group-header { height: 24px; background: rgba(0,0,0,0.4); border-radius: 6px 6px 0 0; display: flex; align-items: center; padding: 0 8px; cursor: grab; color: rgba(255,255,255,0.8); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
    .group-header:active { cursor: grabbing; }
    .group-resize-handle { position: absolute; bottom: 0; right: 0; width: 15px; height: 15px; cursor: nwse-resize; border-radius: 0 0 6px 0; background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 50%); }
    .group-resize-handle:hover { background: linear-gradient(135deg, transparent 50%, #f5a623 50%); }
    .group-input { background: transparent; border: none; color: white; font-weight: bold; outline: none; text-transform: uppercase; font-size: 11px; min-width: 50px; transition: width 0.1s; }
    .group-input:focus { background: rgba(0,0,0,0.2); }
    .minimap-container { position: absolute; top: 20px; right: 20px; width: 200px; height: 140px; background: rgba(30, 30, 30, 0.4); backdrop-filter: blur(2px); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.2); z-index: 200; overflow: hidden; pointer-events: none; opacity: 0; transition: opacity 0.3s ease-in-out; transform: translateZ(0); }
    .minimap-container.active { opacity: 1; }
    .minimap-canvas { width: 100%; height: 100%; display: block; opacity: 0.8; }
    #context-menu { position: absolute; background: #252525; border: 1px solid #333; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border-radius: 4px; padding: 5px 0; width: 200px; display: none; z-index: 1000; }
    .ctx-item { padding: 8px 15px; font-size: 13px; cursor: pointer; color: #ccc; transition: background 0.1s; display: flex; align-items: center; gap: 8px; }
    .ctx-item:hover { background: #333; color: white; }
    .ctx-divider { height: 1px; background: #333; margin: 4px 0; }
    .ctx-label { padding: 4px 15px 0; font-size: 10px; color: #777; text-transform: uppercase; font-weight: bold; }
    .color-row { display: flex; padding: 5px 12px; justify-content: space-between; }
    .color-dot { width: 16px; height: 16px; border-radius: 50%; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); position: relative;}
    .color-dot:hover { transform: scale(1.2); border-color: #fff; }
    .zoom-controls { position: absolute; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 5px; z-index: 200; pointer-events: auto; }
    .zoom-controls button { width: 36px; height: 36px; background: #2d2d2d; color: #e0e0e0; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    .zoom-controls button:hover { background: #444; border-color: #f5a623; color: #f5a623; }
    .drawing-toolbar-container { position: absolute; bottom: 20px; left: 20px; z-index: 2000; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
    .toolbar-toggle { width: 44px; height: 44px; background: #2d2d2d; border: 1px solid #555; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #f5a623; box-shadow: 0 4px 10px rgba(0,0,0,0.4); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .toolbar-toggle:hover { background: #333; transform: scale(1.1); color: white; border-color: #f5a623; }
    .toolbar-toggle.active { background: #f5a623; color: black; border-color: #f5a623; transform: rotate(45deg); }
    .toolbar-panel { background: #2d2d2d; border: 1px solid #3d3d3d; border-radius: 12px; padding: 8px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); animation: slideUp 0.2s ease-out; transform-origin: bottom left; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .tool-row { display: flex; align-items: center; gap: 4px; }
    .tool-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 2px 0; width: 100%; }
    .tool-btn { width: 28px; height: 28px; border-radius: 6px; background: transparent; color: #888; border: 1px solid transparent; display: flex; align-items: center; justify-content: center; transition: all 0.2s; cursor: pointer; padding: 0; margin: 0; }
    .tool-btn:hover { background: rgba(255,255,255,0.1); color: #ccc; }
    .tool-btn.active { background: rgba(245, 166, 35, 0.15); color: #f5a623; border-color: rgba(245, 166, 35, 0.3); }
    .tool-btn.danger:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
    .color-dot-btn { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s; border: 1px solid transparent; }
    .color-dot-btn:hover { transform: scale(1.1); }
    .color-dot-btn.active { border-color: rgba(255,255,255,0.5); transform: scale(1.1); }
    .color-dot-inner { width: 12px; height: 12px; border-radius: 50%; }

    .board-switcher {
      position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(20,20,20,0.6); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.05);
      padding: 3px; border-radius: 10px; display: flex; gap: 2px; z-index: 2000;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    }
    .board-tab {
      padding: 5px 10px; font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; border-radius: 7px; color: #555; transition: all 0.25s ease;
      display: flex; align-items: center; gap: 5px; border: 1px solid transparent;
    }
    .board-tab:hover { color: #999; background: rgba(255,255,255,0.03); }
    .board-tab.active { 
      background: rgba(245, 166, 35, 0.08); 
      color: #f5a623; 
      border-color: rgba(245, 166, 35, 0.2);
    }

    .scrub-timeline-container {
        position: absolute; width: 300px; height: 40px; background: rgba(10, 10, 10, 0.9); border: 1px solid rgba(245, 166, 35, 0.4); border-radius: 8px;
        transform: translate(-50%, -125%); pointer-events: none; z-index: 2500;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 5px 12px;
        backdrop-filter: blur(4px);
    }
    .scrub-track {
        position: relative; width: 100%; height: 2px; background: rgba(255,255,255,0.1); border-radius: 1px; margin-top: 8px;
    }
    .scrub-notch {
        position: absolute; top: -2px; width: 1px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 0.5px;
    }
    .scrub-notch.filled { background: rgba(255,255,255,0.3); }
    .scrub-indicator {
        position: absolute; top: -6px; width: 1.5px; height: 14px; background: #f5a623; border-radius: 1px;
        box-shadow: 0 0 8px #f5a623; transform: translateX(-50%);
    }
    .scrub-label {
        font-size: 11px; font-weight: 800; color: #f5a623; text-transform: uppercase; letter-spacing: 1px;
    }
    .scrub-sub {
        font-size: 7px; font-weight: bold; color: #555; margin-top: 2px; text-transform: uppercase;
    }

    g[data-selected="true"] .annotation-hit-area {
        stroke: rgba(245, 166, 35, 0.8) !important;
        stroke-width: 2px !important;
        stroke-dasharray: 4,4;
    }
    g[data-selected="true"] .image-resize-handle {
        opacity: 1 !important;
    }
  `;

  // --- INITIALIZATION & RE-RENDER ---
  useEffect(() => {
    engine.current.beats = JSON.parse(JSON.stringify(beats.filter(b => (b.boardId || 0) === activeBoardId))); 
    engine.current.groups = JSON.parse(JSON.stringify((groups || []).filter(g => (g.boardId || 0) === activeBoardId)));
    engine.current.connections = JSON.parse(JSON.stringify(connections.filter(c => (c.boardId || 0) === activeBoardId)));
    engine.current.annotations = JSON.parse(JSON.stringify(annotations.filter(a => (a.boardId || 0) === activeBoardId)));
    engine.current.scale = scale;
    engine.current.panX = panX;
    engine.current.panY = panY;
    
    renderCanvas();
    renderMinimap();
  }, [beats, groups, connections, scale, panX, panY, annotations, activeBoardId, boardLayerOrder]); // Added boardLayerOrder dependency

  // --- PAGE TRANSITION TRIGGER ---
  useEffect(() => {
    setIsPageTransitioning(true);
    const timer = setTimeout(() => setIsPageTransitioning(false), 450);
    return () => clearTimeout(timer);
  }, [activeBoardId]);

  useEffect(() => {
      if (toolMode === 'text' || toolMode === 'bigtext') {
          engine.current.selectedBeatIds.clear();
          engine.current.selectedAnnoId = null;
          renderCanvas(); // Re-render canvas
      }
  }, [toolMode]);

  const isPointNearAnnotation = (x: number, y: number, a: Annotation, threshold = 35): boolean => {
    if (a.type === 'pencil' && a.points && a.points.length > 0) {
      return a.points.some(p => Math.hypot(p.x - x, p.y - y) <= threshold);
    }
    if (a.type === 'rect' || a.type === 'image') {
      const ax = a.x || 0;
      const ay = a.y || 0;
      const aw = a.w || 200;
      const ah = a.h || 150;
      return x >= ax - threshold && x <= ax + Math.abs(aw) + threshold &&
             y >= ay - threshold && y <= ay + Math.abs(ah) + threshold;
    }
    if (a.type === 'circle') {
      const cx = a.cx !== undefined ? a.cx : (a.x || 0) + (a.w || 0) / 2;
      const cy = a.cy !== undefined ? a.cy : (a.y || 0) + (a.h || 0) / 2;
      const r = a.rx !== undefined ? a.rx : Math.hypot(a.w || 0, a.h || 0) / 2;
      return Math.hypot(cx - x, cy - y) <= Math.max(r, threshold);
    }
    if (a.type === 'line' || a.type === 'arrow') {
      const x1 = a.x || 0;
      const y1 = a.y || 0;
      const x2 = (a.x || 0) + (a.w || 0);
      const y2 = (a.y || 0) + (a.h || 0);
      const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
      if (l2 === 0) return Math.hypot(x1 - x, y1 - y) <= threshold;
      let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * (x2 - x1);
      const projY = y1 + t * (y2 - y1);
      return Math.hypot(projX - x, projY - y) <= threshold;
    }
    if (a.type === 'text' || a.type === 'bigtext') {
      const ax = a.x || 0;
      const ay = a.y || 0;
      const aw = a.type === 'bigtext' ? 220 : 140;
      const ah = a.type === 'bigtext' ? 50 : 35;
      return x >= ax - threshold && x <= ax + aw + threshold &&
             y >= ay - threshold && y <= ay + ah + threshold;
    }
    return false;
  };

  const renderCanvas = () => {
    if (containerRef.current) {
      const viewport = containerRef.current.querySelector('#viewport') as HTMLElement;
      if (viewport) {
        viewport.style.backgroundPosition = `${engine.current.panX}px ${engine.current.panY}px`;
        viewport.style.backgroundSize = `${50 * engine.current.scale}px ${50 * engine.current.scale}px`;
      }
      const surface = containerRef.current.querySelector('#canvas-surface') as HTMLElement;
      if (surface) {
        surface.style.transform = `translate(${engine.current.panX}px, ${engine.current.panY}px) scale(${engine.current.scale})`;
      }
    }
    
    renderGroups(); 
    renderBeats();
    renderConnections(); 
    renderText();
    renderMinimap();
  };

  const ensureVibrantLightColor = (color?: string, fallback: string = '#f5a623') => {
    if (!color) return fallback;
    const c = color.trim().toLowerCase();
    if (c === '#000' || c === '#000000' || c === '#111' || c === '#111111' || c === '#222' || c === '#222222' || c === '#333' || c === '#333333' || c === '#1e1e1e' || c === 'black' || c === '#2d3748' || c === '#374151' || c === '#1f2937' || c === '#111827') {
      return fallback;
    }
    return color;
  };

  const renderText = () => {
    if (!containerRef.current) return;
    const textLayer = containerRef.current.querySelector('#text-layer');
    if (!textLayer) return;
    textLayer.innerHTML = '';

    engine.current.annotations.forEach(anno => {
      if (anno.type !== 'text' && anno.type !== 'bigtext') return;

      const isBig = anno.type === 'bigtext';
      const card = document.createElement('div');
      const isEditing = editingAnnoId === anno.id;
      const isSelected = engine.current.selectedAnnoId === anno.id;

      const textColor = ensureVibrantLightColor(anno.color, isBig ? '#f5a623' : '#38bdf8');

      card.className = `text-annotation-card ${isEditing ? 'editing' : ''}`;
      card.style.left = `${anno.x || 0}px`;
      card.style.top = `${anno.y || 0}px`;
      card.style.color = textColor;
      card.style.fontSize = isBig ? '26px' : '14px';
      card.style.fontWeight = isBig ? '900' : '600';
      card.style.letterSpacing = isBig ? '1.5px' : '0.4px';

      if (isSelected) {
        card.style.borderColor = '#f5a623';
        card.style.backgroundColor = 'rgba(245, 166, 35, 0.1)';
      }

      if (isEditing) {
        const textarea = document.createElement('textarea');
        textarea.className = 'text-annotation-input';
        textarea.value = anno.text || '';
        textarea.style.color = textColor;
        textarea.style.fontSize = isBig ? '26px' : '14px';
        textarea.style.fontWeight = isBig ? '900' : '600';
        textarea.style.letterSpacing = isBig ? '1.5px' : '0.4px';

        textarea.onmousedown = (e) => e.stopPropagation();
        textarea.oninput = () => {
          updateTextContent(anno.id, textarea.value);
        };
        textarea.onblur = () => {
          setEditingAnnoId(null);
          captureSnapshot();
          setAnnotations(JSON.parse(JSON.stringify(engine.current.annotations)));
        };
        textarea.onkeydown = (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            setEditingAnnoId(null);
            captureSnapshot();
            setAnnotations(JSON.parse(JSON.stringify(engine.current.annotations)));
          }
        };
        setTimeout(() => textarea.focus(), 10);
        card.appendChild(textarea);
      } else {
        const display = document.createElement('div');
        display.className = 'text-annotation-display';
        display.innerText = anno.text || (isBig ? 'HEADING' : 'Note text...');
        card.appendChild(display);

        card.onmousedown = (e) => {
          if (toolMode !== 'none' && toolMode !== 'eraser') return;
          if (e.button !== 0) return;
          e.stopPropagation();
          engine.current.selectedAnnoId = anno.id;
          engine.current.selectedBeatIds.clear();
          renderBeats();
          renderConnections();
          renderText();
          engine.current.dragAnnotationId = anno.id;
          engine.current.isDragging = true;
          engine.current.lastMouseX = e.clientX;
          engine.current.lastMouseY = e.clientY;
        };

        card.ondblclick = (e) => {
          e.stopPropagation();
          setEditingAnnoId(anno.id);
        };
      }

      textLayer.appendChild(card);
    });
  };

  const renderBeats = () => {
    if (!containerRef.current) return;
    analyzeGraph();
    const beatsLayer = containerRef.current.querySelector('#beats-layer');
    if (!beatsLayer) return;

    beatsLayer.innerHTML = ''; 

    const { creationState } = engine.current;

    engine.current.beats.forEach(beat => {
        const isCreating = creationState?.id === beat.id;
        const card = document.createElement('div');
        card.className = `beat-card ${engine.current.selectedBeatIds.has(beat.id) ? 'selected' : ''} ${isCreating ? 'creating' : ''}`;
        if (engine.current.isLinking && beat.id !== engine.current.linkingSourceId) card.classList.add('target-mode');
        card.style.left = `${beat.x}px`;
        card.style.top = `${beat.y}px`;
        if(beat.tint) card.style.backgroundColor = beat.tint;
        card.dataset.id = beat.id.toString();

        const header = document.createElement('div');
        header.className = 'beat-header';
        const compColor = engine.current.componentMap[beat.id] || '#444';
        header.style.backgroundColor = compColor;
        
        // Render Logic: Use derived sceneMap value first (chain logic), then manual override, else default to dot
        const calcNum = engine.current.sceneMap[beat.id];
        // If calcNum is null, it's explicitly unnumbered (dot).
        // If calcNum is undefined (not in map), fallback to beat.sceneNumber (legacy/safety).
        const displayNum = (calcNum !== null && calcNum !== undefined) ? calcNum.toString() : '•';
        
        const badge = document.createElement('span');
        badge.className = `seq-badge ${engine.current.scrubBeatId === beat.id ? 'scrubbing' : ''}`;
        badge.innerText = displayNum;
        badge.id = `badge-${beat.id}`;
        
        const isError = engine.current.errorIds.has(beat.id);
        if (isError) { 
            badge.classList.add('error'); 
            badge.title = "Duplicate Scene Number.";
        }
        header.appendChild(badge);

        const boardIndicator = document.createElement('span');
        boardIndicator.className = 'absolute top-1 right-1 text-[6px] font-black uppercase text-white/40 px-1.5 py-0 rounded-full bg-black/40 border border-white/5';
        boardIndicator.innerText = `P${(beat.boardId || 0) + 1}`;
        header.appendChild(boardIndicator);

        const content = document.createElement('div');
        content.className = 'beat-content';

        if (isCreating && creationState?.step === 'title') {
            const input = document.createElement('input');
            input.className = 'title-input';
            input.value = beat.title || '';
            input.placeholder = "Beat Name...";
            input.onmousedown = (e) => e.stopPropagation();

            let handledEnter = false;

            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handledEnter = true;
                    const val = input.value.trim();
                    updateBeat(beat.id, { title: val });
                    engine.current.creationState = { id: beat.id, step: 'summary' };
                    renderBeats();
                }
            };

            input.onblur = () => {
                if (handledEnter) return;
                const val = input.value.trim();
                updateBeat(beat.id, { title: val });
                if (engine.current.creationState?.id === beat.id && engine.current.creationState.step === 'title') {
                    engine.current.creationState = { id: beat.id, step: 'summary' };
                    renderBeats();
                }
            };

            setTimeout(() => input.focus(), 15);
            content.appendChild(input);
        } else {
            const title = document.createElement('div');
            title.className = 'beat-title';
            title.innerText = beat.title || 'UNTITLED'; 
            content.appendChild(title);
        }

        const slugPreview = document.createElement('div');
        slugPreview.className = 'beat-slug-preview';
        const s = beat.slug;
        if (s && (s.prefix || s.location || s.time)) {
            slugPreview.innerText = `${s.prefix} ${s.location} - ${s.time}`;
            slugPreview.style.color = '#e0e0e0';
        } else {
            slugPreview.innerText = "INT. LOCATION - DAY";
            slugPreview.style.color = 'rgba(255,255,255,0.3)'; 
        }
        content.appendChild(slugPreview);

        if (isCreating && creationState?.step === 'summary') {
            const textarea = document.createElement('textarea');
            textarea.className = 'summary-input';
            textarea.value = beat.summary || '';
            textarea.placeholder = "Scene summary...";
            textarea.onmousedown = (e) => e.stopPropagation();

            let handledEnter = false;

            textarea.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handledEnter = true;
                    const val = textarea.value.trim();
                    updateBeat(beat.id, { summary: val });
                    engine.current.creationState = null;
                    engine.current.selectedBeatIds.clear();
                    engine.current.selectedBeatIds.add(beat.id);
                    renderBeats();
                    containerRef.current?.focus(); 
                }
            };

            textarea.onblur = () => {
                if (handledEnter) return;
                const val = textarea.value.trim();
                updateBeat(beat.id, { summary: val });
                if (engine.current.creationState?.id === beat.id && engine.current.creationState.step === 'summary') {
                    engine.current.creationState = null;
                    engine.current.selectedBeatIds.clear();
                    engine.current.selectedBeatIds.add(beat.id);
                    renderBeats();
                }
            };

            setTimeout(() => textarea.focus(), 15);
            content.appendChild(textarea);
        } else {
            const preview = document.createElement('div');
            preview.className = 'beat-preview';
            if (beat.summary && beat.summary.trim().length > 0) {
                 preview.innerText = beat.summary;
                 preview.style.fontStyle = 'normal';
                 preview.style.color = '#b0b0b0';
                 preview.style.fontFamily = 'Helvetica Neue, sans-serif';
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = beat.content || ''; 
                preview.innerText = tempDiv.innerText || '(Empty)';
            }
            content.appendChild(preview);
        }

        const footer = document.createElement('div');
        footer.className = 'beat-footer';
        const statusDiv = document.createElement('div');
        const isReady = beat.status === 'ready';
        statusDiv.className = `beat-status ${isReady ? 'ready' : 'wip'}`;
        statusDiv.title = 'Click to toggle status (Ready / WIP)';
        statusDiv.style.cursor = 'pointer';
        const checkIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        const clockIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        statusDiv.innerHTML = isReady ? `${checkIcon} READY` : `${clockIcon} WIP`;
        statusDiv.onmousedown = (e) => {
            e.stopPropagation();
            captureSnapshot();
            const nextStatus: BeatStatus = isReady ? 'not-ready' : 'ready';
            updateBeat(beat.id, { status: nextStatus });
            engine.current.beats = engine.current.beats.map(b => b.id === beat.id ? { ...b, status: nextStatus } : b);
            renderBeats();
        };
        
        const versionDiv = document.createElement('div');
        versionDiv.className = 'beat-version';
        const vCount = beat.versions ? beat.versions.length : 0;
        versionDiv.title = vCount > 0 ? `${vCount} saved version(s) - Click to open Context Menu` : 'No prior versions';
        versionDiv.style.cursor = 'pointer';
        versionDiv.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg> v${vCount}`;
        versionDiv.onmousedown = (e) => {
            e.stopPropagation();
            if (!engine.current.selectedBeatIds.has(beat.id)) {
                engine.current.selectedBeatIds.clear();
                engine.current.selectedBeatIds.add(beat.id);
                renderBeats();
                renderConnections();
            }
            showContextMenu(e.clientX, e.clientY, beat.id, null, null, null);
        };
        
        footer.appendChild(statusDiv);
        footer.appendChild(versionDiv);

        const handle = document.createElement('div');
        handle.className = 'link-handle';
        handle.onmousedown = (e) => onLinkHandleMouseDown(e, beat.id);
        
        const inputHandle = document.createElement('div');
        inputHandle.className = 'input-handle-visual';

        card.appendChild(header);
        card.appendChild(content);
        card.appendChild(footer);
        card.appendChild(handle);
        card.appendChild(inputHandle);

        card.tabIndex = 0;
        card.onmousedown = (e) => onBeatMouseDown(e, beat.id);
        card.ondblclick = (e) => { e.stopPropagation(); onEditBeat(beat.id); };
        card.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!engine.current.selectedBeatIds.has(beat.id)) {
                engine.current.selectedBeatIds.clear();
                engine.current.selectedBeatIds.add(beat.id);
                engine.current.selectedAnnoId = null;
                renderBeats();
                renderConnections();
            }
            showContextMenu(e.clientX, e.clientY, beat.id, null, null, null);
        };
        card.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                onEditBeat(beat.id);
            }
        };
        
        badge.onmousedown = (e) => onBadgeMouseDown(e, beat.id, parseInt(displayNum) || 1);

        beatsLayer.appendChild(card);
    });
  };

  const onBadgeMouseDown = (e: MouseEvent, id: number, currentVal: number) => {
      e.stopPropagation();
      e.preventDefault();
      captureSnapshot();
      
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const parentRect = containerRef.current!.getBoundingClientRect();
      
      engine.current.isScrubbing = true;
      engine.current.scrubBeatId = id;
      engine.current.scrubStartX = e.clientX;
      engine.current.scrubStartVal = currentVal;
      engine.current.scrubCurrentVal = currentVal;
      
      const existing = beats
          .map(b => parseInt(b.sceneNumber || '0'))
          .filter(n => n > 0 && n <= 80);

      setScrubbingData({
          beatId: id,
          currentVal: currentVal,
          x: rect.left - parentRect.left + rect.width / 2,
          y: rect.top - parentRect.top - 10,
          startX: e.clientX,
          existingNums: existing
      });
      
      renderBeats();
  };

  const applyFix = (beatId: number, newNum: string) => {
      captureSnapshot();
      updateBeat(beatId, { sceneNumber: newNum });
      setFixMenu(null);
  };

  const analyzeGraph = () => {
    // 1. Build Adjacency List
    const adjUndir: Record<number, number[]> = {};
    const adjDir: Record<number, number[]> = {};
    const inDegree: Record<number, number> = {};
    
    // Initialize for all CURRENT board beats
    engine.current.beats.forEach(b => {
        adjUndir[b.id] = [];
        adjDir[b.id] = [];
        inDegree[b.id] = 0;
    });

    engine.current.connections.forEach(c => {
        // Safety checks for cross-board connections
        if (adjUndir[c.from]) adjUndir[c.from].push(c.to);
        if (adjUndir[c.to]) adjUndir[c.to].push(c.from);
        if (adjDir[c.from]) adjDir[c.from].push(c.to);
        if (inDegree[c.to] !== undefined) inDegree[c.to]++;
    });

    // 2. Stable Coloring
    const visited = new Set<number>();
    const newComponentMap: Record<number, string> = {};
    const sortedIds = [...engine.current.beats].map(b => b.id).sort((a, b) => a - b);

    sortedIds.forEach(nodeId => {
        if (!visited.has(nodeId)) {
            const componentNodes: number[] = [];
            const queue = [nodeId];
            visited.add(nodeId);
            while (queue.length > 0) {
                const u = queue.shift()!;
                componentNodes.push(u);
                if (adjUndir[u]) {
                    adjUndir[u].forEach(v => {
                        if (!visited.has(v)) { visited.add(v); queue.push(v); }
                    });
                }
            }
            let finalColor = '#f5a623';
            if (componentNodes.length > 1) {
                const rootId = Math.min(...componentNodes);
                const colorIndex = rootId % STORYLINE_COLORS.length;
                finalColor = STORYLINE_COLORS[colorIndex];
            }
            componentNodes.forEach(id => { newComponentMap[id] = finalColor; });
        }
    });
    engine.current.componentMap = newComponentMap;

    // 3. Robust Numbering Propagation
    const newSceneMap: Record<number, number | null> = {};
    const processingQueue: number[] = [];
    const tempInDegree = { ...inDegree };
    const manualOverrides = new Set<number>();

    // A. Initialize with Manual Numbers
    engine.current.beats.forEach(b => {
        if (b.sceneNumber && !isNaN(parseInt(b.sceneNumber))) {
            newSceneMap[b.id] = parseInt(b.sceneNumber);
            manualOverrides.add(b.id);
        }
    });

    // B. Seed Queue (Roots)
    // A Root is any node with in-degree 0
    sortedIds.forEach(id => {
        if (tempInDegree[id] === 0) {
            // If not manual, default to null (dot)
            if (newSceneMap[id] === undefined) {
                newSceneMap[id] = null;
            }
            processingQueue.push(id);
        }
    });

    // C. BFS Propagation
    while (processingQueue.length > 0) {
        const u = processingQueue.shift()!;
        const currentVal = newSceneMap[u];

        if (adjDir[u]) {
            adjDir[u].forEach(v => {
                // If v has manual override, it ignores parent's value
                if (!manualOverrides.has(v)) {
                    let proposedVal: number | null = null;
                    
                    if (currentVal !== null && currentVal !== undefined) {
                        proposedVal = currentVal + 1;
                    }

                    // Merge Logic: Prefer Number over Null, Prefer Higher Number
                    const existingVal = newSceneMap[v];
                    
                    if (proposedVal !== null) {
                        // If we have a proposed number
                        if (existingVal === undefined || existingVal === null || proposedVal > existingVal) {
                            newSceneMap[v] = proposedVal;
                        }
                    } else {
                        // If proposed is null (dot)
                        // Only set to dot if currently undefined (don't overwrite a number from another parent)
                        if (existingVal === undefined) {
                            newSceneMap[v] = null;
                        }
                    }
                }

                tempInDegree[v]--;
                if (tempInDegree[v] === 0) {
                    processingQueue.push(v);
                }
            });
        }
    }
    
    // D. Fill Gaps (Cycles/Unreachable)
    sortedIds.forEach(id => {
        if (newSceneMap[id] === undefined) {
             newSceneMap[id] = null;
        }
    });

    engine.current.sceneMap = newSceneMap;
    
    // 4. Error Detection
    engine.current.errorIds = new Set();
    const numberCounts: Record<string, number> = {};
    engine.current.beats.forEach(b => {
        const val = engine.current.sceneMap[b.id];
        const num = (val !== null && val !== undefined) ? val.toString() : (b.sceneNumber || null);
        if (num) numberCounts[num] = (numberCounts[num] || 0) + 1;
    });
    engine.current.beats.forEach(b => {
        const val = engine.current.sceneMap[b.id];
        const num = (val !== null && val !== undefined) ? val.toString() : (b.sceneNumber || null);
        if (num && numberCounts[num] > 1) engine.current.errorIds.add(b.id);
    });
  };

  const renderConnections = () => {
      if (!containerRef.current) return;
      analyzeGraph();
      const connectionsLayer = containerRef.current.querySelector('#connections-layer');
      const annotationsLayer = containerRef.current.querySelector('#annotations-layer');
      if (!connectionsLayer || !annotationsLayer) return;
      
      connectionsLayer.innerHTML = ''; 
      annotationsLayer.innerHTML = '';

      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const markerColors = ['#f5a623', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#38bdf8', '#e5e7eb', '#6366f1'];
      markerColors.forEach(color => {
          const hex = color.replace('#', '');
          const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
          marker.setAttribute("id", `arrow-${hex}`);
          marker.setAttribute("markerWidth", "10");
          marker.setAttribute("markerHeight", "10");
          marker.setAttribute("refX", "9");
          marker.setAttribute("refY", "3");
          marker.setAttribute("orient", "auto");
          marker.setAttribute("markerUnits", "strokeWidth");
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", "M0,0 L0,6 L9,3 z");
          path.setAttribute("fill", color);
          marker.appendChild(path);
          defs.appendChild(marker);

          // Marker End for Connection Lines
          const markerConnEnd = document.createElementNS("http://www.w3.org/2000/svg", "marker");
          markerConnEnd.setAttribute("id", `conn-arrow-end-${hex}`);
          markerConnEnd.setAttribute("markerWidth", "10");
          markerConnEnd.setAttribute("markerHeight", "10");
          markerConnEnd.setAttribute("refX", "8");
          markerConnEnd.setAttribute("refY", "3");
          markerConnEnd.setAttribute("orient", "auto");
          markerConnEnd.setAttribute("markerUnits", "strokeWidth");
          const pathEnd = document.createElementNS("http://www.w3.org/2000/svg", "path");
          pathEnd.setAttribute("d", "M0,0 L0,6 L9,3 z");
          pathEnd.setAttribute("fill", color);
          markerConnEnd.appendChild(pathEnd);
          defs.appendChild(markerConnEnd);

          // Marker Start for Connection Lines (double arrow)
          const markerConnStart = document.createElementNS("http://www.w3.org/2000/svg", "marker");
          markerConnStart.setAttribute("id", `conn-arrow-start-${hex}`);
          markerConnStart.setAttribute("markerWidth", "10");
          markerConnStart.setAttribute("markerHeight", "10");
          markerConnStart.setAttribute("refX", "1");
          markerConnStart.setAttribute("refY", "3");
          markerConnStart.setAttribute("orient", "auto");
          markerConnStart.setAttribute("markerUnits", "strokeWidth");
          const pathStart = document.createElementNS("http://www.w3.org/2000/svg", "path");
          pathStart.setAttribute("d", "M9,0 L9,6 L0,3 z");
          pathStart.setAttribute("fill", color);
          markerConnStart.appendChild(pathStart);
          defs.appendChild(markerConnStart);
      });
      annotationsLayer.appendChild(defs); 

      engine.current.annotations.forEach(anno => {
          if (anno.type === 'text' || anno.type === 'bigtext' || anno.type === 'audio') return; 
          const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
          if (engine.current.selectedAnnoId === anno.id) {
              group.setAttribute("data-selected", "true");
          }
          
          let el: SVGElement | null = null;
          let hitEl: SVGElement | null = null; 
          let handleEls: SVGElement[] = [];
          const width = (anno as any).strokeWidth || 3;
          const style = (anno as any).strokeStyle || 'solid';
          const dash = style === 'dashed' ? '10,10' : '';

          if (anno.type === 'pencil') {
              const dPath = anno.d || (anno.points && anno.points.length > 0 ? getSmoothedPath(anno.points) : '');
              if (dPath) {
                  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  path.setAttribute("d", dPath);
                  path.setAttribute("stroke", anno.color);
                  path.setAttribute("stroke-width", width.toString());
                  if (dash) path.setAttribute("stroke-dasharray", dash);
                  path.setAttribute("fill", "none");
                  path.classList.add("annotation-path");
                  el = path;

                  const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  hitPath.setAttribute("d", dPath);
                  hitPath.classList.add("annotation-hit-area");
                  hitEl = hitPath;
              }
          } else if (anno.type === 'rect' && anno.x !== undefined) {
              const rx = Math.min(anno.x, anno.x + (anno.w || 0));
              const ry = Math.min(anno.y || 0, (anno.y || 0) + (anno.h || 0));
              const rw = Math.max(1, Math.abs(anno.w || 0));
              const rh = Math.max(1, Math.abs(anno.h || 0));

              const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
              rect.setAttribute("x", rx.toString());
              rect.setAttribute("y", ry.toString());
              rect.setAttribute("width", rw.toString());
              rect.setAttribute("height", rh.toString());
              rect.setAttribute("stroke", anno.color);
              rect.setAttribute("stroke-width", width.toString());
              if (dash) rect.setAttribute("stroke-dasharray", dash);
              rect.classList.add("annotation-rect");
              el = rect;

              const hitRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
              hitRect.setAttribute("x", rx.toString());
              hitRect.setAttribute("y", ry.toString());
              hitRect.setAttribute("width", rw.toString());
              hitRect.setAttribute("height", rh.toString());
              hitRect.classList.add("annotation-hit-area");
              hitEl = hitRect;
          } else if (anno.type === 'circle' && (anno.cx !== undefined || anno.x !== undefined)) {
              const cx = anno.cx !== undefined ? anno.cx : (anno.x || 0) + (anno.w || 0) / 2;
              const cy = anno.cy !== undefined ? anno.cy : (anno.y || 0) + (anno.h || 0) / 2;
              const r = anno.rx !== undefined ? anno.rx : Math.hypot(anno.w || 0, anno.h || 0) / 2;
              const safeR = Math.max(1, r);

              const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              circle.setAttribute("cx", cx.toString());
              circle.setAttribute("cy", cy.toString());
              circle.setAttribute("r", safeR.toString());
              circle.setAttribute("stroke", anno.color);
              circle.setAttribute("stroke-width", width.toString());
              if (dash) circle.setAttribute("stroke-dasharray", dash);
              circle.classList.add("annotation-circle");
              el = circle;

              const hitCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              hitCircle.setAttribute("cx", cx.toString());
              hitCircle.setAttribute("cy", cy.toString());
              hitCircle.setAttribute("r", safeR.toString());
              hitCircle.classList.add("annotation-hit-area");
              hitEl = hitCircle;
          } else if (anno.type === 'line' && anno.x !== undefined) {
              const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
              line.setAttribute("x1", anno.x.toString());
              line.setAttribute("y1", (anno.y || 0).toString());
              line.setAttribute("x2", ((anno.x || 0) + (anno.w || 0)).toString());
              line.setAttribute("y2", ((anno.y || 0) + (anno.h || 0)).toString());
              line.setAttribute("stroke", anno.color);
              line.setAttribute("stroke-width", width.toString());
              if (dash) line.setAttribute("stroke-dasharray", dash);
              line.classList.add("annotation-line");
              el = line;

              const hitLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
              hitLine.setAttribute("x1", anno.x.toString());
              hitLine.setAttribute("y1", (anno.y || 0).toString());
              hitLine.setAttribute("x2", ((anno.x || 0) + (anno.w || 0)).toString());
              hitLine.setAttribute("y2", ((anno.y || 0) + (anno.h || 0)).toString());
              hitLine.classList.add("annotation-hit-area");
              hitEl = hitLine;
          } else if (anno.type === 'arrow' && anno.x !== undefined) {
              const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
              line.setAttribute("x1", anno.x.toString());
              line.setAttribute("y1", (anno.y || 0).toString());
              line.setAttribute("x2", ((anno.x || 0) + (anno.w || 0)).toString());
              line.setAttribute("y2", ((anno.y || 0) + (anno.h || 0)).toString());
              line.setAttribute("stroke", anno.color);
              line.setAttribute("stroke-width", width.toString());
              if (dash) line.setAttribute("stroke-dasharray", dash);
              line.setAttribute("marker-end", `url(#arrow-${anno.color.replace('#', '')})`);
              line.classList.add("annotation-line");
              el = line;

              const hitLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
              hitLine.setAttribute("x1", anno.x.toString());
              hitLine.setAttribute("y1", (anno.y || 0).toString());
              hitLine.setAttribute("x2", ((anno.x || 0) + (anno.w || 0)).toString());
              hitLine.setAttribute("y2", ((anno.y || 0) + (anno.h || 0)).toString());
              hitLine.classList.add("annotation-hit-area");
              hitEl = hitLine;
          } else if (anno.type === 'image' && anno.imageUrl) {
              const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
              const ax = anno.x || 0;
              const ay = anno.y || 0;
              const aw = anno.w || 200; 
              const ah = anno.h || 150; 
              image.setAttribute("x", ax.toString());
              image.setAttribute("y", ay.toString());
              image.setAttribute("width", aw.toString());
              image.setAttribute("height", ah.toString());
              image.setAttribute("href", anno.imageUrl);
              image.setAttribute("preserveAspectRatio", "none"); 
              image.classList.add("annotation-image");
              el = image;

              const hitRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
              hitRect.setAttribute("x", ax.toString());
              hitRect.setAttribute("y", ay.toString());
              hitRect.setAttribute("width", aw.toString());
              hitRect.setAttribute("height", ah.toString());
              hitRect.setAttribute("fill", "transparent");
              hitRect.setAttribute("cursor", "move");
              hitRect.classList.add("annotation-hit-area");
              hitEl = hitRect;

              const handleSize = 10;
              const addHandle = (cx: number, cy: number, cursor: string, corner: 'nw' | 'ne' | 'sw' | 'se') => {
                  const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                  r.setAttribute("x", (cx - handleSize/2).toString());
                  r.setAttribute("y", (cy - handleSize/2).toString());
                  r.setAttribute("width", handleSize.toString());
                  r.setAttribute("height", handleSize.toString());
                  r.classList.add("image-resize-handle");
                  r.style.cursor = cursor;
                  // @ts-ignore
                  r.onmousedown = (e) => onImageResizeMouseDown(e, anno.id, corner);
                  return r;
              };
              handleEls.push(addHandle(ax, ay, 'nw-resize', 'nw'));
              handleEls.push(addHandle(ax + aw, ay, 'ne-resize', 'ne'));
              handleEls.push(addHandle(ax, ay + ah, 'sw-resize', 'sw'));
              handleEls.push(addHandle(ax + aw, ay + ah, 'se-resize', 'se'));
          }

          if (hitEl) {
              hitEl.onmousedown = (e) => {
                  if (toolMode === 'eraser') {
                      e.stopPropagation();
                      deleteAnnotation(anno.id);
                      return;
                  }
                  if (toolMode !== 'none') return;
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  engine.current.selectedAnnoId = anno.id;
                  engine.current.selectedBeatIds.clear();
                  renderBeats();
                  renderConnections();
                  renderText();
                  engine.current.dragAnnotationId = anno.id;
                  engine.current.isDragging = true;
                  engine.current.lastMouseX = e.clientX;
                  engine.current.lastMouseY = e.clientY;
              };
          }

          if (el) {
              group.setAttribute("data-type", "annotation");
              group.setAttribute("data-id", anno.id.toString());
              if (hitEl) group.appendChild(hitEl);
              group.appendChild(el);
              handleEls.forEach(h => group.appendChild(h));
              annotationsLayer.appendChild(group);
          }
      });

      engine.current.connections.forEach((conn, index) => {
          const fromBeat = engine.current.beats.find(b => b.id === conn.from);
          const toBeat = engine.current.beats.find(b => b.id === conn.to);
          if (fromBeat && toBeat) {
              const fromX = fromBeat.x + 200; 
              const fromY = fromBeat.y + 30; 
              const toX = toBeat.x; 
              const toY = toBeat.y + 30; 
              
              const dx = toX - fromX;
              const dy = toY - fromY;
              
              const style: ConnectionStyle = (conn.style as ConnectionStyle) || defaultConnStyle || 'zigzag';
              const compColor = conn.color || engine.current.componentMap[fromBeat.id] || '#f5a623';

              let pathD = '';
              if (style === 'zigzag') {
                  if (toX > fromX + 20) {
                      const midX = fromX + dx / 2;
                      pathD = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;
                  } else {
                      const midY = (fromY + toY) / 2;
                      pathD = `M ${fromX} ${fromY} L ${fromX + 30} ${fromY} L ${fromX + 30} ${midY} L ${toX - 30} ${midY} L ${toX - 30} ${toY} L ${toX} ${toY}`;
                  }
              } else {
                  // curve
                  const cpDist = Math.max(Math.abs(dx) * 0.5, 50);
                  const cp1x = fromX + cpDist; 
                  const cp1y = fromY; 
                  const cp2x = toX - cpDist; 
                  const cp2y = toY;
                  pathD = `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`;
              }
              
              const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
              const isSelected = engine.current.selectedConnIndex === index;

              const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
              hitPath.setAttribute("d", pathD);
              hitPath.setAttribute("stroke", "transparent"); 
              hitPath.setAttribute("stroke-width", "20"); 
              hitPath.setAttribute("fill", "none");
              // @ts-ignore
              hitPath.classList.add("connection-hit-path"); 
              hitPath.dataset.index = index.toString(); 
              hitPath.style.cursor = "pointer";

              const selectConn = (e: MouseEvent) => {
                  e.stopPropagation();
                  engine.current.selectedConnIndex = index;
                  engine.current.selectedBeatIds.clear();
                  engine.current.selectedAnnoId = null;
                  renderBeats();
                  renderConnections();
              };

              hitPath.onclick = selectConn;
              group.appendChild(hitPath);
              
              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path.setAttribute("d", pathD);
              path.classList.add("connection-line"); 
              if (isSelected) {
                  path.classList.add("selected");
              }
              path.style.stroke = compColor; 

              path.onclick = selectConn;
              path.oncontextmenu = (e) => { 
                  e.preventDefault(); 
                  e.stopPropagation(); 
                  engine.current.selectedConnIndex = index;
                  renderConnections();
                  showContextMenu(e.clientX, e.clientY, null, index, null, null); 
              };
              group.appendChild(path); 
              
              const addHandle = (cx: number, cy: number, type: 'source' | 'target') => {
                  const handleGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                  const hitCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                  hitCircle.setAttribute("cx", cx.toString());
                  hitCircle.setAttribute("cy", cy.toString());
                  hitCircle.setAttribute("r", "14"); 
                  hitCircle.classList.add("handle-hit-area");
                  const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                  handle.setAttribute("cx", cx.toString());
                  handle.setAttribute("cy", cy.toString());
                  handle.setAttribute("r", "6"); 
                  handle.classList.add("connection-handle");
                  // @ts-ignore
                  const startDrag = (e) => {
                      e.stopPropagation(); e.preventDefault();
                      const filteredConns = connections.filter(c => (c.boardId || 0) === (activeBoardId || 0));
                      const targetConn = filteredConns[index];
                      if (targetConn) {
                          const newConns = connections.filter(c => c !== targetConn);
                          setConnections(newConns);
                          captureSnapshot({ connections: newConns });
                          engine.current.connections = engine.current.connections.filter((_, i) => i !== index);
                      } else {
                          captureSnapshot();
                      }
                      engine.current.selectedConnIndex = null;
                      engine.current.isLinking = true;
                      if (type === 'source') { engine.current.relinkData = { type: 'source', fixedBeatId: toBeat.id }; engine.current.linkingSourceId = null; } 
                      else { engine.current.relinkData = { type: 'target', fixedBeatId: fromBeat.id }; engine.current.linkingSourceId = fromBeat.id; }
                      updateTempLinkPos(e);
                      containerRef.current?.querySelector('#connections-layer')?.classList.add('linking-mode');
                      renderConnections(); 
                  };
                  hitCircle.onmousedown = startDrag;
                  handleGroup.appendChild(hitCircle);
                  handleGroup.appendChild(handle);
                  group.appendChild(handleGroup);
              };
              addHandle(fromX + 10, fromY, 'source');
              addHandle(toX - 10, toY, 'target');
              connectionsLayer.appendChild(group);
          }
      });

      if (engine.current.isLinking && (engine.current.linkingSourceId !== null || engine.current.relinkData !== null)) {
          let startX: number | undefined, startY: number | undefined, endX: number | undefined, endY: number | undefined;
          if (engine.current.relinkData && engine.current.relinkData.type === 'source') {
              const targetBeat = engine.current.beats.find(b => b.id === engine.current.relinkData!.fixedBeatId);
              if (targetBeat) {
                  endX = targetBeat.x; 
                  endY = targetBeat.y + 30; 
                  startX = engine.current.tempLinkEndX; 
                  startY = engine.current.tempLinkEndY; 
              }
          } else {
              const sourceBeat = engine.current.beats.find(b => b.id === engine.current.linkingSourceId);
              if (sourceBeat) {
                  startX = sourceBeat.x + 200; 
                  startY = sourceBeat.y + 30; 
                  endX = engine.current.tempLinkEndX; 
                  endY = engine.current.tempLinkEndY; 
              }
          }

          if (startX !== undefined && startY !== undefined && endX !== undefined && endY !== undefined) {
              const dx = Math.abs(endX - startX);
              const cpDist = Math.max(dx * 0.5, 50);
              const cp1x = startX + cpDist;
              const cp1y = startY;
              const cp2x = endX - cpDist;
              const cp2y = endY;

              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path.setAttribute("d", `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`);
              path.classList.add("connection-line", "temp");
              connectionsLayer.appendChild(path);
          }
      }
  };

  const renderGroups = () => {
      if (!containerRef.current) return;
      const groupsLayer = containerRef.current.querySelector('#groups-layer');
      if (!groupsLayer) return;
      groupsLayer.innerHTML = ''; 
      const sortedGroups = [...engine.current.groups].sort((a, b) => (b.width * b.height) - (a.width * a.height));
      sortedGroups.forEach(group => {
          const div = document.createElement('div');
          div.className = 'group-container';
          div.style.left = `${group.x}px`;
          div.style.top = `${group.y}px`;
          div.style.width = `${group.width}px`;
          div.style.height = `${group.height}px`;
          div.style.borderColor = group.color || '#555';
          div.dataset.id = group.id.toString();
          const header = document.createElement('div');
          header.className = 'group-header';
          const input = document.createElement('input');
          input.className = 'group-input';
          input.value = group.title;
          const updateWidth = () => { input.style.width = `${Math.max(50, (input.value.length * 9) + 15)}px`; };
          updateWidth();
          input.onmousedown = (e) => e.stopPropagation(); 
          input.oninput = () => updateWidth();
          input.onchange = (e) => updateGroup(group.id, { title: (e.target as HTMLInputElement).value });
          input.onkeydown = (e) => { if(e.key === 'Enter') input.blur(); };
          header.appendChild(input);
          header.onmousedown = (e) => onGroupHeaderMouseDown(e, group.id);
          const resizer = document.createElement('div');
          resizer.className = 'group-resize-handle';
          resizer.onmousedown = (e) => onGroupResizeMouseDown(e, group.id);
          div.appendChild(header);
          div.appendChild(resizer);
          groupsLayer.appendChild(div);
      });
  };

  const renderMinimap = () => {
      const canvas = minimapRef.current;
      if (!canvas || !containerRef.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const items = engine.current.beats;
      const groups = engine.current.groups;
      const viewportW = containerRef.current.clientWidth;
      const viewportH = containerRef.current.clientHeight;
      const viewX = -engine.current.panX / engine.current.scale;
      const viewY = -engine.current.panY / engine.current.scale;
      const viewW = viewportW / engine.current.scale;
      const viewH = viewportH / engine.current.scale;
      let minX = viewX, minY = viewY, maxX = viewX + viewW, maxY = viewY + viewH;
      items.forEach(b => {
          if (b.x < minX) minX = b.x; if (b.y < minY) minY = b.y;
          if (b.x + 200 > maxX) maxX = b.x + 200; if (b.y + 120 > maxY) maxY = b.y + 120;
      });
      groups.forEach(g => {
          if (g.x < minX) minX = g.x; if (g.y < minY) minY = g.y;
          if (g.x + g.width > maxX) maxX = g.x + g.width; if (g.y + g.height > maxY) maxY = g.y + g.height;
      });
      const padding = 1000;
      minX -= padding; minY -= padding; maxX += padding; maxY += padding;
      const worldW = maxX - minX;
      const worldH = maxY - minY;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const mapW = canvas.width;
      const mapH = canvas.height;
      const scale = Math.min(mapW / worldW, mapH / worldH);
      const offsetX = (mapW - worldW * scale) / 2;
      const offsetY = (mapH - worldW * scale) / 2;
      const toMapX = (wx: number) => offsetX + (wx - minX) * scale;
      const toMapY = (wy: number) => offsetY + (wy - minY) * scale;
      ctx.clearRect(0, 0, mapW, mapH);
      ctx.lineWidth = 1;
      groups.forEach(g => {
          ctx.strokeStyle = 'rgba(255,255,255,0.05)';
          ctx.strokeRect(toMapX(g.x), toMapY(g.y), g.width * scale, g.height * scale);
          ctx.fillStyle = g.color || '#555';
          ctx.globalAlpha = 0.05;
          ctx.fillRect(toMapX(g.x), toMapY(g.y), g.width * scale, g.height * scale);
          ctx.globalAlpha = 1.0;
      });
      items.forEach(b => {
          const bx = toMapX(b.x);
          const by = toMapY(b.y);
          const bw = Math.max(2, 200 * scale);
          const bh = Math.max(2, 120 * scale);
          if (engine.current.selectedBeatIds.has(b.id)) { ctx.fillStyle = '#f5a623'; ctx.globalAlpha = 0.8; } 
          else { ctx.fillStyle = 'rgba(200, 200, 200, 0.3)'; ctx.globalAlpha = 0.4; }
          ctx.fillRect(bx, by, bw, bh);
          ctx.globalAlpha = 1.0;
      });
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.4)'; ctx.lineWidth = 1;
      ctx.strokeRect(toMapX(viewX), toMapY(viewY), viewW * scale, viewH * scale);
  };

  const deleteAnnotation = (id: number) => {
      captureSnapshot();
      setAnnotations(prev => prev.filter(a => a.id !== id));
      engine.current.annotations = engine.current.annotations.filter(a => a.id !== id);
      if (engine.current.selectedAnnoId === id) engine.current.selectedAnnoId = null;
      renderCanvas();
  };

  const handleClearAll = () => {
      captureSnapshot();
      if (engine.current.selectedAnnoId !== null) {
          deleteAnnotation(engine.current.selectedAnnoId);
          return;
      }
      setAnnotations(prev => prev.filter(a => (a.boardId || 0) !== activeBoardId));
      engine.current.annotations = engine.current.annotations.filter(a => (a.boardId || 0) !== activeBoardId);
      engine.current.selectedAnnoId = null;
      renderCanvas();
  };

  const onImageResizeMouseDown = (e: MouseEvent, id: number, corner: 'nw' | 'ne' | 'sw' | 'se') => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      const anno = engine.current.annotations.find(a => a.id === id);
      if (!anno) return;
      engine.current.imageResizeTarget = {
          id: id, corner: corner, startX: anno.x || 0, startY: anno.y || 0,
          startW: anno.w || 200, startH: anno.h || 150, startMouseX: e.clientX,
          startMouseY: e.clientY, aspectRatio: (anno.w || 200) / (anno.h || 150)
      };
      engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX;
      engine.current.lastMouseY = e.clientY;
  };

  const getSmoothedPath = (points: {x: number, y: number}[]) => {
      if (points.length === 0) return '';
      if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`; 
      const start = points[0];
      let d = `M ${start.x} ${start.y}`;
      for (let i = 1; i < points.length - 1; i++) {
          const p0 = points[i]; const p1 = points[i+1];
          const midX = (p0.x + p1.x) / 2; const midY = (p0.y + p1.y) / 2;
          d += ` Q ${p0.x} ${p0.y} ${midX} ${midY}`;
      }
      if (points.length > 1) { d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`; }
      return d;
  };

  const updateTempLinkPos = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const pt = getSvgPoint(e);
      engine.current.tempLinkEndX = pt.x;
      engine.current.tempLinkEndY = pt.y;
      renderConnections();
  };

  const completeDragLink = (e: MouseEvent) => {
      if (!engine.current.isLinking) return;
      
      const { x: mouseX, y: mouseY } = getSvgPoint(e);
      let targetId = -1;
      let minDistance = 300; // Snap radius

      engine.current.beats.forEach(b => {
          const insideBox = mouseX >= b.x - 30 && mouseX <= b.x + 230 &&
                            mouseY >= b.y - 30 && mouseY <= b.y + 150;
          const centerX = b.x + 100;
          const centerY = b.y + 60;
          const dist = Math.hypot(centerX - mouseX, centerY - mouseY);
          
          const effectiveDist = insideBox ? Math.min(dist, 50) : dist;

          if (effectiveDist < minDistance) {
              minDistance = effectiveDist;
              targetId = b.id;
          }
      });

      if (targetId === -1) {
          const targetEl = (e.target as HTMLElement).closest('.beat-card') as HTMLElement;
          if (targetEl) {
              targetId = parseInt(targetEl.dataset.id || '-1');
          }
      }

      if (engine.current.relinkData?.type === 'source') {
          const fixedTargetId = engine.current.relinkData.fixedBeatId;
          if (targetId >= 0 && fixedTargetId !== undefined && targetId !== fixedTargetId) {
              const exists = engine.current.connections.some(c => c.from === targetId && c.to === fixedTargetId && (c.boardId || 0) === (activeBoardId || 0));
              if (!exists) {
                  const newConn = { from: targetId, to: fixedTargetId, boardId: activeBoardId };
                  engine.current.connections.push(newConn);
                  const updatedConns = [...connections, newConn];
                  setConnections(updatedConns);
                  captureSnapshot({ connections: updatedConns });
              }
          }
      } else {
          if (engine.current.linkingSourceId !== null) {
              if (targetId >= 0 && targetId !== engine.current.linkingSourceId) {
                  const exists = engine.current.connections.some(c => c.from === engine.current.linkingSourceId && c.to === targetId && (c.boardId || 0) === (activeBoardId || 0));
                  if (!exists) {
                      const newConn = { from: engine.current.linkingSourceId!, to: targetId, boardId: activeBoardId };
                      engine.current.connections.push(newConn);
                      const updatedConns = [...connections, newConn];
                      setConnections(updatedConns);
                      captureSnapshot({ connections: updatedConns });
                  }
              }
          }
      }
      
      engine.current.isLinking = false; 
      engine.current.linkingSourceId = null; 
      engine.current.relinkData = null;
      containerRef.current?.querySelector('#connections-layer')?.classList.remove('linking-mode');
      renderBeats(); 
      renderConnections();
  };

  const handleZoom = (direction: 'in' | 'out') => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const oldScale = engine.current.scale;
      const newScale = direction === 'in' ? Math.min(3, oldScale * 1.25) : Math.max(0.1, oldScale / 1.25);
      if (oldScale === newScale) return;
      const worldX = (centerX - engine.current.panX) / oldScale;
      const worldY = (centerY - engine.current.panY) / oldScale;
      const newPanX = centerX - (worldX * newScale);
      const newPanY = centerY - (worldY * newScale);
      
      engine.current.scale = newScale;
      engine.current.panX = newPanX;
      engine.current.panY = newPanY;
      setScale(newScale);
      setPan(newPanX, newPanY);
      renderCanvas();
      renderMinimap();
  };

  const handleZoomReset = () => {
      const container = containerRef.current;
      if (!container) return;
      const newScale = 1;
      let newPanX = (container.clientWidth / 2) - 100;
      let newPanY = (container.clientHeight / 2) - 60;
      
      const items = engine.current.beats.filter(b => (b.boardId || 0) === activeBoardId);
      const groups = engine.current.groups.filter(g => (g.boardId || 0) === activeBoardId);
      const annos = engine.current.annotations.filter(a => (a.boardId || 0) === activeBoardId);

      if (items.length > 0 || groups.length > 0 || annos.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          items.forEach(b => {
              if (b.x < minX) minX = b.x; if (b.y < minY) minY = b.y;
              if (b.x + 220 > maxX) maxX = b.x + 220; if (b.y + 160 > maxY) maxY = b.y + 160;
          });
          groups.forEach(g => {
              if (g.x < minX) minX = g.x; if (g.y < minY) minY = g.y;
              if (g.x + g.width > maxX) maxX = g.x + g.width; if (g.y + g.height > maxY) maxY = g.y + g.height;
          });
          annos.forEach(a => {
              if (a.x < minX) minX = a.x; if (a.y < minY) minY = a.y;
              if (a.x + (a.w || 100) > maxX) maxX = a.x + (a.w || 100); if (a.y + (a.h || 50) > maxY) maxY = a.y + (a.h || 50);
          });
          const contentCenterX = (minX + maxX) / 2;
          const contentCenterY = (minY + maxY) / 2;
          newPanX = (container.clientWidth / 2) - contentCenterX;
          newPanY = (container.clientHeight / 2) - contentCenterY;
      } else {
          newPanX = (container.clientWidth / 2) - 100;
          newPanY = (container.clientHeight / 2) - 100;
      }

      engine.current.scale = newScale;
      engine.current.panX = newPanX;
      engine.current.panY = newPanY;
      setScale(newScale);
      setPan(newPanX, newPanY);
      renderCanvas();
      renderMinimap();
  };

  const handleFitView = () => {
      const container = containerRef.current;
      if (!container) return;
      const items = engine.current.beats.filter(b => (b.boardId || 0) === activeBoardId);
      const groups = engine.current.groups.filter(g => (g.boardId || 0) === activeBoardId);
      const annos = engine.current.annotations.filter(a => (a.boardId || 0) === activeBoardId);

      if (items.length === 0 && groups.length === 0 && annos.length === 0) {
          const newScale = 1;
          const newPanX = (container.clientWidth / 2) - 100;
          const newPanY = (container.clientHeight / 2) - 100;
          engine.current.scale = newScale;
          engine.current.panX = newPanX;
          engine.current.panY = newPanY;
          setScale(newScale);
          setPan(newPanX, newPanY);
          renderCanvas();
          renderMinimap();
          return;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      items.forEach(b => {
          if (b.x < minX) minX = b.x; if (b.y < minY) minY = b.y;
          if (b.x + 220 > maxX) maxX = b.x + 220; if (b.y + 160 > maxY) maxY = b.y + 160;
      });
      groups.forEach(g => {
          if (g.x < minX) minX = g.x; if (g.y < minY) minY = g.y;
          if (g.x + g.width > maxX) maxX = g.x + g.width; if (g.y + g.height > maxY) maxY = g.y + g.height;
      });
      annos.forEach(a => {
          if (a.x < minX) minX = a.x; if (a.y < minY) minY = a.y;
          if (a.x + (a.w || 100) > maxX) maxX = a.x + (a.w || 100); if (a.y + (a.h || 50) > maxY) maxY = a.y + (a.h || 50);
      });
      const PADDING = 80;
      const contentW = (maxX - minX) + (PADDING * 2);
      const contentH = (maxY - minY) + (PADDING * 2);
      const containerW = container.clientWidth; const containerH = container.clientHeight;
      let newScale = Math.min(Math.max(Math.min(containerW / contentW, containerH / contentH), 0.2), 1.0); 
      const cx = minX - PADDING + contentW / 2; const cy = minY - PADDING + contentH / 2;
      const newPanX = (containerW / 2) - (cx * newScale);
      const newPanY = (containerH / 2) - (cy * newScale);
      engine.current.scale = newScale;
      engine.current.panX = newPanX;
      engine.current.panY = newPanY;
      setScale(newScale);
      setPan(newPanX, newPanY);
      renderCanvas();
      renderMinimap();
  };

  const getSvgPoint = (e: MouseEvent | DragEvent) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - engine.current.panX) / engine.current.scale;
      const y = (e.clientY - rect.top - engine.current.panY) / engine.current.scale;
      return { x, y };
  };

  const onBeatMouseDown = (e: MouseEvent, id: number) => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      if (e.button === 2) {
          e.preventDefault();
          e.stopPropagation();
          if (!engine.current.selectedBeatIds.has(id)) {
              engine.current.selectedBeatIds.clear();
              engine.current.selectedBeatIds.add(id);
              engine.current.selectedAnnoId = null;
              renderBeats();
              renderConnections();
          }
          showContextMenu(e.clientX, e.clientY, id, null, null, null);
          return;
      }
      if (e.button !== 0) return;
      // @ts-ignore
      if(e.target.classList.contains('beat-title') || e.target.classList.contains('link-handle') || e.target.classList.contains('input-handle-visual') || e.target.classList.contains('seq-badge') || e.target.classList.contains('beat-status') || e.target.classList.contains('beat-version') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.stopPropagation();

      const now = Date.now();
      if (engine.current.lastClickBeatId === id && now - engine.current.lastClickTime < 350) {
          onEditBeat(id);
          engine.current.lastClickBeatId = null;
          engine.current.lastClickTime = 0;
          return;
      }
      engine.current.lastClickBeatId = id;
      engine.current.lastClickTime = now;

      engine.current.selectedAnnoId = null;
      if (e.ctrlKey || e.metaKey) {
          if (engine.current.selectedBeatIds.has(id)) engine.current.selectedBeatIds.delete(id);
          else engine.current.selectedBeatIds.add(id);
          renderBeats(); renderConnections(); return;
      } else {
          if (!engine.current.selectedBeatIds.has(id)) { engine.current.selectedBeatIds.clear(); engine.current.selectedBeatIds.add(id); engine.current.selectedAnnoId = null; renderBeats(); renderConnections(); }
      }
      engine.current.dragTarget = id; engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX; engine.current.lastMouseY = e.clientY;
      minimapContainerRef.current?.classList.add('active');
  };

  const onGroupHeaderMouseDown = (e: MouseEvent, id: number) => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      const group = engine.current.groups.find(g => g.id === id);
      if (!group) return;
      engine.current.dragGroupTarget = id; engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX; engine.current.lastMouseY = e.clientY;
      minimapContainerRef.current?.classList.add('active'); 
      engine.current.selectedBeatIds.clear();
      engine.current.selectedAnnoId = null;
      engine.current.dragGroupChildIds.clear();
      engine.current.beats.forEach(b => {
          const bx = b.x + 100; const by = b.y + 60;
          if (bx >= group.x && bx <= group.x + group.width && by >= group.y && by <= group.y + group.height) engine.current.selectedBeatIds.add(b.id);
      });
      engine.current.groups.forEach(g => {
          if (g.id === id) return;
          if (g.x >= group.x && g.y >= group.y && g.x + g.width <= group.x + group.width && g.y + g.height <= group.y + group.height) engine.current.dragGroupChildIds.add(g.id);
      });
      renderBeats();
      renderConnections();
  };

  const onGroupResizeMouseDown = (e: MouseEvent, id: number) => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      engine.current.groupResizeTarget = id; engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX; engine.current.lastMouseY = e.clientY;
      minimapContainerRef.current?.classList.add('active');
  };

  const onLinkHandleMouseDown = (e: MouseEvent, sourceId: number) => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      e.stopPropagation(); captureSnapshot();
      engine.current.isLinking = true; engine.current.linkingSourceId = sourceId; engine.current.relinkData = null; 
      containerRef.current?.querySelector('#connections-layer')?.classList.add('linking-mode');
      updateTempLinkPos(e); renderBeats(); 
  };

  const handleTextMouseDown = (e: React.MouseEvent, id: number) => {
      if (editingAnnoId === id) return;
      if (toolMode === 'text' || toolMode === 'bigtext') { e.stopPropagation(); setEditingAnnoId(id); setToolMode('none'); return; }
      if (toolMode !== 'none') return;
      e.stopPropagation();
      engine.current.selectedAnnoId = id;
      engine.current.selectedBeatIds.clear();
      renderBeats();
      renderConnections();
      engine.current.dragAnnotationId = id; engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX; engine.current.lastMouseY = e.clientY;
  };

  const handleTextDoubleClick = (e: React.MouseEvent, id: number) => {
      if (toolMode !== 'none') return;
      e.stopPropagation(); setEditingAnnoId(id);
  };

  const updateTextContent = (id: number, text: string) => {
      const anno = engine.current.annotations.find(a => a.id === id);
      if (anno) {
          anno.text = text;
      }
  };

  const showContextMenu = (clientX: number, clientY: number, beatId: number | null, linkIndex: number | null, groupId: number | null, annotationId: number | null) => {
      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const { x: worldX, y: worldY } = getSvgPoint({ clientX, clientY } as MouseEvent);
          setCtxMenu({ x: clientX - rect.left, y: clientY - rect.top, worldX, worldY, beatId, linkIndex, groupId, annotationId });
      }
  };

  const hideContextMenu = () => { setCtxMenu(null); setFixMenu(null); };

  const handleDelete = () => {
      captureSnapshot();
      if (engine.current.selectedBeatIds.size > 0) {
          const toDelete = Array.from(engine.current.selectedBeatIds);
          const newBeats = beats.filter(b => !toDelete.includes(b.id));
          const newConns = connections.filter(c => !toDelete.includes(c.from) && !toDelete.includes(c.to));
          setBeats(newBeats);
          setConnections(newConns);
          engine.current.beats = engine.current.beats.filter(b => !toDelete.includes(b.id));
          engine.current.connections = engine.current.connections.filter(c => !toDelete.includes(c.from) && !toDelete.includes(c.to));
          engine.current.selectedBeatIds.clear();
          renderBeats();
          renderConnections();
      } else if (engine.current.selectedConnIndex !== null && engine.current.selectedConnIndex !== undefined) {
          const filteredConns = connections.filter(c => (c.boardId || 0) === activeBoardId);
          const targetConn = filteredConns[engine.current.selectedConnIndex];
          if (targetConn) {
              const newConns = connections.filter(c => c !== targetConn);
              setConnections(newConns);
              engine.current.connections = engine.current.connections.filter(c => c !== targetConn);
              engine.current.selectedConnIndex = null;
              renderConnections();
          }
      } else if (engine.current.selectedAnnoId !== null) {
          deleteAnnotation(engine.current.selectedAnnoId);
          engine.current.selectedAnnoId = null;
      } else if (ctxMenu) {
          if (ctxMenu.beatId !== null && ctxMenu.beatId !== undefined) {
              const toDelete = [ctxMenu.beatId];
              setBeats(beats.filter(b => !toDelete.includes(b.id)));
              setConnections(connections.filter(c => !toDelete.includes(c.from) && !toDelete.includes(c.to)));
              engine.current.beats = engine.current.beats.filter(b => !toDelete.includes(b.id));
              engine.current.connections = engine.current.connections.filter(c => !toDelete.includes(c.from) && !toDelete.includes(c.to));
              renderBeats();
              renderConnections();
          } else if (ctxMenu.linkIndex !== null && ctxMenu.linkIndex !== undefined) {
              const filteredConns = connections.filter(c => (c.boardId || 0) === activeBoardId);
              const targetConn = filteredConns[ctxMenu.linkIndex];
              if (targetConn) {
                  const newConns = connections.filter(c => c !== targetConn);
                  setConnections(newConns);
                  engine.current.connections = engine.current.connections.filter(c => c !== targetConn);
                  engine.current.selectedConnIndex = null;
                  renderConnections();
              }
          } else if (ctxMenu.groupId !== null && ctxMenu.groupId !== undefined) {
              removeGroup(ctxMenu.groupId);
          } else if (ctxMenu.annotationId !== null && ctxMenu.annotationId !== undefined) {
              deleteAnnotation(ctxMenu.annotationId);
          }
      }
      hideContextMenu();
  };

  const handleConnectSelectedBeats = () => {
      const selected = beats
          .filter(b => engine.current.selectedBeatIds.has(b.id) && (b.boardId || 0) === activeBoardId)
          .sort((a, b) => a.x - b.x || a.y - b.y);

      if (selected.length < 2) return;
      captureSnapshot();

      const newConns = [...connections];
      for (let i = 0; i < selected.length - 1; i++) {
          const fromId = selected[i].id;
          const toId = selected[i + 1].id;
          const exists = newConns.some(c => c.from === fromId && c.to === toId && (c.boardId || 0) === activeBoardId);
          if (!exists) {
              const conn = { from: fromId, to: toId, boardId: activeBoardId };
              newConns.push(conn);
              engine.current.connections.push(conn);
          }
      }
      setConnections(newConns);
      renderConnections();
      hideContextMenu();
  };

  const handleCopy = () => {
    const toCopy = beats.filter(b => engine.current.selectedBeatIds.has(b.id));
    if (toCopy.length > 0) {
      setClipboard(JSON.parse(JSON.stringify(toCopy)));
    }
    hideContextMenu();
  };

  const handleDuplicate = () => {
    const targets = engine.current.selectedBeatIds.size > 0 
        ? Array.from(engine.current.selectedBeatIds) 
        : (ctxMenu?.beatId !== null && ctxMenu?.beatId !== undefined ? [ctxMenu.beatId] : []);
    
    if (targets.length === 0) return;
    captureSnapshot();

    const toClone = beats.filter(b => targets.includes(b.id));
    let startId = nextId;
    
    const clones = toClone.map((b, i) => ({
      ...JSON.parse(JSON.stringify(b)),
      id: startId + i,
      x: b.x + 40,
      y: b.y + 40,
      boardId: activeBoardId
    }));

    setNextId(prev => prev + clones.length);
    setBeats(prev => [...prev, ...clones]);
    
    engine.current.selectedBeatIds.clear();
    clones.forEach(c => engine.current.selectedBeatIds.add(c.id));
    
    hideContextMenu();
    renderBeats();
  };

  const handlePaste = () => {
    if (clipboard.length === 0 || !ctxMenu) return;
    captureSnapshot();

    let minX = Infinity, minY = Infinity;
    clipboard.forEach(b => {
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
    });

    let startId = nextId;
    const pasted = clipboard.map((b, i) => ({
      ...JSON.parse(JSON.stringify(b)),
      id: startId + i,
      x: ctxMenu.worldX + (b.x - minX),
      y: ctxMenu.worldY + (b.y - minY),
      boardId: activeBoardId
    }));

    setNextId(prev => prev + pasted.length);
    setBeats(prev => [...prev, ...pasted]);

    engine.current.selectedBeatIds.clear();
    pasted.forEach(p => engine.current.selectedBeatIds.add(p.id));

    hideContextMenu();
    renderBeats();
  };

  const handleColor = (color: string, type: 'chain' | 'tint' | 'group') => {
      captureSnapshot();
      if (type === 'group' && ctxMenu?.groupId) { updateGroup(ctxMenu.groupId, { color }); } 
      else if (ctxMenu?.beatId !== null && ctxMenu?.beatId !== undefined) {
          const targets = engine.current.selectedBeatIds.size > 0 ? Array.from(engine.current.selectedBeatIds) : [ctxMenu.beatId!];
          if (type === 'tint') setBeats(beats.map(b => targets.includes(b.id) ? { ...b, tint: color } : b));
          else setBeats(beats.map(b => targets.includes(b.id) ? { ...b, color: color } : b));
      }
      hideContextMenu();
  };

  const handleStatus = (status: BeatStatus) => {
      captureSnapshot();
      if (ctxMenu?.beatId !== null && ctxMenu?.beatId !== undefined) {
          const targets = engine.current.selectedBeatIds.size > 0 ? Array.from(engine.current.selectedBeatIds) : [ctxMenu.beatId!];
          setBeats(beats.map(b => targets.includes(b.id) ? { ...b, status: status } : b));
      }
      hideContextMenu();
  };

  const handleCreateGroup = () => {
      if (engine.current.selectedBeatIds.size < 1) return;
      captureSnapshot();
      const currentBoardBeats = beats.filter(b => engine.current.selectedBeatIds.has(b.id));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      currentBoardBeats.forEach(b => {
          if(b.x < minX) minX = b.x; if(b.y < minY) minY = b.y;
          if(b.x + 200 > maxX) maxX = b.x + 200; if(b.y + 120 > maxY) maxY = b.y + 120;
      });
      const padding = 40;
      addGroup({ title: 'New Sequence', x: minX - padding, y: minY - padding - 24, width: (maxX - minX) + (padding * 2), height: (maxY - minY) + (padding * 2) + 24, color: '#f5a623' });
      engine.current.selectedBeatIds.clear(); hideContextMenu();
  };

  const handleAddToSequence = (targetGroupId?: number) => {
      const selectedIds = Array.from(engine.current.selectedBeatIds);
      if (selectedIds.length === 0 && ctxMenu?.beatId !== null && ctxMenu?.beatId !== undefined) {
          selectedIds.push(ctxMenu.beatId);
      }
      if (selectedIds.length === 0) return;

      captureSnapshot();

      const boardGroups = groups.filter(g => (g.boardId || 0) === activeBoardId);
      if (boardGroups.length === 0) {
          handleCreateGroup();
          return;
      }

      let groupToUpdate = boardGroups.find(g => g.id === targetGroupId);
      if (!groupToUpdate) {
          if (ctxMenu?.groupId) {
              groupToUpdate = boardGroups.find(g => g.id === ctxMenu.groupId);
          } else {
              const selectedBeats = beats.filter(b => selectedIds.includes(b.id));
              let avgX = 0, avgY = 0;
              selectedBeats.forEach(b => { avgX += b.x; avgY += b.y; });
              if (selectedBeats.length > 0) {
                  avgX /= selectedBeats.length;
                  avgY /= selectedBeats.length;
              }

              let minDist = Infinity;
              boardGroups.forEach(g => {
                  const gCenterX = g.x + g.width / 2;
                  const gCenterY = g.y + g.height / 2;
                  const dist = Math.hypot(gCenterX - avgX, gCenterY - avgY);
                  if (dist < minDist) {
                      minDist = dist;
                      groupToUpdate = g;
                  }
              });
          }
      }

      if (!groupToUpdate) return;

      const currentBeatsInGroup = beats.filter(b => {
          const cx = b.x + 100;
          const cy = b.y + 60;
          return cx >= groupToUpdate!.x && cx <= groupToUpdate!.x + groupToUpdate!.width &&
                 cy >= groupToUpdate!.y && cy <= groupToUpdate!.y + groupToUpdate!.height;
      });

      const allGroupBeats = Array.from(new Set([...currentBeatsInGroup.map(b => b.id), ...selectedIds]))
          .map(id => beats.find(b => b.id === id))
          .filter((b): b is Beat => b !== undefined);

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      allGroupBeats.forEach(b => {
          if (b.x < minX) minX = b.x;
          if (b.y < minY) minY = b.y;
          if (b.x + 200 > maxX) maxX = b.x + 200;
          if (b.y + 120 > maxY) maxY = b.y + 120;
      });

      const pad = 35;
      updateGroup(groupToUpdate.id, {
          x: minX - pad,
          y: minY - pad - 24,
          width: (maxX - minX) + (pad * 2),
          height: (maxY - minY) + (pad * 2) + 24
      });

      hideContextMenu();
  };

  const createFilmSketches = (
    x: number, 
    y: number, 
    type: 'camera' | 'character' | 'slate' | 'viewfinder' | 'spotlight', 
    color: string, 
    boardId: number, 
    startId: number
  ): Annotation[] => {
    const annos: Annotation[] = [];
    let id = startId;

    if (type === 'camera') {
      // Camera body box
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x, y: y }, { x: x + 34, y: y }, { x: x + 34, y: y + 22 }, { x: x, y: y + 22 }, { x: x, y: y }],
        color, strokeWidth: 2, boardId
      });
      // Reels
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 8, y: y - 6 }, { x: x + 14, y: y - 2 }, { x: x + 8, y: y + 2 }, { x: x + 2, y: y - 2 }, { x: x + 8, y: y - 6 }],
        color, strokeWidth: 1.5, boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 24, y: y - 6 }, { x: x + 30, y: y - 2 }, { x: x + 24, y: y + 2 }, { x: x + 18, y: y - 2 }, { x: x + 24, y: y - 6 }],
        color, strokeWidth: 1.5, boardId
      });
      // Lens box & cone
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 34, y: y + 5 }, { x: x + 48, y: y + 1 }, { x: x + 48, y: y + 21 }, { x: x + 34, y: y + 17 }, { x: x + 34, y: y + 5 }],
        color, strokeWidth: 2, boardId
      });
      // Sight rays
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 48, y: y + 1 }, { x: x + 72, y: y - 8 }],
        color, strokeWidth: 1.5, strokeStyle: 'dashed', boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 48, y: y + 21 }, { x: x + 72, y: y + 30 }],
        color, strokeWidth: 1.5, strokeStyle: 'dashed', boardId
      });
      // Tripod legs
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 17, y: y + 22 }, { x: x + 4, y: y + 44 }],
        color, strokeWidth: 2, boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 17, y: y + 22 }, { x: x + 17, y: y + 46 }],
        color, strokeWidth: 2, boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 17, y: y + 22 }, { x: x + 30, y: y + 44 }],
        color, strokeWidth: 2, boardId
      });
    } else if (type === 'character') {
      // Head
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 10, y: y }, { x: x + 18, y: y - 8 }, { x: x + 26, y: y }, { x: x + 18, y: y + 8 }, { x: x + 10, y: y }],
        color, strokeWidth: 2, boardId
      });
      // Torso
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 18, y: y + 8 }, { x: x + 18, y: y + 32 }],
        color, strokeWidth: 2, boardId
      });
      // Arms
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 4, y: y + 22 }, { x: x + 18, y: y + 16 }, { x: x + 32, y: y + 22 }],
        color, strokeWidth: 2, boardId
      });
      // Legs
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 18, y: y + 32 }, { x: x + 6, y: y + 52 }],
        color, strokeWidth: 2, boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 18, y: y + 32 }, { x: x + 30, y: y + 52 }],
        color, strokeWidth: 2, boardId
      });
    } else if (type === 'slate') {
      // Slate board body
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x, y: y }, { x: x + 44, y: y }, { x: x + 44, y: y + 28 }, { x: x, y: y + 28 }, { x: x, y: y }],
        color, strokeWidth: 2, boardId
      });
      // Clapper top angled bar
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x, y: y }, { x: x + 44, y: y - 12 }, { x: x + 44, y: y - 4 }, { x: x, y: y + 8 }, { x: x, y: y }],
        color, strokeWidth: 2, boardId
      });
      // Diagonal stripes on clapper
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 10, y: y + 6 }, { x: x + 16, y: y - 8 }],
        color, strokeWidth: 1.5, boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 22, y: y + 4 }, { x: x + 28, y: y - 10 }],
        color, strokeWidth: 1.5, boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 34, y: y + 2 }, { x: x + 40, y: y - 12 }],
        color, strokeWidth: 1.5, boardId
      });
    } else if (type === 'viewfinder') {
      // Outer 16:9 viewport sketch
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x, y: y }, { x: x + 130, y: y }, { x: x + 130, y: y + 75 }, { x: x, y: y + 75 }, { x: x, y: y }],
        color, strokeWidth: 2, boardId
      });
      // Corner brackets
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 10, y: y + 22 }, { x: x + 10, y: y + 10 }, { x: x + 24, y: y + 10 }],
        color, strokeWidth: 1.5, boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 106, y: y + 10 }, { x: x + 120, y: y + 10 }, { x: x + 120, y: y + 22 }],
        color, strokeWidth: 1.5, boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 10, y: y + 53 }, { x: x + 10, y: y + 65 }, { x: x + 24, y: y + 65 }],
        color, strokeWidth: 1.5, boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 106, y: y + 65 }, { x: x + 120, y: y + 65 }, { x: x + 120, y: y + 53 }],
        color, strokeWidth: 1.5, boardId
      });
      // Center crosshair
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 60, y: y + 37.5 }, { x: x + 70, y: y + 37.5 }],
        color, strokeWidth: 1.5, boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 65, y: y + 32.5 }, { x: x + 65, y: y + 42.5 }],
        color, strokeWidth: 1.5, strokeStyle: 'solid', boardId
      });
    } else if (type === 'spotlight') {
      // Lamp housing
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x, y: y }, { x: x + 20, y: y - 6 }, { x: x + 20, y: y + 18 }, { x: x, y: y + 12 }, { x: x, y: y }],
        color, strokeWidth: 2, boardId
      });
      // Rays
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 20, y: y - 6 }, { x: x + 85, y: y - 28 }],
        color, strokeWidth: 1.5, strokeStyle: 'dashed', boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 20, y: y + 6 }, { x: x + 90, y: y + 6 }],
        color, strokeWidth: 1.5, strokeStyle: 'dashed', boardId
      });
      annos.push({
        id: id++,
        type: 'pencil',
        points: [{ x: x + 20, y: y + 18 }, { x: x + 85, y: y + 40 }],
        color, strokeWidth: 1.5, strokeStyle: 'dashed', boardId
      });
    }

    return annos;
  };

  const handleAIBeautifyBoard = async () => {
      return;
      const boardBeats = beats.filter(b => (b.boardId || 0) === activeBoardId);
      if (boardBeats.length === 0) {
          alert("No beats on current board to beautify! Double-click anywhere on the board to create a beat.");
          return;
      }

      setIsBeautifying(true);
      captureSnapshot();

      try {
          let beatOrderMap: Record<number, { row: number, col: number }> = {};
          let suggestedGroups: { title: string, beatIds: number[], color: string }[] = [];
          let suggestedAnnotations: { type: 'bigtext' | 'text' | 'rect' | 'circle' | 'arrow' | 'line' | 'pencil', text?: string, relBeatId?: number, color?: string }[] = [];

          const boardConns = connections.filter(c => (c.boardId || 0) === activeBoardId);
          const outEdge: Record<number, number[]> = {};
          const inEdge: Record<number, number[]> = {};
          boardBeats.forEach(b => { outEdge[b.id] = []; inEdge[b.id] = []; });
          boardConns.forEach(c => {
              if (outEdge[c.from]) outEdge[c.from].push(c.to);
              if (inEdge[c.to]) inEdge[c.to].push(c.from);
          });

          try {
              const beatSummaries = boardBeats.map(b => ({
                  id: b.id,
                  title: b.title || 'Untitled',
                  sceneNumber: b.sceneNumber || '',
                  summary: (b.summary || '').substring(0, 120)
              }));

              const prompt = `You are a professional Hollywood script doctor, story artist, and creative layout designer. Analyze these screenplay beats and arrange them into a beautifully spaced out, sequence-organized storyboard board layout.

Group related beats into story acts/sequences (e.g. "ACT I: SETUP", "ACT II: CONFRONTATION", "ACT III: CLIMAX").
Provide script insight annotations (e.g. Act Headings, Theme callouts, Plot turning points).
Suggest visual sketch annotations using shapes or pen tools (e.g. 'circle' for emotional focal scenes, 'rect' for camera/action framing, 'arrow' for plot momentum).

Return ONLY raw valid JSON:
{
  "groups": [ { "title": string, "beatIds": number[], "color": string } ],
  "positions": [ { "id": number, "row": number, "col": number } ],
  "annotations": [
    { "type": "bigtext" | "text" | "rect" | "circle" | "arrow", "text": string, "relBeatId": number, "color": string }
  ]
}

Beats: ${JSON.stringify(beatSummaries)}
Connections: ${JSON.stringify(boardConns.map(c => ({ from: c.from, to: c.to })))}`;

              const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
              const response = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: prompt,
                  config: { responseMimeType: 'application/json' }
              });

              const resText = response.text || '{}';
              const parsed = JSON.parse(resText.replace(/```json/gi, '').replace(/```/g, '').trim());

              if (parsed && Array.isArray(parsed.positions)) {
                  parsed.positions.forEach((p: any) => {
                      if (p && typeof p.id === 'number') {
                          beatOrderMap[p.id] = { row: p.row ?? 0, col: p.col ?? 0 };
                      }
                  });
              }
              if (parsed && Array.isArray(parsed.groups)) {
                  suggestedGroups = parsed.groups;
              }
              if (parsed && Array.isArray(parsed.annotations)) {
                  suggestedAnnotations = parsed.annotations;
              }
          } catch (geminiErr) {
              console.warn("AI layout prompt failed, using algorithmic beautification layout:", geminiErr);
          }

          const visited = new Set<number>();
          let currentRow = 0;
          const finalPositions: Record<number, { x: number, y: number }> = {};
          const startX = 25000;
          const startY = 25000;
          const COL_WIDTH = 440;
          const ROW_HEIGHT = 320;

          const processChain = (rootId: number, rowIdx: number) => {
              let colIdx = 0;
              let curr: number | undefined = rootId;
              while (curr !== undefined && !visited.has(curr)) {
                  visited.add(curr);
                  const gPos = beatOrderMap[curr];
                  const r = gPos?.row ?? rowIdx;
                  const c = gPos?.col ?? colIdx;
                  finalPositions[curr] = {
                      x: startX + c * COL_WIDTH,
                      y: startY + r * ROW_HEIGHT
                  };
                  colIdx++;
                  const nextCandidates = outEdge[curr]?.filter(id => !visited.has(id)) || [];
                  curr = nextCandidates[0];
              }
          };

          boardBeats.forEach(b => {
              if ((inEdge[b.id]?.length || 0) === 0 && (outEdge[b.id]?.length || 0) > 0 && !visited.has(b.id)) {
                  processChain(b.id, currentRow);
                  currentRow++;
              }
          });

          boardBeats.forEach(b => {
              if ((outEdge[b.id]?.length || 0) > 0 && !visited.has(b.id)) {
                  processChain(b.id, currentRow);
                  currentRow++;
              }
          });

          let unconnCol = 0;
          boardBeats.forEach(b => {
              if (!visited.has(b.id)) {
                  visited.add(b.id);
                  const gPos = beatOrderMap[b.id];
                  const r = gPos?.row ?? currentRow;
                  const c = gPos?.col ?? unconnCol;
                  finalPositions[b.id] = {
                      x: startX + c * COL_WIDTH,
                      y: startY + r * ROW_HEIGHT
                  };
                  unconnCol++;
              }
          });

          const updatedBeats = beats.map(b => {
              if ((b.boardId || 0) === activeBoardId && finalPositions[b.id]) {
                  return { ...b, x: finalPositions[b.id].x, y: finalPositions[b.id].y };
              }
              return b;
          });

          let newGroupsList = [...groups];

          if (suggestedGroups.length > 0) {
              newGroupsList = newGroupsList.filter(g => (g.boardId || 0) !== activeBoardId);
              suggestedGroups.forEach((sg, gIdx) => {
                  const memberBeats = updatedBeats.filter(b => sg.beatIds.includes(b.id));
                  if (memberBeats.length > 0) {
                      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                      memberBeats.forEach(mb => {
                          if (mb.x < minX) minX = mb.x;
                          if (mb.y < minY) minY = mb.y;
                          if (mb.x + 200 > maxX) maxX = mb.x + 200;
                          if (mb.y + 120 > maxY) maxY = mb.y + 120;
                      });
                      const pad = 45;
                      newGroupsList.push({
                          id: Date.now() + gIdx,
                          title: sg.title || `Sequence ${gIdx + 1}`,
                          x: minX - pad,
                          y: minY - pad - 28,
                          width: (maxX - minX) + (pad * 2),
                          height: (maxY - minY) + (pad * 2) + 28,
                          color: ensureVibrantLightColor(sg.color, STORYLINE_COLORS[gIdx % STORYLINE_COLORS.length]),
                          boardId: activeBoardId
                      });
                  }
              });
          } else {
              newGroupsList = newGroupsList.map(g => {
                  if ((g.boardId || 0) === activeBoardId) {
                      const enclosed = updatedBeats.filter(b => {
                          const centerBeatX = b.x + 100;
                          const centerBeatY = b.y + 60;
                          return centerBeatX >= g.x - 50 && centerBeatX <= g.x + g.width + 50 &&
                                 centerBeatY >= g.y - 50 && centerBeatY <= g.y + g.height + 50;
                      });
                      if (enclosed.length > 0) {
                          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                          enclosed.forEach(mb => {
                              if (mb.x < minX) minX = mb.x;
                              if (mb.y < minY) minY = mb.y;
                              if (mb.x + 200 > maxX) maxX = mb.x + 200;
                              if (mb.y + 120 > maxY) maxY = mb.y + 120;
                          });
                          const pad = 45;
                          return {
                              ...g,
                              x: minX - pad,
                              y: minY - pad - 28,
                              width: (maxX - minX) + (pad * 2),
                              height: (maxY - minY) + (pad * 2) + 28
                          };
                      }
                  }
                  return g;
              });
          }

          // Create script and drawing annotations on board
          const newAnnos = annotations.filter(a => (a.boardId || 0) !== activeBoardId);
          let annoIdCounter = Date.now();

          // 1. Add headers and decorative underline accents for sequence groups
          const activeGroups = newGroupsList.filter(g => (g.boardId || 0) === activeBoardId);
          activeGroups.forEach(g => {
              const vibrantColor = ensureVibrantLightColor(g.color, '#f5a623');
              // Big text header
              newAnnos.push({
                  id: annoIdCounter++,
                  type: 'bigtext',
                  text: g.title.toUpperCase(),
                  x: g.x,
                  y: g.y - 45,
                  color: vibrantColor,
                  boardId: activeBoardId
              });

              // Underline line annotation right beneath the heading
              newAnnos.push({
                  id: annoIdCounter++,
                  type: 'line',
                  x: g.x,
                  y: g.y - 10,
                  w: Math.min(280, g.width - 20),
                  h: 0,
                  color: vibrantColor,
                  strokeWidth: 3,
                  boardId: activeBoardId
              });
          });

          // 2. Generate smooth Story Arc Pen Drawings (Pencil tool paths) across sequence beats in the top/bottom gap
          activeGroups.forEach(g => {
              const groupBeats = updatedBeats.filter(b => {
                  const cx = b.x + 100; const cy = b.y + 60;
                  return cx >= g.x && cx <= g.x + g.width && cy >= g.y && cy <= g.y + g.height;
              });

              if (groupBeats.length >= 2) {
                  let minX = Math.min(...groupBeats.map(b => b.x)) - 10;
                  let maxX = Math.max(...groupBeats.map(b => b.x + 200)) + 10;
                  let topY = Math.min(...groupBeats.map(b => b.y)) - 25;
                  
                  // Sine wave story arc curve drawn with Pen tool
                  const arcPoints: { x: number, y: number }[] = [];
                  const steps = 24;
                  for (let s = 0; s <= steps; s++) {
                      const px = minX + (s / steps) * (maxX - minX);
                      const py = topY - Math.sin((s / steps) * Math.PI) * 32;
                      arcPoints.push({ x: px, y: py });
                  }

                  newAnnos.push({
                      id: annoIdCounter++,
                      type: 'pencil',
                      points: arcPoints,
                      color: ensureVibrantLightColor(g.color, '#38bdf8'),
                      strokeWidth: 3,
                      strokeStyle: 'solid',
                      boardId: activeBoardId
                  });
              }

              // Highlight key scene in sequence with a camera framing box or focal point circle
              if (groupBeats.length > 0) {
                  const focalBeat = groupBeats[0];
                  // Camera / Shot framing box
                  newAnnos.push({
                      id: annoIdCounter++,
                      type: 'rect',
                      x: focalBeat.x - 12,
                      y: focalBeat.y - 12,
                      w: 224,
                      h: 144,
                      color: '#f5a623',
                      strokeWidth: 2,
                      strokeStyle: 'dashed',
                      boardId: activeBoardId
                  });

                  // Add Director Clapper Slate sketch at top left of sequence header
                  const slateAnnos = createFilmSketches(g.x - 55, g.y - 45, 'slate', ensureVibrantLightColor(g.color, '#f5a623'), activeBoardId, annoIdCounter);
                  annoIdCounter += slateAnnos.length + 5;
                  newAnnos.push(...slateAnnos);

                  // Add Camera sketch beside the first beat
                  const cameraAnnos = createFilmSketches(focalBeat.x - 85, focalBeat.y + 15, 'camera', '#f5a623', activeBoardId, annoIdCounter);
                  annoIdCounter += cameraAnnos.length + 5;
                  newAnnos.push(...cameraAnnos);

                  // Add Character blocking sketch beside second beat (or beneath first)
                  const charX = groupBeats.length > 1 ? groupBeats[1].x - 65 : focalBeat.x + 225;
                  const charY = groupBeats.length > 1 ? groupBeats[1].y + 15 : focalBeat.y + 10;
                  const charAnnos = createFilmSketches(charX, charY, 'character', '#38bdf8', activeBoardId, annoIdCounter);
                  annoIdCounter += charAnnos.length + 5;
                  newAnnos.push(...charAnnos);

                  // Add Viewfinder sketch on third beat
                  if (groupBeats.length > 2) {
                      const b2 = groupBeats[2];
                      const vfAnnos = createFilmSketches(b2.x + 35, b2.y + 130, 'viewfinder', '#a855f7', activeBoardId, annoIdCounter);
                      annoIdCounter += vfAnnos.length + 5;
                      newAnnos.push(...vfAnnos);
                  } else {
                      // Add Spotlight beam sketch on first beat bottom right
                      const spotAnnos = createFilmSketches(focalBeat.x + 220, focalBeat.y + 90, 'spotlight', '#ef4444', activeBoardId, annoIdCounter);
                      annoIdCounter += spotAnnos.length + 5;
                      newAnnos.push(...spotAnnos);
                  }
              }
          });

          // 3. Directional Momentum Arrows in the gaps between connected beats
          boardConns.forEach(conn => {
              const fromB = updatedBeats.find(b => b.id === conn.from);
              const toB = updatedBeats.find(b => b.id === conn.to);
              if (fromB && toB) {
                  const gap = toB.x - (fromB.x + 200);
                  // If there is a generous horizontal gap, draw a flow momentum arrow
                  if (gap >= 120 && Math.abs(fromB.y - toB.y) < 80) {
                      newAnnos.push({
                          id: annoIdCounter++,
                          type: 'arrow',
                          x: fromB.x + 215,
                          y: fromB.y + 60,
                          w: gap - 30,
                          h: 0,
                          color: '#a855f7',
                          strokeWidth: 2,
                          strokeStyle: 'dashed',
                          boardId: activeBoardId
                      });
                  }
              }
          });

          // 4. Add suggested thematic script callouts and visual shape annotations from Gemini
          suggestedAnnotations.forEach(sa => {
              const targetBeat = updatedBeats.find(b => b.id === sa.relBeatId);
              if (targetBeat) {
                  const color = ensureVibrantLightColor(sa.color, '#38bdf8');
                  if (sa.type === 'circle') {
                      newAnnos.push({
                          id: annoIdCounter++,
                          type: 'circle',
                          cx: targetBeat.x + 100,
                          cy: targetBeat.y + 60,
                          rx: 130,
                          ry: 90,
                          color: color,
                          strokeWidth: 2,
                          strokeStyle: 'dashed',
                          boardId: activeBoardId
                      });
                  } else if (sa.type === 'rect') {
                      newAnnos.push({
                          id: annoIdCounter++,
                          type: 'rect',
                          x: targetBeat.x - 16,
                          y: targetBeat.y - 16,
                          w: 232,
                          h: 152,
                          color: color,
                          strokeWidth: 2,
                          strokeStyle: 'solid',
                          boardId: activeBoardId
                      });
                  } else if (sa.type === 'arrow') {
                      newAnnos.push({
                          id: annoIdCounter++,
                          type: 'arrow',
                          x: targetBeat.x + 210,
                          y: targetBeat.y + 60,
                          w: 160,
                          h: 0,
                          color: color,
                          strokeWidth: 2.5,
                          boardId: activeBoardId
                      });
                  } else {
                      // Text insight annotation
                      newAnnos.push({
                          id: annoIdCounter++,
                          type: sa.type === 'bigtext' ? 'bigtext' : 'text',
                          text: sa.text || 'Script Callout',
                          x: targetBeat.x,
                          y: targetBeat.y + 135,
                          color: color,
                          boardId: activeBoardId
                      });
                  }
              }
          });

          setBeats(updatedBeats);
          setGroups(newGroupsList);
          setAnnotations(newAnnos);
          engine.current.beats = updatedBeats;
          engine.current.groups = newGroupsList;
          engine.current.annotations = newAnnos;

          renderBeats();
          renderGroups();
          renderConnections();
          renderText();
          renderMinimap();

          setTimeout(() => {
              handleFitView();
          }, 100);

      } catch (err) {
          console.error("AI Beautify Board Error:", err);
      } finally {
          setIsBeautifying(false);
      }
  };

  const getStatusAction = () => {
      if (ctxMenu?.beatId === null && engine.current.selectedBeatIds.size === 0) return null;
      const targets = engine.current.selectedBeatIds.size > 0 ? Array.from(engine.current.selectedBeatIds) : (ctxMenu?.beatId !== null && ctxMenu?.beatId !== undefined ? [ctxMenu.beatId] : []);
      const allReady = targets.every(tid => beats.find(b => b.id === tid)?.status === 'ready');
      return allReady ? { label: 'Mark W.I.P.', status: 'not-ready' as BeatStatus, color: '#f5a623' } : { label: 'Mark Ready', status: 'ready' as BeatStatus, color: '#4caf50' };
  };

  const statusAction = getStatusAction();
  const handleDragEnter = useCallback((e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
      const { x, y } = getSvgPoint(e);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const files = Array.from(e.dataTransfer.files);
          for (const file of files) {
              if (file.type.startsWith('image/')) {
                  const reader = new FileReader();
                  reader.onload = (readerEvent) => {
                      const dataUrl = readerEvent.target?.result as string;
                      const newAnno: Annotation = {
                          id: Date.now() + Math.random(),
                          type: 'image',
                          x: x - 100,
                          y: y - 75,
                          w: 200,
                          h: 150,
                          color: '#ffffff',
                          imageUrl: dataUrl,
                          boardId: activeBoardId
                      };
                      captureSnapshot();
                      setAnnotations(prev => [...prev, newAnno]);
                  };
                  reader.readAsDataURL(file);
              }
          }
      }
  }, [captureSnapshot, activeBoardId, setAnnotations]);

  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const handleMouseDown = (e: MouseEvent) => {
          // @ts-ignore
          if (e.target.classList.contains('text-annotation-input')) return;
          if (editingAnnoId !== null) { setEditingAnnoId(null); captureSnapshot(); }
          // @ts-ignore
          const target = e.target as HTMLElement;
          if (target.closest('.zoom-controls') || target.closest('.drawing-toolbar-container') || target.closest('#context-menu') || target.closest('#fix-menu') || target.closest('.board-switcher') || target.closest('.scrub-timeline-container')) return;
          if (toolMode === 'none') {
              if (target.closest('.beat-card') || target.closest('.link-handle') || target.closest('.connection-handle') || target.closest('.handle-hit-area') || target.closest('.group-header') || target.closest('.group-resize-handle') || target.closest('.image-resize-handle') || target.closest('.annotation-hit-area') || target.closest('.text-annotation-card') || target.closest('.seq-badge') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
          }
          hideContextMenu();
          if (toolMode === 'eraser' && e.button === 0) {
              e.preventDefault();
              if (eraserCursorRef.current) {
                  eraserCursorRef.current.style.left = `${e.clientX}px`;
                  eraserCursorRef.current.style.top = `${e.clientY}px`;
              }
              const { x, y } = getSvgPoint(e);
              const targetAnno = engine.current.annotations.find(a => isPointNearAnnotation(x, y, a, 35));
              if (targetAnno) {
                  deleteAnnotation(targetAnno.id);
              }
              return;
          }

          if (toolMode === 'text' || toolMode === 'bigtext') {
              if (e.button !== 0) return;
              e.preventDefault();
              const { x, y } = getSvgPoint(e);
              const newAnno: Annotation = {
                  id: Date.now() + Math.random(),
                  type: toolMode === 'bigtext' ? 'bigtext' : 'text',
                  x,
                  y,
                  text: toolMode === 'bigtext' ? 'HEADING' : 'Note text...',
                  color: drawColor,
                  boardId: activeBoardId
              };
              captureSnapshot();
              setAnnotations(prev => [...prev, newAnno]);
              setEditingAnnoId(newAnno.id);
              setToolMode('none');
              return;
          }

          if (toolMode !== 'none') {
              if (e.button !== 0) return;
              e.preventDefault();
              const { x, y } = getSvgPoint(e);
              const newAnnoId = Date.now() + Math.random();
              engine.current.isDrawing = true;
              engine.current.drawStart = { x, y };
              engine.current.currentAnnoId = newAnnoId;
              engine.current.currentPoints = [{ x, y }];

              const newAnno: Annotation = {
                  id: newAnnoId,
                  type: toolMode,
                  x,
                  y,
                  w: 0,
                  h: 0,
                  points: [{ x, y }],
                  color: drawColor,
                  strokeWidth,
                  strokeStyle,
                  boardId: activeBoardId
              };
              captureSnapshot();
              setAnnotations(prev => [...prev, newAnno]);
              return;
          }

          if (isSpacePressedRef.current || e.button === 1) {
              engine.current.isPanning = true;
              engine.current.lastMouseX = e.clientX;
              engine.current.lastMouseY = e.clientY;
              if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
              return;
          }

          if (e.button === 0 && (toolMode === 'none' || e.shiftKey)) {
              if (e.shiftKey || (!target.closest('.beat-card') && !target.closest('.group-header') && !target.closest('.text-annotation-card'))) {
                  engine.current.isLassoing = true;
                  engine.current.hasLassoMoved = false;
                  engine.current.lassoStart = { x: e.clientX, y: e.clientY };
                  const lasso = container.querySelector('#selection-lasso') as HTMLElement;
                  if (lasso) {
                      lasso.style.left = `${e.clientX}px`;
                      lasso.style.top = `${e.clientY}px`;
                      lasso.style.width = '0px';
                      lasso.style.height = '0px';
                      lasso.style.display = 'block';
                  }
              }
          }
      };

      const handleMouseMove = (e: MouseEvent) => {
          if (eraserCursorRef.current && toolMode === 'eraser') {
              eraserCursorRef.current.style.left = `${e.clientX}px`;
              eraserCursorRef.current.style.top = `${e.clientY}px`;
              if (e.buttons === 1) {
                  const { x, y } = getSvgPoint(e);
                  const targetAnno = engine.current.annotations.find(a => isPointNearAnnotation(x, y, a, 35));
                  if (targetAnno) {
                      deleteAnnotation(targetAnno.id);
                  }
              }
          }

          if (engine.current.isScrubbing && engine.current.scrubBeatId !== null) {
              const deltaX = e.clientX - engine.current.scrubStartX;
              const step = Math.round(deltaX / 12);
              const newVal = Math.max(1, engine.current.scrubStartVal + step);
              engine.current.scrubCurrentVal = newVal;
              setScrubbingData(prev => prev ? { ...prev, currentVal: newVal } : null);
              const badgeEl = document.getElementById(`badge-${engine.current.scrubBeatId}`);
              if (badgeEl) badgeEl.innerText = newVal.toString();
          }

          if (engine.current.isDrawing && engine.current.currentAnnoId) {
              const { x, y } = getSvgPoint(e);
              if (toolMode === 'pencil') {
                  engine.current.currentPoints.push({ x, y });
                  setAnnotations(prev => prev.map(a => a.id === engine.current.currentAnnoId ? { ...a, points: [...engine.current.currentPoints] } : a));
              } else {
                  const startX = engine.current.drawStart.x;
                  const startY = engine.current.drawStart.y;
                  const w = x - startX;
                  const h = y - startY;
                  setAnnotations(prev => prev.map(a => a.id === engine.current.currentAnnoId ? { ...a, x: startX, y: startY, w, h } : a));
              }
          } else if (engine.current.isDragging) {
              const surface = containerRef.current?.querySelector('#canvas-surface');
              if (surface && !surface.classList.contains('is-dragging')) {
                  surface.classList.add('is-dragging');
              }

              const dx = (e.clientX - engine.current.lastMouseX) / engine.current.scale;
              const dy = (e.clientY - engine.current.lastMouseY) / engine.current.scale;
              engine.current.lastMouseX = e.clientX;
              engine.current.lastMouseY = e.clientY;

              if (engine.current.dragTarget !== null) {
                  const targets = engine.current.selectedBeatIds.has(engine.current.dragTarget)
                      ? engine.current.selectedBeatIds
                      : new Set([engine.current.dragTarget]);
                  engine.current.beats.forEach(b => {
                      if (targets.has(b.id)) {
                          b.x += dx;
                          b.y += dy;
                          const cardEl = container.querySelector(`.beat-card[data-id="${b.id}"]`) as HTMLElement;
                          if (cardEl) {
                              cardEl.style.left = `${b.x}px`;
                              cardEl.style.top = `${b.y}px`;
                          }
                      }
                  });
                  if (!connRafPendingRef.current) {
                      connRafPendingRef.current = true;
                      requestAnimationFrame(() => {
                          connRafPendingRef.current = false;
                          renderConnections();
                          renderMinimap();
                      });
                  }
              } else if (engine.current.dragGroupTarget !== null) {
                  const group = engine.current.groups.find(g => g.id === engine.current.dragGroupTarget);
                  if (group) {
                      group.x += dx;
                      group.y += dy;
                      const groupEl = container.querySelector(`.group-container[data-id="${group.id}"]`) as HTMLElement;
                      if (groupEl) {
                          groupEl.style.left = `${group.x}px`;
                          groupEl.style.top = `${group.y}px`;
                      }

                      engine.current.beats.forEach(b => {
                          if (engine.current.selectedBeatIds.has(b.id) || engine.current.dragGroupChildIds.has(b.id)) {
                              b.x += dx;
                              b.y += dy;
                              const cardEl = container.querySelector(`.beat-card[data-id="${b.id}"]`) as HTMLElement;
                              if (cardEl) {
                                  cardEl.style.left = `${b.x}px`;
                                  cardEl.style.top = `${b.y}px`;
                              }
                          }
                      });
                      engine.current.groups.forEach(g => {
                          if (engine.current.dragGroupChildIds.has(g.id)) {
                              g.x += dx;
                              g.y += dy;
                              const childGroupEl = container.querySelector(`.group-container[data-id="${g.id}"]`) as HTMLElement;
                              if (childGroupEl) {
                                  childGroupEl.style.left = `${g.x}px`;
                                  childGroupEl.style.top = `${g.y}px`;
                              }
                          }
                      });
                      if (!connRafPendingRef.current) {
                          connRafPendingRef.current = true;
                          requestAnimationFrame(() => {
                              connRafPendingRef.current = false;
                              renderConnections();
                              renderMinimap();
                          });
                      }
                  }
              } else if (engine.current.groupResizeTarget !== null) {
                  const group = engine.current.groups.find(g => g.id === engine.current.groupResizeTarget);
                  if (group) {
                      group.width = Math.max(120, group.width + dx);
                      group.height = Math.max(80, group.height + dy);
                      const groupEl = container.querySelector(`.group-container[data-id="${group.id}"]`) as HTMLElement;
                      if (groupEl) {
                          groupEl.style.width = `${group.width}px`;
                          groupEl.style.height = `${group.height}px`;
                      }
                      if (!connRafPendingRef.current) {
                          connRafPendingRef.current = true;
                          requestAnimationFrame(() => {
                              connRafPendingRef.current = false;
                              renderMinimap();
                          });
                      }
                  }
              } else if (engine.current.dragAnnotationId !== null) {
                  const anno = engine.current.annotations.find(a => a.id === engine.current.dragAnnotationId);
                  if (anno) {
                      if (anno.x !== undefined) anno.x += dx;
                      if (anno.y !== undefined) anno.y += dy;
                      if (anno.cx !== undefined) anno.cx += dx;
                      if (anno.cy !== undefined) anno.cy += dy;
                      if (anno.points && anno.points.length > 0) {
                          anno.points.forEach(p => { p.x += dx; p.y += dy; });
                      }
                      if (!connRafPendingRef.current) {
                          connRafPendingRef.current = true;
                          requestAnimationFrame(() => {
                              connRafPendingRef.current = false;
                              renderConnections();
                              renderText();
                          });
                      }
                  }
              } else if (engine.current.imageResizeTarget !== null) {
                  const target = engine.current.imageResizeTarget;
                  const anno = engine.current.annotations.find(a => a.id === target.id);
                  if (anno) {
                      const mouseDx = (e.clientX - target.startMouseX) / engine.current.scale;
                      const mouseDy = (e.clientY - target.startMouseY) / engine.current.scale;
                      let newW = target.startW;
                      let newH = target.startH;
                      let newX = target.startX;
                      let newY = target.startY;

                      if (target.corner === 'se') {
                          newW = Math.max(40, target.startW + mouseDx);
                          newH = Math.max(30, target.startH + mouseDy);
                      } else if (target.corner === 'sw') {
                          newW = Math.max(40, target.startW - mouseDx);
                          newX = target.startX + (target.startW - newW);
                          newH = Math.max(30, target.startH + mouseDy);
                      } else if (target.corner === 'ne') {
                          newW = Math.max(40, target.startW + mouseDx);
                          newH = Math.max(30, target.startH - mouseDy);
                          newY = target.startY + (target.startH - newH);
                      } else if (target.corner === 'nw') {
                          newW = Math.max(40, target.startW - mouseDx);
                          newX = target.startX + (target.startW - newW);
                          newH = Math.max(30, target.startH - mouseDy);
                          newY = target.startY + (target.startH - newH);
                      }
                      anno.x = newX;
                      anno.y = newY;
                      anno.w = newW;
                      anno.h = newH;
                      if (!connRafPendingRef.current) {
                          connRafPendingRef.current = true;
                          requestAnimationFrame(() => {
                              connRafPendingRef.current = false;
                              renderConnections();
                          });
                      }
                  }
              }
          } else if (engine.current.isPanning) {
              const surface = containerRef.current?.querySelector('#canvas-surface');
              if (surface && !surface.classList.contains('is-panning')) {
                  surface.classList.add('is-panning');
              }

              const dx = e.clientX - engine.current.lastMouseX;
              const dy = e.clientY - engine.current.lastMouseY;
              engine.current.lastMouseX = e.clientX;
              engine.current.lastMouseY = e.clientY;
              const newPanX = engine.current.panX + dx;
              const newPanY = engine.current.panY + dy;
              engine.current.panX = newPanX;
              engine.current.panY = newPanY;

              if (!rafPendingRef.current) {
                  rafPendingRef.current = true;
                  requestAnimationFrame(() => {
                      rafPendingRef.current = false;
                      if (containerRef.current) {
                          const viewport = containerRef.current.querySelector('#viewport') as HTMLElement;
                          if (viewport) {
                              viewport.style.backgroundPosition = `${engine.current.panX}px ${engine.current.panY}px`;
                          }
                          const surface = containerRef.current.querySelector('#canvas-surface') as HTMLElement;
                          if (surface) {
                              surface.style.transform = `translate3d(${engine.current.panX}px, ${engine.current.panY}px, 0) scale(${engine.current.scale})`;
                          }
                      }
                  });
              }
          } else if (engine.current.isLassoing) {
              const dx = Math.abs(e.clientX - engine.current.lassoStart.x);
              const dy = Math.abs(e.clientY - engine.current.lassoStart.y);
              if (dx > 5 || dy > 5) engine.current.hasLassoMoved = true;
              const left = Math.min(e.clientX, engine.current.lassoStart.x);
              const top = Math.min(e.clientY, engine.current.lassoStart.y);
              const width = Math.abs(e.clientX - engine.current.lassoStart.x);
              const height = Math.abs(e.clientY - engine.current.lassoStart.y);
              const lasso = container.querySelector('#selection-lasso') as HTMLElement;
              if (lasso) {
                  lasso.style.left = `${left}px`;
                  lasso.style.top = `${top}px`;
                  lasso.style.width = `${width}px`;
                  lasso.style.height = `${height}px`;
              }
          } else if (engine.current.isLinking) {
              updateTempLinkPos(e);
          }
      };

      const handleMouseUp = (e: MouseEvent) => {
          if (engine.current.isScrubbing && engine.current.scrubBeatId !== null) {
              const scrubId = engine.current.scrubBeatId;
              const finalVal = engine.current.scrubCurrentVal || engine.current.scrubStartVal;
              const offset = finalVal - engine.current.scrubStartVal;
              captureSnapshot();

              if (engine.current.selectedBeatIds.has(scrubId) && engine.current.selectedBeatIds.size > 1) {
                  const selectedIds = Array.from(engine.current.selectedBeatIds);
                  const updated = beats.map(b => {
                      if (selectedIds.includes(b.id)) {
                          const curr = parseInt(b.sceneNumber || '1') || 1;
                          return { ...b, sceneNumber: Math.max(1, curr + offset).toString() };
                      }
                      return b;
                  });
                  setBeats(updated);
                  engine.current.beats = updated;
              } else {
                  updateBeat(scrubId, { sceneNumber: finalVal.toString() });
                  engine.current.beats = engine.current.beats.map(b => b.id === scrubId ? { ...b, sceneNumber: finalVal.toString() } : b);
              }

              engine.current.isScrubbing = false;
              engine.current.scrubBeatId = null;
              setScrubbingData(null);
              renderBeats();
          }

          if (engine.current.isDragging) {
              engine.current.isDragging = false;
              minimapContainerRef.current?.classList.remove('active');
              const surface = containerRef.current?.querySelector('#canvas-surface');
              if (surface) surface.classList.remove('is-dragging');

              if (engine.current.dragTarget !== null) {
                  captureSnapshot();
                  setBeats(JSON.parse(JSON.stringify(engine.current.beats)));
                  engine.current.dragTarget = null;
                  renderBeats();
                  renderConnections();
              }
              if (engine.current.dragGroupTarget !== null || engine.current.groupResizeTarget !== null) {
                  captureSnapshot();
                  setGroups(JSON.parse(JSON.stringify(engine.current.groups)));
                  setBeats(JSON.parse(JSON.stringify(engine.current.beats)));
                  engine.current.dragGroupTarget = null;
                  engine.current.groupResizeTarget = null;
                  engine.current.dragGroupChildIds.clear();
                  renderGroups();
                  renderBeats();
                  renderConnections();
              }
              if (engine.current.dragAnnotationId !== null || engine.current.imageResizeTarget !== null) {
                  captureSnapshot();
                  setAnnotations(JSON.parse(JSON.stringify(engine.current.annotations)));
                  engine.current.dragAnnotationId = null;
                  engine.current.imageResizeTarget = null;
                  renderConnections();
              }
          }
          if (engine.current.isDrawing) {
              engine.current.isDrawing = false;
              engine.current.currentAnnoId = null;
              captureSnapshot();
              setAnnotations(JSON.parse(JSON.stringify(engine.current.annotations)));
          }
          if (engine.current.isPanning) {
              engine.current.isPanning = false;
              const surface = containerRef.current?.querySelector('#canvas-surface');
              if (surface) surface.classList.remove('is-panning');
              setPan(engine.current.panX, engine.current.panY);
              if (containerRef.current) {
                  containerRef.current.style.cursor = isSpacePressedRef.current ? 'grab' : 'default';
              }
          }
          if (engine.current.isLinking) {
              completeDragLink(e);
          }
          if (engine.current.isLassoing) {
              engine.current.isLassoing = false;
              const lasso = container.querySelector('#selection-lasso') as HTMLElement;
              if (lasso) lasso.style.display = 'none';
              if (engine.current.hasLassoMoved) {
                  const lLeft = parseFloat(lasso?.style.left || '0');
                  const lTop = parseFloat(lasso?.style.top || '0');
                  const lW = parseFloat(lasso?.style.width || '0');
                  const lH = parseFloat(lasso?.style.height || '0');
                  const containerRect = container.getBoundingClientRect();
                  
                  if (!e.shiftKey) engine.current.selectedBeatIds.clear();

                  engine.current.beats.forEach(b => {
                      const screenX = containerRect.left + engine.current.panX + (b.x * engine.current.scale);
                      const screenY = containerRect.top + engine.current.panY + (b.y * engine.current.scale);
                      const screenW = 200 * engine.current.scale;
                      const screenH = 120 * engine.current.scale;

                      if (screenX + screenW >= lLeft && screenX <= lLeft + lW &&
                          screenY + screenH >= lTop && screenY <= lTop + lH) {
                          engine.current.selectedBeatIds.add(b.id);
                      }
                  });
                  renderBeats();
                  renderConnections();
              } else if (!e.shiftKey) {
                  engine.current.selectedBeatIds.clear();
                  engine.current.selectedAnnoId = null;
                  renderBeats();
                  renderConnections();
                  renderText();
              }
          }
      };

      const handleContextMenu = (e: MouseEvent) => {
          e.preventDefault();
          const target = e.target as HTMLElement;
          if (target.closest('.zoom-controls') || target.closest('.drawing-toolbar-container') || target.closest('#context-menu') || target.closest('.board-switcher') || target.closest('.scrub-timeline-container')) return;

          const beatCard = target.closest('.beat-card') as HTMLElement;
          if (beatCard) {
              const beatId = parseInt(beatCard.dataset.id || '-1');
              if (beatId >= 0) {
                  if (!engine.current.selectedBeatIds.has(beatId)) {
                      engine.current.selectedBeatIds.clear();
                      engine.current.selectedBeatIds.add(beatId);
                      renderBeats();
                      renderConnections();
                  }
                  showContextMenu(e.clientX, e.clientY, beatId, null, null, null);
                  return;
              }
          }

          const groupContainer = target.closest('.group-container') as HTMLElement;
          if (groupContainer) {
              const groupId = parseInt(groupContainer.dataset.id || '-1');
              if (groupId >= 0) {
                  showContextMenu(e.clientX, e.clientY, null, null, groupId, null);
                  return;
              }
          }

          const textCard = target.closest('.text-annotation-card') as HTMLElement;
          if (textCard) {
              const annoId = parseInt(textCard.dataset.id || '-1');
              if (annoId >= 0) {
                  engine.current.selectedAnnoId = annoId;
                  showContextMenu(e.clientX, e.clientY, null, null, null, annoId);
                  return;
              }
          }

          const annoGroup = (target.closest('g[data-type="annotation"]') || target.closest('[data-anno-id]')) as HTMLElement;
          if (annoGroup) {
              const annoId = parseInt(annoGroup.dataset.annoId || annoGroup.getAttribute('data-id') || '-1');
              if (annoId >= 0) {
                  engine.current.selectedAnnoId = annoId;
                  showContextMenu(e.clientX, e.clientY, null, null, null, annoId);
                  return;
              }
          }

          showContextMenu(e.clientX, e.clientY, null, null, null, null);
      };

      const handleKeyDown = (e: KeyboardEvent) => {
          const activeEl = document.activeElement;
          const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true');
          
          if (!isEditing && (e.code === 'Space' || e.key === ' ')) {
              e.preventDefault();
              if (!isSpacePressedRef.current) {
                  isSpacePressedRef.current = true;
                  if (containerRef.current) containerRef.current.style.cursor = 'grab';
              }
              return;
          }

          if (isEditing) {
              return;
          }

          const isMeta = e.ctrlKey || e.metaKey;
          const keyLower = e.key.toLowerCase();

          if (isMeta && keyLower === 'c') {
              e.preventDefault();
              handleCopy();
          } else if (isMeta && keyLower === 'v') {
              e.preventDefault();
              handlePaste();
          } else if (isMeta && keyLower === 'd') {
              e.preventDefault();
              handleDuplicate();
          } else if (isMeta && keyLower === 'a') {
              e.preventDefault();
              engine.current.selectedBeatIds.clear();
              engine.current.beats.forEach(b => engine.current.selectedBeatIds.add(b.id));
              renderBeats();
              renderConnections();
          } else if (isMeta && keyLower === 'z') {
              e.preventDefault();
              if (e.shiftKey) redo();
              else undo();
          } else if (isMeta && keyLower === 'y') {
              e.preventDefault();
              redo();
          } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
              if (engine.current.selectedBeatIds.size > 0) {
                  e.preventDefault();
                  const step = e.shiftKey ? 20 : 5;
                  const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                  const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                  engine.current.beats.forEach(b => {
                      if (engine.current.selectedBeatIds.has(b.id)) {
                          b.x += dx;
                          b.y += dy;
                      }
                  });
                  captureSnapshot();
                  setBeats(JSON.parse(JSON.stringify(engine.current.beats)));
                  renderBeats();
                  renderConnections();
                  renderMinimap();
              }
          } else if (e.key === 'Enter') {
              if (engine.current.selectedBeatIds.size > 0) {
                  const selectedId = Array.from(engine.current.selectedBeatIds)[0];
                  e.preventDefault();
                  onEditBeat(selectedId);
              }
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
              if (engine.current.selectedBeatIds.size > 0 || engine.current.selectedAnnoId !== null) {
                  e.preventDefault();
                  handleDelete();
              }
          } else if (e.key === 'Escape') {
              hideContextMenu();
          }
      };

      const handleDblClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest('.zoom-controls') || target.closest('.drawing-toolbar-container') || target.closest('#context-menu') || target.closest('#fix-menu') || target.closest('.board-switcher') || target.closest('.scrub-timeline-container')) return;
          if (target.closest('.beat-card') || target.closest('.group-container') || target.closest('.text-annotation-card') || target.closest('.annotation-hit-area')) return;
          if (toolMode !== 'none') return;

          e.preventDefault();
          e.stopPropagation();
          const { x, y } = getSvgPoint(e);
          captureSnapshot();
          const newBeatId = addBeat(x - 100, y - 60);
          if (newBeatId !== undefined && newBeatId !== null) {
              engine.current.selectedBeatIds.clear();
              engine.current.selectedBeatIds.add(newBeatId);
              engine.current.selectedAnnoId = null;
              engine.current.creationState = { id: newBeatId, step: 'title' };
              renderBeats();
              renderConnections();
          }
      };

      const handleWheel = (e: WheelEvent) => {
          e.preventDefault();
          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          if (e.ctrlKey || e.metaKey) {
              const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
              const oldScale = engine.current.scale;
              const newScale = Math.min(3, Math.max(0.1, oldScale * zoomFactor));
              if (oldScale === newScale) return;

              const worldX = (mouseX - engine.current.panX) / oldScale;
              const worldY = (mouseY - engine.current.panY) / oldScale;
              const newPanX = mouseX - (worldX * newScale);
              const newPanY = mouseY - (worldY * newScale);

              engine.current.scale = newScale;
              engine.current.panX = newPanX;
              engine.current.panY = newPanY;
              setScale(newScale);
              setPan(newPanX, newPanY);
              renderCanvas();
              renderMinimap();
          } else {
              const newPanX = engine.current.panX - e.deltaX;
              const newPanY = engine.current.panY - e.deltaY;
              engine.current.panX = newPanX;
              engine.current.panY = newPanY;
              setPan(newPanX, newPanY);
              renderCanvas();
              renderMinimap();
          }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
          if (e.code === 'Space' || e.key === ' ') {
              isSpacePressedRef.current = false;
              if (containerRef.current && !engine.current.isPanning) {
                  containerRef.current.style.cursor = 'default';
              }
          }
      };

      container.addEventListener('mousedown', handleMouseDown);
      container.addEventListener('dblclick', handleDblClick);
      container.addEventListener('contextmenu', handleContextMenu);
      container.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          container.removeEventListener('mousedown', handleMouseDown);
          container.removeEventListener('dblclick', handleDblClick);
          container.removeEventListener('contextmenu', handleContextMenu);
          container.removeEventListener('wheel', handleWheel);
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, [toolMode, editingAnnoId, drawColor, strokeWidth, strokeStyle, activeBoardId, setPan, captureSnapshot, setAnnotations, setBeats, setGroups, updateBeat, scrubbingData, onEditBeat]);

  return (
    <div 
      ref={containerRef} 
      className={`board-wrapper tool-${toolMode} ${isPageTransitioning ? 'is-transitioning' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <style>{styles}</style>

      {/* Drag Over Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-accent/10 border-2 border-dashed border-accent z-[3000] pointer-events-none flex items-center justify-center backdrop-blur-sm">
          <div className="bg-black/80 px-6 py-4 rounded-xl border border-accent/40 text-accent font-bold flex items-center gap-3 shadow-2xl">
            <Sparkles className="animate-spin" size={20} />
            <span>Drop Image to Import</span>
          </div>
        </div>
      )}

      {/* Importing Loader Overlay */}
      {(isImporting || isEnhancing) && (
        <div className="absolute inset-0 bg-black/80 z-[3000] flex flex-col items-center justify-center gap-4 backdrop-blur-md">
          <Loader2 className="animate-spin text-accent" size={40} />
          <p className="text-white font-bold text-sm tracking-wider uppercase">
            {isEnhancing ? 'AI Screenplay Parsing...' : 'Reading File...'}
          </p>
        </div>
      )}

      <div id="viewport">
        <div id="canvas-surface">
          {boardLayerOrder.map(layer => {
            if (layer === 'annotations') return <svg key="annotations" id="annotations-layer" style={{ overflow: 'visible' }} className="w-full h-full" />;
            if (layer === 'text') return <div key="text" id="text-layer" className="w-full h-full" />;
            if (layer === 'connections') return <svg key="connections" id="connections-layer" style={{ overflow: 'visible' }} className="w-full h-full" />;
            if (layer === 'groups') return <div key="groups" id="groups-layer" className="w-full h-full" />;
            if (layer === 'beats') return <div key="beats" id="beats-layer" className="w-full h-full" />;
            return null;
          })}
        </div>
      </div>

      <div id="selection-lasso" />
      <div ref={eraserCursorRef} className="eraser-cursor" />

      {/* Minimap */}
      <div ref={minimapContainerRef} className="minimap-container">
        <canvas ref={minimapRef} className="minimap-canvas" />
      </div>

      {/* Drawing Toolbar */}
      <div className="drawing-toolbar-container">
        <button 
          className={`toolbar-toggle ${isToolbarOpen ? 'active' : ''}`}
          onClick={() => setIsToolbarOpen(!isToolbarOpen)}
          title="Drawing Tools"
        >
          <PenTool size={20} />
        </button>

        {isToolbarOpen && (
          <div className="toolbar-panel">
            <div className="tool-row">
              <button className={`tool-btn ${toolMode === 'none' ? 'active' : ''}`} onClick={() => setToolMode('none')} title="Select / Pan"><MousePointer2 size={16} /></button>
              <button className={`tool-btn ${toolMode === 'pencil' ? 'active' : ''}`} onClick={() => setToolMode('pencil')} title="Pencil"><Pen size={16} /></button>
              <button className={`tool-btn ${toolMode === 'rect' ? 'active' : ''}`} onClick={() => setToolMode('rect')} title="Rectangle"><Square size={16} /></button>
              <button className={`tool-btn ${toolMode === 'circle' ? 'active' : ''}`} onClick={() => setToolMode('circle')} title="Circle"><Circle size={16} /></button>
              <button className={`tool-btn ${toolMode === 'line' ? 'active' : ''}`} onClick={() => setToolMode('line')} title="Line"><Minus size={16} /></button>
              <button className={`tool-btn ${toolMode === 'arrow' ? 'active' : ''}`} onClick={() => setToolMode('arrow')} title="Arrow"><ArrowRight size={16} /></button>
              <button className={`tool-btn ${toolMode === 'text' ? 'active' : ''}`} onClick={() => setToolMode('text')} title="Text Note"><Type size={16} /></button>
              <button className={`tool-btn ${toolMode === 'bigtext' ? 'active' : ''}`} onClick={() => setToolMode('bigtext')} title="Heading Text"><Heading size={16} /></button>
              <button className={`tool-btn ${toolMode === 'eraser' ? 'active' : ''}`} onClick={() => setToolMode('eraser')} title="Eraser"><Eraser size={16} /></button>
              <button className="tool-btn danger" onClick={handleClearAll} title="Clear Drawings"><Trash2 size={16} /></button>
            </div>

            <div className="tool-divider" />

            {/* Colors */}
            <div className="tool-row">
              {ANNOTATION_COLORS.map(c => (
                <div 
                  key={c} 
                  className={`color-dot-btn ${drawColor === c ? 'active' : ''}`}
                  onClick={() => setDrawColor(c)}
                >
                  <div className="color-dot-inner" style={{ backgroundColor: c }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Board Switcher */}
      <div className="board-switcher">
        {[0, 1, 2].map(boardIdx => (
          <button
            key={boardIdx}
            className={`board-tab ${activeBoardId === boardIdx ? 'active' : ''}`}
            onClick={() => setActiveBoardId(boardIdx)}
          >
            <Layers size={10} />
            Board {boardIdx + 1}
          </button>
        ))}
      </div>

      {/* Zoom & Connection Controls */}
      <div className="zoom-controls">
        <button 
          onClick={() => setIsAiModalOpen(true)}
          className="w-9 h-9 !p-0 flex items-center justify-center bg-gradient-to-r from-[#2a1b40] to-[#150d24] hover:from-[#3b245a] hover:to-[#281845] text-[#f5a623] border border-[#f5a623]/40 hover:border-[#f5a623] rounded transition-all shadow-[0_0_10px_rgba(245,166,35,0.2)] group"
          title="AI Scene Generator (5, 20, or 50 Scenes)"
        >
          <Zap size={16} className="text-[#f5a623] fill-[#f5a623]/30 group-hover:scale-110 transition-transform duration-300" />
        </button>
        <button onClick={() => handleZoom('in')} title="Zoom In"><ZoomIn size={16} /></button>
        <button onClick={() => handleZoom('out')} title="Zoom Out"><ZoomOut size={16} /></button>
        <button onClick={handleZoomReset} title="Reset Zoom (100%)"><RotateCcw size={16} /></button>
        <button onClick={handleFitView} title="Fit All"><Maximize size={16} /></button>

        <div className="w-full h-[1px] bg-white/10 my-0.5" />

        <button 
          onClick={() => setDefaultConnStyle('zigzag')}
          className={defaultConnStyle === 'zigzag' ? '!border-[#f5a623] !text-[#f5a623] !bg-[#f5a623]/20' : ''}
          title="Zigzag Connection Lines (Default)"
        >
          <Workflow size={16} />
        </button>
        <button 
          onClick={() => setDefaultConnStyle('curve')}
          className={defaultConnStyle === 'curve' ? '!border-[#f5a623] !text-[#f5a623] !bg-[#f5a623]/20' : ''}
          title="Curved Connection Lines"
        >
          <Activity size={16} />
        </button>
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <div 
          id="context-menu" 
          style={{ left: ctxMenu.x, top: ctxMenu.y, display: 'block' }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.beatId !== null && ctxMenu.beatId !== undefined && (
            <>
              <div className="ctx-item" onClick={() => onEditBeat(ctxMenu.beatId!)}>
                <FileText size={14} /> Open Editor
              </div>
              <div className="ctx-item" onClick={handleDuplicate}>
                <CopyPlus size={14} /> Duplicate Beat
              </div>
              <div className="ctx-item" onClick={handleCopy}>
                <Copy size={14} /> Copy Beat
              </div>
              {statusAction && (
                <div className="ctx-item" style={{ color: statusAction.color }} onClick={() => handleStatus(statusAction.status)}>
                  <Sparkles size={14} /> {statusAction.label}
                </div>
              )}
              <div className="ctx-divider" />
              <div className="ctx-label">Colors</div>
              <div className="color-row">
                {STORYLINE_COLORS.map(c => (
                  <div key={c} className="color-dot" style={{ backgroundColor: c }} onClick={() => handleColor(c, 'chain')} />
                ))}
              </div>
              <div className="ctx-divider" />
            </>
          )}

          {ctxMenu.linkIndex !== null && ctxMenu.linkIndex !== undefined && (
            <>
              <div className="ctx-label font-bold text-amber-400">Connection Style</div>
              <div className="flex flex-col gap-1 p-1">
                <button 
                  className="ctx-item !py-1 text-xs" 
                  onClick={() => {
                    if (ctxMenu.linkIndex !== null && ctxMenu.linkIndex !== undefined) {
                      const filteredConns = connections.filter(c => (c.boardId || 0) === (activeBoardId || 0));
                      const targetConn = filteredConns[ctxMenu.linkIndex];
                      if (targetConn) {
                        const newConns = connections.map(c => c === targetConn ? { ...c, style: 'zigzag' as ConnectionStyle } : c);
                        setConnections(newConns);
                        engine.current.connections = newConns;
                        captureSnapshot({ connections: newConns });
                        renderConnections();
                      }
                    }
                    setDefaultConnStyle('zigzag');
                    hideContextMenu();
                  }}
                >
                  <Workflow size={13} /> Zigzag
                </button>

                <button 
                  className="ctx-item !py-1 text-xs" 
                  onClick={() => {
                    if (ctxMenu.linkIndex !== null && ctxMenu.linkIndex !== undefined) {
                      const filteredConns = connections.filter(c => (c.boardId || 0) === (activeBoardId || 0));
                      const targetConn = filteredConns[ctxMenu.linkIndex];
                      if (targetConn) {
                        const newConns = connections.map(c => c === targetConn ? { ...c, style: 'curve' as ConnectionStyle } : c);
                        setConnections(newConns);
                        engine.current.connections = newConns;
                        captureSnapshot({ connections: newConns });
                        renderConnections();
                      }
                    }
                    setDefaultConnStyle('curve');
                    hideContextMenu();
                  }}
                >
                  <Activity size={13} /> Curve
                </button>
              </div>

              <div className="ctx-divider" />
              <div className="ctx-label">Line Color</div>
              <div className="color-row">
                {STORYLINE_COLORS.map(c => (
                  <div 
                    key={c} 
                    className="color-dot" 
                    style={{ backgroundColor: c }} 
                    onClick={() => {
                      if (ctxMenu.linkIndex !== null && ctxMenu.linkIndex !== undefined) {
                        const filteredConns = connections.filter(c => (c.boardId || 0) === (activeBoardId || 0));
                        const targetConn = filteredConns[ctxMenu.linkIndex];
                        if (targetConn) {
                          const newConns = connections.map(conn => conn === targetConn ? { ...conn, color: c } : conn);
                          setConnections(newConns);
                          engine.current.connections = newConns;
                          captureSnapshot({ connections: newConns });
                          renderConnections();
                        }
                      }
                      hideContextMenu();
                    }} 
                  />
                ))}
              </div>
              <div className="ctx-divider" />
            </>
          )}

          {ctxMenu.groupId !== null && ctxMenu.groupId !== undefined && (
            <>
              <div className="ctx-label">Group Color</div>
              <div className="color-row">
                {STORYLINE_COLORS.map(c => (
                  <div key={c} className="color-dot" style={{ backgroundColor: c }} onClick={() => handleColor(c, 'group')} />
                ))}
              </div>
              <div className="ctx-divider" />
            </>
          )}

          {clipboard.length > 0 && ctxMenu.beatId === null && ctxMenu.groupId === null && (
            <div className="ctx-item" onClick={handlePaste}>
              <ClipboardPaste size={14} /> Paste Beat(s)
            </div>
          )}

          {/* Board empty click item */}
          {ctxMenu.beatId === null && ctxMenu.groupId === null && (
            <div className="ctx-item" onClick={() => {
              const newBeatId = addBeat(ctxMenu.worldX - 100, ctxMenu.worldY - 60);
              if (newBeatId !== undefined && newBeatId !== null) {
                engine.current.selectedBeatIds.clear();
                engine.current.selectedBeatIds.add(newBeatId);
                renderBeats();
                renderConnections();
              }
              hideContextMenu();
            }}>
              <Plus size={14} /> Create New Beat Here
            </div>
          )}

          {/* Sequence options when beats are selected */}
          {engine.current.selectedBeatIds.size > 0 && (
            <>
              {engine.current.selectedBeatIds.size > 1 && (
                <div className="ctx-item text-purple-300" onClick={handleConnectSelectedBeats}>
                  <Zap size={14} /> Connect Selected Beats
                </div>
              )}
              <div className="ctx-item" onClick={handleCreateGroup}>
                <Layers size={14} /> Create Sequence (Group)
              </div>
              <div className="ctx-item" onClick={() => handleAddToSequence()}>
                <PlusCircle size={14} /> Add to Sequence
              </div>
              <div className="ctx-divider" />
            </>
          )}

          <div className="ctx-item text-red-400" onClick={handleDelete}>
            <Trash2 size={14} /> Delete
          </div>
        </div>
      )}

      {/* Scrub Timeline Indicator */}
      {scrubbingData && (
        <div 
          className="scrub-timeline-container"
          style={{ left: scrubbingData.x, top: scrubbingData.y - 20 }}
        >
          <div className="scrub-label">Scene #{scrubbingData.currentVal}</div>
          <div className="scrub-track">
            <div 
              className="scrub-indicator"
              style={{ left: `${Math.min(100, Math.max(0, (scrubbingData.currentVal / 50) * 100))}%` }}
            />
          </div>
          <div className="scrub-sub">Drag left/right to resequence</div>
        </div>
      )}

      {/* AI Scene Generator Popup Modal */}
      <AISceneGeneratorModal 
        isOpen={isAiModalOpen} 
        onClose={() => setIsAiModalOpen(false)} 
      />
    </div>
  );
};

export default BoardView;