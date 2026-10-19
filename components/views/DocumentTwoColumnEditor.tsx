import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ProductionDocument } from '../../types';
import {
  TamilScreenplayData,
  TamilScriptItem,
  TamilScene,
  parseScreenplayToTamilLeftRight,
  generateTamilLeftRightDocx,
  generateTamilLeftRightHtml,
  downloadBlobAsFile,
  getSceneCharacters,
  getSceneEffects,
} from '../../services/tamilLeftRightEngine';
import { ScriptCharacterInput, SceneCharactersDropdown } from '../ScriptCharacterInput';
import { TwoColumnSceneSidebar } from '../TwoColumnSceneSidebar';
import { TwoColumnFindReplace } from '../TwoColumnFindReplace';
import { TwoColumnExportModal } from '../TwoColumnExportModal';
import { printTwoColumnVector } from '../../services/twoColumnExportEngine';
import { cleanDisplayLocation } from './TwoColumnScriptView';
import { splitActionTextIntoShots, healOrphanedNumeralItems } from '../../services/twoColumnPaginator';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Download,
  FileDown,
  Loader2,
  Save,
  Cloud,
  Plus,
  Trash2,
  Scissors,
  Combine,
  Check,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Columns,
  RotateCcw,
  RotateCw,
  Layers,
  X,
  Edit2,
  FileText,
  Search,
  PanelLeft,
  PanelLeftClose,
  Printer,
  Sliders,
  Type,
  CornerDownLeft,
} from 'lucide-react';

export interface TwoColumnEditorPreferences {
  fontFamily: 'Meera Inimai' | 'Vijaya' | 'Courier Prime' | 'sans';
  characterFontSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  characterColor: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'white';
  characterWeight: 'normal' | 'bold' | 'black';
  characterTransform: 'uppercase' | 'none';
  scriptFontSize: 'sm' | 'base' | 'lg' | 'xl';
  lineSpacing: 'snug' | 'relaxed' | 'loose';
  enterKeyMode: 'newline' | 'split';
  splitActionByComma: boolean;
  splitActionIncludeDot: boolean;
}

export const DEFAULT_PREFS: TwoColumnEditorPreferences = {
  fontFamily: 'Meera Inimai',
  characterFontSize: 'base', // 16px - clearly visible and prominent
  characterColor: 'sky',
  characterWeight: 'bold',
  characterTransform: 'none',
  scriptFontSize: 'sm', // 14px
  lineSpacing: 'relaxed',
  enterKeyMode: 'newline', // Enter inserts new line, Shift+Enter or scissors splits!
  splitActionByComma: false, // Default: OFF (Every comma = end of shot when enabled)
  splitActionIncludeDot: false, // Default: OFF (Optional . dot shot separator)
};

export const getScriptFontFamilyStyle = (font?: TwoColumnEditorPreferences['fontFamily']) => {
  switch (font) {
    case 'Meera Inimai': return { fontFamily: "'Meera Inimai', sans-serif" };
    case 'Vijaya': return { fontFamily: "'Vijaya', 'Meera Inimai', sans-serif" };
    case 'Courier Prime': return { fontFamily: "'Courier Prime', monospace" };
    case 'sans': return { fontFamily: "ui-sans-serif, system-ui, sans-serif" };
    default: return { fontFamily: "'Meera Inimai', sans-serif" };
  }
};

export const getCharFontSizeClass = (size: TwoColumnEditorPreferences['characterFontSize']) => {
  switch (size) {
    case 'xs': return 'text-xs'; // 12px
    case 'sm': return 'text-sm'; // 14px
    case 'base': return 'text-base'; // 16px
    case 'lg': return 'text-lg'; // 18px
    case 'xl': return 'text-xl'; // 20px
    default: return 'text-base';
  }
};

export const getCharColorClass = (color: TwoColumnEditorPreferences['characterColor'], isLight: boolean) => {
  switch (color) {
    case 'sky': return isLight ? 'text-sky-600' : 'text-sky-400';
    case 'emerald': return isLight ? 'text-emerald-600' : 'text-emerald-400';
    case 'amber': return isLight ? 'text-amber-600' : 'text-amber-400';
    case 'rose': return isLight ? 'text-rose-600' : 'text-rose-400';
    case 'violet': return isLight ? 'text-violet-600' : 'text-violet-400';
    case 'white': return isLight ? 'text-zinc-900 font-extrabold' : 'text-zinc-100 font-extrabold';
    default: return isLight ? 'text-sky-600' : 'text-sky-400';
  }
};

export const getCharWeightClass = (weight: TwoColumnEditorPreferences['characterWeight']) => {
  switch (weight) {
    case 'normal': return 'font-medium';
    case 'bold': return 'font-bold';
    case 'black': return 'font-black';
    default: return 'font-bold';
  }
};

export const getScriptFontSizeClass = (size: TwoColumnEditorPreferences['scriptFontSize']) => {
  switch (size) {
    case 'sm': return 'text-sm'; // 14px
    case 'base': return 'text-base'; // 16px
    case 'lg': return 'text-lg'; // 18px
    case 'xl': return 'text-xl'; // 20px
    default: return 'text-sm';
  }
};

export const getLineSpacingClass = (spacing: TwoColumnEditorPreferences['lineSpacing']) => {
  switch (spacing) {
    case 'snug': return 'leading-snug';
    case 'relaxed': return 'leading-relaxed';
    case 'loose': return 'leading-loose';
    default: return 'leading-relaxed';
  }
};

interface ScriptParagraphFieldProps {
  id: string;
  initialText: string;
  placeholder?: string;
  className?: string;
  title?: string;
  enterKeyMode: 'newline' | 'split';
  isActionField?: boolean;
  splitActionByComma?: boolean;
  splitActionIncludeDot?: boolean;
  onSplitByComma?: (itemId: string, text: string) => void;
  onChange: (text: string) => void;
  onSplit: (before: string, after: string) => void;
  onStartEdit?: () => void;
  onSelectBlock?: (e: React.MouseEvent) => void;
  onAddParagraphAbove?: () => void;
  onAddParagraphBelow?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

const ScriptParagraphField: React.FC<ScriptParagraphFieldProps> = ({
  id,
  initialText,
  placeholder,
  className = '',
  title,
  enterKeyMode,
  isActionField = false,
  splitActionByComma = false,
  splitActionIncludeDot = false,
  onSplitByComma,
  onChange,
  onSplit,
  onStartEdit,
  onSelectBlock,
  onAddParagraphAbove,
  onAddParagraphBelow,
  onUndo,
  onRedo,
}) => {
  const elRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const debounceTimerRef = useRef<any>(null);

  // Synchronize DOM text ONLY when the user is NOT actively typing inside it!
  useEffect(() => {
    if (!isFocusedRef.current && elRef.current) {
      if (elRef.current.innerText !== (initialText || '')) {
        elRef.current.innerText = initialText || '';
      }
    }
  }, [initialText]);

  const handleInput = () => {
    if (!elRef.current) return;
    const currentVal = elRef.current.innerText;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onChange(currentVal);
    }, 200);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (elRef.current) {
      const currentVal = elRef.current.innerText;
      // If action comma/dot splitting is enabled and text has commas or dots, auto-split on blur
      const hasComma = currentVal.includes(',') || currentVal.includes('،') || currentVal.includes('，');
      const hasDot = splitActionIncludeDot && currentVal.includes('.');
      if (isActionField && splitActionByComma && (hasComma || hasDot)) {
        onSplitByComma?.(id, currentVal);
        return;
      }
      onChange(currentVal);
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    onStartEdit?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 1. Meta/Ctrl + Enter: insert new paragraph above or below
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onAddParagraphAbove?.();
      } else {
        onAddParagraphBelow?.();
      }
      return;
    }

    // 2. Undo / Redo inside the field
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      onUndo?.();
      return;
    }
    if (
      ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') ||
      ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z')
    ) {
      e.preventDefault();
      onRedo?.();
      return;
    }

    // 3. Comma auto-split when Enter is pressed in action field
    if (e.key === 'Enter' && isActionField && splitActionByComma && elRef.current) {
      const text = elRef.current.innerText;
      if (text.includes(',') || text.includes('،') || text.includes('，')) {
        e.preventDefault();
        onSplitByComma?.(id, text);
        return;
      }
    }

    // 4. Enter key handling according to user preference
    if (e.key === 'Enter') {
      const isSplitAction = enterKeyMode === 'split' ? !e.shiftKey : e.shiftKey;
      if (isSplitAction) {
        e.preventDefault();
        const sel = window.getSelection();
        let beforeText = '';
        let afterText = '';

        if (sel && sel.rangeCount > 0 && elRef.current) {
          const range = sel.getRangeAt(0);
          const preRange = range.cloneRange();
          preRange.selectNodeContents(elRef.current);
          preRange.setEnd(range.startContainer, range.startOffset);
          beforeText = preRange.toString();

          const postRange = range.cloneRange();
          postRange.selectNodeContents(elRef.current);
          postRange.setStart(range.endContainer, range.endOffset);
          afterText = postRange.toString();
        } else {
          beforeText = elRef.current?.innerText || '';
          afterText = '';
        }

        if (elRef.current) {
          elRef.current.innerText = beforeText;
        }
        onSplit(beforeText, afterText);
        return;
      }
      // In 'newline' mode with regular Enter: browser naturally inserts newline cleanly!
    }
  };

  return (
    <div
      ref={elRef}
      data-item-id={id}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        // Cmd / Ctrl + Click: multi-select block
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          onSelectBlock?.(e);
          return;
        }
        // Alt / Option + Click: split at caret
        if (e.altKey && elRef.current) {
          e.preventDefault();
          e.stopPropagation();
          const sel = window.getSelection();
          let beforeText = '';
          let afterText = '';
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const preRange = range.cloneRange();
            preRange.selectNodeContents(elRef.current);
            preRange.setEnd(range.startContainer, range.startOffset);
            beforeText = preRange.toString();

            const postRange = range.cloneRange();
            postRange.selectNodeContents(elRef.current);
            postRange.setStart(range.endContainer, range.endOffset);
            afterText = postRange.toString();
          } else {
            beforeText = elRef.current.innerText;
          }
          elRef.current.innerText = beforeText;
          onSplit(beforeText, afterText);
          return;
        }
        // Normal click: place cursor & prevent toggling card selection
        e.stopPropagation();
      }}
      className={className}
      title={title}
      placeholder={placeholder}
    />
  );
};

export interface DocumentTwoColumnEditorProps {
  document: ProductionDocument;
  onSave?: (updatedDoc: ProductionDocument) => void;
  onClose?: () => void;
  isLight?: boolean;
}

