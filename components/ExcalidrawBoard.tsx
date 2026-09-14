import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Excalidraw, exportToBlob, exportToSvg, serializeAsJSON } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useProject } from '../context/ProjectContext';
import { addProductionDocument } from '../services/documentsStorage';
import confetti from 'canvas-confetti';
import { 
  FolderOpen, Download, ChevronDown, Image, FileCode, CheckCircle2, Upload
} from 'lucide-react';

interface ExcalidrawBoardProps {
  isLight?: boolean;
}

// Prevent Excalidraw from turning bitmap images into photo-negatives in dark mode
if (typeof window !== 'undefined') {
  const patchProto = (proto: any) => {
    if (!proto) return;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'filter');
      if (descriptor && descriptor.set) {
        const originalSet = descriptor.set;
        Object.defineProperty(proto, 'filter', {
          ...descriptor,
          set(value: string) {
            if (typeof value === 'string' && value.includes('invert(')) {
              return originalSet.call(this, 'none');
            }
            return originalSet.call(this, value);
          }
        });
      }
    } catch (e) {}
  };
  if ('CanvasRenderingContext2D' in window) {
    patchProto(CanvasRenderingContext2D.prototype);
  }
  if ('OffscreenCanvasRenderingContext2D' in window) {
    patchProto((window as any).OffscreenCanvasRenderingContext2D.prototype);
  }
}

// Helper to normalize all image files so Excalidraw's shouldResetImageFilter never treats them as invertible
const normalizeFilesForExcalidraw = (filesObj: Record<string, any> | any[]): any[] => {
  if (!filesObj) return [];
  const list = Array.isArray(filesObj) ? filesObj : Object.values(filesObj);
  return list.map(f => {
    if (!f) return f;
    return {
      ...f,
      mimeType: 'image/svg+xml',
    };
  });
};

// IndexedDB persistence helper for heavy whiteboard images
const DB_NAME = 'backstage_whiteboard_db';
const STORE_NAME = 'scenes';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveSceneData = async (key: string, data: any) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(data, key);
  } catch (e) {
    console.warn('IndexedDB save failed, falling back to localStorage:', e);
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (lsErr) {}
  }
};

const loadSceneData = async (key: string, legacyKey?: string): Promise<any> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else if (legacyKey) {
          const legReq = store.get(legacyKey);
          legReq.onsuccess = () => resolve(legReq.result || null);
          legReq.onerror = () => resolve(null);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
};

