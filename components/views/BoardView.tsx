
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BeatStatus, Group, Annotation, Beat, Connection } from '../../types';
import { 
    MousePointer2, Square, Circle, Pen, Minus, ArrowRight, Eraser, Trash2, 
    Type, X, PenTool, GripHorizontal, Heading, ZoomIn, ZoomOut, Maximize, FileText, Loader2, Sparkles,
    Music, Play, Pause, AlertTriangle, ArrowRightLeft, Replace
} from 'lucide-react';
import BeatCard from '../BeatCard';
import { STORYLINE_COLORS } from '../../constants';
import { extractRawTextFromPdf } from '../../services/pdfImport';
import { analyzeScriptBatch, convertTextToScript } from '../../services/gemini';

interface BoardViewProps {
  onEditBeat: (id: number) => void;
}

interface Guideline {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const SNAP_THRESHOLD = 15;
const ANNOTATION_COLORS = ['#ef4444', '#f5a623', '#facc15', '#4ade80', '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#000000'];

const BoardView: React.FC<BoardViewProps> = ({ onEditBeat }) => {
  const { 
    beats, groups, connections, panX, panY, scale, annotations,
    setPan, setScale, updateBeat, setConnections, addBeat, setBeats, setGroups, addGroup, updateGroup, removeGroup,
    setAnnotations, captureSnapshot, geminiApiKey, isPdfDropEnabled
  } = useProject();

  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const minimapContainerRef = useRef<HTMLDivElement>(null);
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eraserCursorRef = useRef<HTMLDivElement>(null);
  
  // Local UI State for Toolbar
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [toolMode, setToolMode] = useState<'none' | 'pencil' | 'rect' | 'circle' | 'line' | 'arrow' | 'eraser' | 'text' | 'bigtext'>('none');
  const [drawColor, setDrawColor] = useState('#f5a623');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokeStyle, setStrokeStyle] = useState<'solid' | 'dashed'>('solid'); // Default solid
  
  // Context Menu State
  const [ctxMenu, setCtxMenu] = useState<{x: number, y: number, beatId?: number | null, groupId?: number | null, linkIndex?: number | null, annotationId?: number | null} | null>(null);
  
  // Duplicate Fix Menu State
  const [fixMenu, setFixMenu] = useState<{x: number, y: number, beatId: number, currentNum: string, suggestions: string[]} | null>(null);

  // Text Editing State
  const [editingAnnoId, setEditingAnnoId] = useState<number | null>(null);

