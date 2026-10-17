import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Beat, Connection, SectionBreak } from '../../types';
import {
  FlatMemoryCausalityEngine,
  ViewportCamera,
  BeatFlags,
  BEAT_STRIDE_WORDS,
  BEAT_OFFSET_ID,
  BEAT_OFFSET_X,
  BEAT_OFFSET_Y,
  BEAT_OFFSET_WIDTH,
  BEAT_OFFSET_HEIGHT,
  BEAT_OFFSET_LANE_INDEX,
  BEAT_OFFSET_FLAGS,
  BEAT_OFFSET_COLOR_RGBA
} from '../../services/causality/CausalityBridge';
import {
  ZoomIn, ZoomOut, Maximize2, Sparkles, RefreshCw, Plus,
  Link as LinkIcon, AlertTriangle, Layers, Move, Compass,
  Eye, HelpCircle, Check, X, Copy, Trash2, Edit3, ScrollText,
  Palette, Flag, Zap, ArrowLeftRight
} from 'lucide-react';

interface CausalityCanvasBoardProps {
  onEditBeat?: (id: number) => void;
}

interface CanvasContextMenu {
  type: 'beat' | 'canvas';
  beatId?: number;
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
}

const LANE_HEIGHT = 160;
const BEAT_CARD_HEIGHT = 72;
const DEFAULT_BEAT_WIDTH = 180;
const RULER_HEIGHT = 28;

// Causality Lane Palette
const LANE_COLORS = [
  { name: 'Protagonist / Main Plot', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.04)' },
  { name: 'Antagonist / Obstacles', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.04)' },
  { name: 'Romance / Relationship Arc', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.04)' },
  { name: 'Subplot / World Building', color: '#10b981', bg: 'rgba(16, 185, 129, 0.04)' },
  { name: 'Unused / Sandbox', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.04)' }
];

const CAUSALITY_PALETTE = [
  { name: 'Sky Cyan', hex: '#38bdf8' },
  { name: 'Amber Gold', hex: '#eab308' },
  { name: 'Crimson Red', hex: '#ef4444' },
  { name: 'Emerald Green', hex: '#22c55e' },
  { name: 'Deep Blue', hex: '#2563eb' },
  { name: 'Magenta Pink', hex: '#ec4899' },
  { name: 'Purple Velvet', hex: '#8b5cf6' },
  { name: 'Slate Gray', hex: '#64748b' },
];

const DEFAULT_SECTION_BREAKS: SectionBreak[] = [
  { id: 'sb-act1', title: 'ACT I', unit: 1, type: 'act' },
  { id: 'sb-ii', title: 'INCITING INCIDENT', unit: 12, type: 'beat' },
  { id: 'sb-pp1', title: 'PLOT POINT 1', unit: 25, type: 'beat' },
  { id: 'sb-mid', title: 'MIDPOINT', unit: 55, type: 'beat' },
  { id: 'sb-ail', title: 'ALL IS LOST', unit: 75, type: 'beat' },
  { id: 'sb-climax', title: 'CLIMAX / ACT III', unit: 90, type: 'act' },
];

