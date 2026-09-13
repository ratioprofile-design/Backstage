import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Excalidraw, exportToBlob, exportToSvg, serializeAsJSON } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useProject } from '../context/ProjectContext';
import { Beat } from '../types';
import { addProductionDocument } from '../services/documentsStorage';
import confetti from 'canvas-confetti';
import { 
  Eye, EyeOff, Plus, Layers, Sparkles, Move, FileText, CheckCircle2, 
  Clock, MapPin, ExternalLink, Hash, Palette, Download, FolderOpen,
  ChevronDown, Image, FileCode, Check
} from 'lucide-react';

interface ExcalidrawBoardProps {
  isLight?: boolean;
  onEditBeat?: (id: number) => void;
}

// Prevent Excalidraw from turning bitmap images into photo-negatives in dark mode
if (typeof window !== 'undefined' && 'CanvasRenderingContext2D' in window) {
  const descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'filter');
  if (descriptor && descriptor.set) {
    const originalSet = descriptor.set;
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'filter', {
      ...descriptor,
      set(value: string) {
        // Intercept Excalidraw's IMAGE_INVERT_FILTER in dark mode so real photos and stills keep their true colors
        if (typeof value === 'string' && value.includes('invert(100%)')) {
          return originalSet.call(this, 'none');
        }
        return originalSet.call(this, value);
      }
    });
  }
}

// IndexedDB storage helpers for unlimited, rock-solid Excalidraw scene & image persistence
const DB_NAME = 'backstage_excalidraw_db';
const STORE_NAME = 'scenes';

function openExcalidrawDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveSceneData(key: string, data: any) {
  // 1. Primary storage: IndexedDB (supports large bulk images without 5MB quota errors)
  try {
    const db = await openExcalidrawDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, key);
    }
  } catch (e) {
    console.warn('Failed to save Excalidraw scene to IndexedDB:', e);
  }

  // 2. Secondary fallback: localStorage (may exceed 5MB if many images)
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // If quota exceeded due to high-res images in `files`, keep drawings/elements in localStorage
    try {
      const slimData = { ...data, files: {} };
      localStorage.setItem(key, JSON.stringify(slimData));
    } catch {}
  }
}

