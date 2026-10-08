import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Upload,
  Printer,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Maximize2,
  BookOpen,
  Layout,
  Type,
  AlignLeft,
  Eye,
  RotateCcw,
  Search,
  PanelLeft,
  PanelLeftClose,
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
    (appTheme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches);

  // All documents from Vault
  const [documents, setDocuments] = useState<ProductionDocument[]>(() => getProductionDocuments());

  // Active script document
  const [selectedDocId, setSelectedDocId] = useState<string>(() => {
    if (initialDocumentId) return initialDocumentId;
    const scriptDoc = documents.find((d) => d.category === 'SCRIPT' || d.isLeftRightFormat || d.id === 'doc-ranga-1');
    return scriptDoc?.id || documents[0]?.id || 'doc-ranga-1';
  });

  const activeDoc = useMemo(() => {
    return documents.find((d) => d.id === selectedDocId) || documents[0];
  }, [documents, selectedDocId]);

  // Screenplay Data
  const [screenplayData, setScreenplayData] = useState<TamilScreenplayData>(() => {
    const raw = activeDoc?.textContent || (activeDoc?.htmlContent ? activeDoc.htmlContent.replace(/<[^>]+>/g, '\n') : '');
    return parseScreenplayToTamilLeftRight(raw, activeDoc?.title || 'பைலட் ரங்கா');
  });

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Global keyboard shortcuts for Find & Replace (Cmd+F, Cmd+H)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
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
  }, []);

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

  // All known characters across the screenplay
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

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
  const moveParagraphsToColumn = (targetColumn: 'left' | 'right' | 'center', specificItemId?: string) => {
    const idsToMove = specificItemId ? new Set([specificItemId]) : selectedItemIds;
    if (idsToMove.size === 0) return;

    setScreenplayData((prev) => {
      const nextScenes = prev.scenes.map((scene) => ({
        ...scene,
        items: scene.items.map((item) => {
          if (idsToMove.has(item.id)) {
            let text = item.rawText || item.leftAction || item.rightDialogue || '';
            let char = item.rightCharacter || '';

            if (targetColumn === 'right' && !char) {
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
  };

  // Direct in-place text update
  const handleUpdateItemText = (itemId: string, newText: string) => {
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
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.map((it) => (it.id === itemId ? { ...it, rightCharacter: newChar } : it)),
      })),
    }));
    setHasUnsavedChanges(true);
  };

  // Update scene metadata
  const handleUpdateScene = (sceneId: string, updates: Partial<TamilScene>) => {
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...updates } : sc)),
    }));
    setHasUnsavedChanges(true);
  };

  // Delete item
  const handleDeleteItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.filter((it) => it.id !== itemId),
      })),
    }));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    setHasUnsavedChanges(true);
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

    setTimeout(() => {
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
      }
    }, 60);
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

    setTimeout(() => {
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
      }
    }, 60);
  };

  // Split paragraph into separate shots
  const handleSplitParagraph = (
    itemId: string,
    splitOffset?: number,
    customFullText?: string
  ) => {
    const newItemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

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

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  // Download Word (.docx)
  const handleDownloadWordDocx = async () => {
    try {
      setIsExportingDocx(true);
      const blob = await generateTamilLeftRightDocx(screenplayData, layoutOptions);
      const filename = `${(screenplayData.title || activeDoc?.title || 'Screenplay').replace(/\s+/g, '_')}_Tamil_Left_Right.docx`;
      downloadBlobAsFile(blob, filename);
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
      showToast(`✓ Downloaded "${filename}"!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to export Word document');
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Export full paginated 2-column Kollywood Screenplay PDF
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      showToast('Generating 2-Column PDF...');

      if (document.fonts) {
        await document.fonts.ready;
      }

      // If in single or spread mode, temporarily switch to stacked so all pages are in DOM
      const prevMode = pageViewMode;
      if (prevMode !== 'stacked') {
        setPageViewMode('stacked');
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const pageElements = Array.from(document.querySelectorAll('[id^="script-page-"]')) as HTMLElement[];
      if (pageElements.length === 0) {
        throw new Error('No pages found to export');
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];
        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll('button, .no-print, [title*="Insert"], [title*="Delete"], [title*="Add"], [title*="select paragraph"]').forEach((b) => {
              (b as HTMLElement).style.display = 'none';
            });
            const clonedPage = clonedDoc.getElementById(pageEl.id);
            if (clonedPage) {
              clonedPage.style.boxShadow = 'none';
              clonedPage.style.border = 'none';
              clonedPage.style.backgroundColor = '#ffffff';
              clonedPage.style.color = '#111827';
            }
          },
        });

        if (i > 0) {
          pdf.addPage('a4', 'p');
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      if (prevMode !== 'stacked') {
        setPageViewMode(prevMode);
      }

      const filename = `${(screenplayData.title || activeDoc?.title || 'Screenplay').replace(/\s+/g, '_')}_2Column_Script.pdf`;
      pdf.save(filename);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
      showToast(`✓ Exported "${filename}"!`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      showToast('Failed to export PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Save changes to Vault
  const handleSaveToVault = () => {
    const html = generateTamilLeftRightHtml(screenplayData);
    const updated: ProductionDocument = {
      ...activeDoc,
      title: screenplayData.title || activeDoc.title,
      htmlContent: html,
      isLeftRightFormat: true,
      lastModified: new Date().toISOString(),
    };

    const nextList = documents.map((d) => (d.id === updated.id ? updated : d));
    setDocuments(nextList);
    saveProductionDocuments(nextList);
    setHasUnsavedChanges(false);
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.8 } });
    showToast('✓ Saved 2-Column Screenplay to Vault!');
  };

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
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-zinc-950/95 text-emerald-400 border border-emerald-500/50 shadow-2xl text-xs font-mono font-bold flex items-center gap-2 animate-bounce">
          <Sparkles size={14} />
          {toastMessage}
        </div>
      )}

      {/* =========================================================================
          TOP COMMAND NAVBAR
         ========================================================================= */}
      <header className={`px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-sm z-30 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#121217] border-zinc-800'
      }`}>
        {/* Left: Studio Brand & Script Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <Columns size={16} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Kollywood 2-Column
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-800 text-zinc-400">
                  {totalPages} {totalPages === 1 ? 'Page' : 'Pages'}
                </span>
              </div>
              <h1 className="text-sm font-bold truncate max-w-xs sm:max-w-sm">
                {screenplayData.title || activeDoc?.title}
              </h1>
            </div>
          </div>

          {/* Script Selector Dropdown */}
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className={`text-xs rounded-lg px-2.5 py-1 font-mono border outline-none cursor-pointer ${
              isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-zinc-900 border-zinc-700 text-zinc-300'
            }`}
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} {d.isLeftRightFormat ? '• 2-Col' : ''}
              </option>
            ))}
          </select>

          {/* Import File Trigger */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Import Word (.docx), Fountain, or Text script"
          >
            <Upload size={14} />
          </button>

          <div className="w-[1px] h-4 bg-zinc-700 mx-0.5" />

          {/* Scenes Sidebar Toggle */}
          <button
            onClick={() => setIsSceneSidebarOpen(!isSceneSidebarOpen)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              isSceneSidebarOpen
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/20'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
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
            className="px-2.5 py-1 text-xs font-bold rounded-lg border bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Advanced Find & Replace in script (Cmd+F / Ctrl+F)"
          >
            <Search size={13} className="text-amber-400" />
            <span>Find</span>
            <span className="hidden xl:inline text-[9.5px] font-mono px-1 py-0.2 rounded bg-black/40 text-zinc-400 border border-zinc-700">⌘F</span>
          </button>
        </div>

        {/* Center: Page Mode Switcher & Navigation */}
        <div className="flex items-center gap-2">
          {/* Page Display Mode */}
          <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-xs font-mono">
            <button
              onClick={() => setPageViewMode('stacked')}
              className={`px-2.5 py-1 rounded font-bold transition-all ${
                pageViewMode === 'stacked' ? 'bg-[#f5a623] text-black shadow-xs' : 'text-zinc-400 hover:text-white'
              }`}
              title="Stacked Continuous Sheets"
            >
              Stacked
            </button>
            <button
              onClick={() => setPageViewMode('single')}
              className={`px-2.5 py-1 rounded font-bold transition-all ${
                pageViewMode === 'single' ? 'bg-[#f5a623] text-black shadow-xs' : 'text-zinc-400 hover:text-white'
              }`}
              title="Single Page Reader"
            >
              Single
            </button>
            <button
              onClick={() => setPageViewMode('spread')}
              className={`px-2.5 py-1 rounded font-bold transition-all ${
                pageViewMode === 'spread' ? 'bg-[#f5a623] text-black shadow-xs' : 'text-zinc-400 hover:text-white'
              }`}
              title="Two-Page Spread"
            >
              Spread
            </button>
          </div>

          {/* Single page stepper */}
          {pageViewMode === 'single' && (
            <div className="flex items-center gap-1 text-xs font-mono text-zinc-300">
              <button
                onClick={() => setCurrentSinglePage((p) => Math.max(1, p - 1))}
                disabled={currentSinglePage <= 1}
                className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span>{currentSinglePage} / {totalPages}</span>
              <button
                onClick={() => setCurrentSinglePage((p) => Math.min(totalPages, p + 1))}
                disabled={currentSinglePage >= totalPages}
                className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
              className="p-1 text-zinc-400 hover:text-white rounded"
              title="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[11px] font-mono px-1 text-zinc-300">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
              className="p-1 text-zinc-400 hover:text-white rounded"
              title="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
          </div>
        </div>

        {/* Right: Style Studio Drawer Toggle & Export Actions */}
        <div className="flex items-center gap-2">
          {/* Format & Style Drawer Toggle */}
          <button
            onClick={() => setIsStyleDrawerOpen(!isStyleDrawerOpen)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
              isStyleDrawerOpen
                ? 'bg-[#f5a623] text-black border-[#f5a623]'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
            }`}
            title="Open Margins, Gaps & Font Styling Drawer"
          >
            <Sliders size={13} />
            <span>Format & Style</span>
          </button>

          {/* Download Word (.docx) */}
          <button
            onClick={handleDownloadWordDocx}
            disabled={isExportingDocx}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="Download formatted 2-column Word document"
          >
            <Download size={13} />
            <span>{isExportingDocx ? 'Exporting...' : 'Word (.docx)'}</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            title="Open 2-Column Script PDF Export Studio & Preview"
          >
            <FileDown size={13} />
            <span>Export PDF</span>
          </button>

          {/* Save to Vault */}
          <button
            onClick={handleSaveToVault}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-[#f5a623] hover:bg-amber-400 text-black animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
            }`}
            title="Save changes to Backstage Vault"
          >
            <Save size={13} />
            <span>Save</span>
          </button>

          {/* Print (Native Browser Vector Print Engine) */}
          <button
            onClick={() => printTwoColumnVector(screenplayData)}
            className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-zinc-700/60"
            title="Print Script (Vector Engine)"
          >
            <Printer size={15} />
          </button>
        </div>
      </header>

      {/* =========================================================================
          FLOATING ARROW BAR (Appears whenever paragraphs are highlighted)
         ========================================================================= */}
      {selectedCount > 0 && (
        <div className="sticky top-2 z-40 mx-auto w-full max-w-xl px-4 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`flex items-center justify-between gap-3 px-4 py-2 rounded-2xl border shadow-lg backdrop-blur-md transition-all ${
              isLight
                ? 'bg-white/95 border-slate-200/90 text-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.08)]'
                : 'bg-zinc-900/95 border-zinc-700/80 text-zinc-100 shadow-[0_12px_36px_rgba(0,0,0,0.5)]'
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

            {/* Direct Arrow Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => moveParagraphsToColumn('left')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80'
                    : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                }`}
                title="Send highlighted paragraphs to Left: காட்சி (Visual/Action) [ArrowLeft]"
              >
                <ArrowLeft size={13} className="stroke-[2.5]" />
                <span>Left: காட்சி</span>
              </button>

              <button
                onClick={() => moveParagraphsToColumn('center')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700'
                }`}
                title="Send highlighted paragraphs to Center: தலைப்பு (Heading/Transition) [ArrowUp / C]"
              >
                <Minus size={13} className="stroke-[2.5]" />
                <span>Center</span>
              </button>

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
                }}
                className={`relative shadow-2xl rounded-xs transition-all border flex flex-col justify-between ${
                  isLight
                    ? 'bg-white text-zinc-900 border-slate-300'
                    : 'bg-[#18181c] text-zinc-100 border-zinc-800'
                }`}
              >
                {/* 2. On Page 1: Column Header Banner */}
                {page.pageNumber === 1 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `${layoutOptions.columnSplitPercent}% ${100 - layoutOptions.columnSplitPercent}%`,
                      gap: '24px',
                    }}
                    className="pb-2 mb-4 border-b-2 border-emerald-500/40 text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400"
                  >
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>காட்சி விவரம் (Visual Action)</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-sky-400">
                      <span>வசனம் & ஒலி (Dialogue & Audio)</span>
                      <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                    </div>
                  </div>
                )}

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

                    return (
                      <div
                        key={item.id}
                        onClick={(e) => handleParagraphClick(item.id, e)}
                        style={{ marginBottom: `${layoutOptions.gapParagraphRowPx}px` }}
                        className={`group relative rounded-lg p-2 transition-all cursor-pointer border ${
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
                          className={`absolute -left-2.5 top-2.5 z-10 w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-black border border-amber-400 shadow-xs opacity-100 scale-105'
                              : 'opacity-0 group-hover:opacity-100 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-400 border border-zinc-600/60'
                          }`}
                          title={isSelected ? "Deselect paragraph" : "Click to select paragraph (Cmd+Click to multi-select)"}
                        >
                          {isSelected ? <Check size={11} className="stroke-[3]" /> : <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />}
                        </button>

                        {/* Hover Quick Arrows & Actions */}
                        <div className="absolute -top-3.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center gap-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-1.5 py-0.5 shadow-lg">
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

                          <div className="w-[1px] h-3 bg-zinc-700 mx-0.5" />

                          <button
                            onClick={(e) => handleDeleteItem(item.id, e)}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                            title="Delete paragraph"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>

                        {/* CASE B1: Center Text (Transition / Slugline) */}
                        {isCenter && (
                          <div className="w-full text-center py-2 px-4 rounded font-bold text-amber-400">
                            {layoutOptions.transitionStyle === 'tracking' ? (
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => handleUpdateItemText(item.id, e.currentTarget.innerText)}
                                onClick={(e) => {
                                  if (e.metaKey || e.ctrlKey) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleParagraphClick(item.id, e);
                                    return;
                                  }
                                  e.stopPropagation();
                                }}
                                className="outline-none uppercase tracking-widest text-sm"
                              >
                                {item.rawText || item.leftAction || item.rightDialogue || 'காட்சி மாற்றம்'}
                              </span>
                            ) : layoutOptions.transitionStyle === 'dashed' ? (
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => handleUpdateItemText(item.id, e.currentTarget.innerText)}
                                onClick={(e) => {
                                  if (e.metaKey || e.ctrlKey) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleParagraphClick(item.id, e);
                                    return;
                                  }
                                  e.stopPropagation();
                                }}
                                className="outline-none font-mono text-xs text-zinc-400"
                              >
                                ---- {item.rawText || item.leftAction || item.rightDialogue || 'காட்சி மாற்றம்'} ----
                              </span>
                            ) : layoutOptions.transitionStyle === 'pill' ? (
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => handleUpdateItemText(item.id, e.currentTarget.innerText)}
                                onClick={(e) => {
                                  if (e.metaKey || e.ctrlKey) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleParagraphClick(item.id, e);
                                    return;
                                  }
                                  e.stopPropagation();
                                }}
                                className="outline-none inline-block px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-xs"
                              >
                                {item.rawText || item.leftAction || item.rightDialogue || 'காட்சி மாற்றம்'}
                              </span>
                            ) : (
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => handleUpdateItemText(item.id, e.currentTarget.innerText)}
                                onClick={(e) => {
                                  if (e.metaKey || e.ctrlKey) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleParagraphClick(item.id, e);
                                    return;
                                  }
                                  e.stopPropagation();
                                }}
                                className="outline-none italic font-serif text-sm text-amber-300"
                              >
                                {item.rawText || item.leftAction || item.rightDialogue || 'காட்சி மாற்றம்'}
                              </span>
                            )}
                          </div>
                        )}

                        {/* CASE B2: Two-Column Row (Left Action vs Right Dialogue) */}
                        {!isCenter && (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: `${layoutOptions.columnSplitPercent}% ${100 - layoutOptions.columnSplitPercent}%`,
                              gap: '24px',
                            }}
                            className="items-start relative"
                          >
                            {/* Optional center hairline divider */}
                            {layoutOptions.showDivider && (
                              <div
                                style={{
                                  left: `${layoutOptions.columnSplitPercent}%`,
                                  borderRightStyle: layoutOptions.dividerStyle === 'dashed' ? 'dashed' : 'solid',
                                }}
                                className="absolute inset-y-0 w-0 -translate-x-1/2 border-r border-zinc-300/40 dark:border-zinc-800/60 pointer-events-none"
                              />
                            )}

                            {/* Left Column: Visual Action OR Right-Aligned Character Name */}
                            <div className="min-h-[26px] pr-3 flex flex-col justify-start">
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

                                  return (
                                    /* Dialogue Row: Character Name on Left Side, Right-Aligned ending with ":" */
                                    <div data-char-container={item.id} className="w-full flex items-start justify-end gap-1 pt-0.5">
                                      <ScriptCharacterInput
                                        value={char || ''}
                                        suggestions={allKnownCharacters}
                                        onChange={(val) => handleUpdateItemCharacter(item.id, val)}
                                        placeholder="கதாபாத்திரம்"
                                        style={{ color: layoutOptions.characterColor || '#0284c7' }}
                                        className="text-xs font-black uppercase text-right bg-transparent border-b border-transparent hover:border-zinc-500 focus:border-sky-400 outline-none w-auto min-w-[70px] max-w-[240px] transition-colors"
                                      />
                                      <span
                                        style={{ color: layoutOptions.characterColor || '#0284c7' }}
                                        className="font-bold text-xs select-none"
                                      >
                                        :
                                      </span>
                                    </div>
                                  );
                                })()
                              ) : isLeft ? (
                                /* Action Row: Visual Action Left-Aligned / Justified */
                                <div
                                  data-item-id={item.id}
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => handleUpdateItemText(item.id, e.currentTarget.innerText)}
                                  onKeyDown={(e) => {
                                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                      e.preventDefault();
                                      if (e.shiftKey) {
                                        handleAddParagraphAbove(item.id, 'left');
                                      } else {
                                        handleAddParagraphBelow(item.id, 'left');
                                      }
                                      return;
                                    }
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      const sel = window.getSelection();
                                      let offset = -1;
                                      if (sel && sel.rangeCount > 0) {
                                        const range = sel.getRangeAt(0);
                                        const preCaretRange = range.cloneRange();
                                        preCaretRange.selectNodeContents(e.currentTarget);
                                        preCaretRange.setEnd(range.endContainer, range.endOffset);
                                        offset = preCaretRange.toString().length;
                                      }
                                      setSelectedItemIds(new Set());
                                      handleSplitParagraph(item.id, offset >= 0 ? offset : undefined, e.currentTarget.innerText);
                                    }
                                  }}
                                  onClick={(e) => {
                                    // 1. Cmd / Ctrl + Click: Multi-select block!
                                    if (e.metaKey || e.ctrlKey) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleParagraphClick(item.id, e);
                                      return;
                                    }
                                    // 2. Alt / Option + Click: Split into separate shot!
                                    if (e.altKey) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const offset = getCaretOffsetFromPoint(e.nativeEvent, e.currentTarget);
                                      setSelectedItemIds(new Set());
                                      handleSplitParagraph(item.id, offset, e.currentTarget.innerText);
                                      return;
                                    }
                                    // 3. Normal typing/editing click: Stop propagation so card is NOT selected!
                                    e.stopPropagation();
                                  }}
                                  className={`min-h-[28px] text-justify leading-relaxed outline-none focus:ring-1 focus:ring-emerald-500/50 rounded p-1 transition-all ${
                                    !item.leftAction && !item.rawText
                                      ? 'border border-dashed border-emerald-500/40 bg-emerald-500/[0.04]'
                                      : ''
                                  }`}
                                  title="Type to edit. Press Enter or Alt+Click to split this shot into a new line ending with ' -'"
                                >
                                  {item.leftAction || item.rawText || ''}
                                </div>
                              ) : null}
                            </div>

                            {/* Right Column: Dialogue starts exactly next to the character name */}
                            <div className="min-h-[26px] pl-3 flex flex-col justify-start">
                              {isRight ? (
                                (() => {
                                  let char = (item.rightCharacter || '').trim();
                                  let text = (item.rightDialogue || item.rawText || '').trim();
                                  if (!char && text) {
                                    const m = text.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
                                    if (m) {
                                      text = m[2].trim();
                                    }
                                  }

                                  return (
                                    <div
                                      data-item-id={item.id}
                                      contentEditable
                                      suppressContentEditableWarning
                                      onBlur={(e) => handleUpdateItemText(item.id, e.currentTarget.innerText)}
                                      onKeyDown={(e) => {
                                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                          e.preventDefault();
                                          if (e.shiftKey) {
                                            handleAddParagraphAbove(item.id, 'right');
                                          } else {
                                            handleAddParagraphBelow(item.id, 'right');
                                          }
                                          return;
                                        }
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault();
                                          const sel = window.getSelection();
                                          let offset = -1;
                                          if (sel && sel.rangeCount > 0) {
                                            const range = sel.getRangeAt(0);
                                            const preCaretRange = range.cloneRange();
                                            preCaretRange.selectNodeContents(e.currentTarget);
                                            preCaretRange.setEnd(range.endContainer, range.endOffset);
                                            offset = preCaretRange.toString().length;
                                          }
                                          setSelectedItemIds(new Set());
                                          handleSplitParagraph(item.id, offset >= 0 ? offset : undefined, e.currentTarget.innerText);
                                        }
                                      }}
                                      onClick={(e) => {
                                        // 1. Cmd / Ctrl + Click: Multi-select block!
                                        if (e.metaKey || e.ctrlKey) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleParagraphClick(item.id, e);
                                          return;
                                        }
                                        // 2. Alt / Option + Click: Split dialogue!
                                        if (e.altKey) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const offset = getCaretOffsetFromPoint(e.nativeEvent, e.currentTarget);
                                          setSelectedItemIds(new Set());
                                          handleSplitParagraph(item.id, offset, e.currentTarget.innerText);
                                          return;
                                        }
                                        // 3. Normal typing/editing click: Stop propagation so card is NOT selected!
                                        e.stopPropagation();
                                      }}
                                      className={`min-h-[28px] leading-relaxed outline-none focus:ring-1 focus:ring-sky-500/50 rounded p-1 text-left transition-all ${
                                        !text
                                          ? 'border border-dashed border-sky-500/40 bg-sky-500/[0.04]'
                                          : ''
                                      }`}
                                      title="Type to edit. Press Enter or Alt+Click to split this dialogue"
                                    >
                                      {text}
                                    </div>
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

                {/* 3.5. Continues to Next Page Indicator (Exact match from user diagram) */}
                {page.continuesToNextPage && (
                  <div className="pt-3 pb-1 text-center select-none">
                    <span className="text-xs font-bold font-mono tracking-widest text-sky-600 dark:text-sky-400">
                      - Continues -
                    </span>
                  </div>
                )}

                {/* 4. Page Running Bottom Footer */}
                <div className="flex justify-between items-center text-[10px] text-zinc-400 pt-3 mt-4 border-t border-zinc-200 dark:border-zinc-800 font-mono">
                  <span>Backstage Story Sequencer &bull; Confidential</span>
                  <span className="font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 truncate max-w-[280px] text-center">
                    {activeDoc?.title || screenplayData.title || 'Screenplay'}
                  </span>
                  <span>Page {page.pageNumber} of {page.totalPages}</span>
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
            isLight ? 'bg-white border-slate-200' : 'bg-[#141419] border-zinc-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-700/50">
              <div className="flex items-center gap-2">
                <Sliders size={15} className="text-[#f5a623]" />
                <h3 className="text-sm font-bold">Format & Style Studio</h3>
              </div>
              <button
                onClick={() => setIsStyleDrawerOpen(false)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            {/* 1. Paper Standard */}
            <div className="space-y-2">
              <label className="text-xs font-bold font-mono uppercase text-zinc-400">
                Paper Standard
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['A4', 'US_Letter', 'Legal'] as PaperStandard[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setLayoutOptions((prev) => ({ ...prev, paperStandard: p }))}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all ${
                      layoutOptions.paperStandard === p
                        ? 'bg-[#f5a623] text-black border-[#f5a623] shadow-xs'
                        : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    {p === 'US_Letter' ? 'Letter' : p}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">
                {paper.desc}
              </p>
            </div>

            {/* 2. Margins (mm) */}
            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold font-mono uppercase text-zinc-400">
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
                  className="text-[10px] text-[#f5a623] hover:underline"
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
                  className="p-1 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
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
                  className="p-1 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
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
                  className="p-1 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
                >
                  Wide 32mm
                </button>
              </div>

              {/* Sliders for Top/Bottom & Left/Right */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-zinc-300">
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
                <div className="flex justify-between text-xs font-mono text-zinc-300">
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
            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <label className="text-xs font-bold font-mono uppercase text-zinc-400">
                Gaps & Proportions
              </label>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-zinc-300">
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
                <div className="flex justify-between text-xs font-mono text-zinc-300">
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
                <div className="flex justify-between text-xs font-mono text-zinc-300">
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
            </div>

            {/* 4. Base Typography */}
            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <label className="text-xs font-bold font-mono uppercase text-zinc-400">
                Typography
              </label>

              <div className="space-y-1">
                <span className="text-[11px] text-zinc-400 font-mono">Font Family:</span>
                <select
                  value={layoutOptions.baseFontFamily}
                  onChange={(e) => setLayoutOptions((prev) => ({ ...prev, baseFontFamily: e.target.value }))}
                  className="w-full text-xs rounded-lg p-2 bg-zinc-900 border border-zinc-700 text-zinc-200 outline-none"
                >
                  <option value="'Vijaya', 'Latha', sans-serif">Vijaya (Kollywood Classic)</option>
                  <option value="'Latha', sans-serif">Latha (Tamil Standard)</option>
                  <option value="'Mukta Malar', sans-serif">Mukta Malar (Clean Modern)</option>
                  <option value="'Noto Sans Tamil', sans-serif">Noto Sans Tamil</option>
                  <option value="'Courier Prime', monospace">Courier Prime (Monospace)</option>
                  <option value="'Inter', sans-serif">Inter (Modern Sans)</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-zinc-300">
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
                <div className="flex justify-between text-xs font-mono text-zinc-300">
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
                <div className="flex justify-between text-xs font-mono text-zinc-300">
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

            {/* 5. Scene Heading Style */}
            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <label className="text-xs font-bold font-mono uppercase text-zinc-400">
                Scene Heading Style
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['kollywood', 'card', 'typewriter', 'underline', 'boxed'] as SceneHeadingStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => setLayoutOptions((prev) => ({ ...prev, sceneHeadingStyle: style }))}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg border capitalize transition-all ${
                      layoutOptions.sceneHeadingStyle === style
                        ? 'bg-emerald-500 text-black border-emerald-500 shadow-xs'
                        : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                    } ${style === 'kollywood' ? 'col-span-2 text-center' : ''}`}
                  >
                    {style === 'kollywood' ? '🎬 Kollywood 3-Line (Official)' : style}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Center / Transition Style */}
            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <label className="text-xs font-bold font-mono uppercase text-zinc-400">
                Center / Transition Style
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['tracking', 'dashed', 'pill', 'italic'] as TransitionStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => setLayoutOptions((prev) => ({ ...prev, transitionStyle: style }))}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg border capitalize transition-all ${
                      layoutOptions.transitionStyle === style
                        ? 'bg-amber-500 text-black border-amber-500 shadow-xs'
                        : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* 7. Column Divider Style */}
            <div className="space-y-2 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold font-mono uppercase text-zinc-400">
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
                    className={`py-1 px-2 text-xs font-bold rounded-lg border ${
                      layoutOptions.dividerStyle === 'dashed'
                        ? 'bg-zinc-700 text-white border-zinc-500'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    Dashed
                  </button>
                  <button
                    onClick={() => setLayoutOptions((prev) => ({ ...prev, dividerStyle: 'hairline' }))}
                    className={`py-1 px-2 text-xs font-bold rounded-lg border ${
                      layoutOptions.dividerStyle === 'hairline'
                        ? 'bg-zinc-700 text-white border-zinc-500'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    Hairline
                  </button>
                </div>
              )}
            </div>

            {/* 8. Fresh Page per Scene */}
            <div className="space-y-2 pt-3 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold font-mono uppercase text-zinc-300">
                    Fresh Page Per Scene
                  </div>
                  <div className="text-[10px] text-zinc-500">
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
          </aside>
        )}
      </div>
      
      {/* Dedicated 2-Column Script PDF Export & Print Studio Modal */}
      <TwoColumnExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        screenplayData={screenplayData}
        isLight={isLight}
      />
    </div>
  );
};