export const CausalityCanvasBoard: React.FC<CausalityCanvasBoardProps> = ({ onEditBeat }) => {
  const { beats, setBeats, connections, currentProjectId, appTheme } = useProject();
  const isLight = appTheme === 'light';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Engine instance in ref to prevent re-instantiation
  const engineRef = useRef<FlatMemoryCausalityEngine>(new FlatMemoryCausalityEngine(5000));
  const engine = engineRef.current;

  // Viewport Camera State
  const cameraRef = useRef<ViewportCamera>({
    x: 400,
    y: 200,
    zoom: 1.0,
    screenWidth: 1200,
    screenHeight: 800
  });

  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [selectedBeatId, setSelectedBeatId] = useState<number | null>(null);
  const [selectedBeatIds, setSelectedBeatIds] = useState<Set<number>>(new Set());
  const [hoveredBeatId, setHoveredBeatId] = useState<number | null>(null);
  const [cycleErrorCount, setCycleErrorCount] = useState<number>(0);
  const [rippleModeActive, setRippleModeActive] = useState<boolean>(true);
  const [snapToGridActive, setSnapToGridActive] = useState<boolean>(true);
  const [showMilestones, setShowMilestones] = useState<boolean>(true);
  const [connectingSourceId, setConnectingSourceId] = useState<number | null>(null);
  const [connectMousePos, setConnectMousePos] = useState<{ x: number; y: number } | null>(null);
  const [fps, setFps] = useState<number>(120);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<CanvasContextMenu | null>(null);
  const [editingBeatTitle, setEditingBeatTitle] = useState<string>('');
  const [isRenamingBeat, setIsRenamingBeat] = useState<boolean>(false);

  // Milestones State
  const breaksStorageKey = `causality_breaks_${currentProjectId || 'default'}`;
  const [sectionBreaks, setSectionBreaks] = useState<SectionBreak[]>(() => {
    try {
      const saved = localStorage.getItem(breaksStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_SECTION_BREAKS;
  });

  const saveSectionBreaks = useCallback((newBreaks: SectionBreak[]) => {
    setSectionBreaks(newBreaks);
    try { localStorage.setItem(breaksStorageKey, JSON.stringify(newBreaks)); } catch {}
  }, [breaksStorageKey]);

  // Dragging refs to completely bypass React state during pointermove (zero GC / 120 FPS)
  const dragRef = useRef<{
    isPanning: boolean;
    isDraggingBeat: boolean;
    isConnecting: boolean;
    isBoxSelecting: boolean;
    isDraggingMilestone: boolean;
    milestoneId: string | null;
    boxStartWorldX: number;
    boxStartWorldY: number;
    boxCurrentWorldX: number;
    boxCurrentWorldY: number;
    beatId: number | null;
    startMouseX: number;
    startMouseY: number;
    startBeatX: number;
    startBeatY: number;
    startCameraX: number;
    startCameraY: number;
    initialBeatPositions: Map<number, { x: number; y: number; lane: number }>;
    hasMoved: boolean;
  }>({
    isPanning: false,
    isDraggingBeat: false,
    isConnecting: false,
    isBoxSelecting: false,
    isDraggingMilestone: false,
    milestoneId: null,
    boxStartWorldX: 0,
    boxStartWorldY: 0,
    boxCurrentWorldX: 0,
    boxCurrentWorldY: 0,
    beatId: null,
    startMouseX: 0,
    startMouseY: 0,
    startBeatX: 0,
    startBeatY: 0,
    startCameraX: 0,
    startCameraY: 0,
    initialBeatPositions: new Map(),
    hasMoved: false
  });

  const isDirtyRef = useRef<boolean>(true);
  const requestRender = useCallback(() => {
    isDirtyRef.current = true;
  }, []);

  // Sync ProjectContext beats & connections into FlatMemoryCausalityEngine
  useEffect(() => {
    engine.clearAll();

    // Initialize standard story lanes
    LANE_COLORS.forEach((lane, idx) => {
      engine.addLane(idx, idx * LANE_HEIGHT, LANE_HEIGHT, parseInt(lane.color.replace('#', '0x'), 16) * 256 + 255);
    });

    // Populate beats
    beats.forEach(b => {
      const laneIdx = b.trackIndex !== undefined && b.trackIndex >= 0 && b.trackIndex < 5 ? b.trackIndex : 0;
      const width = b.w || DEFAULT_BEAT_WIDTH;
      const height = b.h || BEAT_CARD_HEIGHT;
      const x = b.x || 50;
      const y = laneIdx * LANE_HEIGHT + (LANE_HEIGHT - height) / 2;
      const colorNum = b.color ? parseInt(b.color.replace('#', '0x'), 16) * 256 + 255 : 0x38bdf8ff;

      engine.addBeat(b.id, x, y, width, height, laneIdx, colorNum, 120, 1);
    });

    // Populate causal connections
    if (connections && Array.isArray(connections)) {
      connections.forEach((c, idx) => {
        engine.addConnection(idx + 1, c.from, c.to);
      });
    }

    const errors = engine.validateDAGAndMarkErrors();
    setCycleErrorCount(errors);
    requestRender();
  }, [beats, connections, engine, requestRender]);

  // Coordinate Conversion Helpers
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const cam = cameraRef.current;
    const worldX = cam.x + (screenX - cam.screenWidth / 2) / cam.zoom;
    const worldY = cam.y + (screenY - cam.screenHeight / 2) / cam.zoom;
    return { worldX, worldY };
  }, []);

  const worldToScreen = useCallback((worldX: number, worldY: number) => {
    const cam = cameraRef.current;
    const screenX = (worldX - cam.x) * cam.zoom + cam.screenWidth / 2;
    const screenY = (worldY - cam.y) * cam.zoom + cam.screenHeight / 2;
    return { screenX, screenY };
  }, []);

  // Main Render Loop (Pure Canvas 2D, 120 FPS capable)
  useEffect(() => {
    let animationFrameId: number;
    let frameCount = 0;
    let fpsTimer = performance.now();

    const visibleIndicesBuffer = new Int32Array(2000);

    const render = (now: number) => {
      frameCount++;
      if (now - fpsTimer >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - fpsTimer)));
        frameCount = 0;
        fpsTimer = now;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Check dirty flag or continuous drag
      if (!isDirtyRef.current && !dragRef.current.isDraggingBeat && !dragRef.current.isPanning && !dragRef.current.isBoxSelecting) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      isDirtyRef.current = false;

      const cam = cameraRef.current;
      const w = canvas.width;
      const h = canvas.height;

      // 1. Clear background
      ctx.fillStyle = isLight ? '#f8fafc' : '#141518';
      ctx.fillRect(0, 0, w, h);

      // 2. Render Lanes Background
      for (let i = 0; i < LANE_COLORS.length; i++) {
        const laneWorldY = i * LANE_HEIGHT;
        const laneScreenTop = worldToScreen(0, laneWorldY).screenY;
        const laneScreenHeight = LANE_HEIGHT * cam.zoom;

        // Lane strip background
        ctx.fillStyle = isLight 
          ? (i % 2 === 0 ? '#ffffff' : '#f1f5f9') 
          : (i % 2 === 0 ? '#18191d' : '#1c1d22');
        ctx.fillRect(0, laneScreenTop, w, laneScreenHeight);

        // Lane divider line
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, laneScreenTop + laneScreenHeight);
        ctx.lineTo(w, laneScreenTop + laneScreenHeight);
        ctx.stroke();

        // Lane Header Tag
        ctx.save();
        ctx.fillStyle = LANE_COLORS[i].color;
        ctx.fillRect(16, laneScreenTop + 12, 4, 18);
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillStyle = isLight ? '#334155' : '#e2e8f0';
        ctx.fillText(LANE_COLORS[i].name, 26, laneScreenTop + 25);
        ctx.restore();
      }

      // 3. Grid lines & Timeline Ticks
      ctx.save();
      const startWorldX = cam.x - (cam.screenWidth / 2) / cam.zoom;
      const endWorldX = cam.x + (cam.screenWidth / 2) / cam.zoom;
      const firstTickX = Math.floor(startWorldX / 100) * 100;

      for (let gx = firstTickX; gx <= endWorldX; gx += 100) {
        const sx = worldToScreen(gx, 0).screenX;
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, h);
        ctx.stroke();
      }
      ctx.restore();

      // 4. Milestone Lines & Top Banners (Phase 4)
      if (showMilestones) {
        sectionBreaks.forEach(sb => {
          const worldX = sb.unit * 100;
          const sx = worldToScreen(worldX, 0).screenX;
          if (sx >= -150 && sx <= w + 150) {
            ctx.save();
            ctx.strokeStyle = sb.type === 'act' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(234, 179, 8, 0.35)';
            ctx.lineWidth = sb.type === 'act' ? 2.0 : 1.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(sx, RULER_HEIGHT);
            ctx.lineTo(sx, h);
            ctx.stroke();

            // Top Milestone Banner
            ctx.setLineDash([]);
            ctx.fillStyle = sb.type === 'act' ? '#0284c7' : '#d97706';
            const label = `${sb.title} (P.${sb.unit})`;
            ctx.font = 'bold 9px Inter, sans-serif';
            const textW = ctx.measureText(label).width;
            ctx.beginPath();
            ctx.roundRect(sx - textW / 2 - 6, RULER_HEIGHT + 3, textW + 12, 16, 4);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, sx - textW / 2, RULER_HEIGHT + 14);
            ctx.restore();
          }
        });
      }

      // 5. Frustum Culling Query: Query visible beats in sub-millisecond
      const visibleCount = engine.queryVisibleBeats(cam, visibleIndicesBuffer);
      const buffer = engine.getBeatsBuffer();
      const floatView = new Float32Array(buffer);
      const uintView = new Uint32Array(buffer);
      const intView = new Int32Array(buffer);

      // 6. Draw Causal Connections (Cubic Bezier Splines)
      ctx.save();
      if (connections && Array.isArray(connections)) {
        connections.forEach(conn => {
          const src = engine.getBeat(conn.from);
          const dst = engine.getBeat(conn.to);
          if (!src || !dst) return;

          const p1 = worldToScreen(src.x + src.width, src.y + src.height / 2);
          const p2 = worldToScreen(dst.x, dst.y + dst.height / 2);

          const dx = Math.max(40, (p2.screenX - p1.screenX) * 0.5);

          // Causal Error Highlight
          const isError = (src.flags & BeatFlags.CAUSAL_ERR) || (dst.flags & BeatFlags.CAUSAL_ERR);

          ctx.beginPath();
          ctx.moveTo(p1.screenX, p1.screenY);
          ctx.bezierCurveTo(p1.screenX + dx, p1.screenY, p2.screenX - dx, p2.screenY, p2.screenX, p2.screenY);

          ctx.lineWidth = isError ? 2.5 : 2.0;
          ctx.strokeStyle = isError 
            ? 'rgba(239, 68, 68, 0.85)' 
            : (isLight ? 'rgba(14, 165, 233, 0.7)' : 'rgba(56, 189, 248, 0.65)');
          ctx.setLineDash(isError ? [6, 4] : []);
          ctx.stroke();

          // Arrow head at target
          ctx.fillStyle = isError ? '#ef4444' : '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(p2.screenX, p2.screenY);
          ctx.lineTo(p2.screenX - 7 * cam.zoom, p2.screenY - 4 * cam.zoom);
          ctx.lineTo(p2.screenX - 7 * cam.zoom, p2.screenY + 4 * cam.zoom);
          ctx.closePath();
          ctx.fill();
        });
      }

      // Draw active connection preview if user is connecting beats
      if (dragRef.current.isConnecting && connectingSourceId && connectMousePos) {
        const src = engine.getBeat(connectingSourceId);
        if (src) {
          const p1 = worldToScreen(src.x + src.width, src.y + src.height / 2);
          const p2 = connectMousePos;
          const dx = Math.max(40, (p2.x - p1.screenX) * 0.5);

          ctx.beginPath();
          ctx.moveTo(p1.screenX, p1.screenY);
          ctx.bezierCurveTo(p1.screenX + dx, p1.screenY, p2.x - dx, p2.y, p2.x, p2.y);
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = '#eab308';
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.restore();

      // 7. Draw Beat Cards (Dynamic LOD)
      for (let i = 0; i < visibleCount; i++) {
        const beatIdx = visibleIndicesBuffer[i];
        const base = beatIdx * BEAT_STRIDE_WORDS;

        const id = uintView[base + BEAT_OFFSET_ID];
        const bx = floatView[base + BEAT_OFFSET_X];
        const by = floatView[base + BEAT_OFFSET_Y];
        const bw = floatView[base + BEAT_OFFSET_WIDTH];
        const bh = floatView[base + BEAT_OFFSET_HEIGHT];
        const laneIdx = intView[base + BEAT_OFFSET_LANE_INDEX];
        const flags = uintView[base + BEAT_OFFSET_FLAGS];

        const screenPos = worldToScreen(bx, by);
        const cardW = bw * cam.zoom;
        const cardH = bh * cam.zoom;

        const isSelected = selectedBeatId === id || selectedBeatIds.has(id);
        const isHovered = hoveredBeatId === id;
        const hasCausalErr = (flags & BeatFlags.CAUSAL_ERR) !== 0;

        ctx.save();

        const laneColor = LANE_COLORS[laneIdx % LANE_COLORS.length]?.color || '#38bdf8';

        // --- ULTRA-LOW LOD (zoom < 0.35) ---
        if (cam.zoom < 0.35) {
          const pillH = Math.max(6, 12 * cam.zoom);
          const pillY = screenPos.screenY + (cardH - pillH) / 2;
          ctx.fillStyle = hasCausalErr ? '#ef4444' : (isSelected ? '#38bdf8' : laneColor);
          ctx.beginPath();
          ctx.roundRect(screenPos.screenX, pillY, cardW, pillH, pillH / 2);
          ctx.fill();

          if (isSelected) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.restore();
          continue;
        }

        // --- MEDIUM & HIGH LOD ---
        if (cam.zoom > 0.4) {
          ctx.shadowColor = isSelected 
            ? 'rgba(56, 189, 248, 0.45)' 
            : (isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.45)');
          ctx.shadowBlur = isSelected ? 14 : 6;
          ctx.shadowOffsetY = isSelected ? 4 : 2;
        }

        const radius = Math.min(8 * cam.zoom, 8);
        ctx.fillStyle = isLight ? '#ffffff' : '#222328';
        ctx.beginPath();
        ctx.roundRect(screenPos.screenX, screenPos.screenY, cardW, cardH, radius);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.lineWidth = isSelected ? 2.0 : 1.0;
        if (hasCausalErr) {
          ctx.strokeStyle = '#ef4444';
        } else if (isSelected) {
          ctx.strokeStyle = '#38bdf8';
        } else if (isHovered) {
          ctx.strokeStyle = isLight ? '#94a3b8' : '#475569';
        } else {
          ctx.strokeStyle = isLight ? '#e2e8f0' : '#2e3037';
        }
        ctx.stroke();

        ctx.fillStyle = hasCausalErr ? '#ef4444' : laneColor;
        ctx.beginPath();
        ctx.roundRect(screenPos.screenX, screenPos.screenY, cardW, Math.max(3, 4 * cam.zoom), [radius, radius, 0, 0]);
        ctx.fill();

        if (cam.zoom > 0.45) {
          const beatMeta = beats.find(b => b.id === id);
          const title = beatMeta?.title || `Beat #${id}`;
          const sceneNo = beatMeta?.sceneNumber || `${id}`;

          ctx.fillStyle = isLight ? '#f1f5f9' : '#1a1b1f';
          ctx.beginPath();
          ctx.roundRect(screenPos.screenX + 8 * cam.zoom, screenPos.screenY + 10 * cam.zoom, 24 * cam.zoom, 15 * cam.zoom, 3 * cam.zoom);
          ctx.fill();

          ctx.font = `bold ${Math.max(9, 10 * cam.zoom)}px Inter, sans-serif`;
          ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
          ctx.fillText(sceneNo, screenPos.screenX + 11 * cam.zoom, screenPos.screenY + 21 * cam.zoom);

          ctx.font = `600 ${Math.max(10, 11 * cam.zoom)}px Inter, sans-serif`;
          ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
          
          const maxTextW = cardW - 40 * cam.zoom;
          let displayTitle = title;
          if (ctx.measureText(displayTitle).width > maxTextW) {
            while (displayTitle.length > 3 && ctx.measureText(displayTitle + '…').width > maxTextW) {
              displayTitle = displayTitle.slice(0, -1);
            }
            displayTitle += '…';
          }
          ctx.fillText(displayTitle, screenPos.screenX + 36 * cam.zoom, screenPos.screenY + 21 * cam.zoom);

          if (hasCausalErr) {
            ctx.fillStyle = '#ef4444';
            ctx.font = `bold ${Math.max(8, 9 * cam.zoom)}px Inter, sans-serif`;
            ctx.fillText('⚠ CAUSAL PARADOX', screenPos.screenX + 8 * cam.zoom, screenPos.screenY + cardH - 8 * cam.zoom);
          } else if (cam.zoom > 0.7) {
            ctx.fillStyle = isLight ? '#94a3b8' : '#64748b';
            ctx.font = `${Math.max(8, 9 * cam.zoom)}px Inter, sans-serif`;
            ctx.fillText('1 min · Act 1', screenPos.screenX + 8 * cam.zoom, screenPos.screenY + cardH - 8 * cam.zoom);
          }
        }

        if (cam.zoom > 0.5) {
          ctx.fillStyle = isHovered || isSelected ? '#eab308' : (isLight ? '#cbd5e1' : '#475569');
          ctx.beginPath();
          ctx.arc(screenPos.screenX + cardW, screenPos.screenY + cardH / 2, 4.5 * cam.zoom, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // 8. Spatial Marquee Selection Box
      if (dragRef.current.isBoxSelecting) {
        const p1 = worldToScreen(dragRef.current.boxStartWorldX, dragRef.current.boxStartWorldY);
        const p2 = worldToScreen(dragRef.current.boxCurrentWorldX, dragRef.current.boxCurrentWorldY);
        const bx = Math.min(p1.screenX, p2.screenX);
        const by = Math.min(p1.screenY, p2.screenY);
        const bw = Math.abs(p1.screenX - p2.screenX);
        const bh = Math.abs(p1.screenY - p2.screenY);

        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.restore();
      }

      // 9. Interactive Spatial Minimap
      if (w > 400 && h > 300) {
        ctx.save();
        const mapW = 200;
        const mapH = 90;
        const mapX = 16;
        const mapY = h - mapH - 16;

        ctx.fillStyle = 'rgba(20, 21, 24, 0.85)';
        ctx.beginPath();
        ctx.roundRect(mapX, mapY, mapW, mapH, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        let maxWorldX = 2000;
        const beatsCount = engine.getBeatsCount();
        for (let b = 0; b < beatsCount; b++) {
          const beatData = engine.getBeatByIndex(b);
          if (beatData && beatData.x + beatData.width > maxWorldX) {
            maxWorldX = beatData.x + beatData.width + 500;
          }
        }
        const totalLanesHeight = LANE_COLORS.length * LANE_HEIGHT;

        const scaleX = (mapW - 16) / Math.max(maxWorldX, 1000);
        const scaleY = (mapH - 16) / Math.max(totalLanesHeight, 500);

        for (let b = 0; b < beatsCount; b++) {
          const beatData = engine.getBeatByIndex(b);
          if (!beatData) continue;
          const mx = mapX + 8 + beatData.x * scaleX;
          const my = mapY + 8 + beatData.y * scaleY;
          const mw = Math.max(2, beatData.width * scaleX);
          const mh = Math.max(2, beatData.height * scaleY);

          ctx.fillStyle = LANE_COLORS[beatData.laneIndex % LANE_COLORS.length]?.color || '#38bdf8';
          ctx.fillRect(mx, my, mw, mh);
        }

        const halfW = (cam.screenWidth * 0.5) / cam.zoom;
        const halfH = (cam.screenHeight * 0.5) / cam.zoom;
        const camMinX = cam.x - halfW;
        const camMinY = cam.y - halfH;
        const camW = halfW * 2;
        const camH = halfH * 2;

        const fX = mapX + 8 + camMinX * scaleX;
        const fY = mapY + 8 + camMinY * scaleY;
        const fW = camW * scaleX;
        const fH = camH * scaleY;

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(fX, fY, fW, fH);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.fillRect(fX, fY, fW, fH);

        ctx.restore();
      }

      // 10. Timeline Ruler Bar on Top
      ctx.save();
      ctx.fillStyle = isLight ? '#f1f5f9' : '#1c1d21';
      ctx.fillRect(0, 0, w, RULER_HEIGHT);
      ctx.strokeStyle = isLight ? '#cbd5e1' : '#27282d';
      ctx.beginPath();
      ctx.moveTo(0, RULER_HEIGHT);
      ctx.lineTo(w, RULER_HEIGHT);
      ctx.stroke();

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
      for (let gx = firstTickX; gx <= endWorldX; gx += 100) {
        const sx = worldToScreen(gx, 0).screenX;
        ctx.beginPath();
        ctx.moveTo(sx, RULER_HEIGHT - 8);
        ctx.lineTo(sx, RULER_HEIGHT);
        ctx.stroke();

        const beatIndexNum = Math.round(gx / 100);
        if (beatIndexNum >= 0 && beatIndexNum % 2 === 0) {
          ctx.fillText(`P.${beatIndexNum + 1}`, sx + 4, RULER_HEIGHT - 10);
        }
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [engine, connections, beats, isLight, worldToScreen, connectingSourceId, connectMousePos, showMilestones, sectionBreaks]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);

      cameraRef.current.screenWidth = rect.width;
      cameraRef.current.screenHeight = rect.height;
      requestRender();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [requestRender]);

  // Keyboard Shortcuts: Delete selected beat, Escape to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBeatIds.size > 0) {
          const idsToDelete = new Set(selectedBeatIds);
          setBeats(prev => prev.filter(b => !idsToDelete.has(b.id)));
          setSelectedBeatId(null);
          setSelectedBeatIds(new Set());
          requestRender();
        } else if (selectedBeatId !== null) {
          setBeats(prev => prev.filter(b => b.id !== selectedBeatId));
          setSelectedBeatId(null);
          requestRender();
        }
      } else if (e.key === 'Escape') {
        setSelectedBeatId(null);
        setSelectedBeatIds(new Set());
        setContextMenu(null);
        requestRender();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBeatId, selectedBeatIds, setBeats, requestRender]);

  // Mouse Interaction Handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setContextMenu(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 1. Minimap Click Detection (bottom-left)
    const mapW = 200;
    const mapH = 90;
    const mapX = 16;
    const mapY = rect.height - mapH - 16;

    if (mouseX >= mapX && mouseX <= mapX + mapW && mouseY >= mapY && mouseY <= mapY + mapH) {
      let maxWorldX = 2000;
      const beatsCount = engine.getBeatsCount();
      for (let b = 0; b < beatsCount; b++) {
        const beatData = engine.getBeatByIndex(b);
        if (beatData && beatData.x + beatData.width > maxWorldX) {
          maxWorldX = beatData.x + beatData.width + 500;
        }
      }
      const totalLanesHeight = LANE_COLORS.length * LANE_HEIGHT;
      const relX = Math.max(0, Math.min(1, (mouseX - (mapX + 8)) / (mapW - 16)));
      const relY = Math.max(0, Math.min(1, (mouseY - (mapY + 8)) / (mapH - 16)));

      cameraRef.current.x = relX * maxWorldX;
      cameraRef.current.y = relY * totalLanesHeight;
      requestRender();
      return;
    }

    const { worldX, worldY } = screenToWorld(mouseX, mouseY);
    const hitId = engine.hitTestBeat(worldX, worldY);

    if (e.button === 1 || e.spaceKey) {
      // Middle click or space+click: Pan Camera
      dragRef.current = {
        isPanning: true,
        isDraggingBeat: false,
        isConnecting: false,
        isBoxSelecting: false,
        isDraggingMilestone: false,
        milestoneId: null,
        boxStartWorldX: 0,
        boxStartWorldY: 0,
        boxCurrentWorldX: 0,
        boxCurrentWorldY: 0,
        beatId: null,
        startMouseX: mouseX,
        startMouseY: mouseY,
        startBeatX: 0,
        startBeatY: 0,
        startCameraX: cameraRef.current.x,
        startCameraY: cameraRef.current.y,
        initialBeatPositions: new Map(),
        hasMoved: false
      };
    } else if (e.button === 0 && (e.shiftKey || (hitId === -1 && mouseY > RULER_HEIGHT))) {
      // Shift+Click or Click on Empty Canvas: Start Spatial Marquee Box Selection
      dragRef.current = {
        isPanning: false,
        isDraggingBeat: false,
        isConnecting: false,
        isBoxSelecting: true,
        isDraggingMilestone: false,
        milestoneId: null,
        boxStartWorldX: worldX,
        boxStartWorldY: worldY,
        boxCurrentWorldX: worldX,
        boxCurrentWorldY: worldY,
        beatId: null,
        startMouseX: mouseX,
        startMouseY: mouseY,
        startBeatX: 0,
        startBeatY: 0,
        startCameraX: 0,
        startCameraY: 0,
        initialBeatPositions: new Map(),
        hasMoved: false
      };
      if (!e.shiftKey) {
        setSelectedBeatId(null);
        setSelectedBeatIds(new Set());
      }
    } else if (e.button === 0 && hitId !== -1) {
      // Left click on beat: Start Beat Dragging or Connecting
      const beat = engine.getBeat(hitId);
      if (!beat) return;

      const screenPos = worldToScreen(beat.x, beat.y);
      const cardW = beat.width * cameraRef.current.zoom;
      const cardH = beat.height * cameraRef.current.zoom;

      const distToRightEdge = Math.hypot(mouseX - (screenPos.screenX + cardW), mouseY - (screenPos.screenY + cardH / 2));
      if (distToRightEdge < 15) {
        // Connecting mode
        dragRef.current = {
          isPanning: false,
          isDraggingBeat: false,
          isConnecting: true,
          isBoxSelecting: false,
          isDraggingMilestone: false,
          milestoneId: null,
          boxStartWorldX: 0,
          boxStartWorldY: 0,
          boxCurrentWorldX: 0,
          boxCurrentWorldY: 0,
          beatId: hitId,
          startMouseX: mouseX,
          startMouseY: mouseY,
          startBeatX: 0,
          startBeatY: 0,
          startCameraX: 0,
          startCameraY: 0,
          initialBeatPositions: new Map(),
          hasMoved: false
        };
        setConnectingSourceId(hitId);
        setConnectMousePos({ x: mouseX, y: mouseY });
      } else {
        // Setup batch positions if multi-selected
        const initMap = new Map<number, { x: number; y: number; lane: number }>();
        const targetSelection = selectedBeatIds.has(hitId) ? selectedBeatIds : new Set([hitId]);
        targetSelection.forEach(id => {
          const b = engine.getBeat(id);
          if (b) initMap.set(id, { x: b.x, y: b.y, lane: b.laneIndex });
        });

        dragRef.current = {
          isPanning: false,
          isDraggingBeat: true,
          isConnecting: false,
          isBoxSelecting: false,
          isDraggingMilestone: false,
          milestoneId: null,
          boxStartWorldX: 0,
          boxStartWorldY: 0,
          boxCurrentWorldX: 0,
          boxCurrentWorldY: 0,
          beatId: hitId,
          startMouseX: mouseX,
          startMouseY: mouseY,
          startBeatX: beat.x,
          startBeatY: beat.y,
          startCameraX: 0,
          startCameraY: 0,
          initialBeatPositions: initMap,
          hasMoved: false
        };
        setSelectedBeatId(hitId);
        if (!selectedBeatIds.has(hitId)) {
          setSelectedBeatIds(new Set([hitId]));
        }
      }
    }

    requestRender();
  }, [engine, screenToWorld, worldToScreen, selectedBeatIds, requestRender]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const drag = dragRef.current;

    if (drag.isPanning) {
      const dx = (mouseX - drag.startMouseX) / cameraRef.current.zoom;
      const dy = (mouseY - drag.startMouseY) / cameraRef.current.zoom;
      cameraRef.current.x = drag.startCameraX - dx;
      cameraRef.current.y = drag.startCameraY - dy;
      drag.hasMoved = true;
      requestRender();
    } else if (drag.isBoxSelecting) {
      const { worldX, worldY } = screenToWorld(mouseX, mouseY);
      drag.boxCurrentWorldX = worldX;
      drag.boxCurrentWorldY = worldY;
      requestRender();
    } else if (drag.isDraggingBeat && drag.beatId !== null) {
      const dx = (mouseX - drag.startMouseX) / cameraRef.current.zoom;

      // Batch Drag Handling
      if (drag.initialBeatPositions.size > 1 && drag.initialBeatPositions.has(drag.beatId)) {
        drag.initialBeatPositions.forEach((init, id) => {
          const nextX = Math.max(0, init.x + dx);
          engine.updateBeatPosition(id, nextX, init.y);
          if (rippleModeActive) {
            engine.solveLaneRipple(init.lane, id, nextX, 24.0);
          }
        });
      } else {
        const rawX = Math.max(0, drag.startBeatX + dx);
        const beat = engine.getBeat(drag.beatId);
        if (beat) {
          const { worldY } = screenToWorld(mouseX, mouseY);
          const targetLane = Math.max(0, Math.min(4, Math.floor(worldY / LANE_HEIGHT)));

          let finalX = rawX;
          if (snapToGridActive) {
            finalX = engine.snapBeatPosition(rawX, targetLane, 16.0);
          }

          if (rippleModeActive) {
            engine.solveLaneRipple(targetLane, drag.beatId, finalX, 24.0);
            engine.propagateCausalRipple(drag.beatId, 40.0);
          } else {
            engine.updateBeatPosition(drag.beatId, finalX, targetLane * LANE_HEIGHT + (LANE_HEIGHT - beat.height) / 2);
          }
        }
      }

      drag.hasMoved = true;
      requestRender();
    } else if (drag.isConnecting) {
      setConnectMousePos({ x: mouseX, y: mouseY });
      requestRender();
    } else {
      const { worldX, worldY } = screenToWorld(mouseX, mouseY);
      const hitId = engine.hitTestBeat(worldX, worldY);
      if (hitId !== hoveredBeatId) {
        setHoveredBeatId(hitId !== -1 ? hitId : null);
        requestRender();
      }
    }
  }, [engine, rippleModeActive, snapToGridActive, screenToWorld, hoveredBeatId, requestRender]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;

    if (drag.isBoxSelecting) {
      const minX = Math.min(drag.boxStartWorldX, drag.boxCurrentWorldX);
      const maxX = Math.max(drag.boxStartWorldX, drag.boxCurrentWorldX);
      const minY = Math.min(drag.boxStartWorldY, drag.boxCurrentWorldY);
      const maxY = Math.max(drag.boxStartWorldY, drag.boxCurrentWorldY);

      if (Math.abs(maxX - minX) > 10 || Math.abs(maxY - minY) > 10) {
        const boxBuffer = new Int32Array(500);
        const count = engine.querySpatialRange(minX, minY, maxX, maxY, boxBuffer);
        const newSet = new Set<number>();
        for (let i = 0; i < count; i++) newSet.add(boxBuffer[i]);
        setSelectedBeatIds(newSet);
        setSelectedBeatId(count > 0 ? boxBuffer[0] : null);
      }
    } else if (drag.isDraggingBeat && drag.beatId !== null && drag.hasMoved) {
      const beatsCount = engine.getBeatsCount();
      const updatedBeats = [...beats];

      for (let i = 0; i < beatsCount; i++) {
        const beatData = engine.getBeatByIndex(i);
        if (!beatData) continue;
        const targetIdx = updatedBeats.findIndex(b => b.id === beatData.id);
        if (targetIdx !== -1) {
          updatedBeats[targetIdx] = {
            ...updatedBeats[targetIdx],
            x: beatData.x,
            y: beatData.y,
            trackIndex: beatData.laneIndex
          };
        }
      }

      setBeats(updatedBeats);
    } else if (drag.isConnecting && connectingSourceId !== null) {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { worldX, worldY } = screenToWorld(mouseX, mouseY);
      const targetBeatId = engine.hitTestBeat(worldX, worldY);

      if (targetBeatId !== -1 && targetBeatId !== connectingSourceId) {
        const wouldCycle = engine.wouldCreateCycle(connectingSourceId, targetBeatId);
        if (wouldCycle) {
          alert('Cannot connect: This would create a circular causal paradox!');
        } else {
          engine.addConnection(Date.now(), connectingSourceId, targetBeatId);
        }
      }

      setConnectingSourceId(null);
      setConnectMousePos(null);
    }

    dragRef.current = {
      isPanning: false,
      isDraggingBeat: false,
      isConnecting: false,
      isBoxSelecting: false,
      isDraggingMilestone: false,
      milestoneId: null,
      boxStartWorldX: 0,
      boxStartWorldY: 0,
      boxCurrentWorldX: 0,
      boxCurrentWorldY: 0,
      beatId: null,
      startMouseX: 0,
      startMouseY: 0,
      startBeatX: 0,
      startBeatY: 0,
      startCameraX: 0,
      startCameraY: 0,
      initialBeatPositions: new Map(),
      hasMoved: false
    };

    requestRender();
  }, [beats, engine, setBeats, connectingSourceId, screenToWorld, requestRender]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const { worldX, worldY } = screenToWorld(mouseX, mouseY);
    const hitId = engine.hitTestBeat(worldX, worldY);

    if (hitId !== -1) {
      setSelectedBeatId(hitId);
      if (!selectedBeatIds.has(hitId)) {
        setSelectedBeatIds(new Set([hitId]));
      }
      setContextMenu({
        type: 'beat',
        beatId: hitId,
        worldX,
        worldY,
        screenX: Math.min(window.innerWidth - 240, e.clientX),
        screenY: Math.min(window.innerHeight - 300, e.clientY)
      });
    } else {
      setContextMenu({
        type: 'canvas',
        worldX,
        worldY,
        screenX: Math.min(window.innerWidth - 240, e.clientX),
        screenY: Math.min(window.innerHeight - 300, e.clientY)
      });
    }
  }, [engine, screenToWorld, selectedBeatIds]);

  // Smooth Zooming centered on mouse cursor
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const cam = cameraRef.current;
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.min(2.5, Math.max(0.2, cam.zoom * zoomFactor));

    if (newZoom !== cam.zoom) {
      const worldUnderCursorX = cam.x + (mouseX - cam.screenWidth / 2) / cam.zoom;
      const worldUnderCursorY = cam.y + (mouseY - cam.screenHeight / 2) / cam.zoom;

      cam.zoom = newZoom;
      cam.x = worldUnderCursorX - (mouseX - cam.screenWidth / 2) / newZoom;
      cam.y = worldUnderCursorY - (mouseY - cam.screenHeight / 2) / newZoom;

      setZoomLevel(newZoom);
      requestRender();
    }
  }, [requestRender]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const { worldX, worldY } = screenToWorld(mouseX, mouseY);
    const hitId = engine.hitTestBeat(worldX, worldY);

    if (hitId !== -1 && onEditBeat) {
      onEditBeat(hitId);
    } else if (hitId === -1) {
      const laneIdx = Math.max(0, Math.min(4, Math.floor(worldY / LANE_HEIGHT)));
      const newId = beats.length > 0 ? Math.max(...beats.map(b => b.id)) + 1 : 1;
      const newBeat: Beat = {
        id: newId,
        x: worldX,
        y: laneIdx * LANE_HEIGHT + (LANE_HEIGHT - BEAT_CARD_HEIGHT) / 2,
        title: `Scene ${newId}`,
        content: '',
        slug: { type: 'INT', location: 'LOCATION', time: 'DAY' },
        trackIndex: laneIdx,
        w: DEFAULT_BEAT_WIDTH,
        h: BEAT_CARD_HEIGHT
      };
      setBeats([...beats, newBeat]);
    }
  }, [beats, engine, onEditBeat, screenToWorld, setBeats]);

  // Phase 4: Auto-Compact Lane (removes gaps while preserving order)
  const handleCompactLane = useCallback((targetLane: number) => {
    const laneBeats = beats.filter(b => (b.trackIndex ?? 0) === targetLane);
    laneBeats.sort((a, b) => a.x - b.x);

    let curX = 50;
    const updated = [...beats];
    laneBeats.forEach(lb => {
      const idx = updated.findIndex(b => b.id === lb.id);
      if (idx !== -1) {
        updated[idx] = { ...updated[idx], x: curX };
        curX += (updated[idx].w || DEFAULT_BEAT_WIDTH) + 24;
      }
    });
    setBeats(updated);
    requestRender();
  }, [beats, setBeats, requestRender]);

  // Phase 4: Topological DAG Auto-Align (ensures causes precede effects)
  const handleTopologicalAlign = useCallback(() => {
    if (!connections || connections.length === 0) return;
    const updated = [...beats];

    connections.forEach(conn => {
      const src = updated.find(b => b.id === conn.from);
      const dstIdx = updated.findIndex(b => b.id === conn.to);
      if (src && dstIdx !== -1) {
        const requiredX = src.x + (src.w || DEFAULT_BEAT_WIDTH) + 40;
        if (updated[dstIdx].x < requiredX) {
          updated[dstIdx] = { ...updated[dstIdx], x: requiredX };
        }
      }
    });

    setBeats(updated);
    requestRender();
  }, [beats, connections, setBeats, requestRender]);

  // Phase 4 Context Menu Actions
  const handleSetBeatColor = (colorHex: string) => {
    if (!contextMenu?.beatId) return;
    const targetIds = selectedBeatIds.has(contextMenu.beatId) ? selectedBeatIds : new Set([contextMenu.beatId]);
    setBeats(prev => prev.map(b => targetIds.has(b.id) ? { ...b, color: colorHex } : b));
    setContextMenu(null);
  };

  const handleMoveToLane = (laneIdx: number) => {
    if (!contextMenu?.beatId) return;
    const targetIds = selectedBeatIds.has(contextMenu.beatId) ? selectedBeatIds : new Set([contextMenu.beatId]);
    setBeats(prev => prev.map(b => targetIds.has(b.id) ? { ...b, trackIndex: laneIdx } : b));
    setContextMenu(null);
  };

  const handleDuplicateBeat = () => {
    if (!contextMenu?.beatId) return;
    const b = beats.find(x => x.id === contextMenu.beatId);
    if (!b) return;

    const newId = beats.length > 0 ? Math.max(...beats.map(x => x.id)) + 1 : 1;
    const cloned: Beat = {
      ...b,
      id: newId,
      x: b.x + (b.w || DEFAULT_BEAT_WIDTH) + 24,
      title: `${b.title} (Copy)`
    };
    setBeats([...beats, cloned]);
    setContextMenu(null);
  };

  const handleDeleteBeat = () => {
    if (!contextMenu?.beatId) return;
    const targetIds = selectedBeatIds.has(contextMenu.beatId) ? selectedBeatIds : new Set([contextMenu.beatId]);
    setBeats(prev => prev.filter(b => !targetIds.has(b.id)));
    setSelectedBeatId(null);
    setSelectedBeatIds(new Set());
    setContextMenu(null);
  };

  const handleResetView = () => {
    const cam = cameraRef.current;
    cam.x = 400;
    cam.y = 300;
    cam.zoom = 1.0;
    setZoomLevel(1.0);
    requestRender();
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden flex flex-col select-none bg-[#141518]">
      {/* ─── CAUSALITY CANVAS TOP TOOLBAR ─── */}
      <div className="h-10 px-4 border-b border-white/5 bg-[#18191d] flex items-center justify-between z-10 shrink-0 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400/50" />
            <span className="font-bold text-white tracking-wide text-sm">Causality Engine</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-medium">
              120 FPS
            </span>
          </div>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Ripple Mode Toggle */}
          <button
            onClick={() => setRippleModeActive(!rippleModeActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all ${
              rippleModeActive 
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium' 
                : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
            title="Multi-Lane Ripple: Moving a beat cascades downstream beats in its lane and connected causes"
          >
            <Move size={12} />
            <span>Ripple Flow {rippleModeActive ? 'ON' : 'OFF'}</span>
          </button>

          {/* Magnetic Snapping Toggle */}
          <button
            onClick={() => setSnapToGridActive(!snapToGridActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all ${
              snapToGridActive 
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-medium' 
                : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
            title="Magnetic Snapping: Snaps beats to neighboring edges and grid lines"
          >
            <Compass size={12} />
            <span>Magnetic Snap</span>
          </button>

          {/* Milestones Toggle */}
          <button
            onClick={() => { setShowMilestones(!showMilestones); requestRender(); }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${
              showMilestones 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium' 
                : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
            title="Toggle Screenplay Milestones (Act Breaks, Inciting Incident, Midpoint)"
          >
            <Flag size={12} />
            <span>Milestones</span>
          </button>

          {/* Flow Tools */}
          <button
            onClick={() => handleCompactLane(0)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-white/60 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
            title="Auto-Compact Main Lane: Eliminates empty gaps while preserving story sequence"
          >
            <ArrowLeftRight size={12} />
            <span>Compact Flow</span>
          </button>

          <button
            onClick={handleTopologicalAlign}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-white/60 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
            title="Auto-Align Causal DAG: Automatically resolves causal pushes across all lanes"
          >
            <Zap size={12} />
            <span>Auto-DAG</span>
          </button>

          {/* Cycle Error Warning Badge */}
          {cycleErrorCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-medium animate-pulse">
              <AlertTriangle size={12} />
              <span>{cycleErrorCount} Causal Loop Detected</span>
            </div>
          )}
        </div>

        {/* View Controls & Stats */}
        <div className="flex items-center gap-2 text-white/60">
          <span className="font-mono text-[11px] text-white/40 mr-2">
            {beats.length} beats {selectedBeatIds.size > 1 ? `(${selectedBeatIds.size} selected)` : ''} · {fps} FPS
          </span>

          <div className="flex items-center bg-white/5 rounded border border-white/10 p-0.5">
            <button
              onClick={() => { const cam = cameraRef.current; cam.zoom = Math.max(0.2, cam.zoom * 0.8); setZoomLevel(cam.zoom); requestRender(); }}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[10px] font-mono px-2 text-white/80 select-none">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => { const cam = cameraRef.current; cam.zoom = Math.min(2.5, cam.zoom * 1.25); setZoomLevel(cam.zoom); requestRender(); }}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={handleResetView}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors ml-0.5"
              title="Reset View"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── MAIN HARDWARE-ACCELERATED CANVAS ─── */}
      <div className="flex-1 relative cursor-grab active:cursor-grabbing">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          className="absolute inset-0 block touch-none"
        />

        {/* Floating Quick Action Overlay in Bottom Corner */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-[#18191d]/90 backdrop-blur-md p-1.5 rounded-lg border border-white/10 shadow-2xl z-20 text-xs">
          <span className="text-[11px] text-white/60 px-2 font-medium">
            Right-click for Color & Lane · Shift+drag to Multi-Select · Drag handle to connect
          </span>
        </div>

        {/* ─── PHASE 4 SLEEK CONTEXT MENU ─── */}
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
            />
            <div
              style={{ left: `${contextMenu.screenX}px`, top: `${contextMenu.screenY}px` }}
              className="fixed z-50 w-56 rounded-xl shadow-2xl p-1.5 text-xs font-sans border border-white/10 bg-[#1c1d22]/95 backdrop-blur-2xl text-white animate-in fade-in zoom-in-95 duration-100"
            >
              {contextMenu.type === 'beat' && contextMenu.beatId && (() => {
                const beat = beats.find(b => b.id === contextMenu.beatId);
                if (!beat) return null;

                return (
                  <div className="flex flex-col gap-1">
                    <div className="px-2 py-1 text-[10px] font-mono text-white/50 border-b border-white/5 flex items-center justify-between">
                      <span>Beat #{beat.id}</span>
                      <span>{selectedBeatIds.size > 1 ? `${selectedBeatIds.size} beats` : ''}</span>
                    </div>

                    {/* Color Swatch Picker */}
                    <div className="px-2 py-1 flex flex-col gap-1">
                      <span className="text-[10px] text-white/50 font-medium">Color Palette</span>
                      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                        {CAUSALITY_PALETTE.map(c => (
                          <button
                            key={c.hex}
                            onClick={() => handleSetBeatColor(c.hex)}
                            style={{ backgroundColor: c.hex }}
                            className="w-5 h-5 rounded-full hover:scale-125 transition-transform flex items-center justify-center cursor-pointer shadow-sm"
                            title={c.name}
                          >
                            {beat.color === c.hex && <Check size={11} className="text-white drop-shadow" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-white/10 my-0.5" />

                    {/* Move to Lane */}
                    <div className="px-2 py-1 flex flex-col gap-1">
                      <span className="text-[10px] text-white/50 font-medium">Story Lane</span>
                      <div className="flex flex-col gap-0.5">
                        {LANE_COLORS.map((lane, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleMoveToLane(idx)}
                            className={`w-full px-2 py-1 rounded text-left flex items-center gap-2 hover:bg-white/10 transition-colors cursor-pointer text-[11px] ${
                              (beat.trackIndex ?? 0) === idx ? 'text-cyan-400 font-semibold' : 'text-white/80'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lane.color }} />
                            <span className="truncate">{lane.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-white/10 my-0.5" />

                    {/* Actions */}
                    <button
                      onClick={() => {
                        if (onEditBeat) onEditBeat(beat.id);
                        setContextMenu(null);
                      }}
                      className="w-full px-2 py-1.5 rounded flex items-center gap-2 hover:bg-white/10 text-cyan-400 transition-colors cursor-pointer"
                    >
                      <ScrollText size={13} />
                      <span>Edit in Screenplay</span>
                    </button>

                    <button
                      onClick={handleDuplicateBeat}
                      className="w-full px-2 py-1.5 rounded flex items-center gap-2 hover:bg-white/10 text-emerald-400 transition-colors cursor-pointer"
                    >
                      <Copy size={13} />
                      <span>Duplicate Beat</span>
                    </button>

                    <button
                      onClick={handleDeleteBeat}
                      className="w-full px-2 py-1.5 rounded flex items-center gap-2 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Delete {selectedBeatIds.size > 1 ? `${selectedBeatIds.size} Beats` : 'Beat'}</span>
                    </button>
                  </div>
                );
              })()}

              {contextMenu.type === 'canvas' && (
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      const newId = beats.length > 0 ? Math.max(...beats.map(x => x.id)) + 1 : 1;
                      const laneIdx = Math.max(0, Math.min(4, Math.floor(contextMenu.worldY / LANE_HEIGHT)));
                      const newBeat: Beat = {
                        id: newId,
                        x: contextMenu.worldX,
                        y: laneIdx * LANE_HEIGHT + (LANE_HEIGHT - BEAT_CARD_HEIGHT) / 2,
                        title: `Scene ${newId}`,
                        content: '',
                        slug: { type: 'INT', location: 'LOCATION', time: 'DAY' },
                        trackIndex: laneIdx,
                        w: DEFAULT_BEAT_WIDTH,
                        h: BEAT_CARD_HEIGHT
                      };
                      setBeats([...beats, newBeat]);
                      setContextMenu(null);
                    }}
                    className="w-full px-2.5 py-1.5 rounded flex items-center gap-2 hover:bg-white/10 text-cyan-400 transition-colors cursor-pointer font-medium"
                  >
                    <Plus size={13} />
                    <span>Add Beat Here</span>
                  </button>

                  <button
                    onClick={() => {
                      const page = Math.max(1, Math.round(contextMenu.worldX / 100));
                      const newBreak: SectionBreak = {
                        id: `sb-${Date.now()}`,
                        title: `MILESTONE P.${page}`,
                        unit: page,
                        type: 'beat'
                      };
                      saveSectionBreaks([...sectionBreaks, newBreak]);
                      setContextMenu(null);
                      requestRender();
                    }}
                    className="w-full px-2.5 py-1.5 rounded flex items-center gap-2 hover:bg-white/10 text-amber-400 transition-colors cursor-pointer"
                  >
                    <Flag size={13} />
                    <span>Add Milestone Here</span>
                  </button>

                  <div className="h-px bg-white/10 my-1" />

                  <button
                    onClick={() => {
                      const laneIdx = Math.max(0, Math.min(4, Math.floor(contextMenu.worldY / LANE_HEIGHT)));
                      handleCompactLane(laneIdx);
                      setContextMenu(null);
                    }}
                    className="w-full px-2.5 py-1.5 rounded flex items-center gap-2 hover:bg-white/10 text-white/80 transition-colors cursor-pointer"
                  >
                    <ArrowLeftRight size={13} />
                    <span>Compact This Lane</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CausalityCanvasBoard;