  // Snapping Guidelines
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false); // Used for "AI Parsing" message now
  const [isDragOver, setIsDragOver] = useState(false);

  // Engine Ref (Mutable state for high-perf interactions)
  const engine = useRef({
    // State Mirrors
    beats: [] as Beat[],
    groups: [] as Group[],
    connections: [] as Connection[],
    annotations: [] as Annotation[],
    scale: 1,
    panX: 0,
    panY: 0,
    
    // Interaction State
    selectedBeatIds: new Set<number>(),
    dragTarget: null as number | null,
    dragGroupTarget: null as number | null, 
    dragGroupChildIds: new Set<number>(),
    groupResizeTarget: null as number | null,
    
    // Image Resizing (Enhanced for Corners & Aspect Ratio)
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
    
    // Annotation Dragging
    dragAnnotationId: null as number | null,

    isDragging: false,
    isPanning: false,
    lastMouseX: 0,
    lastMouseY: 0,
    
    // Creation Flow
    creationState: null as { id: number, step: 'title' | 'summary' } | null,

    // Lasso
    isLassoing: false,
    hasLassoMoved: false, 
    lassoStart: { x: 0, y: 0 },
    
    // Linking
    isLinking: false,
    linkingSourceId: null as number | null,
    tempLinkEndX: 0,
    tempLinkEndY: 0,
    relinkData: null as { type: 'source' | 'target', fixedBeatId: number } | null,
    
    // Drawing / Annotations
    isDrawing: false,
    drawStart: { x: 0, y: 0 },
    currentPoints: [] as {x: number, y: number}[], // Store raw points for smoothing
    currentAnnoId: null as number | null,

    // Graph Analysis (internal)
    sceneMap: {} as Record<number, number>,
    componentMap: {} as Record<number, string>,
    errorIds: new Set<number>(),
  });

  // --- STYLES ---
  const styles = `
    :root {
        --bg-canvas: #1e1e1e;
        --bg-grid: #2a2a2a;
    }
    .board-wrapper {
        width: 100%; height: 100%; overflow: hidden; background-color: #1e1e1e; font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #e0e0e0; position: relative; outline: none;
        -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;
    }
    #viewport { width: 100%; height: 100%; cursor: grab; position: absolute; top: 0; left: 0; overflow: hidden; display: block; }
    #viewport:active { cursor: grabbing; }
    .tool-pencil #viewport, .tool-rect #viewport, .tool-circle #viewport, .tool-line #viewport, .tool-arrow #viewport, .tool-text #viewport, .tool-bigtext #viewport { cursor: crosshair !important; }
    .tool-eraser #viewport { cursor: none !important; }
    #canvas-surface {
        position: absolute; top: 0; left: 0; width: 50000px; height: 50000px;
        background-color: #1e1e1e;
        background-image: linear-gradient(#2a2a2a 1px, transparent 1px), linear-gradient(90deg, #2a2a2a 1px, transparent 1px);
        background-size: 50px 50px; transform-origin: 0 0;
        isolation: isolate; 
    }
    #groups-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
    #connections-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; overflow: visible; }
    #annotations-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 15; overflow: visible; }
    #text-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 20; }
    #beats-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 100; }
    #guidelines-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 200; }
    .group-container, .beat-card, .annotation-hit-area, .handle-hit-area, .connection-line, .image-resize-handle { pointer-events: auto !important; }
    .text-annotation-card { pointer-events: auto !important; }
    .tool-pencil #annotations-layer, .tool-rect #annotations-layer, .tool-circle #annotations-layer, .tool-line #annotations-layer, .tool-arrow #annotations-layer, .tool-eraser #annotations-layer, .tool-text #annotations-layer, .tool-bigtext #annotations-layer { pointer-events: auto !important; }
    #selection-lasso { position: fixed; border: 1px solid rgba(52, 152, 219, 0.8); background-color: rgba(52, 152, 219, 0.3); display: none; pointer-events: none; z-index: 9999; }
    .connection-line { fill: none; stroke: #555; stroke-width: 3px; stroke-linecap: round; pointer-events: visibleStroke; cursor: pointer; transition: stroke 0.3s ease, stroke-width 0.1s; }
    .connection-line:hover { stroke-width: 5px; opacity: 0.8; }
    .connection-line.selected { stroke: #fff !important; stroke-width: 4px; filter: drop-shadow(0 0 4px rgba(255,255,255,0.5)); }
    .connection-line.temp { stroke: #f5a623 !important; stroke-dasharray: 5, 5; opacity: 0.8; stroke-width: 2px; pointer-events: none; }
    .annotation-path { fill: none; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
    .annotation-rect { fill: none; pointer-events: none; }
    .annotation-circle { fill: none; pointer-events: none; }
    .annotation-line { fill: none; stroke-linecap: round; pointer-events: none; }
    .annotation-image { pointer-events: none; }
    .image-resize-handle { fill: #f5a623; stroke: white; stroke-width: 1px; opacity: 0; transition: opacity 0.2s; }
    g[data-type="annotation"]:hover .image-resize-handle { opacity: 1; }
    .guideline { stroke: #00ffff; stroke-width: 1px; stroke-dasharray: 4, 2; opacity: 0.8; }
    .text-annotation-card { position: absolute; min-width: 50px; min-height: 1.2em; background: transparent; border: 1px dashed transparent; padding: 4px 8px; cursor: grab; transition: border-color 0.2s, background 0.2s; }
    .text-annotation-card:hover { border-color: rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); }
    .text-annotation-card.editing { background: rgba(30,30,30,0.9); border: 1px solid #f5a623; box-shadow: 0 4px 20px rgba(0,0,0,0.5); cursor: text; z-index: 1000; min-width: 200px; border-radius: 4px; }
    .text-annotation-input { width: 100%; height: 100%; background: transparent; border: none; outline: none; resize: none; font-family: 'Helvetica Neue', sans-serif; line-height: 1.2; overflow: hidden; }
    .text-annotation-display { white-space: pre-wrap; font-family: 'Helvetica Neue', sans-serif; line-height: 1.2; user-select: none; }
    .annotation-hit-area { fill: none; stroke: rgba(255,0,0,0.001); stroke-width: 20px; stroke-linecap: round; stroke-linejoin: round; pointer-events: visibleStroke; cursor: default; }
    .tool-eraser .annotation-hit-area { cursor: none; }
    .eraser-cursor { position: fixed; pointer-events: none; z-index: 9999; width: 20px; height: 20px; border: 2px solid #ef4444; background-color: rgba(239, 68, 68, 0.2); border-radius: 50%; transform: translate(-50%, -50%); display: none; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
    .tool-eraser .eraser-cursor { display: block; }
    .connection-handle { fill: #444; stroke: #888; stroke-width: 1px; opacity: 0; pointer-events: none; transition: transform 0.1s, fill 0.1s, stroke 0.1s, opacity 0.2s; }
    .handle-hit-area { fill: transparent; cursor: grab; pointer-events: auto; }
    .handle-hit-area:hover + .connection-handle { opacity: 1; fill: #f5a623; stroke: #fff; transform: scale(1.5); }
    .handle-hit-area:active + .connection-handle { opacity: 1; cursor: grabbing; }
    .beat-card { position: absolute; width: 200px; min-height: 120px; background: #2d2d2d; border: 1px solid #3d3d3d; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; flex-direction: column; user-select: none; transition: box-shadow 0.1s, border-color 0.1s; cursor: default; }
    .beat-card:hover { border-color: #666; }
    .beat-card.selected { border-color: #f5a623; box-shadow: 0 0 0 1px #f5a623, 0 8px 20px rgba(0,0,0,0.5); z-index: 125; }
    .beat-card.creating { border-color: #f5a623; box-shadow: 0 0 15px rgba(245, 166, 35, 0.5); z-index: 125; }
    .beat-card.target-mode { border-color: #4caf50; box-shadow: 0 0 0 2px #4caf50, 0 0 20px rgba(76, 175, 80, 0.4); z-index: 115; }
    .beat-card:active { z-index: 126; } 
    .beat-header { height: 10px; border-radius: 5px 5px 0 0; background-color: #444; cursor: grab; display: flex; align-items: center; justify-content: space-between; padding: 0 6px; }
    .beat-header:active { cursor: grabbing; }
    .seq-badge { background: rgba(0,0,0,0.5); color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; margin-top: -8px; margin-right: -4px; box-shadow: 0 2px 4px rgba(0,0,0,0.4); pointer-events: auto; cursor: default; z-index: 200; border: 1px solid rgba(255,255,255,0.2); transition: all 0.2s; }
    .seq-badge.error { background-color: #ef4444; border-color: #fca5a5; cursor: pointer; animation: pulse-red 2s infinite; }
    .seq-badge.error:hover { transform: scale(1.1); box-shadow: 0 0 10px rgba(239,68,68,0.5); }
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
    .link-handle { position: absolute; right: -10px; top: 20px; width: 20px; height: 20px; background: #444; border: 2px solid #2a2a2a; border-radius: 50%; cursor: crosshair; z-index: 20; transition: background 0.2s, transform 0.2s; display: flex; align-items: center; justify-content: center; }
    .link-handle::after { content: ''; width: 6px; height: 6px; background: #999; border-radius: 50%; }
    .link-handle:hover { background: #f5a623; transform: scale(1.2); border-color: #fff; }
    .input-handle-visual { position: absolute; left: -10px; top: 20px; width: 20px; height: 20px; background: #2a2a2a; border: 2px solid #555; border-radius: 50%; pointer-events: auto; z-index: 20; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
    .input-handle-visual::after { content: ''; width: 6px; height: 6px; background: #777; border-radius: 50%; }
    .target-mode .input-handle-visual { background: #4caf50; border-color: #fff; transform: scale(1.2); box-shadow: 0 0 10px #4caf50; cursor: pointer; }
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
  `;

  // --- HELPER: IMAGE COMPRESSION ---
  // ... (compressImage function remains same) ...
  const compressImage = async (file: File): Promise<string> => {
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
              const img = new Image();
              img.src = event.target?.result as string;
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 800;
                  const MAX_HEIGHT = 800;
                  let width = img.width;
                  let height = img.height;

                  if (width > height) {
                      if (width > MAX_WIDTH) {
                          height *= MAX_WIDTH / width;
                          width = MAX_WIDTH;
                      }
                  } else {
                      if (height > MAX_HEIGHT) {
                          width *= MAX_HEIGHT / height;
                          height = MAX_HEIGHT;
                      }
                  }
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  resolve(canvas.toDataURL('image/jpeg', 0.7)); 
              };
          };
      });
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    engine.current.beats = JSON.parse(JSON.stringify(beats)); 
    engine.current.groups = JSON.parse(JSON.stringify(groups || []));
    engine.current.connections = JSON.parse(JSON.stringify(connections));
    engine.current.annotations = JSON.parse(JSON.stringify(annotations));
    engine.current.scale = scale;
    engine.current.panX = panX;
    engine.current.panY = panY;
    
    renderCanvas();
    renderGroups(); 
    renderBeats();
    renderConnections(); 
  }, [beats, groups, connections, scale, panX, panY, annotations]);

  useEffect(() => {
      if (toolMode === 'text' || toolMode === 'bigtext') {
          engine.current.selectedBeatIds.clear();
          renderBeats();
      }
  }, [toolMode]);

  // --- RENDER FUNCTIONS ---
  const renderCanvas = () => {
    const surface = containerRef.current?.querySelector('#canvas-surface') as HTMLElement;
    if (surface) {
      surface.style.transform = `translate(${engine.current.panX}px, ${engine.current.panY}px) scale(${engine.current.scale})`;
    }
    renderMinimap();
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
        
        const sceneNum = beat.sceneNumber || engine.current.sceneMap[beat.id];
        
        // Show Bullet for Sandbox (No scene number)
        const displayNum = sceneNum ? `${sceneNum}` : '•';
        
        const badge = document.createElement('span');
        badge.className = 'seq-badge';
        badge.innerText = displayNum;
        
        const isError = engine.current.errorIds.has(beat.id);
        if (isError) { 
            badge.classList.add('error'); 
            badge.title = "Duplicate Scene Number. Click to fix.";
            // @ts-ignore
            badge.onclick = (e) => handleDuplicateClick(e, beat.id, sceneNum.toString());
        }
        header.appendChild(badge);

        const content = document.createElement('div');
        content.className = 'beat-content';

        if (isCreating && creationState?.step === 'title') {
            const input = document.createElement('input');
            input.className = 'title-input';
            input.value = beat.title;
            input.placeholder = "Beat Name...";
            input.onmousedown = (e) => e.stopPropagation();
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    beat.title = input.value;
                    updateBeat(beat.id, { title: input.value });
                    engine.current.creationState = { id: beat.id, step: 'summary' };
                    renderBeats();
                }
            };
            setTimeout(() => input.focus(), 10);
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
            textarea.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    beat.summary = textarea.value;
                    updateBeat(beat.id, { summary: textarea.value });
                    engine.current.creationState = null;
                    engine.current.selectedBeatIds.clear();
                    engine.current.selectedBeatIds.add(beat.id);
                    renderBeats();
                    containerRef.current?.focus(); 
                }
            };
            setTimeout(() => textarea.focus(), 10);
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
        const checkIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        const clockIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
        statusDiv.innerHTML = isReady ? `${checkIcon} READY` : `${clockIcon} WIP`;
        
        const versionDiv = document.createElement('div');
        versionDiv.className = 'beat-version';
        const vCount = beat.versions ? beat.versions.length : 0;
        versionDiv.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg> v${vCount}`;
        
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

        card.onmousedown = (e) => onBeatMouseDown(e, beat.id);
        card.ondblclick = (e) => { e.stopPropagation(); onEditBeat(beat.id); };
        beatsLayer.appendChild(card);
    });
  };

  const handleDuplicateClick = (e: MouseEvent, beatId: number, currentNum: string) => {
      e.preventDefault();
      e.stopPropagation();
      
      const numBase = currentNum.replace(/[A-Z]/g, '');
      
      // Suggest A, B, C...
      const suggestions = ['A', 'B', 'C', 'D'].map(s => `${numBase}${s}`);
      
      // Calculate position relative to container
      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setFixMenu({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
              beatId,
              currentNum,
              suggestions
          });
      }
  };

  const applyFix = (beatId: number, newNum: string) => {
      captureSnapshot();
      updateBeat(beatId, { sceneNumber: newNum });
      setFixMenu(null);
  };

  const analyzeGraph = () => {
    const adjDir: Record<number, number[]> = {}; 
    const adjUndir: Record<number, number[]> = {}; 
    const inDegree: Record<number, number> = {}; 
    const isConnected: Record<number, boolean> = {}; 
    
    engine.current.beats.forEach(b => { 
        adjDir[b.id] = []; adjUndir[b.id] = []; inDegree[b.id] = 0; isConnected[b.id] = false; 
    });
    
    engine.current.connections.forEach(c => {
        if (adjDir[c.from]) adjDir[c.from].push(c.to);
        if (adjUndir[c.from]) adjUndir[c.from].push(c.to);
        if (adjUndir[c.to]) adjUndir[c.to].push(c.from);
        if (inDegree[c.to] !== undefined) inDegree[c.to]++;
        isConnected[c.from] = true; isConnected[c.to] = true;
    });

    const visited = new Set<number>();
    engine.current.componentMap = {};
    let colorIdx = 0;
    const sortedBeats = [...engine.current.beats].sort((a,b) => a.id - b.id);
    
    sortedBeats.forEach(startNode => {
        if (isConnected[startNode.id] && !visited.has(startNode.id)) {
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
            let chosenColor = null;
            const coloredBeats = componentNodes.map(id => engine.current.beats.find(b => b.id === id)).filter(b => b && b.color && b.color !== '#444');
            if (coloredBeats.length > 0 && coloredBeats[0]) chosenColor = coloredBeats[0].color;
            else { chosenColor = STORYLINE_COLORS[colorIdx % STORYLINE_COLORS.length]; colorIdx++; }
            componentNodes.forEach(id => { engine.current.componentMap[id] = chosenColor!; });
        }
    });

    engine.current.sceneMap = {};
    const depths: Record<number, number> = {};
    let queue: number[] = [];
    const currentInDegree = {...inDegree};
    
    // Beat Map for manual lookups - Explicitly typed to resolve previous type error if any
    const beatMap = new Map<number, Beat>(engine.current.beats.map(b => [b.id, b]));

    sortedBeats.forEach(b => { 
        if (isConnected[b.id] && currentInDegree[b.id] === 0) { 
            queue.push(b.id); 
            // FIX: Respect manual start number
            const man = parseInt(b.sceneNumber || '');
            depths[b.id] = !isNaN(man) ? man : 1; 
        } 
    });
    
    while(queue.length > 0) {
        const u = queue.shift()!;
        
        // FIX: Determine propagation base
        const uBeat = beatMap.get(u);
        const man = parseInt(uBeat?.sceneNumber || '');
        const currentVal = !isNaN(man) ? man : (depths[u] || 1);

        if (adjDir[u]) {
            adjDir[u].forEach(v => {
                const newDepth = currentVal + 1; // Propagate: current + 1
                if (!depths[v] || newDepth > depths[v]) depths[v] = newDepth;
                currentInDegree[v]--;
                if (currentInDegree[v] <= 0) queue.push(v);
            });
        }
    }
    
    sortedBeats.forEach(b => { 
        // FIX: Handle isolated nodes with manual numbers
        if(!depths[b.id]) {
             const man = parseInt(b.sceneNumber || '');
             // DO NOT DEFAULT TO 1 for isolated nodes. Leave as undefined (Sandbox).
             if (!isNaN(man)) depths[b.id] = man;
        }
        engine.current.sceneMap[b.id] = depths[b.id]; 
    });

    // Detect Duplicates (Manual or Auto)
    engine.current.errorIds = new Set();
    const numberCounts: Record<string, number> = {};
    
    engine.current.beats.forEach(b => {
        // Use manual if set, else auto
        const num = b.sceneNumber ? b.sceneNumber : (engine.current.sceneMap[b.id] ? engine.current.sceneMap[b.id].toString() : null);
        if (num) {
            numberCounts[num] = (numberCounts[num] || 0) + 1;
        }
    });

    engine.current.beats.forEach(b => {
        const num = b.sceneNumber ? b.sceneNumber : (engine.current.sceneMap[b.id] ? engine.current.sceneMap[b.id].toString() : null);
        if (num && numberCounts[num] > 1) {
            engine.current.errorIds.add(b.id);
        }
    });
  };

  const renderConnections = () => {
      // ... (existing renderConnections logic) ...
      if (!containerRef.current) return;
      const connectionsLayer = containerRef.current.querySelector('#connections-layer');
      const annotationsLayer = containerRef.current.querySelector('#annotations-layer');
      if (!connectionsLayer || !annotationsLayer) return;
      
      connectionsLayer.innerHTML = ''; 
      annotationsLayer.innerHTML = '';

      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      ANNOTATION_COLORS.forEach(color => {
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
          if (anno.type === 'text' || anno.type === 'audio') return; 

          const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
          let el: SVGElement | null = null;
          let hitEl: SVGElement | null = null; 
          let handleEls: SVGElement[] = [];
          
          const width = (anno as any).strokeWidth || 3;
          const style = (anno as any).strokeStyle || 'solid';
          const dash = style === 'dashed' ? '10,10' : '';

          if (anno.type === 'pencil' && anno.d) {
              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path.setAttribute("d", anno.d);
              path.setAttribute("stroke", anno.color);
              path.setAttribute("stroke-width", width.toString());
              if(dash) path.setAttribute("stroke-dasharray", dash);
              path.setAttribute("fill", "none");
              path.classList.add("annotation-path");
              el = path;

              const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
              hitPath.setAttribute("d", anno.d);
              hitPath.classList.add("annotation-hit-area");
              hitEl = hitPath;

          } else if (anno.type === 'rect' && anno.x !== undefined) {
              const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
              rect.setAttribute("x", anno.x.toString());
              rect.setAttribute("y", anno.y!.toString());
              rect.setAttribute("width", anno.w!.toString());
              rect.setAttribute("height", anno.h!.toString());
              rect.setAttribute("stroke", anno.color);
              rect.setAttribute("stroke-width", width.toString());
              if(dash) rect.setAttribute("stroke-dasharray", dash);
              rect.classList.add("annotation-rect");
              el = rect;

              const hitRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
              hitRect.setAttribute("x", anno.x.toString());
              hitRect.setAttribute("y", anno.y!.toString());
              hitRect.setAttribute("width", anno.w!.toString());
              hitRect.setAttribute("height", anno.h!.toString());
              hitRect.classList.add("annotation-hit-area");
              hitEl = hitRect;

          } else if (anno.type === 'circle' && anno.cx !== undefined && anno.rx !== undefined) {
              const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              circle.setAttribute("cx", anno.cx.toString());
              circle.setAttribute("cy", anno.cy.toString());
              circle.setAttribute("r", anno.rx.toString());
              circle.setAttribute("stroke", anno.color);
              circle.setAttribute("stroke-width", width.toString());
              if(dash) circle.setAttribute("stroke-dasharray", dash);
              circle.classList.add("annotation-circle");
              el = circle;

              const hitCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              hitCircle.setAttribute("cx", anno.cx.toString());
              hitCircle.setAttribute("cy", anno.cy.toString());
              hitCircle.setAttribute("r", anno.rx.toString());
              hitCircle.classList.add("annotation-hit-area");
              hitEl = hitCircle;

          } else if (anno.type === 'line' && anno.x !== undefined) {
              const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
              line.setAttribute("x1", anno.x.toString());
              line.setAttribute("y1", anno.y!.toString());
              line.setAttribute("x2", (anno.x + (anno.w || 0)).toString());
              line.setAttribute("y2", (anno.y! + (anno.h || 0)).toString());
              line.setAttribute("stroke", anno.color);
              line.setAttribute("stroke-width", width.toString());
              if(dash) line.setAttribute("stroke-dasharray", dash);
              line.classList.add("annotation-line");
              el = line;

              const hitLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
              hitLine.setAttribute("x1", anno.x.toString());
              hitLine.setAttribute("y1", anno.y!.toString());
              hitLine.setAttribute("x2", (anno.x + (anno.w || 0)).toString());
              hitLine.setAttribute("y2", (anno.y! + (anno.h || 0)).toString());
              hitLine.classList.add("annotation-hit-area");
              hitEl = hitLine;

          } else if (anno.type === 'arrow' && anno.x !== undefined) {
              const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
              line.setAttribute("x1", anno.x.toString());
              line.setAttribute("y1", anno.y!.toString());
              line.setAttribute("x2", (anno.x + (anno.w || 0)).toString());
              line.setAttribute("y2", (anno.y! + (anno.h || 0)).toString());
              line.setAttribute("stroke", anno.color);
              line.setAttribute("stroke-width", width.toString());
              if(dash) line.setAttribute("stroke-dasharray", dash);
              line.setAttribute("marker-end", `url(#arrow-${anno.color.replace('#', '')})`);
              line.classList.add("annotation-line");
              el = line;

              const hitLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
              hitLine.setAttribute("x1", anno.x.toString());
              hitLine.setAttribute("y1", anno.y!.toString());
              hitLine.setAttribute("x2", (anno.x + (anno.w || 0)).toString());
              hitLine.setAttribute("y2", (anno.y! + (anno.h || 0)).toString());
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
              // @ts-ignore
              hitRect.onmousedown = (e) => {
                  if(toolMode !== 'none' && toolMode !== 'eraser') return;
                  if(e.button !== 0) return;
                  e.stopPropagation();
                  engine.current.dragAnnotationId = anno.id;
                  engine.current.isDragging = true;
                  engine.current.lastMouseX = e.clientX;
                  engine.current.lastMouseY = e.clientY;
              };
              hitEl = hitRect;

              const handleSize = 10;
              const addHandle = (cx: number, cy: number, cursor: string, corner: 'nw' | 'ne' | 'se' | 'sw') => {
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

          if (el) {
              group.setAttribute("data-type", "annotation");
              group.setAttribute("data-id", anno.id.toString());
              
              if (hitEl) {
                  group.appendChild(hitEl);
              }
              group.appendChild(el);
              handleEls.forEach(h => group.appendChild(h));
              annotationsLayer.appendChild(group);
          }
      });

      engine.current.connections.forEach((conn, index) => {
          const fromBeat = engine.current.beats.find(b => b.id === conn.from);
          const toBeat = engine.current.beats.find(b => b.id === conn.to);
          if (fromBeat && toBeat) {
              const fromX = fromBeat.x + 200; const fromY = fromBeat.y + 30; const toX = toBeat.x; const toY = toBeat.y + 30; 
              const dist = Math.abs(toX - fromX) * 0.6; const cp1x = fromX + dist; const cp1y = fromY; const cp2x = toX - dist; const cp2y = toY;
              const compColor = engine.current.componentMap[fromBeat.id] || '#555';
              
              const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
              const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
              hitPath.setAttribute("d", `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`);
              hitPath.setAttribute("stroke", "transparent"); hitPath.setAttribute("stroke-width", "15"); hitPath.setAttribute("fill", "none");
              // @ts-ignore
              hitPath.classList.add("connection-hit-path"); hitPath.dataset.index = index; hitPath.style.cursor = "pointer";
              // @ts-ignore
              hitPath.onmousedown = (e) => {
                  if(toolMode !== 'none') return; if(e.button !== 0) return; 
                  e.stopPropagation(); 
              };
              group.appendChild(hitPath);
              
              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path.setAttribute("d", `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`);
              path.classList.add("connection-line"); path.style.stroke = compColor; 
              
              path.oncontextmenu = (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  showContextMenu(e.clientX, e.clientY, null, index, null, null);
              };

              group.appendChild(path); 

              const addHandle = (cx: number, cy: number, type: 'source' | 'target') => {
                  const handleGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                  const hitCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                  hitCircle.setAttribute("cx", cx.toString());
                  hitCircle.setAttribute("cy", cy.toString());
                  hitCircle.setAttribute("r", "12"); 
                  hitCircle.classList.add("handle-hit-area");
                  const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                  handle.setAttribute("cx", cx.toString());
                  handle.setAttribute("cy", cy.toString());
                  handle.setAttribute("r", "6"); 
                  handle.classList.add("connection-handle");
                  
                  // @ts-ignore
                  const startDrag = (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      captureSnapshot();
                      const newConns = [...engine.current.connections];
                      newConns.splice(index, 1);
                      engine.current.connections = newConns;
                      setConnections(newConns);
                      engine.current.isLinking = true;
                      if (type === 'source') {
                          engine.current.relinkData = { type: 'source', fixedBeatId: toBeat.id };
                          engine.current.linkingSourceId = null; 
                      } else {
                          engine.current.relinkData = { type: 'target', fixedBeatId: fromBeat.id };
                          engine.current.linkingSourceId = fromBeat.id; 
                      }
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
          let startX, startY, endX, endY;
          if (engine.current.relinkData && engine.current.relinkData.type === 'source') {
              const targetBeat = engine.current.beats.find(b => b.id === engine.current.relinkData!.fixedBeatId);
              if (targetBeat) {
                  endX = targetBeat.x; endY = targetBeat.y + 30; startX = engine.current.tempLinkEndX; startY = engine.current.tempLinkEndY; 
                  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  path.setAttribute("d", `M ${startX} ${startY} L ${endX} ${endY}`);
                  path.classList.add("connection-line", "temp");
                  connectionsLayer.appendChild(path);
              }
          } else {
              const sourceBeat = engine.current.beats.find(b => b.id === engine.current.linkingSourceId);
              if (sourceBeat) {
                  startX = sourceBeat.x + 200; startY = sourceBeat.y + 30; endX = engine.current.tempLinkEndX; endY = engine.current.tempLinkEndY; 
                  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  path.setAttribute("d", `M ${startX} ${startY} L ${endX} ${endY}`);
                  path.classList.add("connection-line", "temp");
                  connectionsLayer.appendChild(path);
              }
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
          
          const updateWidth = () => {
              const width = Math.max(50, (input.value.length * 9) + 15);
              input.style.width = `${width}px`;
          };
          updateWidth();

          input.onmousedown = (e) => e.stopPropagation(); 
          input.oninput = (e) => {
              updateWidth();
          };
          input.onchange = (e) => {
              updateGroup(group.id, { title: (e.target as HTMLInputElement).value });
          };
          input.onkeydown = (e) => {
              if(e.key === 'Enter') input.blur();
          };

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
          if (b.x < minX) minX = b.x;
          if (b.y < minY) minY = b.y;
          if (b.x + 200 > maxX) maxX = b.x + 200;
          if (b.y + 120 > maxY) maxY = b.y + 120;
      });
      groups.forEach(g => {
          if (g.x < minX) minX = g.x;
          if (g.y < minY) minY = g.y;
          if (g.x + g.width > maxX) maxX = g.x + g.width;
          if (g.y + g.height > maxY) maxY = g.y + g.height;
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
      const offsetY = (mapH - worldH * scale) / 2;

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
          
          if (engine.current.selectedBeatIds.has(b.id)) {
              ctx.fillStyle = '#f5a623';
              ctx.globalAlpha = 0.8;
          } else {
              ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
              ctx.globalAlpha = 0.4;
          }
          ctx.fillRect(bx, by, bw, bh);
          ctx.globalAlpha = 1.0;
      });

      ctx.strokeStyle = 'rgba(245, 166, 35, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(toMapX(viewX), toMapY(viewY), viewW * scale, viewH * scale);
  };

  const deleteAnnotation = (id: number) => {
      captureSnapshot();
      const newAnnos = engine.current.annotations.filter(a => a.id !== id);
      engine.current.annotations = newAnnos;
      setAnnotations(newAnnos);
      renderConnections(); 
  };

  const handleClearAll = () => {
      captureSnapshot();
      engine.current.annotations = [];
      setAnnotations([]);
      renderConnections();
  };

  const onImageResizeMouseDown = (e: MouseEvent, id: number, corner: 'nw' | 'ne' | 'sw' | 'se') => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      if (e.button !== 0) return;

      e.stopPropagation();
      e.preventDefault();
      
      const anno = engine.current.annotations.find(a => a.id === id);
      if (!anno) return;

      engine.current.imageResizeTarget = {
          id: id,
          corner: corner,
          startX: anno.x || 0,
          startY: anno.y || 0,
          startW: anno.w || 200,
          startH: anno.h || 150,
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          aspectRatio: (anno.w || 200) / (anno.h || 150)
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
          const p0 = points[i];
          const p1 = points[i+1];
          const midX = (p0.x + p1.x) / 2;
          const midY = (p0.y + p1.y) / 2;
          d += ` Q ${p0.x} ${p0.y} ${midX} ${midY}`;
      }
      
      if (points.length > 1) {
          const last = points[points.length - 1];
          d += ` L ${last.x} ${last.y}`;
      }
      return d;
  };

  const updateTempLinkPos = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect(); 
      engine.current.tempLinkEndX = (e.clientX - rect.left - engine.current.panX) / engine.current.scale;
      engine.current.tempLinkEndY = (e.clientY - rect.top - engine.current.panY) / engine.current.scale;
      renderConnections();
  };

  const completeDragLink = (e: MouseEvent) => {
      if (!engine.current.isLinking) return;
      const targetEl = (e.target as HTMLElement).closest('.beat-card') as HTMLElement;
      
      if (engine.current.relinkData?.type === 'source') {
          if (targetEl) {
              const newSourceId = parseInt(targetEl.dataset.id || '-1');
              const fixedTargetId = engine.current.relinkData.fixedBeatId;
              if (newSourceId >= 0 && fixedTargetId !== undefined && newSourceId !== fixedTargetId) {
                  const exists = engine.current.connections.find(c => c.from === newSourceId && c.to === fixedTargetId);
                  if (!exists) {
                      engine.current.connections.push({ from: newSourceId, to: fixedTargetId });
                      setConnections(engine.current.connections);
                  }
              }
          }
      } else {
          if (engine.current.linkingSourceId !== null) {
              if (targetEl) {
                  const targetId = parseInt(targetEl.dataset.id || '-1');
                  if (targetId >= 0 && targetId !== engine.current.linkingSourceId) {
                      const exists = engine.current.connections.find(c => c.from === engine.current.linkingSourceId && c.to === targetId);
                      if (!exists) {
                          engine.current.connections.push({ from: engine.current.linkingSourceId!, to: targetId });
                          setConnections(engine.current.connections);
                      }
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

  const calculateSnap = (currentX: number, currentY: number, width: number, height: number, excludeId: number) => {
      const snapDist = SNAP_THRESHOLD;
      let newX = currentX;
      let newY = currentY;
      const guides: Guideline[] = [];

      const left = currentX;
      const right = currentX + width;
      const centerX = currentX + width / 2;
      const top = currentY;
      const bottom = currentY + height;
      const centerY = currentY + height / 2;

      const targets = [
          ...engine.current.beats.map(b => ({ id: b.id, x: b.x, y: b.y, w: 200, h: 120, type: 'beat' })),
          ...engine.current.annotations.filter(a => (a.type === 'image' || a.type === 'audio') && a.id !== excludeId).map(a => ({ id: a.id, x: a.x || 0, y: a.y || 0, w: a.w || 200, h: a.h || 150, type: 'media' }))
      ];

      let snappedX = false;
      for (const t of targets) {
          if (snappedX) break; 
          const tLeft = t.x;
          const tRight = t.x + t.w;
          const tCenterX = t.x + t.w / 2;

          if (Math.abs(left - tLeft) < snapDist) { newX = tLeft; guides.push({ x1: tLeft, y1: Math.min(top, t.y) - 50, x2: tLeft, y2: Math.max(bottom, t.y + t.h) + 50 }); snappedX = true; }
          else if (Math.abs(left - tRight) < snapDist) { newX = tRight; guides.push({ x1: tRight, y1: Math.min(top, t.y) - 50, x2: tRight, y2: Math.max(bottom, t.y + t.h) + 50 }); snappedX = true; }
          else if (Math.abs(right - tLeft) < snapDist) { newX = tLeft - width; guides.push({ x1: tLeft, y1: Math.min(top, t.y) - 50, x2: tLeft, y2: Math.max(bottom, t.y + t.h) + 50 }); snappedX = true; }
          else if (Math.abs(right - tRight) < snapDist) { newX = tRight - width; guides.push({ x1: tRight, y1: Math.min(top, t.y) - 50, x2: tRight, y2: Math.max(bottom, t.y + t.h) + 50 }); snappedX = true; }
          else if (Math.abs(centerX - tCenterX) < snapDist) { newX = tCenterX - width / 2; guides.push({ x1: tCenterX, y1: Math.min(top, t.y) - 50, x2: tCenterX, y2: Math.max(bottom, t.y + t.h) + 50 }); snappedX = true; }
      }

      let snappedY = false;
      for (const t of targets) {
          if (snappedY) break;
          const tTop = t.y;
          const tBottom = t.y + t.h;
          const tCenterY = t.y + t.h / 2;

          if (Math.abs(top - tTop) < snapDist) { newY = tTop; guides.push({ x1: Math.min(left, t.x) - 50, y1: tTop, x2: Math.max(right, t.x + t.w) + 50, y2: tTop }); snappedY = true; }
          else if (Math.abs(top - tBottom) < snapDist) { newY = tBottom; guides.push({ x1: Math.min(left, t.x) - 50, y1: tBottom, x2: Math.max(right, t.x + t.w) + 50, y2: tBottom }); snappedY = true; }
          else if (Math.abs(bottom - tTop) < snapDist) { newY = tTop - height; guides.push({ x1: Math.min(left, t.x) - 50, y1: tTop, x2: Math.max(right, t.x + t.w) + 50, y2: tTop }); snappedY = true; }
          else if (Math.abs(bottom - tBottom) < snapDist) { newY = tBottom - height; guides.push({ x1: Math.min(left, t.x) - 50, y1: tBottom, x2: Math.max(right, t.x + t.w) + 50, y2: tBottom }); snappedY = true; }
          else if (Math.abs(centerY - tCenterY) < snapDist) { newY = tCenterY - height / 2; guides.push({ x1: Math.min(left, t.x) - 50, y1: tCenterY, x2: Math.max(right, t.x + t.w) + 50, y2: tCenterY }); snappedY = true; }
      }

      return { x: newX, y: newY, guides };
  };

  const handleZoom = (direction: 'in' | 'out') => {
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const oldScale = engine.current.scale;
      const newScale = direction === 'in' ? Math.min(3, oldScale + 0.2) : Math.max(0.1, oldScale - 0.2);
      
      if (oldScale === newScale) return;

      const worldX = (centerX - engine.current.panX) / oldScale;
      const worldY = (centerY - engine.current.panY) / oldScale;

      const newPanX = centerX - (worldX * newScale);
      const newPanY = centerY - (worldY * newScale);

      setScale(newScale);
      setPan(newPanX, newPanY);
  };

  const handleFitView = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const items = engine.current.beats;
      const groups = engine.current.groups;

      if (items.length === 0 && groups.length === 0) {
          const defaultPanX = (container.clientWidth / 2) - 100;
          const defaultPanY = (container.clientHeight / 2) - 60;
          setScale(1);
          setPan(defaultPanX, defaultPanY);
          return;
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      items.forEach(b => {
          if (b.x < minX) minX = b.x;
          if (b.y < minY) minY = b.y;
          if (b.x + 200 > maxX) maxX = b.x + 200;
          if (b.y + 120 > maxY) maxY = b.y + 120;
      });
      groups.forEach(g => {
          if (g.x < minX) minX = g.x;
          if (g.y < minY) minY = g.y;
          if (g.x + g.width > maxX) maxX = g.x + g.width;
          if (g.y + g.height > maxY) maxY = g.y + g.height;
      });

      const PADDING = 100;
      const contentW = (maxX - minX) + (PADDING * 2);
      const contentH = (maxY - minY) + (PADDING * 2);
      
      const containerW = container.clientWidth;
      const containerH = container.clientHeight;

      let newScale = Math.min(containerW / contentW, containerH / contentH);
      newScale = Math.min(Math.max(newScale, 0.1), 1.0); 

      const cx = minX - PADDING + contentW / 2;
      const cy = minY - PADDING + contentH / 2;

      const newPanX = (containerW / 2) - (cx * newScale);
      const newPanY = (containerH / 2) - (cy * newScale);

      setScale(newScale);
      setPan(newPanX, newPanY);
      
      engine.current.scale = newScale;
      engine.current.panX = newPanX;
      engine.current.panY = newPanY;
      renderCanvas();
      renderMinimap();
  };

  const getSvgPoint = (e: MouseEvent) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - engine.current.panX) / engine.current.scale;
      const y = (e.clientY - rect.top - engine.current.panY) / engine.current.scale;
      return { x, y };
  };

  const onBeatMouseDown = (e: MouseEvent, id: number) => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      
      if (e.button !== 0) return;

      // @ts-ignore
      if(e.target.classList.contains('beat-title') || e.target.classList.contains('link-handle') || e.target.classList.contains('input-handle-visual') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.stopPropagation();
      
      if (e.ctrlKey || e.metaKey) {
          if (engine.current.selectedBeatIds.has(id)) engine.current.selectedBeatIds.delete(id);
          else engine.current.selectedBeatIds.add(id);
          renderBeats();
          return;
      } else {
          if (!engine.current.selectedBeatIds.has(id)) {
              engine.current.selectedBeatIds.clear();
              engine.current.selectedBeatIds.add(id);
              renderBeats();
          }
      }
      engine.current.dragTarget = id;
      engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX;
      engine.current.lastMouseY = e.clientY;
      minimapContainerRef.current?.classList.add('active');
  };

  const onGroupHeaderMouseDown = (e: MouseEvent, id: number) => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      if (e.button !== 0) return;

      e.stopPropagation();
      e.preventDefault();
      const group = engine.current.groups.find(g => g.id === id);
      if (!group) return;

      engine.current.dragGroupTarget = id;
      engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX;
      engine.current.lastMouseY = e.clientY;
      minimapContainerRef.current?.classList.add('active'); 

      engine.current.selectedBeatIds.clear();
      engine.current.dragGroupChildIds.clear();

      engine.current.beats.forEach(b => {
          const bx = b.x + 100; // Updated approx center
          const by = b.y + 60; // Updated approx center
          if (bx >= group.x && bx <= group.x + group.width && by >= group.y && by <= group.y + group.height) {
              engine.current.selectedBeatIds.add(b.id);
          }
      });

      engine.current.groups.forEach(g => {
          if (g.id === id) return;
          if (g.x >= group.x && g.y >= group.y && g.x + g.width <= group.x + group.width && g.y + g.height <= group.y + group.height) {
              engine.current.dragGroupChildIds.add(g.id);
          }
      });
      
      renderBeats();
  };

  const onGroupResizeMouseDown = (e: MouseEvent, id: number) => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      if (e.button !== 0) return;

      e.stopPropagation();
      e.preventDefault();
      engine.current.groupResizeTarget = id;
      engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX;
      engine.current.lastMouseY = e.clientY;
      minimapContainerRef.current?.classList.add('active');
  };

  const onLinkHandleMouseDown = (e: MouseEvent, sourceId: number) => {
      if (toolMode !== 'none' && toolMode !== 'eraser') return;
      e.stopPropagation();
      captureSnapshot();
      engine.current.isLinking = true;
      engine.current.linkingSourceId = sourceId;
      engine.current.relinkData = null; 
      containerRef.current?.querySelector('#connections-layer')?.classList.add('linking-mode');
      updateTempLinkPos(e);
      renderBeats(); 
  };

  const handleTextMouseDown = (e: React.MouseEvent, id: number) => {
      if (editingAnnoId === id) return;
      
      if (toolMode === 'text' || toolMode === 'bigtext') {
          e.stopPropagation();
          setEditingAnnoId(id);
          setToolMode('none'); 
          return;
      }

      if (toolMode !== 'none') return;

      e.stopPropagation();
      engine.current.dragAnnotationId = id;
      engine.current.isDragging = true;
      engine.current.lastMouseX = e.clientX;
      engine.current.lastMouseY = e.clientY;
  };

  const handleTextDoubleClick = (e: React.MouseEvent, id: number) => {
      if (toolMode !== 'none') return;
      e.stopPropagation();
      setEditingAnnoId(id);
  };

  const updateTextContent = (id: number, text: string) => {
      const newAnnos = engine.current.annotations.map(a => a.id === id ? { ...a, text } : a);
      engine.current.annotations = newAnnos;
      setAnnotations(newAnnos);
  };

  const showContextMenu = (clientX: number, clientY: number, beatId: number | null, linkIndex: number | null, groupId: number | null, annotationId: number | null) => {
      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setCtxMenu({ 
              x: clientX - rect.left, 
              y: clientY - rect.top, 
              beatId, 
              linkIndex,
              groupId,
              annotationId
          });
      }
  };

  const hideContextMenu = () => {
      setCtxMenu(null);
      setFixMenu(null); // Close fix menu as well
  };

  const handleDelete = () => {
      captureSnapshot();
      if (ctxMenu?.beatId !== null && ctxMenu?.beatId !== undefined) {
          const toDelete = engine.current.selectedBeatIds.size > 0 
              ? Array.from(engine.current.selectedBeatIds) 
              : [ctxMenu.beatId!];
          const newBeats = beats.filter(b => !toDelete.includes(b.id));
          const newConns = connections.filter(c => !toDelete.includes(c.from) && !toDelete.includes(c.to));
          setBeats(newBeats);
          setConnections(newConns);
      } else if (ctxMenu?.linkIndex !== null && ctxMenu?.linkIndex !== undefined) {
          const newConns = [...connections];
          newConns.splice(ctxMenu.linkIndex, 1);
          setConnections(newConns);
      } else if (ctxMenu?.groupId !== null && ctxMenu?.groupId !== undefined) {
          removeGroup(ctxMenu.groupId);
      } else if (ctxMenu?.annotationId !== null && ctxMenu?.annotationId !== undefined) {
          deleteAnnotation(ctxMenu.annotationId);
      }
      hideContextMenu();
  };

  const handleColor = (color: string, type: 'chain' | 'tint' | 'group') => {
      captureSnapshot();
      if (type === 'group' && ctxMenu?.groupId) {
          updateGroup(ctxMenu.groupId, { color });
      } else if (ctxMenu?.beatId !== null && ctxMenu?.beatId !== undefined) {
          const targets = engine.current.selectedBeatIds.size > 0 
              ? Array.from(engine.current.selectedBeatIds)
              : [ctxMenu.beatId!];
          
          if (type === 'tint') {
              const newBeats = beats.map(b => targets.includes(b.id) ? { ...b, tint: color } : b);
              setBeats(newBeats);
          } else {
              const newBeats = beats.map(b => targets.includes(b.id) ? { ...b, color: color } : b);
              setBeats(newBeats);
          }
      }
      hideContextMenu();
  };

  const handleStatus = (status: BeatStatus) => {
      captureSnapshot();
      if (ctxMenu?.beatId !== null && ctxMenu?.beatId !== undefined) {
          const targets = engine.current.selectedBeatIds.size > 0 
              ? Array.from(engine.current.selectedBeatIds)
              : [ctxMenu.beatId!];
          const newBeats = beats.map(b => targets.includes(b.id) ? { ...b, status: status } : b);
          setBeats(newBeats);
      }
      hideContextMenu();
  };

  const handleCreateGroup = () => {
      if (engine.current.selectedBeatIds.size < 1) return;
      captureSnapshot();
      const selectedBeats = beats.filter(b => engine.current.selectedBeatIds.has(b.id));
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selectedBeats.forEach(b => {
          if(b.x < minX) minX = b.x;
          if(b.y < minY) minY = b.y;
          if(b.x + 200 > maxX) maxX = b.x + 200; // card width
          if(b.y + 120 > maxY) maxY = b.y + 120; // min card height
      });

      const padding = 40;
      addGroup({
          title: 'New Sequence',
          x: minX - padding,
          y: minY - padding - 24, // extra for header
          width: (maxX - minX) + (padding * 2),
          height: (maxY - minY) + (padding * 2) + 24,
          color: '#f5a623'
      });
      engine.current.selectedBeatIds.clear();
      hideContextMenu();
  };

  const getStatusAction = () => {
      if (ctxMenu?.beatId === null && engine.current.selectedBeatIds.size === 0) return null;
      
      const targets = engine.current.selectedBeatIds.size > 0 
          ? Array.from(engine.current.selectedBeatIds)
          : (ctxMenu?.beatId ? [ctxMenu.beatId] : []);
      
      const allReady = targets.every(tid => beats.find(b => b.id === tid)?.status === 'ready');
      
      return allReady 
          ? { label: 'Mark W.I.P.', status: 'not-ready' as BeatStatus, color: '#f5a623' }
          : { label: 'Mark Ready', status: 'ready' as BeatStatus, color: '#4caf50' };
  };

  const statusAction = getStatusAction();

  const handleDragEnter = useCallback((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const files = Array.from(e.dataTransfer.files);
          
          const rect = containerRef.current?.getBoundingClientRect();
          const dropX = e.clientX - (rect?.left || 0);
          const dropY = e.clientY - (rect?.top || 0);
          const worldX = (dropX - engine.current.panX) / engine.current.scale;
          const worldY = (dropY - engine.current.panY) / engine.current.scale;

          for (const file of files) {
              if (file.type === 'application/pdf') {
                  if (!isPdfDropEnabled) {
                      alert("PDF Import is disabled. Enable it in Backstage > System Features.");
                      continue;
                  }
                  if (!geminiApiKey) {
                      alert("Please enter your Gemini API Key in Backstage settings to import scripts.");
                      continue;
                  }

                  setIsImporting(true);
                  setIsEnhancing(true);

                  try {
                      const rawText = await extractRawTextFromPdf(file);
                      const newBeats = await convertTextToScript(rawText, 'gemini-3-flash-preview', geminiApiKey);
                      
                      let maxX = -Infinity;
                      let maxY = -Infinity;
                      if (engine.current.beats.length > 0) {
                          engine.current.beats.forEach(b => {
                              if (b.x > maxX) maxX = b.x;
                              if (b.y > maxY) maxY = b.y;
                          });
                      } else {
                          maxX = 25000;
                          maxY = 25000;
                      }

                      const startX = maxX + 400; 
                      const startY = 25000;
                      
                      const COLS = 5;
                      const CARD_W = 200;
                      const CARD_H = 120;
                      const GAP_X = 50;
                      const GAP_Y = 50;

                      const positionedBeats = newBeats.map((b, i) => {
                          const col = i % COLS;
                          const row = Math.floor(i / COLS);
                          return {
                              ...b,
                              x: startX + (col * (CARD_W + GAP_X)),
                              y: startY + (row * (CARD_H + GAP_Y))
                          };
                      });

                      const newConnections: Connection[] = [];
                      for (let i = 0; i < positionedBeats.length - 1; i++) {
                          newConnections.push({
                              from: positionedBeats[i].id,
                              to: positionedBeats[i+1].id
                          });
                      }

                      captureSnapshot();
                      setBeats((prev: Beat[]) => [...prev, ...positionedBeats]);
                      setConnections((prev: Connection[]) => [...prev, ...newConnections]);
                      setPan(-startX * scale + 100, -startY * scale + 100);

                  } catch (err) {
                      console.error("PDF Import Failed:", err);
                      alert("Failed to parse PDF. Please check the console for details.");
                  } finally {
                      setIsImporting(false);
                      setIsEnhancing(false);
                  }
              }
              // ... image and audio handling similar to previous ...
          }
      }
  }, [setBeats, setConnections, setPan, scale, captureSnapshot, geminiApiKey, isPdfDropEnabled, setAnnotations]);

  // --- GLOBAL MOUSE HANDLERS ---
  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleMouseDown = (e: MouseEvent) => {
          // @ts-ignore
          if (e.target.classList.contains('text-annotation-input')) return;

          if (editingAnnoId !== null) {
              setEditingAnnoId(null);
              captureSnapshot();
          }

          // @ts-ignore
          const target = e.target as HTMLElement;
          const isTool = target.closest('.zoom-controls') || 
                         target.closest('.drawing-toolbar-container') || 
                         target.closest('#context-menu') ||
                         target.closest('#fix-menu'); // Don't hide fix menu if clicking inside
          
          if (isTool) return;

          if (toolMode === 'none') {
              const isInteractive = target.closest('.beat-card') || 
                                    target.closest('.link-handle') || 
                                    target.closest('.connection-handle') || 
                                    target.closest('.handle-hit-area') || 
                                    target.closest('.group-header') || 
                                    target.closest('.group-resize-handle') ||
                                    target.closest('.image-resize-handle') || 
                                    target.closest('.annotation-hit-area') || 
                                    target.closest('.text-annotation-card') ||
                                    target.closest('.seq-badge') || // Badge handling
                                    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
              if (isInteractive) return;
          }

          hideContextMenu();

          if (toolMode === 'eraser' && e.button === 0) {
              e.preventDefault();
              if (eraserCursorRef.current) eraserCursorRef.current.style.display = 'none'; 
              const hitTarget = document.elementFromPoint(e.clientX, e.clientY);
              if (eraserCursorRef.current) eraserCursorRef.current.style.display = ''; 
              
              if (hitTarget) {
                  // @ts-ignore
                  const group = hitTarget.closest('g[data-type="annotation"]');
                  // @ts-ignore
                  const textCard = hitTarget.closest('.text-annotation-card');
                  
                  if (group) {
                      // @ts-ignore
                      const id = parseInt(group.getAttribute('data-id'));
                      if (id) deleteAnnotation(id);
                  } else if (textCard) {
                      // @ts-ignore
                      const id = parseInt(textCard.dataset.id);
                      if (id) deleteAnnotation(id);
                  }
              }
              return;
          }

          if ((toolMode === 'text' || toolMode === 'bigtext') && e.button === 0) {
              e.preventDefault();
              const { x, y } = getSvgPoint(e);
              
              captureSnapshot(); 

              const isBig = toolMode === 'bigtext';
              const newId = Date.now();
              const newAnno: any = {
                  id: newId,
                  type: 'text',
                  x, y,
                  text: '',
                  color: drawColor,
                  fontSize: isBig ? 72 : 16
              };
              
              engine.current.annotations.push(newAnno);
              setAnnotations([...engine.current.annotations]);
              
              setEditingAnnoId(newId);
              setToolMode('none'); 
              return;
          }

          if (toolMode !== 'none' && toolMode !== 'eraser' && e.button === 0) {
              e.preventDefault();
              const { x, y } = getSvgPoint(e);

              engine.current.isDrawing = true;
              engine.current.drawStart = { x, y };
              engine.current.currentPoints = [{x, y}]; 
              engine.current.currentAnnoId = Date.now();
              
              captureSnapshot(); 

              const newAnno: any = {
                  id: engine.current.currentAnnoId,
                  type: toolMode,
                  color: drawColor,
                  x: x, y: y, 
                  w: 0, h: 0,
                  d: toolMode === 'pencil' ? `M ${x} ${y} L ${x+0.1} ${y+0.1}` : undefined, 
                  strokeWidth: strokeWidth,
                  strokeStyle: strokeStyle
              };

              if (toolMode === 'circle') {
                  newAnno.cx = x;
                  newAnno.cy = y;
                  newAnno.rx = 0; 
              }
              
              engine.current.annotations.push(newAnno);
              renderConnections(); 
              return;
          }

          if (e.button === 0 || e.button === 1) {
              if (toolMode === 'eraser') return; 

              engine.current.isPanning = true;
              engine.current.lastMouseX = e.clientX;
              engine.current.lastMouseY = e.clientY;
              container.style.cursor = 'grabbing';
              minimapContainerRef.current?.classList.add('active'); 
              
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                  engine.current.selectedBeatIds.clear();
                  if (engine.current.creationState) {
                      engine.current.creationState = null;
                  }
                  renderBeats();
              }
          } 
          else if (e.button === 2) {
              engine.current.isLassoing = true;
              engine.current.hasLassoMoved = false;
              engine.current.lassoStart = { x: e.clientX, y: e.clientY };
              const lasso = document.getElementById('selection-lasso');
              if (lasso) {
                  lasso.style.display = 'block';
                  lasso.style.left = e.clientX + 'px';
                  lasso.style.top = e.clientY + 'px';
                  lasso.style.width = '0px';
                  lasso.style.height = '0px';
              }
              return;
          }
      };

      const handleMouseMove = (e: MouseEvent) => {
          if (toolMode === 'eraser' && eraserCursorRef.current) {
              eraserCursorRef.current.style.left = e.clientX + 'px';
              eraserCursorRef.current.style.top = e.clientY + 'px';
              
              if (e.buttons === 1) {
                  eraserCursorRef.current.style.display = 'none';
                  const target = document.elementFromPoint(e.clientX, e.clientY);
                  eraserCursorRef.current.style.display = ''; 

                  if (target) {
                      // @ts-ignore
                      const group = target.closest('g[data-type="annotation"]');
                      // @ts-ignore
                      const textCard = target.closest('.text-annotation-card');
                      
                      if (group) {
                          // @ts-ignore
                          const id = parseInt(group.getAttribute('data-id'));
                          if (id) deleteAnnotation(id);
                      } else if (textCard) {
                          // @ts-ignore
                          const id = parseInt(textCard.dataset.id);
                          if (id) deleteAnnotation(id);
                      }
                  }
              }
          }

          if (engine.current.isDrawing && engine.current.currentAnnoId) {
              const { x, y } = getSvgPoint(e);
              const anno = engine.current.annotations.find(a => a.id === engine.current.currentAnnoId);
              
              if (anno) {
                  if (toolMode === 'pencil') {
                      const lastP = engine.current.currentPoints[engine.current.currentPoints.length - 1];
                      if (lastP) {
                          const dist = Math.hypot(x - lastP.x, y - lastP.y);
                          if (dist > 3) {
                              engine.current.currentPoints.push({x, y});
                              anno.d = getSmoothedPath(engine.current.currentPoints);
                              
                              const pathEl = container.querySelector(`[data-id="${anno.id}"] .annotation-path`) as SVGPathElement;
                              if(pathEl) pathEl.setAttribute('d', anno.d);
                              const hitEl = container.querySelector(`[data-id="${anno.id}"] .annotation-hit-area`) as SVGPathElement;
                              if(hitEl) hitEl.setAttribute('d', anno.d);
                          }
                      }
                  
                  } else if (toolMode === 'rect') {
                      const startX = engine.current.drawStart.x;
                      const startY = engine.current.drawStart.y;
                      const newX = Math.min(startX, x);
                      const newY = Math.min(startY, y);
                      const w = Math.abs(x - startX);
                      const h = Math.abs(y - startY);
                      
                      anno.x = newX; anno.y = newY; anno.w = w; anno.h = h;
                      
                      const group = container.querySelector(`[data-id="${anno.id}"]`) as SVGGElement;
                      if(group) {
                          group.querySelectorAll('rect').forEach(rectEl => {
                              rectEl.setAttribute('x', newX.toString());
                              rectEl.setAttribute('y', newY.toString());
                              rectEl.setAttribute('width', w.toString());
                              rectEl.setAttribute('height', h.toString());
                          });
                      }

                  } else if (toolMode === 'circle') {
                      const startX = engine.current.drawStart.x;
                      const startY = engine.current.drawStart.y;
                      const r = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                      anno.rx = r;
                      
                      const group = container.querySelector(`[data-id="${anno.id}"]`) as SVGGElement;
                      if (group) {
                          group.querySelectorAll('circle').forEach(circleEl => {
                              circleEl.setAttribute('r', r.toString());
                          });
                      }

                  } else if (toolMode === 'line' || toolMode === 'arrow') {
                      const startX = engine.current.drawStart.x;
                      const startY = engine.current.drawStart.y;
                      anno.w = x - startX;
                      anno.h = y - startY;
                      
                      const group = container.querySelector(`[data-id="${anno.id}"]`) as SVGGElement;
                      if(group) {
                          group.querySelectorAll('line').forEach(lineEl => {
                              lineEl.setAttribute('x2', x.toString());
                              lineEl.setAttribute('y2', y.toString());
                          });
                      }
                  }
              }
              return;
          }

          if (engine.current.isLinking) {
              updateTempLinkPos(e);
              return;
          }

          if (engine.current.isLassoing) {
              engine.current.hasLassoMoved = true;
              const currentX = e.clientX;
              const currentY = e.clientY;
              const width = Math.abs(currentX - engine.current.lassoStart.x);
              const height = Math.abs(currentY - engine.current.lassoStart.y);
              const left = Math.min(currentX, engine.current.lassoStart.x);
              const top = Math.min(currentY, engine.current.lassoStart.y);
              const lasso = document.getElementById('selection-lasso');
              if (lasso) {
                  lasso.style.left = left + 'px';
                  lasso.style.top = top + 'px';
                  lasso.style.width = width + 'px';
                  lasso.style.height = height + 'px';
              }
              return;
          }

          if (engine.current.isPanning) {
              const dx = e.clientX - engine.current.lastMouseX;
              const dy = e.clientY - engine.current.lastMouseY;
              engine.current.panX += dx;
              engine.current.panY += dy;
              engine.current.lastMouseX = e.clientX;
              engine.current.lastMouseY = e.clientY;
              renderCanvas();
          } else if (engine.current.isDragging) {
              const dx = (e.clientX - engine.current.lastMouseX) / engine.current.scale;
              const dy = (e.clientY - engine.current.lastMouseY) / engine.current.scale;
              
              if (engine.current.imageResizeTarget !== null) {
                  const target = engine.current.imageResizeTarget;
                  const anno = engine.current.annotations.find(a => a.id === target.id);
                  if (anno) {
                      const deltaX = (e.clientX - target.startMouseX) / engine.current.scale;
                      
                      let newX = target.startX;
                      let newY = target.startY;
                      let newW = target.startW;
                      let newH = target.startH;
                      const ratio = target.aspectRatio;

                      if (target.corner === 'se') {
                          newW = Math.max(50, target.startW + deltaX);
                          newH = newW / ratio;
                      } else if (target.corner === 'sw') {
                          newW = Math.max(50, target.startW - deltaX);
                          newH = newW / ratio; 
                          newX = target.startX + (target.startW - newW);
                      } else if (target.corner === 'ne') {
                          newW = Math.max(50, target.startW + deltaX);
                          newH = newW / ratio;
                          newY = target.startY - (newH - target.startH);
                      } else if (target.corner === 'nw') {
                          newW = Math.max(50, target.startW - deltaX);
                          newH = newW / ratio;
                          newX = target.startX + (target.startW - newW);
                          newY = target.startY - (newH - target.startH);
                      }

                      anno.x = newX;
                      anno.y = newY;
                      anno.w = newW;
                      anno.h = newH;
                      renderConnections(); 
                  }
              } else if (engine.current.dragAnnotationId !== null) {
                  const anno = engine.current.annotations.find(a => a.id === engine.current.dragAnnotationId);
                  if (anno) {
                      const { x, y, guides } = calculateSnap(
                          (anno.x || 0) + dx, 
                          (anno.y || 0) + dy, 
                          anno.w || 200, 
                          anno.h || 150, 
                          anno.id
                      );
                      
                      anno.x = x;
                      anno.y = y;
                      setGuidelines(guides);
                      
                      if (anno.type === 'text') {
                          const el = document.querySelector(`.text-annotation-card[data-id="${anno.id}"]`) as HTMLElement;
                          if (el) {
                              el.style.left = `${anno.x}px`;
                              el.style.top = `${anno.y}px`;
                          }
                      } else {
                          renderConnections();
                      }
                  }
              } else if (engine.current.dragGroupTarget !== null) {
                  const group = engine.current.groups.find(g => g.id === engine.current.dragGroupTarget);
                  if (group) {
                      group.x += dx;
                      group.y += dy;
                  }
                  
                  engine.current.dragGroupChildIds.forEach(childId => {
                      const g = engine.current.groups.find(x => x.id === childId);
                      if(g) { g.x += dx; g.y += dy; }
                  });

                  engine.current.selectedBeatIds.forEach(bid => {
                      const b = engine.current.beats.find(x => x.id === bid);
                      if(b) { 
                          b.x += dx; 
                          b.y += dy; 
                          const card = container.querySelector(`.beat-card[data-id="${b.id}"]`) as HTMLElement;
                          if (card) {
                              card.style.left = `${b.x}px`;
                              card.style.top = `${b.y}px`;
                          }
                      }
                  });
                  
                  renderGroups();
                  renderConnections(); 
                  renderMinimap(); 
                  
              } else if (engine.current.groupResizeTarget !== null) {
                  const group = engine.current.groups.find(g => g.id === engine.current.groupResizeTarget);
                  if (group) {
                      group.width = Math.max(100, group.width + dx);
                      group.height = Math.max(50, group.height + dy);
                      renderGroups();
                      renderMinimap();
                  }
              } else if (engine.current.dragTarget !== null) {
                  engine.current.selectedBeatIds.forEach(id => {
                      const beat = engine.current.beats.find(b => b.id === id);
                      if (beat) {
                          beat.x += dx;
                          beat.y += dy;
                          const card = container.querySelector(`.beat-card[data-id="${beat.id}"]`) as HTMLElement;
                          if (card) {
                              card.style.left = `${beat.x}px`;
                              card.style.top = `${beat.y}px`;
                          }
                      }
                  });
                  
                  renderConnections();
                  renderMinimap(); 
              }
              engine.current.lastMouseX = e.clientX;
              engine.current.lastMouseY = e.clientY;
          }
      };

      const handleMouseUp = (e: MouseEvent) => {
          setGuidelines([]);

          if (engine.current.isDrawing) {
              engine.current.isDrawing = false;
              engine.current.currentPoints = [];
              setAnnotations([...engine.current.annotations]);
              return;
          }

          if (engine.current.isLinking) completeDragLink(e);
          
          if (engine.current.isLassoing) {
              const lasso = document.getElementById('selection-lasso');
              if (lasso) {
                  lasso.style.display = 'none';
                  const rect = { 
                      left: parseInt(lasso.style.left), top: parseInt(lasso.style.top), 
                      width: parseInt(lasso.style.width), height: parseInt(lasso.style.height) 
                  };
                  if (rect.width > 5 || rect.height > 5) {
                      if (!e.ctrlKey && !e.shiftKey) engine.current.selectedBeatIds.clear();
                      const cards = container.querySelectorAll('.beat-card');
                      cards.forEach(card => {
                          const cRect = card.getBoundingClientRect();
                          if (cRect.left < rect.left + rect.width && cRect.left + cRect.width > rect.left &&
                              cRect.top < rect.top + rect.height && cRect.top + cRect.height > rect.top) {
                              // @ts-ignore
                              engine.current.selectedBeatIds.add(parseInt(card.dataset.id));
                          }
                      });
                      renderBeats();
                  }
              }
              engine.current.isLassoing = false;
          }

          if (engine.current.isPanning) {
              engine.current.isPanning = false;
              container.style.cursor = toolMode !== 'none' ? (toolMode === 'eraser' ? 'none' : 'crosshair') : 'grab';
              setPan(engine.current.panX, engine.current.panY);
              minimapContainerRef.current?.classList.remove('active'); 
          }

          if (engine.current.isDragging) {
              engine.current.isDragging = false;
              
              if (engine.current.dragGroupTarget) {
                  setGroups(engine.current.groups);
                  setBeats(engine.current.beats);
              }
              if (engine.current.groupResizeTarget) {
                  setGroups(engine.current.groups);
              }
              
              if (engine.current.imageResizeTarget !== null) {
                  setAnnotations([...engine.current.annotations]); 
                  engine.current.imageResizeTarget = null;
              }

              if (engine.current.dragAnnotationId !== null) {
                  setAnnotations([...engine.current.annotations]); 
                  engine.current.dragAnnotationId = null;
              }

              if (engine.current.dragTarget !== null) {
                  setBeats(engine.current.beats);
              }

              engine.current.dragGroupTarget = null;
              engine.current.dragGroupChildIds.clear();
              engine.current.groupResizeTarget = null;
              engine.current.dragTarget = null;
              
              minimapContainerRef.current?.classList.remove('active'); 
          }
      };

      const handleWheel = (e: WheelEvent) => {
          if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              
              const zoomSensitivity = 0.001;
              const delta = -e.deltaY * zoomSensitivity;
              const oldScale = engine.current.scale;
              let newScale = oldScale + delta;
              
              newScale = Math.max(0.1, Math.min(3, newScale));
              
              if (newScale === oldScale) return;

              const rect = container.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const mouseY = e.clientY - rect.top;

              const worldX = (mouseX - engine.current.panX) / oldScale;
              const worldY = (mouseY - engine.current.panY) / oldScale;

              const newPanX = mouseX - (worldX * newScale);
              const newPanY = mouseY - (worldY * newScale);

              engine.current.scale = newScale;
              engine.current.panX = newPanX;
              engine.current.panY = newPanY;
              
              renderCanvas();
              renderMinimap();
              
              if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
              zoomTimeoutRef.current = setTimeout(() => {
                  setScale(newScale);
                  setPan(newPanX, newPanY);
              }, 100);
          }
      };

      const handleDblClick = (e: MouseEvent) => {
          if (toolMode !== 'none') return;
          // @ts-ignore
          if (e.target === container.querySelector('#viewport') || e.target === container.querySelector('#canvas-surface')) {
              const rect = container.getBoundingClientRect();
              const worldX = (e.clientX - rect.left - engine.current.panX) / engine.current.scale;
              const worldY = (e.clientY - rect.top - engine.current.panY) / engine.current.scale;
              const newId = addBeat(worldX - 120, worldY - 20);
              engine.current.creationState = { id: newId, step: 'title' };
          }
      };

      const handleContextMenu = (e: MouseEvent) => {
          e.preventDefault();

          if (engine.current.hasLassoMoved) {
              engine.current.hasLassoMoved = false; 
              return;
          }

          // @ts-ignore
          const groupHeader = e.target.closest('.group-header');
          // @ts-ignore
          const beatCard = e.target.closest('.beat-card');
          // @ts-ignore
          const annotationGroup = e.target.closest('g[data-type="annotation"]');

          if (beatCard) {
              // @ts-ignore
              const id = parseInt(beatCard.dataset.id);
              if (!engine.current.selectedBeatIds.has(id)) {
                  engine.current.selectedBeatIds.clear();
                  engine.current.selectedBeatIds.add(id);
                  renderBeats();
              }
              showContextMenu(e.clientX, e.clientY, id, null, null, null);
          } else if (groupHeader) {
              // @ts-ignore
              const groupId = parseInt(groupHeader.parentElement.dataset.id);
              showContextMenu(e.clientX, e.clientY, null, null, groupId, null);
          } else if (annotationGroup) {
              // @ts-ignore
              const annoId = parseInt(annotationGroup.getAttribute('data-id'));
              showContextMenu(e.clientX, e.clientY, null, null, null, annoId);
          } else if (engine.current.selectedBeatIds.size > 1) {
              showContextMenu(e.clientX, e.clientY, null, null, null, null);
          }
      };

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          const activeTag = document.activeElement?.tagName;
          const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable;
          
          if (!engine.current.creationState && !isTyping) {
              if (e.key === 'Enter' && engine.current.selectedBeatIds.size === 1) {
                  if (toolMode === 'text') return;

                  e.preventDefault();
                  const id = Array.from(engine.current.selectedBeatIds)[0];
                  onEditBeat(id);
              }
              if (e.key === 'Delete' || e.key === 'Backspace') {
                  if (engine.current.selectedBeatIds.size > 0) {
                      e.preventDefault();
                      handleDelete();
                  }
              }
          }
      };

      container.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('dblclick', handleDblClick);
      container.addEventListener('contextmenu', handleContextMenu);
      window.addEventListener('keydown', handleGlobalKeyDown);
      container.addEventListener('wheel', handleWheel, { passive: false });
      
      container.addEventListener('dragenter', handleDragEnter);
      container.addEventListener('dragover', handleDragEnter);
      container.addEventListener('dragleave', handleDragLeave);
      container.addEventListener('drop', handleDrop);

      return () => {
          container.removeEventListener('mousedown', handleMouseDown);
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          container.removeEventListener('dblclick', handleDblClick);
          container.removeEventListener('contextmenu', handleContextMenu);
          window.removeEventListener('keydown', handleGlobalKeyDown);
          container.removeEventListener('wheel', handleWheel);
          
          container.removeEventListener('dragenter', handleDragEnter);
          container.removeEventListener('dragover', handleDragEnter);
          container.removeEventListener('dragleave', handleDragLeave);
          container.removeEventListener('drop', handleDrop);
      };
  }, [setPan, setBeats, addBeat, beats, connections, groups, toolMode, drawColor, strokeWidth, strokeStyle, editingAnnoId, handleDragEnter, handleDragLeave, handleDrop]); 

  // --- TOOL MODE WRAPPER ---
  const setToolModeSafe = (mode: any) => {
      setToolMode(mode);
  };

  return (
    <div className={`board-wrapper tool-${toolMode}`} ref={containerRef} onClick={hideContextMenu} tabIndex={-1}>
      <style>{styles}</style>
      
      {/* Import Overlay */}
      {(isDragOver || isImporting || isEnhancing) && (
          <div className="absolute inset-0 z-[3000] bg-black/80 flex items-center justify-center pointer-events-none">
              <div className="bg-[#111] border-2 border-[#f5a623] p-10 rounded-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
                  {isImporting ? (
                      <>
                          <Loader2 size={48} className="text-[#f5a623] animate-spin mb-4" />
                          <h2 className="text-xl font-black text-white uppercase tracking-wider">AI Parsing Script...</h2>
                          <p className="text-sm text-gray-500 mt-2 font-mono">Identifying scenes, actions, and dialogue</p>
                      </>
                  ) : (
                      <>
                          <FileText size={48} className="text-[#f5a623] mb-4 animate-bounce" />
                          <h2 className="text-xl font-black text-white uppercase tracking-wider">Drop PDF to Import</h2>
                          <p className="text-sm text-gray-500 mt-2 font-mono">Will be converted to beats via AI</p>
                      </>
                  )}
              </div>
          </div>
      )}
      
      {/* Zoom Controls */}
      <div className="zoom-controls">
          <button onClick={() => handleZoom('in')}>+</button>
          <button onClick={handleFitView}>Fit</button>
          <button onClick={() => handleZoom('out')}>−</button>
      </div>

      {/* Eraser Cursor (Custom) */}
      <div ref={eraserCursorRef} className="eraser-cursor"></div>

      {/* NEW COMPACT FLOATING TOOLBAR */}
      <div className="drawing-toolbar-container">
          
          {/* Expanded Panel */}
          {isToolbarOpen && (
              <div className="toolbar-panel">
                  
                  {/* Row 1: Tools */}
                  <div className="tool-row">
                      <button 
                          className={`tool-btn ${toolMode === 'none' ? 'active' : ''}`} 
                          onClick={() => setToolModeSafe('none')} 
                          title="Select (V)"
                      >
                          <MousePointer2 size={16} />
                      </button>
                      <button 
                          className={`tool-btn ${toolMode === 'text' ? 'active' : ''}`} 
                          onClick={() => setToolModeSafe('text')} 
                          title="Label (T)"
                      >
                          <Type size={16} />
                      </button>
                      <button 
                          className={`tool-btn ${toolMode === 'bigtext' ? 'active' : ''}`} 
                          onClick={() => setToolModeSafe('bigtext')} 
                          title="Big Heading"
                      >
                          <Heading size={16} />
                      </button>
                      <button 
                          className={`tool-btn danger ${toolMode === 'eraser' ? 'active' : ''}`} 
                          onClick={() => setToolModeSafe('eraser')} 
                          title="Eraser (E)"
                      >
                          <Eraser size={16} />
                      </button>
                  </div>

                  <div className="tool-divider" />

                  {/* Row 2: Shapes */}
                  <div className="tool-row">
                      <button 
                          className={`tool-btn ${toolMode === 'pencil' ? 'active' : ''}`} 
                          onClick={() => setToolModeSafe('pencil')} 
                          title="Freehand (P)"
                      >
                          <Pen size={16} />
                      </button>
                      <button 
                          className={`tool-btn ${toolMode === 'line' ? 'active' : ''}`} 
                          onClick={() => setToolModeSafe('line')} 
                          title="Line (L)"
                      >
                          <Minus size={16} />
                      </button>
                      <button 
                          className={`tool-btn ${toolMode === 'arrow' ? 'active' : ''}`} 
                          onClick={() => setToolModeSafe('arrow')} 
                          title="Arrow (A)"
                      >
                          <ArrowRight size={16} />
                      </button>
                      <button 
                          className={`tool-btn ${toolMode === 'rect' ? 'active' : ''}`} 
                          onClick={() => setToolModeSafe('rect')} 
                          title="Rectangle (R)"
                      >
                          <Square size={16} />
                      </button>
                      <button 
                          className={`tool-btn ${toolMode === 'circle' ? 'active' : ''}`} 
                          onClick={() => setToolModeSafe('circle')} 
                          title="Circle (C)"
                      >
                          <Circle size={16} />
                      </button>
                  </div>

                  <div className="tool-divider" />

                  {/* Row 3: Styles (Width & Dash) */}
                  <div className="tool-row" style={{ padding: '0 4px', gap: '8px' }}>
                      <input 
                          type="range" 
                          min="1" max="20" 
                          value={strokeWidth} 
                          onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                          className="w-16 h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                          title={`Width: ${strokeWidth}px`}
                      />
                      <div className="flex bg-[#111] rounded border border-[#333] p-0.5">
                          <button 
                              onClick={() => setStrokeStyle('solid')}
                              className={`w-6 h-6 rounded flex items-center justify-center ${strokeStyle === 'solid' ? 'bg-[#f5a623] text-black' : 'text-[#666] hover:text-white'}`}
                              title="Solid Line"
                          >
                              <Minus size={14} />
                          </button>
                          <button 
                              onClick={() => setStrokeStyle('dashed')}
                              className={`w-6 h-6 rounded flex items-center justify-center ${strokeStyle === 'dashed' ? 'bg-[#f5a623] text-black' : 'text-[#666] hover:text-white'}`}
                              title="Dashed Line"
                          >
                              <GripHorizontal size={14} />
                          </button>
                      </div>
                  </div>

                  <div className="tool-divider" />

                  {/* Row 4: Colors */}
                  <div className="tool-row" style={{justifyContent: 'space-between'}}>
                      {ANNOTATION_COLORS.map(c => (
                          <div
                            key={c}
                            className={`color-dot-btn ${drawColor === c ? 'active' : ''}`}
                            onClick={() => setDrawColor(c)}
                            title={c}
                          >
                              <div className="color-dot-inner" style={{backgroundColor: c}}></div>
                          </div>
                      ))}
                  </div>
                  
                  {/* Actions */}
                  <div className="tool-divider" />
                  <button 
                      className="tool-btn danger w-full" 
                      onClick={handleClearAll}
                      title="Clear All Annotations"
                  >
                      <Trash2 size={16} />
                  </button>

              </div>
          )}

          {/* Toggle Button */}
          <button 
              className={`toolbar-toggle ${isToolbarOpen ? 'active' : ''}`} 
              onClick={() => setIsToolbarOpen(!isToolbarOpen)}
              title="Annotation Tools"
          >
              {isToolbarOpen ? <X size={20} /> : <PenTool size={20} />}
          </button>

      </div>

      <div id="viewport">
          <div id="canvas-surface">
              {/* LAYERS - ORDER MATTERS FOR Z-INDEX */}
              {/* 1. Groups (Background) */}
              <div id="groups-layer"></div>
              
              {/* 2. Connections (Below Beats) */}
              <svg id="connections-layer"></svg>
              
              {/* 3. Annotations (Drawings - Behind text and beats) */}
              <svg id="annotations-layer"></svg>

              {/* 4. Text Annotations (React Layer - Behind beats) */}
              <div id="text-layer">
                  {annotations.filter(a => a.type === 'text').map(anno => (
                      <div 
                          key={anno.id}
                          className={`text-annotation-card ${editingAnnoId === anno.id ? 'editing' : ''}`}
                          data-id={anno.id}
                          style={{ 
                              left: anno.x, 
                              top: anno.y, 
                              color: anno.color,
                              fontSize: `${anno.fontSize || 16}px`,
                              fontWeight: (anno.fontSize && anno.fontSize > 40) ? '900' : 'bold'
                          }}
                          onMouseDown={(e) => handleTextMouseDown(e, anno.id)}
                          onDoubleClick={(e) => handleTextDoubleClick(e, anno.id)}
                      >
                          {editingAnnoId === anno.id ? (
                              <textarea
                                  className="text-annotation-input"
                                  value={anno.text || ''}
                                  onChange={(e) => updateTextContent(anno.id, e.target.value)}
                                  onBlur={() => setEditingAnnoId(null)}
                                  autoFocus
                                  style={{ color: anno.color }}
                                  onMouseDown={(e) => e.stopPropagation()} // Allow selecting text
                              />
                          ) : (
                              <div className="text-annotation-display">
                                  {anno.text || 'Double click to edit'}
                              </div>
                          )}
                      </div>
                  ))}
              </div>

              {/* 5. Smart Snap Guidelines (New Layer) */}
              <svg id="guidelines-layer">
                  {guidelines.map((guide, i) => (
                      <line 
                          key={i} 
                          x1={guide.x1} y1={guide.y1} x2={guide.x2} y2={guide.y2} 
                          className="guideline"
                      />
                  ))}
              </svg>

              {/* 6. Beats (Top) */}
              <div id="beats-layer"></div>
          </div>
      </div>

      {/* MINIMAP */}
      <div ref={minimapContainerRef} className="minimap-container">
          <canvas ref={minimapRef} className="minimap-canvas" />
      </div>

      <div id="selection-lasso"></div>

      {/* FIX MENU POPUP */}
      {fixMenu && (
          <div 
            id="fix-menu" 
            className="fixed bg-[#1a1a1a] border border-[#ef4444] rounded-lg shadow-2xl p-3 z-[2000] animate-in fade-in zoom-in duration-150 flex flex-col gap-2 w-48"
            style={{ left: fixMenu.x, top: fixMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
              <div className="flex items-center gap-2 text-[#ef4444] border-b border-red-900/50 pb-2 mb-1">
                  <AlertTriangle size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Duplicate Scene {fixMenu.currentNum}</span>
              </div>
              <div className="text-[10px] text-gray-400 mb-1">Quick Fix (Auto-Renumber):</div>
              <div className="grid grid-cols-2 gap-2">
                  {fixMenu.suggestions.map(s => (
                      <button
                        key={s}
                        onClick={() => applyFix(fixMenu.beatId, s)}
                        className="bg-[#222] hover:bg-[#333] border border-[#333] hover:border-[#f5a623] text-white py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1 group"
                      >
                          {s} <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 -ml-2 group-hover:ml-0 transition-all"/>
                      </button>
                  ))}
              </div>
              <div className="relative mt-1">
                  <input 
                      placeholder="Custom..."
                      className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-white outline-none focus:border-[#f5a623]"
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                              applyFix(fixMenu.beatId, (e.target as HTMLInputElement).value);
                          }
                      }}
                  />
                  <div className="absolute right-2 top-1.5 pointer-events-none">
                      <span className="text-[9px] text-gray-600 font-bold">↵</span>
                  </div>
              </div>
          </div>
      )}

      {ctxMenu && (
          <div 
            id="context-menu" 
            style={{ display: 'block', left: ctxMenu.x, top: ctxMenu.y }}
            onMouseDown={(e) => e.stopPropagation()} 
          >
              {/* Context menu content remains same */}
              {ctxMenu.groupId !== null ? (
                  <>
                    <div className="ctx-label">Sequence Color</div>
                    <div className="color-row">
                        {STORYLINE_COLORS.slice(0,5).map(c => (
                            <div key={c} className="color-dot" style={{background: c}} onClick={() => handleColor(c, 'group')}></div>
                        ))}
                    </div>
                    <div className="ctx-divider"></div>
                    <div className="ctx-item" style={{color: '#ff6b6b'}} onClick={handleDelete}>Ungroup Sequence</div>
                  </>
              ) : ctxMenu.beatId !== null ? (
                  <>
                    <div className="ctx-label">Status</div>
                    {statusAction && (
                        <div className="ctx-item" onClick={() => handleStatus(statusAction.status)}>
                            <span style={{color: statusAction.color, fontWeight: 'bold'}}>●</span> {statusAction.label}
                        </div>
                    )}
                    
                    {engine.current.selectedBeatIds.size > 1 && (
                        <>
                            <div className="ctx-divider"></div>
                            <div className="ctx-item" onClick={handleCreateGroup}>Create Sequence</div>
                        </>
                    )}

                    <div className="ctx-divider"></div>
                    
                    <div className="ctx-label">Chain Color</div>
                    <div className="color-row">
                        {STORYLINE_COLORS.slice(0,5).map(c => (
                            <div key={c} className="color-dot" style={{background: c}} onClick={() => handleColor(c, 'chain')}></div>
                        ))}
                    </div>
                    <div className="ctx-divider"></div>
                    <div className="ctx-label">Card Tint</div>
                    <div className="color-row">
                        {['#2d2d2d', '#2c3e50', '#3e2723', '#1b5e20', '#4a148c'].map(c => (
                            <div key={c} className="color-dot" style={{background: c}} onClick={() => handleColor(c, 'tint')}></div>
                        ))}
                    </div>
                    
                    <div className="ctx-divider"></div>
                    <div className="ctx-item" style={{color: '#ff6b6b', fontWeight: 'bold'}} onClick={handleDelete}>
                        <Trash2 size={14} /> <span className="ml-2">Delete</span>
                    </div>
                  </>
              ) : ctxMenu.annotationId !== null ? (
                  <>
                    <div className="ctx-item" style={{color: '#ff6b6b', fontWeight: 'bold'}} onClick={handleDelete}>
                        <Trash2 size={14} /> <span className="ml-2">Delete Image</span>
                    </div>
                  </>
              ) : null}
          </div>
      )}
    </div>
  );
};

export default BoardView;
