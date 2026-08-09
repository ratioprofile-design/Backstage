
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';
import { BeatStatus, Group, Annotation, Beat } from '../../types';
import { 
    MousePointer2, Square, Circle, Pen, Minus, ArrowRight, Eraser, Trash2, 
    Type, X, PenTool, GripHorizontal, Heading, FileText, Loader2, Sparkles,
    Music, Play, Pause, AlertTriangle, ArrowRightLeft, Replace, Layers, Copy, ClipboardPaste, CopyPlus,
    RotateCw, Zap, PlusCircle, Wand2, Plus, ArrowLeftRight, MoreHorizontal, Hash
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
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
    beats, groups, annotations, activeBoardId, nextId,
    updateBeat, addBeat, setBeats, setGroups, addGroup, updateGroup, removeGroup,
    setAnnotations, captureSnapshot, geminiApiKey, isPdfDropEnabled, setActiveBoardId, setNextId,
    autoGenerate5Scenes, undo, redo, appTheme,
    boardLayerOrder = ['annotations', 'text', 'groups', 'beats']
  } = useProject();
  const { aiAvailable } = useAiKeyStatus();

  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const containerRef = useRef<HTMLDivElement>(null);
  const eraserCursorRef = useRef<HTMLDivElement>(null);
  const rafPendingRef = useRef(false);
  const annoRafPendingRef = useRef(false);
  const isSpacePressedRef = useRef(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  
  // Local UI State for Toolbar
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [toolMode, setToolMode] = useState<'none' | 'pencil' | 'rect' | 'circle' | 'line' | 'arrow' | 'eraser' | 'text' | 'bigtext'>('none');
  const [drawColor, setDrawColor] = useState('#f5a623');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokeStyle, setStrokeStyle] = useState<'solid' | 'dashed'>('solid'); 
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [isBeautifying, setIsBeautifying] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  
  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<Beat[]>([]);
  
  // Context Menu State
  const [ctxMenu, setCtxMenu] = useState<{x: number, y: number, worldX: number, worldY: number, beatId?: number | null, groupId?: number | null, annotationId?: number | null} | null>(null);

  // Scene Number Popup State
  const [sceneNumPopup, setSceneNumPopup] = useState<{ beatId: number, x: number, y: number, value: string } | null>(null);

  // Text Editing State
  const [editingAnnoId, setEditingAnnoId] = useState<number | null>(null);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false); 
  const [isDragOver, setIsDragOver] = useState(false);

  // Engine Ref (Mutable state for high-perf interactions)
  const engine = useRef({
    beats: [] as Beat[],
    groups: [] as Group[],
    annotations: [] as Annotation[],
    scale: 1,
    panX: 0,
    panY: 0,
    
    selectedBeatIds: new Set<number>(),
    selectedAnnoIds: new Set<number>(),
    dragTarget: null as number | null,
    dragGroupTarget: null as number | null, 
    dragGroupChildIds: new Set<number>(),
    groupResizeTarget: null as number | null,
    beatResizeTarget: null as { 
        id: number,
        corner: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w',
        startX: number,
        startY: number,
        startW: number,
        startH: number,
        startMouseX: number,
        startMouseY: number
    } | null,
    isPanning: false,

    annoResizeTarget: null as {
        id: number,
        corner: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w',
        start: Annotation,
        startMouseX: number,
        startMouseY: number
    } | null,
    annoRotateTarget: null as {
        id: number,
        centerX: number,
        centerY: number,
        startAngle: number,
        startMouseAngle: number
    } | null,
    textResizeTarget: null as {
        id: number,
        startFontSize: number,
        startMouseY: number
    } | null,

    dragAnnotationId: null as number | null,

    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    lastClickBeatId: null as number | null,
    lastClickTime: 0,
    
    creationState: null as { id: number, step: 'title' | 'summary' } | null,

    isLassoing: false,
    hasLassoMoved: false, 
    lassoStart: { x: 0, y: 0 },
    
    isDrawing: false,
    drawStart: { x: 0, y: 0 },
    currentPoints: [] as {x: number, y: number}[], 
    currentAnnoId: null as number | null,

    errorIds: new Set<number>(),
  });

  const styles = `
    :root {
        --bg-canvas: ${isLight ? '#f1f5f9' : '#1e1e1e'};
        --bg-grid: ${isLight ? '#cbd5e1' : '#2a2a2a'};
    }
    .board-wrapper {
        width: 100%; height: 100%; overflow: hidden; background-color: ${isLight ? '#f1f5f9' : '#1e1e1e'}; font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: ${isLight ? '#0f172a' : '#e0e0e0'}; position: relative; outline: none;
        -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;
    }
    #viewport {
        width: 100%; height: 100%; cursor: default; position: absolute; top: 0; left: 0; overflow: hidden; display: block;
        background-color: ${isLight ? '#0f172a' : '#0a0a0a'};
    }
    .tool-pencil #viewport, .tool-rect #viewport, .tool-circle #viewport, .tool-line #viewport, .tool-arrow #viewport, .tool-text #viewport, .tool-bigtext #viewport { cursor: crosshair !important; }
    .tool-eraser #viewport { cursor: none !important; }
    #canvas-surface {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background-color: ${isLight ? '#f8fafc' : '#1e1e1e'};
        background-image: linear-gradient(${isLight ? '#e2e8f0' : '#2a2a2a'} 1px, transparent 1px), linear-gradient(90deg, ${isLight ? '#e2e8f0' : '#2a2a2a'} 1px, transparent 1px);
        background-size: 50px 50px;
        border: 1px solid ${isLight ? '#94a3b8' : '#333'};
        box-shadow: 0 0 0 1px rgba(0,0,0,0.08), 0 12px 40px rgba(0,0,0,0.35);
        transform-origin: 0 0;
        isolation: isolate; 
        overflow: visible;
        will-change: transform;
        transform-style: preserve-3d;
        backface-visibility: hidden;
    }
    .is-dragging *, .is-dragging .beat-card {
        transition: none !important;
        animation: none !important;
        will-change: transform;
    }
    #groups-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
    #annotations-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 15; overflow: visible; }
    #text-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 20; }
    #beats-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 100; }
    
    /* --- PAGE TRANSITION ANIMATION --- */
    @keyframes boardPageIn {
        0% { opacity: 0; transform: translateX(30px) scale(0.99); filter: blur(8px); }
        100% { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
    }
    .is-transitioning #beats-layer, 
    .is-transitioning #groups-layer, 
    .is-transitioning #annotations-layer, 
    .is-transitioning #text-layer {
        animation: boardPageIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .group-container, .beat-card, .annotation-hit-area { pointer-events: auto !important; }
    .text-annotation-card { pointer-events: auto !important; }
    .tool-pencil #annotations-layer, .tool-rect #annotations-layer, .tool-circle #annotations-layer, .tool-line #annotations-layer, .tool-arrow #annotations-layer, .tool-eraser #annotations-layer, .tool-text #annotations-layer, .tool-bigtext #annotations-layer { pointer-events: auto !important; }
    #selection-lasso { position: fixed; border: 1px solid rgba(245, 166, 35, 0.8); background-color: rgba(245, 166, 35, 0.15); display: none; pointer-events: none; z-index: 9999; }
    .annotation-path { fill: none; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
    .annotation-rect { fill: none; pointer-events: none; }
    .annotation-circle { fill: none; pointer-events: none; }
    .annotation-line { fill: none; stroke-linecap: round; pointer-events: none; }
    .annotation-image { pointer-events: none; }
    .text-annotation-card { position: absolute; min-width: 50px; min-height: 1.2em; background: ${isLight ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.55)'}; border: 1px dashed ${isLight ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.14)'}; border-radius: 8px; padding: 4px 8px; cursor: grab; transition: border-color 0.2s, background 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.10); }
    .text-annotation-card:hover { border-color: rgba(245,166,35,0.5); background: ${isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.7)'}; }
    .text-annotation-card.editing { background: rgba(20,20,20,0.95); border: 1px solid #f5a623; box-shadow: 0 4px 25px rgba(0,0,0,0.8); cursor: text; z-index: 1000; min-width: 220px; border-radius: 6px; }
    .text-annotation-input { width: 100%; height: 100%; background: transparent; border: none; outline: none; resize: none; font-family: 'Inter', system-ui, sans-serif; line-height: 1.25; overflow: hidden; }
    .text-annotation-display { white-space: pre-wrap; font-family: 'Inter', system-ui, sans-serif; line-height: 1.25; user-select: none; }
    .annotation-hit-area { fill: none; stroke: rgba(255,0,0,0.001); stroke-width: 20px; stroke-linecap: round; stroke-linejoin: round; pointer-events: visibleStroke; cursor: default; }
    .tool-eraser .annotation-hit-area { cursor: none; }
    .eraser-cursor { position: fixed; pointer-events: none; z-index: 9999; width: 20px; height: 20px; border: 2px solid #ef4444; background-color: rgba(239, 68, 68, 0.2); border-radius: 50%; transform: translate(-50%, -50%); display: none; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
    .tool-eraser .eraser-cursor { display: block; }
    .beat-card { position: absolute; width: 340px; min-height: 150px; background: ${isLight ? '#ffffff' : '#1a1a22'}; border: 1px solid ${isLight ? '#e2e8f0' : '#2a2a33'}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; flex-direction: column; user-select: none; transition: box-shadow 0.1s, border-color 0.1s; cursor: default; }
    .beat-card:hover { border-color: ${isLight ? '#cbd5e1' : '#4a4a5a'}; }
    .beat-card.selected { z-index: 125; }
    .beat-card.creating { border-color: #f5a623; box-shadow: 0 0 15px rgba(245, 166, 35, 0.5); z-index: 125; }
    .beat-card:active { z-index: 126; }
    .beat-banner { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: grab; position: relative; }
    .beat-banner:active { cursor: grabbing; }
    .seq-badge { flex-shrink: 0; min-width: 32px; width: auto; padding: 0 7px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #fff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: pointer; pointer-events: auto; transition: filter 0.2s, transform 0.2s; }
    .seq-badge:hover { filter: brightness(1.2); transform: scale(1.05); }
    .seq-badge.error { background: #ef4444 !important; animation: pulse-red 2s infinite; }
    @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
    .beat-banner-text { flex: 1; min-width: 0; }
    .beat-title { font-weight: 800; font-size: 13px; color: ${isLight ? '#0f172a' : '#ffffff'}; letter-spacing: 0.2px; line-height: 1.3; }
    .beat-slug-preview { font-family: 'Courier Prime', monospace; font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: ${isLight ? '#64748b' : 'rgba(255,255,255,0.6)'}; margin-top: 2px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .beat-status-dot { flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%; }
    .beat-status-dot.ready { background: #34d399; box-shadow: 0 0 6px rgba(52,211,153,0.6); }
    .beat-status-dot.wip { background: #f59e0b; box-shadow: 0 0 6px rgba(245,158,11,0.6); }
    .beat-content { padding: 10px 12px; flex-grow: 1; display: flex; flex-direction: column; }
    .beat-preview { font-family: 'Helvetica Neue', sans-serif; font-size: 11px; line-height: 1.6; color: ${isLight ? '#475569' : '#cbd5e1'}; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 8; -webkit-box-orient: vertical; pointer-events: none; white-space: pre-wrap; }
    .beat-footer { margin-top: auto; border-top: 1px solid ${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)'}; background: ${isLight ? 'rgba(248,250,252,0.6)' : 'rgba(255,255,255,0.015)'}; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; }
    .beat-status { font-size: 9px; font-weight: 800; text-transform: uppercase; display: flex; align-items: center; gap: 4px; letter-spacing: 0.5px; cursor: pointer; }
    .beat-status.ready { color: #34d399; }
    .beat-status.wip { color: #f59e0b; }
    .beat-version { font-size: 9px; font-weight: 700; color: ${isLight ? '#94a3b8' : '#7a7a8a'}; display: flex; align-items: center; gap: 3px; cursor: pointer; }
    .beat-version:hover { color: #f5a623; }
    .title-input { flex: 1; min-width: 0; background: rgba(0,0,0,0.25); color: #fff; border: 1px solid #f5a623; border-radius: 4px; font-weight: 700; font-size: 13px; padding: 3px 6px; outline: none; }
    .summary-input { background: #111; color: #e0e0e0; border: 1px solid #f5a623; border-radius: 4px; width: 100%; font-family: sans-serif; font-size: 11px; padding: 6px; outline: none; resize: none; height: 80px; line-height: 1.5; }
    .group-container { position: absolute; border-radius: 8px; border: 2px solid; background: rgba(40,40,40,0.3); backdrop-filter: blur(2px); display: flex; flex-direction: column; transition: border-color 0.2s, box-shadow 0.2s; }
    .group-header { height: 24px; background: rgba(0,0,0,0.4); border-radius: 6px 6px 0 0; display: flex; align-items: center; padding: 0 8px; cursor: grab; color: rgba(255,255,255,0.8); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
    .group-header:active { cursor: grabbing; }
    .group-resize-handle { position: absolute; bottom: 0; right: 0; width: 15px; height: 15px; cursor: nwse-resize; border-radius: 0 0 6px 0; background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 50%); }
    .group-resize-handle:hover { background: linear-gradient(135deg, transparent 50%, #f5a623 50%); }
    .group-input { background: transparent; border: none; color: white; font-weight: bold; outline: none; text-transform: uppercase; font-size: 11px; min-width: 50px; transition: width 0.1s; }
    .group-input:focus { background: rgba(0,0,0,0.2); }
    #context-menu { position: absolute; background: #252525; border: 1px solid #333; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border-radius: 4px; padding: 5px 0; width: 200px; display: none; z-index: 1000; }
    .ctx-item { padding: 8px 15px; font-size: 13px; cursor: pointer; color: #ccc; transition: background 0.1s; display: flex; align-items: center; gap: 8px; }
    .ctx-item:hover { background: #333; color: white; }
    .ctx-divider { height: 1px; background: #333; margin: 4px 0; }
    .ctx-label { padding: 4px 15px 0; font-size: 10px; color: #777; text-transform: uppercase; font-weight: bold; }
    .color-row { display: flex; padding: 5px 12px; justify-content: space-between; }
    .color-dot { width: 16px; height: 16px; border-radius: 50%; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); position: relative;}
    .color-dot:hover { transform: scale(1.2); border-color: #fff; }
    .ai-generator-container { position: absolute; bottom: 20px; right: 20px; z-index: 200; pointer-events: auto; }
    .drawing-toolbar-container { position: absolute; bottom: 20px; left: 20px; z-index: 2000; display: flex; flex-direction: column-reverse; align-items: center; gap: 10px; }
    .toolbar-toggle { width: 44px; height: 44px; background: #2d2d2d; border: 1px solid #555; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #f5a623; box-shadow: 0 4px 10px rgba(0,0,0,0.4); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .toolbar-toggle:hover { background: #333; transform: scale(1.1); color: white; border-color: #f5a623; }
    .toolbar-toggle.active { background: #f5a623; color: black; border-color: #f5a623; transform: rotate(45deg); }
    .toolbar-panel { background: #2d2d2d; border: 1px solid #3d3d3d; border-radius: 12px; padding: 8px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); animation: slideUp 0.2s ease-out; transform-origin: bottom center; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .tool-row { display: flex; flex-direction: column; align-items: center; gap: 4px; }
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

    .scene-num-popup {
        position: absolute; z-index: 3000; width: 190px; background: #252525; border: 1px solid rgba(245, 166, 35, 0.5);
        border-radius: 10px; box-shadow: 0 14px 40px rgba(0,0,0,0.6); padding: 12px; display: flex; flex-direction: column; gap: 8px;
        animation: slideUp 0.15s ease-out;
    }
    .scene-num-popup label {
        font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #f5a623;
    }
    .scene-num-popup input {
        width: 100%; background: #111; color: #fff; border: 1px solid #444; border-radius: 6px; padding: 7px 10px;
        font-size: 16px; font-weight: 700; outline: none; box-sizing: border-box;
    }
    .scene-num-popup input:focus { border-color: #f5a623; box-shadow: 0 0 0 1px #f5a623; }
    .scene-num-popup-actions { display: flex; gap: 6px; }
    .scene-num-popup-actions button {
        flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid #444; background: #333; color: #ccc;
        font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s;
    }
    .scene-num-popup-actions button:hover { border-color: #f5a623; color: #f5a623; }
    .scene-num-popup-actions button.primary { background: rgba(245, 166, 35, 0.2); border-color: rgba(245, 166, 35, 0.6); color: #f5a623; }

    g[data-selected="true"] .annotation-hit-area {
        stroke: rgba(245, 166, 35, 0.7) !important;
        stroke-width: 1.5px !important;
        stroke-dasharray: 4,4;
    }

    /* --- EXCALIDRAW-STYLE OVERLAYS --- */
    #handles-layer { position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: 3000; }
    .beat-handle, .anno-handle { position: absolute; width: 7px; height: 7px; transform: translate(-50%, -50%); background: rgba(255,255,255,0.9); border: 1.5px dashed rgba(245, 166, 35, 0.85); border-radius: 50%; pointer-events: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .beat-rotate-handle, .anno-rotate-handle { width: 11px; height: 11px; border-style: solid; background: rgba(255,255,255,0.95); }
    .beat-rotate-handle::after, .anno-rotate-handle::after { content: ''; position: absolute; top: 100%; left: 50%; width: 1.5px; height: 18px; background: rgba(245, 166, 35, 0.55); transform: translateX(-50%); pointer-events: none; }
    .font-size-handle { position: absolute; transform: translate(-50%, -50%); width: 20px; height: 12px; background: rgba(255,255,255,0.95); border: 1.5px dashed rgba(245, 166, 35, 0.85); border-radius: 6px; pointer-events: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.2); cursor: ns-resize; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800; color: rgba(245, 166, 35, 0.9); user-select: none; }

    #snap-guide-v { position: fixed; top: 0; height: 100vh; border-left: 1px dashed rgba(14, 165, 233, 0.4); display: none; pointer-events: none; z-index: 3001; }
    #snap-guide-h { position: fixed; left: 0; width: 100vw; border-top: 1px dashed rgba(14, 165, 233, 0.4); display: none; pointer-events: none; z-index: 3001; }

    .zoom-control { position: absolute; bottom: 20px; right: 76px; z-index: 2000; display: flex; gap: 2px; background: rgba(20,20,20,0.6); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.05); padding: 3px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.4); }
    .zoom-control button { background: transparent; border: none; color: #aaa; width: 26px; height: 26px; border-radius: 7px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .zoom-control button:hover { color: #f5a623; background: rgba(245,166,35,0.1); }
    .zoom-control .zoom-label { width: 54px; font-size: 11px; font-family: monospace; color: #ccc; }

    .space-pressed #viewport, .is-panning #viewport { cursor: grab !important; }
    .is-panning #viewport { cursor: grabbing !important; }
  `;

  // --- INITIALIZATION & RE-RENDER ---
  useEffect(() => {
    engine.current.beats = JSON.parse(JSON.stringify(beats.filter(b => (b.boardId || 0) === activeBoardId))); 
    engine.current.groups = JSON.parse(JSON.stringify((groups || []).filter(g => (g.boardId || 0) === activeBoardId)));
    engine.current.annotations = JSON.parse(JSON.stringify(annotations.filter(a => (a.boardId || 0) === activeBoardId)));
    
    renderCanvas();
  }, [beats, groups, annotations, activeBoardId, boardLayerOrder]);

  // --- PAGE TRANSITION TRIGGER ---
  useEffect(() => {
    setIsPageTransitioning(true);
    const timer = setTimeout(() => setIsPageTransitioning(false), 450);
    return () => clearTimeout(timer);
  }, [activeBoardId]);

  useEffect(() => {
      if (toolMode === 'text' || toolMode === 'bigtext') {
          engine.current.selectedBeatIds.clear();
          engine.current.selectedAnnoIds.clear();
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

  const getAnnoBounds = (a: Annotation) => {
      if (a.type === 'rect' || a.type === 'image') {
          const x = a.x || 0, y = a.y || 0;
          const w = a.w || 0, h = a.h || 0;
          return { minX: Math.min(x, x + w), minY: Math.min(y, y + h), maxX: Math.max(x, x + w), maxY: Math.max(y, y + h) };
      }
      if (a.type === 'circle') {
          const cx = a.cx !== undefined ? a.cx : (a.x || 0) + (a.w || 0) / 2;
          const cy = a.cy !== undefined ? a.cy : (a.y || 0) + (a.h || 0) / 2;
          const r = a.rx !== undefined ? a.rx : Math.hypot(a.w || 0, a.h || 0) / 2;
          const safe = Math.max(1, r);
          return { minX: cx - safe, minY: cy - safe, maxX: cx + safe, maxY: cy + safe };
      }
      if (a.type === 'line' || a.type === 'arrow') {
          const x = a.x || 0, y = a.y || 0;
          return { minX: Math.min(x, x + (a.w || 0)), minY: Math.min(y, y + (a.h || 0)), maxX: Math.max(x, x + (a.w || 0)), maxY: Math.max(y, y + (a.h || 0)) };
      }
      if (a.type === 'pencil' && a.points && a.points.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          a.points.forEach((p: any) => {
              minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
              maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
          });
          return { minX, minY, maxX, maxY };
      }
      if (a.type === 'text' || a.type === 'bigtext') {
          const isBig = a.type === 'bigtext';
          const fs = a.fontSize || (isBig ? 26 : 14);
          const x = a.x || 0, y = a.y || 0;
          const w = Math.max(140, ((a.text || 'Note text...').length) * fs * 0.6);
          return { minX: x, minY: y, maxX: x + w, maxY: y + fs * 1.4 };
      }
      return { minX: a.x || 0, minY: a.y || 0, maxX: (a.x || 0) + (a.w || 100), maxY: (a.y || 0) + (a.h || 50) };
  };

  const selectAnnoOnMouseDown = (e: MouseEvent, id: number) => {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
          if (engine.current.selectedAnnoIds.has(id)) engine.current.selectedAnnoIds.delete(id);
          else engine.current.selectedAnnoIds.add(id);
          engine.current.selectedBeatIds.clear();
          renderBeats();
          renderText();
          renderAnnotations();
          renderSelectionOverlay();
          return;
      }
      if (!engine.current.selectedAnnoIds.has(id)) {
          engine.current.selectedAnnoIds.clear();
          engine.current.selectedAnnoIds.add(id);
          engine.current.selectedBeatIds.clear();
          renderBeats();
          renderText();
          renderAnnotations();
          renderSelectionOverlay();
      }
      engine.current.dragAnnotationId = id;
      engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX;
      engine.current.lastMouseY = e.clientY;
  };

  const renderCanvas = () => {
    renderGroups(); 
    renderBeats();
    renderAnnotations(); 
    renderText();
    applyViewTransform();
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
      const isSelected = engine.current.selectedAnnoIds.has(anno.id);
      const fontSize = anno.fontSize || (isBig ? 26 : 14);

      const textColor = ensureVibrantLightColor(anno.color, isBig ? '#f5a623' : '#38bdf8');

      card.dataset.id = anno.id.toString();
      card.className = `text-annotation-card ${isEditing ? 'editing' : ''}`;
      card.style.left = `${anno.x || 0}px`;
      card.style.top = `${anno.y || 0}px`;
      card.style.color = textColor;
      card.style.fontSize = `${fontSize}px`;
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
        textarea.style.fontSize = `${fontSize}px`;
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
          selectAnnoOnMouseDown(e, anno.id);
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
    computeDuplicateIds();
    const beatsLayer = containerRef.current.querySelector('#beats-layer');
    if (!beatsLayer) return;

    beatsLayer.innerHTML = ''; 

    const { creationState } = engine.current;

    engine.current.beats.forEach(beat => {
        const isCreating = creationState?.id === beat.id;
        const card = document.createElement('div');
        card.className = `beat-card ${engine.current.selectedBeatIds.has(beat.id) ? 'selected' : ''} ${isCreating ? 'creating' : ''}`;
        card.style.left = '0px';
        card.style.top = '0px';
        card.style.transform = `translate(${beat.x}px, ${beat.y}px)`;
        if (beat.w) card.style.width = `${beat.w}px`;
        if (beat.h) card.style.height = `${beat.h}px`;
        if (beat.tint && beat.tint !== '#2d2d2d') card.style.backgroundColor = beat.tint;
        else card.style.backgroundColor = '';
        card.dataset.id = beat.id.toString();

        const compColor = beat.color && beat.color !== '#444' ? beat.color : (isLight ? '#6366f1' : '#f5a623');

        // ── Scene Banner ──
        const banner = document.createElement('div');
        banner.className = 'beat-banner';
        banner.style.background = isLight
            ? `linear-gradient(135deg, ${compColor}14, ${compColor}08)`
            : `linear-gradient(135deg, ${compColor}22, ${compColor}0a)`;
        banner.style.borderBottom = `1px solid ${compColor}28`;

        const rawNum = beat.sceneNumber;
        const displayNum = (rawNum && rawNum.trim() !== '') ? rawNum.trim() : '•';

        const badge = document.createElement('span');
        badge.className = 'seq-badge';
        badge.innerText = displayNum;
        badge.title = "Click to set scene number";
        badge.style.background = `linear-gradient(135deg, ${compColor}, ${compColor}cc)`;

        const isError = engine.current.errorIds.has(beat.id);
        if (isError) {
            badge.classList.add('error');
            badge.title = "Duplicate Scene Number. Click to change.";
        }
        banner.appendChild(badge);

        const bannerText = document.createElement('div');
        bannerText.className = 'beat-banner-text';

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
            bannerText.appendChild(input);
        } else {
            const title = document.createElement('div');
            title.className = 'beat-title';
            title.innerText = beat.title || 'Untitled Scene';
            bannerText.appendChild(title);
        }

        const slugPreview = document.createElement('div');
        slugPreview.className = 'beat-slug-preview';
        const s = beat.slug;
        if (s && (s.prefix || s.location || s.time)) {
            slugPreview.innerText = `${s.prefix} ${s.location} - ${s.time}`;
        } else {
            slugPreview.innerText = "INT. LOCATION - DAY";
        }
        bannerText.appendChild(slugPreview);
        banner.appendChild(bannerText);

        const statusDot = document.createElement('div');
        statusDot.className = `beat-status-dot ${beat.status === 'ready' ? 'ready' : 'wip'}`;
        statusDot.title = beat.status === 'ready' ? 'Ready' : 'Work in Progress';
        banner.appendChild(statusDot);

        card.appendChild(banner);

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = beat.content || '';

        // ── Summary Body ──
        const content = document.createElement('div');
        content.className = 'beat-content';

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
            } else {
                preview.innerText = tempDiv.innerText || 'No summary yet';
            }
            content.appendChild(preview);
        }

        card.appendChild(content);

        // ── Footer ──
        const footer = document.createElement('div');
        footer.className = 'beat-footer';
        const statusDiv = document.createElement('div');
        const isReady = beat.status === 'ready';
        statusDiv.className = `beat-status ${isReady ? 'ready' : 'wip'}`;
        statusDiv.title = 'Click to toggle status (Ready / WIP)';
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
        versionDiv.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg> v${vCount}`;
        versionDiv.onmousedown = (e) => {
            e.stopPropagation();
            if (!engine.current.selectedBeatIds.has(beat.id)) {
                engine.current.selectedBeatIds.clear();
                engine.current.selectedBeatIds.add(beat.id);
                renderBeats();
            }
            showContextMenu(e.clientX, e.clientY, beat.id, null, null);
        };
        
        footer.appendChild(statusDiv);
        footer.appendChild(versionDiv);

        card.appendChild(footer);

        card.tabIndex = 0;
        card.onmousedown = (e) => onBeatMouseDown(e, beat.id);
        card.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!engine.current.selectedBeatIds.has(beat.id)) {
                engine.current.selectedBeatIds.clear();
                engine.current.selectedBeatIds.add(beat.id);
                engine.current.selectedAnnoIds.clear();
                renderBeats();
            }
            showContextMenu(e.clientX, e.clientY, beat.id, null, null);
        };
        card.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                onEditBeat(beat.id);
            }
        };
        
        badge.onmousedown = (e) => e.stopPropagation();
        badge.onclick = (e) => { e.stopPropagation(); openSceneNumPopup(e, beat.id); };

        beatsLayer.appendChild(card);
    });
    renderSelectionOverlay();
  };

  const openSceneNumPopup = (e: MouseEvent, id: number) => {
      const beat = engine.current.beats.find(b => b.id === id);
      const parentRect = containerRef.current!.getBoundingClientRect();
      setSceneNumPopup({
          beatId: id,
          x: e.clientX - parentRect.left,
          y: e.clientY - parentRect.top + 12,
          value: beat?.sceneNumber || ''
      });
      hideContextMenu();
  };

  const commitSceneNum = () => {
      if (!sceneNumPopup) return;
      captureSnapshot();
      const val = sceneNumPopup.value.trim();
      const newSceneNumber = val === '' ? undefined : val;
      updateBeat(sceneNumPopup.beatId, { sceneNumber: newSceneNumber });
      engine.current.beats = engine.current.beats.map(b => b.id === sceneNumPopup.beatId ? { ...b, sceneNumber: newSceneNumber } : b);
      setSceneNumPopup(null);
      renderBeats();
  };

  const computeDuplicateIds = () => {
      const counts: Record<string, number> = {};
      engine.current.beats.forEach(b => {
          const num = b.sceneNumber && b.sceneNumber.trim() !== '' ? b.sceneNumber.trim().toUpperCase() : null;
          if (num) counts[num] = (counts[num] || 0) + 1;
      });
      const ids = new Set<number>();
      engine.current.beats.forEach(b => {
          const num = b.sceneNumber && b.sceneNumber.trim() !== '' ? b.sceneNumber.trim().toUpperCase() : null;
          if (num && counts[num] > 1) ids.add(b.id);
      });
      engine.current.errorIds = ids;
  };

  const renderAnnotations = () => {
      if (!containerRef.current) return;
      const annotationsLayer = containerRef.current.querySelector('#annotations-layer');
      if (!annotationsLayer) return;
      
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
      });
      annotationsLayer.appendChild(defs); 

      engine.current.annotations.forEach(anno => {
          if (anno.type === 'text' || anno.type === 'bigtext' || anno.type === 'audio') return; 
          const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
          if (engine.current.selectedAnnoIds.has(anno.id)) {
              group.setAttribute("data-selected", "true");
              const ab = getAnnoBounds(anno);
              const sel = document.createElementNS("http://www.w3.org/2000/svg", "rect");
              sel.setAttribute("x", (ab.minX - 4).toString());
              sel.setAttribute("y", (ab.minY - 4).toString());
              sel.setAttribute("width", (ab.maxX - ab.minX + 8).toString());
              sel.setAttribute("height", (ab.maxY - ab.minY + 8).toString());
              sel.setAttribute("rx", "6");
              sel.setAttribute("fill", isLight ? "rgba(245,166,35,0.07)" : "rgba(245,166,35,0.10)");
              sel.setAttribute("stroke", "rgba(245,166,35,0.6)");
              sel.setAttribute("stroke-width", "1.5");
              sel.setAttribute("stroke-dasharray", "5,5");
              sel.setAttribute("pointer-events", "none");
              group.appendChild(sel);
          }
          const annoRot = anno.rotation || 0;
          if (annoRot !== 0) {
              const ab = getAnnoBounds(anno);
              group.setAttribute('transform', `rotate(${annoRot}, ${(ab.minX + ab.maxX) / 2}, ${(ab.minY + ab.maxY) / 2})`);
          }
          
          let el: SVGElement | null = null;
          let hitEl: SVGElement | null = null; 
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
                  selectAnnoOnMouseDown(e, anno.id);
              };
          }

          if (el) {
              group.setAttribute("data-type", "annotation");
              group.setAttribute("data-id", anno.id.toString());
              if (hitEl) group.appendChild(hitEl);
              group.appendChild(el);
              annotationsLayer.appendChild(group);
          }
      });
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
          div.style.left = '0px';
          div.style.top = '0px';
          div.style.transform = `translate(${group.x}px, ${group.y}px)`;
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

  const deleteAnnotation = (id: number) => {
      captureSnapshot();
      setAnnotations(prev => prev.filter(a => a.id !== id));
      engine.current.annotations = engine.current.annotations.filter(a => a.id !== id);
      engine.current.selectedAnnoIds.delete(id);
      renderCanvas();
  };

  const handleClearAll = () => {
      captureSnapshot();
      if (engine.current.selectedAnnoIds.size > 0) {
          const toDelete = Array.from(engine.current.selectedAnnoIds);
          setAnnotations(prev => prev.filter(a => !toDelete.includes(a.id)));
          engine.current.annotations = engine.current.annotations.filter(a => !toDelete.includes(a.id));
          engine.current.selectedAnnoIds.clear();
          renderCanvas();
          return;
      }
      setAnnotations(prev => prev.filter(a => (a.boardId || 0) !== activeBoardId));
      engine.current.annotations = engine.current.annotations.filter(a => (a.boardId || 0) !== activeBoardId);
      engine.current.selectedAnnoIds.clear();
      renderCanvas();
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

  const applyAnnoResize = (anno: Annotation, target: { corner: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w', start: Annotation, startMouseX: number, startMouseY: number, startStates?: { id: number, start: Annotation }[] }, e: MouseEvent) => {
      const start = target.start;
      const b = getAnnoBounds(start);
      const mdX = (e.clientX - target.startMouseX) / engine.current.scale;
      const mdY = (e.clientY - target.startMouseY) / engine.current.scale;
      const corner = target.corner;
      let minX = b.minX, minY = b.minY, maxX = b.maxX, maxY = b.maxY;

      if (corner.includes('e')) maxX = b.maxX + mdX;
      if (corner.includes('w')) minX = b.minX + mdX;
      if (corner.includes('s')) maxY = b.maxY + mdY;
      if (corner.includes('n')) minY = b.minY + mdY;

      if (!e.shiftKey) {
          const threshold = SNAP_THRESHOLD / engine.current.scale;
          const { xTargets, yTargets } = collectSnapTargets(new Set([anno.id]));
          let guideX: number | null = null, guideY: number | null = null;
          if (corner.includes('e')) { const s = snapEdgeToRuler(maxX, xTargets, threshold); maxX = s.value; guideX = s.guide; }
          if (corner.includes('w')) { const s = snapEdgeToRuler(minX, xTargets, threshold); minX = s.value; guideX = s.guide; }
          if (corner.includes('s')) { const s = snapEdgeToRuler(maxY, yTargets, threshold); maxY = s.value; guideY = s.guide; }
          if (corner.includes('n')) { const s = snapEdgeToRuler(minY, yTargets, threshold); minY = s.value; guideY = s.guide; }
          showSnapGuides(guideX, guideY);
      }

      const minW = anno.type === 'image' ? 40 : 10;
      const minH = anno.type === 'image' ? 30 : 10;
      if (maxX - minX < minW) { if (corner.includes('w')) minX = maxX - minW; else maxX = minX + minW; }
      if (maxY - minY < minH) { if (corner.includes('n')) minY = maxY - minH; else maxY = minY + minH; }

      const startW = Math.max(1, b.maxX - b.minX);
      const startH = Math.max(1, b.maxY - b.minY);
      const ratioX = (maxX - minX) / startW;
      const ratioY = (maxY - minY) / startH;

      const states = target.startStates || [{ id: anno.id, start }];
      states.forEach((s: any) => {
          const m = engine.current.annotations.find(a => a.id === s.id);
          if (!m) return;
          const currStart = s.start;
          const currBounds = getAnnoBounds(currStart);

          if (m.type === 'rect' || m.type === 'image' || m.type === 'line' || m.type === 'arrow') {
              m.w = Math.max(10, Math.round((currStart.w || 0) * ratioX));
              m.h = Math.max(10, Math.round((currStart.h || 0) * ratioY));
              if (corner.includes('e')) {
                  // Keep x
              } else if (corner.includes('w')) {
                  m.x = Math.round(maxX - (b.maxX - (currStart.x || 0)) * ratioX);
              }
              if (corner.includes('s')) {
                  // Keep y
              } else if (corner.includes('n')) {
                  m.y = Math.round(maxY - (b.maxY - (currStart.y || 0)) * ratioY);
              }
          } else if (m.type === 'circle') {
              const cx = currStart.cx !== undefined ? currStart.cx : (currStart.x || 0) + (currStart.w || 0) / 2;
              const cy = currStart.cy !== undefined ? currStart.cy : (currStart.y || 0) + (currStart.h || 0) / 2;
              const rx = currStart.rx !== undefined ? currStart.rx : Math.hypot(currStart.w || 0, currStart.h || 0) / 2;
              m.rx = Math.max(5, Math.round(rx * Math.min(ratioX, ratioY)));
              (m as any).ry = m.rx;
              if (corner.includes('w')) {
                  m.cx = Math.round(maxX - (b.maxX - cx) * ratioX);
              }
              if (corner.includes('n')) {
                  m.cy = Math.round(maxY - (b.maxY - cy) * ratioY);
              }
          } else if (m.type === 'pencil' && Array.isArray(currStart.points) && currStart.points.length > 0) {
              const scaled = currStart.points.map((p: any) => {
                  let px = p.x;
                  let py = p.y;
                  if (corner.includes('w')) {
                      px = maxX - (b.maxX - p.x) * ratioX;
                  } else {
                      px = minX + (p.x - b.minX) * ratioX;
                  }
                  if (corner.includes('n')) {
                      py = maxY - (b.maxY - p.y) * ratioY;
                  } else {
                      py = minY + (p.y - b.minY) * ratioY;
                  }
                  return {
                      x: Math.round(px),
                      y: Math.round(py)
                  };
              });
              m.points = scaled;
              m.d = getSmoothedPath(scaled);
          }
      });
  };

  const scheduleAnnoRender = () => {
      if (annoRafPendingRef.current) return;
      annoRafPendingRef.current = true;
      requestAnimationFrame(() => {
          annoRafPendingRef.current = false;
          renderAnnotations();
          renderText();
      });
  };

  const getSvgPoint = (e: MouseEvent | DragEvent) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - engine.current.panX) / engine.current.scale;
      const y = (e.clientY - rect.top - engine.current.panY) / engine.current.scale;
      return { x, y };
  };

  const GRID_SIZE = 50;
  const SNAP_THRESHOLD = 5;

  const updateMultiselectHighlighter = () => {
    if (!containerRef.current) return;
    const hl = containerRef.current.querySelector('#multiselect-highlighter') as HTMLElement | null;
    if (!hl) return;

    const selectedAnnos = engine.current.annotations.filter(a => engine.current.selectedAnnoIds.has(a.id));

    if (selectedAnnos.length <= 1) {
      hl.style.display = 'none';
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedAnnos.forEach(a => {
      const bounds = getAnnoBounds(a);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    });

    if (minX === Infinity || minY === Infinity) {
      hl.style.display = 'none';
      return;
    }

    const { panY, scale } = engine.current;
    const viewport = containerRef.current.querySelector('#viewport') as HTMLElement | null;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();

    const screenL = rect.left + minX * scale;
    const screenT = rect.top + panY + minY * scale;
    const screenW = (maxX - minX) * scale;
    const screenH = (maxY - minY) * scale;

    hl.style.left = `${screenL}px`;
    hl.style.top = `${screenT}px`;
    hl.style.width = `${screenW}px`;
    hl.style.height = `${screenH}px`;
    hl.style.display = 'block';
  };

  const applyViewTransform = () => {
      const surface = containerRef.current?.querySelector('#canvas-surface') as HTMLElement | null;
      if (surface) {
          engine.current.panX = 0;
          let maxY = 0;
          engine.current.beats.forEach(b => {
              const bh = b.h || 150;
              maxY = Math.max(maxY, b.y + bh);
          });
          engine.current.annotations.forEach(a => {
              const bounds = getAnnoBounds(a);
              maxY = Math.max(maxY, bounds.maxY);
          });

          const viewport = containerRef.current?.querySelector('#viewport');
          const minHeight = viewport ? viewport.clientHeight : 800;
          const targetHeight = Math.max(minHeight, maxY + 400);
          surface.style.height = `${targetHeight}px`;

          engine.current.panY = Math.min(0, engine.current.panY);
          surface.style.transform = `translate(0px, ${engine.current.panY}px) scale(${engine.current.scale})`;
      }
      renderSelectionOverlay();
      updateMultiselectHighlighter();
  };

  const zoomAt = (clientX: number, clientY: number, factor: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const prev = engine.current.scale;
      const next = 1.0;
      const real = next / prev;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      engine.current.panX = mx - (mx - engine.current.panX) * real;
      engine.current.panY = my - (my - engine.current.panY) * real;
      engine.current.scale = next;
      setZoomPercent(Math.round(next * 100));
      applyViewTransform();
  };

  const zoomIn = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.25);
  };

  const zoomOut = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.8);
  };

  const zoomReset = () => {
      engine.current.scale = 1;
      setZoomPercent(100);
      applyViewTransform();
  };

  const renderSelectionOverlay = () => {
      if (!containerRef.current) return;
      const layer = containerRef.current.querySelector('#handles-layer') as HTMLElement | null;
      if (!layer) return;
      layer.innerHTML = '';
      const rect = containerRef.current.getBoundingClientRect();
      const toScreen = (wx: number, wy: number) => ({
          x: rect.left + engine.current.panX + wx * engine.current.scale,
          y: rect.top + engine.current.panY + wy * engine.current.scale
      });

      // ── Annotation selection handles (rotate + resize for drawings, font-size for text) ──
      engine.current.selectedAnnoIds.forEach(id => {
          const anno = engine.current.annotations.find(a => a.id === id);
          if (!anno) return;
          const b = getAnnoBounds(anno);
          const acx = (b.minX + b.maxX) / 2;
          const acy = (b.minY + b.maxY) / 2;

          if (anno.type === 'text' || anno.type === 'bigtext') {
              const p = toScreen(acx, b.maxY + 14);
              const fEl = document.createElement('div');
              fEl.className = 'font-size-handle';
              fEl.style.left = `${p.x}px`;
              fEl.style.top = `${p.y}px`;
              fEl.title = 'Drag to resize font';
              fEl.innerText = 'Aa';
              fEl.onmousedown = (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (toolMode !== 'none' && toolMode !== 'eraser') return;
                  const isBig = anno.type === 'bigtext';
                  engine.current.textResizeTarget = {
                      id: anno.id,
                      startFontSize: anno.fontSize || (isBig ? 26 : 14),
                      startMouseY: e.clientY
                  };
                  engine.current.isDragging = true;
                  if (containerRef.current) containerRef.current.style.cursor = 'ns-resize';
              };
              layer.appendChild(fEl);
          } else {
              const rot = ((anno.rotation || 0) * Math.PI) / 180;
              const cos = Math.cos(rot);
              const sin = Math.sin(rot);
              const rotPt = (dx: number, dy: number) => ({
                  x: acx + dx * cos - dy * sin,
                  y: acy + dx * sin + dy * cos
              });
              const bw = b.maxX - b.minX;
              const bh = b.maxY - b.minY;
              const isLine = anno.type === 'line' || anno.type === 'arrow';

              const addAnnoHandle = (wx: number, wy: number, cursor: string, corner: string) => {
                  const hEl = document.createElement('div');
                  hEl.className = 'anno-handle';
                  const p = toScreen(wx, wy);
                  hEl.style.left = `${p.x}px`;
                  hEl.style.top = `${p.y}px`;
                  hEl.style.cursor = cursor;
                  hEl.onmousedown = (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (toolMode !== 'none' && toolMode !== 'eraser') return;
                      const selectedAnnos = engine.current.annotations.filter(a => engine.current.selectedAnnoIds.has(a.id));
                      const startStates = selectedAnnos.map(a => ({
                          id: a.id,
                          start: JSON.parse(JSON.stringify(a))
                      }));
                      engine.current.annoResizeTarget = {
                          id: anno.id,
                          corner: corner as 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w',
                          start: JSON.parse(JSON.stringify(anno)),
                          startStates: startStates.length > 0 ? startStates : [{ id: anno.id, start: JSON.parse(JSON.stringify(anno)) }],
                          startMouseX: e.clientX,
                          startMouseY: e.clientY
                      };
                      engine.current.isDragging = true;
                      if (containerRef.current) containerRef.current.style.cursor = cursor;
                  };
                  return hEl;
              };

              const shapeCorners: [string, number, number, string][] = isLine
                  ? [
                      ['nw', -bw / 2, -bh / 2, 'nw-resize'],
                      ['ne', bw / 2, -bh / 2, 'ne-resize'],
                      ['sw', -bw / 2, bh / 2, 'sw-resize'],
                      ['se', bw / 2, bh / 2, 'se-resize']
                  ]
                  : [
                      ['nw', -bw / 2, -bh / 2, 'nw-resize'],
                      ['n', 0, -bh / 2, 'n-resize'],
                      ['ne', bw / 2, -bh / 2, 'ne-resize'],
                      ['e', bw / 2, 0, 'e-resize'],
                      ['se', bw / 2, bh / 2, 'se-resize'],
                      ['s', 0, bh / 2, 's-resize'],
                      ['sw', -bw / 2, bh / 2, 'sw-resize'],
                      ['w', -bw / 2, 0, 'w-resize']
                  ];
              shapeCorners.forEach(([corner, dx, dy, cursor]) => {
                  const pt = rotPt(dx, dy);
                  layer.appendChild(addAnnoHandle(pt.x, pt.y, cursor, corner));
              });

              const rt = rotPt(0, -bh / 2 - 26);
              const rp = toScreen(rt.x, rt.y);
              const rEl = document.createElement('div');
              rEl.className = 'anno-handle anno-rotate-handle';
              rEl.style.left = `${rp.x}px`;
              rEl.style.top = `${rp.y}px`;
              rEl.title = 'Rotate';
              rEl.onmousedown = (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (toolMode !== 'none' && toolMode !== 'eraser') return;
                  const { x: wx, y: wy } = getSvgPoint(e);
                  engine.current.annoRotateTarget = {
                      id: anno.id,
                      centerX: acx,
                      centerY: acy,
                      startAngle: anno.rotation || 0,
                      startMouseAngle: (Math.atan2(wy - acy, wx - acx) * 180) / Math.PI
                  };
                  engine.current.isDragging = true;
              };
              layer.appendChild(rEl);
          }
      });

      layer.style.display = (engine.current.selectedBeatIds.size > 0 || engine.current.selectedAnnoIds.size > 0) ? 'block' : 'none';
  };

  const showSnapGuides = (guideX: number | null, guideY: number | null) => {
      const c = containerRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const v = c.querySelector('#snap-guide-v') as HTMLElement | null;
      const h = c.querySelector('#snap-guide-h') as HTMLElement | null;
      if (v) {
          if (guideX === null) {
              v.style.display = 'none';
          } else {
              v.style.display = 'block';
              v.style.left = `${rect.left + engine.current.panX + guideX * engine.current.scale}px`;
          }
      }
      if (h) {
          if (guideY === null) {
              h.style.display = 'none';
          } else {
              h.style.display = 'block';
              h.style.top = `${rect.top + engine.current.panY + guideY * engine.current.scale}px`;
          }
      }
  };

  const clearSnapGuides = () => showSnapGuides(null, null);

  const computeSnap = (dragIds: Set<number>, rawDx: number, rawDy: number) => {
      const beats = engine.current.beats;
      const drags = beats.filter(b => dragIds.has(b.id));
      if (drags.length === 0) return { dx: rawDx, dy: rawDy, guideX: null, guideY: null };

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      drags.forEach(b => {
          const bw = b.w || 340;
          const bh = b.h || 150;
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + bw);
          maxY = Math.max(maxY, b.y + bh);
      });

      const pL = minX + rawDx, pT = minY + rawDy;
      const pR = maxX + rawDx, pB = maxY + rawDy;
      const pCX = (pL + pR) / 2, pCY = (pT + pB) / 2;

      const threshold = SNAP_THRESHOLD / engine.current.scale;
      const xTargets: number[] = [];
      const yTargets: number[] = [];
      beats.forEach(b => {
          if (dragIds.has(b.id)) return;
          const bw = b.w || 340;
          const bh = b.h || 150;
          xTargets.push(b.x, b.x + bw / 2, b.x + bw);
          yTargets.push(b.y, b.y + bh / 2, b.y + bh);
      });
      engine.current.groups.forEach(g => {
          xTargets.push(g.x, g.x + g.width / 2, g.x + g.width);
          yTargets.push(g.y, g.y + g.height / 2, g.y + g.height);
      });

      let bestSnapX = Infinity, bestSnapY = Infinity;
      let guideX: number | null = null, guideY: number | null = null;

      const considerX = (myCoord: number, target: number) => {
          const d = target - myCoord;
          if (Math.abs(d) <= threshold && Math.abs(d) < Math.abs(bestSnapX)) {
              bestSnapX = d;
              guideX = target;
          }
      };
      xTargets.forEach(t => { considerX(pL, t); considerX(pCX, t); considerX(pR, t); });

      const considerY = (myCoord: number, target: number) => {
          const d = target - myCoord;
          if (Math.abs(d) <= threshold && Math.abs(d) < Math.abs(bestSnapY)) {
              bestSnapY = d;
              guideY = target;
          }
      };
      yTargets.forEach(t => { considerY(pT, t); considerY(pCY, t); considerY(pB, t); });

      const gx = Math.round(pL / GRID_SIZE) * GRID_SIZE;
      if (Math.abs(gx - pL) <= threshold && Math.abs(gx - pL) < Math.abs(bestSnapX)) {
          bestSnapX = gx - pL;
          guideX = gx;
      }
      const gy = Math.round(pT / GRID_SIZE) * GRID_SIZE;
      if (Math.abs(gy - pT) <= threshold && Math.abs(gy - pT) < Math.abs(bestSnapY)) {
          bestSnapY = gy - pT;
          guideY = gy;
      }

      return {
          dx: rawDx + (Number.isFinite(bestSnapX) ? bestSnapX : 0),
          dy: rawDy + (Number.isFinite(bestSnapY) ? bestSnapY : 0),
          guideX,
          guideY
      };
  };

  const collectSnapTargets = (excludeAnnoIds: Set<number>) => {
      const xTargets: number[] = [];
      const yTargets: number[] = [];
      engine.current.beats.forEach(b => {
          const bw = b.w || 340;
          const bh = b.h || 150;
          xTargets.push(b.x, b.x + bw / 2, b.x + bw);
          yTargets.push(b.y, b.y + bh / 2, b.y + bh);
      });
      engine.current.groups.forEach(g => {
          xTargets.push(g.x, g.x + g.width / 2, g.x + g.width);
          yTargets.push(g.y, g.y + g.height / 2, g.y + g.height);
      });
      engine.current.annotations.forEach(a => {
          if (excludeAnnoIds.has(a.id)) return;
          const ab = getAnnoBounds(a);
          xTargets.push(ab.minX, (ab.minX + ab.maxX) / 2, ab.maxX);
          yTargets.push(ab.minY, (ab.minY + ab.maxY) / 2, ab.maxY);
      });
      return { xTargets, yTargets };
  };

  const snapEdgeToRuler = (value: number, targets: number[], threshold: number) => {
      let best = Infinity, bestGuide: number | null = null;
      targets.forEach(t => {
          const d = t - value;
          if (Math.abs(d) <= threshold && Math.abs(d) < Math.abs(best)) {
              best = d;
              bestGuide = t;
          }
      });
      const g = Math.round(value / GRID_SIZE) * GRID_SIZE;
      const d = g - value;
      if (Math.abs(d) <= threshold && Math.abs(d) < Math.abs(best)) {
          best = d;
          bestGuide = g;
      }
      if (Number.isFinite(best)) return { value: value + best, guide: bestGuide };
      return { value, guide: null };
  };

  const computeAnnoSnap = (annoIds: Set<number>, rawDx: number, rawDy: number) => {
      const drags = engine.current.annotations.filter(a => annoIds.has(a.id));
      if (drags.length === 0) return { dx: rawDx, dy: rawDy, guideX: null as number | null, guideY: null as number | null };

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      drags.forEach(a => {
          const ab = getAnnoBounds(a);
          minX = Math.min(minX, ab.minX);
          minY = Math.min(minY, ab.minY);
          maxX = Math.max(maxX, ab.maxX);
          maxY = Math.max(maxY, ab.maxY);
      });

      const pL = minX + rawDx, pT = minY + rawDy;
      const pR = maxX + rawDx, pB = maxY + rawDy;
      const pCX = (pL + pR) / 2, pCY = (pT + pB) / 2;

      const threshold = SNAP_THRESHOLD / engine.current.scale;
      const { xTargets, yTargets } = collectSnapTargets(annoIds);

      let bestSnapX = Infinity, bestSnapY = Infinity;
      let guideX: number | null = null, guideY: number | null = null;

      const considerX = (myCoord: number, target: number) => {
          const d = target - myCoord;
          if (Math.abs(d) <= threshold && Math.abs(d) < Math.abs(bestSnapX)) {
              bestSnapX = d;
              guideX = target;
          }
      };
      xTargets.forEach(t => { considerX(pL, t); considerX(pCX, t); considerX(pR, t); });

      const considerY = (myCoord: number, target: number) => {
          const d = target - myCoord;
          if (Math.abs(d) <= threshold && Math.abs(d) < Math.abs(bestSnapY)) {
              bestSnapY = d;
              guideY = target;
          }
      };
      yTargets.forEach(t => { considerY(pT, t); considerY(pCY, t); considerY(pB, t); });

      const gx = Math.round(pL / GRID_SIZE) * GRID_SIZE;
      if (Math.abs(gx - pL) <= threshold && Math.abs(gx - pL) < Math.abs(bestSnapX)) {
          bestSnapX = gx - pL;
          guideX = gx;
      }
      const gy = Math.round(pT / GRID_SIZE) * GRID_SIZE;
      if (Math.abs(gy - pT) <= threshold && Math.abs(gy - pT) < Math.abs(bestSnapY)) {
          bestSnapY = gy - pT;
          guideY = gy;
      }

      return {
          dx: rawDx + (Number.isFinite(bestSnapX) ? bestSnapX : 0),
          dy: rawDy + (Number.isFinite(bestSnapY) ? bestSnapY : 0),
          guideX,
          guideY
      };
  };

  const onBeatMouseDown = (e: MouseEvent, id: number) => {
      if (isSpacePressedRef.current) return;
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      if (e.button === 2) {
          e.preventDefault();
          e.stopPropagation();
          if (!engine.current.selectedBeatIds.has(id)) {
              engine.current.selectedBeatIds.clear();
              engine.current.selectedBeatIds.add(id);
              engine.current.selectedAnnoIds.clear();
              renderBeats();
          }
          showContextMenu(e.clientX, e.clientY, id, null, null);
          return;
      }
      if (e.button !== 0) return;
      // @ts-ignore
      if(e.target.classList.contains('beat-title') || e.target.classList.contains('seq-badge') || e.target.classList.contains('beat-status') || e.target.classList.contains('beat-version') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
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

      engine.current.selectedAnnoIds.clear();
      if (e.ctrlKey || e.metaKey) {
          if (engine.current.selectedBeatIds.has(id)) engine.current.selectedBeatIds.delete(id);
          else engine.current.selectedBeatIds.add(id);
          renderBeats(); return;
      } else {
          if (!engine.current.selectedBeatIds.has(id)) { engine.current.selectedBeatIds.clear(); engine.current.selectedBeatIds.add(id); engine.current.selectedAnnoIds.clear(); renderBeats(); }
      }
      engine.current.dragTarget = id; engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX; engine.current.lastMouseY = e.clientY;
  };

  const onGroupHeaderMouseDown = (e: MouseEvent, id: number) => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      const group = engine.current.groups.find(g => g.id === id);
      if (!group) return;
      engine.current.dragGroupTarget = id; engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX; engine.current.lastMouseY = e.clientY;
      engine.current.selectedBeatIds.clear();
      engine.current.selectedAnnoIds.clear();
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
  };

  const onGroupResizeMouseDown = (e: MouseEvent, id: number) => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      engine.current.groupResizeTarget = id; engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX; engine.current.lastMouseY = e.clientY;
  };

  const handleTextMouseDown = (e: React.MouseEvent, id: number) => {
      if (editingAnnoId === id) return;
      if (toolMode === 'text' || toolMode === 'bigtext') { e.stopPropagation(); setEditingAnnoId(id); setToolMode('none'); return; }
      if (toolMode !== 'none') return;
      e.stopPropagation();
      engine.current.selectedAnnoIds.clear();
      engine.current.selectedAnnoIds.add(id);
      engine.current.selectedBeatIds.clear();
      renderBeats();
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

  const showContextMenu = (clientX: number, clientY: number, beatId: number | null, groupId: number | null, annotationId: number | null) => {
      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const { x: worldX, y: worldY } = getSvgPoint({ clientX, clientY } as MouseEvent);
          setCtxMenu({ x: clientX - rect.left, y: clientY - rect.top, worldX, worldY, beatId, groupId, annotationId });
      }
  };

  const hideContextMenu = () => { setCtxMenu(null); };

  const handleDelete = () => {
      captureSnapshot();
      if (engine.current.selectedBeatIds.size > 0) {
          const toDelete = Array.from(engine.current.selectedBeatIds);
          const newBeats = beats.filter(b => !toDelete.includes(b.id));
          setBeats(newBeats);
          engine.current.beats = engine.current.beats.filter(b => !toDelete.includes(b.id));
          engine.current.selectedBeatIds.clear();
          renderBeats();
      } else if (engine.current.selectedAnnoIds.size > 0) {
          const toDelete = Array.from(engine.current.selectedAnnoIds);
          setAnnotations(prev => prev.filter(a => !toDelete.includes(a.id)));
          engine.current.annotations = engine.current.annotations.filter(a => !toDelete.includes(a.id));
          engine.current.selectedAnnoIds.clear();
          renderCanvas();
      } else if (ctxMenu) {
          if (ctxMenu.beatId !== null && ctxMenu.beatId !== undefined) {
              const toDelete = [ctxMenu.beatId];
              setBeats(beats.filter(b => !toDelete.includes(b.id)));
              engine.current.beats = engine.current.beats.filter(b => !toDelete.includes(b.id));
              renderBeats();
          } else if (ctxMenu.groupId !== null && ctxMenu.groupId !== undefined) {
              removeGroup(ctxMenu.groupId);
          } else if (ctxMenu.annotationId !== null && ctxMenu.annotationId !== undefined) {
              deleteAnnotation(ctxMenu.annotationId);
          }
      }
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
    if (clipboard.length === 0) return;
    captureSnapshot();

    let minX = Infinity, minY = Infinity;
    clipboard.forEach(b => {
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
    });

    // Paste at context menu position, or fall back to current viewport center
    const worldX = ctxMenu
      ? ctxMenu.worldX
      : (-engine.current.panX + (containerRef.current?.clientWidth ?? 600) / 2) / engine.current.scale;
    const worldY = ctxMenu
      ? ctxMenu.worldY
      : (-engine.current.panY + (containerRef.current?.clientHeight ?? 400) / 2) / engine.current.scale;

    let startId = nextId;
    const pasted = clipboard.map((b, i) => ({
      ...JSON.parse(JSON.stringify(b)),
      id: startId + i,
      x: worldX + (b.x - minX),
      y: worldY + (b.y - minY),
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

Beats: ${JSON.stringify(beatSummaries)}`;

              const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
              const response = await ai.models.generateContent({
                  model: 'gemini-2.0-flash',
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
          const startX = 80;
          const startY = 80;
          const COL_WIDTH = 440;
          const ROW_HEIGHT = 320;
          const perRow = Math.max(1, Math.floor((containerRef.current?.clientWidth || 1200) / COL_WIDTH));

          const sceneKey = (s: string | undefined) => {
              const t = (s || '').trim().toUpperCase();
              const m = /^(\d+)(.*)$/.exec(t);
              if (m) return { n: parseInt(m[1], 10), suffix: m[2] };
              return { n: Number.MAX_SAFE_INTEGER, suffix: t };
          };
          const sortedBeats = [...boardBeats].sort((a, b) => {
              const ka = sceneKey(a.sceneNumber);
              const kb = sceneKey(b.sceneNumber);
              if (ka.n !== kb.n) return ka.n - kb.n;
              if (ka.suffix !== kb.suffix) return ka.suffix < kb.suffix ? -1 : 1;
              return (a.y - b.y) || (a.x - b.x);
          });

          sortedBeats.forEach((b, idx) => {
              const gPos = beatOrderMap[b.id];
              const r = gPos?.row ?? Math.floor(idx / perRow);
              const c = gPos?.col ?? (idx % perRow);
              finalPositions[b.id] = {
                  x: startX + c * COL_WIDTH,
                  y: startY + r * ROW_HEIGHT
              };
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
                  const charX = groupBeats.length > 1 ? groupBeats[1].x - 65 : focalBeat.x + 365;
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
                      const spotAnnos = createFilmSketches(focalBeat.x + 360, focalBeat.y + 90, 'spotlight', '#ef4444', activeBoardId, annoIdCounter);
                      annoIdCounter += spotAnnos.length + 5;
                      newAnnos.push(...spotAnnos);
                  }
              }
          });

          // 3. Directional Momentum Arrows in the gaps between consecutive scene beats
          for (let i = 0; i < sortedBeats.length - 1; i++) {
              const fromB = sortedBeats[i];
              const toB = sortedBeats[i + 1];
              const gap = toB.x - (fromB.x + 340);
              // If there is a generous horizontal gap, draw a flow momentum arrow
              if (gap >= 120 && Math.abs(fromB.y - toB.y) < 80) {
                  newAnnos.push({
                      id: annoIdCounter++,
                      type: 'arrow',
                      x: fromB.x + 355,
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

          // 4. Add suggested thematic script callouts and visual shape annotations from Gemini
          suggestedAnnotations.forEach(sa => {
              const targetBeat = updatedBeats.find(b => b.id === sa.relBeatId);
              if (targetBeat) {
                  const color = ensureVibrantLightColor(sa.color, '#38bdf8');
                  if (sa.type === 'circle') {
                      newAnnos.push({
                          id: annoIdCounter++,
                          type: 'circle',
                          cx: targetBeat.x + 170,
                          cy: targetBeat.y + 80,
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
                          w: 372,
                          h: 192,
                          color: color,
                          strokeWidth: 2,
                          strokeStyle: 'solid',
                          boardId: activeBoardId
                      });
                  } else if (sa.type === 'arrow') {
                      newAnnos.push({
                          id: annoIdCounter++,
                          type: 'arrow',
                          x: targetBeat.x + 350,
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
                          y: targetBeat.y + 175,
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
          renderText();

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

  // Stable ref for keyboard handler functions — prevents stale closures in the event listener useEffect
  const kbRef = useRef({
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleDelete,
    undo,
    redo,
  });
  // Keep the ref current on every render (intentionally no deps array)
  useEffect(() => {
    kbRef.current = { handleCopy, handlePaste, handleDuplicate, handleDelete, undo, redo };
  });

  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const handleMouseDown = (e: MouseEvent) => {
          // @ts-ignore
          if (e.target.classList.contains('text-annotation-input')) return;
          if (editingAnnoId !== null) { setEditingAnnoId(null); captureSnapshot(); }
          // @ts-ignore
          const target = e.target as HTMLElement;
          if (target.closest('.ai-generator-container') || target.closest('.drawing-toolbar-container') || target.closest('#context-menu') || target.closest('.board-switcher') || target.closest('.zoom-control')) return;

          if ((e.button === 1) || (isSpacePressedRef.current && e.button === 0)) {
              e.preventDefault();
              hideContextMenu();
              engine.current.isPanning = true;
              engine.current.lastMouseX = e.clientX;
              engine.current.lastMouseY = e.clientY;
              container.classList.add('is-panning');
              return;
          }

          if (toolMode === 'none') {
              if (target.closest('.beat-card') || target.closest('.group-header') || target.closest('.group-resize-handle') || target.closest('.annotation-hit-area') || target.closest('.text-annotation-card') || target.closest('.seq-badge') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
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
          if (engine.current.isPanning) {
              engine.current.panX += e.clientX - engine.current.lastMouseX;
              engine.current.panY += e.clientY - engine.current.lastMouseY;
              engine.current.lastMouseX = e.clientX;
              engine.current.lastMouseY = e.clientY;
              applyViewTransform();
              return;
          }

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
              if (engine.current.dragTarget !== null || engine.current.beatResizeTarget !== null || engine.current.dragGroupTarget !== null || engine.current.groupResizeTarget !== null || engine.current.dragAnnotationId !== null || engine.current.annoResizeTarget !== null || engine.current.annoRotateTarget !== null || engine.current.textResizeTarget !== null) {
                  const hl = container.querySelector('#handles-layer') as HTMLElement | null;
                  if (hl && hl.style.display !== 'none') hl.style.display = 'none';
              }

              const dx = (e.clientX - engine.current.lastMouseX) / engine.current.scale;
              const dy = (e.clientY - engine.current.lastMouseY) / engine.current.scale;
              engine.current.lastMouseX = e.clientX;
              engine.current.lastMouseY = e.clientY;

              if (engine.current.dragTarget !== null) {
                  const targets = engine.current.selectedBeatIds.has(engine.current.dragTarget)
                      ? engine.current.selectedBeatIds
                      : new Set([engine.current.dragTarget]);
                  const snap = { dx, dy, guideX: null as number | null, guideY: null as number | null };
                  showSnapGuides(null, null);
                  const viewportWidth = containerRef.current?.querySelector('#viewport')?.clientWidth ?? window.innerWidth;
                  engine.current.beats.forEach(b => {
                      if (targets.has(b.id)) {
                          const bw = b.w || 340;
                          const maxAllowedX = (viewportWidth / engine.current.scale) - bw;
                          b.x = Math.max(0, Math.min(maxAllowedX, b.x + snap.dx));
                          b.y = Math.max(0, b.y + snap.dy);
                          const cardEl = container.querySelector(`.beat-card[data-id="${b.id}"]`) as HTMLElement;
                          if (cardEl) {
                              cardEl.style.transform = `translate(${b.x}px, ${b.y}px)`;
                          }
                      }
                  });
                  updateMultiselectHighlighter();
              } else if (engine.current.beatResizeTarget !== null) {
                  const target = engine.current.beatResizeTarget;
                  const beat = engine.current.beats.find(bb => bb.id === target.id);
                  if (beat) {
                      const mdX = (e.clientX - target.startMouseX) / engine.current.scale;
                      const mdY = (e.clientY - target.startMouseY) / engine.current.scale;
                      let newW = target.startW;
                      let newH = target.startH;
                      let newX = target.startX;
                      let newY = target.startY;
                      const minW = 220;
                      const minH = 120;
                      if (target.corner.includes('e')) newW = Math.max(minW, target.startW + mdX);
                      else if (target.corner.includes('w')) {
                          newW = Math.max(minW, target.startW - mdX);
                          newX = target.startX + (target.startW - newW);
                      }
                      if (target.corner.includes('s')) newH = Math.max(minH, target.startH + mdY);
                      else if (target.corner.includes('n')) {
                          newH = Math.max(minH, target.startH - mdY);
                          newY = target.startY + (target.startH - newH);
                      }
                      beat.x = Math.round(newX);
                      beat.y = Math.round(newY);
                      beat.w = Math.round(newW);
                      beat.h = Math.round(newH);
                      const cardEl = container.querySelector(`.beat-card[data-id="${beat.id}"]`) as HTMLElement;
                      if (cardEl) {
                          cardEl.style.width = `${beat.w}px`;
                          cardEl.style.height = `${beat.h}px`;
                          cardEl.style.transform = `translate(${beat.x}px, ${beat.y}px)`;
                      }
                  }
              } else if (engine.current.dragGroupTarget !== null) {
                  const group = engine.current.groups.find(g => g.id === engine.current.dragGroupTarget);
                  if (group) {
                      group.x += dx;
                      group.y += dy;
                      const groupEl = container.querySelector(`.group-container[data-id="${group.id}"]`) as HTMLElement;
                      if (groupEl) {
                          groupEl.style.transform = `translate(${group.x}px, ${group.y}px)`;
                      }

                      engine.current.beats.forEach(b => {
                          if (engine.current.selectedBeatIds.has(b.id) || engine.current.dragGroupChildIds.has(b.id)) {
                              b.x += dx;
                              b.y += dy;
                              const cardEl = container.querySelector(`.beat-card[data-id="${b.id}"]`) as HTMLElement;
                              if (cardEl) {
                                  cardEl.style.transform = `translate(${b.x}px, ${b.y}px)`;
                              }
                          }
                      });
                      engine.current.groups.forEach(g => {
                          if (engine.current.dragGroupChildIds.has(g.id)) {
                              g.x += dx;
                              g.y += dy;
                              const childGroupEl = container.querySelector(`.group-container[data-id="${g.id}"]`) as HTMLElement;
                              if (childGroupEl) {
                                  childGroupEl.style.transform = `translate(${g.x}px, ${g.y}px)`;
                              }
                          }
                      });
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
                  }
              } else if (engine.current.dragAnnotationId !== null) {
                  const anno = engine.current.annotations.find(a => a.id === engine.current.dragAnnotationId);
                  if (anno) {
                      const moveIds = engine.current.selectedAnnoIds.has(anno.id)
                          ? engine.current.selectedAnnoIds
                          : new Set([anno.id]);
                      const snap = e.shiftKey
                          ? { dx, dy, guideX: null as number | null, guideY: null as number | null }
                          : computeAnnoSnap(moveIds, dx, dy);
                      showSnapGuides(snap.guideX, snap.guideY);
                      const viewportWidth = containerRef.current?.querySelector('#viewport')?.clientWidth ?? window.innerWidth;
                      engine.current.annotations.forEach(m => {
                          if (!moveIds.has(m.id)) return;
                          const bounds = getAnnoBounds(m);
                          const w = bounds.maxX - bounds.minX;
                          const maxAllowedX = (viewportWidth / engine.current.scale) - w;
                          
                          let constrainedDx = snap.dx;
                          if (bounds.minX + snap.dx < 0) {
                              constrainedDx = -bounds.minX;
                          } else if (bounds.minX + snap.dx > maxAllowedX) {
                              constrainedDx = maxAllowedX - bounds.minX;
                          }
                          
                          let constrainedDy = snap.dy;
                          if (bounds.minY + snap.dy < 0) {
                              constrainedDy = -bounds.minY;
                          }

                          if (m.x !== undefined) m.x += constrainedDx;
                          if (m.y !== undefined) m.y += constrainedDy;
                          if (m.cx !== undefined) m.cx += constrainedDx;
                          if (m.cy !== undefined) m.cy += constrainedDy;
                          if (m.points && m.points.length > 0) {
                              m.points.forEach(p => { p.x += constrainedDx; p.y += constrainedDy; });
                          }
                      });
                      scheduleAnnoRender();
                      updateMultiselectHighlighter();
                  }
              } else if (engine.current.annoResizeTarget !== null) {
                  const target = engine.current.annoResizeTarget;
                  const anno = engine.current.annotations.find(a => a.id === target.id);
                  if (anno) {
                      applyAnnoResize(anno, target, e);
                      scheduleAnnoRender();
                      updateMultiselectHighlighter();
                  }
              } else if (engine.current.annoRotateTarget !== null) {
                  const target = engine.current.annoRotateTarget;
                  const anno = engine.current.annotations.find(a => a.id === target.id);
                  if (anno) {
                      const { x: wx, y: wy } = getSvgPoint(e);
                      const curAngle = (Math.atan2(wy - target.centerY, wx - target.centerX) * 180) / Math.PI;
                      anno.rotation = ((target.startAngle + (curAngle - target.startMouseAngle)) % 360 + 360) % 360;
                      scheduleAnnoRender();
                  }
              } else if (engine.current.textResizeTarget !== null) {
                  const target = engine.current.textResizeTarget;
                  const anno = engine.current.annotations.find(a => a.id === target.id);
                  if (anno) {
                      let next = Math.round(Math.min(120, Math.max(8, target.startFontSize + (target.startMouseY - e.clientY) / engine.current.scale)));
                      if (!e.shiftKey) next = Math.round(next / 2) * 2;
                      anno.fontSize = next;
                      scheduleAnnoRender();
                  }
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
          }
      };

      const handleMouseUp = (e: MouseEvent) => {
          if (engine.current.isPanning) {
              engine.current.isPanning = false;
              container.classList.remove('is-panning');
              return;
          }
          clearSnapGuides();
          if (engine.current.isDragging) {
              engine.current.isDragging = false;
              const surface = containerRef.current?.querySelector('#canvas-surface');
              if (surface) surface.classList.remove('is-dragging');

              if (engine.current.dragTarget !== null) {
                  captureSnapshot();
                  // Functional update: merges current-board engine positions with other boards from prev state
                  // Prevents other boards' beats from being erased (engine only holds the current board)
                  setBeats(prev => [
                      ...prev.filter(b => (b.boardId ?? 0) !== activeBoardId),
                      ...engine.current.beats
                  ]);
                  engine.current.dragTarget = null;
                  renderBeats();
              }
              if (engine.current.beatResizeTarget !== null) {
                  captureSnapshot();
                  setBeats(prev => [
                      ...prev.filter(b => (b.boardId ?? 0) !== activeBoardId),
                      ...engine.current.beats
                  ]);
                  engine.current.beatResizeTarget = null;
                  if (containerRef.current) containerRef.current.style.cursor = 'default';
                  renderBeats();
              }
              if (engine.current.dragGroupTarget !== null || engine.current.groupResizeTarget !== null) {
                  captureSnapshot();
                  setGroups(prev => [
                      ...prev.filter(g => (g.boardId ?? 0) !== activeBoardId),
                      ...engine.current.groups
                  ]);
                  setBeats(prev => [
                      ...prev.filter(b => (b.boardId ?? 0) !== activeBoardId),
                      ...engine.current.beats
                  ]);
                  engine.current.dragGroupTarget = null;
                  engine.current.groupResizeTarget = null;
                  engine.current.dragGroupChildIds.clear();
                  renderGroups();
                  renderBeats();
              }
              if (engine.current.dragAnnotationId !== null || engine.current.annoResizeTarget !== null || engine.current.annoRotateTarget !== null || engine.current.textResizeTarget !== null) {
                  captureSnapshot();
                  setAnnotations(prev => [
                      ...prev.filter(a => (a.boardId ?? 0) !== activeBoardId),
                      ...engine.current.annotations
                  ]);
                  engine.current.dragAnnotationId = null;
                  engine.current.annoResizeTarget = null;
                  engine.current.annoRotateTarget = null;
                  engine.current.textResizeTarget = null;
                  if (containerRef.current) containerRef.current.style.cursor = 'default';
              }
              renderSelectionOverlay();
          }
          if (engine.current.isDrawing) {
              engine.current.isDrawing = false;
              engine.current.currentAnnoId = null;
              captureSnapshot();
              setAnnotations(prev => [
                  ...prev.filter(a => (a.boardId ?? 0) !== activeBoardId),
                  ...engine.current.annotations
              ]);
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
                  
                  if (!e.shiftKey) {
                      engine.current.selectedBeatIds.clear();
                      engine.current.selectedAnnoIds.clear();
                  }

                  engine.current.beats.forEach(b => {
                      const screenX = containerRect.left + engine.current.panX + (b.x * engine.current.scale);
                      const screenY = containerRect.top + engine.current.panY + (b.y * engine.current.scale);
                      const screenW = (b.w || 340) * engine.current.scale;
                      const screenH = (b.h || 150) * engine.current.scale;

                      if (screenX + screenW >= lLeft && screenX <= lLeft + lW &&
                          screenY + screenH >= lTop && screenY <= lTop + lH) {
                          engine.current.selectedBeatIds.add(b.id);
                      }
                  });
                  engine.current.annotations.forEach(a => {
                      const ab = getAnnoBounds(a);
                      const screenX = containerRect.left + engine.current.panX + (ab.minX * engine.current.scale);
                      const screenY = containerRect.top + engine.current.panY + (ab.minY * engine.current.scale);
                      const screenW = (ab.maxX - ab.minX) * engine.current.scale;
                      const screenH = (ab.maxY - ab.minY) * engine.current.scale;

                      if (screenX + screenW >= lLeft && screenX <= lLeft + lW &&
                          screenY + screenH >= lTop && screenY <= lTop + lH) {
                          engine.current.selectedAnnoIds.add(a.id);
                      }
                  });
                  renderBeats();
                  renderText();
                  renderAnnotations();
                  renderSelectionOverlay();
              } else if (!e.shiftKey) {
                  engine.current.selectedBeatIds.clear();
                  engine.current.selectedAnnoIds.clear();
                  renderBeats();
                  renderText();
                  renderAnnotations();
                  renderSelectionOverlay();
              }
          }
      };

      const handleContextMenu = (e: MouseEvent) => {
          e.preventDefault();
          const target = e.target as HTMLElement;
          if (target.closest('.ai-generator-container') || target.closest('.drawing-toolbar-container') || target.closest('#context-menu') || target.closest('.board-switcher')) return;

          const beatCard = target.closest('.beat-card') as HTMLElement;
          if (beatCard) {
              const beatId = parseInt(beatCard.dataset.id || '-1');
              if (beatId >= 0) {
                  if (!engine.current.selectedBeatIds.has(beatId)) {
                      engine.current.selectedBeatIds.clear();
                      engine.current.selectedBeatIds.add(beatId);
                      renderBeats();
                  }
                  showContextMenu(e.clientX, e.clientY, beatId, null, null);
                  return;
              }
          }

          const groupContainer = target.closest('.group-container') as HTMLElement;
          if (groupContainer) {
              const groupId = parseInt(groupContainer.dataset.id || '-1');
              if (groupId >= 0) {
                  showContextMenu(e.clientX, e.clientY, null, groupId, null);
                  return;
              }
          }

          const textCard = target.closest('.text-annotation-card') as HTMLElement;
          if (textCard) {
              const annoId = parseInt(textCard.dataset.id || '-1');
              if (annoId >= 0) {
                  engine.current.selectedAnnoIds.clear();
                  engine.current.selectedAnnoIds.add(annoId);
                  engine.current.selectedBeatIds.clear();
                  renderText();
                  renderAnnotations();
                  renderSelectionOverlay();
                  showContextMenu(e.clientX, e.clientY, null, null, annoId);
                  return;
              }
          }

          const annoGroup = (target.closest('g[data-type="annotation"]') || target.closest('[data-anno-id]')) as HTMLElement;
          if (annoGroup) {
              const annoId = parseInt(annoGroup.dataset.annoId || annoGroup.getAttribute('data-id') || '-1');
              if (annoId >= 0) {
                  engine.current.selectedAnnoIds.clear();
                  engine.current.selectedAnnoIds.add(annoId);
                  engine.current.selectedBeatIds.clear();
                  renderAnnotations();
                  renderSelectionOverlay();
                  showContextMenu(e.clientX, e.clientY, null, null, annoId);
                  return;
              }
          }

          showContextMenu(e.clientX, e.clientY, null, null, null);
      };

      const handleKeyDown = (e: KeyboardEvent) => {
          const activeEl = document.activeElement;
          const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true');

          if (e.code === 'Space' || e.key === ' ') {
              if (isEditing) return;
              e.preventDefault();
              if (!isSpacePressedRef.current) {
                  isSpacePressedRef.current = true;
                  container.classList.add('space-pressed');
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
              kbRef.current.handleCopy();
          } else if (isMeta && keyLower === 'v') {
              e.preventDefault();
              kbRef.current.handlePaste();
          } else if (isMeta && keyLower === 'd') {
              e.preventDefault();
              kbRef.current.handleDuplicate();
          } else if (isMeta && keyLower === 'a') {
              e.preventDefault();
              engine.current.selectedBeatIds.clear();
              engine.current.beats.forEach(b => engine.current.selectedBeatIds.add(b.id));
              renderBeats();
          } else if (isMeta && keyLower === '=') {
              e.preventDefault();
              zoomIn();
          } else if (isMeta && keyLower === '-') {
              e.preventDefault();
              zoomOut();
          } else if (isMeta && keyLower === '0') {
              e.preventDefault();
              zoomReset();
          } else if (isMeta && keyLower === 'z') {
              e.preventDefault();
              if (e.shiftKey) kbRef.current.redo();
              else kbRef.current.undo();
          } else if (isMeta && keyLower === 'y') {
              e.preventDefault();
              kbRef.current.redo();
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
              }
          } else if (e.key === 'Enter') {
              if (engine.current.selectedBeatIds.size > 0) {
                  const selectedId = Array.from(engine.current.selectedBeatIds)[0];
                  e.preventDefault();
                  onEditBeat(selectedId);
              }
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
              if (engine.current.selectedBeatIds.size > 0 || engine.current.selectedAnnoIds.size > 0) {
                  e.preventDefault();
                  kbRef.current.handleDelete();
              }
          } else if (e.key === 'Escape') {
              hideContextMenu();
              setToolMode('none');
              if (engine.current.selectedBeatIds.size > 0 || engine.current.selectedAnnoIds.size > 0) {
                  engine.current.selectedBeatIds.clear();
                  engine.current.selectedAnnoIds.clear();
                  renderBeats();
                  renderText();
                  renderAnnotations();
                  renderSelectionOverlay();
              }
          }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
          if (e.code === 'Space' || e.key === ' ') {
              isSpacePressedRef.current = false;
              container.classList.remove('space-pressed');
          }
      };

      const handleWindowBlur = () => {
          isSpacePressedRef.current = false;
          container.classList.remove('space-pressed');
          engine.current.isPanning = false;
          container.classList.remove('is-panning');
      };

      const handleDblClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (isSpacePressedRef.current) return;
          if (target.closest('.ai-generator-container') || target.closest('.drawing-toolbar-container') || target.closest('#context-menu') || target.closest('.board-switcher')) return;
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
              engine.current.selectedAnnoIds.clear();
              engine.current.creationState = { id: newBeatId, step: 'title' };
              renderBeats();
          }
      };

      const handleWheel = (e: WheelEvent) => {
          if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              zoomAt(e.clientX, e.clientY, Math.pow(1.0015, -e.deltaY));
          } else {
              e.preventDefault();
              engine.current.panX -= e.deltaX;
              engine.current.panY -= e.deltaY;
              applyViewTransform();
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
      window.addEventListener('blur', handleWindowBlur);
      return () => {
          container.removeEventListener('mousedown', handleMouseDown);
          container.removeEventListener('dblclick', handleDblClick);
          container.removeEventListener('contextmenu', handleContextMenu);
          container.removeEventListener('wheel', handleWheel);
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
          window.removeEventListener('blur', handleWindowBlur);
      };
  }, [toolMode, editingAnnoId, drawColor, strokeWidth, strokeStyle, activeBoardId, captureSnapshot, setAnnotations, setBeats, setGroups, updateBeat, onEditBeat]);

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
            if (layer === 'groups') return <div key="groups" id="groups-layer" className="w-full h-full" />;
            if (layer === 'beats') return <div key="beats" id="beats-layer" className="w-full h-full" />;
            return null;
          })}
        </div>
      </div>

      <div id="selection-lasso" />
      <div id="multiselect-highlighter" className="absolute border border-dashed border-[#f5a623]/30 bg-amber-500/[0.02] pointer-events-none z-[9998]" style={{ display: 'none' }} />
      <div id="handles-layer" />
      <div id="snap-guide-v" />
      <div id="snap-guide-h" />
      <div ref={eraserCursorRef} className="eraser-cursor" />

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

      {/* Zoom Controls */}
      <div className="zoom-control">
        <button onClick={zoomOut} title="Zoom out (Ctrl/Cmd -)">−</button>
        <button className="zoom-label" onClick={zoomReset} title="Reset to 100% (Ctrl/Cmd 0)">{zoomPercent}%</button>
        <button onClick={zoomIn} title="Zoom in (Ctrl/Cmd +)">+</button>
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

      {/* AI Scene Generator */}
      <div className="ai-generator-container">
        <button 
          onClick={() => setIsAiModalOpen(true)}
          disabled={!aiAvailable}
          className="w-9 h-9 !p-0 flex items-center justify-center bg-gradient-to-r from-[#2a1b40] to-[#150d24] hover:from-[#3b245a] hover:to-[#281845] text-[#f5a623] border border-[#f5a623]/40 hover:border-[#f5a623] rounded transition-all shadow-[0_0_10px_rgba(245,166,35,0.2)] group disabled:opacity-40 disabled:cursor-not-allowed"
          title={aiAvailable ? "AI Scene Generator (5, 20, or 50 Scenes)" : "AI unavailable — no working API key. Fix in Backstage > AI."}
        >
          <Zap size={16} className="text-[#f5a623] fill-[#f5a623]/30 group-hover:scale-110 transition-transform duration-300" />
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
              <div className="ctx-item" onClick={() => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect && ctxMenu.beatId !== null && ctxMenu.beatId !== undefined) {
                  openSceneNumPopup({ clientX: ctxMenu.x + rect.left, clientY: ctxMenu.y + rect.top } as MouseEvent, ctxMenu.beatId);
                }
                hideContextMenu();
              }}>
                <Hash size={14} /> Set Scene Number...
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
              }
              hideContextMenu();
            }}>
              <Plus size={14} /> Create New Beat Here
            </div>
          )}

          {/* Sequence options when beats are selected */}
          {engine.current.selectedBeatIds.size > 0 && (
            <>
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

      {/* Scene Number Popup */}
      {sceneNumPopup && (
        <div
          className="scene-num-popup"
          style={{ left: sceneNumPopup.x, top: sceneNumPopup.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <label>Scene Number</label>
          <input
            autoFocus
            value={sceneNumPopup.value}
            placeholder="e.g. 12A"
            onChange={(e) => setSceneNumPopup({ ...sceneNumPopup, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitSceneNum();
              if (e.key === 'Escape') setSceneNumPopup(null);
            }}
          />
          <div className="scene-num-popup-actions">
            <button onClick={() => setSceneNumPopup(null)}>Cancel</button>
            <button className="primary" onClick={commitSceneNum}>Save</button>
          </div>
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