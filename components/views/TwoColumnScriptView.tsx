import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { ProductionDocument, ViewMode } from '../../types';
import {
  getProductionDocuments,
  saveProductionDocuments,
} from '../../services/documentsStorage';
import {
  TamilScreenplayData,
  TamilScriptItem,
  TamilScene,
  parseScreenplayToTamilLeftRight,
  generateTamilLeftRightDocx,
  generateTamilLeftRightHtml,
  downloadBlobAsFile,
  hasEndSceneTransition,
} from '../../services/tamilLeftRightEngine';
import {
  TwoColumnPaginationOptions,
  DEFAULT_TWO_COLUMN_PAGINATION_OPTIONS,
  PAPER_DIMENSIONS,
  PaperStandard,
  SceneHeadingStyle,
  TransitionStyle,
  paginateTwoColumnScript,
  TwoColumnPage,
  TwoColumnPageElement,
} from '../../services/twoColumnPaginator';
import { parseUniversalFile } from '../../services/documentParser';
import { ScriptCharacterInput, SceneCharactersDropdown } from '../ScriptCharacterInput';
import { TwoColumnSceneSidebar } from '../TwoColumnSceneSidebar';
import { TwoColumnFindReplace } from '../TwoColumnFindReplace';
import { TwoColumnExportModal } from '../TwoColumnExportModal';
import { CharacterSuggestionManagerModal } from '../CharacterSuggestionManagerModal';
import { TwoColumnItemRow } from '../TwoColumnItemRow';
import { TwoColumnShortcutsModal } from '../TwoColumnShortcutsModal';
import { printTwoColumnVector } from '../../services/twoColumnExportEngine';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Columns,
  ArrowLeft,
  ArrowRight,
  Minus,
  Download,
  FileDown,
  Loader2,
  Save,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Sliders,
  Settings,
  Layers,
  Scissors,
  FileText,
  Printer,
  X,
  Check,
  Layout,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Eye,
  RotateCcw,
  Search,
  PanelLeft,
  Palette,
  Users,
  GripVertical,
  Undo2,
  Redo2,
  Keyboard,
  Edit2,
  Folder,
} from 'lucide-react';

export interface TwoColumnScriptViewProps {
  initialDocumentId?: string;
  onNavigateToView?: (view: ViewMode) => void;
}