async function loadSceneData(key: string, legacyKey?: string): Promise<any> {
  // 1. Try IndexedDB first
  try {
    const db = await openExcalidrawDB();
    if (db) {
      const data = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (data) return data;
    }
  } catch {}

  // 2. Fallback to localStorage
  try {
    const saved = localStorage.getItem(key) || (legacyKey ? localStorage.getItem(legacyKey) : null);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
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
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Dragging state for beat cards
  const [draggingBeatId, setDraggingBeatId] = useState<number | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; beatX: number; beatY: number } | null>(null);

  // Storage key per project (checks current and previous board4 keys)
  const storageKey = `backstage_excalidraw_${currentProjectId || 'default'}`;
  const legacyStorageKey = `backstage_excalidraw_board4_${currentProjectId || 'default'}`;

  // Initial scene load from fast sync localStorage
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

  // Also hydrate from IndexedDB asynchronously in case localStorage hit quota limits with images
  useEffect(() => {
    if (!excalidrawAPI) return;
    loadSceneData(storageKey, legacyStorageKey).then((saved) => {
      if (saved && saved.elements && saved.elements.length > 0) {
        if (saved.files && Object.keys(saved.files).length > 0) {
          excalidrawAPI.addFiles(Object.values(saved.files));
        }
        excalidrawAPI.updateScene({
          elements: saved.elements,
          appState: saved.appState,
        });
      }
    });
  }, [excalidrawAPI, storageKey, legacyStorageKey]);

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

    // Debounce save drawings to IndexedDB + localStorage
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      const sceneData = {
        elements: elements.filter(el => !el.isDeleted),
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files: files,
      };
      saveSceneData(storageKey, sceneData);
    }, 400);
  }, [storageKey]);

  // Export handlers
  const handleExportPNG = async () => {
    if (!excalidrawAPI) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      const blob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportWithDarkMode: !isLight,
          exportBackground: true,
        },
        files,
        mimeType: 'image/png',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whiteboard_${Date.now()}.png`;
      a.click();
      showToast('Exported high-res PNG image!');
    } catch (e) {
      console.error(e);
      showToast('Failed to export PNG.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSVG = async () => {
    if (!excalidrawAPI) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      const svg = await exportToSvg({
        elements,
        appState: {
          ...appState,
          exportWithDarkMode: !isLight,
          exportBackground: true,
        },
        files,
      });
      const svgString = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whiteboard_${Date.now()}.svg`;
      a.click();
      showToast('Exported SVG vector graphics!');
    } catch (e) {
      console.error(e);
      showToast('Failed to export SVG.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = () => {
    if (!excalidrawAPI) return;
    setShowExportMenu(false);
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      const jsonString = serializeAsJSON(elements, appState, files, 'local');
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whiteboard_scene_${Date.now()}.excalidraw`;
      a.click();
      showToast('Exported scene file (.excalidraw)!');
    } catch (e) {
      console.error(e);
      showToast('Failed to export scene JSON.');
    }
  };

  // Save Snapshot directly into Document Vault
  const handleSaveToVault = async () => {
    if (!excalidrawAPI) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();
      const blob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportWithDarkMode: !isLight,
          exportBackground: true,
        },
        files,
        mimeType: 'image/png',
      });

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        addProductionDocument({
          title: `Whiteboard Visual Lookbook & Blocking (${new Date().toLocaleDateString()})`,
          titleTa: 'வெண்பலகை வரைபடம் (Excalidraw Lookbook)',
          category: 'LOOKBOOK',
          fileName: `Whiteboard_Canvas_${Date.now()}.png`,
          fileSize: `${(blob.size / 1024).toFixed(0)} KB`,
          pageCount: 1,
          imageDataUrl: dataUrl,
          builtInType: 'excalidraw',
          author: 'Director / DOP',
        });
        confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
        showToast('✓ Saved Whiteboard snapshot directly to Document Vault!');
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error(e);
      showToast('Failed to save to Document Vault.');
    } finally {
      setIsExporting(false);
    }
  };

  // Card dragging handlers
  const handleCardMouseDown = (e: React.MouseEvent, beat: Beat) => {
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

  const isImportingRef = useRef<boolean>(false);

  // Insert one or more image files directly into the Excalidraw scene, arranged neatly in a grid
  const insertImageFiles = useCallback(async (files: FileList | File[], clientX?: number, clientY?: number) => {
    if (!excalidrawAPI) {
      showToast('Whiteboard canvas is initializing...');
      return;
    }

    if (isImportingRef.current) return;
    isImportingRef.current = true;

    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      isImportingRef.current = false;
      showToast('Please select valid image files (PNG, JPG, SVG, WebP).');
      return;
    }

    showToast(`Arranging ${fileArray.length} ${fileArray.length === 1 ? 'image' : 'images'}...`);

    // Helper to read file and calculate natural aspect ratio
    const readImage = (file: File): Promise<{ fileId: string; dataURL: string; width: number; height: number } | null> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataURL = reader.result as string;
          const img = new window.Image();
          img.onload = () => {
            const naturalWidth = img.naturalWidth || 400;
            const naturalHeight = img.naturalHeight || 300;

            // Target initial max dimension per image card on canvas
            const maxTileDimension = 360;
            const scale = Math.min(1, maxTileDimension / Math.max(naturalWidth, naturalHeight));
            const width = Math.max(120, Math.round(naturalWidth * scale));
            const height = Math.max(90, Math.round(naturalHeight * scale));

            const fileId = 'file_' + Math.random().toString(36).substring(2, 11);
            resolve({ fileId, dataURL, width, height });
          };
          img.onerror = () => resolve(null);
          img.src = dataURL;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    };

    try {
      const processed = (await Promise.all(fileArray.map(readImage))).filter(Boolean) as { fileId: string; dataURL: string; width: number; height: number }[];
      if (processed.length === 0) {
        showToast('Failed to load image data.');
        return;
      }

      // Calculate center coordinate in scene world space
      let originX: number;
      let originY: number;

      if (clientX !== undefined && clientY !== undefined) {
        originX = Math.round((clientX - scrollX * zoom) / zoom);
        originY = Math.round((clientY - scrollY * zoom) / zoom);
      } else {
        originX = Math.round((-scrollX) + (window.innerWidth / (2 * zoom)));
        originY = Math.round((-scrollY) + (window.innerHeight / (2 * zoom)));
      }

      const count = processed.length;
      const GAP = 28;

      // Smart column calculation:
      // 1 image -> 1 col
      // 2-3 images -> side by side row
      // 4 images -> 2x2 grid
      // 5-6 images -> 3x2 grid
      // 7-8 images -> 4x2 grid
      // 9+ images -> up to 5 cols
      let cols = 1;
      if (count === 1) cols = 1;
      else if (count <= 3) cols = count;
      else if (count === 4) cols = 2;
      else if (count <= 6) cols = 3;
      else if (count <= 8) cols = 4;
      else cols = Math.min(5, Math.ceil(Math.sqrt(count)));

      const rows = Math.ceil(count / cols);
      const colWidths: number[] = new Array(cols).fill(0);
      const rowHeights: number[] = new Array(rows).fill(0);

      // Measure column widths and row heights
      processed.forEach((item, index) => {
        const c = index % cols;
        const r = Math.floor(index / cols);
        colWidths[c] = Math.max(colWidths[c], item.width);
        rowHeights[r] = Math.max(rowHeights[r], item.height);
      });

      const totalGridWidth = colWidths.reduce((sum, w) => sum + w, 0) + (cols - 1) * GAP;
      const totalGridHeight = rowHeights.reduce((sum, h) => sum + h, 0) + (rows - 1) * GAP;

      // Starting top-left anchor centered at origin
      const startX = originX - Math.round(totalGridWidth / 2);
      const startY = originY - Math.round(totalGridHeight / 2);

      // Calculate col and row offsets
      const colOffsets: number[] = [0];
      for (let c = 1; c < cols; c++) {
        colOffsets[c] = colOffsets[c - 1] + colWidths[c - 1] + GAP;
      }
      const rowOffsets: number[] = [0];
      for (let r = 1; r < rows; r++) {
        rowOffsets[r] = rowOffsets[r - 1] + rowHeights[r - 1] + GAP;
      }

      // Register binary files in Excalidraw
      const allFilesData = processed.map(p => ({
        id: p.fileId,
        dataURL: p.dataURL as any,
        // Mark as image/svg+xml so Excalidraw skips internal dark-mode invert filters
        mimeType: 'image/svg+xml' as any,
        created: Date.now(),
        lastRetrieved: Date.now(),
      }));

      excalidrawAPI.addFiles(allFilesData);

      // Create new Excalidraw image elements
      const newImageElements = processed.map((item, index) => {
        const c = index % cols;
        const r = Math.floor(index / cols);

        // Center each image within its assigned grid cell
        const cellWidth = colWidths[c];
        const cellHeight = rowHeights[r];
        const x = startX + colOffsets[c] + Math.round((cellWidth - item.width) / 2);
        const y = startY + rowOffsets[r] + Math.round((cellHeight - item.height) / 2);

        return {
          id: 'img_' + Math.random().toString(36).substring(2, 11),
          type: 'image',
          x,
          y,
          width: item.width,
          height: item.height,
          angle: 0,
          strokeColor: 'transparent',
          backgroundColor: 'transparent',
          fillStyle: 'solid',
          strokeWidth: 1,
          strokeStyle: 'solid',
          roughness: 0,
          opacity: 100,
          groupIds: [],
          frameId: null,
          roundness: null,
          seed: Math.floor(Math.random() * 100000),
          version: 1,
          versionNonce: Math.floor(Math.random() * 100000),
          isDeleted: false,
          boundElements: null,
          updated: Date.now(),
          link: null,
          locked: false,
          fileId: item.fileId,
          status: 'saved',
          scale: [1, 1],
          crop: null,
        };
      });

      const currentElements = excalidrawAPI.getSceneElements();
      const existingIds = new Set(currentElements.map((el: any) => el.id));
      const filteredNewElements = newImageElements.filter(el => !existingIds.has(el.id));

      const selectedElementIds: Record<string, boolean> = {};
      filteredNewElements.forEach(el => { selectedElementIds[el.id] = true; });

      excalidrawAPI.updateScene({
        elements: [...currentElements, ...filteredNewElements],
        appState: {
          selectedElementIds,
        },
        commitToHistory: true,
      });

      showToast(`Arranged ${count} ${count === 1 ? 'image' : 'images'} in grid!`);
    } catch (err) {
      console.error('Failed to import images into Excalidraw:', err);
      showToast('Failed to import images.');
    } finally {
      setTimeout(() => {
        isImportingRef.current = false;
      }, 300);
    }
  }, [excalidrawAPI, scrollX, scrollY, zoom]);

  // Intercept Cmd+V (Paste) in capture phase so Excalidraw's document listener does not insert a duplicate
  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const imageFiles = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          // Stop immediate propagation so Excalidraw does not process the paste and duplicate the image
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          insertImageFiles(imageFiles);
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste, { capture: true });
    return () => {
      window.removeEventListener('paste', handleWindowPaste, { capture: true });
    };
  }, [insertImageFiles]);

  return (
    <div 
      className="w-full h-full relative overflow-hidden bg-[#121212] select-none"
      onDragOverCapture={(e) => {
        if (e.dataTransfer.types && (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('public.file-url'))) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDropCapture={(e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const imageFiles = Array.from(e.dataTransfer.files).filter((f: File) => f.type.startsWith('image/'));
          if (imageFiles.length > 0) {
            // Stop propagation in capture phase so Excalidraw's inner handleAppOnDrop never receives it
            e.preventDefault();
            e.stopPropagation();
            insertImageFiles(imageFiles, e.clientX, e.clientY);
          }
        }
      }}
    >
      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[300] px-4 py-2 rounded-xl bg-slate-950/90 text-white border border-white/10 shadow-2xl backdrop-blur-md text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={14} className="text-amber-400" />
          <span>{toastMsg}</span>
        </div>
      )}

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
          },
          tools: {
            image: true,
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

        {/* Import Images Action Button */}
        <label 
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800' : 'bg-[#2a2a36] hover:bg-[#343444] border-white/10 text-white'
          }`}
          title="Import one or multiple image files onto the whiteboard (arranged neatly in a grid)"
        >
          <Image size={13} className="text-sky-400" />
          <span>Add Images</span>
          <input 
            type="file" 
            accept="image/*" 
            multiple
            className="hidden" 
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                insertImageFiles(e.target.files);
              }
              e.target.value = '';
            }}
          />
        </label>

        {/* Save to Vault Action */}
        <button
          onClick={handleSaveToVault}
          disabled={isExporting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800' : 'bg-[#2a2a36] hover:bg-[#343444] border-white/10 text-white'
          }`}
          title="Save this Whiteboard Diagram directly to Document Vault"
        >
          <FolderOpen size={13} className="text-amber-400" />
          <span>Save to Vault</span>
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800' : 'bg-[#2a2a36] hover:bg-[#343444] border-white/10 text-white'
            }`}
            title="Export whiteboard as image or vector"
          >
            <Download size={13} />
            <span>Export</span>
            <ChevronDown size={11} />
          </button>

          {showExportMenu && (
            <div className={`absolute bottom-full mb-2 right-0 w-48 p-1 rounded-xl shadow-2xl border text-xs font-medium z-[250] ${
              isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#181822] border-white/10 text-slate-200'
            }`}>
              <button
                onClick={handleExportPNG}
                className="w-full px-3 py-2 text-left rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
              >
                <Image size={13} className="text-amber-400" />
                <span>Export as PNG Image</span>
              </button>
              <button
                onClick={handleExportSVG}
                className="w-full px-3 py-2 text-left rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
              >
                <FileCode size={13} className="text-sky-400" />
                <span>Export as SVG Vector</span>
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full px-3 py-2 text-left rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
              >
                <Download size={13} className="text-emerald-400" />
                <span>Export Scene (.excalidraw)</span>
              </button>
            </div>
          )}
        </div>
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
