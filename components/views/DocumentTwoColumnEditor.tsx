import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Download,
  Save,
  Plus,
  Trash2,
  Scissors,
  Check,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Columns,
  RotateCcw,
  Layers,
  X,
  Edit2,
  FileText,
  Search,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';

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
  // Parse document content into Tamil screenplay structure
  const [screenplayData, setScreenplayData] = useState<TamilScreenplayData>(() => {
    const rawText = doc.textContent || (doc.htmlContent ? doc.htmlContent.replace(/<[^>]+>/g, '\n') : '');
    return parseScreenplayToTamilLeftRight(rawText, doc.title);
  });

  // Track highlighted/selected paragraph IDs
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

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

  const handleSelectScene = (sceneId: string) => {
    setActiveSceneId(sceneId);
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

    setScreenplayData((prev) => {
      const nextScenes = prev.scenes.map((scene) => ({
        ...scene,
        items: scene.items.map((item) => {
          if (idsToMove.has(item.id)) {
            // Determine text preservation
            let text = item.rawText || item.leftAction || item.rightDialogue || '';
            let char = item.rightCharacter || '';

            // If moving to right and text has "NAME: DIALOGUE" pattern, extract character
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

  // Update scene metadata
  const handleUpdateScene = (sceneId: string, updates: Partial<TamilScene>) => {
    setScreenplayData((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...updates } : scene)),
    }));
    setHasUnsavedChanges(true);
  };

  // Add a new paragraph above
  const handleAddParagraphAbove = (beforeItemId: string, column: 'left' | 'right' | 'center' = 'left') => {
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

  // Save changes back to document
  const handleSaveChanges = () => {
    const html = generateTamilLeftRightHtml(screenplayData);
    const updatedDoc: ProductionDocument = {
      ...doc,
      title: screenplayData.title || doc.title,
      htmlContent: html,
      isLeftRightFormat: true,
      lastModified: new Date().toISOString(),
    };

    if (onSave) {
      onSave(updatedDoc);
    }
    setHasUnsavedChanges(false);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
    showToast('✓ Saved document changes to Vault!');
  };

  const selectedCount = selectedItemIds.size;

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

        {/* Right: Actions (Scenes, Find, Zoom, Word Download & Save) */}
        <div className="flex items-center gap-2">
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
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="Download formatted 2-column Microsoft Word (.docx) file"
          >
            <Download size={13} />
            <span>{isGeneratingDocx ? 'Generating...' : 'Download Word (.docx)'}</span>
          </button>

          {/* Save Changes */}
          <button
            onClick={handleSaveChanges}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-[#f5a623] hover:bg-amber-400 text-black animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
            }`}
            title="Save changes to Backstage Vault"
          >
            <Save size={13} />
            <span>Save in Vault</span>
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

        <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center">
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
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
          <div className="grid grid-cols-2 gap-4 pb-2 mb-4 border-b-2 border-emerald-500/40 text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>இடது: காட்சி விவரம் (Visual Action)</span>
            </div>
            <div className="flex items-center justify-end gap-2 text-sky-400">
              <span>வலது: வசனம் & ஒலி (Dialogue & Audio)</span>
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            </div>
          </div>

          {/* =====================================================================
              SCENES & PARAGRAPH ROWS
             ===================================================================== */}
          <div className="space-y-6">
            {screenplayData.scenes.map((scene, sceneIndex) => {
              const chars = getSceneCharacters(scene);
              const effects = getSceneEffects(scene);

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
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
                        {/* Left: Script Location (wraps naturally, no ellipsis cutoff) */}
                        <div className="text-left leading-tight min-w-0">
                          <span className="font-bold mr-1.5 inline">Script Location:</span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleUpdateScene(scene.id, { location: e.currentTarget.innerText.trim() })}
                            className="outline-none hover:bg-emerald-500/10 px-0.5 rounded font-medium break-words inline"
                            title="Click to edit script location"
                          >
                            {scene.location || 'xyz'}
                          </span>
                        </div>

                        {/* Center: Box for Scene Pages (Wireframe Boxed Pill) */}
                        <div className="px-3 py-0.5 rounded-lg border border-black dark:border-zinc-300 text-center font-bold text-[11px] tracking-wide shadow-2xs select-none whitespace-nowrap justify-self-center">
                          Pages: 1/1
                        </div>

                        {/* Right: Real Location (wraps naturally, no ellipsis cutoff) */}
                        <div className="text-right leading-tight min-w-0">
                          <span className="font-bold mr-1.5 inline">Real Location:</span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleUpdateScene(scene.id, { realLocation: e.currentTarget.innerText.trim() })}
                            className="outline-none hover:bg-emerald-500/10 px-0.5 rounded font-medium break-words inline"
                            title="Click to edit real shooting location"
                          >
                            {scene.realLocation || scene.location || 'xyz'}
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
                        <div className="absolute -top-3.5 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center gap-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-1.5 py-0.5 shadow-lg">
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

                        {/* CASE A: CENTER ROW (Slugline / Transition / Heading) */}
                        {isCenter && (
                          <div className="w-full text-center py-2 px-4 rounded bg-amber-500/5 text-amber-400 font-bold text-sm tracking-wide">
                            <span
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => handleUpdateItemText(item.id, e.currentTarget.innerText)}
                              className="outline-none"
                            >
                              {item.rawText || item.leftAction || item.rightDialogue || 'தலைப்பு / மாற்றம்'}
                            </span>
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

                                  return (
                                    <div data-char-container={item.id} className="w-full flex items-start justify-end gap-1 pt-0.5">
                                      <ScriptCharacterInput
                                        value={char || ''}
                                        suggestions={allKnownCharacters}
                                        onChange={(val) => handleUpdateItemCharacter(item.id, val)}
                                        placeholder="கதாபாத்திரம்"
                                        className="text-xs font-black uppercase text-right text-sky-400 bg-transparent border-b border-transparent hover:border-zinc-500 focus:border-sky-400 outline-none w-auto min-w-[70px] max-w-[240px] transition-colors"
                                      />
                                      <span className="text-sky-400 font-bold text-xs select-none">:</span>
                                    </div>
                                  );
                                })()
                              ) : isLeft ? (
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
                                  className={`min-h-[28px] text-sm leading-relaxed text-justify outline-none focus:ring-1 focus:ring-emerald-500/50 rounded p-1 transition-all ${
                                    !item.leftAction && !item.rawText
                                      ? 'border border-dashed border-emerald-500/40 bg-emerald-500/[0.04]'
                                      : ''
                                  }`}
                                  title="Type to edit. Press Enter or Alt+Click to split into separate shot ending with ' -'"
                                >
                                  {item.leftAction || item.rawText || ''}
                                </div>
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
                                      className={`min-h-[28px] text-sm leading-relaxed outline-none focus:ring-1 focus:ring-sky-500/50 rounded p-1 text-left transition-all ${
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
    </div>
  </div>
);
};