export const TwoColumnScriptView: React.FC<TwoColumnScriptViewProps> = ({
  initialDocumentId,
  onNavigateToView,
}) => {
  const projectContext = useProject();
  const { appTheme, appAccentColor = '#f5a623' } = projectContext;
  const isLight =
    appTheme === 'light' ||
    (typeof document !== 'undefined' && document.documentElement.classList.contains('light')) ||
    (appTheme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches);

  // All documents from Vault
  const [documents, setDocuments] = useState<ProductionDocument[]>(() => getProductionDocuments());

  // Active script document
  const [selectedDocId, setSelectedDocId] = useState<string>(() => {
    if (initialDocumentId) return initialDocumentId;
    if (typeof localStorage !== 'undefined') {
      const activeTwoCol = localStorage.getItem('active_two_column_doc_id');
      if (activeTwoCol && documents.some((d) => d.id === activeTwoCol)) {
        return activeTwoCol;
      }
    }
    const scriptDoc = documents.find((d) => d.isLeftRightFormat || d.hasTwoColumnScript || d.category === 'SCRIPT' || d.id === 'doc-ranga-1');
    return scriptDoc?.id || documents[0]?.id || 'doc-ranga-1';
  });

  // Keep selectedDocId synchronized with active_two_column_doc_id or initialDocumentId
  useEffect(() => {
    if (initialDocumentId && initialDocumentId !== selectedDocId) {
      setSelectedDocId(initialDocumentId);
    } else if (typeof localStorage !== 'undefined') {
      const activeTwoCol = localStorage.getItem('active_two_column_doc_id');
      if (activeTwoCol && documents.some((d) => d.id === activeTwoCol) && activeTwoCol !== selectedDocId) {
        setSelectedDocId(activeTwoCol);
      }
    }
  }, [initialDocumentId, documents]);

  const activeDoc = useMemo(() => {
    return documents.find((d) => d.id === selectedDocId) || documents[0];
  }, [documents, selectedDocId]);

  // Screenplay Data
  const [screenplayData, setScreenplayData] = useState<TamilScreenplayData>(() => {
    const raw = activeDoc?.textContent || (activeDoc?.htmlContent ? activeDoc.htmlContent.replace(/<[^>]+>/g, '\n') : '');
    return parseScreenplayToTamilLeftRight(raw, activeDoc?.title || 'பைலட் ரங்கா');
  });

  // Inline Title Rename State
  const [titleInput, setTitleInput] = useState<string>(() => screenplayData.title || activeDoc?.title || 'Untitled Screenplay');

  // Sync title when active document or screenplayData changes
  useEffect(() => {
    setTitleInput(screenplayData.title || activeDoc?.title || 'Untitled Screenplay');
  }, [screenplayData.title, activeDoc?.title]);

  const handleRenameTitle = (newVal: string) => {
    const trimmed = newVal.trim() || 'Untitled Screenplay';
    setTitleInput(trimmed);
    setScreenplayData((prev) => ({ ...prev, title: trimmed }));
    if (activeDoc) {
      const updated: ProductionDocument = {
        ...activeDoc,
        title: trimmed,
        lastModified: new Date().toISOString(),
      };
      const allDocs = getProductionDocuments();
      const nextList = allDocs.map((d) => (d.id === updated.id ? updated : d));
      saveProductionDocuments(nextList);
      setDocuments(nextList);
    }
    setHasUnsavedChanges(true);
    showToast('✓ Document Renamed');
  };

  // Re-parse when switching documents
  useEffect(() => {
    if (activeDoc) {
      const raw = activeDoc.textContent || (activeDoc.htmlContent ? activeDoc.htmlContent.replace(/<[^>]+>/g, '\n') : '');
      setScreenplayData(parseScreenplayToTamilLeftRight(raw, activeDoc.title));
      setSelectedItemIds(new Set());
      setHasUnsavedChanges(false);
    }
  }, [activeDoc?.id]);

  // Pagination & Layout Configuration
  const [layoutOptions, setLayoutOptions] = useState<TwoColumnPaginationOptions>(
    DEFAULT_TWO_COLUMN_PAGINATION_OPTIONS
  );

  // Highlighting & Selection State
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // UI View Modes
  const [pageViewMode, setPageViewMode] = useState<'stacked' | 'single' | 'spread'>('stacked');
  const [currentSinglePage, setCurrentSinglePage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isStyleDrawerOpen, setIsStyleDrawerOpen] = useState<boolean>(false);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(new Date());
  const formattedToday = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }, []);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [colorPickerItemId, setColorPickerItemId] = useState<string | null>(null);
  const [bulkColorPickerOpen, setBulkColorPickerOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag and drop reordering state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ itemId: string; position: 'above' | 'below' } | null>(null);

  // Active floating dropdown state (for Time, Effect, or Characters)
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
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);

  // Undo & Redo History Management (fast & lightweight, capped at 50 states)
  const undoStackRef = useRef<TamilScreenplayData[]>([]);
  const redoStackRef = useRef<TamilScreenplayData[]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Record snapshot into undo history before applying modifications
  const pushToUndoHistory = useCallback((snapshot: TamilScreenplayData) => {
    const stack = undoStackRef.current;
    if (stack.length >= 50) {
      stack.shift();
    }
    stack.push(JSON.parse(JSON.stringify(snapshot)));
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const previous = undoStackRef.current.pop()!;
    redoStackRef.current.push(JSON.parse(JSON.stringify(screenplayData)));
    setScreenplayData(previous);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
    setHasUnsavedChanges(true);
    setToastMessage('↩ Undone last action');
    setTimeout(() => setToastMessage(null), 2500);
  }, [screenplayData]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(JSON.parse(JSON.stringify(screenplayData)));
    setScreenplayData(next);
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
    setHasUnsavedChanges(true);
    setToastMessage('↪ Redone');
    setTimeout(() => setToastMessage(null), 2500);
  }, [screenplayData]);

  useEffect(() => {
    const handleClose = () => setActiveDropdown(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  // Standard Presets for Kollywood Shooting Scripts
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

  // Character Auto-Suggestion Names Management State
  const [isCharacterManagerOpen, setIsCharacterManagerOpen] = useState<boolean>(false);
  const [customApprovedCharacters, setCustomApprovedCharacters] = useState<string[]>([]);
  const [excludedCharacters, setExcludedCharacters] = useState<Set<string>>(new Set());

  // Character occurrence metrics across all dialogue rows
  const characterCounts = useMemo(() => {
    const map = new Map<string, number>();
    screenplayData.scenes.forEach((sc) => {
      sc.items.forEach((it) => {
        let char = (it.rightCharacter || '').trim();
        if (!char && it.column === 'right') {
          const text = (it.rightDialogue || it.rawText || '').trim();
          const m = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
          if (m) char = m[1].trim();
        }
        if (char.endsWith(':')) char = char.slice(0, -1).trim();
        if (char && char !== 'கதாபாத்திரம்') {
          map.set(char, (map.get(char) || 0) + 1);
        }
      });
    });
    return map;
  }, [screenplayData]);

  // All known characters across the screenplay (with custom approved + excluded filter)
  const allKnownCharacters = useMemo(() => {
    const set = new Set<string>();
    customApprovedCharacters.forEach((c) => {
      if (c && !excludedCharacters.has(c)) set.add(c);
    });
    screenplayData.scenes.forEach((sc) => {
      (sc.characters || []).forEach((c) => {
        const trimmed = c.trim();
        if (trimmed && trimmed !== 'None' && trimmed !== 'இல்லை' && !excludedCharacters.has(trimmed)) {
          set.add(trimmed);
        }
      });
      sc.items.forEach((it) => {
        let char = (it.rightCharacter || '').trim();
        if (!char && it.column === 'right') {
          const text = (it.rightDialogue || it.rawText || '').trim();
          const m = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
          if (m) char = m[1].trim();
        }
        if (char.endsWith(':')) char = char.slice(0, -1).trim();
        if (char && char !== 'கதாபாத்திரம்' && !excludedCharacters.has(char)) {
          set.add(char);
        }
      });
    });
    return Array.from(set).sort();
  }, [screenplayData, customApprovedCharacters, excludedCharacters]);

  // All known times across the screenplay + presets
  const allKnownTimes = useMemo(() => {
    const set = new Set<string>(TIME_INT_EXT_PRESETS);
    screenplayData.scenes.forEach((sc) => {
      if (sc.timeOfDay && sc.timeOfDay.trim()) set.add(sc.timeOfDay.trim());
    });
    return Array.from(set);
  }, [screenplayData]);

  // All known effects across the screenplay + presets
  const allKnownEffects = useMemo(() => {
    const set = new Set<string>(EFFECT_PRESETS);
    screenplayData.scenes.forEach((sc) => {
      if (sc.effects && sc.effects.trim()) set.add(sc.effects.trim());
    });
    return Array.from(set);
  }, [screenplayData]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  }, []);

  // Run Dedicated Pagination Engine
  const paginationResult = useMemo(() => {
    return paginateTwoColumnScript(screenplayData, layoutOptions);
  }, [screenplayData, layoutOptions]);

  const { pages, totalPages, totalItems, totalScenes } = paginationResult;

  // Map sceneId -> starting page number for quick thumbnail jumping
  const scenePageMap = useMemo(() => {
    const map: Record<string, number> = {};
    pages.forEach((page) => {
      page.elements.forEach((elem) => {
        if (elem.type === 'scene_header' && elem.sceneId && !map[elem.sceneId]) {
          map[elem.sceneId] = page.pageNumber;
        }
      });
    });
    return map;
  }, [pages]);

  // Handle scene selection from sidebar (smooth scrolls canvas directly to scene)
  const handleSelectScene = (sceneId: string, pageNumber?: number) => {
    setActiveSceneId(sceneId);
    if (pageViewMode === 'single' && pageNumber) {
      setCurrentSinglePage(pageNumber);
    }
    setTimeout(() => {
      const el = document.getElementById(`scene-header-${sceneId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  // Handle jumping to occurrence from Character Auto-Suggestion Manager modal
  const handleJumpToOccurrence = (sceneId: string, itemId?: string) => {
    setIsCharacterManagerOpen(false);

    // Determine target page number if in single-page mode
    let targetPage = scenePageMap[sceneId] || 1;
    if (itemId) {
      for (const p of pages) {
        if (p.elements.some((el) => el.type === 'item' && el.item?.id === itemId)) {
          targetPage = p.pageNumber;
          break;
        }
      }
    }

    if (pageViewMode === 'single') {
      setCurrentSinglePage(targetPage);
    }
    setActiveSceneId(sceneId);

    // Give DOM time to update/render page if switched
    setTimeout(() => {
      const targetEl = itemId
        ? (document.getElementById(`script-row-${itemId}`) || document.querySelector(`[data-item-id="${itemId}"]`))
        : document.getElementById(`scene-header-${sceneId}`);

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash animation to highlight location
        targetEl.classList.add('ring-4', 'ring-amber-500', 'ring-offset-2', 'transition-all', 'duration-300');
        setTimeout(() => {
          targetEl.classList.remove('ring-4', 'ring-amber-500', 'ring-offset-2');
        }, 2500);
      }
    }, 120);

    showToast('📍 Jumped to character occurrence in script');
  };

  // Flatten all items for selection utilities
  const { allItemIds, orderedItemIds } = useMemo(() => {
    const set = new Set<string>();
    const list: string[] = [];
    screenplayData.scenes.forEach((sc) => {
      sc.items.forEach((it) => {
        set.add(it.id);
        list.push(it.id);
      });
    });
    return { allItemIds: set, orderedItemIds: list };
  }, [screenplayData]);

  // Handle paragraph selection (supports Cmd+Click multiselect, Shift+Click range, and normal click)
  const handleParagraphClick = (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

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
      const idx1 = orderedItemIds.indexOf(lastSelectedId);
      const idx2 = orderedItemIds.indexOf(itemId);
      if (idx1 !== -1 && idx2 !== -1) {
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        const range = orderedItemIds.slice(start, end + 1);
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
    setSelectedItemIds(new Set(allItemIds));
    showToast(`Highlighted all ${allItemIds.size} paragraphs`);
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedItemIds(new Set());
  };

  // Move paragraphs to column
  const moveParagraphsToColumn = useCallback((targetColumn: 'left' | 'right' | 'center', specificItemId?: string) => {
    const idsToMove = specificItemId ? new Set([specificItemId]) : selectedItemIds;
    if (idsToMove.size === 0) return;

    pushToUndoHistory(screenplayData);

    setScreenplayData((prev) => {
      const nextScenes = prev.scenes.map((scene) => ({
        ...scene,
        items: scene.items.map((item) => {
          if (idsToMove.has(item.id)) {
            let text = item.rawText || item.leftAction || item.rightDialogue || '';
            let char = item.rightCharacter || '';

            if (targetColumn === 'right' && !char && typeof text === 'string') {
              const colonMatch = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
              if (colonMatch) {
                char = colonMatch[1].trim();
                text = colonMatch[2].trim();
              }
            }

            return {
              ...item,
              column: targetColumn,
              type: targetColumn === 'center' ? 'title' : targetColumn === 'right' ? 'dialogue' : 'action',
              leftAction: targetColumn === 'left' ? text : undefined,
              rightDialogue: targetColumn === 'right' ? text : undefined,
              rightCharacter: targetColumn === 'right' ? char : undefined,
              rawText: text,
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
    const colName =
      targetColumn === 'left'
        ? 'இடது: காட்சி (Left)'
        : targetColumn === 'right'
        ? 'வலது: வசனம் (Right)'
        : 'மத்திய தலைப்பு (Center)';
    showToast(`✓ Moved ${idsToMove.size} paragraph(s) to ${colName}`);
  }, [selectedItemIds, screenplayData, pushToUndoHistory, showToast]);

  // Direct in-place text update
  const handleUpdateItemText = (itemId: string, newText: string) => {
    // Check if text actually changed before pushing undo
    let hasChanged = false;
    for (const sc of screenplayData.scenes) {
      const it = sc.items.find((i) => i.id === itemId);
      if (it) {
        const cur = it.column === 'left' ? it.leftAction : it.column === 'right' ? it.rightDialogue : it.rawText;
        if ((cur || '') !== newText) hasChanged = true;
        break;
      }
    }
    if (hasChanged) {
      pushToUndoHistory(screenplayData);
    }

    if (itemId.startsWith('auto-cut-to-')) {
      const sceneId = itemId.replace('auto-cut-to-', '');
      setScreenplayData((prev) => ({
        ...prev,
        scenes: prev.scenes.map((sc) => {
          if (sc.id === sceneId) {
            return {
              ...sc,
              items: [
                ...sc.items,
                {
                  id: `cut-to-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  type: 'transition',
                  column: 'center',
                  rawText: newText,
                },
              ],
            };
          }
          return sc;
        }),
      }));
      setHasUnsavedChanges(true);
      return;
    }

    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.map((it) => {
          if (it.id === itemId) {
            return {
              ...it,
              rawText: newText,
              leftAction: it.column === 'left' ? newText : it.leftAction,
              rightDialogue: it.column === 'right' ? newText : it.rightDialogue,
            };
          }
          return it;
        }),
      })),
    }));
    setHasUnsavedChanges(true);
  };

  // Direct in-place character update
  const handleUpdateItemCharacter = (itemId: string, newChar: string) => {
    let hasChanged = false;
    for (const sc of screenplayData.scenes) {
      const it = sc.items.find((i) => i.id === itemId);
      if (it && (it.rightCharacter || '') !== newChar) {
        hasChanged = true;
        break;
      }
    }
    if (hasChanged) {
      pushToUndoHistory(screenplayData);
    }

    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.map((it) => (it.id === itemId ? { ...it, rightCharacter: newChar } : it)),
      })),
    }));
    setHasUnsavedChanges(true);
  };

  // Character Auto-Suggestion Names Management Handlers
  const handleBatchRenameCharacter = (oldName: string, newName: string) => {
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return;

    const escapedOld = trimmedOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(`^${escapedOld}\\s*:\\s*`, 'u');

    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => {
        // Update scene characters array
        const updatedChars = Array.from(
          new Set(
            (sc.characters || []).map((c) => (c.trim() === trimmedOld ? trimmedNew : c.trim()))
          )
        );

        // Update items in the scene
        const updatedItems = sc.items.map((it) => {
          let updated = { ...it };
          if (it.rightCharacter && it.rightCharacter.trim() === trimmedOld) {
            updated.rightCharacter = trimmedNew;
          }
          if (it.rightDialogue && prefixRegex.test(it.rightDialogue)) {
            updated.rightDialogue = it.rightDialogue.replace(prefixRegex, `${trimmedNew} : `);
          }
          if (it.rawText && prefixRegex.test(it.rawText)) {
            updated.rawText = it.rawText.replace(prefixRegex, `${trimmedNew} : `);
          }
          return updated;
        });

        return {
          ...sc,
          characters: updatedChars,
          items: updatedItems,
        };
      }),
    }));

    setCustomApprovedCharacters((prev) =>
      Array.from(new Set(prev.map((c) => (c === trimmedOld ? trimmedNew : c))))
    );
    setExcludedCharacters((prev) => {
      const next = new Set(prev);
      next.delete(trimmedNew);
      return next;
    });

    setHasUnsavedChanges(true);
    showToast(`✓ Renamed "${trimmedOld}" to "${trimmedNew}" across screenplay`);
  };

  const handleMergeCharacters = (sourceName: string, targetName: string) => {
    const trimmedSource = sourceName.trim();
    const trimmedTarget = targetName.trim();
    if (!trimmedSource || !trimmedTarget || trimmedSource === trimmedTarget) return;

    const escapedSource = trimmedSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(`^${escapedSource}\\s*:\\s*`, 'u');

    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => {
        // Replace source with target in scene characters
        const updatedChars = Array.from(
          new Set(
            (sc.characters || []).map((c) => (c.trim() === trimmedSource ? trimmedTarget : c.trim()))
          )
        );

        const updatedItems = sc.items.map((it) => {
          let updated = { ...it };
          if (it.rightCharacter && it.rightCharacter.trim() === trimmedSource) {
            updated.rightCharacter = trimmedTarget;
          }
          if (it.rightDialogue && prefixRegex.test(it.rightDialogue)) {
            updated.rightDialogue = it.rightDialogue.replace(prefixRegex, `${trimmedTarget} : `);
          }
          if (it.rawText && prefixRegex.test(it.rawText)) {
            updated.rawText = it.rawText.replace(prefixRegex, `${trimmedTarget} : `);
          }
          return updated;
        });

        return {
          ...sc,
          characters: updatedChars,
          items: updatedItems,
        };
      }),
    }));

    setCustomApprovedCharacters((prev) =>
      Array.from(new Set([...prev.filter((c) => c !== trimmedSource), trimmedTarget]))
    );
    setExcludedCharacters((prev) => {
      const next = new Set(prev);
      next.add(trimmedSource);
      next.delete(trimmedTarget);
      return next;
    });

    setHasUnsavedChanges(true);
    showToast(`✓ Merged "${trimmedSource}" into "${trimmedTarget}"`);
  };

  const handleDeleteCharacter = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setExcludedCharacters((prev) => {
      const next = new Set(prev);
      next.add(trimmed);
      return next;
    });
    setCustomApprovedCharacters((prev) => prev.filter((c) => c !== trimmed));

    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        characters: (sc.characters || []).filter((c) => c.trim() !== trimmed),
      })),
    }));

    setHasUnsavedChanges(true);
    showToast(`✓ Removed "${trimmed}" from suggestion lists`);
  };

  const handleAddApprovedCharacter = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomApprovedCharacters((prev) => Array.from(new Set([...prev, trimmed])));
    setExcludedCharacters((prev) => {
      const next = new Set(prev);
      next.delete(trimmed);
      return next;
    });
    showToast(`✓ Added "${trimmed}" to character master list`);
  };


  // Direct alignment update for selected paragraphs or default layout
  const handleUpdateItemAlignment = useCallback((align: 'left' | 'center' | 'right' | 'justify') => {
    if (selectedItemIds.size > 0) {
      pushToUndoHistory(screenplayData);
      setScreenplayData((prev) => ({
        ...prev,
        scenes: prev.scenes.map((sc) => ({
          ...sc,
          items: sc.items.map((it) =>
            selectedItemIds.has(it.id) ? { ...it, textAlign: align } : it
          ),
        })),
      }));
      setHasUnsavedChanges(true);
      const alignLabel = align === 'justify' ? 'Justified' : align.charAt(0).toUpperCase() + align.slice(1);
      showToast(`✓ Set ${selectedItemIds.size} paragraph(s) to ${alignLabel} alignment`);
    } else {
      setLayoutOptions((prev) => ({
        ...prev,
        actionTextAlign: align,
        dialogueTextAlign: align,
      }));
      setHasUnsavedChanges(true);
      const alignLabel = align === 'justify' ? 'Justified' : align.charAt(0).toUpperCase() + align.slice(1);
      showToast(`✓ Set default text alignment to ${alignLabel}`);
    }
  }, [selectedItemIds, screenplayData, pushToUndoHistory, showToast]);

  // Set alignment for a single item
  const handleSetSingleItemAlignment = useCallback((
    itemId: string,
    align: 'left' | 'center' | 'right' | 'justify',
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    pushToUndoHistory(screenplayData);
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.map((it) => (it.id === itemId ? { ...it, textAlign: align } : it)),
      })),
    }));
    setHasUnsavedChanges(true);
  }, [screenplayData, pushToUndoHistory]);

  // Direct text color update for single or selected paragraphs
  const handleUpdateItemColor = (itemIds: Set<string> | string, color?: string) => {
    const ids = typeof itemIds === 'string' ? new Set([itemIds]) : itemIds;
    pushToUndoHistory(screenplayData);
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.map((it) => (ids.has(it.id) ? { ...it, textColor: color } : it)),
      })),
    }));
    setHasUnsavedChanges(true);
    showToast(color ? `✓ Applied text color to ${ids.size} paragraph(s)` : `✓ Reset text color to default`);
  };

  // Toggle Bold for single or selected items
  const handleToggleItemBold = (itemId: string) => {
    pushToUndoHistory(screenplayData);
    const ids = selectedItemIds.has(itemId) && selectedItemIds.size > 1 ? selectedItemIds : new Set([itemId]);
    let firstState: boolean | undefined = undefined;
    for (const sc of screenplayData.scenes) {
      for (const it of sc.items) {
        if (ids.has(it.id)) {
          if (firstState === undefined) firstState = !!it.isBold;
        }
      }
    }
    const nextBold = !firstState;
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.map((it) => (ids.has(it.id) ? { ...it, isBold: nextBold } : it)),
      })),
    }));
    setHasUnsavedChanges(true);
    showToast(nextBold ? `✓ Bold applied to ${ids.size} block(s)` : `Bold removed from ${ids.size} block(s)`);
  };

  // Toggle Italic for single or selected items
  const handleToggleItemItalic = (itemId: string) => {
    pushToUndoHistory(screenplayData);
    const ids = selectedItemIds.has(itemId) && selectedItemIds.size > 1 ? selectedItemIds : new Set([itemId]);
    let firstState: boolean | undefined = undefined;
    for (const sc of screenplayData.scenes) {
      for (const it of sc.items) {
        if (ids.has(it.id)) {
          if (firstState === undefined) firstState = !!it.isItalic;
        }
      }
    }
    const nextItalic = !firstState;
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.map((it) => (ids.has(it.id) ? { ...it, isItalic: nextItalic } : it)),
      })),
    }));
    setHasUnsavedChanges(true);
    showToast(nextItalic ? `✓ Italic applied to ${ids.size} block(s)` : `Italic removed from ${ids.size} block(s)`);
  };

  // Convert/set block to Montage
  const handleSetMontage = (itemId: string) => {
    pushToUndoHistory(screenplayData);
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.map((it) =>
          it.id === itemId
            ? {
                ...it,
                type: 'transition',
                column: 'center',
                rawText: it.rawText && (it.rawText.toLowerCase().includes('montage') || it.rawText.includes('மாண்டேஜ்')) ? it.rawText : 'மாண்டேஜ் (MONTAGE)',
              }
            : it
        ),
      })),
    }));
    setHasUnsavedChanges(true);
    showToast('✓ Set to மாண்டேஜ் (MONTAGE)');
  };

  // Smart Scene Number Calculation (Kollywood & Industry Standard)
  const calculateSmartSceneNumber = (
    scenes: TamilScene[],
    targetSceneId?: string,
    position: 'before' | 'after' | 'end' = 'after'
  ): string => {
    if (scenes.length === 0) return '1';
    if (!targetSceneId || position === 'end') {
      let maxNum = 0;
      for (const sc of scenes) {
        const parsed = parseInt(sc.sceneNumber, 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
      return `${(maxNum || scenes.length) + 1}`;
    }

    const targetIdx = scenes.findIndex((sc) => sc.id === targetSceneId);
    if (targetIdx === -1) return `${scenes.length + 1}`;

    if (position === 'before') {
      if (targetIdx === 0) {
        return 'A1';
      }
      const prevScene = scenes[targetIdx - 1];
      const prevNum = (prevScene.sceneNumber || '').trim();
      const letterMatch = prevNum.match(/^(\d+)([A-Za-z]+)?$/);
      if (letterMatch) {
        const base = letterMatch[1];
        const letter = letterMatch[2];
        if (!letter) return `${base}A`;
        const nextChar = String.fromCharCode(letter.toUpperCase().charCodeAt(0) + 1);
        return `${base}${nextChar}`;
      }
      return `${prevNum}A`;
    } else {
      // position === 'after'
      const targetScene = scenes[targetIdx];
      const targetNum = (targetScene.sceneNumber || '').trim();
      const letterMatch = targetNum.match(/^(\d+)([A-Za-z]+)?$/);
      if (letterMatch) {
        const base = letterMatch[1];
        const letter = letterMatch[2];
        if (!letter) {
          const suffixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          for (const s of suffixes) {
            const candidate = `${base}${s}`;
            if (!scenes.some((sc) => sc.sceneNumber.trim().toUpperCase() === candidate.toUpperCase())) {
              return candidate;
            }
          }
          return `${base}A`;
        } else {
          const nextChar = String.fromCharCode(letter.toUpperCase().charCodeAt(0) + 1);
          return `${base}${nextChar}`;
        }
      }
      return `${targetNum}A`;
    }
  };

  // Insert a fresh new scene
  const handleInsertScene = (targetSceneId?: string, position: 'before' | 'after' | 'end' = 'after') => {
    pushToUndoHistory(screenplayData);
    const nextNum = calculateSmartSceneNumber(screenplayData.scenes, targetSceneId, position);
    const newSceneId = `scene-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newScene: TamilScene = {
      id: newSceneId,
      sceneNumber: nextNum,
      location: 'காட்சி இடம் (LOCATION)',
      realLocation: '',
      timeOfDay: 'Day / INT',
      sluglineText: `காட்சி எண்: ${nextNum} - Day / INT`,
      characters: [],
      effects: 'None',
      items: [
        {
          id: `item-${Date.now()}-1`,
          type: 'action',
          column: 'left',
          leftAction: '',
          rawText: '',
        },
      ],
    };

    let nextScenes: TamilScene[] = [];
    if (!targetSceneId || position === 'end') {
      nextScenes = [...screenplayData.scenes, newScene];
    } else {
      const idx = screenplayData.scenes.findIndex((sc) => sc.id === targetSceneId);
      if (idx === -1) {
        nextScenes = [...screenplayData.scenes, newScene];
      } else if (position === 'before') {
        nextScenes = [...screenplayData.scenes.slice(0, idx), newScene, ...screenplayData.scenes.slice(idx)];
      } else {
        nextScenes = [...screenplayData.scenes.slice(0, idx + 1), newScene, ...screenplayData.scenes.slice(idx + 1)];
      }
    }

    setScreenplayData((prev) => ({
      ...prev,
      scenes: nextScenes,
    }));
    setActiveSceneId(newSceneId);
    setHasUnsavedChanges(true);

    setTimeout(() => {
      const el = document.getElementById(`scene-${newSceneId}`) || document.getElementById(`hdr-sc-${newSceneId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);

    showToast(`✓ Added Scene ${nextNum}`);
  };

  // Delete scene
  const handleDeleteScene = (sceneId: string) => {
    const sc = screenplayData.scenes.find((s) => s.id === sceneId);
    if (!sc) return;
    if (screenplayData.scenes.length <= 1) {
      showToast('Cannot delete the only scene in the document');
      return;
    }
    pushToUndoHistory(screenplayData);
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.filter((s) => s.id !== sceneId),
    }));
    setHasUnsavedChanges(true);
    showToast(`✓ Deleted Scene ${sc.sceneNumber}`);
  };

  // Renumber all scenes sequentially (1, 2, 3...)
  const handleRenumberAllScenes = () => {
    pushToUndoHistory(screenplayData);
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc, idx) => ({
        ...sc,
        sceneNumber: `${idx + 1}`,
      })),
    }));
    setHasUnsavedChanges(true);
    showToast(`✓ Renumbered all ${screenplayData.scenes.length} scenes sequentially (1 to ${screenplayData.scenes.length})`);
  };

  // Update scene metadata
  const handleUpdateScene = (sceneId: string, updates: Partial<TamilScene>) => {
    pushToUndoHistory(screenplayData);
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...updates } : sc)),
    }));
    setHasUnsavedChanges(true);
  };

  // Scroll smoothly and center item in viewport
  const scrollToItem = useCallback((itemId: string, behavior: ScrollBehavior = 'smooth') => {
    // If in single page mode, ensure the page holding this item is displayed
    if (pageViewMode === 'single') {
      const pageIdx = pages.findIndex((p) =>
        p.elements.some((el) => el.type === 'item' && el.item.id === itemId)
      );
      if (pageIdx !== -1 && pageIdx + 1 !== currentSinglePage) {
        setCurrentSinglePage(pageIdx + 1);
      }
    }

    const performScroll = () => {
      const el =
        document.getElementById(`script-row-card-${itemId}`) ||
        document.getElementById(`script-row-${itemId}`) ||
        document.querySelector(`[data-item-row-id="${itemId}"]`);
      if (el) {
        el.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
      }
    };

    performScroll();
    requestAnimationFrame(performScroll);
  }, [pageViewMode, pages, currentSinglePage]);

  // Delete item and smoothly advance selection to the adjacent paragraph
  const handleDeleteItem = useCallback((itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (itemId.startsWith('auto-cut-to-')) {
      showToast('Tip: You can turn off "Auto CUT TO at End of Scene" in the Style Drawer.');
      return;
    }

    // Determine the next adjacent item BEFORE deleting
    const curIdx = orderedItemIds.indexOf(itemId);
    let nextCandidateId: string | null = null;
    if (curIdx !== -1) {
      if (curIdx < orderedItemIds.length - 1) {
        nextCandidateId = orderedItemIds[curIdx + 1];
      } else if (curIdx > 0) {
        nextCandidateId = orderedItemIds[curIdx - 1];
      }
    }

    pushToUndoHistory(screenplayData);
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.filter((it) => it.id !== itemId),
      })),
    }));

    if (nextCandidateId) {
      setSelectedItemIds(new Set([nextCandidateId]));
      setLastSelectedId(nextCandidateId);
      setTimeout(() => {
        scrollToItem(nextCandidateId);
        const cardEl = document.getElementById(`script-row-card-${nextCandidateId}`);
        if (cardEl) cardEl.focus({ preventScroll: true });
      }, 25);
    } else {
      setSelectedItemIds(new Set());
      setLastSelectedId(null);
    }

    setHasUnsavedChanges(true);
    showToast('✓ Deleted item');
  }, [orderedItemIds, screenplayData, pushToUndoHistory, scrollToItem]);

  // Delete all selected paragraphs and smoothly maintain cursor at deleted location
  const handleDeleteSelected = useCallback(() => {
    if (selectedItemIds.size === 0) return;
    pushToUndoHistory(screenplayData);
    const idsToDelete = new Set(selectedItemIds);

    const sortedSelectedIndices = Array.from(selectedItemIds)
      .map((id) => orderedItemIds.indexOf(id))
      .filter((idx) => idx !== -1)
      .sort((a, b) => a - b);

    const lastDeletedIdx =
      sortedSelectedIndices.length > 0
        ? sortedSelectedIndices[sortedSelectedIndices.length - 1]
        : -1;
    const firstDeletedIdx =
      sortedSelectedIndices.length > 0
        ? sortedSelectedIndices[0]
        : -1;

    const remaining = orderedItemIds.filter((id) => !idsToDelete.has(id));
    let nextCandidateId: string | null = null;
    if (remaining.length > 0) {
      if (lastDeletedIdx < orderedItemIds.length - 1) {
        nextCandidateId =
          orderedItemIds.slice(lastDeletedIdx + 1).find((id) => !idsToDelete.has(id)) ||
          remaining[remaining.length - 1];
      } else if (firstDeletedIdx > 0) {
        nextCandidateId =
          [...orderedItemIds.slice(0, firstDeletedIdx)].reverse().find((id) => !idsToDelete.has(id)) ||
          remaining[0];
      } else {
        nextCandidateId = remaining[0];
      }
    }

    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.filter((it) => !idsToDelete.has(it.id)),
      })),
    }));

    if (nextCandidateId) {
      setSelectedItemIds(new Set([nextCandidateId]));
      setLastSelectedId(nextCandidateId);
      setTimeout(() => {
        scrollToItem(nextCandidateId);
        const cardEl = document.getElementById(`script-row-card-${nextCandidateId}`);
        if (cardEl) cardEl.focus({ preventScroll: true });
      }, 25);
    } else {
      setSelectedItemIds(new Set());
      setLastSelectedId(null);
    }

    setHasUnsavedChanges(true);
    showToast(`✓ Deleted ${idsToDelete.size} paragraph(s)`);
  }, [selectedItemIds, orderedItemIds, screenplayData, pushToUndoHistory, scrollToItem]);

  // Permanently bake CUT TO transition into all scenes that don't have one
  const handleApplyCutToToAllScenes = () => {
    let addedCount = 0;
    const transitionText = layoutOptions.endSceneCutToText || 'CUT TO:';
    pushToUndoHistory(screenplayData);
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc, idx) => {
        if (!hasEndSceneTransition(sc.items)) {
          addedCount++;
          return {
            ...sc,
            items: [
              ...sc.items,
              {
                id: `cut-to-${Date.now()}-${idx}`,
                type: 'transition',
                column: 'center',
                rawText: transitionText,
              },
            ],
          };
        }
        return sc;
      }),
    }));
    if (addedCount > 0) {
      setHasUnsavedChanges(true);
      showToast(`✓ Added "${transitionText}" to ${addedCount} scene(s)`);
    } else {
      showToast('All scenes already end with a transition!');
    }
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

  // Reliable auto-focus for newly inserted script item
  const focusNewScriptItem = (newItemId: string, column: 'left' | 'right' | 'center', attempt = 0) => {
    if (column === 'right') {
      const charInput = document.querySelector(`[data-char-container="${newItemId}"] input`) as HTMLInputElement;
      if (charInput) {
        charInput.focus();
        return;
      }
    }
    const el = document.querySelector(`[data-item-id="${newItemId}"]`) as HTMLElement;
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
      return;
    }
    if (attempt < 8) {
      setTimeout(() => focusNewScriptItem(newItemId, column, attempt + 1), 40);
    }
  };

  // Add a new paragraph above
  const handleAddParagraphAbove = (beforeItemId: string, column: 'left' | 'right' | 'center' = 'left') => {
    const newItemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: TamilScriptItem = {
      id: newItemId,
      type: column === 'center' ? 'title' : column === 'right' ? 'dialogue' : 'action',
      column,
      leftAction: column === 'left' ? '' : undefined,
      rightDialogue: column === 'right' ? '' : undefined,
      rightCharacter: column === 'right' ? '' : undefined,
      rawText: '',
    };

    pushToUndoHistory(screenplayData);
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
    setTimeout(() => focusNewScriptItem(newItemId, column), 40);
  };

  // Add a new paragraph below
  const handleAddParagraphBelow = (afterItemId?: string, column: 'left' | 'right' | 'center' = 'left') => {
    const newItemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: TamilScriptItem = {
      id: newItemId,
      type: column === 'center' ? 'title' : column === 'right' ? 'dialogue' : 'action',
      column,
      leftAction: column === 'left' ? '' : undefined,
      rightDialogue: column === 'right' ? '' : undefined,
      rightCharacter: column === 'right' ? '' : undefined,
      rawText: '',
    };

    pushToUndoHistory(screenplayData);
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
    setTimeout(() => focusNewScriptItem(newItemId, column), 40);
  };

  // Reorder script items via drag-and-drop
  const handleMoveScriptItem = (sourceId: string, targetId: string, position: 'above' | 'below') => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    pushToUndoHistory(screenplayData);

    setScreenplayData((prev) => {
      let movedItem: TamilScriptItem | null = null;

      // 1. Extract source item from scenes
      const scenesWithoutSource = prev.scenes.map((sc) => {
        const itemIdx = sc.items.findIndex((it) => it.id === sourceId);
        if (itemIdx !== -1) {
          movedItem = sc.items[itemIdx];
          return {
            ...sc,
            items: sc.items.filter((it) => it.id !== sourceId),
          };
        }
        return sc;
      });

      if (!movedItem) return prev;

      // 2. Insert moved item into target scene at target index
      const finalScenes = scenesWithoutSource.map((sc) => {
        const targetIdx = sc.items.findIndex((it) => it.id === targetId);
        if (targetIdx !== -1) {
          const insertIdx = position === 'above' ? targetIdx : targetIdx + 1;
          const nextItems = [...sc.items];
          nextItems.splice(insertIdx, 0, movedItem!);
          return {
            ...sc,
            items: nextItems,
          };
        }
        return sc;
      });

      return {
        ...prev,
        scenes: finalScenes,
      };
    });

    setHasUnsavedChanges(true);
    showToast(`✓ Moved paragraph ${position}`);
  };

  // Split paragraph into separate shots
  const handleSplitParagraph = (
    itemId: string,
    splitOffset?: number,
    customFullText?: string
  ) => {
    const newItemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    pushToUndoHistory(screenplayData);

    setScreenplayData((prev) => {
      let itemFound = false;

      const nextScenes = prev.scenes.map((scene) => {
        const itemIndex = scene.items.findIndex((it) => it.id === itemId);
        if (itemIndex === -1) return scene;

        itemFound = true;
        const currentItem = scene.items[itemIndex];
        const fullText =
          customFullText ??
          (currentItem.leftAction || currentItem.rawText || currentItem.rightDialogue || '');

        let beforeText = fullText;
        let afterText = '';

        if (typeof splitOffset === 'number' && splitOffset >= 0 && splitOffset <= fullText.length) {
          beforeText = fullText.slice(0, splitOffset);
          afterText = fullText.slice(splitOffset);
        } else {
          const mid = Math.floor(fullText.length / 2);
          beforeText = fullText.slice(0, mid);
          afterText = fullText.slice(mid);
        }

        // Action block: last description must end with " -"
        const cleanBefore = beforeText.trimEnd().replace(/\s*-+$/, '');
        const formattedBefore = cleanBefore ? `${cleanBefore} -` : '-';
        const formattedAfter = afterText.trimStart();

        const updatedCurrentItem: TamilScriptItem = {
          ...currentItem,
          leftAction: currentItem.column === 'left' ? formattedBefore : currentItem.leftAction,
          rightDialogue: currentItem.column === 'right' ? formattedBefore : currentItem.rightDialogue,
          rawText: formattedBefore,
        };

        const newItem: TamilScriptItem = {
          id: newItemId,
          type: currentItem.type === 'dialogue' ? 'dialogue' : 'action',
          column: currentItem.column,
          leftAction: currentItem.column === 'left' ? formattedAfter : undefined,
          rightDialogue: currentItem.column === 'right' ? formattedAfter : undefined,
          rightCharacter: currentItem.column === 'right' ? currentItem.rightCharacter : undefined,
          rawText: formattedAfter,
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
    showToast('✂ Paragraph split into separate shots ending with " -"');

    // Auto focus the new line
    setTimeout(() => {
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
      }
    }, 60);
  };

  // Focus item for keyboard editing
  const focusScriptItem = (
    itemId: string,
    targetField: 'auto' | 'action' | 'dialogue' | 'character' = 'auto',
    caretPosition: 'start' | 'end' = 'end'
  ) => {
    scrollToItem(itemId, 'smooth');

    setTimeout(() => {
      let targetEl: HTMLElement | null = null;
      const rowContainer = document.querySelector(`[data-item-row-id="${itemId}"]`);
      if (!rowContainer) return;

      if (targetField === 'character') {
        targetEl = rowContainer.querySelector(`[data-char-container="${itemId}"] input`) as HTMLInputElement | null;
      } else if (targetField === 'dialogue') {
        targetEl = rowContainer.querySelector(`[data-col="right"] [data-item-id="${itemId}"], [data-item-id="${itemId}"]`) as HTMLElement | null;
      } else if (targetField === 'action') {
        targetEl = rowContainer.querySelector(`[data-col="left"] [data-item-id="${itemId}"], [data-item-id="${itemId}"]`) as HTMLElement | null;
      } else {
        // Auto: check if right column with filled character
        const charInput = rowContainer.querySelector(`[data-char-container="${itemId}"] input`) as HTMLInputElement | null;
        const dialogueEl = rowContainer.querySelector(`[data-col="right"] [data-item-id="${itemId}"]`) as HTMLElement | null;
        if (dialogueEl && charInput && charInput.value.trim().length > 0) {
          targetEl = dialogueEl;
        } else if (charInput) {
          targetEl = charInput;
        } else {
          targetEl = rowContainer.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement | null;
        }
      }

      if (targetEl) {
        targetEl.focus();
        if (targetEl instanceof HTMLInputElement) {
          if (caretPosition === 'start') {
            targetEl.setSelectionRange(0, 0);
          } else {
            const len = targetEl.value.length;
            targetEl.setSelectionRange(len, len);
          }
        } else if (targetEl.isContentEditable) {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(targetEl);
            range.collapse(caretPosition === 'start');
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }
    }, 40);
  };

  // Jump focus to next row during keyboard editing
  const handleFocusNextRow = (
    currentItemId: string,
    targetField: 'auto' | 'action' | 'dialogue' | 'character' = 'auto'
  ) => {
    const idx = orderedItemIds.indexOf(currentItemId);
    if (idx !== -1 && idx < orderedItemIds.length - 1) {
      const nextId = orderedItemIds[idx + 1];
      setSelectedItemIds(new Set([nextId]));
      setLastSelectedId(nextId);
      focusScriptItem(nextId, targetField, 'start');
    } else if (idx === orderedItemIds.length - 1) {
      handleAddParagraphBelow(currentItemId, targetField === 'dialogue' ? 'right' : 'left');
    }
  };

  // Jump focus to previous row during keyboard editing
  const handleFocusPrevRow = (
    currentItemId: string,
    targetField: 'auto' | 'action' | 'dialogue' | 'character' = 'auto'
  ) => {
    const idx = orderedItemIds.indexOf(currentItemId);
    if (idx > 0) {
      const prevId = orderedItemIds[idx - 1];
      setSelectedItemIds(new Set([prevId]));
      setLastSelectedId(prevId);
      focusScriptItem(prevId, targetField, 'end');
    }
  };

  // Exit text editing and focus card container for browsing
  const handleEscapeToCard = (itemId: string) => {
    setSelectedItemIds(new Set([itemId]));
    setLastSelectedId(itemId);
    const cardEl = document.getElementById(`script-row-card-${itemId}`);
    if (cardEl) {
      cardEl.focus({ preventScroll: true });
    }
  };

  // Comprehensive Global Keyboard Navigation, Shortcuts, and Undo/Redo Engine
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable);

      // 1. UNDO: Ctrl+Z / Cmd+Z (without Shift)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (isInputFocused) activeEl.blur();
        handleUndo();
        return;
      }

      // 2. REDO: Ctrl+Y / Cmd+Y OR Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        if (isInputFocused) activeEl.blur();
        handleRedo();
        return;
      }

      // 3. SAVE: Ctrl+S / Cmd+S
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isInputFocused) activeEl.blur();
        saveToVault(true);
        return;
      }

      // 4. FIND: Ctrl+F / Cmd+F
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFindReplaceOpen(true);
        setShowReplaceByDefault(false);
        return;
      }

      // 5. REPLACE: Ctrl+H / Cmd+H
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsFindReplaceOpen(true);
        setShowReplaceByDefault(true);
        return;
      }

      // 6. SHORTCUTS MODAL: ? or F1
      if (!isInputFocused && (e.key === '?' || e.key === 'F1')) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // 7. SIDEBAR TOGGLE: Ctrl+B / Cmd+B
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSceneSidebarOpen((prev) => !prev);
        return;
      }

      // 8. INSERT BLOCK BELOW / ABOVE: Ctrl+Enter / Cmd+Enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const targetId =
          lastSelectedId ||
          (selectedItemIds.size > 0
            ? Array.from(selectedItemIds)[0]
            : orderedItemIds[orderedItemIds.length - 1]);
        if (targetId) {
          if (e.shiftKey) {
            handleAddParagraphAbove(targetId, 'left');
          } else {
            handleAddParagraphBelow(targetId, 'left');
          }
        }
        return;
      }

      // 9. DELETE CURRENT BLOCK: Ctrl+D or Alt+Backspace
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') ||
        (e.altKey && e.key === 'Backspace')
      ) {
        e.preventDefault();
        const targetId =
          lastSelectedId ||
          (selectedItemIds.size > 0 ? Array.from(selectedItemIds)[0] : null);
        if (targetId) {
          handleDeleteItem(targetId);
        }
        return;
      }

      // 10. COLUMN CONVERSION SHORTCUTS:
      // Left Column:   Alt + ArrowLeft  OR  [ (when not typing)  OR  Alt + [
      // Right Column:  Alt + ArrowRight OR  ] (when not typing)  OR  Alt + ]
      // Center Column: \ (when not typing) OR  Alt + \  OR  Alt + C (Transition / Title)
      const isAltLeft = e.altKey && (e.key === 'ArrowLeft' || e.key === '[');
      const isAltRight = e.altKey && (e.key === 'ArrowRight' || e.key === ']');
      const isAltCenter = e.altKey && (e.key === '\\' || e.key.toLowerCase() === 'c');
      const isPlainLeft = !isInputFocused && e.key === '[';
      const isPlainRight = !isInputFocused && e.key === ']';
      const isPlainCenter = !isInputFocused && e.key === '\\';

      if (isAltLeft || isPlainLeft) {
        e.preventDefault();
        const targetId = isInputFocused
          ? (activeEl?.closest('[data-item-row-id]')?.getAttribute('data-item-row-id') ||
             activeEl?.closest('[data-item-id]')?.getAttribute('data-item-id') ||
             lastSelectedId)
          : (lastSelectedId || (selectedItemIds.size > 0 ? Array.from(selectedItemIds)[0] : undefined));
        moveParagraphsToColumn('left', targetId || undefined);
        return;
      }

      if (isAltRight || isPlainRight) {
        e.preventDefault();
        const targetId = isInputFocused
          ? (activeEl?.closest('[data-item-row-id]')?.getAttribute('data-item-row-id') ||
             activeEl?.closest('[data-item-id]')?.getAttribute('data-item-id') ||
             lastSelectedId)
          : (lastSelectedId || (selectedItemIds.size > 0 ? Array.from(selectedItemIds)[0] : undefined));
        moveParagraphsToColumn('right', targetId || undefined);
        return;
      }

      if (isAltCenter || isPlainCenter) {
        e.preventDefault();
        const targetId = isInputFocused
          ? (activeEl?.closest('[data-item-row-id]')?.getAttribute('data-item-row-id') ||
             activeEl?.closest('[data-item-id]')?.getAttribute('data-item-id') ||
             lastSelectedId)
          : (lastSelectedId || (selectedItemIds.size > 0 ? Array.from(selectedItemIds)[0] : undefined));
        moveParagraphsToColumn('center', targetId || undefined);
        return;
      }

      // 10b. QUICK ROW JUMP WHILE EDITING: Alt + ArrowDown / Alt + ArrowUp
      if (e.altKey && !e.shiftKey) {
        if (e.key === 'ArrowDown') {
          const currentId =
            lastSelectedId ||
            (selectedItemIds.size > 0 ? Array.from(selectedItemIds)[0] : null);
          if (currentId) {
            e.preventDefault();
            handleFocusNextRow(currentId, 'auto');
            return;
          }
        }
        if (e.key === 'ArrowUp') {
          const currentId =
            lastSelectedId ||
            (selectedItemIds.size > 0 ? Array.from(selectedItemIds)[0] : null);
          if (currentId) {
            e.preventDefault();
            handleFocusPrevRow(currentId, 'auto');
            return;
          }
        }
      }

      // 11. REORDERING BLOCKS UP/DOWN: Alt + Shift + Up / Down
      if (e.altKey && e.shiftKey) {
        const targetId =
          lastSelectedId ||
          (selectedItemIds.size === 1 ? Array.from(selectedItemIds)[0] : null);
        if (targetId) {
          const idx = orderedItemIds.indexOf(targetId);
          if (e.key === 'ArrowUp' && idx > 0) {
            e.preventDefault();
            const prevId = orderedItemIds[idx - 1];
            handleMoveScriptItem(targetId, prevId, 'above');
            return;
          }
          if (e.key === 'ArrowDown' && idx < orderedItemIds.length - 1) {
            e.preventDefault();
            const nextId = orderedItemIds[idx + 1];
            handleMoveScriptItem(targetId, nextId, 'below');
            return;
          }
        }
      }

      // 12. NON-INPUT NAVIGATION & SELECTION (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter, Esc, Delete, Home, End)
      if (!isInputFocused) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClearSelection();
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedItemIds.size > 0) {
            e.preventDefault();
            handleDeleteSelected();
            return;
          }
        }

        // Navigate Down
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (orderedItemIds.length === 0) return;
          const currentId =
            lastSelectedId ||
            (selectedItemIds.size > 0
              ? Array.from(selectedItemIds)[selectedItemIds.size - 1]
              : null);
          const currentIdx = currentId ? orderedItemIds.indexOf(currentId) : -1;
          const nextIdx = currentIdx === -1 ? 0 : Math.min(orderedItemIds.length - 1, currentIdx + 1);
          const nextId = orderedItemIds[nextIdx];

          if (e.shiftKey && currentId) {
            const startIdx = orderedItemIds.indexOf(Array.from(selectedItemIds)[0]);
            const newRange = orderedItemIds.slice(
              Math.min(startIdx, nextIdx),
              Math.max(startIdx, nextIdx) + 1
            );
            setSelectedItemIds(new Set(newRange));
          } else {
            setSelectedItemIds(new Set([nextId]));
          }
          setLastSelectedId(nextId);
          scrollToItem(nextId, 'smooth');

          const cardEl = document.getElementById(`script-row-card-${nextId}`);
          if (cardEl) cardEl.focus({ preventScroll: true });
          return;
        }

        // Navigate Up
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (orderedItemIds.length === 0) return;
          const currentId =
            lastSelectedId ||
            (selectedItemIds.size > 0 ? Array.from(selectedItemIds)[0] : null);
          const currentIdx = currentId
            ? orderedItemIds.indexOf(currentId)
            : -1;
          const prevIdx = currentIdx === -1 ? 0 : Math.max(0, currentIdx - 1);
          const prevId = orderedItemIds[prevIdx];

          if (e.shiftKey && currentId) {
            const startIdx = orderedItemIds.indexOf(Array.from(selectedItemIds)[0]);
            const newRange = orderedItemIds.slice(
              Math.min(startIdx, prevIdx),
              Math.max(startIdx, prevIdx) + 1
            );
            setSelectedItemIds(new Set(newRange));
          } else {
            setSelectedItemIds(new Set([prevId]));
          }
          setLastSelectedId(prevId);
          scrollToItem(prevId, 'smooth');

          const cardEl = document.getElementById(`script-row-card-${prevId}`);
          if (cardEl) cardEl.focus({ preventScroll: true });
          return;
        }

        // Home: jump to first row
        if (e.key === 'Home') {
          if (orderedItemIds.length > 0) {
            e.preventDefault();
            const firstId = orderedItemIds[0];
            setSelectedItemIds(new Set([firstId]));
            setLastSelectedId(firstId);
            scrollToItem(firstId);
            const cardEl = document.getElementById(`script-row-card-${firstId}`);
            if (cardEl) cardEl.focus({ preventScroll: true });
            return;
          }
        }

        // End: jump to last row
        if (e.key === 'End') {
          if (orderedItemIds.length > 0) {
            e.preventDefault();
            const lastId = orderedItemIds[orderedItemIds.length - 1];
            setSelectedItemIds(new Set([lastId]));
            setLastSelectedId(lastId);
            scrollToItem(lastId);
            const cardEl = document.getElementById(`script-row-card-${lastId}`);
            if (cardEl) cardEl.focus({ preventScroll: true });
            return;
          }
        }

        // ArrowRight in card mode: enter editing directly in Right column (Dialogue)
        if (e.key === 'ArrowRight' && !e.altKey && !e.shiftKey) {
          const targetId = lastSelectedId || (selectedItemIds.size === 1 ? Array.from(selectedItemIds)[0] : null);
          if (targetId) {
            e.preventDefault();
            focusScriptItem(targetId, 'dialogue', 'end');
            return;
          }
        }

        // ArrowLeft in card mode: enter editing directly in Left column (Action)
        if (e.key === 'ArrowLeft' && !e.altKey && !e.shiftKey) {
          const targetId = lastSelectedId || (selectedItemIds.size === 1 ? Array.from(selectedItemIds)[0] : null);
          if (targetId) {
            e.preventDefault();
            focusScriptItem(targetId, 'action', 'end');
            return;
          }
        }

        // Enter to focus selected block into editing
        if (e.key === 'Enter') {
          const targetId =
            lastSelectedId ||
            (selectedItemIds.size === 1 ? Array.from(selectedItemIds)[0] : null);
          if (targetId) {
            e.preventDefault();
            focusScriptItem(targetId, 'auto', 'end');
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    selectedItemIds,
    lastSelectedId,
    orderedItemIds,
    handleUndo,
    handleRedo,
    moveParagraphsToColumn,
    handleMoveScriptItem,
    handleDeleteSelected,
    handleAddParagraphAbove,
    handleAddParagraphBelow,
    handleFocusNextRow,
    handleFocusPrevRow,
  ]);

  // Download Word (.docx) and ensure it is saved to Vault
  const handleDownloadWordDocx = async () => {
    try {
      setIsExportingDocx(true);
      // 1. Immediately persist current screenplay to the Vault
      saveToVault(false);

      const blob = await generateTamilLeftRightDocx(screenplayData, layoutOptions);
      const filename = `${(screenplayData.title || activeDoc?.title || 'Screenplay').replace(/\s+/g, '_')}_Tamil_Left_Right.docx`;
      downloadBlobAsFile(blob, filename);

      // 2. Also attach the generated Word .docx binary into the Vault document
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        if (activeDoc) {
          const updated: ProductionDocument = {
            ...activeDoc,
            convertedDocxDataUrl: dataUrl,
            lastModified: new Date().toISOString(),
          };
          const nextList = documents.map((d) => (d.id === updated.id ? updated : d));
          setDocuments(nextList);
          saveProductionDocuments(nextList);
        }
      };
      reader.readAsDataURL(blob);

      confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
      showToast(`✓ Downloaded & Saved "${filename}" to Vault!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to export Word document');
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Export full paginated 2-column Kollywood Screenplay PDF (Instant Vector Engine)
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      // Immediately persist current screenplay to the Vault
      saveToVault(false);
      showToast('Opening Instant Vector PDF...');
      await printTwoColumnVector(screenplayData);
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
      showToast('✓ PDF ready! Select "Save as PDF"');
    } catch (err) {
      console.error('PDF Export Error:', err);
      showToast('Failed to open PDF export dialog.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Save changes to Vault (immediate or debounced auto-save without UI stutter)
  const saveToVault = useCallback((isManual = false) => {
    if (!activeDoc) return;
    const html = generateTamilLeftRightHtml(screenplayData);
    const updated: ProductionDocument = {
      ...activeDoc,
      title: screenplayData.title || activeDoc.title,
      htmlContent: html,
      isLeftRightFormat: true,
      lastModified: new Date().toISOString(),
    };

    const allDocs = getProductionDocuments();
    const nextList = allDocs.map((d) => (d.id === updated.id ? updated : d));
    saveProductionDocuments(nextList);
    setHasUnsavedChanges(false);
    setIsAutoSaving(false);
    setLastSavedAt(new Date());

    if (isManual) {
      setDocuments(nextList);
      confetti({ particleCount: 25, spread: 50, origin: { y: 0.8 } });
      showToast('✓ Saved 2-Column Screenplay to Vault!');
    }
  }, [activeDoc, screenplayData]);

  // Automatic Debounced Live-Save (saves in background 1.5s after editing stops)
  useEffect(() => {
    if (!hasUnsavedChanges || !activeDoc) return;
    setIsAutoSaving(true);
    const timer = setTimeout(() => {
      saveToVault(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, saveToVault, activeDoc]);

  // Flush unsaved changes immediately on page reload / close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasUnsavedChanges && activeDoc) {
        const html = generateTamilLeftRightHtml(screenplayData);
        const updated: ProductionDocument = {
          ...activeDoc,
          title: screenplayData.title || activeDoc.title,
          htmlContent: html,
          isLeftRightFormat: true,
          lastModified: new Date().toISOString(),
        };
        const nextList = documents.map((d) => (d.id === updated.id ? updated : d));
        saveProductionDocuments(nextList);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, activeDoc, screenplayData, documents]);

  // Import Script File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast(`Importing "${file.name}"...`);
      const parsed = await parseUniversalFile(file);
      const title = file.name.replace(/\.[^/.]+$/, '');
      const newDoc: ProductionDocument = {
        id: `doc-${Date.now()}`,
        title,
        fileName: file.name,
        fileType: (file.name.split('.').pop()?.toUpperCase() || 'DOCX') as any,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        category: 'SCRIPT',
        pageCount: 1,
        uploadedAt: new Date().toISOString(),
        annotations: [],
        textContent: parsed.textContent,
        htmlContent: parsed.htmlContent,
        originalFileDataUrl: parsed.originalFileDataUrl,
        originalFileName: file.name,
        isLeftRightFormat: true,
      };

      const updatedList = [newDoc, ...documents];
      setDocuments(updatedList);
      saveProductionDocuments(updatedList);
      setSelectedDocId(newDoc.id);
      showToast(`✓ Imported "${file.name}" into 2-Column Studio!`);
    } catch (err) {
      console.error(err);
      showToast('Error importing file');
    }
  };

  // Stable memoized row callbacks to ensure 60-120fps navigation without re-rendering all rows
  const handleToggleSelect = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
    setLastSelectedId(itemId);
  }, []);

  const handleRowSetColor = useCallback((itemId: string, color?: string) => {
    setSelectedItemIds((prev) => {
      const targetIds = prev.has(itemId) && prev.size > 1 ? prev : itemId;
      handleUpdateItemColor(targetIds, color);
      return prev;
    });
  }, [handleUpdateItemColor]);

  const handleRowDragStart = useCallback((itemId: string, e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
    setDraggedItemId(itemId);
  }, []);

  const handleRowDragEnd = useCallback(() => {
    setDraggedItemId(null);
    setDragOverTarget(null);
  }, []);

  const handleRowDragOver = useCallback((itemId: string, e: React.DragEvent) => {
    if (!draggedItemId || draggedItemId === itemId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'above' : 'below';
    setDragOverTarget((prev) => {
      if (prev?.itemId !== itemId || prev?.position !== pos) {
        return { itemId, position: pos };
      }
      return prev;
    });
  }, [draggedItemId]);

  const handleRowDragLeave = useCallback((itemId: string, e: React.DragEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientY < rect.top ||
      e.clientY >= rect.bottom ||
      e.clientX < rect.left ||
      e.clientX >= rect.right
    ) {
      setDragOverTarget((prev) => (prev?.itemId === itemId ? null : prev));
    }
  }, []);

  const handleRowDrop = useCallback((itemId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = draggedItemId || e.dataTransfer.getData('text/plain');
    if (sourceId && sourceId !== itemId && dragOverTarget) {
      handleMoveScriptItem(sourceId, itemId, dragOverTarget.position);
    }
    setDraggedItemId(null);
    setDragOverTarget(null);
  }, [draggedItemId, dragOverTarget, handleMoveScriptItem]);

  const handleOpenCharacterManager = useCallback(() => {
    setIsCharacterManagerOpen(true);
  }, []);

  const selectedCount = selectedItemIds.size;
  const paper = PAPER_DIMENSIONS[layoutOptions.paperStandard] || PAPER_DIMENSIONS.A4;

  return (
    <div className={`relative flex flex-col w-full h-full overflow-hidden ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#0a0a0e] text-zinc-100'}`}>
      
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".docx,.fountain,.txt,.md"
        className="hidden"
      />

      {/* Toast Alert */}
      {toastMessage && (
        <div className={`absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl border shadow-2xl text-xs font-mono font-bold flex items-center gap-2 animate-bounce ${
          isLight
            ? 'bg-white/95 text-emerald-800 border-emerald-300 shadow-[0_10px_30px_rgba(0,0,0,0.12)]'
            : 'bg-zinc-950/95 text-emerald-400 border-emerald-500/50 shadow-2xl'
        }`}>
          <Sparkles size={14} className={isLight ? 'text-emerald-600' : 'text-emerald-400'} />
          {toastMessage}
        </div>
      )}

      {/* =========================================================================
          TOP COMMAND NAVBAR
         ========================================================================= */}
      <header className={`px-4 py-2 border-b flex items-center justify-between gap-3 shrink-0 shadow-xs z-30 overflow-x-auto ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#121217] border-zinc-800/90 text-zinc-100'
      }`}>
        {/* Left: Studio Brand, Document Title & Scenes / Find triggers */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`p-1.5 rounded-lg border shrink-0 ${
              isLight
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}>
              <Columns size={16} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[11px] font-black uppercase tracking-wider ${
                  isLight ? 'text-emerald-700' : 'text-emerald-400'
                }`}>
                  Kollywood 2-Column
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black uppercase tracking-wider border bg-blue-500/20 text-blue-400 border-blue-500/30 flex items-center gap-1 shadow-2xs">
                  <FileText size={9} />
                  <span>Script</span>
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black uppercase tracking-wider border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1 shadow-2xs">
                  <Columns size={9} />
                  <span>Screenplay</span>
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono border ${
                  isLight
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50'
                }`}>
                  {totalPages} {totalPages === 1 ? 'Page' : 'Pages'}
                </span>
              </div>

              {/* Directly Editable Document Title */}
              <div className="relative group/title flex items-center gap-1.5 mt-0.5">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={(e) => handleRenameTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className={`text-sm font-bold bg-transparent px-1.5 py-0.5 -ml-1.5 rounded-md border border-transparent transition-all outline-none truncate max-w-[180px] sm:max-w-[280px] md:max-w-[360px] ${
                    isLight
                      ? 'hover:border-slate-300 focus:border-emerald-500 focus:bg-white text-slate-800'
                      : 'hover:border-zinc-700 focus:border-emerald-500 focus:bg-zinc-900 text-zinc-100'
                  }`}
                  title="Click to rename document"
                  placeholder="Untitled Screenplay"
                />
                <Edit2 size={11} className="opacity-0 group-hover/title:opacity-60 transition-opacity pointer-events-none text-slate-400 dark:text-zinc-500 shrink-0" />
              </div>
            </div>
          </div>

          <div className={`w-[1px] h-5 mx-0.5 hidden sm:block ${isLight ? 'bg-slate-200' : 'bg-zinc-700/60'}`} />

          {/* Scenes Sidebar Toggle */}
          <button
            onClick={() => setIsSceneSidebarOpen(!isSceneSidebarOpen)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              isSceneSidebarOpen
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                : isLight
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
            title="Toggle Scene Cards Navigator (Left side)"
          >
            <PanelLeft size={13} className={isSceneSidebarOpen ? 'text-white' : isLight ? 'text-emerald-600' : 'text-emerald-400'} />
            <span>Scenes</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              isSceneSidebarOpen
                ? 'bg-black/30 text-white'
                : isLight
                ? 'bg-slate-200 text-slate-700'
                : 'bg-black/40 text-emerald-400'
            }`}>
              {screenplayData.scenes.length}
            </span>
          </button>

          {/* Find & Replace Trigger */}
          <button
            onClick={() => {
              setIsFindReplaceOpen(true);
              setShowReplaceByDefault(false);
            }}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
            title="Advanced Find & Replace in script (Cmd+F / Ctrl+F)"
          >
            <Search size={13} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
            <span>Find</span>
            <span className={`hidden xl:inline text-[9.5px] font-mono px-1 py-0.2 rounded border ${
              isLight
                ? 'bg-white text-slate-600 border-slate-200'
                : 'bg-black/40 text-zinc-400 border-zinc-700'
            }`}>⌘F</span>
          </button>

          {/* Back to Vault Button */}
          {onNavigateToView && (
            <button
              onClick={() => onNavigateToView('documents')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
              }`}
              title="Return to Document Vault"
            >
              <Folder size={13} className="text-amber-400" />
              <span>Vault</span>
            </button>
          )}
        </div>

        {/* Right: Zoom controls, Undo/Redo, Shortcuts, Format & Style, Export Actions */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className={`flex items-center gap-0.5 border rounded-lg p-0.5 ${
            isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-zinc-900 border-zinc-800'
          }`}>
            <button
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
              className={`p-1 rounded cursor-pointer ${
                isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-400 hover:text-white'
              }`}
              title="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <span className={`text-[11px] font-mono px-1.5 ${
              isLight ? 'text-slate-800 font-semibold' : 'text-zinc-300'
            }`}>{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              className={`p-1 rounded cursor-pointer ${
                isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-400 hover:text-white'
              }`}
              title="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
          </div>

          <div className={`w-[1px] h-5 mx-0.5 hidden sm:block ${isLight ? 'bg-slate-200' : 'bg-zinc-700/60'}`} />

          {/* Undo & Redo History Controls */}
          <div
            className={`flex items-center gap-0.5 border rounded-lg p-0.5 ${
              isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-zinc-900 border-zinc-800'
            }`}
          >
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Undo last change (Ctrl+Z / ⌘Z)"
            >
              <Undo2 size={13} />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Redo (Ctrl+Y / ⌘Shift+Z)"
            >
              <Redo2 size={13} />
            </button>
          </div>

          <div className={`w-[1px] h-5 mx-0.5 hidden sm:block ${isLight ? 'bg-slate-200' : 'bg-zinc-700/60'}`} />

          {/* Keyboard Shortcuts Cheatsheet */}
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
            title="Keyboard Shortcuts Cheatsheet (? / F1)"
          >
            <Keyboard size={13} className={isLight ? 'text-slate-500' : 'text-zinc-400'} />
            <span className="hidden sm:inline">Shortcuts</span>
            <span className={`text-[9.5px] font-mono px-1 py-0.2 rounded border ${
              isLight ? 'bg-white text-slate-500 border-slate-200' : 'bg-black/40 text-zinc-400 border-zinc-700'
            }`}>?</span>
          </button>

          {/* Format & Style Drawer Toggle */}
          <button
            onClick={() => setIsStyleDrawerOpen(!isStyleDrawerOpen)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              isStyleDrawerOpen
                ? isLight
                  ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-xs'
                : isLight
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
            title="Open Margins, Gaps & Font Styling Drawer"
          >
            <Sliders size={13} className={isStyleDrawerOpen ? 'text-amber-500' : isLight ? 'text-slate-500' : 'text-zinc-400'} />
            <span>Format & Style</span>
          </button>

          {/* Download Word (.docx) */}
          <button
            onClick={handleDownloadWordDocx}
            disabled={isExportingDocx}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
              isLight
                ? 'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border-emerald-200/90'
                : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-800/50'
            }`}
            title="Download formatted 2-column Word document"
          >
            <Download size={13} className="text-emerald-500" />
            <span>{isExportingDocx ? 'Exporting...' : 'Word (.docx)'}</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              isLight
                ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-800'
                : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
            }`}
            title="Open 2-Column Script PDF Export Studio & Preview"
          >
            <FileDown size={13} className={isLight ? 'text-white' : 'text-rose-400'} />
            <span>Export PDF</span>
          </button>

          {/* Live Auto-Save Status & Manual Save Button */}
          <button
            onClick={() => saveToVault(true)}
            className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
              isAutoSaving
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
                : hasUnsavedChanges
                ? 'bg-amber-500 text-black border-amber-600 hover:bg-amber-400 shadow-xs'
                : isLight
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
            title={
              isAutoSaving
                ? 'Auto-saving changes to Vault in background...'
                : hasUnsavedChanges
                ? 'Changes detected (click to save to Vault)'
                : `Saved to Vault (${lastSavedAt ? lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'})`
            }
          >
            {isAutoSaving ? (
              <>
                <Loader2 size={13} className="animate-spin text-amber-500" />
                <span>Saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <Save size={13} />
                <span>Save</span>
              </>
            ) : (
              <>
                <Check size={13} className="stroke-[2.5] text-emerald-500" />
                <span className="text-zinc-400 dark:text-zinc-400">Saved</span>
              </>
            )}
          </button>

          {/* Print (Native Browser Vector Print Engine) */}
          <button
            onClick={() => printTwoColumnVector(screenplayData)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer border ${
              isLight
                ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200'
                : 'hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700/60'
            }`}
            title="Print Script (Vector Engine)"
          >
            <Printer size={14} />
          </button>
        </div>
      </header>

      {/* =========================================================================
          FLOATING SELECTION TOOLBAR (Appears whenever paragraphs are selected)
         ========================================================================= */}
      {selectedCount > 0 && (
        <div className="sticky top-3 z-40 mx-auto w-fit max-w-[95vw] px-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-xl backdrop-blur-xl transition-all ${
              isLight
                ? 'bg-white/95 border-slate-200/90 text-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.12)]'
                : 'bg-zinc-900/95 border-zinc-700/80 text-zinc-100 shadow-[0_12px_36px_rgba(0,0,0,0.6)]'
            }`}
          >
            {/* Count Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                isLight
                  ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>{selectedCount} Selected</span>
            </div>

            <div className={`w-[1px] h-4 ${isLight ? 'bg-slate-200' : 'bg-zinc-700/70'}`} />

            {/* Direct Column Controls */}
            <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border ${
              isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-zinc-950/60 border-zinc-800'
            }`}>
              <button
                onClick={() => moveParagraphsToColumn('left')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  isLight
                    ? 'hover:bg-white text-slate-700 hover:text-emerald-700 hover:shadow-xs'
                    : 'hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400'
                }`}
                title="Send highlighted to Left: காட்சி (Visual/Action) [ArrowLeft]"
              >
                <ArrowLeft size={12} className="stroke-[2.5] text-emerald-500" />
                <span>Left: காட்சி</span>
              </button>

              <button
                onClick={() => moveParagraphsToColumn('center')}
                className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  isLight
                    ? 'hover:bg-white text-slate-700 hover:text-amber-700 hover:shadow-xs'
                    : 'hover:bg-zinc-800 text-zinc-300 hover:text-amber-400'
                }`}
                title="Send highlighted to Center: தலைப்பு (Heading/Transition) [ArrowUp / C]"
              >
                <Minus size={12} className="stroke-[2.5] text-amber-500" />
                <span>Center</span>
              </button>

              <button
                onClick={() => moveParagraphsToColumn('right')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  isLight
                    ? 'hover:bg-white text-slate-700 hover:text-sky-700 hover:shadow-xs'
                    : 'hover:bg-zinc-800 text-zinc-300 hover:text-sky-400'
                }`}
                title="Send highlighted to Right: வசனம் (Dialogue) [ArrowRight]"
              >
                <span>Right: வசனம்</span>
                <ArrowRight size={12} className="stroke-[2.5] text-sky-500" />
              </button>
            </div>

            <div className={`w-[1px] h-4 ${isLight ? 'bg-slate-200' : 'bg-zinc-700/70'}`} />

            {/* Direct Alignment for Highlighted Paragraphs */}
            <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border ${
              isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-zinc-950/60 border-zinc-800'
            }`}>
              <button
                onClick={() => handleUpdateItemAlignment('left')}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-xs' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title="Align Left for highlighted paragraphs"
              >
                <AlignLeft size={12} />
              </button>
              <button
                onClick={() => handleUpdateItemAlignment('center')}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-xs' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title="Align Center for highlighted paragraphs"
              >
                <AlignCenter size={12} />
              </button>
              <button
                onClick={() => handleUpdateItemAlignment('right')}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-xs' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title="Align Right for highlighted paragraphs"
              >
                <AlignRight size={12} />
              </button>
              <button
                onClick={() => handleUpdateItemAlignment('justify')}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-xs' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title="Justify highlighted paragraphs"
              >
                <AlignJustify size={12} />
              </button>
            </div>

            {/* Bulk Text Color for Highlighted Paragraphs */}
            <div className="relative">
              <button
                onClick={() => setBulkColorPickerOpen(!bulkColorPickerOpen)}
                className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer border ${
                  isLight
                    ? 'bg-slate-100/70 hover:bg-white text-slate-700 border-slate-200'
                    : 'bg-zinc-950/60 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                }`}
                title="Change text color for highlighted paragraphs"
              >
                <Palette size={12} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
                <span className="text-[11px]">Color</span>
              </button>

              {bulkColorPickerOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute top-full right-0 mt-2 p-2.5 rounded-xl border shadow-2xl z-50 flex flex-col gap-2 min-w-[150px] ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-800 shadow-[0_12px_36px_rgba(0,0,0,0.15)]'
                      : 'bg-zinc-950 border-zinc-700 text-zinc-100'
                  }`}
                >
                  <div className={`flex items-center justify-between text-[11px] font-mono pb-1 border-b ${
                    isLight ? 'text-slate-500 border-slate-200' : 'text-zinc-400 border-zinc-800'
                  }`}>
                    <span>Selected Text Color</span>
                    <button
                      onClick={() => {
                        handleUpdateItemColor(selectedItemIds, undefined);
                        setBulkColorPickerOpen(false);
                      }}
                      className="text-amber-500 hover:text-amber-600 cursor-pointer flex items-center gap-1 text-[10px]"
                    >
                      <RotateCcw size={9} />
                      <span>Reset</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { name: 'Default', hex: '' },
                      { name: 'Sky Blue', hex: '#0284c7' },
                      { name: 'Emerald', hex: '#16a34a' },
                      { name: 'Amber Gold', hex: '#f59e0b' },
                      { name: 'Crimson', hex: '#ef4444' },
                      { name: 'Purple', hex: '#a855f7' },
                      { name: 'Rose', hex: '#f43f5e' },
                      { name: 'Slate', hex: '#64748b' },
                    ].map((c) => (
                      <button
                        key={c.name}
                        onClick={() => {
                          handleUpdateItemColor(selectedItemIds, c.hex || undefined);
                          setBulkColorPickerOpen(false);
                        }}
                        style={{ backgroundColor: c.hex || (isLight ? '#0f172a' : '#f8fafc') }}
                        className={`w-5 h-5 rounded-full border hover:scale-110 cursor-pointer transition-transform ${
                          isLight ? 'border-slate-300' : 'border-zinc-700'
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={`w-[1px] h-4 ${isLight ? 'bg-slate-200' : 'bg-zinc-700/70'}`} />

            {/* Clear Selection Button */}
            <button
              onClick={handleClearSelection}
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                  : 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200'
              }`}
              title="Clear selection (Esc)"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MAIN WORKSPACE: SCRIPT CANVAS & FORMAT DRAWER
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
          onAddScene={handleInsertScene}
          onDeleteScene={handleDeleteScene}
          onRenumberScenes={handleRenumberAllScenes}
          scenePageMap={scenePageMap}
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

        {/* =====================================================================
            PAGINATED SCRIPT SHEETS CANVAS
           ===================================================================== */}
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center">
          <div
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            className={`flex ${pageViewMode === 'spread' ? 'flex-row flex-wrap justify-center gap-8' : 'flex-col gap-10'} items-center pb-24 transition-transform`}
          >
            {(pageViewMode === 'single'
              ? [pages[currentSinglePage - 1] || pages[0]]
              : pages
            ).filter(Boolean).map((page) => (
              <div
                key={page.pageNumber}
                id={`script-page-${page.pageNumber}`}
                style={{
                  width: `${page.widthPx}px`,
                  minHeight: `${page.heightPx}px`,
                  paddingTop: `${page.paddingTopPx}px`,
                  paddingBottom: `${page.paddingBottomPx}px`,
                  paddingLeft: `${page.paddingLeftPx}px`,
                  paddingRight: `${page.paddingRightPx}px`,
                  fontFamily: layoutOptions.baseFontFamily,
                  fontSize: `${layoutOptions.baseFontSizePx}px`,
                  lineHeight: layoutOptions.baseLineHeight,
                  contentVisibility: pageViewMode === 'stacked' ? 'auto' : undefined,
                  containIntrinsicSize: pageViewMode === 'stacked' ? `${page.widthPx}px ${page.heightPx}px` : undefined,
                }}
                className={`relative shadow-2xl rounded-xs transition-all border flex flex-col justify-between ${
                  isLight
                    ? 'bg-white text-zinc-900 border-slate-300'
                    : 'bg-[#18181c] text-zinc-100 border-zinc-800'
                }`}
              >


                {/* 3. Page Body Elements */}
                <div className="flex-1 space-y-4">
                  {page.elements.map((elem, idx) => {
                    // CASE A: Scene Heading Element
                    if (elem.type === 'scene_header') {
                      const charCount = elem.characters?.length || 0;
                      const charListStr = elem.characters && elem.characters.length > 0 ? elem.characters.join(', ') : 'இல்லை';

                      return (
                        <div
                          key={`hdr-${elem.sceneId}-${idx}`}
                          id={`scene-header-${elem.sceneId}`}
                          data-scene-id={elem.sceneId}
                          style={{
                            marginBottom: `${layoutOptions.gapSceneHeaderPx}px`,
                            fontFamily: layoutOptions.sceneHeadingFontFamily,
                            fontSize: `${layoutOptions.sceneHeadingFontSizePx}px`,
                          }}
                        >
                          {layoutOptions.sceneHeadingStyle === 'kollywood' ? (
                            elem.isContinued ? (
                              /* Continued Header on Page 2+ (From diagram) */
                              <div className="pt-1 pb-2 mb-3 border-b-2 border-black dark:border-zinc-200">
                                <div className="font-bold text-sm tracking-wide text-zinc-900 dark:text-zinc-100">
                                  Sc No: {elem.sceneNumber} - Page {elem.scenePageNumber || 2}/{elem.sceneTotalPages || 2}
                                </div>
                              </div>
                            ) : (
                              /* Full Scene Header Box on Page 1 (Exact wireframe layout with boxed pages & dynamic character wrapping) */
                              <div className={`group/hdr relative p-3 rounded-lg border border-black dark:border-zinc-600 transition-all ${
                                isLight
                                  ? 'bg-white text-zinc-950 shadow-xs'
                                  : 'bg-zinc-900/80 text-zinc-100 shadow-xs'
                              }`}>
                                {/* Scene Header Quick Action Hover Bar */}
                                <div className="absolute -top-3.5 right-3 opacity-0 group-hover/hdr:opacity-100 transition-opacity z-30 flex items-center gap-1 border rounded-lg px-2 py-0.5 shadow-md backdrop-blur-xs bg-white/95 dark:bg-zinc-900/95 border-slate-300 dark:border-zinc-700 text-xs select-none">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleInsertScene(elem.sceneId, 'before');
                                    }}
                                    className="p-1 rounded text-[11px] font-bold flex items-center gap-0.5 text-slate-700 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                                    title="Insert scene before this scene"
                                  >
                                    <Plus size={11} className="stroke-[3]" />
                                    <span>Before</span>
                                  </button>
                                  <div className="w-[1px] h-3 bg-slate-300 dark:bg-zinc-700" />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleInsertScene(elem.sceneId, 'after');
                                    }}
                                    className="p-1 rounded text-[11px] font-bold flex items-center gap-0.5 text-slate-700 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                                    title="Insert scene after this scene (auto suffix e.g. 4A)"
                                  >
                                    <Plus size={11} className="stroke-[3]" />
                                    <span>After</span>
                                  </button>
                                  {screenplayData.scenes.length > 1 && (
                                    <>
                                      <div className="w-[1px] h-3 bg-slate-300 dark:bg-zinc-700" />
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteScene(elem.sceneId);
                                        }}
                                        className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
                                        title="Delete this scene"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </>
                                  )}
                                </div>
                                <div
                                  style={{ fontSize: `${layoutOptions.sceneHeadingFontSizePx || 12}px` }}
                                  className="flex flex-col gap-1.5 leading-snug"
                                >
                                  {/* ROW 1: Sc no (Left) | Time (Right) */}
                                  <div className="flex items-center justify-between gap-4 font-bold">
                                    <div className="flex items-center gap-1.5">
                                      <span>Sc no:</span>
                                      <span
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleUpdateScene(elem.sceneId, { sceneNumber: e.currentTarget.innerText.trim() })}
                                        className="outline-none hover:bg-emerald-500/10 px-1 rounded font-black"
                                        title="Click to edit scene number"
                                      >
                                        {elem.sceneNumber}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-end gap-1.5 text-right whitespace-nowrap">
                                      <span className="font-bold shrink-0">Time:</span>
                                      <span
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleUpdateScene(elem.sceneId, { timeOfDay: e.currentTarget.innerText.trim() })}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.currentTarget.blur();
                                          }
                                        }}
                                        className="outline-none hover:bg-emerald-500/10 focus:bg-emerald-500/15 focus:ring-1 focus:ring-emerald-400 px-1 py-0.5 rounded font-bold text-left inline-block transition-all cursor-text"
                                        title="Click to edit Time & INT/EXT (e.g. Day / INT)"
                                      >
                                        {elem.timeOfDay || 'Day / INT'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* ROW 2: Script Location (Left) | [ Pages: 1/3 ] (Center Box) | Real Location (Right) */}
                                  <div className="flex items-center justify-between gap-3 min-w-0">
                                    {/* Left: Script Location (wraps naturally, no ellipsis cutoff) */}
                                    <div className="flex-1 text-left leading-tight min-w-0">
                                      <span className="font-bold mr-1.5 inline">Script Location:</span>
                                      <span
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleUpdateScene(elem.sceneId, { location: e.currentTarget.innerText.trim() })}
                                        className="outline-none hover:bg-emerald-500/10 px-0.5 rounded font-medium break-words inline"
                                        title="Click to edit script location"
                                      >
                                        {elem.location || 'xyz'}
                                      </span>
                                    </div>

                                    {/* Center: Box for Scene Pages (Wireframe Boxed Pill) */}
                                    <div className="shrink-0 px-3 py-0.5 rounded-lg border border-black dark:border-zinc-300 text-center font-bold text-[11px] tracking-wide shadow-2xs select-none whitespace-nowrap self-center">
                                      Pages: {elem.scenePageNumber || 1}/{elem.sceneTotalPages || 1}
                                    </div>

                                    {/* Right: Real Location (wraps naturally, no ellipsis cutoff) */}
                                    <div className="flex-1 text-right leading-tight min-w-0">
                                      <span className="font-bold mr-1.5 inline">Real Location:</span>
                                      <span
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleUpdateScene(elem.sceneId, { realLocation: e.currentTarget.innerText.trim() })}
                                        className="outline-none hover:bg-emerald-500/10 px-0.5 rounded font-medium break-words inline"
                                        title="Click to edit real shooting location"
                                      >
                                        {elem.realLocation || elem.location || 'xyz'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* ROW 3: Characters(n): ... (Left) | Effect (Right) */}
                                  <div className="flex items-start justify-between gap-4 font-bold pt-0.5">
                                    {/* Left: Characters list with ScriptEditor-style dropdown */}
                                    <div className="flex-1 text-left leading-relaxed flex items-baseline flex-wrap">
                                      <span className="mr-1 inline">Characters({charCount}):</span>
                                      <SceneCharactersDropdown
                                        characters={elem.characters || []}
                                        allKnownCharacters={allKnownCharacters}
                                        onChange={(updated) => handleUpdateScene(elem.sceneId, { characters: updated })}
                                        onManageCharacters={() => setIsCharacterManagerOpen(true)}
                                      />
                                    </div>

                                    {/* Right: Effect (inline editable, no dropdown, tight spacing, defaults to None) */}
                                    <div className="flex items-center justify-end gap-1.5 text-right whitespace-nowrap pt-0.5">
                                      <span className="font-bold shrink-0">Effect:</span>
                                      <span
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => handleUpdateScene(elem.sceneId, { effects: e.currentTarget.innerText.trim() || 'None' })}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.currentTarget.blur();
                                          }
                                        }}
                                        className="outline-none hover:bg-emerald-500/10 focus:bg-emerald-500/15 focus:ring-1 focus:ring-emerald-400 px-1 py-0.5 rounded font-bold text-left inline-block transition-all cursor-text"
                                        title="Click to edit Effect (defaults to None)"
                                      >
                                        {elem.effects || 'None'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          ) : layoutOptions.sceneHeadingStyle === 'card' ? (
                            <div className="flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border-l-4 border-emerald-500 font-bold text-emerald-300">
                              <div className="flex items-center gap-4">
                                <span>sc no: {elem.sceneNumber}</span>
                                <span>Script Location: {elem.location}</span>
                                <span>Time: {elem.timeOfDay || 'Day / INT'}</span>
                                <span className="text-xs opacity-75">Characters({charCount}): {charListStr}</span>
                              </div>
                              <span className="text-xs">Pages: {elem.scenePageNumber || 1}/{elem.sceneTotalPages || 1}</span>
                            </div>
                          ) : layoutOptions.sceneHeadingStyle === 'typewriter' ? (
                            <div className="text-center font-mono font-black tracking-widest uppercase py-1 border-y border-dashed border-zinc-500 text-zinc-300">
                              --- sc no: {elem.sceneNumber} &bull; {elem.location} &bull; Time: {elem.timeOfDay || 'Day / INT'} &bull; Pages: {elem.scenePageNumber || 1}/{elem.sceneTotalPages || 1} ---
                            </div>
                          ) : layoutOptions.sceneHeadingStyle === 'underline' ? (
                            <div className="pb-1 border-b-2 border-emerald-500 font-bold text-emerald-400 flex justify-between">
                              <span>sc no: {elem.sceneNumber} : {elem.location} (Characters({charCount}): {charListStr})</span>
                              <span>Pages: {elem.scenePageNumber || 1}/{elem.sceneTotalPages || 1}</span>
                            </div>
                          ) : (
                            <div className="border border-zinc-700 p-2 rounded text-center font-bold text-zinc-200">
                              sc no: {elem.sceneNumber} | Script Location: {elem.location} | Time: {elem.timeOfDay} | Pages: {elem.scenePageNumber || 1}/{elem.sceneTotalPages || 1}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // CASE B: Script Item (Paragraph Row)
                    const item = elem.item;
                    const isSelected = selectedItemIds.has(item.id);
                    const isLeft = item.column === 'left';
                    const isRight = item.column === 'right';
                    const isCenter = item.column === 'center';
                    const isFirstItemInScene = idx === 0 || (idx > 0 && page.elements[idx - 1].type === 'scene_header');

                    return (
                      <TwoColumnItemRow
                        key={item.id}
                        item={item}
                        isSelected={isSelected}
                        isFirstItemInScene={isFirstItemInScene}
                        columnSplitPercent={layoutOptions.columnSplitPercent}
                        columnGutterPx={layoutOptions.columnGutterPx ?? 16}
                        showDivider={layoutOptions.showDivider}
                        dividerStyle={layoutOptions.dividerStyle}
                        actionTextAlign={layoutOptions.actionTextAlign}
                        dialogueTextAlign={layoutOptions.dialogueTextAlign}
                        characterNameBold={layoutOptions.characterNameBold}
                        characterColor={layoutOptions.characterColor}
                        transitionBold={layoutOptions.transitionBold}
                        transitionColor={layoutOptions.transitionColor}
                        transitionStyle={layoutOptions.transitionStyle}
                        gapParagraphRowPx={layoutOptions.gapParagraphRowPx}
                        allKnownCharacters={allKnownCharacters}
                        isLight={isLight}
                        isDragged={draggedItemId === item.id}
                        dragOverPosition={dragOverTarget?.itemId === item.id ? dragOverTarget.position : null}
                        onParagraphClick={handleParagraphClick}
                        onToggleSelect={handleToggleSelect}
                        onUpdateText={handleUpdateItemText}
                        onUpdateCharacter={handleUpdateItemCharacter}
                        onSetSingleAlignment={handleSetSingleItemAlignment}
                        onMoveColumn={moveParagraphsToColumn}
                        onSetColor={handleRowSetColor}
                        onToggleBold={handleToggleItemBold}
                        onToggleItalic={handleToggleItemItalic}
                        onSetMontage={handleSetMontage}
                        onDelete={handleDeleteItem}
                        onAddAbove={handleAddParagraphAbove}
                        onAddBelow={handleAddParagraphBelow}
                        onSplit={handleSplitParagraph}
                        onDragStart={handleRowDragStart}
                        onDragEnd={handleRowDragEnd}
                        onDragOver={handleRowDragOver}
                        onDragLeave={handleRowDragLeave}
                        onDrop={handleRowDrop}
                        onOpenCharacterManager={handleOpenCharacterManager}
                        onFocusNextRow={handleFocusNextRow}
                        onFocusPrevRow={handleFocusPrevRow}
                        onEscapeToCard={handleEscapeToCard}
                        showToast={showToast}
                      />
                    );
                  })}
                </div>

                {/* 3.5. Continues to Next Page Indicator (Exact match from user diagram) */}
                {page.continuesToNextPage && (
                  <div className="pt-3 pb-1 text-center select-none">
                    <span className="text-xs font-bold font-mono tracking-widest text-sky-600 dark:text-sky-400">
                      - Continues -
                    </span>
                  </div>
                )}

                {/* 4. Page Running Bottom Footer (Edition, Date & Page Number) */}
                <div className="flex justify-between items-center text-[10px] text-zinc-500 dark:text-zinc-400 pt-3 mt-4 border-t border-zinc-200 dark:border-zinc-800 font-mono select-none">
                  {/* Left: Current Edition & Date (Editable inline) */}
                  <div className="flex items-center gap-2">
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const val = e.currentTarget.innerText.trim();
                        setLayoutOptions((prev) => ({ ...prev, scriptEdition: val }));
                        setHasUnsavedChanges(true);
                      }}
                      className="outline-none hover:bg-emerald-500/10 focus:bg-emerald-500/15 px-1 py-0.5 rounded font-semibold cursor-text text-zinc-700 dark:text-zinc-300 transition-colors"
                      title="Click to edit Edition (e.g. 1st Edition, Draft 2)"
                    >
                      {layoutOptions.scriptEdition || '1st Edition'}
                    </span>
                    <span>&bull;</span>
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const val = e.currentTarget.innerText.trim();
                        setLayoutOptions((prev) => ({ ...prev, scriptEditionDate: val }));
                        setHasUnsavedChanges(true);
                      }}
                      className="outline-none hover:bg-emerald-500/10 focus:bg-emerald-500/15 px-1 py-0.5 rounded cursor-text text-zinc-500 dark:text-zinc-400 transition-colors"
                      title="Click to edit Date"
                    >
                      {layoutOptions.scriptEditionDate || formattedToday}
                    </span>
                  </div>

                  {/* Right: Page Number */}
                  <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                    Page {page.pageNumber} of {page.totalPages}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* =====================================================================
            FORMAT & STYLE SETTINGS DRAWER (Collapsible)
           ===================================================================== */}
        {isStyleDrawerOpen && (
          <aside className={`w-80 shrink-0 border-l overflow-y-auto p-5 shadow-2xl flex flex-col gap-6 z-30 transition-all ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#141419] border-zinc-800 text-zinc-100'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${
              isLight ? 'border-slate-200' : 'border-zinc-700/50'
            }`}>
              <div className="flex items-center gap-2">
                <Sliders size={15} className="text-[#f5a623]" />
                <h3 className="text-sm font-bold">Format & Style Studio</h3>
              </div>
              <button
                onClick={() => setIsStyleDrawerOpen(false)}
                className={`p-1 rounded transition-colors ${
                  isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-900' : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <X size={15} />
              </button>
            </div>

            {/* 1. Paper Standard */}
            <div className="space-y-2">
              <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Paper Standard
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['A4', 'US_Letter', 'Legal'] as PaperStandard[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setLayoutOptions((prev) => ({ ...prev, paperStandard: p }))}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      layoutOptions.paperStandard === p
                        ? 'bg-[#f5a623] text-black border-[#f5a623] shadow-xs'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    {p === 'US_Letter' ? 'Letter' : p}
                  </button>
                ))}
              </div>
              <p className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                {paper.desc}
              </p>
            </div>

            {/* 2. Margins (mm) */}
            <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <div className="flex justify-between items-center">
                <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Page Margins (mm)
                </label>
                <button
                  onClick={() =>
                    setLayoutOptions((prev) => ({
                      ...prev,
                      marginTopMm: 22,
                      marginBottomMm: 22,
                      marginLeftMm: 22,
                      marginRightMm: 22,
                    }))
                  }
                  className="text-[10px] text-[#f5a623] font-bold hover:underline cursor-pointer"
                >
                  Reset 22mm
                </button>
              </div>

              {/* Margin Preset Chips */}
              <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                <button
                  onClick={() =>
                    setLayoutOptions((prev) => ({
                      ...prev,
                      marginTopMm: 15,
                      marginBottomMm: 15,
                      marginLeftMm: 15,
                      marginRightMm: 15,
                    }))
                  }
                  className={`p-1 rounded border transition-colors cursor-pointer ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' : 'bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                  }`}
                >
                  Compact 15mm
                </button>
                <button
                  onClick={() =>
                    setLayoutOptions((prev) => ({
                      ...prev,
                      marginTopMm: 25,
                      marginBottomMm: 25,
                      marginLeftMm: 25,
                      marginRightMm: 25,
                    }))
                  }
                  className={`p-1 rounded border transition-colors cursor-pointer ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' : 'bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                  }`}
                >
                  Kollywood 25mm
                </button>
                <button
                  onClick={() =>
                    setLayoutOptions((prev) => ({
                      ...prev,
                      marginTopMm: 32,
                      marginBottomMm: 32,
                      marginLeftMm: 32,
                      marginRightMm: 32,
                    }))
                  }
                  className={`p-1 rounded border transition-colors cursor-pointer ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' : 'bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                  }`}
                >
                  Wide 32mm
                </button>
              </div>

              {/* Sliders for Top/Bottom & Left/Right */}
              <div className="space-y-2">
                <div className={`flex justify-between text-xs font-mono ${isLight ? 'text-slate-700 font-medium' : 'text-zinc-300'}`}>
                  <span>Top & Bottom:</span>
                  <span>{layoutOptions.marginTopMm} mm</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="45"
                  value={layoutOptions.marginTopMm}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLayoutOptions((prev) => ({ ...prev, marginTopMm: val, marginBottomMm: val }));
                  }}
                  className="w-full accent-[#f5a623]"
                />
              </div>

              <div className="space-y-2">
                <div className={`flex justify-between text-xs font-mono ${isLight ? 'text-slate-700 font-medium' : 'text-zinc-300'}`}>
                  <span>Left & Right:</span>
                  <span>{layoutOptions.marginLeftMm} mm</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="45"
                  value={layoutOptions.marginLeftMm}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLayoutOptions((prev) => ({ ...prev, marginLeftMm: val, marginRightMm: val }));
                  }}
                  className="w-full accent-[#f5a623]"
                />
              </div>
            </div>

            {/* 3. Gaps & Proportions */}
            <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Gaps & Proportions
              </label>

              <div className="space-y-2">
                <div className={`flex justify-between text-xs font-mono ${isLight ? 'text-slate-700 font-medium' : 'text-zinc-300'}`}>
                  <span>Scene Header Gap:</span>
                  <span>{layoutOptions.gapSceneHeaderPx} px</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="40"
                  value={layoutOptions.gapSceneHeaderPx}
                  onChange={(e) =>
                    setLayoutOptions((prev) => ({ ...prev, gapSceneHeaderPx: Number(e.target.value) }))
                  }
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <div className={`flex justify-between text-xs font-mono ${isLight ? 'text-slate-700 font-medium' : 'text-zinc-300'}`}>
                  <span>Paragraph Gap:</span>
                  <span>{layoutOptions.gapParagraphRowPx} px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="24"
                  value={layoutOptions.gapParagraphRowPx}
                  onChange={(e) =>
                    setLayoutOptions((prev) => ({ ...prev, gapParagraphRowPx: Number(e.target.value) }))
                  }
                  className="w-full accent-sky-500"
                />
              </div>

              <div className="space-y-2">
                <div className={`flex justify-between text-xs font-mono ${isLight ? 'text-slate-700 font-medium' : 'text-zinc-300'}`}>
                  <span>Column Split:</span>
                  <span>
                    {layoutOptions.columnSplitPercent}% Left / {100 - layoutOptions.columnSplitPercent}% Right
                  </span>
                </div>
                <input
                  type="range"
                  min="38"
                  max="62"
                  value={layoutOptions.columnSplitPercent}
                  onChange={(e) =>
                    setLayoutOptions((prev) => ({ ...prev, columnSplitPercent: Number(e.target.value) }))
                  }
                  className="w-full accent-[#f5a623]"
                />
              </div>

              {/* Left / Right Column Gutter Separation Slider */}
              <div className="space-y-2">
                <div className={`flex justify-between text-xs font-mono ${isLight ? 'text-slate-700 font-medium' : 'text-zinc-300'}`}>
                  <span>Left / Right Separation Space:</span>
                  <span className={`${isLight ? 'text-emerald-700' : 'text-emerald-400'} font-bold`}>{layoutOptions.columnGutterPx ?? 16} px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="64"
                  step="2"
                  value={layoutOptions.columnGutterPx ?? 16}
                  onChange={(e) => {
                    setLayoutOptions((prev) => ({ ...prev, columnGutterPx: Number(e.target.value) }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* 4. Base Typography */}
            <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Typography & Bold Styling
              </label>

              <div className="space-y-1">
                <span className={`text-[11px] font-mono ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Font Family:</span>
                <select
                  value={layoutOptions.baseFontFamily}
                  onChange={(e) => setLayoutOptions((prev) => ({ ...prev, baseFontFamily: e.target.value }))}
                  className={`w-full text-xs rounded-lg p-2 outline-none border transition-colors ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-800 focus:border-amber-500' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                  }`}
                >
                  <option value="'Vijaya', 'Latha', sans-serif">Vijaya (Kollywood Classic)</option>
                  <option value="'Latha', sans-serif">Latha (Tamil Standard)</option>
                  <option value="'Mukta Malar', sans-serif">Mukta Malar (Clean Modern)</option>
                  <option value="'Noto Sans Tamil', sans-serif">Noto Sans Tamil</option>
                  <option value="'Courier Prime', monospace">Courier Prime (Monospace)</option>
                  <option value="'Inter', sans-serif">Inter (Modern Sans)</option>
                </select>
              </div>

              {/* Bold Toggles for Character Names & Transitions */}
              <div className={`space-y-2 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800/80'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono ${isLight ? 'text-slate-700 font-medium' : 'text-zinc-300'}`}>Bold Character Names:</span>
                  <input
                    type="checkbox"
                    checked={layoutOptions.characterNameBold !== false}
                    onChange={(e) => {
                      setLayoutOptions((prev) => ({ ...prev, characterNameBold: e.target.checked }));
                      setHasUnsavedChanges(true);
                    }}
                    className="accent-emerald-500 cursor-pointer w-4 h-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono ${isLight ? 'text-slate-700 font-medium' : 'text-zinc-300'}`}>Bold Transitions / Sluglines:</span>
                  <input
                    type="checkbox"
                    checked={layoutOptions.transitionBold !== false}
                    onChange={(e) => {
                      setLayoutOptions((prev) => ({ ...prev, transitionBold: e.target.checked }));
                      setHasUnsavedChanges(true);
                    }}
                    className="accent-amber-500 cursor-pointer w-4 h-4"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className={`flex justify-between text-xs font-mono ${isLight ? 'text-slate-700 font-medium' : 'text-zinc-300'}`}>
                  <span>Font Size:</span>
                  <span>{layoutOptions.baseFontSizePx} px</span>
                </div>
                <input
                  type="range"
                  min="11"
                  max="17"
                  step="0.5"
                  value={layoutOptions.baseFontSizePx}
                  onChange={(e) =>
                    setLayoutOptions((prev) => ({ ...prev, baseFontSizePx: Number(e.target.value) }))
                  }
                  className="w-full accent-[#f5a623]"
                />
              </div>

              <div className="space-y-2">
                <div className={`flex justify-between text-xs font-mono ${isLight ? 'text-slate-700 font-medium' : 'text-zinc-300'}`}>
                  <span>Line Height:</span>
                  <span>{layoutOptions.baseLineHeight}</span>
                </div>
                <input
                  type="range"
                  min="1.3"
                  max="2.1"
                  step="0.1"
                  value={layoutOptions.baseLineHeight}
                  onChange={(e) =>
                    setLayoutOptions((prev) => ({ ...prev, baseLineHeight: Number(e.target.value) }))
                  }
                  className="w-full accent-[#f5a623]"
                />
              </div>

              <div className="space-y-2">
                <div className={`flex justify-between text-xs font-mono ${isLight ? 'text-slate-700 font-medium' : 'text-zinc-300'}`}>
                  <span>Scene Header Font Size:</span>
                  <span>{layoutOptions.sceneHeadingFontSizePx || 12} px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="14"
                  step="0.5"
                  value={layoutOptions.sceneHeadingFontSizePx || 12}
                  onChange={(e) =>
                    setLayoutOptions((prev) => ({ ...prev, sceneHeadingFontSizePx: Number(e.target.value) }))
                  }
                  className="w-full accent-[#f5a623]"
                />
              </div>
            </div>

            {/* Script Colors: Character Name & Transitions */}
            <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Script Colors (Character & Transitions)
              </label>

              {/* Character Name Color */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-mono ${isLight ? 'text-slate-600' : 'text-zinc-300'}`}>Character Color (கதாபாத்திரம்):</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      style={{ color: layoutOptions.characterColor || '#0284c7' }}
                      className="text-xs font-bold font-mono"
                    >
                      ரங்கா :
                    </span>
                    <input
                      type="color"
                      value={layoutOptions.characterColor || '#0284c7'}
                      onChange={(e) => {
                        setLayoutOptions((prev) => ({ ...prev, characterColor: e.target.value }));
                        setHasUnsavedChanges(true);
                      }}
                      className="w-5 h-5 p-0 rounded border-0 bg-transparent cursor-pointer"
                      title="Custom character color"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[
                    { name: 'Sky Blue (Classic)', hex: '#0284c7' },
                    { name: 'Emerald', hex: '#16a34a' },
                    { name: 'Amber Gold', hex: '#f59e0b' },
                    { name: 'Crimson', hex: '#ef4444' },
                    { name: 'Violet', hex: '#8b5cf6' },
                    { name: 'Slate Dark', hex: '#334155' },
                    { name: 'Pure Black', hex: '#000000' },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => {
                        setLayoutOptions((prev) => ({ ...prev, characterColor: c.hex }));
                        setHasUnsavedChanges(true);
                      }}
                      style={{ backgroundColor: c.hex }}
                      className={`w-5 h-5 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                        (layoutOptions.characterColor || '#0284c7') === c.hex
                          ? 'border-white ring-2 ring-emerald-500/60 scale-110'
                          : isLight
                          ? 'border-slate-300 hover:scale-105'
                          : 'border-zinc-700/60 hover:scale-105'
                      }`}
                      title={c.name}
                    >
                      {(layoutOptions.characterColor || '#0284c7') === c.hex && (
                        <Check size={9} className="text-white" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Character Auto-Suggestion & Typo Manager Card */}
                <div className={`mt-3 p-2.5 rounded-lg border ${isLight ? 'bg-emerald-50/80 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Users size={13} className="text-emerald-500" />
                      <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                        Character Master Names
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-900/60 text-emerald-300'}`}>
                      {allKnownCharacters.length} names
                    </span>
                  </div>
                  <p className={`text-[11px] leading-tight mb-2.5 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                    Manage suggestions, fix misspelled typos, and merge character duplicates script-wide.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCharacterManagerOpen(true)}
                    className={`w-full py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                      isLight
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black'
                    }`}
                  >
                    <Users size={13} />
                    <span>Manage Names & Fix Typos</span>
                  </button>
                </div>
              </div>

              {/* Transition & Header Color */}
              <div className={`space-y-1.5 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800/80'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-mono ${isLight ? 'text-slate-600' : 'text-zinc-300'}`}>Transition Color (காட்சி மாற்றம்):</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      style={{ color: layoutOptions.transitionColor || '#f59e0b' }}
                      className="text-xs font-bold font-mono"
                    >
                      CUT TO:
                    </span>
                    <input
                      type="color"
                      value={layoutOptions.transitionColor || '#f59e0b'}
                      onChange={(e) => {
                        setLayoutOptions((prev) => ({ ...prev, transitionColor: e.target.value }));
                        setHasUnsavedChanges(true);
                      }}
                      className="w-5 h-5 p-0 rounded border-0 bg-transparent cursor-pointer"
                      title="Custom transition color"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[
                    { name: 'Amber Gold (Classic)', hex: '#f59e0b' },
                    { name: 'Emerald Green', hex: '#16a34a' },
                    { name: 'Sky Blue', hex: '#0284c7' },
                    { name: 'Ruby Crimson', hex: '#e11d48' },
                    { name: 'Purple Violet', hex: '#9333ea' },
                    { name: 'Slate Grey', hex: '#64748b' },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => {
                        setLayoutOptions((prev) => ({ ...prev, transitionColor: c.hex }));
                        setHasUnsavedChanges(true);
                      }}
                      style={{ backgroundColor: c.hex }}
                      className={`w-5 h-5 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                        (layoutOptions.transitionColor || '#f59e0b') === c.hex
                          ? 'border-white ring-2 ring-amber-500/60 scale-110'
                          : isLight
                          ? 'border-slate-300 hover:scale-105'
                          : 'border-zinc-700/60 hover:scale-105'
                      }`}
                      title={c.name}
                    >
                      {(layoutOptions.transitionColor || '#f59e0b') === c.hex && (
                        <Check size={9} className="text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Text Alignment (Left, Center, Right, Justify) */}
            <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Text Alignment (2-Column Page)
              </label>

              {/* Action Column Alignment */}
              <div className="space-y-1.5">
                <span className={`text-[11px] font-mono ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Action Column (இடது: காட்சி):</span>
                <div className="grid grid-cols-4 gap-1">
                  {(['left', 'center', 'right', 'justify'] as const).map((al) => (
                    <button
                      key={al}
                      onClick={() => {
                        setLayoutOptions((prev) => ({ ...prev, actionTextAlign: al }));
                        setHasUnsavedChanges(true);
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg border capitalize transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        (layoutOptions.actionTextAlign || 'justify') === al
                          ? 'bg-emerald-500 text-black border-emerald-500 shadow-xs'
                          : isLight
                          ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                      }`}
                      title={`Align Action ${al}`}
                    >
                      {al === 'left' && <AlignLeft size={12} />}
                      {al === 'center' && <AlignCenter size={12} />}
                      {al === 'right' && <AlignRight size={12} />}
                      {al === 'justify' && <AlignJustify size={12} />}
                      <span className="capitalize text-[10px]">{al === 'justify' ? 'Justify' : al}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dialogue Column Alignment */}
              <div className="space-y-1.5">
                <span className={`text-[11px] font-mono ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Dialogue Column (வலது: வசனம்):</span>
                <div className="grid grid-cols-4 gap-1">
                  {(['left', 'center', 'right', 'justify'] as const).map((al) => (
                    <button
                      key={al}
                      onClick={() => {
                        setLayoutOptions((prev) => ({ ...prev, dialogueTextAlign: al }));
                        setHasUnsavedChanges(true);
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg border capitalize transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        (layoutOptions.dialogueTextAlign || 'left') === al
                          ? 'bg-sky-500 text-black border-sky-500 shadow-xs'
                          : isLight
                          ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                      }`}
                      title={`Align Dialogue ${al}`}
                    >
                      {al === 'left' && <AlignLeft size={12} />}
                      {al === 'center' && <AlignCenter size={12} />}
                      {al === 'right' && <AlignRight size={12} />}
                      {al === 'justify' && <AlignJustify size={12} />}
                      <span className="capitalize text-[10px]">{al === 'justify' ? 'Justify' : al}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 6. Scene Heading Style */}
            <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Scene Heading Style
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['kollywood', 'card', 'typewriter', 'underline', 'boxed'] as SceneHeadingStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => setLayoutOptions((prev) => ({ ...prev, sceneHeadingStyle: style }))}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg border capitalize transition-all cursor-pointer ${
                      layoutOptions.sceneHeadingStyle === style
                        ? 'bg-emerald-500 text-black border-emerald-500 shadow-xs'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                    } ${style === 'kollywood' ? 'col-span-2 text-center' : ''}`}
                  >
                    {style === 'kollywood' ? '🎬 Kollywood 3-Line (Official)' : style}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Center / Transition Style */}
            <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Center / Transition Style
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['tracking', 'dashed', 'pill', 'italic'] as TransitionStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => setLayoutOptions((prev) => ({ ...prev, transitionStyle: style }))}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg border capitalize transition-all cursor-pointer ${
                      layoutOptions.transitionStyle === style
                        ? 'bg-amber-500 text-black border-amber-500 shadow-xs'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* 7. Column Divider Style */}
            <div className={`space-y-2 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <div className="flex items-center justify-between">
                <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Column Divider
                </label>
                <input
                  type="checkbox"
                  checked={layoutOptions.showDivider}
                  onChange={(e) => setLayoutOptions((prev) => ({ ...prev, showDivider: e.target.checked }))}
                  className="accent-emerald-500 cursor-pointer"
                />
              </div>
              {layoutOptions.showDivider && (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setLayoutOptions((prev) => ({ ...prev, dividerStyle: 'dashed' }))}
                    className={`py-1 px-2 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                      layoutOptions.dividerStyle === 'dashed'
                        ? isLight
                          ? 'bg-slate-800 text-white border-slate-700'
                          : 'bg-zinc-700 text-white border-zinc-500'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    Dashed
                  </button>
                  <button
                    onClick={() => setLayoutOptions((prev) => ({ ...prev, dividerStyle: 'hairline' }))}
                    className={`py-1 px-2 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                      layoutOptions.dividerStyle === 'hairline'
                        ? isLight
                          ? 'bg-slate-800 text-white border-slate-700'
                          : 'bg-zinc-700 text-white border-zinc-500'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    Hairline
                  </button>
                </div>
              )}
            </div>

            {/* 8. Fresh Page per Scene */}
            <div className={`space-y-2 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    Fresh Page Per Scene
                  </div>
                  <div className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                    Each new scene starts on a new fresh page
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={layoutOptions.freshPagePerScene !== false}
                  onChange={(e) =>
                    setLayoutOptions((prev) => ({ ...prev, freshPagePerScene: e.target.checked }))
                  }
                  className="accent-emerald-500 cursor-pointer h-4 w-4"
                />
              </div>
            </div>

            {/* 9. Scene End Transition (CUT TO) Option */}
            <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Scene End Transition (CUT TO)
              </label>

              {/* Auto End-Scene CUT TO Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-zinc-300'}`}>
                    Auto "CUT TO:" at End of Scene
                  </div>
                  <div className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                    Automatically adds transition if scene doesn't have one
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={layoutOptions.autoEndSceneCutTo !== false}
                  onChange={(e) => {
                    setLayoutOptions((prev) => ({ ...prev, autoEndSceneCutTo: e.target.checked }));
                    setHasUnsavedChanges(true);
                  }}
                  className="accent-emerald-500 cursor-pointer h-4 w-4"
                />
              </div>

              {/* Custom Transition Text Input */}
              {layoutOptions.autoEndSceneCutTo !== false && (
                <div className="space-y-2 pt-1">
                  <div className={`flex justify-between text-[11px] font-mono ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                    <span>Transition Text:</span>
                    <span className={`${isLight ? 'text-emerald-700' : 'text-emerald-400'} font-bold`}>{layoutOptions.endSceneCutToText || 'CUT TO:'}</span>
                  </div>
                  <input
                    type="text"
                    value={layoutOptions.endSceneCutToText || 'CUT TO:'}
                    onChange={(e) => {
                      setLayoutOptions((prev) => ({ ...prev, endSceneCutToText: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="e.g. CUT TO:, கட் டூ:, DISSOLVE TO:"
                    className={`w-full text-xs rounded-lg px-2.5 py-1.5 outline-none font-mono border transition-colors ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-800 focus:border-emerald-500'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-emerald-500'
                    }`}
                  />

                  {/* Preset Quick Chips */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {['CUT TO:', 'கட் டூ:', 'DISSOLVE TO:', 'FADE OUT.'].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          setLayoutOptions((prev) => ({ ...prev, endSceneCutToText: preset }));
                          setHasUnsavedChanges(true);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                          (layoutOptions.endSceneCutToText || 'CUT TO:') === preset
                            ? isLight
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold'
                            : isLight
                            ? 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-200'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Button: Bake into All Scenes */}
                  <div className="pt-1.5">
                    <button
                      onClick={handleApplyCutToToAllScenes}
                      className={`w-full py-1.5 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 hover:border-emerald-500'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 hover:border-emerald-500/50'
                      }`}
                      title="Permanently add transition paragraph to all scenes currently missing one"
                    >
                      <Sparkles size={12} className="text-amber-500" />
                      <span>Bake into All Scenes</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 10. Running Footer (Edition & Date) */}
            <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Running Footer (Edition & Date)
              </label>

              <div className="space-y-1">
                <span className={`text-[11px] font-mono ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Current Edition / Version:</span>
                <input
                  type="text"
                  value={layoutOptions.scriptEdition || '1st Edition'}
                  onChange={(e) => {
                    setLayoutOptions((prev) => ({ ...prev, scriptEdition: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="e.g. 1st Edition, Draft 2..."
                  className={`w-full text-xs rounded-lg p-2 outline-none border transition-colors ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-800 focus:border-amber-500' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <span className={`text-[11px] font-mono ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>Edition Date:</span>
                <input
                  type="text"
                  value={layoutOptions.scriptEditionDate || formattedToday}
                  onChange={(e) => {
                    setLayoutOptions((prev) => ({ ...prev, scriptEditionDate: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="e.g. 09 Oct 2026..."
                  className={`w-full text-xs rounded-lg p-2 outline-none border transition-colors ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-800 focus:border-amber-500' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                  }`}
                />
              </div>
            </div>
          </aside>
        )}
      </div>
      
      {/* Dedicated 2-Column Script PDF Export & Print Studio Modal */}
      <TwoColumnExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        screenplayData={screenplayData}
        isLight={isLight}
        initialOptions={layoutOptions}
      />

      {/* Character Auto-Suggestion & Typo Management Studio Modal */}
      <CharacterSuggestionManagerModal
        isOpen={isCharacterManagerOpen}
        onClose={() => setIsCharacterManagerOpen(false)}
        allKnownCharacters={allKnownCharacters}
        characterCounts={characterCounts}
        onRenameCharacter={handleBatchRenameCharacter}
        onMergeCharacters={handleMergeCharacters}
        onDeleteCharacter={handleDeleteCharacter}
        onAddCharacter={handleAddApprovedCharacter}
        scenes={screenplayData.scenes}
        onJumpToOccurrence={handleJumpToOccurrence}
        isLight={isLight}
      />

      {/* Kollywood 2-Column Keyboard Shortcuts Cheatsheet Modal */}
      <TwoColumnShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        isLight={isLight}
      />
    </div>
  );
};
