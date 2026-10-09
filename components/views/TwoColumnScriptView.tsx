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
  const handleUpdateItemAlignment = (align: 'left' | 'center' | 'right' | 'justify') => {
    if (selectedItemIds.size > 0) {
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
  };

  // Set alignment for a single item
  const handleSetSingleItemAlignment = (
    itemId: string,
    align: 'left' | 'center' | 'right' | 'justify',
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((sc) => ({
        ...sc,
        items: sc.items.map((it) => (it.id === itemId ? { ...it, textAlign: align } : it)),
      })),
    }));
    setHasUnsavedChanges(true);
  };

  // Direct text color update for single or selected paragraphs
  const handleUpdateItemColor = (itemIds: Set<string> | string, color?: string) => {
    const ids = typeof itemIds === 'string' ? new Set([itemIds]) : itemIds;
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
    if (itemId.startsWith('auto-cut-to-')) {
      showToast('Tip: You can turn off "Auto CUT TO at End of Scene" in the Style Drawer.');
      return;
    }
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

  // Permanently bake CUT TO transition into all scenes that don't have one
  const handleApplyCutToToAllScenes = () => {
    let addedCount = 0;
    const transitionText = layoutOptions.endSceneCutToText || 'CUT TO:';
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

  // Save changes to Vault (immediate or debounced auto-save)
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

    const nextList = documents.map((d) => (d.id === updated.id ? updated : d));
    setDocuments(nextList);
    saveProductionDocuments(nextList);
    setHasUnsavedChanges(false);
    setIsAutoSaving(false);
    setLastSavedAt(new Date());

    if (isManual) {
      confetti({ particleCount: 25, spread: 50, origin: { y: 0.8 } });
      showToast('✓ Saved 2-Column Screenplay to Vault!');
    }
  }, [activeDoc, screenplayData, documents]);

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
      <header className={`px-5 py-2.5 border-b flex items-center justify-between gap-4 shrink-0 shadow-sm z-30 overflow-x-auto ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#121217] border-zinc-800 text-zinc-100'
      }`}>
        {/* Left: Studio Brand & Script Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded-lg border ${
              isLight
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}>
              <Columns size={16} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black uppercase tracking-wider ${
                  isLight ? 'text-emerald-700' : 'text-emerald-400'
                }`}>
                  Kollywood 2-Column
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                  isLight
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : 'bg-zinc-800 text-zinc-400 border-transparent'
                }`}>
                  {totalPages} {totalPages === 1 ? 'Page' : 'Pages'}
                </span>
              </div>
              <h1 className="text-sm font-bold truncate max-w-xs sm:max-w-sm">
                {screenplayData.title || activeDoc?.title}
              </h1>
            </div>
          </div>

          <div className={`w-[1px] h-5 mx-1 hidden sm:block ${isLight ? 'bg-slate-200' : 'bg-zinc-700/60'}`} />

          {/* Scenes Sidebar Toggle */}
          <button
            onClick={() => setIsSceneSidebarOpen(!isSceneSidebarOpen)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              isSceneSidebarOpen
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/20'
                : isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
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
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
            }`}
            title="Advanced Find & Replace in script (Cmd+F / Ctrl+F)"
          >
            <Search size={13} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
            <span>Find</span>
            <span className={`hidden xl:inline text-[9.5px] font-mono px-1 py-0.2 rounded border ${
              isLight
                ? 'bg-white text-slate-600 border-slate-300'
                : 'bg-black/40 text-zinc-400 border-zinc-700'
            }`}>⌘F</span>
          </button>
        </div>

        {/* Right: Zoom controls, Style Studio Drawer Toggle & Export Actions */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className={`flex items-center gap-1 border rounded-lg p-0.5 ${
            isLight ? 'bg-slate-100 border-slate-300' : 'bg-zinc-900 border-zinc-800'
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
            <span className={`text-[11px] font-mono px-1 ${
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

          <div className={`w-[1px] h-5 mx-1 hidden sm:block ${isLight ? 'bg-slate-200' : 'bg-zinc-700/60'}`} />

          {/* Text Alignment Controls (2-Column Page: Left, Center, Right, Justify) */}
          <div
            className={`flex items-center gap-0.5 border rounded-lg p-0.5 ${
              isLight ? 'bg-slate-100 border-slate-300' : 'bg-zinc-900 border-zinc-800'
            }`}
            title="Alignment: Left, Center, Right, Justify"
          >
            <button
              onClick={() => handleUpdateItemAlignment('left')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Align Left (Selected paragraphs or Column Default)"
            >
              <AlignLeft size={13} />
            </button>
            <button
              onClick={() => handleUpdateItemAlignment('center')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Align Center (Selected paragraphs or Column Default)"
            >
              <AlignCenter size={13} />
            </button>
            <button
              onClick={() => handleUpdateItemAlignment('right')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Align Right (Selected paragraphs or Column Default)"
            >
              <AlignRight size={13} />
            </button>
            <button
              onClick={() => handleUpdateItemAlignment('justify')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Justify (Selected paragraphs or Column Default)"
            >
              <AlignJustify size={13} />
            </button>
          </div>

          <div className={`w-[1px] h-5 mx-1 hidden sm:block ${isLight ? 'bg-slate-200' : 'bg-zinc-700/60'}`} />
          {/* Format & Style Drawer Toggle */}
          <button
            onClick={() => setIsStyleDrawerOpen(!isStyleDrawerOpen)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
              isStyleDrawerOpen
                ? 'bg-[#f5a623] text-black border-[#f5a623]'
                : isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
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

          {/* Live Auto-Save Status & Manual Save Button */}
          <button
            onClick={() => saveToVault(true)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              isAutoSaving
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                : hasUnsavedChanges
                ? 'bg-[#f5a623] hover:bg-amber-400 text-black shadow-xs'
                : isLight
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
            }`}
            title={
              isAutoSaving
                ? 'Auto-saving changes to Vault in background...'
                : hasUnsavedChanges
                ? 'Changes detected (auto-saving in ~1.5s or click to save now)'
                : `Live-saved to Vault (${lastSavedAt ? lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'})`
            }
          >
            {isAutoSaving ? (
              <>
                <Loader2 size={13} className="animate-spin text-amber-500" />
                <span>Auto-saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <Save size={13} />
                <span>Save</span>
              </>
            ) : (
              <>
                <Check size={13} className="stroke-[3] text-emerald-600 dark:text-emerald-400" />
                <span>Saved</span>
              </>
            )}
          </button>

          {/* Print (Native Browser Vector Print Engine) */}
          <button
            onClick={() => printTwoColumnVector(screenplayData)}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer border ${
              isLight
                ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-300'
                : 'hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700/60'
            }`}
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

            {/* Direct Alignment for Highlighted Paragraphs */}
            <div className={`flex items-center gap-0.5 border rounded-xl p-0.5 ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-zinc-700/60'
            }`}>
              <button
                onClick={() => handleUpdateItemAlignment('left')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
                title="Align Left for highlighted paragraphs"
              >
                <AlignLeft size={12} />
              </button>
              <button
                onClick={() => handleUpdateItemAlignment('center')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
                title="Align Center for highlighted paragraphs"
              >
                <AlignCenter size={12} />
              </button>
              <button
                onClick={() => handleUpdateItemAlignment('right')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
                title="Align Right for highlighted paragraphs"
              >
                <AlignRight size={12} />
              </button>
              <button
                onClick={() => handleUpdateItemAlignment('justify')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
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
                className={`px-2 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    : 'bg-black/40 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-700/60'
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
                      <div
                        key={item.id}
                        id={`script-row-${item.id}`}
                        data-item-row-id={item.id}
                        className="relative group/row"
                        style={{ marginBottom: `${layoutOptions.gapParagraphRowPx}px` }}
                        onDragOver={(e) => {
                          if (!draggedItemId || draggedItemId === item.id) return;
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                          const rect = e.currentTarget.getBoundingClientRect();
                          const midY = rect.top + rect.height / 2;
                          const pos = e.clientY < midY ? 'above' : 'below';
                          if (dragOverTarget?.itemId !== item.id || dragOverTarget?.position !== pos) {
                            setDragOverTarget({ itemId: item.id, position: pos });
                          }
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (
                            e.clientY < rect.top ||
                            e.clientY >= rect.bottom ||
                            e.clientX < rect.left ||
                            e.clientX >= rect.right
                          ) {
                            if (dragOverTarget?.itemId === item.id) {
                              setDragOverTarget(null);
                            }
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const sourceId = draggedItemId || e.dataTransfer.getData('text/plain');
                          if (sourceId && sourceId !== item.id && dragOverTarget) {
                            handleMoveScriptItem(sourceId, item.id, dragOverTarget.position);
                          }
                          setDraggedItemId(null);
                          setDragOverTarget(null);
                        }}
                      >
                        {/* Drag landing line indicator above */}
                        {dragOverTarget?.itemId === item.id && dragOverTarget.position === 'above' && (
                          <div className="absolute -top-1.5 inset-x-0 h-1 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50 z-35 pointer-events-none flex items-center justify-between px-1 animate-pulse">
                            <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-emerald-500 shadow-sm" />
                            <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-emerald-500 shadow-sm" />
                          </div>
                        )}

                        {/* In-Between Above: Only for the very first item in the scene */}
                        {isFirstItemInScene && (
                          <div
                            className="group/inbetween absolute -top-3 inset-x-0 h-6 z-20 flex items-center justify-between opacity-0 hover:opacity-100 group-hover/row:opacity-100 transition-opacity"
                          >
                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0 border-t border-dashed border-slate-300/35 dark:border-zinc-700/35 opacity-0 group-hover/inbetween:opacity-100 transition-opacity pointer-events-none" />

                            {/* Left Half (Action) */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddParagraphAbove(item.id, 'left');
                              }}
                              style={{ width: `${layoutOptions.columnSplitPercent}%` }}
                              className="h-full flex items-center justify-start pl-2 cursor-pointer relative"
                              title="Insert Action box (காட்சி) above"
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddParagraphAbove(item.id, 'left');
                                }}
                                className={`absolute -left-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center opacity-0 group-hover/row:opacity-60 group-hover/inbetween:opacity-100 hover:!opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                                  isLight
                                    ? 'bg-white hover:bg-emerald-600 hover:text-white text-slate-700 border-slate-300 hover:border-emerald-600 shadow-slate-200'
                                    : 'bg-zinc-900 hover:bg-emerald-500 hover:text-black text-zinc-300 border-zinc-700 hover:border-emerald-400'
                                }`}
                                title="Insert Action box (காட்சி) above"
                              >
                                <Plus size={13} className="stroke-[2.5]" />
                              </button>
                            </div>

                            {/* Right Half (Dialogue) */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddParagraphAbove(item.id, 'right');
                              }}
                              style={{ width: `${100 - layoutOptions.columnSplitPercent}%` }}
                              className="h-full flex items-center justify-end pr-2 cursor-pointer relative"
                              title="Insert Dialogue box (வசனம்) above"
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddParagraphAbove(item.id, 'right');
                                }}
                                className={`absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center opacity-0 group-hover/row:opacity-60 group-hover/inbetween:opacity-100 hover:!opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                                  isLight
                                    ? 'bg-white hover:bg-sky-600 hover:text-white text-slate-700 border-slate-300 hover:border-sky-600 shadow-slate-200'
                                    : 'bg-zinc-900 hover:bg-sky-500 hover:text-black text-zinc-300 border-zinc-700 hover:border-sky-400'
                                }`}
                                title="Insert Dialogue box (வசனம்) above"
                              >
                                <Plus size={13} className="stroke-[2.5]" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* The Box Card itself */}
                        <div
                          onClick={(e) => handleParagraphClick(item.id, e)}
                          className={`group relative rounded-lg p-2 transition-all cursor-pointer border ${
                          draggedItemId === item.id
                            ? 'opacity-35 scale-[0.99] ring-2 ring-emerald-500/50 shadow-xl border-emerald-500/50'
                            : isSelected
                            ? isLight
                              ? 'bg-amber-500/[0.06] border-amber-400/50 shadow-xs'
                              : 'bg-amber-500/[0.09] border-amber-500/40 shadow-xs'
                            : isLight
                            ? 'hover:bg-slate-50/70 border-transparent hover:border-slate-200'
                            : 'hover:bg-zinc-800/40 border-transparent hover:border-zinc-800'
                        }`}
                      >
                        {/* Drag Handle (Grip) for reordering up and down */}
                        <div
                          draggable={true}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', item.id);
                            setDraggedItemId(item.id);
                          }}
                          onDragEnd={() => {
                            setDraggedItemId(null);
                            setDragOverTarget(null);
                          }}
                          className={`absolute -left-7 top-1/2 -translate-y-1/2 z-25 w-5 h-7 rounded flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all cursor-grab active:cursor-grabbing hover:scale-110 ${
                            isLight
                              ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-200/70'
                              : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                          }`}
                          title="Click & drag up or down to reorder"
                        >
                          <GripVertical size={14} className="stroke-[2.2]" />
                        </div>

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
                              : isLight
                              ? 'opacity-0 group-hover:opacity-100 bg-white hover:bg-slate-100 text-slate-500 border border-slate-300 shadow-xs'
                              : 'opacity-0 group-hover:opacity-100 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-400 border border-zinc-600/60'
                          }`}
                          title={isSelected ? "Deselect paragraph" : "Click to select paragraph (Cmd+Click to multi-select)"}
                        >
                          {isSelected ? <Check size={11} className="stroke-[3]" /> : <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-slate-400' : 'bg-zinc-400'}`} />}
                        </button>

                        {/* Hover Quick Action Toolbar (Dead Center in the Middle above Vertical Gutter) */}
                        <div className={`absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all z-30 flex items-center gap-1 border rounded-xl px-1.5 py-0.5 shadow-xl backdrop-blur-xs ${
                          isLight
                            ? 'bg-white/95 text-slate-700 border-slate-200/90 shadow-[0_8px_25px_rgba(0,0,0,0.12)]'
                            : 'bg-zinc-950/95 dark:bg-zinc-900 border-zinc-700/90 text-zinc-100'
                        }`}>
                          {/* 1. Alignment */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const current = item.textAlign || (isLeft ? (layoutOptions.actionTextAlign || 'justify') : (layoutOptions.dialogueTextAlign || 'left'));
                              const next = current === 'left' ? 'center' : current === 'center' ? 'right' : current === 'right' ? 'justify' : 'left';
                              handleSetSingleItemAlignment(item.id, next, e);
                              showToast(`✓ Aligned: ${next}`);
                            }}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isLight ? 'text-slate-500 hover:text-amber-600 hover:bg-slate-100' : 'text-zinc-400 hover:text-amber-400'
                            }`}
                            title={`Alignment: ${item.textAlign || 'default'} (Click to cycle Left -> Center -> Right -> Justify)`}
                          >
                            {(item.textAlign || (isLeft ? layoutOptions.actionTextAlign : layoutOptions.dialogueTextAlign)) === 'center' ? (
                              <AlignCenter size={11} />
                            ) : (item.textAlign || (isLeft ? layoutOptions.actionTextAlign : layoutOptions.dialogueTextAlign)) === 'right' ? (
                              <AlignRight size={11} />
                            ) : (item.textAlign || (isLeft ? layoutOptions.actionTextAlign : layoutOptions.dialogueTextAlign)) === 'left' ? (
                              <AlignLeft size={11} />
                            ) : (
                              <AlignJustify size={11} />
                            )}
                          </button>

                          <div className={`w-[1px] h-3 mx-0.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-700/80'}`} />

                          {/* 2. Leftside jumper */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveParagraphsToColumn('left', item.id);
                            }}
                            className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                              isLeft
                                ? 'bg-emerald-500 text-white shadow-xs'
                                : isLight
                                ? 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100'
                                : 'text-zinc-400 hover:text-emerald-400'
                            }`}
                            title="Move to Left: காட்சி (Visual Action)"
                          >
                            <ArrowLeft size={11} className="stroke-[3]" />
                          </button>

                          {/* 3. Center jumper */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveParagraphsToColumn('center', item.id);
                            }}
                            className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                              isCenter
                                ? 'bg-amber-500 text-black shadow-xs'
                                : isLight
                                ? 'text-slate-500 hover:text-amber-600 hover:bg-slate-100'
                                : 'text-zinc-400 hover:text-amber-400'
                            }`}
                            title="Move to Center: தலைப்பு / Transition"
                          >
                            <Minus size={11} className="stroke-[3]" />
                          </button>

                          {/* 4. Right side jumper */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveParagraphsToColumn('right', item.id);
                            }}
                            className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                              isRight
                                ? 'bg-sky-500 text-white shadow-xs'
                                : isLight
                                ? 'text-slate-500 hover:text-sky-600 hover:bg-slate-100'
                                : 'text-zinc-400 hover:text-sky-400'
                            }`}
                            title="Move to Right: வசனம் (Dialogue)"
                          >
                            <ArrowRight size={11} className="stroke-[3]" />
                          </button>

                          <div className={`w-[1px] h-3 mx-0.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-700/80'}`} />

                          {/* 5. Selected paragraph text color changer */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setColorPickerItemId(colorPickerItemId === item.id ? null : item.id);
                              }}
                              className={`p-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-0.5 ${
                                item.textColor
                                  ? 'text-amber-500 font-bold'
                                  : isLight
                                  ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              }`}
                              title={item.textColor ? `Text Color: ${item.textColor}` : 'Change text color'}
                            >
                              <Palette size={11} />
                              {item.textColor && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full border border-black/40"
                                  style={{ backgroundColor: item.textColor }}
                                />
                              )}
                            </button>

                            {/* Mini popover for essential colors */}
                            {colorPickerItemId === item.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 p-2 rounded-xl border shadow-2xl z-50 flex flex-col gap-1.5 min-w-[130px] ${
                                  isLight
                                    ? 'bg-white border-slate-200 text-slate-800 shadow-[0_12px_36px_rgba(0,0,0,0.15)]'
                                    : 'bg-zinc-950 border-zinc-700 text-zinc-100'
                                }`}
                              >
                                <div className={`flex items-center justify-between text-[10px] font-mono pb-1 border-b ${
                                  isLight ? 'text-slate-500 border-slate-200' : 'text-zinc-400 border-zinc-800'
                                }`}>
                                  <span>Text Color</span>
                                  {item.textColor && (
                                    <button
                                      onClick={() => {
                                        const targetIds = selectedItemIds.has(item.id) && selectedItemIds.size > 1 ? selectedItemIds : item.id;
                                        handleUpdateItemColor(targetIds, undefined);
                                        setColorPickerItemId(null);
                                      }}
                                      className="text-amber-500 hover:text-amber-600 cursor-pointer flex items-center gap-0.5"
                                      title="Reset to default color"
                                    >
                                      <RotateCcw size={9} />
                                      <span>Reset</span>
                                    </button>
                                  )}
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
                                        const targetIds = selectedItemIds.has(item.id) && selectedItemIds.size > 1 ? selectedItemIds : item.id;
                                        handleUpdateItemColor(targetIds, c.hex || undefined);
                                        setColorPickerItemId(null);
                                      }}
                                      style={{ backgroundColor: c.hex || (isLight ? '#0f172a' : '#f8fafc') }}
                                      className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 cursor-pointer flex items-center justify-center ${
                                        item.textColor === c.hex || (!item.textColor && !c.hex)
                                          ? 'border-white ring-2 ring-emerald-500/60 scale-105'
                                          : isLight
                                          ? 'border-slate-300'
                                          : 'border-zinc-700/60'
                                      }`}
                                      title={c.name}
                                    >
                                      {(!item.textColor && !c.hex) || item.textColor === c.hex ? (
                                        <Check size={9} className={c.hex ? 'text-white' : isLight ? 'text-white' : 'text-black'} />
                                      ) : null}
                                    </button>
                                  ))}
                                </div>
                                <div className={`flex items-center gap-1.5 pt-1 border-t ${
                                  isLight ? 'border-slate-200 text-slate-500' : 'border-zinc-800 text-zinc-400'
                                }`}>
                                  <span className="text-[10px] font-mono">Custom:</span>
                                  <input
                                    type="color"
                                    value={item.textColor || (isLight ? '#0f172a' : '#f8fafc')}
                                    onChange={(e) => {
                                      const targetIds = selectedItemIds.has(item.id) && selectedItemIds.size > 1 ? selectedItemIds : item.id;
                                      handleUpdateItemColor(targetIds, e.target.value);
                                    }}
                                    className="w-5 h-5 p-0 rounded border-0 bg-transparent cursor-pointer"
                                    title="Pick custom color"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className={`w-[1px] h-3 mx-0.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-700/80'}`} />

                          {/* 6. Delete */}
                          <button
                            onClick={(e) => handleDeleteItem(item.id, e)}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isLight ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-zinc-500 hover:text-red-400'
                            }`}
                            title="Delete paragraph"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>

                        {/* CASE B1: Center Text (Transition / Slugline) */}
                        {isCenter && (
                          <div
                            style={{ color: item.textColor || layoutOptions.transitionColor || '#f59e0b' }}
                            className="w-full text-center py-2 px-4 rounded font-bold"
                          >
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
                                style={{ color: item.textColor || layoutOptions.transitionColor || '#f59e0b' }}
                                className={`outline-none uppercase tracking-widest text-sm ${
                                  layoutOptions.transitionBold !== false ? 'font-black' : 'font-medium'
                                }`}
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
                                style={{ color: item.textColor || layoutOptions.transitionColor || '#f59e0b' }}
                                className={`outline-none font-mono text-xs ${
                                  layoutOptions.transitionBold !== false ? 'font-bold' : 'font-normal'
                                }`}
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
                                style={{
                                  color: item.textColor || layoutOptions.transitionColor || '#f59e0b',
                                  borderColor: `${item.textColor || layoutOptions.transitionColor || '#f59e0b'}60`,
                                  backgroundColor: `${item.textColor || layoutOptions.transitionColor || '#f59e0b'}15`,
                                }}
                                className={`outline-none inline-block px-3 py-1 rounded-full border text-xs ${
                                  layoutOptions.transitionBold !== false ? 'font-bold' : 'font-normal'
                                }`}
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
                                style={{ color: item.textColor || layoutOptions.transitionColor || '#f59e0b' }}
                                className={`outline-none italic font-serif text-sm ${
                                  layoutOptions.transitionBold !== false ? 'font-bold' : 'font-normal'
                                }`}
                              >
                                {item.rawText || item.leftAction || item.rightDialogue || 'காட்சி மாற்றம்'}
                              </span>
                            )}
                          </div>
                        )}

                        {/* CASE B2: Two-Column Row (Left Action vs Right Dialogue with Ample Gutter Separation) */}
                        {!isCenter && (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: `${layoutOptions.columnSplitPercent}% ${100 - layoutOptions.columnSplitPercent}%`,
                              gap: `${layoutOptions.columnGutterPx ?? 16}px`,
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
                            <div
                              style={{ paddingRight: `${Math.round((layoutOptions.columnGutterPx ?? 16) / 2)}px` }}
                              className="min-h-[26px] flex flex-col justify-start"
                            >
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
                                        onManageCharacters={() => setIsCharacterManagerOpen(true)}
                                        onNext={() => {
                                          const diaEl = document.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement;
                                          if (diaEl) {
                                            diaEl.focus();
                                          }
                                        }}
                                        placeholder="கதாபாத்திரம்"
                                        style={{ color: layoutOptions.characterColor || '#0284c7' }}
                                        className={`text-xs uppercase text-right bg-transparent border-b border-transparent hover:border-zinc-500 focus:border-sky-400 outline-none w-auto min-w-[70px] max-w-[240px] transition-colors ${
                                          layoutOptions.characterNameBold !== false ? 'font-black' : 'font-medium'
                                        }`}
                                      />
                                      <span
                                        style={{ color: layoutOptions.characterColor || '#0284c7' }}
                                        className={`text-xs select-none ${
                                          layoutOptions.characterNameBold !== false ? 'font-black' : 'font-medium'
                                        }`}
                                      >
                                        :
                                      </span>
                                    </div>
                                  );
                                })()
                              ) : isLeft ? (
                                /* Action Row: Visual Action with dynamic alignment (left/center/right/justify) */
                                (() => {
                                  const actionAlign = item.textAlign || layoutOptions.actionTextAlign || 'justify';
                                  const alignClass =
                                    actionAlign === 'left' ? 'text-left' :
                                    actionAlign === 'center' ? 'text-center' :
                                    actionAlign === 'right' ? 'text-right' : 'text-justify';

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
                                      style={{ textAlign: actionAlign, color: item.textColor || undefined }}
                                      className={`min-h-[28px] ${alignClass} leading-relaxed outline-none focus:ring-1 focus:ring-emerald-500/50 rounded p-1 transition-all ${
                                        !item.leftAction && !item.rawText
                                          ? 'border border-dashed border-emerald-500/40 bg-emerald-500/[0.04]'
                                          : ''
                                      }`}
                                      title="Type to edit. Press Enter or Alt+Click to split this shot into a new line ending with ' -'"
                                    >
                                      {item.leftAction || item.rawText || ''}
                                    </div>
                                  );
                                })()
                              ) : null}
                            </div>

                            {/* Right Column: Dialogue starts exactly next to the character name */}
                            <div
                              style={{ paddingLeft: `${Math.round((layoutOptions.columnGutterPx ?? 16) / 2)}px` }}
                              className="min-h-[26px] flex flex-col justify-start"
                            >
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

                                  const diaAlign = item.textAlign || layoutOptions.dialogueTextAlign || 'left';
                                  const alignClass =
                                    diaAlign === 'left' ? 'text-left' :
                                    diaAlign === 'center' ? 'text-center' :
                                    diaAlign === 'right' ? 'text-right' : 'text-justify';

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
                                      style={{ textAlign: diaAlign, color: item.textColor || undefined }}
                                      className={`min-h-[28px] leading-relaxed outline-none focus:ring-1 focus:ring-sky-500/50 rounded p-1 ${alignClass} transition-all ${
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

                        </div>

                        {/* Drag landing line indicator below */}
                        {dragOverTarget?.itemId === item.id && dragOverTarget.position === 'below' && (
                          <div className="absolute -bottom-1.5 inset-x-0 h-1 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50 z-35 pointer-events-none flex items-center justify-between px-1 animate-pulse">
                            <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-emerald-500 shadow-sm" />
                            <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-emerald-500 shadow-sm" />
                          </div>
                        )}

                        {/* In-Between Inserter Below: Simple '+' in-between the boxes */}
                        <div
                          className="group/inbetween absolute -bottom-3 inset-x-0 h-6 z-20 flex items-center justify-between opacity-0 hover:opacity-100 group-hover/row:opacity-100 transition-opacity"
                        >
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0 border-t border-dashed border-slate-300/35 dark:border-zinc-700/35 opacity-0 group-hover/inbetween:opacity-100 transition-opacity pointer-events-none" />

                          {/* Left Half (Action) */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddParagraphBelow(item.id, 'left');
                            }}
                            style={{ width: `${layoutOptions.columnSplitPercent}%` }}
                            className="h-full flex items-center justify-start pl-2 cursor-pointer relative"
                            title="Insert Action box (காட்சி) in-between"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddParagraphBelow(item.id, 'left');
                              }}
                              className={`absolute -left-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center opacity-0 group-hover/row:opacity-60 group-hover/inbetween:opacity-100 hover:!opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                                isLight
                                  ? 'bg-white hover:bg-emerald-600 hover:text-white text-slate-700 border-slate-300 hover:border-emerald-600 shadow-slate-200'
                                  : 'bg-zinc-900 hover:bg-emerald-500 hover:text-black text-zinc-300 border-zinc-700 hover:border-emerald-400'
                              }`}
                              title="Insert Action box (காட்சி) in-between"
                            >
                              <Plus size={13} className="stroke-[2.5]" />
                            </button>
                          </div>

                          {/* Right Half (Dialogue) */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddParagraphBelow(item.id, 'right');
                            }}
                            style={{ width: `${100 - layoutOptions.columnSplitPercent}%` }}
                            className="h-full flex items-center justify-end pr-2 cursor-pointer relative"
                            title="Insert Dialogue box (வசனம்) in-between"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddParagraphBelow(item.id, 'right');
                              }}
                              className={`absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center opacity-0 group-hover/row:opacity-60 group-hover/inbetween:opacity-100 hover:!opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                                isLight
                                  ? 'bg-white hover:bg-sky-600 hover:text-white text-slate-700 border-slate-300 hover:border-sky-600 shadow-slate-200'
                                  : 'bg-zinc-900 hover:bg-sky-500 hover:text-black text-zinc-300 border-zinc-700 hover:border-sky-400'
                              }`}
                              title="Insert Dialogue box (வசனம்) in-between"
                            >
                              <Plus size={13} className="stroke-[2.5]" />
                            </button>
                          </div>
                        </div>
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
    </div>
  );
};