export const DocumentTwoColumnEditor: React.FC<DocumentTwoColumnEditorProps> = ({
  document: doc,
  onSave,
  onClose,
  isLight = false,
}) => {
  const documentId = doc?.id || 'default_doc';

  // Parse document content into Tamil screenplay structure
  const [screenplayData, setScreenplayData] = useState<TamilScreenplayData>(() => {
    const rawText = doc.textContent || (doc.htmlContent ? doc.htmlContent.replace(/<[^>]+>/g, '\n') : '');
    return parseScreenplayToTamilLeftRight(rawText, doc.title);
  });

  // Continuous Dialogue Speaker Identification:
  const continuousSpeakerItemIds = useMemo(() => {
    const ids = new Set<string>();
    if (!screenplayData?.scenes) return ids;

    const normalize = (name?: string) => {
      if (!name) return '';
      let clean = name.trim();
      if (clean.endsWith(':')) clean = clean.slice(0, -1).trim();
      clean = clean.replace(/\s*\([^)]*\)$/, '').trim();
      return clean.toUpperCase();
    };

    screenplayData.scenes.forEach((scene) => {
      let lastSpeaker = '';
      if (Array.isArray(scene.items)) {
        scene.items.forEach((item) => {
          if (item.column === 'right' || item.type === 'dialogue') {
            let char = (item.rightCharacter || '').trim();
            if (!char && item.rawText) {
              const m = item.rawText.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
              if (m) char = m[1].trim();
            }
            const norm = normalize(char);
            if (norm) {
              if (lastSpeaker && lastSpeaker === norm) {
                ids.add(item.id);
              }
              lastSpeaker = norm;
            }
          }
        });
      }
    });

    return ids;
  }, [screenplayData]);

  // Customizable Editor Preferences (persisted in localStorage)
  const [prefs, setPrefs] = useState<TwoColumnEditorPreferences>(() => {
    try {
      const stored = localStorage.getItem('backstage_twocolumn_editor_prefs');
      if (stored) {
        return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
      }
    } catch (e) {
      // fallback to default
    }
    return DEFAULT_PREFS;
  });

  const updatePrefs = (partial: Partial<TwoColumnEditorPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem('backstage_twocolumn_editor_prefs', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close appearance settings popover on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isSettingsOpen]);

  // Comprehensive Undo / Redo History Management
  const [undoStack, setUndoStack] = useState<TamilScreenplayData[]>([]);
  const [redoStack, setRedoStack] = useState<TamilScreenplayData[]>([]);

  // Push snapshot to undo stack
  const recordHistory = useCallback((customState?: TamilScreenplayData) => {
    const snapshot = customState ? JSON.parse(JSON.stringify(customState)) : JSON.parse(JSON.stringify(screenplayData));
    setUndoStack((prev) => [...prev.slice(-40), snapshot]);
    setRedoStack([]);
  }, [screenplayData]);

  // Undo previous action
  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const previous = prevUndo[prevUndo.length - 1];
      const newUndo = prevUndo.slice(0, -1);
      setScreenplayData((current) => {
        setRedoStack((prevRedo) => [...prevRedo, JSON.parse(JSON.stringify(current))]);
        return previous;
      });
      setHasUnsavedChanges(true);
      showToast('↶ Undo');
      return newUndo;
    });
  }, []);

  // Redo undone action
  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const next = prevRedo[prevRedo.length - 1];
      const newRedo = prevRedo.slice(0, -1);
      setScreenplayData((current) => {
        setUndoStack((prevUndo) => [...prevUndo, JSON.parse(JSON.stringify(current))]);
        return next;
      });
      setHasUnsavedChanges(true);
      showToast('↷ Redo');
      return newRedo;
    });
  }, []);

  // Track highlighted/selected paragraph IDs
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const printCanvasRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Active floating dropdown state
  const [activeDropdown, setActiveDropdown] = useState<{
    type: 'time' | 'effect' | 'character';
    id: string;
    sceneId: string;
  } | null>(null);

  // Scene Navigator & Find-Replace State
  const [isSceneSidebarOpen, setIsSceneSidebarOpen] = useState<boolean>(true);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState<boolean>(false);
  const [showReplaceByDefault, setShowReplaceByDefault] = useState<boolean>(false);

  // Restore scroll position & last viewed scene on mount
  useEffect(() => {
    try {
      const savedScene = localStorage.getItem(`backstage_2col_scene_${documentId}`) || localStorage.getItem('backstage_last_2col_active_scene');
      const savedScroll = localStorage.getItem(`backstage_2col_scroll_${documentId}`) || localStorage.getItem('backstage_last_2col_scroll');
      if (savedScene) {
        setActiveSceneId(savedScene);
      }
      if (savedScroll && scrollContainerRef.current) {
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = parseInt(savedScroll, 10);
          }
        }, 120);
      }
    } catch (e) {
      console.warn('Could not restore 2-col position:', e);
    }
  }, [documentId]);

  // Global keyboard shortcuts for Undo, Redo, Find & Replace (Cmd+Z, Cmd+Y, Cmd+F, Cmd+H)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Global Undo: Cmd+Z / Ctrl+Z (without shift)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const target = e.target as HTMLElement;
        const isExternalInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && !target.closest('[data-char-container]');
        if (isExternalInput) return;
        e.preventDefault();
        handleUndo();
        return;
      }

      // 2. Global Redo: Cmd+Y / Ctrl+Y or Cmd+Shift+Z / Ctrl+Shift+Z
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        const target = e.target as HTMLElement;
        const isExternalInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && !target.closest('[data-char-container]');
        if (isExternalInput) return;
        e.preventDefault();
        handleRedo();
        return;
      }

      // 3. Find & Replace Shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFindReplaceOpen(true);
        setShowReplaceByDefault(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsFindReplaceOpen(true);
        setShowReplaceByDefault(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo, handleRedo]);

  // Progressive Scene Mounting for instant split-second launch
  const INITIAL_SCENE_MOUNT_COUNT = 12;
  const [renderedSceneLimit, setRenderedSceneLimit] = useState<number>(INITIAL_SCENE_MOUNT_COUNT);

  useEffect(() => {
    if (renderedSceneLimit >= screenplayData.scenes.length) return;
    const timer = setTimeout(() => {
      setRenderedSceneLimit(screenplayData.scenes.length);
    }, 60);
    return () => clearTimeout(timer);
  }, [renderedSceneLimit, screenplayData.scenes.length]);

  const handleSelectScene = (sceneId: string) => {
    setRenderedSceneLimit(screenplayData.scenes.length);
    setActiveSceneId(sceneId);
    try {
      localStorage.setItem(`backstage_2col_scene_${documentId}`, sceneId);
      localStorage.setItem('backstage_last_2col_active_scene', sceneId);
    } catch {}
    setTimeout(() => {
      const el = document.getElementById(`scene-header-${sceneId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  useEffect(() => {
    const handleClose = () => setActiveDropdown(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const TIME_INT_EXT_PRESETS = [
    'Day / INT',
    'Day / EXT',
    'Night / INT',
    'Night / EXT',
    'Morning / EXT',
    'Morning / INT',
    'Evening / EXT',
    'Evening / INT',
    'Dusk / EXT',
    'Dawn / EXT',
    'Continuous / INT',
    'Continuous / EXT',
  ];

  const EFFECT_PRESETS = [
    'None',
    'Rain / CGI',
    'Rain',
    'CGI',
    'VFX',
    'Fight / Stunt',
    'Rain / Fight',
    'Fire / Blast',
    'Slow Motion',
    'Wire Work',
    'Car Action',
    'Special Effect / SFX',
    'Day for Night',
  ];

  const allKnownCharacters = useMemo(() => {
    const set = new Set<string>();
    screenplayData.scenes.forEach((sc) => {
      (sc.characters || []).forEach((c) => {
        const trimmed = c.trim();
        if (trimmed && trimmed !== 'None' && trimmed !== 'இல்லை') set.add(trimmed);
      });
      sc.items.forEach((it) => {
        let char = (it.rightCharacter || '').trim();
        if (!char && it.column === 'right') {
          const text = (it.rightDialogue || it.rawText || '').trim();
          const m = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
          if (m) char = m[1].trim();
        }
        if (char.endsWith(':')) char = char.slice(0, -1).trim();
        if (char && char !== 'கதாபாத்திரம்') set.add(char);
      });
    });
    return Array.from(set).sort();
  }, [screenplayData]);

  const allKnownTimes = useMemo(() => {
    const set = new Set<string>(TIME_INT_EXT_PRESETS);
    screenplayData.scenes.forEach((sc) => {
      if (sc.timeOfDay && sc.timeOfDay.trim()) set.add(sc.timeOfDay.trim());
    });
    return Array.from(set);
  }, [screenplayData]);

  const allKnownEffects = useMemo(() => {
    const set = new Set<string>(EFFECT_PRESETS);
    screenplayData.scenes.forEach((sc) => {
      if (sc.effects && sc.effects.trim()) set.add(sc.effects.trim());
    });
    return Array.from(set);
  }, [screenplayData]);

  // Show temporary toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Flatten all items across scenes with their scene info for clean linear document rendering
  const flattenedItems = useMemo(() => {
    const list: { sceneId: string; sceneNumber: string; sceneSlugline: string; item: TamilScriptItem }[] = [];
    screenplayData.scenes.forEach((scene) => {
      scene.items.forEach((item) => {
        list.push({
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          sceneSlugline: scene.sluglineText,
          item,
        });
      });
    });
    return list;
  }, [screenplayData]);

  // Handle paragraph selection (supports Cmd+Click multiselect, Shift+Click range, and normal click)
  const handleParagraphClick = (itemId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    // Case 1: Multi-select with Cmd (Mac) or Ctrl (Windows)
    if (e && (e.metaKey || e.ctrlKey)) {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });
      setLastSelectedId(itemId);
      return;
    }

    // Case 2: Range-select with Shift
    if (e && e.shiftKey && lastSelectedId) {
      const allIds = flattenedItems.map((fi) => fi.item.id);
      const idx1 = allIds.indexOf(lastSelectedId);
      const idx2 = allIds.indexOf(itemId);
      if (idx1 !== -1 && idx2 !== -1) {
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        const range = allIds.slice(start, end + 1);
        setSelectedItemIds((prev) => {
          const next = new Set(prev);
          range.forEach((id) => next.add(id));
          return next;
        });
        return;
      }
    }

    // Case 3: Standard single click on card body (select ONLY this block, or toggle off if already single-selected)
    setSelectedItemIds((prev) => {
      if (prev.size === 1 && prev.has(itemId)) {
        return new Set();
      }
      return new Set([itemId]);
    });
    setLastSelectedId(itemId);
  };

  // Select all paragraphs
  const handleSelectAll = () => {
    const allIds = new Set(flattenedItems.map((fi) => fi.item.id));
    setSelectedItemIds(allIds);
    showToast(`Highlighted all ${allIds.size} paragraphs`);
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedItemIds(new Set());
  };

  // Move target items (either given ID or all currently highlighted) to a column
  const moveParagraphsToColumn = (targetColumn: 'left' | 'right' | 'center', specificItemId?: string) => {
    const idsToMove = specificItemId ? new Set([specificItemId]) : selectedItemIds;
    if (idsToMove.size === 0) return;

    recordHistory();
    setScreenplayData((prev) => {
      const nextScenes = prev.scenes.map((scene) => ({
        ...scene,
        items: scene.items.map((item) => {
          if (idsToMove.has(item.id)) {
            // Determine text preservation
            const wasDialogue = item.column === 'right' || item.type === 'dialogue' || !!item.rightDialogue;
            let text = (wasDialogue && item.rightDialogue ? item.rightDialogue : (item.rawText || item.leftAction || item.rightDialogue || '')).trim();
            let char = item.rightCharacter || '';

            // 1. Moving to Right (Dialogue Column)
            if (targetColumn === 'right') {
              if (!char) {
                const colonMatch = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
                if (colonMatch) {
                  char = colonMatch[1].trim();
                  text = colonMatch[2].trim();
                }
              }
              return {
                ...item,
                column: 'right',
                type: 'dialogue',
                leftAction: undefined,
                rightDialogue: text,
                rightCharacter: char,
                rawText: char ? `${char} : ${text}` : text,
              };
            }

            // 2. Moving to Left (Action Column)
            if (targetColumn === 'left') {
              // When dialogue gets changed to action description, the character name/matter disappears
              let actionText = text;
              if (char && char.trim()) {
                const escaped = char.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const knownRegex = new RegExp('^\\s*' + escaped + '\\s*(?:\\([^)]*\\))?\\s*[:\\-–—]?\\s*', 'i');
                actionText = actionText.replace(knownRegex, '').trim();
              }
              const colonMatch = actionText.match(/^\[?([\u0B80-\u0BFFa-zA-Z0-9\s.\-_]+(?:\([^)]*\))?)\]?\s*[:\-–—]\s*(.*)$/);
              if (colonMatch) {
                actionText = colonMatch[2].trim();
              }
              return {
                ...item,
                column: 'left',
                type: 'action',
                leftAction: actionText,
                rightDialogue: undefined,
                rightCharacter: undefined,
                rawText: actionText,
              };
            }

            // 3. Moving to Center (Transition / Title)
            let centerText = text;
            if (char && char.trim()) {
              const escaped = char.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const knownRegex = new RegExp('^\\s*' + escaped + '\\s*(?:\\([^)]*\\))?\\s*[:\\-–—]?\\s*', 'i');
              centerText = centerText.replace(knownRegex, '').trim();
            }
            const colonMatchCenter = centerText.match(/^\[?([\u0B80-\u0BFFa-zA-Z0-9\s.\-_]+(?:\([^)]*\))?)\]?\s*[:\-–—]\s*(.*)$/);
            if (colonMatchCenter) {
              centerText = colonMatchCenter[2].trim();
            }
            return {
              ...item,
              column: 'center',
              type: 'title',
              leftAction: undefined,
              rightDialogue: undefined,
              rightCharacter: undefined,
              rawText: centerText,
            };
          }
          return item;
        }),
      }));

      return {
        ...prev,
        scenes: nextScenes,
      };
    });

    setHasUnsavedChanges(true);
    const colName = targetColumn === 'left' ? 'இடது: காட்சி (Left)' : targetColumn === 'right' ? 'வலது: வசனம் (Right)' : 'மத்திய தலைப்பு (Center)';
    showToast(`✓ Moved ${idsToMove.size} paragraph(s) to ${colName}`);
  };

  // Update text of an item directly
  const handleUpdateItemText = (itemId: string, newText: string) => {
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => ({
        ...scene,
        items: scene.items.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              rawText: newText,
              leftAction: item.column === 'left' ? newText : item.leftAction,
              rightDialogue: item.column === 'right' ? newText : item.rightDialogue,
            };
          }
          return item;
        }),
      })),
    }));
    setHasUnsavedChanges(true);
  };

  // Update character name for dialogue items
  const handleUpdateItemCharacter = (itemId: string, newChar: string) => {
    recordHistory();
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => ({
        ...scene,
        items: scene.items.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              rightCharacter: newChar,
            };
          }
          return item;
        }),
      })),
    }));
    setHasUnsavedChanges(true);
  };

  // Delete an item
  const handleDeleteItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    recordHistory();
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => ({
        ...scene,
        items: scene.items.filter((item) => item.id !== itemId),
      })),
    }));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    setHasUnsavedChanges(true);
    showToast('Paragraph deleted');
  };

  // Calculate character offset from click position
  const getCaretOffsetFromPoint = (e: MouseEvent, container: HTMLElement): number => {
    let range: Range | null = null;
    const doc = document as any;

    if (doc.caretRangeFromPoint) {
      range = doc.caretRangeFromPoint(e.clientX, e.clientY);
    } else if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }

    if (range && container.contains(range.startContainer)) {
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(container);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      return preCaretRange.toString().length;
    }

    return Math.floor((container.innerText || '').length / 2);
  };

  // Split paragraph into separate lines/blocks on Enter or Alt+Click
  const handleSplitParagraph = (
    itemId: string,
    beforeOrOffset?: number | string,
    afterOrFullText?: string
  ) => {
    recordHistory();
    const newItemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    setScreenplayData((prev) => {
      let itemFound = false;

      const nextScenes = prev.scenes.map((scene) => {
        const itemIndex = scene.items.findIndex((it) => it.id === itemId);
        if (itemIndex === -1) return scene;

        itemFound = true;
        const currentItem = scene.items[itemIndex];
        
        let beforeText = '';
        let afterText = '';

        if (typeof beforeOrOffset === 'string') {
          beforeText = beforeOrOffset;
          afterText = typeof afterOrFullText === 'string' ? afterOrFullText : '';
        } else if (typeof beforeOrOffset === 'number') {
          const fullText = afterOrFullText ?? (currentItem.leftAction || currentItem.rawText || currentItem.rightDialogue || '');
          const offset = Math.max(0, Math.min(beforeOrOffset, fullText.length));
          beforeText = fullText.slice(0, offset);
          afterText = fullText.slice(offset);
        } else {
          const fullText = afterOrFullText ?? (currentItem.leftAction || currentItem.rawText || currentItem.rightDialogue || '');
          beforeText = fullText;
          afterText = '';
        }

        const isDialogue = currentItem.column === 'right' || (!currentItem.column && !!currentItem.rightDialogue) || currentItem.type === 'dialogue';
        const isCenter = currentItem.column === 'center' || currentItem.type === 'transition' || currentItem.type === 'title';
        const isLeft = !isDialogue && !isCenter;

        const cleanBefore = beforeText.trimEnd();
        const cleanAfter = afterText.trimStart();

        const updatedCurrentItem: TamilScriptItem = {
          ...currentItem,
          column: isDialogue ? 'right' : isCenter ? 'center' : 'left',
          type: isDialogue ? 'dialogue' : isCenter ? (currentItem.type || 'transition') : 'action',
          leftAction: isLeft ? cleanBefore : undefined,
          rightDialogue: isDialogue ? cleanBefore : undefined,
          rightCharacter: isDialogue ? (currentItem.rightCharacter || '') : undefined,
          rawText: cleanBefore,
        };

        const newItem: TamilScriptItem = {
          id: newItemId,
          type: isDialogue ? 'dialogue' : isCenter ? (currentItem.type || 'transition') : 'action',
          column: isDialogue ? 'right' : isCenter ? 'center' : 'left',
          leftAction: isLeft ? cleanAfter : undefined,
          rightDialogue: isDialogue ? cleanAfter : undefined,
          rightCharacter: isDialogue ? (currentItem.rightCharacter || '') : undefined,
          rawText: cleanAfter,
        };

        const newItems = [...scene.items];
        newItems.splice(itemIndex, 1, updatedCurrentItem, newItem);

        return {
          ...scene,
          items: newItems,
        };
      });

      if (!itemFound) return prev;

      return {
        ...prev,
        scenes: nextScenes,
      };
    });

    setSelectedItemIds(new Set());
    setHasUnsavedChanges(true);

    // Auto focus the new line with retry
    const attemptFocus = (retries = 3) => {
      const nextElem = document.querySelector(`[data-item-id="${newItemId}"]`) as HTMLElement;
      if (nextElem) {
        nextElem.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(nextElem);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } else if (retries > 0) {
        setTimeout(() => attemptFocus(retries - 1), 40);
      }
    };
    setTimeout(() => attemptFocus(), 40);
  };

  // Split a specific action item at commas (and optional dot) into separate single shot paragraphs
  const handleSplitActionItemByComma = (itemId: string, customText?: string) => {
    recordHistory();
    let splitCount = 0;

    setScreenplayData((prev) => {
      let changed = false;
      const nextScenes = prev.scenes.map((scene) => {
        const itemIdx = scene.items.findIndex((it) => it.id === itemId);
        if (itemIdx === -1) return scene;

        const currentItem = scene.items[itemIdx];
        const raw = customText !== undefined ? customText : (currentItem.leftAction || currentItem.rawText || '');
        const segments = splitActionTextIntoShots(raw, {
          includeComma: true,
          includeDot: !!prefs.splitActionIncludeDot,
        });

        if (segments.length <= 1) return scene;

        changed = true;
        splitCount = segments.length;
        const newItems: TamilScriptItem[] = segments.map((seg, idx) => ({
          ...currentItem,
          id: idx === 0 ? currentItem.id : `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          column: 'left',
          type: 'action',
          leftAction: seg,
          rawText: seg,
          rightDialogue: undefined,
          rightCharacter: undefined,
        }));

        const updatedItems = [...scene.items];
        updatedItems.splice(itemIdx, 1, ...newItems);
        const { items: healedItems } = healOrphanedNumeralItems(updatedItems);

        return {
          ...scene,
          items: healedItems,
        };
      });

      if (!changed) return prev;
      return { ...prev, scenes: nextScenes };
    });

    setHasUnsavedChanges(true);
    if (splitCount > 1) {
      showToast(`✓ Split into ${splitCount} single shot paragraphs`);
    }
  };

  // Split all comma/dot separated action blocks across the entire script into distinct shot paragraphs
  const handleSplitAllActionsByComma = () => {
    recordHistory();
    let totalSplits = 0;
    let newShotsCreated = 0;

    setScreenplayData((prev) => {
      const nextScenes = prev.scenes.map((scene) => {
        const newItems: TamilScriptItem[] = [];

        scene.items.forEach((item) => {
          const isAction = item.column === 'left' || item.type === 'action' || (!item.rightDialogue && (item.leftAction || item.rawText));
          const text = (item.leftAction || item.rawText || '').trim();

          const hasComma = text.includes(',') || text.includes('،') || text.includes('，');
          const hasDot = prefs.splitActionIncludeDot && text.includes('.');

          if (isAction && (hasComma || hasDot)) {
            const segments = splitActionTextIntoShots(text, {
              includeComma: true,
              includeDot: !!prefs.splitActionIncludeDot,
            });

            if (segments.length > 1) {
              totalSplits++;
              newShotsCreated += segments.length;
              segments.forEach((seg, idx) => {
                newItems.push({
                  ...item,
                  id: idx === 0 ? item.id : `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
                  column: 'left',
                  type: 'action',
                  leftAction: seg,
                  rawText: seg,
                  rightDialogue: undefined,
                  rightCharacter: undefined,
                });
              });
              return;
            }
          }

          newItems.push(item);
        });

        const { items: healedItems } = healOrphanedNumeralItems(newItems);

        return {
          ...scene,
          items: healedItems,
        };
      });

      return { ...prev, scenes: nextScenes };
    });

    setHasUnsavedChanges(true);
    if (totalSplits > 0) {
      showToast(`✓ Split ${totalSplits} action blocks into ${newShotsCreated} single shot paragraphs!`);
    } else {
      showToast('No comma/dot separated action blocks found to split.');
    }
  };

  // Split only the currently highlighted action paragraphs by comma (and optional dot)
  const handleSplitSelectedActionsByComma = () => {
    if (selectedItemIds.size === 0) return;
    recordHistory();
    let totalSplits = 0;
    let newShotsCreated = 0;

    setScreenplayData((prev) => {
      const nextScenes = prev.scenes.map((scene) => {
        const newItems: TamilScriptItem[] = [];

        scene.items.forEach((item) => {
          const isSelected = selectedItemIds.has(item.id);
          const isAction = item.column === 'left' || item.type === 'action' || (!item.rightDialogue && (item.leftAction || item.rawText));
          const text = (item.leftAction || item.rawText || '').trim();

          const hasComma = text.includes(',') || text.includes('،') || text.includes('，');
          const hasDot = prefs.splitActionIncludeDot && text.includes('.');

          if (isSelected && isAction && (hasComma || hasDot)) {
            const segments = splitActionTextIntoShots(text, {
              includeComma: true,
              includeDot: !!prefs.splitActionIncludeDot,
            });

            if (segments.length > 1) {
              totalSplits++;
              newShotsCreated += segments.length;
              segments.forEach((seg, idx) => {
                newItems.push({
                  ...item,
                  id: idx === 0 ? item.id : `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
                  column: 'left',
                  type: 'action',
                  leftAction: seg,
                  rawText: seg,
                  rightDialogue: undefined,
                  rightCharacter: undefined,
                });
              });
              return;
            }
          }

          newItems.push(item);
        });

        const { items: healedItems } = healOrphanedNumeralItems(newItems);

        return {
          ...scene,
          items: healedItems,
        };
      });

      return { ...prev, scenes: nextScenes };
    });

    setHasUnsavedChanges(true);
    if (totalSplits > 0) {
      showToast(`✓ Split ${totalSplits} highlighted action blocks into ${newShotsCreated} shot paragraphs!`);
    } else {
      showToast('Highlighted action paragraphs do not contain commas or dots.');
    }
  };

  // Re-merge orphaned numeral rows back into their action blocks
  const handleHealNumeralLists = () => {
    recordHistory();
    let totalHealed = 0;

    setScreenplayData((prev) => {
      let changed = false;
      const nextScenes = prev.scenes.map((scene) => {
        const { items: healedItems, healedCount } = healOrphanedNumeralItems(scene.items);
        if (healedCount > 0) {
          changed = true;
          totalHealed += healedCount;
          return {
            ...scene,
            items: healedItems,
          };
        }
        return scene;
      });

      if (!changed) return prev;
      return { ...prev, scenes: nextScenes };
    });

    setHasUnsavedChanges(true);
    if (totalHealed > 0) {
      showToast(`✓ Re-merged ${totalHealed} numeral list items with their action blocks!`);
    } else {
      showToast('No orphaned numeral list items detected.');
    }
  };

  // Merge multiple selected action (or dialogue) blocks into a single unified paragraph
  // (Fixes accidental comma splits or combines multiple shots into one paragraph)
  const handleMergeSelectedActionParagraphs = () => {
    if (selectedItemIds.size <= 1) {
      showToast('Select 2 or more blocks to merge them into one paragraph.');
      return;
    }
    recordHistory();
    let totalMerged = 0;
    let targetItemId: string | null = null;

    setScreenplayData((prev) => {
      let changed = false;

      const nextScenes = prev.scenes.map((scene) => {
        const selectedInScene = scene.items.filter((it) => selectedItemIds.has(it.id));
        if (selectedInScene.length <= 1) return scene;

        changed = true;
        totalMerged += selectedInScene.length;

        const firstItem = selectedInScene[0];
        targetItemId = firstItem.id;
        const absorbedIds = new Set(selectedInScene.slice(1).map((it) => it.id));

        const isAction = selectedInScene.every(
          (it) => it.column === 'left' || it.type === 'action' || (!it.rightDialogue && (it.leftAction || it.rawText))
        );

        let mergedText = '';
        if (isAction) {
          const actionTexts = selectedInScene
            .map((it, idx) => {
              let t = (it.leftAction || it.rawText || '').trim();
              if (idx < selectedInScene.length - 1) {
                t = t.replace(/[,，\u060C]+$/, '').trim();
              }
              return t;
            })
            .filter(Boolean);
          mergedText = actionTexts.join(' ').replace(/\s+/g, ' ').trim();
        } else {
          const texts = selectedInScene
            .map((it, idx) => {
              let t = (it.column === 'right' ? it.rightDialogue : it.leftAction || it.rawText || '').trim();
              if (idx < selectedInScene.length - 1) {
                t = t.replace(/[,，\u060C]+$/, '').trim();
              }
              return t;
            })
            .filter(Boolean);
          mergedText = texts.join(' ').replace(/\s+/g, ' ').trim();
        }

        const updatedFirstItem: TamilScriptItem = {
          ...firstItem,
          leftAction: isAction ? mergedText : (firstItem.column === 'left' ? mergedText : firstItem.leftAction),
          rawText: mergedText,
          rightDialogue: !isAction && firstItem.column === 'right' ? mergedText : firstItem.rightDialogue,
          updatedAt: Date.now(),
        };

        const newItems: TamilScriptItem[] = [];
        scene.items.forEach((it) => {
          if (it.id === firstItem.id) {
            newItems.push(updatedFirstItem);
          } else if (!absorbedIds.has(it.id)) {
            newItems.push(it);
          }
        });

        return {
          ...scene,
          items: newItems,
        };
      });

      if (!changed) return prev;
      return { ...prev, scenes: nextScenes };
    });

    setHasUnsavedChanges(true);

    if (totalMerged > 1) {
      if (targetItemId) {
        setSelectedItemIds(new Set([targetItemId]));
      }
      showToast(`✓ Merged ${totalMerged} blocks into 1 unified paragraph!`);
    } else {
      showToast('Selected blocks must belong to the same scene to merge.');
    }
  };

  // Update scene metadata
  const handleUpdateScene = (sceneId: string, updates: Partial<TamilScene>) => {
    recordHistory();
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...updates } : scene)),
    }));
    setHasUnsavedChanges(true);
  };

  // Add a new paragraph above
  const handleAddParagraphAbove = (beforeItemId: string, column: 'left' | 'right' | 'center' = 'left') => {
    recordHistory();
    const newItem: TamilScriptItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: column === 'center' ? 'title' : column === 'right' ? 'dialogue' : 'action',
      column,
      leftAction: column === 'left' ? '' : undefined,
      rightDialogue: column === 'right' ? '' : undefined,
      rightCharacter: column === 'right' ? '' : undefined,
      rawText: '',
    };

    setSelectedItemIds(new Set());
    setScreenplayData((prev) => {
      let inserted = false;
      const nextScenes = prev.scenes.map((scene) => {
        if (inserted) return scene;
        const idx = scene.items.findIndex((it) => it.id === beforeItemId);
        if (idx !== -1) {
          inserted = true;
          const nextItems = [...scene.items];
          nextItems.splice(idx, 0, newItem);
          return {
            ...scene,
            items: nextItems,
          };
        }
        return scene;
      });

      return {
        ...prev,
        scenes: nextScenes,
      };
    });

    setHasUnsavedChanges(true);
    showToast(column === 'right' ? 'Added Dialogue block' : column === 'center' ? 'Added Title block' : 'Added Action block');

    setTimeout(() => {
      if (column === 'right') {
        const charInput = document.querySelector(`[data-char-container="${newItem.id}"] input`) as HTMLInputElement;
        if (charInput) {
          charInput.focus();
          return;
        }
      }
      const el = document.querySelector(`[data-item-id="${newItem.id}"]`) as HTMLElement;
      if (el) {
        el.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }, 60);
  };

  // Add a new paragraph below
  const handleAddParagraphBelow = (afterItemId?: string, column: 'left' | 'right' | 'center' = 'left') => {
    recordHistory();
    const newItem: TamilScriptItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: column === 'center' ? 'title' : column === 'right' ? 'dialogue' : 'action',
      column,
      leftAction: column === 'left' ? '' : undefined,
      rightDialogue: column === 'right' ? '' : undefined,
      rightCharacter: column === 'right' ? '' : undefined,
      rawText: '',
    };

    setSelectedItemIds(new Set());
    setScreenplayData((prev) => {
      let inserted = false;
      const nextScenes = prev.scenes.map((scene) => {
        if (inserted) return scene;
        if (!afterItemId) {
          return {
            ...scene,
            items: [...scene.items, newItem],
          };
        }
        const idx = scene.items.findIndex((it) => it.id === afterItemId);
        if (idx !== -1) {
          inserted = true;
          const nextItems = [...scene.items];
          nextItems.splice(idx + 1, 0, newItem);
          return {
            ...scene,
            items: nextItems,
          };
        }
        return scene;
      });

      return {
        ...prev,
        scenes: nextScenes,
      };
    });

    setHasUnsavedChanges(true);
    showToast(column === 'right' ? 'Added Dialogue block' : column === 'center' ? 'Added Title block' : 'Added Action block');

    setTimeout(() => {
      if (column === 'right') {
        const charInput = document.querySelector(`[data-char-container="${newItem.id}"] input`) as HTMLInputElement;
        if (charInput) {
          charInput.focus();
          return;
        }
      }
      const el = document.querySelector(`[data-item-id="${newItem.id}"]`) as HTMLElement;
      if (el) {
        el.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }, 60);
  };

  // Keyboard navigation for arrow shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in a contenteditable or input
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (selectedItemIds.size > 0) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          moveParagraphsToColumn('left');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          moveParagraphsToColumn('right');
        } else if (e.key === 'ArrowUp' || e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          moveParagraphsToColumn('center');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleClearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemIds]);

  // Download real 2-column Microsoft Word (.docx) file
  const handleDownloadWordDocx = async () => {
    try {
      setIsGeneratingDocx(true);
      const blob = await generateTamilLeftRightDocx(screenplayData, {
        baseFontFamily: "'Vijaya', 'Latha', 'Mukta Malar', 'Noto Sans Tamil', system-ui, sans-serif",
        baseFontSizePx: 13.5,
        characterColor: '#0284c7',
        columnSplitPercent: 48,
        paperStandard: 'A4',
      });
      const filename = `${(screenplayData.title || doc.title || 'Screenplay').replace(/\s+/g, '_')}_Tamil_Left_Right.docx`;
      downloadBlobAsFile(blob, filename);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
      showToast(`✓ Downloaded "${filename}"!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to generate Word document.');
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  // Export high-resolution, paginated 2-column Kollywood Screenplay PDF
  const handleExportPdf = async () => {
    if (!printCanvasRef.current || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      showToast('Preparing 2-Column PDF export...');

      // Ensure system and custom fonts are completely ready
      if (document.fonts) {
        await document.fonts.ready;
      }

      const elem = printCanvasRef.current;
      const domPageHeight = 1188; // Standard A4 height at 96 DPI (840px * 1.4142)
      const totalHeight = elem.scrollHeight;

      // Calculate clean natural page break positions before scenes and dialogue blocks to prevent slicing text
      const candidates: number[] = [];
      const blockNodes = Array.from(elem.querySelectorAll('[data-scene-id], [data-item-id], .scene-header-box'));
      blockNodes.forEach((node) => {
        const el = node as HTMLElement;
        const top = el.offsetTop;
        if (top > 40 && !candidates.includes(top)) {
          candidates.push(top);
        }
      });
      candidates.sort((a, b) => a - b);

      const cutPoints: number[] = [0];
      let currentY = 0;
      while (currentY + domPageHeight < totalHeight) {
        const targetCut = currentY + domPageHeight - 35; // 35px bottom tolerance cushion
        let chosenCut = -1;
        for (let i = candidates.length - 1; i >= 0; i--) {
          if (candidates[i] <= targetCut && candidates[i] >= currentY + 300) {
            chosenCut = candidates[i];
            break;
          }
        }
        if (chosenCut === -1) {
          chosenCut = targetCut;
        }
        cutPoints.push(chosenCut);
        currentY = chosenCut;
      }
      cutPoints.push(totalHeight);

      // Render high-resolution canvas at 2x scale
      const canvas = await html2canvas(elem, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const clonedCanvas = clonedDoc.getElementById('two-column-print-canvas');
          if (clonedCanvas) {
            clonedCanvas.style.transform = 'none';
            clonedCanvas.style.boxShadow = 'none';
            clonedCanvas.style.border = 'none';
            clonedCanvas.style.backgroundColor = '#ffffff';
            clonedCanvas.style.color = '#111827';
          }
          // Hide interactive controls, hover tools, buttons, checkboxes
          clonedDoc.querySelectorAll('button, .no-print, [title*="Insert"], [title*="Delete"], [title*="Add"], [title*="select paragraph"], [title*="Move to"]').forEach((b) => {
            (b as HTMLElement).style.display = 'none';
          });
          // Render script title input cleanly without editable outlines
          const titleInput = clonedDoc.querySelector('input[type="text"]') as HTMLInputElement;
          if (titleInput) {
            const heading = clonedDoc.createElement('div');
            heading.className = 'text-2xl font-black text-center w-full text-emerald-800 pb-1';
            heading.textContent = titleInput.value || screenplayData.title || doc.title || 'திரைக்கதை (Screenplay)';
            titleInput.parentNode?.replaceChild(heading, titleInput);
          }
          // Ensure scene heading boxes have high-contrast light borders and fill
          clonedDoc.querySelectorAll('[id^="scene-header-"]').forEach((sc) => {
            const scBox = sc.querySelector('.group\\/hdr') as HTMLElement;
            if (scBox) {
              scBox.style.backgroundColor = '#f8fafc';
              scBox.style.color = '#0f172a';
              scBox.style.borderColor = '#94a3b8';
            }
          });
          // Ensure paragraph text has deep black contrast
          clonedDoc.querySelectorAll('[data-item-id]').forEach((row) => {
            (row as HTMLElement).style.color = '#0f172a';
          });
        },
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const totalPages = cutPoints.length - 1;
      const scriptTitle = (screenplayData.title || doc.title || 'Screenplay').trim();

      for (let i = 0; i < totalPages; i++) {
        const startDomY = cutPoints[i];
        const endDomY = cutPoints[i + 1];
        const sliceDomHeight = endDomY - startDomY;

        const sliceCanvasY = Math.round(startDomY * 2);
        const sliceCanvasHeight = Math.round(sliceDomHeight * 2);
        const targetCanvasPageHeight = Math.round(canvas.width * (pageHeightMm / pageWidthMm));

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = targetCanvasPageHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0, sliceCanvasY, canvas.width, sliceCanvasHeight,
            0, 0, canvas.width, sliceCanvasHeight
          );
        }

        if (i > 0) {
          pdf.addPage('a4', 'p');
        }

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');

        // Professional running footer
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(
          `Page ${i + 1} of ${totalPages}   •   ${scriptTitle}   •   Kollywood 2-Column Screenplay`,
          105,
          292,
          { align: 'center' }
        );
      }

      const filename = `${scriptTitle.replace(/\s+/g, '_')}_2Column_Script.pdf`;
      pdf.save(filename);
      confetti({ particleCount: 45, spread: 60, origin: { y: 0.7 } });
      showToast(`✓ Exported "${filename}"!`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      showToast('Failed to export PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Save changes back to document & Cloud
  const handleSaveChanges = useCallback((isAutoSave: boolean = false) => {
    const html = generateTamilLeftRightHtml(screenplayData);
    const updatedDoc: ProductionDocument = {
      ...doc,
      title: screenplayData.title || doc.title,
      htmlContent: html,
      isLeftRightFormat: true,
      hasTwoColumnScript: true,
      twoColumnData: screenplayData,
      lastModified: new Date().toISOString(),
    };

    if (onSave) {
      onSave(updatedDoc);
    }

    try {
      if (doc?.id) {
        localStorage.setItem('active_two_column_doc_id', doc.id);
        localStorage.setItem('backstage_last_vault_doc_id', doc.id);
        localStorage.setItem('backstage_last_vault_mode', 'two-column');
      }
    } catch (e) {}

    setHasUnsavedChanges(false);
    if (!isAutoSave) {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      showToast('✓ Saved 2-Column Screenplay to Vault & Cloud!');
    }
  }, [doc, screenplayData, onSave]);

  // Debounced Auto-Save to Cloud & Vault (1500ms after edits)
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const timer = setTimeout(() => {
      handleSaveChanges(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, handleSaveChanges]);

  // Persist current active two-column document ID on mount
  useEffect(() => {
    if (doc?.id) {
      try {
        localStorage.setItem('active_two_column_doc_id', doc.id);
        localStorage.setItem('backstage_last_vault_doc_id', doc.id);
        localStorage.setItem('backstage_last_vault_mode', 'two-column');
      } catch (e) {}
    }
  }, [doc?.id]);

  const selectedCount = selectedItemIds.size;

  const docScrollTimerRef = useRef<any>(null);
  const handleDocScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (docScrollTimerRef.current) clearTimeout(docScrollTimerRef.current);
    docScrollTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`backstage_2col_scroll_${documentId}`, String(top));
        localStorage.setItem('backstage_last_2col_scroll', String(top));
      } catch {}
    }, 250);
  }, [documentId]);

  return (
    <div className={`relative flex flex-col w-full h-full overflow-hidden ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#0d0d11] text-zinc-100'}`}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-zinc-900/95 text-emerald-400 border border-emerald-500/40 shadow-2xl text-xs font-mono font-bold flex items-center gap-2 animate-bounce">
          <Sparkles size={14} />
          {toastMessage}
        </div>
      )}

      {/* =========================================================================
          TOP COMMAND RIBBON
         ========================================================================= */}
      <header className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm z-30 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#15151a] border-zinc-800'
      }`}>
        {/* Left: Document Info & Close */}
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Return to standard document view"
            >
              <X size={18} />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                2-Column Script
              </span>
              <h2 className="text-sm font-bold truncate max-w-xs sm:max-w-md">
                {screenplayData.title || doc.title}
              </h2>
            </div>
            <p className="text-[11px] text-zinc-400">
              Highlight any paragraph & click arrow to send to <span className="text-emerald-400 font-bold">Left (காட்சி)</span>, <span className="text-cyan-400 font-bold">Right (வசனம்)</span>, or <span className="text-amber-400 font-bold">Center</span>.
            </p>
          </div>
        </div>

        {/* Center: Quick Selection Stats & Help */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={handleSelectAll}
            className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
            title="Highlight all paragraphs"
          >
            Select All
          </button>
          {selectedCount > 0 && (
            <button
              onClick={handleClearSelection}
              className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 transition-colors"
            >
              Deselect ({selectedCount})
            </button>
          )}
        </div>

        {/* Right: Actions (Undo/Redo, Appearance, Scenes, Find, Zoom, Word Download & Save) */}
        <div className="flex items-center gap-2">
          {/* Undo & Redo History Buttons */}
          <div className="flex items-center gap-0.5 bg-zinc-800/80 border border-zinc-700/80 rounded-lg p-0.5 shadow-xs">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-1.5 text-zinc-300 hover:text-white disabled:text-zinc-600 disabled:hover:text-zinc-600 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
              title={undoStack.length > 0 ? `Undo (Ctrl+Z / ⌘Z) [${undoStack.length} actions available]` : "Undo (Ctrl+Z / ⌘Z) - no actions"}
            >
              <RotateCcw size={13} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1.5 text-zinc-300 hover:text-white disabled:text-zinc-600 disabled:hover:text-zinc-600 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
              title={redoStack.length > 0 ? `Redo (Ctrl+Y / ⌘Y) [${redoStack.length} actions available]` : "Redo (Ctrl+Y / ⌘Y) - no actions"}
            >
              <RotateCw size={13} />
            </button>
          </div>

          {/* Appearance & Typography Customization */}
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isSettingsOpen
                  ? 'bg-amber-500 text-black border-amber-400 font-bold'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
              title="Customizable Appearance: Character Font Size, Colors, Body Text Size & Editing Behavior"
            >
              <Sliders size={13} className={isSettingsOpen ? 'text-black' : 'text-amber-400'} />
              <span>Appearance</span>
            </button>

            {/* Appearance Settings Popover */}
            {isSettingsOpen && (
              <div className={`absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                isLight ? 'bg-white border-zinc-300 text-zinc-900 shadow-xl' : 'bg-zinc-900 border-zinc-700/80 text-zinc-100 shadow-2xl'
              }`}>
                <div className="flex items-center justify-between border-b pb-2.5 mb-3 border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Type size={16} className="text-amber-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Typography & Editing Styles</h3>
                  </div>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* 0. Primary Script Font Family (Meera Inimai Recommended) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 font-bold">
                      <span className="text-zinc-400">Primary Script Font:</span>
                      <span className="text-emerald-400 font-mono font-black">{prefs.fontFamily}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 bg-zinc-800/60 p-1.5 rounded-xl border border-zinc-700/60">
                      {[
                        { id: 'Meera Inimai', label: 'Meera Inimai (Tamil)', desc: 'Recommended Unicode' },
                        { id: 'Vijaya', label: 'Vijaya (Tamil)', desc: 'Classic Script' },
                        { id: 'Courier Prime', label: 'Courier Prime', desc: 'Monospace' },
                        { id: 'sans', label: 'System Sans', desc: 'Modern' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updatePrefs({ fontFamily: f.id as any })}
                          className={`p-2 rounded-lg text-left transition-all cursor-pointer border ${
                            prefs.fontFamily === f.id
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-xs'
                              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                          }`}
                        >
                          <div className="text-[11px] font-bold" style={{ fontFamily: f.id === 'Meera Inimai' ? "'Meera Inimai', sans-serif" : undefined }}>
                            {f.label}
                          </div>
                          <div className="text-[9px] text-zinc-400">{f.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 1. Character Name Font Size */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 font-bold">
                      <span className="text-zinc-400">Character Name Font Size:</span>
                      <span className="text-amber-400 font-mono font-black">{prefs.characterFontSize.toUpperCase()}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 bg-zinc-800/60 p-1 rounded-xl border border-zinc-700/60">
                      {(['xs', 'sm', 'base', 'lg', 'xl'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => updatePrefs({ characterFontSize: sz })}
                          className={`py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                            prefs.characterFontSize === sz
                              ? 'bg-amber-500 text-black shadow-xs font-black'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                          }`}
                        >
                          {sz === 'xs' ? '12px' : sz === 'sm' ? '14px' : sz === 'base' ? '16px' : sz === 'lg' ? '18px' : '20px'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Character Weight & Casing */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-zinc-400 font-bold block mb-1">Character Weight:</span>
                      <div className="grid grid-cols-3 gap-1 bg-zinc-800/60 p-1 rounded-xl border border-zinc-700/60">
                        {(['normal', 'bold', 'black'] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => updatePrefs({ characterWeight: w })}
                            className={`py-1 rounded-lg font-bold text-[10px] capitalize transition-all cursor-pointer ${
                              prefs.characterWeight === w
                                ? 'bg-amber-500 text-black shadow-xs font-black'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                            }`}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-zinc-400 font-bold block mb-1">Character Casing:</span>
                      <div className="grid grid-cols-2 gap-1 bg-zinc-800/60 p-1 rounded-xl border border-zinc-700/60">
                        {(['none', 'uppercase'] as const).map((tr) => (
                          <button
                            key={tr}
                            type="button"
                            onClick={() => updatePrefs({ characterTransform: tr })}
                            className={`py-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                              prefs.characterTransform === tr
                                ? 'bg-amber-500 text-black shadow-xs font-black'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                            }`}
                          >
                            {tr === 'none' ? 'Normal' : 'UPPER'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 2. Character Name Color */}
                  <div>
                    <span className="text-zinc-400 font-bold block mb-1.5">Character Name Color:</span>
                    <div className="flex items-center gap-2">
                      {[
                        { id: 'sky', label: 'Sky Blue', color: 'bg-sky-400' },
                        { id: 'emerald', label: 'Emerald', color: 'bg-emerald-400' },
                        { id: 'amber', label: 'Amber', color: 'bg-amber-400' },
                        { id: 'rose', label: 'Rose', color: 'bg-rose-400' },
                        { id: 'violet', label: 'Violet', color: 'bg-violet-400' },
                        { id: 'white', label: 'White', color: 'bg-zinc-200' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => updatePrefs({ characterColor: c.id as any })}
                          className={`w-6 h-6 rounded-full ${c.color} transition-all cursor-pointer flex items-center justify-center ${
                            prefs.characterColor === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110 shadow-sm' : 'opacity-70 hover:opacity-100'
                          }`}
                          title={c.label}
                        >
                          {prefs.characterColor === c.id && <Check size={11} className="text-black stroke-[3]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Script Text Font Size (Action & Dialogue) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 font-bold">
                      <span className="text-zinc-400">Action & Dialogue Font Size:</span>
                      <span className="text-sky-400 font-mono font-black">{prefs.scriptFontSize.toUpperCase()}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 bg-zinc-800/60 p-1 rounded-xl border border-zinc-700/60">
                      {(['sm', 'base', 'lg', 'xl'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => updatePrefs({ scriptFontSize: sz })}
                          className={`py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                            prefs.scriptFontSize === sz
                              ? 'bg-sky-500 text-white shadow-xs font-black'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                          }`}
                        >
                          {sz === 'sm' ? '14px' : sz === 'base' ? '16px' : sz === 'lg' ? '18px' : '20px'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Line Spacing (Leading) */}
                  <div>
                    <span className="text-zinc-400 font-bold block mb-1.5">Line Spacing:</span>
                    <div className="grid grid-cols-3 gap-1 bg-zinc-800/60 p-1 rounded-xl border border-zinc-700/60">
                      {(['snug', 'relaxed', 'loose'] as const).map((sp) => (
                        <button
                          key={sp}
                          type="button"
                          onClick={() => updatePrefs({ lineSpacing: sp })}
                          className={`py-1 rounded-lg font-bold text-[11px] capitalize transition-all cursor-pointer ${
                            prefs.lineSpacing === sp
                              ? 'bg-emerald-500 text-white shadow-xs font-black'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                          }`}
                        >
                          {sp}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. Enter Key Editing Behavior */}
                  <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-400 font-bold block mb-1.5">Enter Key Behavior:</span>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => updatePrefs({ enterKeyMode: 'newline' })}
                        className={`p-2 rounded-xl text-left border flex items-start gap-2 transition-all cursor-pointer ${
                          prefs.enterKeyMode === 'newline'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        <CornerDownLeft size={14} className="shrink-0 mt-0.5 text-emerald-400" />
                        <div>
                          <div className="font-bold text-[11.5px] text-zinc-200">Enter = New Line (Recommended)</div>
                          <div className="text-[10px] text-zinc-400">Pressing Enter adds a line break. Shift+Enter or ✂️ splits into a new block.</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePrefs({ enterKeyMode: 'split' })}
                        className={`p-2 rounded-xl text-left border flex items-start gap-2 transition-all cursor-pointer ${
                          prefs.enterKeyMode === 'split'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        <Scissors size={14} className="shrink-0 mt-0.5 text-amber-400" />
                        <div>
                          <div className="font-bold text-[11.5px] text-zinc-200">Enter = Split Block</div>
                          <div className="text-[10px] text-zinc-400">Pressing Enter splits into two separate cards. Shift+Enter creates a new line.</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* 6. Action / Description Shots: Split by Comma */}
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-zinc-400 font-bold">Action Shots (Split by Comma):</span>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${prefs.splitActionByComma ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}>
                        {prefs.splitActionByComma ? 'ENABLED' : 'OFF (Default)'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mb-2">
                      In the Action column (காட்சி), treat every comma as the end of a single shot and split into individual shot paragraphs.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updatePrefs({ splitActionByComma: !prefs.splitActionByComma })}
                        className={`flex-1 p-2 rounded-xl text-left border flex items-center justify-between transition-all cursor-pointer ${
                          prefs.splitActionByComma
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        <span className="font-bold text-[11px]">
                          {prefs.splitActionByComma ? '✓ Comma Shot Splitting Active' : 'Enable Comma Shot Splitting'}
                        </span>
                        <span className={`w-8 h-4 rounded-full p-0.5 transition-colors ${prefs.splitActionByComma ? 'bg-amber-500' : 'bg-zinc-700'}`}>
                          <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${prefs.splitActionByComma ? 'translate-x-4' : 'translate-x-0'}`} />
                        </span>
                      </button>
                    </div>

                    {/* Optional Dot Split Toggle */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => updatePrefs({ splitActionIncludeDot: !prefs.splitActionIncludeDot })}
                        className={`flex-1 p-2 rounded-xl text-left border flex items-center justify-between transition-all cursor-pointer ${
                          prefs.splitActionIncludeDot
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-[11px] block">
                            {prefs.splitActionIncludeDot ? '✓ Also Split on Period / Dot (.)' : 'Also Split on Period / Dot (.) (Optional)'}
                          </span>
                          <span className="text-[9.5px] opacity-70 block">Optional: Full stops mark the end of shots</span>
                        </div>
                        <span className={`w-8 h-4 rounded-full p-0.5 transition-colors ${prefs.splitActionIncludeDot ? 'bg-amber-500' : 'bg-zinc-700'}`}>
                          <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${prefs.splitActionIncludeDot ? 'translate-x-4' : 'translate-x-0'}`} />
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSplitAllActionsByComma()}
                      className="mt-2 w-full py-1.5 px-2.5 rounded-lg text-[10.5px] font-bold bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      title="Scan all scenes and convert every comma-separated action block into separate single-shot paragraphs"
                    >
                      <Scissors size={12} />
                      <span>Split All Action Blocks Now</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleHealNumeralLists()}
                      className="mt-1.5 w-full py-1.5 px-2.5 rounded-lg text-[10.5px] font-bold bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      title="Recombine standalone numeral blocks (1, 2, 3...) back into their action shot paragraphs"
                    >
                      <Sparkles size={12} className="text-sky-400" />
                      <span>Re-merge / Fix Numeral Lists</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedItemIds.size < 2}
                      onClick={() => handleMergeSelectedActionParagraphs()}
                      className="mt-1.5 w-full py-1.5 px-2.5 rounded-lg text-[10.5px] font-bold bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Merge currently selected blocks into 1 single paragraph [Alt+M] (fixes accidental comma slip)"
                    >
                      <Combine size={12} className="text-emerald-400" />
                      <span>Merge Selected Blocks {selectedItemIds.size > 1 ? `(${selectedItemIds.size})` : ''}</span>
                    </button>
                  </div>

                  {/* Live Preview Box */}
                  <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-700/60" style={getScriptFontFamilyStyle(prefs.fontFamily)}>
                    <div className="text-[10px] text-zinc-400 uppercase font-mono mb-1 font-bold flex items-center justify-between">
                      <span>Live Preview:</span>
                      <span className="text-[9px] text-emerald-400">{prefs.fontFamily}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`${getCharFontSizeClass(prefs.characterFontSize)} ${getCharWeightClass(prefs.characterWeight)} ${getCharColorClass(prefs.characterColor, isLight)} ${prefs.characterTransform === 'uppercase' ? 'uppercase' : ''}`}>
                        ரங்கா :
                      </span>
                      <span className={`${getScriptFontSizeClass(prefs.scriptFontSize)} ${getLineSpacingClass(prefs.lineSpacing)} text-zinc-200`}>
                        இது நம்ம ஊரு கதை தான்...
                      </span>
                    </div>
                  </div>

                  {/* Reset button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => updatePrefs(DEFAULT_PREFS)}
                      className="text-[10.5px] text-zinc-400 hover:text-amber-400 underline cursor-pointer"
                    >
                      Reset to Defaults
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scenes Sidebar Toggle */}
          <button
            onClick={() => setIsSceneSidebarOpen(!isSceneSidebarOpen)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              isSceneSidebarOpen
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/20'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
            }`}
            title="Toggle Scene Cards Navigator (Left side)"
          >
            <PanelLeft size={13} className={isSceneSidebarOpen ? 'text-white' : 'text-emerald-400'} />
            <span>Scenes</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 font-mono font-bold">
              {screenplayData.scenes.length}
            </span>
          </button>

          {/* Find & Replace Trigger */}
          <button
            onClick={() => {
              setIsFindReplaceOpen(true);
              setShowReplaceByDefault(false);
            }}
            className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Advanced Find & Replace in script (Cmd+F / Ctrl+F)"
          >
            <Search size={13} className="text-amber-400" />
            <span>Find</span>
            <span className="hidden xl:inline text-[9.5px] font-mono px-1 py-0.2 rounded bg-black/40 text-zinc-400 border border-zinc-700">⌘F</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-zinc-800/60 border border-zinc-700/60 rounded-lg p-0.5 mr-2">
            <button
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
              className="p-1 text-zinc-400 hover:text-white rounded"
              title="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-zinc-300">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              className="p-1 text-zinc-400 hover:text-white rounded"
              title="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Download Word (.docx) */}
          <button
            onClick={handleDownloadWordDocx}
            disabled={isGeneratingDocx}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="Download formatted 2-column Microsoft Word (.docx) file"
          >
            <Download size={13} />
            <span>{isGeneratingDocx ? 'Generating...' : 'Word (.docx)'}</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            title="Open 2-Column Script PDF Export Studio & Preview"
          >
            <FileDown size={13} />
            <span>Export PDF</span>
          </button>

          {/* Script Printing Engine (Native Browser Vector Print to PDF) */}
          <button
            onClick={() => printTwoColumnVector(screenplayData)}
            className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-zinc-700/60"
            title="Script Printing Engine: 100% Vector Fonts & Native Layout Print to PDF"
          >
            <Printer size={15} />
          </button>

          {/* Realtime Cloud Sync Status Pill */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono select-none transition-all ${
              hasUnsavedChanges
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
            }`}
            title="Auto-Save Active: All edits are synced in real-time to Supabase Cloud, IndexedDB & collaborators"
          >
            {hasUnsavedChanges ? (
              <>
                <Loader2 size={13} className="animate-spin text-amber-400 shrink-0" />
                <span className="text-[11px] font-bold">Auto-saving...</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Cloud size={13} className="text-emerald-400 shrink-0" />
                <span className="text-[11px] font-bold">Cloud Synced</span>
              </>
            )}
          </div>

          {/* Save Changes */}
          <button
            onClick={() => handleSaveChanges(false)}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-[#f5a623] hover:bg-amber-400 text-black animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
            }`}
            title="Force immediate save to Backstage Vault & Cloud"
          >
            <Save size={13} />
            <span>{hasUnsavedChanges ? 'Save Now' : 'Saved in Cloud'}</span>
          </button>
        </div>
      </header>

      {/* =========================================================================
          FLOATING ARROW BAR (Fixed Overlay HUD - Does NOT shift screen position)
         ========================================================================= */}
      {selectedCount > 0 && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-150 drop-shadow-2xl">
          <div
            className={`flex items-center justify-between gap-3 px-4 py-2 rounded-2xl border shadow-2xl backdrop-blur-md transition-all ${
              isLight
                ? 'bg-white/95 border-slate-200/90 text-slate-800 shadow-[0_12px_40px_rgba(0,0,0,0.15)]'
                : 'bg-zinc-900/95 border-zinc-700/80 text-zinc-100 shadow-[0_16px_48px_rgba(0,0,0,0.7)]'
            }`}
          >
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                isLight
                  ? 'bg-amber-500/12 text-amber-700 border border-amber-500/20'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>{selectedCount} Highlighted</span>
            </div>

            {/* Direct Arrow Movement Buttons */}
            <div className="flex items-center gap-1.5">
              {/* Left Arrow: காட்சி */}
              <button
                onClick={() => moveParagraphsToColumn('left')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80'
                    : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                }`}
                title="Send highlighted paragraphs to Left: காட்சி (Action/Visuals) [ArrowLeft]"
              >
                <ArrowLeft size={13} className="stroke-[2.5]" />
                <span>Left: காட்சி</span>
              </button>

              {/* Center Dot: தலைப்பு */}
              <button
                onClick={() => moveParagraphsToColumn('center')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700'
                }`}
                title="Send highlighted paragraphs to Center: தலைப்பு (Heading) [ArrowUp / C]"
              >
                <Minus size={13} className="stroke-[2.5]" />
                <span>Center</span>
              </button>

              {/* Right Arrow: வசனம் */}
              <button
                onClick={() => moveParagraphsToColumn('right')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  isLight
                    ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/80'
                    : 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 border border-sky-500/30'
                }`}
                title="Send highlighted paragraphs to Right: வசனம் (Dialogue) [ArrowRight]"
              >
                <span>Right: வசனம்</span>
                <ArrowRight size={13} className="stroke-[2.5]" />
              </button>

              <div className={`w-[1px] h-5 ${isLight ? 'bg-slate-200' : 'bg-zinc-700'}`} />

              {/* Comma Shot Splitter for Highlighted Action Paragraphs */}
              <button
                onClick={handleSplitSelectedActionsByComma}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  isLight
                    ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
                    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                }`}
                title="Split highlighted action blocks at commas into single shot paragraphs"
              >
                <Scissors size={12} className="stroke-[2.5]" />
                <span>Split Shots (Comma)</span>
              </button>

              {/* Merge Selected Blocks Button */}
              {selectedCount > 1 && (
                <button
                  onClick={handleMergeSelectedActionParagraphs}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                    isLight
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
                      : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                  }`}
                  title="Merge selected blocks into 1 single paragraph [Alt+M] (fixes accidental comma slip)"
                >
                  <Combine size={12} className="stroke-[2.5]" />
                  <span>Merge ({selectedCount})</span>
                </button>
              )}
            </div>

            <button
              onClick={handleClearSelection}
              className={`p-1 rounded-lg transition-colors ${
                isLight
                  ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Clear selection"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          THE SCRIPT SHEET (A4 Two-Column Canvas)
         ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* 1. Leftside Scene Cards & Thumbnails Navigator */}
        <TwoColumnSceneSidebar
          screenplayData={screenplayData}
          isLight={isLight}
          isOpen={isSceneSidebarOpen}
          onToggleOpen={() => setIsSceneSidebarOpen(!isSceneSidebarOpen)}
          activeSceneId={activeSceneId}
          onSelectScene={handleSelectScene}
        />

        {/* 2. Floating / Docked Advanced Find & Replace Bar */}
        <TwoColumnFindReplace
          screenplayData={screenplayData}
          onUpdateScreenplay={(updater) => {
            setScreenplayData(updater);
            setHasUnsavedChanges(true);
          }}
          isOpen={isFindReplaceOpen}
          onClose={() => setIsFindReplaceOpen(false)}
          isLight={isLight}
          onToast={showToast}
          initialShowReplace={showReplaceByDefault}
        />

        <div
          ref={scrollContainerRef}
          onScroll={handleDocScroll}
          className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center"
        >
        <div
          ref={printCanvasRef}
          id="two-column-print-canvas"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', ...getScriptFontFamilyStyle(prefs.fontFamily) }}
          className={`w-[840px] min-h-[1188px] p-12 relative shadow-2xl rounded-sm transition-all border ${
            isLight
              ? 'bg-white text-zinc-900 border-slate-300'
              : 'bg-[#18181c] text-zinc-100 border-zinc-800'
          } font-sans`}
        >
          {/* Document Title Header */}
          <div className="text-center pb-6 mb-6 border-b border-zinc-300 dark:border-zinc-800">
            <input
              type="text"
              value={screenplayData.title || ''}
              onChange={(e) => {
                setScreenplayData((prev) => ({ ...prev, title: e.target.value }));
                setHasUnsavedChanges(true);
              }}
              className="text-2xl font-black text-center w-full bg-transparent border-b border-transparent hover:border-zinc-500 focus:border-[#f5a623] outline-none text-emerald-500 transition-colors"
              placeholder="திரைக்கதை தலைப்பு (Script Title)"
            />
            <p className="text-xs text-zinc-400 font-mono mt-1">
              தமிழ் இருபக்க காட்சி-வசனம் வடிவம் &bull; Kollywood 2-Column Format
            </p>
          </div>

          {/* Two-Column Header Banner */}
          <div className="flex items-center justify-between gap-4 pb-2 mb-4 border-b-2 border-emerald-500/40 text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
            <div className="flex items-center gap-2 text-emerald-400 min-w-0">
              <span className="shrink-0 inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="truncate">இடது: காட்சி விவரம் (Visual Action)</span>
            </div>
            <div className="flex items-center justify-end gap-2 text-sky-400 min-w-0">
              <span className="truncate">வலது: வசனம் & ஒலி (Dialogue & Audio)</span>
              <span className="shrink-0 inline-block w-2 h-2 rounded-full bg-sky-400"></span>
            </div>
          </div>

          {/* =====================================================================
              SCENES & PARAGRAPH ROWS
             ===================================================================== */}
          <div className="space-y-6">
            {screenplayData.scenes.map((scene, sceneIndex) => {
              // Progressive windowing: off-screen scenes beyond fast-path render placeholder card
              if (sceneIndex >= renderedSceneLimit && !isGeneratingDocx && !isExportingPdf && !isFindReplaceOpen) {
                return (
                  <div
                    key={scene.id}
                    id={`scene-header-${scene.id}`}
                    data-scene-id={scene.id}
                    className={`p-4 rounded-lg border flex items-center justify-between transition-colors ${
                      isLight ? 'bg-white/70 border-slate-200 text-slate-700' : 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded font-black font-mono text-xs bg-emerald-500/20 text-emerald-400">
                        SC {scene.sceneNumber || sceneIndex + 1}
                      </span>
                      <span className="text-xs font-semibold">{scene.location || 'Location'}</span>
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono">{scene.items?.length || 0} blocks</span>
                  </div>
                );
              }

              const chars = getSceneCharacters(scene);
              const effects = getSceneEffects(scene);
              const displayScriptLoc = cleanDisplayLocation(scene.location) || scene.location || 'Location';
              const displayRealLoc = cleanDisplayLocation(scene.realLocation) || displayScriptLoc || scene.realLocation || 'Real Location';

              return (
                <div
                  key={scene.id}
                  id={`scene-header-${scene.id}`}
                  data-scene-id={scene.id}
                  className="space-y-2"
                >
                  {/* Scene Heading Box (Exact Layout From Diagram) */}
                  <div className={`group/hdr relative p-3 rounded-lg border border-black dark:border-zinc-600 transition-all ${
                    isLight
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'bg-zinc-900/80 text-zinc-100 shadow-xs'
                  }`}>
                    <div className="flex flex-col gap-1.5 text-xs leading-snug">
                      {/* ROW 1: Sc no (Left) | Time (Right) */}
                      <div className="flex items-center justify-between gap-4 font-bold">
                        <div className="flex items-center gap-1.5">
                          <span>Sc no:</span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleUpdateScene(scene.id, { sceneNumber: e.currentTarget.innerText.trim() })}
                            className="outline-none hover:bg-emerald-500/10 px-1 rounded font-black"
                            title="Click to edit scene number"
                          >
                            {scene.sceneNumber}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-right whitespace-nowrap">
                          <span className="font-bold shrink-0">Time:</span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleUpdateScene(scene.id, { timeOfDay: e.currentTarget.innerText.trim() })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                            }}
                            className="outline-none hover:bg-emerald-500/10 focus:bg-emerald-500/15 focus:ring-1 focus:ring-emerald-400 px-1 py-0.5 rounded font-bold text-left inline-block transition-all cursor-text"
                            title="Click to edit Time & INT/EXT (e.g. Day / INT)"
                          >
                            {scene.timeOfDay || 'Day / INT'}
                          </span>
                        </div>
                      </div>

                      {/* ROW 2: Script Location (Left) | [ Pages: 1/1 ] (Center Box) | Real Location (Right) */}
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        {/* Left: Script Location (wraps naturally, no ellipsis cutoff) */}
                        <div className="flex-1 text-left leading-tight min-w-0">
                          <span className="font-bold mr-1.5 inline">Script Location:</span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleUpdateScene(scene.id, { location: e.currentTarget.innerText.trim() })}
                            className="outline-none hover:bg-emerald-500/10 px-0.5 rounded font-medium break-words inline"
                            title="Click to edit script location"
                          >
                            {displayScriptLoc}
                          </span>
                        </div>

                        {/* Center: Box for Scene Pages (Wireframe Boxed Pill) */}
                        <div className="shrink-0 px-3 py-0.5 rounded-lg border border-black dark:border-zinc-300 text-center font-bold text-[11px] tracking-wide shadow-2xs select-none whitespace-nowrap self-center">
                          Pages: 1/1
                        </div>

                        {/* Right: Real Location (wraps naturally, no ellipsis cutoff) */}
                        <div className="flex-1 text-right leading-tight min-w-0">
                          <span className="font-bold mr-1.5 inline">Real Location:</span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleUpdateScene(scene.id, { realLocation: e.currentTarget.innerText.trim() })}
                            className="outline-none hover:bg-emerald-500/10 px-0.5 rounded font-medium break-words inline"
                            title="Click to edit real shooting location"
                          >
                            {displayRealLoc}
                          </span>
                        </div>
                      </div>

                      {/* ROW 3: Characters(n): ... (Left) | Effect (Right) */}
                      <div className="flex items-start justify-between gap-4 font-bold pt-0.5">
                        {/* Left: Characters list with ScriptEditor-style dropdown */}
                        <div className="flex-1 text-left leading-relaxed flex items-baseline flex-wrap">
                          <span className="mr-1 inline">Characters({chars.length}):</span>
                          <SceneCharactersDropdown
                            characters={chars}
                            allKnownCharacters={allKnownCharacters}
                            onChange={(updatedChars) => handleUpdateScene(scene.id, { characters: updatedChars })}
                          />
                        </div>

                        {/* Right: Effect (inline editable, no dropdown, tight spacing, defaults to None) */}
                        <div className="flex items-center justify-end gap-1.5 text-right whitespace-nowrap pt-0.5">
                          <span className="font-bold shrink-0">Effect:</span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleUpdateScene(scene.id, { effects: e.currentTarget.innerText.trim() || 'None' })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                            }}
                            className="outline-none hover:bg-emerald-500/10 focus:bg-emerald-500/15 focus:ring-1 focus:ring-emerald-400 px-1 py-0.5 rounded font-bold text-left inline-block transition-all cursor-text"
                            title="Click to edit Effect (defaults to None)"
                          >
                            {effects || 'None'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1 border-t border-zinc-200 dark:border-zinc-800 mt-2 opacity-0 group-hover/hdr:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          const sceneItemIds = scene.items.map((it) => it.id);
                          setSelectedItemIds(new Set(sceneItemIds));
                          showToast(`Selected all ${sceneItemIds.length} paragraphs in Scene ${scene.sceneNumber}`);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-emerald-400 font-mono underline cursor-pointer"
                      >
                        Select All Paragraphs in Scene {scene.sceneNumber}
                      </button>
                    </div>
                  </div>

                {/* Items in this scene */}
                <div className="space-y-1.5">
                  {scene.items.map((item, itemIdx) => {
                    const isSelected = selectedItemIds.has(item.id);
                    const isLeft = item.column === 'left';
                    const isRight = item.column === 'right';
                    const isCenter = item.column === 'center';

                    return (
                      <div
                        key={item.id}
                        onClick={(e) => handleParagraphClick(item.id, e)}
                        className={`group relative rounded-lg p-2.5 transition-all cursor-pointer border ${
                          isSelected
                            ? isLight
                              ? 'bg-amber-500/[0.06] border-amber-400/50 shadow-xs'
                              : 'bg-amber-500/[0.09] border-amber-500/40 shadow-xs'
                            : isLight
                            ? 'hover:bg-slate-50/70 border-transparent hover:border-slate-200'
                            : 'hover:bg-zinc-800/40 border-transparent hover:border-zinc-800'
                        }`}
                      >
                        {/* Mouse Multi-select Checkbox (Click to toggle selection with mouse!) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItemIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                            setLastSelectedId(item.id);
                          }}
                          className={`absolute -left-2.5 top-3 z-10 w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-black border border-amber-400 shadow-xs opacity-100 scale-105'
                              : 'opacity-0 group-hover:opacity-100 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-400 border border-zinc-600/60'
                          }`}
                          title={isSelected ? "Deselect paragraph" : "Click to select paragraph (Cmd+Click to multi-select)"}
                        >
                          {isSelected ? <Check size={11} className="stroke-[3]" /> : <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />}
                        </button>

                        {/* Hover Quick Arrows Tool (Appears on hover for instant 1-click movement) */}
                        <div className="absolute -top-3.5 right-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-20 hover:!opacity-100 hover:!pointer-events-auto transition-all z-20 flex items-center gap-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-1.5 py-0.5 shadow-lg">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveParagraphsToColumn('left', item.id);
                            }}
                            className={`p-1 rounded text-xs transition-colors ${
                              isLeft ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:text-emerald-400'
                            }`}
                            title="Move to Left: காட்சி"
                          >
                            <ArrowLeft size={11} className="stroke-[3]" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveParagraphsToColumn('center', item.id);
                            }}
                            className={`p-1 rounded text-xs transition-colors ${
                              isCenter ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-amber-400'
                            }`}
                            title="Move to Center: தலைப்பு"
                          >
                            <Minus size={11} className="stroke-[3]" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveParagraphsToColumn('right', item.id);
                            }}
                            className={`p-1 rounded text-xs transition-colors ${
                              isRight ? 'bg-sky-500 text-white' : 'text-zinc-400 hover:text-sky-400'
                            }`}
                            title="Move to Right: வசனம்"
                          >
                            <ArrowRight size={11} className="stroke-[3]" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSplitParagraph(item.id);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-amber-400 transition-colors"
                            title="Split paragraph into two cards (Shift+Enter or Alt+Click)"
                          >
                            <Scissors size={11} />
                          </button>

                          {/* Quick Split by Comma if action item contains commas */}
                          {isLeft && ((item.leftAction || item.rawText || '').includes(',') || (item.leftAction || item.rawText || '').includes('،') || (item.leftAction || item.rawText || '').includes('，')) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSplitActionItemByComma(item.id);
                              }}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-black transition-colors flex items-center gap-1 cursor-pointer"
                              title="Split action at commas into single shot paragraphs (, = end of shot)"
                            >
                              <Scissors size={10} />
                              <span>Split Shots</span>
                            </button>
                          )}

                          <div className="w-[1px] h-3 bg-zinc-700 mx-0.5" />

                          <button
                            onClick={(e) => handleDeleteItem(item.id, e)}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                            title="Delete paragraph"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>

                        {/* CASE A: CENTER ROW (Slugline / Transition / Heading) */}
                        {isCenter && (
                          <div className="w-full text-center py-2 px-4 rounded bg-amber-500/5 text-amber-400 font-bold tracking-wide">
                            <ScriptParagraphField
                              id={item.id}
                              initialText={item.rawText || item.leftAction || item.rightDialogue || ''}
                              placeholder="தலைப்பு / மாற்றம்"
                              enterKeyMode={prefs.enterKeyMode}
                              className={`outline-none ${getScriptFontSizeClass(prefs.scriptFontSize)} font-bold tracking-wide text-center`}
                              onChange={(newText) => handleUpdateItemText(item.id, newText)}
                              onSplit={(beforeText, afterText) => handleSplitParagraph(item.id, beforeText, afterText)}
                              onStartEdit={() => recordHistory()}
                              onUndo={handleUndo}
                              onRedo={handleRedo}
                              onSelectBlock={(e) => handleParagraphClick(item.id, e)}
                              onAddParagraphAbove={() => handleAddParagraphAbove(item.id, 'center')}
                              onAddParagraphBelow={() => handleAddParagraphBelow(item.id, 'center')}
                              title={prefs.enterKeyMode === 'newline' ? "Type to edit. Press Enter for newline, Shift+Enter to split block" : "Type to edit. Press Enter to split block, Shift+Enter for newline"}
                            />
                          </div>
                        )}

                        {/* CASE B & C: TWO-COLUMN ROW (Left Action vs Right Dialogue) */}
                        {!isCenter && (
                          <div className="grid grid-cols-2 gap-6 items-start relative">
                            {/* Subtle center hairline divider */}
                            <div className="absolute inset-y-0 left-1/2 w-[1px] -translate-x-1/2 bg-zinc-300/40 dark:bg-zinc-800/60 pointer-events-none" />

                            {/* Left Column: Visual Action OR Right-Aligned Character Name with ":" */}
                            <div className="min-h-[28px] pr-3 flex flex-col justify-start">
                              {isRight ? (
                                (() => {
                                  let char = (item.rightCharacter || '').trim();
                                  let text = (item.rightDialogue || item.rawText || '').trim();
                                  if (!char && text) {
                                    const m = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
                                    if (m) {
                                      char = m[1].trim();
                                    }
                                  }
                                  if (char.endsWith(':')) char = char.slice(0, -1).trim();

                                  const contdRegex = /\s*\(\s*(?:CONT['’.]?D\.?|CONTINUES|CONTINUED|தொடர்ச்சி|தொடர்கிறது)\s*\)/i;
                                  const charHasContd = contdRegex.test(char);

                                  return (
                                    <div data-char-container={item.id} className="w-full flex items-start justify-end gap-1 pt-0.5 relative z-10">
                                      <div className="flex flex-wrap items-baseline justify-end gap-1 max-w-full">
                                        <ScriptCharacterInput
                                          value={char || ''}
                                          suggestions={allKnownCharacters}
                                          onChange={(val) => handleUpdateItemCharacter(item.id, val)}
                                          placeholder="கதாபாத்திரம்"
                                          className={`${getCharFontSizeClass(prefs.characterFontSize)} ${getCharWeightClass(prefs.characterWeight)} ${prefs.characterTransform === 'uppercase' ? 'uppercase' : ''} text-right ${getCharColorClass(prefs.characterColor, isLight)} bg-transparent border-b border-transparent hover:border-zinc-500 focus:border-sky-400 outline-none w-auto min-w-[70px] max-w-[280px] transition-colors cursor-text`}
                                        />
                                        {continuousSpeakerItemIds.has(item.id) && !charHasContd && (
                                          <span
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateItemCharacter(item.id, `${char} (continues)`);
                                            }}
                                            className={`text-[11px] font-serif italic select-none opacity-85 hover:opacity-100 hover:underline cursor-pointer transition-opacity whitespace-nowrap ${getCharColorClass(prefs.characterColor, isLight)}`}
                                            title="Continuous dialogue: character speaks consecutively. Click to bake (continues) permanently into character name."
                                          >
                                            (continues)
                                          </span>
                                        )}
                                        <span className={`${getCharColorClass(prefs.characterColor, isLight)} font-bold ${getCharFontSizeClass(prefs.characterFontSize)} select-none`}>:</span>
                                      </div>
                                    </div>
                                  );
                                })()
                              ) : isLeft ? (
                                <ScriptParagraphField
                                  id={item.id}
                                  initialText={item.leftAction || item.rawText || ''}
                                  placeholder="காட்சி விவரம் எழுதவும்..."
                                  enterKeyMode={prefs.enterKeyMode}
                                  isActionField={true}
                                  splitActionByComma={prefs.splitActionByComma}
                                  splitActionIncludeDot={prefs.splitActionIncludeDot}
                                  onSplitByComma={(id, text) => handleSplitActionItemByComma(id, text)}
                                  className={`min-h-[28px] ${getScriptFontSizeClass(prefs.scriptFontSize)} ${getLineSpacingClass(prefs.lineSpacing)} text-justify outline-none focus:ring-1 focus:ring-emerald-500/50 rounded p-1 transition-all ${
                                    !item.leftAction && !item.rawText
                                      ? 'border border-dashed border-emerald-500/40 bg-emerald-500/[0.04]'
                                      : ''
                                  }`}
                                  onChange={(newText) => handleUpdateItemText(item.id, newText)}
                                  onSplit={(beforeText, afterText) => handleSplitParagraph(item.id, beforeText, afterText)}
                                  onStartEdit={() => recordHistory()}
                                  onUndo={handleUndo}
                                  onRedo={handleRedo}
                                  onSelectBlock={(e) => handleParagraphClick(item.id, e)}
                                  onAddParagraphAbove={() => handleAddParagraphAbove(item.id, 'left')}
                                  onAddParagraphBelow={() => handleAddParagraphBelow(item.id, 'left')}
                                  title={prefs.enterKeyMode === 'newline' ? "Type to edit action. Press Enter for newline, Shift+Enter to split into separate block" : "Type to edit action. Press Enter to split block, Shift+Enter for newline"}
                                />
                              ) : null}
                            </div>

                            {/* Right Column: Dialogue starts directly next to the character name */}
                            <div className="min-h-[28px] pl-3 flex flex-col justify-start">
                              {isRight ? (
                                (() => {
                                  let char = (item.rightCharacter || '').trim();
                                  let text = (item.rightDialogue || item.rawText || '').trim();
                                  if (!char && text) {
                                    const m = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
                                    if (m) {
                                      char = m[1].trim();
                                    }
                                  }

                                  return (
                                    <ScriptParagraphField
                                      id={item.id}
                                      initialText={text}
                                      placeholder="வசனம் எழுதவும்..."
                                      enterKeyMode={prefs.enterKeyMode}
                                      className={`min-h-[28px] ${getScriptFontSizeClass(prefs.scriptFontSize)} ${getLineSpacingClass(prefs.lineSpacing)} outline-none focus:ring-1 focus:ring-sky-500/50 rounded p-1 text-left transition-all ${
                                        !text
                                          ? 'border border-dashed border-sky-500/40 bg-sky-500/[0.04]'
                                          : ''
                                      }`}
                                      onChange={(newText) => handleUpdateItemText(item.id, newText)}
                                      onSplit={(beforeText, afterText) => handleSplitParagraph(item.id, beforeText, afterText)}
                                      onStartEdit={() => recordHistory()}
                                      onUndo={handleUndo}
                                      onRedo={handleRedo}
                                      onSelectBlock={(e) => handleParagraphClick(item.id, e)}
                                      onAddParagraphAbove={() => handleAddParagraphAbove(item.id, 'right')}
                                      onAddParagraphBelow={() => handleAddParagraphBelow(item.id, 'right')}
                                      title={prefs.enterKeyMode === 'newline' ? "Type to edit dialogue. Press Enter for newline, Shift+Enter to split" : "Type to edit dialogue. Press Enter to split block, Shift+Enter for newline"}
                                    />
                                  );
                                })()
                              ) : null}
                            </div>
                          </div>
                        )}

                        {/* 1. In-Between Above: Subtle Small '+' on Left & Right Paper Edges */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddParagraphAbove(item.id, 'left');
                          }}
                          className="absolute -left-10 top-0 -translate-y-1/2 z-20 w-5 h-5 rounded-full bg-black text-white hover:bg-emerald-500 shadow-md border border-zinc-700/80 hover:border-emerald-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95"
                          title="Insert empty Action block (காட்சி) in-between above"
                        >
                          <Plus size={11} className="stroke-[3]" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddParagraphAbove(item.id, 'right');
                          }}
                          className="absolute -right-10 top-0 -translate-y-1/2 z-20 w-5 h-5 rounded-full bg-black text-white hover:bg-sky-500 shadow-md border border-zinc-700/80 hover:border-sky-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95"
                          title="Insert empty Dialogue block (வசனம்) in-between above"
                        >
                          <Plus size={11} className="stroke-[3]" />
                        </button>

                        {/* 2. In-Between Below: Subtle Small '+' on Left & Right Paper Edges */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddParagraphBelow(item.id, 'left');
                          }}
                          className="absolute -left-10 bottom-0 translate-y-1/2 z-20 w-5 h-5 rounded-full bg-black text-white hover:bg-emerald-500 shadow-md border border-zinc-700/80 hover:border-emerald-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95"
                          title="Insert empty Action block (காட்சி) in-between below"
                        >
                          <Plus size={11} className="stroke-[3]" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddParagraphBelow(item.id, 'right');
                          }}
                          className="absolute -right-10 bottom-0 translate-y-1/2 z-20 w-5 h-5 rounded-full bg-black text-white hover:bg-sky-500 shadow-md border border-zinc-700/80 hover:border-sky-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95"
                          title="Insert empty Dialogue block (வசனம்) in-between below"
                        >
                          <Plus size={11} className="stroke-[3]" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Add paragraph below scene */}
                <div className="pt-1 flex justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleAddParagraphBelow(scene.items[scene.items.length - 1]?.id, 'left')}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 text-[11px] font-mono flex items-center gap-1 transition-all"
                  >
                    <Plus size={11} /> Add Paragraph in Scene {scene.sceneNumber}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

          {/* Bottom Add Paragraph Global */}
          <div className="mt-8 pt-6 border-t border-dashed border-zinc-300 dark:border-zinc-800 flex justify-center gap-3">
            <button
              onClick={() => handleAddParagraphBelow(undefined, 'left')}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={12} /> Add Left (காட்சி)
            </button>
            <button
              onClick={() => handleAddParagraphBelow(undefined, 'right')}
              className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={12} /> Add Right (வசனம்)
            </button>
            <button
              onClick={() => handleAddParagraphBelow(undefined, 'center')}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={12} /> Add Center (தலைப்பு)
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated 2-Column Script PDF Export & Print Studio Modal */}
      <TwoColumnExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        screenplayData={screenplayData}
        isLight={isLight}
      />
    </div>
  </div>
);
};