export const ExcalidrawBoard: React.FC<ExcalidrawBoardProps> = ({ isLight = false }) => {
  const { currentProjectId } = useProject();
  
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Storage key per project
  const storageKey = `backstage_excalidraw_${currentProjectId || 'default'}`;
  const legacyStorageKey = `backstage_excalidraw_board4_${currentProjectId || 'default'}`;

  // Initial scene load from fast sync localStorage
  const [initialData] = useState<any>(() => {
    try {
      const saved = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.files) {
          Object.values(parsed.files).forEach((f: any) => {
            if (f) f.mimeType = 'image/svg+xml';
          });
        }
        return parsed;
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
          excalidrawAPI.addFiles(normalizeFilesForExcalidraw(saved.files));
        }
        const refreshedElements = saved.elements.map((el: any) => 
          el.type === 'image' ? { ...el, versionNonce: Math.floor(Math.random() * 100000) } : el
        );
        excalidrawAPI.updateScene({
          elements: refreshedElements,
          appState: saved.appState,
        });
      }
    });
  }, [excalidrawAPI, storageKey, legacyStorageKey]);

  // Normalize runtime files and refresh image elements when excalidrawAPI mounts
  useEffect(() => {
    if (!excalidrawAPI) return;
    try {
      const currentFiles = excalidrawAPI.getFiles();
      if (currentFiles && Object.keys(currentFiles).length > 0) {
        const needsFix = Object.values(currentFiles).some((f: any) => f && f.mimeType !== 'image/svg+xml');
        if (needsFix) {
          excalidrawAPI.addFiles(normalizeFilesForExcalidraw(currentFiles));
        }
      }
      const elements = excalidrawAPI.getSceneElements();
      const hasImages = elements.some((el: any) => el.type === 'image');
      if (hasImages) {
        const updated = elements.map((el: any) =>
          el.type === 'image' ? { ...el, versionNonce: Math.floor(Math.random() * 100000) } : el
        );
        excalidrawAPI.updateScene({ elements: updated });
      }
    } catch (e) {}
  }, [excalidrawAPI]);

  const saveTimeoutRef = useRef<any>(null);

  // Handle Excalidraw changes (auto-saves drawings)
  const handleChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    if (files && excalidrawAPI) {
      const nonSvgFiles = Object.values(files).filter((f: any) => f && f.mimeType && f.mimeType !== 'image/svg+xml');
      if (nonSvgFiles.length > 0) {
        excalidrawAPI.addFiles(normalizeFilesForExcalidraw(nonSvgFiles));
      }
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
  }, [storageKey, excalidrawAPI]);

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
          exportWithDarkMode: false,
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
          exportWithDarkMode: false,
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
          exportWithDarkMode: false,
          exportBackground: true,
        },
        files,
        mimeType: 'image/png',
      });

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        addProductionDocument({
          title: `Whiteboard Visual Blocking & Diagram (${new Date().toLocaleDateString()})`,
          titleTa: 'வெண்பலகை வரைபடம் (Excalidraw)',
          category: 'LOOKBOOK',
          fileName: `Whiteboard_Canvas_${Date.now()}.png`,
          fileSize: `${(blob.size / 1024).toFixed(0)} KB`,
          pageCount: 1,
          imageDataUrl: dataUrl,
          builtInType: 'excalidraw',
          author: 'Writer / Director',
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

  const isImportingRef = useRef<boolean>(false);

  // Insert one or more image files directly into the Excalidraw scene
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

    const readImage = (file: File): Promise<{ fileId: string; dataURL: string; width: number; height: number } | null> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataURL = reader.result as string;
          const img = new window.Image();
          img.onload = () => {
            const naturalWidth = img.naturalWidth || 400;
            const naturalHeight = img.naturalHeight || 300;
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
      const loadedImages = (await Promise.all(fileArray.map(readImage))).filter(Boolean) as Array<{
        fileId: string;
        dataURL: string;
        width: number;
        height: number;
      }>;

      if (loadedImages.length === 0) {
        showToast('Could not parse selected images.');
        isImportingRef.current = false;
        return;
      }

      const appState = excalidrawAPI.getAppState();
      const currentZoom = appState.zoom?.value || 1;
      const scrollX = appState.scrollX || 0;
      const scrollY = appState.scrollY || 0;

      let startX: number;
      let startY: number;

      if (clientX !== undefined && clientY !== undefined) {
        startX = (clientX / currentZoom) - scrollX;
        startY = (clientY / currentZoom) - scrollY;
      } else {
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;
        startX = (-scrollX) + (viewWidth / (2 * currentZoom)) - 180;
        startY = (-scrollY) + (viewHeight / (2 * currentZoom)) - 150;
      }

      const filesToAdd: any[] = [];
      const newElements: any[] = [];
      const columns = Math.min(3, Math.ceil(Math.sqrt(loadedImages.length)));
      const padding = 24;

      let col = 0;
      let row = 0;
      let rowMaxHeight = 0;
      let currentX = startX;
      let currentY = startY;

      for (let i = 0; i < loadedImages.length; i++) {
        const img = loadedImages[i];
        filesToAdd.push({
          id: img.fileId,
          dataURL: img.dataURL,
          mimeType: 'image/svg+xml',
          created: Date.now(),
        });

        newElements.push({
          type: 'image',
          id: 'img_' + Math.random().toString(36).substring(2, 11),
          fileId: img.fileId,
          status: 'saved',
          x: currentX,
          y: currentY,
          width: img.width,
          height: img.height,
          angle: 0,
          strokeColor: 'transparent',
          backgroundColor: 'transparent',
          fillStyle: 'hachure',
          strokeWidth: 1,
          strokeStyle: 'solid',
          roundness: { type: 3 },
          roughness: 0,
          opacity: 100,
          groupIds: [],
          strokeSharpness: 'round',
          seed: Math.floor(Math.random() * 100000),
          version: 1,
          versionNonce: Math.floor(Math.random() * 100000),
          isDeleted: false,
          boundElements: null,
          updated: Date.now(),
          link: null,
          locked: false,
        });

        rowMaxHeight = Math.max(rowMaxHeight, img.height);
        col++;
        if (col >= columns) {
          col = 0;
          row++;
          currentX = startX;
          currentY += rowMaxHeight + padding;
          rowMaxHeight = 0;
        } else {
          currentX += img.width + padding;
        }
      }

      excalidrawAPI.addFiles(filesToAdd);
      const existingElements = excalidrawAPI.getSceneElements();
      excalidrawAPI.updateScene({
        elements: [...existingElements, ...newElements],
      });

      confetti({ particleCount: 25, spread: 45, origin: { y: 0.6 } });
      showToast(`✓ Inserted ${loadedImages.length} images onto Whiteboard!`);
    } catch (err) {
      console.error(err);
      showToast('Error importing images.');
    } finally {
      isImportingRef.current = false;
    }
  }, [excalidrawAPI]);

  return (
    <div 
      className="w-full h-full relative overflow-hidden select-none"
      onDragOverCapture={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDropCapture={(e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const imageFiles = Array.from(e.dataTransfer.files).filter((f: File) => f.type.startsWith('image/'));
          if (imageFiles.length > 0) {
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

      {/* Pure Excalidraw Infinite Whiteboard Canvas */}
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

      {/* Floating Whiteboard Quick Tools Dock */}
      <div 
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 p-1.5 rounded-xl backdrop-blur-md shadow-2xl border transition-all duration-200"
        style={{
          background: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(20, 20, 28, 0.94)',
          borderColor: isLight ? 'rgba(203, 213, 225, 0.8)' : 'rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* Import Images Action Button */}
        <label 
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800' : 'bg-[#2a2a36] hover:bg-[#343444] border-white/10 text-white'
          }`}
          title="Import image files onto the whiteboard"
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
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
                className="w-full px-3 py-2 text-left rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Image size={13} className="text-amber-400" />
                <span>Export as PNG Image</span>
              </button>
              <button
                onClick={handleExportSVG}
                className="w-full px-3 py-2 text-left rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FileCode size={13} className="text-sky-400" />
                <span>Export as SVG Vector</span>
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full px-3 py-2 text-left rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Download size={13} className="text-emerald-400" />
                <span>Export Scene (.excalidraw)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcalidrawBoard;
