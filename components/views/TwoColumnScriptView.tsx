import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import { useProject } from '../../context/ProjectContext';
import { ProductionDocument, ViewMode, Beat } from '../../types';
import { syncBreakdownToDepartmentsAndContinuity } from '../../utils/breakdownSync';
import {
  getProductionDocuments,
  saveProductionDocuments,
  mergeProductionDocuments,
  syncDocumentsWithCloud,
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
  splitActionTextIntoShots,
  healOrphanedNumeralItems,
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
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import {
  Columns,
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
  ZoomIn,
  ZoomOut,
  Sparkles,
  Sliders,
  Settings,
  Layers,
  Scissors,
  Combine,
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
  Tag,
  UserCheck,
  Car,
  Cat,
  Home,
  TreePine,
  Zap,
  AlertTriangle,
  Shirt,
  Package,
  Flame,
  Volume2,
  Camera,
  ListChecks,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import {
  BreakdownCategory,
  BreakdownItem,
  BreakdownData,
  CATEGORY_REGISTRY,
} from '../../types';
import { generateBreakdown } from '../../services/gemini';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';

export interface TwoColumnScriptViewProps {
  initialDocumentId?: string;
  onNavigateToView?: (view: ViewMode) => void;
}

const ALL_15_CATEGORIES: BreakdownCategory[] = [
  'CAST',
  'EXTRAS',
  'STUNTS',
  'VEHICLES',
  'PROPS',
  'SFX',
  'WARDROBE',
  'MAKEUP',
  'ANIMALS',
  'SOUND',
  'SET_DRESSING',
  'GREENERY',
  'SPECIAL_EQUIPMENT',
  'LIGHTING_GRIP',
  'SAFETY',
];

const getBreakdownCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'UserCheck': return UserCheck;
    case 'Users': return Users;
    case 'Flame': return Flame;
    case 'Car': return Car;
    case 'Package': return Package;
    case 'Sparkles': return Sparkles;
    case 'Shirt': return Shirt;
    case 'Palette': return Palette;
    case 'Cat': return Cat;
    case 'Volume2': return Volume2;
    case 'Home': return Home;
    case 'TreePine': return TreePine;
    case 'Camera': return Camera;
    case 'Zap': return Zap;
    case 'AlertTriangle': return AlertTriangle;
    default: return Tag;
  }
};

const getTwoColumnCategoryItems = (breakdown: BreakdownData | undefined, category: BreakdownCategory): (string | BreakdownItem)[] => {
  if (!breakdown) return [];
  const upper = breakdown[category];
  if (Array.isArray(upper) && upper.length > 0) return upper;

  if (category === 'CAST' && Array.isArray(breakdown.cast) && breakdown.cast.length > 0) return breakdown.cast;
  if (category === 'PROPS' && Array.isArray(breakdown.props) && breakdown.props.length > 0) return breakdown.props;
  if (category === 'SOUND' && Array.isArray(breakdown.sound) && breakdown.sound.length > 0) return breakdown.sound;
  if (category === 'WARDROBE' && Array.isArray(breakdown.costume) && breakdown.costume.length > 0) return breakdown.costume;
  if (category === 'SFX' && Array.isArray(breakdown.vfx) && breakdown.vfx.length > 0) return breakdown.vfx;
  if (category === 'STUNTS' && Array.isArray(breakdown.practical) && breakdown.practical.length > 0) return breakdown.practical;
  if (category === 'SET_DRESSING' && Array.isArray(breakdown.location) && breakdown.location.length > 0) return breakdown.location;

  return Array.isArray(upper) ? upper : [];
};

/**
 * Real-time Collaborative Non-Destructive Merger
 * Merges incoming remote screenplay state with local state:
 * - Preserves items currently being edited or focused by the local user
 * - Uses Last-Write-Wins timestamps (updatedAt) for non-active items
 * - Preserves newly added scenes and items from both local and remote
 * - Honors local deletions so deleted items are not resurrected
 */
function mergeTwoColumnData(
  local: TamilScreenplayData,
  incoming: TamilScreenplayData,
  activeItemId: string | null,
  localDirtyItemIds: Map<string, number>,
  localDeletedItemIds: Set<string>,
  localDeletedSceneIds: Set<string>
): TamilScreenplayData {
  if (!incoming || !incoming.scenes || incoming.scenes.length === 0) {
    return local;
  }
  if (!local || !local.scenes || local.scenes.length === 0) {
    return incoming;
  }

  const incomingScenes = incoming.scenes;
  const localScenes = local.scenes;
  const incomingSceneMap = new Map(incomingScenes.map((s) => [s.id, s]));
  const localSceneMap = new Map(localScenes.map((s) => [s.id, s]));

  const mergedScenes: TamilScene[] = [];

  // 1. Process incoming scenes and merge items
  for (const inScene of incomingScenes) {
    if (localDeletedSceneIds.has(inScene.id)) {
      // Local user deleted this scene; do not restore
      continue;
    }

    const locScene = localSceneMap.get(inScene.id);
    if (!locScene) {
      // New scene added by collaborator
      mergedScenes.push(inScene);
      continue;
    }

    const locItemMap = new Map((locScene.items || []).map((i) => [i.id, i]));
    const mergedItems: TamilScriptItem[] = [];
    const processedItemIds = new Set<string>();

    for (const inItem of inScene.items || []) {
      if (localDeletedItemIds.has(inItem.id)) {
        // Local user deleted this item; do not restore
        continue;
      }
      processedItemIds.add(inItem.id);

      const locItem = locItemMap.get(inItem.id);
      if (!locItem) {
        // New item added by collaborator
        mergedItems.push(inItem);
        continue;
      }

      // Check if local user is actively focused on this item in the DOM
      const isCurrentlyActive =
        (activeItemId && activeItemId === inItem.id) ||
        (typeof document !== 'undefined' &&
          (document.activeElement?.getAttribute('data-item-id') === inItem.id ||
            document.activeElement?.closest(`[data-item-id="${inItem.id}"]`) !== null));

      const localTimestamp = locItem.updatedAt || localDirtyItemIds.get(inItem.id) || 0;
      const incomingTimestamp = inItem.updatedAt || 0;

      if (isCurrentlyActive || localDirtyItemIds.has(inItem.id)) {
        // Local user is actively typing or has pending uncommitted edits in this box: keep local!
        mergedItems.push(locItem);
      } else if (localTimestamp > 0 && localTimestamp >= incomingTimestamp) {
        // Local user's recent edit is newer: keep local!
        mergedItems.push(locItem);
      } else {
        // Collaborator's edit is newer or local never modified it: accept incoming!
        mergedItems.push(inItem);
      }
    }

    // Preserve any local items in this scene that incoming hasn't received yet
    for (const locItem of locScene.items || []) {
      if (processedItemIds.has(locItem.id) || localDeletedItemIds.has(locItem.id)) {
        continue;
      }
      mergedItems.push(locItem);
    }

    mergedScenes.push({
      ...inScene,
      sceneNumber: locScene.sceneNumber || inScene.sceneNumber,
      location: locScene.location || inScene.location,
      realLocation: locScene.realLocation || inScene.realLocation,
      timeOfDay: locScene.timeOfDay || inScene.timeOfDay,
      sluglineText: locScene.sluglineText || inScene.sluglineText,
      items: mergedItems,
    });
  }

  // 2. Preserve any local scenes that collaborator hasn't received yet
  for (const locScene of localScenes) {
    if (incomingSceneMap.has(locScene.id) || localDeletedSceneIds.has(locScene.id)) {
      continue;
    }
    mergedScenes.push(locScene);
  }

  return {
    ...incoming,
    title: local.title || incoming.title,
    scenes: mergedScenes,
    hasDialogue: mergedScenes.some((s) => s.items?.some((i) => i.type === 'dialogue')),
  };
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
  const [documents, setDocuments] = useState<ProductionDocument[]>(() => getProductionDocuments(projectContext.currentProjectId || undefined));

  // Active script document
  const [selectedDocId, setSelectedDocId] = useState<string>(() => {
    if (initialDocumentId) return initialDocumentId;
    if (typeof localStorage !== 'undefined') {
      const activeTwoCol = localStorage.getItem('active_two_column_doc_id') || localStorage.getItem('backstage_last_vault_doc_id');
      if (activeTwoCol && documents.some((d) => d.id === activeTwoCol)) {
        return activeTwoCol;
      }
    }
    const stagedDoc = documents.find((d) => d.isStagedToScript);
    if (stagedDoc) return stagedDoc.id;
    const scriptDoc = documents.find((d) => d.isLeftRightFormat || d.hasTwoColumnScript || d.category === 'SCRIPT');
    return scriptDoc?.id || '';
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

  // Synchronize documents with current project and Supabase Cloud
  useEffect(() => {
    const projId = projectContext.currentProjectId || undefined;
    const latestDocs = getProductionDocuments(projId);
    setDocuments(latestDocs);
    if (!selectedDocId || !latestDocs.some(d => d.id === selectedDocId)) {
      const best = latestDocs.find(d => d.isStagedToScript) 
        || latestDocs.find(d => d.isLeftRightFormat || d.hasTwoColumnScript || d.category === 'SCRIPT')
        || latestDocs[0];
      if (best) setSelectedDocId(best.id);
    }

    if (projId && isSupabaseConfigured && projectContext.supabaseUser?.id) {
      syncDocumentsWithCloud(projId, projectContext.supabaseUser.id).then((syncedDocs) => {
        if (syncedDocs && syncedDocs.length > 0) {
          setDocuments(syncedDocs);
          if (!selectedDocId || !syncedDocs.some(d => d.id === selectedDocId)) {
            const best = syncedDocs.find(d => d.isStagedToScript) 
              || syncedDocs.find(d => d.isLeftRightFormat || d.hasTwoColumnScript || d.category === 'SCRIPT')
              || syncedDocs[0];
            if (best) setSelectedDocId(best.id);
          }
        }
      }).catch(() => {});
    }
  }, [projectContext.currentProjectId, projectContext.supabaseUser?.id]);

  const activeDoc = useMemo(() => {
    return documents.find((d) => d.id === selectedDocId) || documents.find((d) => d.isStagedToScript) || documents.find((d) => d.isLeftRightFormat || d.hasTwoColumnScript || d.category === 'SCRIPT');
  }, [documents, selectedDocId]);

  // Screenplay Data
  const [screenplayData, setScreenplayData] = useState<TamilScreenplayData>(() => {
    if (!activeDoc) {
      return {
        title: 'Untitled Screenplay',
        author: projectContext.currentUser || 'Writer',
        scenes: [],
        rawText: '',
        hasDialogue: false,
      };
    }
    if (activeDoc.twoColumnData && Array.isArray(activeDoc.twoColumnData.scenes)) {
      return activeDoc.twoColumnData;
    }
    const raw = activeDoc.textContent || '';
    if (!raw.trim()) {
      return {
        title: activeDoc.title || 'Untitled Screenplay',
        author: activeDoc.author || projectContext.currentUser || 'Writer',
        scenes: [],
        rawText: '',
        hasDialogue: false,
      };
    }
    return parseScreenplayToTamilLeftRight(raw, activeDoc.title || 'Untitled Screenplay');
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
      const allDocs = getProductionDocuments(projectContext.currentProjectId || undefined);
      const nextList = allDocs.map((d) => (d.id === updated.id ? updated : d));
      saveProductionDocuments(
        nextList, 
        projectContext.currentProjectId || undefined, 
        false, 
        true, 
        projectContext.currentUser || 'user', 
        clientInstanceIdRef.current
      );
      setDocuments(nextList);
    }
    setHasUnsavedChanges(true);
    showToast('✓ Document Renamed');
  };

  // Script documents available in Vault for switching
  const [isDocSwitcherOpen, setIsDocSwitcherOpen] = useState<boolean>(false);
  const docSwitcherRef = useRef<HTMLDivElement>(null);

  const scriptVaultDocs = useMemo(() => {
    return documents.filter((d) =>
      d.isStagedToScript ||
      d.category === 'SCRIPT' ||
      d.isLeftRightFormat ||
      d.hasTwoColumnScript ||
      d.fileName?.endsWith('.docx') ||
      d.fileName?.endsWith('.fountain') ||
      (d.textContent && d.textContent.trim().length > 30) ||
      (d.htmlContent && d.htmlContent.trim().length > 30)
    );
  }, [documents]);

  // Close switcher on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (docSwitcherRef.current && !docSwitcherRef.current.contains(e.target as Node)) {
        setIsDocSwitcherOpen(false);
      }
    };
    if (isDocSwitcherOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDocSwitcherOpen]);

  const handleSelectScriptDoc = (docId: string) => {
    setSelectedDocId(docId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('active_two_column_doc_id', docId);
    }
    setIsDocSwitcherOpen(false);
    showToast('✓ Switched script document');
  };

  // Switch or reload active document
  useEffect(() => {
    if (activeDoc) {
      if (activeDoc.twoColumnData && Array.isArray(activeDoc.twoColumnData.scenes)) {
        setScreenplayData(activeDoc.twoColumnData);
      } else {
        const raw = activeDoc.textContent || (activeDoc.htmlContent ? activeDoc.htmlContent.replace(/<[^>]+>/g, '\n') : '');
        if (raw.trim()) {
          setScreenplayData(parseScreenplayToTamilLeftRight(raw, activeDoc.title));
        } else {
          setScreenplayData({
            title: activeDoc.title || 'Untitled Screenplay',
            author: activeDoc.author || projectContext.currentUser || 'Writer',
            scenes: [],
            rawText: '',
            hasDialogue: false,
          });
        }
      }
      setSelectedItemIds(new Set());
      setHasUnsavedChanges(false);
    }
  }, [activeDoc?.id]);

  // Live Mutable Ref to prevent stale React closures when inserting scenes or syncing
  const screenplayDataRef = useRef<TamilScreenplayData>(screenplayData);
  useEffect(() => {
    screenplayDataRef.current = screenplayData;
  }, [screenplayData]);

  // Pagination & Layout Configuration (Default 17px font size & auto CUT TO off)
  const [layoutOptions, setLayoutOptions] = useState<TwoColumnPaginationOptions>(() => {
    const userFont = typeof localStorage !== 'undefined' ? localStorage.getItem('user_pref_two_col_font') : null;
    const userFontSize = typeof localStorage !== 'undefined' ? localStorage.getItem('user_pref_two_col_font_size') : null;
    return {
      ...DEFAULT_TWO_COLUMN_PAGINATION_OPTIONS,
      baseFontSizePx: userFontSize ? Number(userFontSize) : 17,
      autoEndSceneCutTo: false,
      ...(userFont ? { baseFontFamily: userFont } : {})
    };
  });

  // Highlighting & Selection State
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // UI View Modes
  const [pageViewMode, setPageViewMode] = useState<'stacked' | 'single' | 'spread'>('stacked');
  const [currentSinglePage, setCurrentSinglePage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isStyleDrawerOpen, setIsStyleDrawerOpen] = useState<boolean>(false);
  const { aiAvailable } = useAiKeyStatus();
  const [isBreakdownDrawerOpen, setIsBreakdownDrawerOpen] = useState<boolean>(false);
  const [activeBreakdownSceneId, setActiveBreakdownSceneId] = useState<string>('');
  const [breakdownLanguage, setBreakdownLanguage] = useState<'english' | 'tamil'>(() => projectContext.breakdownLanguage || 'english');
  const [isAnalyzingBreakdown, setIsAnalyzingBreakdown] = useState<boolean>(false);
  const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({});
  const [dragOverBreakdownCategory, setDragOverBreakdownCategory] = useState<BreakdownCategory | null>(null);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
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
  const canvasScrollerRef = useRef<HTMLDivElement | null>(null);

  // Mouse Drag / Marquee Block Selection State
  const [marqueeBox, setMarqueeBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const marqueeDragStateRef = useRef<{
    startX: number;
    startY: number;
    isDragging: boolean;
    initialSelected: Set<string>;
  } | null>(null);

  // Restore scroll position & last viewed scene on mount
  useEffect(() => {
    try {
      const savedScene = localStorage.getItem('backstage_last_twocol_scene_id');
      const savedScroll = localStorage.getItem('backstage_last_twocol_scroll_top');
      if (savedScene) {
        setActiveSceneId(savedScene);
      }
      if (savedScroll && canvasScrollerRef.current) {
        setTimeout(() => {
          if (canvasScrollerRef.current) {
            canvasScrollerRef.current.scrollTop = parseInt(savedScroll, 10);
          }
        }, 150);
      }
    } catch (e) {
      console.warn('Could not restore twocol scroll position:', e);
    }
  }, [selectedDocId]);

  // Undo & Redo History Management (fast & lightweight, capped at 50 states)
  const undoStackRef = useRef<TamilScreenplayData[]>([]);
  const redoStackRef = useRef<TamilScreenplayData[]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const lastTypingUndoTimeRef = useRef<number>(0);
  const activeTypingItemIdRef = useRef<string | null>(null);

  // Collaboration & Concurrency Control (prevents typing collision & data loss)
  const clientInstanceIdRef = useRef<string>(
    `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  );
  const localDirtyItemIdsRef = useRef<Map<string, number>>(new Map());
  const localDeletedItemIdsRef = useRef<Set<string>>(new Set());
  const localDeletedSceneIdsRef = useRef<Set<string>>(new Set());

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
    const handleClose = (e: MouseEvent) => {
      setActiveDropdown(null);
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
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
  const rawAllKnownCharacters = useMemo(() => {
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

  const allKnownCharactersRef = useRef<string[]>([]);
  const allKnownCharacters = useMemo(() => {
    const prev = allKnownCharactersRef.current;
    if (prev.length === rawAllKnownCharacters.length && prev.every((v, i) => v === rawAllKnownCharacters[i])) {
      return prev;
    }
    allKnownCharactersRef.current = rawAllKnownCharacters;
    return rawAllKnownCharacters;
  }, [rawAllKnownCharacters]);

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

  // 15-Category Production Breakdown Helpers & Handlers
  const findMatchingBeat = useCallback((scene?: TamilScene): Beat | undefined => {
    if (!scene || !projectContext.beats || projectContext.beats.length === 0) return undefined;
    if (scene.sceneNumber) {
      const byNum = projectContext.beats.find(b => String(b.sceneNumber) === String(scene.sceneNumber));
      if (byNum) return byNum;
    }
    const sceneIndex = screenplayData.scenes.findIndex(s => s.id === scene.id);
    if (sceneIndex >= 0 && projectContext.beats[sceneIndex]) {
      return projectContext.beats[sceneIndex];
    }
    return undefined;
  }, [projectContext.beats, screenplayData.scenes]);

  const activeBreakdownScene = useMemo(() => {
    const sc = screenplayData.scenes.find((s) => s.id === activeBreakdownSceneId) || screenplayData.scenes[0];
    if (!sc) return undefined;
    if (!sc.breakdown) {
      const mb = findMatchingBeat(sc);
      const beatBd = mb?.breakdown || mb?.breakdownData;
      if (beatBd) {
        return { ...sc, breakdown: beatBd };
      }
    }
    return sc;
  }, [screenplayData.scenes, activeBreakdownSceneId, findMatchingBeat]);

  const totalTwoColumnBreakdownItems = useMemo(() => {
    if (!activeBreakdownScene?.breakdown) return 0;
    return ALL_15_CATEGORIES.reduce(
      (sum, cat) => sum + getTwoColumnCategoryItems(activeBreakdownScene.breakdown, cat).length,
      0
    );
  }, [activeBreakdownScene]);

  const handleSyncAllBreakdownsFromBeats = useCallback(() => {
    if (!projectContext.beats || projectContext.beats.length === 0) {
      showToast('No Screenplay/Mass Breakdown scenes available to sync.');
      return;
    }
    let syncedCount = 0;
    setScreenplayData((prev) => {
      const nextScenes = prev.scenes.map((s, idx) => {
        const mb = findMatchingBeat(s) || projectContext.beats[idx];
        const beatBd = mb?.breakdown || mb?.breakdownData;
        if (beatBd) {
          syncedCount++;
          return { ...s, breakdown: beatBd };
        }
        return s;
      });
      const next = { ...prev, scenes: nextScenes };
      screenplayDataRef.current = next;
      return next;
    });
    setHasUnsavedChanges(true);
    showToast(`⚡ Synced breakdown for ${syncedCount} scenes from Screenplay & Mass Breakdown!`);
  }, [projectContext.beats, findMatchingBeat]);

  const handleAnalyzeTwoColumnBreakdown = async () => {
    if (!activeBreakdownScene) return;
    setIsAnalyzingBreakdown(true);
    try {
      const sceneTextParts: string[] = [];
      if (activeBreakdownScene.sluglineText) {
        sceneTextParts.push(activeBreakdownScene.sluglineText);
      } else {
        sceneTextParts.push(`SCENE ${activeBreakdownScene.sceneNumber}: ${activeBreakdownScene.location} - ${activeBreakdownScene.timeOfDay}`);
      }

      (activeBreakdownScene.items || []).forEach((item) => {
        if (item.leftAction) sceneTextParts.push(`ACTION: ${item.leftAction}`);
        if (item.rightCharacter && item.rightDialogue) {
          sceneTextParts.push(`${item.rightCharacter}: ${item.rightDialogue}`);
        } else if (item.rightDialogue) {
          sceneTextParts.push(item.rightDialogue);
        }
        if (item.rightAudioSfx) sceneTextParts.push(`[SOUND: ${item.rightAudioSfx}]`);
        if (item.rawText) sceneTextParts.push(item.rawText);
      });

      const fullText = sceneTextParts.join('\n\n');
      const result = await generateBreakdown(
        fullText,
        projectContext.generalAiModel || 'gemini-flash-latest',
        breakdownLanguage,
        projectContext.openrouterKey
      );

      if (result) {
        setScreenplayData((prev) => {
          const next = {
            ...prev,
            scenes: prev.scenes.map((s) =>
              s.id === activeBreakdownScene.id ? { ...s, breakdown: result } : s
            ),
          };
          screenplayDataRef.current = next;
          return next;
        });
        setHasUnsavedChanges(true);

        // Synchronize immediately to the corresponding Screenplay Beat & Mass Breakdown
        const mb = findMatchingBeat(activeBreakdownScene);
        if (mb) {
          projectContext.updateBeat(mb.id, { breakdown: result, breakdownData: result });
          try {
            const nextBeats = projectContext.beats.map(b => b.id === mb.id ? { ...b, breakdown: result, breakdownData: result } : b);
            syncBreakdownToDepartmentsAndContinuity(nextBeats, []);
          } catch (syncErr) {
            console.warn('Sync departments error:', syncErr);
          }
        }

        showToast(`✓ Analyzed 15 production categories for Scene ${activeBreakdownScene.sceneNumber}`);
      } else {
        alert('Failed to analyze breakdown for this scene.');
      }
    } catch (err) {
      console.error('Error analyzing two-column breakdown:', err);
      alert('An error occurred during breakdown analysis.');
    } finally {
      setIsAnalyzingBreakdown(false);
    }
  };

  const handleAddTwoColumnTag = (category: BreakdownCategory, tag: string) => {
    if (!activeBreakdownScene || !tag.trim()) return;
    const currentBreakdown = activeBreakdownScene.breakdown || {};
    const list = getTwoColumnCategoryItems(currentBreakdown, category);
    const exists = list.some((i) => (typeof i === 'string' ? i : i.name).toLowerCase() === tag.trim().toLowerCase());
    if (exists) return;

    const newItem: BreakdownItem = {
      name: tag.trim(),
      category,
      source: '',
    };
    const updatedBreakdown: BreakdownData = {
      ...currentBreakdown,
      [category]: [...list, newItem],
    };

    setScreenplayData((prev) => {
      const next = {
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === activeBreakdownScene.id ? { ...s, breakdown: updatedBreakdown } : s
        ),
      };
      screenplayDataRef.current = next;
      return next;
    });
    setHasUnsavedChanges(true);
    setNewTagInputs((prev) => ({ ...prev, [category]: '' }));

    // Synchronize to main Beat
    const mb = findMatchingBeat(activeBreakdownScene);
    if (mb) {
      projectContext.updateBeat(mb.id, { breakdown: updatedBreakdown, breakdownData: updatedBreakdown });
      try {
        const nextBeats = projectContext.beats.map(b => b.id === mb.id ? { ...b, breakdown: updatedBreakdown, breakdownData: updatedBreakdown } : b);
        syncBreakdownToDepartmentsAndContinuity(nextBeats, []);
      } catch (e) { /* ignore */ }
    }
  };

  const handleRemoveTwoColumnTag = (category: BreakdownCategory, tag: string) => {
    if (!activeBreakdownScene) return;
    const currentBreakdown = activeBreakdownScene.breakdown || {};
    const list = getTwoColumnCategoryItems(currentBreakdown, category);
    const newList = list.filter((i) => (typeof i === 'string' ? i : i.name) !== tag);

    const updatedBreakdown: BreakdownData = {
      ...currentBreakdown,
      [category]: newList,
    };
    if (category === 'CAST' && updatedBreakdown.cast) updatedBreakdown.cast = (updatedBreakdown.cast as any[]).filter((i) => (typeof i === 'string' ? i : i.name) !== tag);
    if (category === 'PROPS' && updatedBreakdown.props) updatedBreakdown.props = (updatedBreakdown.props as any[]).filter((i) => (typeof i === 'string' ? i : i.name) !== tag);
    if (category === 'SOUND' && updatedBreakdown.sound) updatedBreakdown.sound = (updatedBreakdown.sound as any[]).filter((i) => (typeof i === 'string' ? i : i.name) !== tag);
    if (category === 'WARDROBE' && updatedBreakdown.costume) updatedBreakdown.costume = (updatedBreakdown.costume as any[]).filter((i) => (typeof i === 'string' ? i : i.name) !== tag);
    if (category === 'SFX' && updatedBreakdown.vfx) updatedBreakdown.vfx = (updatedBreakdown.vfx as any[]).filter((i) => (typeof i === 'string' ? i : i.name) !== tag);
    if (category === 'STUNTS' && updatedBreakdown.practical) updatedBreakdown.practical = (updatedBreakdown.practical as any[]).filter((i) => (typeof i === 'string' ? i : i.name) !== tag);
    if (category === 'SET_DRESSING' && updatedBreakdown.location) updatedBreakdown.location = (updatedBreakdown.location as any[]).filter((i) => (typeof i === 'string' ? i : i.name) !== tag);

    setScreenplayData((prev) => {
      const next = {
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === activeBreakdownScene.id ? { ...s, breakdown: updatedBreakdown } : s
        ),
      };
      screenplayDataRef.current = next;
      return next;
    });
    setHasUnsavedChanges(true);

    // Synchronize to main Beat
    const mb = findMatchingBeat(activeBreakdownScene);
    if (mb) {
      projectContext.updateBeat(mb.id, { breakdown: updatedBreakdown, breakdownData: updatedBreakdown });
      try {
        const nextBeats = projectContext.beats.map(b => b.id === mb.id ? { ...b, breakdown: updatedBreakdown, breakdownData: updatedBreakdown } : b);
        syncBreakdownToDepartmentsAndContinuity(nextBeats, []);
      } catch (e) { /* ignore */ }
    }
  };

  // Defer heavy script pagination so active typing receives 100% main thread priority
  const deferredScreenplayData = useDeferredValue(screenplayData);

  // Run Dedicated Pagination Engine
  const paginationResult = useMemo(() => {
    return paginateTwoColumnScript(deferredScreenplayData, layoutOptions);
  }, [deferredScreenplayData, layoutOptions]);

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
    try {
      localStorage.setItem('backstage_last_twocol_scene_id', sceneId);
    } catch {}
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

  // Flatten all items for selection utilities (stabilized across text edits)
  const rawItemIds = useMemo(() => {
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

  const stableItemIdsRef = useRef(rawItemIds);
  const { allItemIds, orderedItemIds } = useMemo(() => {
    const prev = stableItemIdsRef.current;
    if (
      prev.orderedItemIds.length === rawItemIds.orderedItemIds.length &&
      prev.orderedItemIds.every((id, idx) => id === rawItemIds.orderedItemIds[idx])
    ) {
      return prev;
    }
    stableItemIdsRef.current = rawItemIds;
    return rawItemIds;
  }, [rawItemIds]);

  // Handle paragraph selection (supports Cmd+Click multiselect, Shift+Click range, and normal click)
  const handleParagraphClick = useCallback((itemId: string, e?: React.MouseEvent) => {
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

    // Case 3: Standard single click on card body (select this block)
    setSelectedItemIds(new Set([itemId]));
    setLastSelectedId(itemId);
  }, [orderedItemIds, lastSelectedId]);

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
  const moveParagraphsToColumn = useCallback((targetColumn: 'left' | 'right' | 'center', specificItemId?: string, liveText?: string) => {
    const idsToMove = specificItemId ? new Set([specificItemId]) : selectedItemIds;
    if (idsToMove.size === 0) return;

    pushToUndoHistory(screenplayData);

    setScreenplayData((prev) => {
      const nextScenes = prev.scenes.map((scene) => ({
        ...scene,
        items: scene.items.map((item) => {
          if (idsToMove.has(item.id)) {
            // Determine active text: prefer passed liveText, then DOM lookup, then item state
            let domText: string | undefined = undefined;
            if (specificItemId === item.id && liveText !== undefined) {
              domText = liveText;
            } else if (typeof document !== 'undefined') {
              const el = document.querySelector(`[data-item-row-id="${item.id}"] [contenteditable="true"]`) as HTMLElement;
              if (el && el.innerText.trim()) domText = el.innerText;
            }

            let text = domText !== undefined ? domText : (item.rawText || item.leftAction || item.rightDialogue || '');
            let char = item.rightCharacter || '';

            // 1. Moving to Right (Dialogue Column)
            if (targetColumn === 'right') {
              if (!char && typeof text === 'string') {
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
              // Preserve character name if present so nothing vanishes
              const fullText = char && text && !text.startsWith(char) ? `${char} : ${text}` : text;
              return {
                ...item,
                column: 'left',
                type: 'action',
                leftAction: fullText,
                rightDialogue: undefined,
                rightCharacter: undefined,
                rawText: fullText,
              };
            }

            // 3. Moving to Center (Transition / Title)
            return {
              ...item,
              column: 'center',
              type: 'transition',
              leftAction: undefined,
              rightDialogue: undefined,
              rightCharacter: undefined,
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
  const handleUpdateItemText = useCallback((itemId: string, newText: string) => {
    const now = Date.now();
    localDirtyItemIdsRef.current.set(itemId, now);
    localDeletedItemIdsRef.current.delete(itemId);

    // Check if text actually changed before pushing undo
    let hasChanged = false;
    for (const sc of screenplayDataRef.current.scenes) {
      const it = sc.items.find((i) => i.id === itemId);
      if (it) {
        const cur = it.column === 'left' ? it.leftAction : it.column === 'right' ? it.rightDialogue : it.rawText;
        if ((cur || '') !== newText) hasChanged = true;
        break;
      }
    }
    if (hasChanged) {
      // Record undo checkpoint at start of typing burst or after 1.5s pause
      if (activeTypingItemIdRef.current !== itemId || now - lastTypingUndoTimeRef.current > 1500) {
        pushToUndoHistory(screenplayDataRef.current);
        activeTypingItemIdRef.current = itemId;
        lastTypingUndoTimeRef.current = now;
      }
    }

    if (itemId.startsWith('auto-cut-to-')) {
      const sceneId = itemId.replace('auto-cut-to-', '');
      setScreenplayData((prev) => {
        const next = {
          ...prev,
          scenes: prev.scenes.map((sc) => {
            if (sc.id === sceneId) {
              return {
                ...sc,
                items: [
                  ...sc.items,
                  {
                    id: `cut-to-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    type: 'transition' as const,
                    column: 'center' as const,
                    rawText: newText,
                    updatedAt: now,
                  },
                ],
              };
            }
            return sc;
          }),
        };
        screenplayDataRef.current = next;
        return next;
      });
      setHasUnsavedChanges(true);
      return;
    }

    setScreenplayData((prev) => {
      const targetScene = prev.scenes.find((sc) => sc.items.some((it) => it.id === itemId));
      if (!targetScene) return prev;

      const next = {
        ...prev,
        scenes: prev.scenes.map((sc) => {
          if (sc.id !== targetScene.id) return sc;
          return {
            ...sc,
            items: sc.items.map((it) => {
              if (it.id === itemId) {
                return {
                  ...it,
                  updatedAt: now,
                  rawText: newText,
                  leftAction: it.column === 'left' ? newText : it.leftAction,
                  rightDialogue: it.column === 'right' ? newText : it.rightDialogue,
                };
              }
              return it;
            }),
          };
        }),
      };
      screenplayDataRef.current = next;
      return next;
    });
    setHasUnsavedChanges(true);
  }, [pushToUndoHistory]);

  // Direct in-place character update
  const handleUpdateItemCharacter = useCallback((itemId: string, newChar: string) => {
    const now = Date.now();
    localDirtyItemIdsRef.current.set(itemId, now);
    localDeletedItemIdsRef.current.delete(itemId);

    let hasChanged = false;
    for (const sc of screenplayDataRef.current.scenes) {
      const it = sc.items.find((i) => i.id === itemId);
      if (it && (it.rightCharacter || '') !== newChar) {
        hasChanged = true;
        break;
      }
    }
    if (hasChanged) {
      pushToUndoHistory(screenplayDataRef.current);
    }

    setScreenplayData((prev) => {
      const targetScene = prev.scenes.find((sc) => sc.items.some((it) => it.id === itemId));
      if (!targetScene) return prev;

      const next = {
        ...prev,
        scenes: prev.scenes.map((sc) => {
          if (sc.id !== targetScene.id) return sc;
          return {
            ...sc,
            items: sc.items.map((it) => (it.id === itemId ? { ...it, rightCharacter: newChar, updatedAt: now } : it)),
          };
        }),
      };
      screenplayDataRef.current = next;
      return next;
    });
    setHasUnsavedChanges(true);
  }, [pushToUndoHistory]);

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
  const handleToggleItemBold = useCallback((itemId: string) => {
    pushToUndoHistory(screenplayDataRef.current);
    const ids = selectedItemIds.has(itemId) && selectedItemIds.size > 1 ? selectedItemIds : new Set([itemId]);
    let firstState: boolean | undefined = undefined;
    for (const sc of screenplayDataRef.current.scenes) {
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
  }, [selectedItemIds, pushToUndoHistory, showToast]);

  // Toggle Italic for single or selected items
  const handleToggleItemItalic = useCallback((itemId: string) => {
    pushToUndoHistory(screenplayDataRef.current);
    const ids = selectedItemIds.has(itemId) && selectedItemIds.size > 1 ? selectedItemIds : new Set([itemId]);
    let firstState: boolean | undefined = undefined;
    for (const sc of screenplayDataRef.current.scenes) {
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
  }, [selectedItemIds, pushToUndoHistory, showToast]);

  // Convert/set block to Montage
  const handleSetMontage = useCallback((itemId: string) => {
    pushToUndoHistory(screenplayDataRef.current);
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
  }, [pushToUndoHistory, showToast]);

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
      // If inserting after the last scene in script, produce next sequential integer (e.g. Scene 2, 3...)
      if (targetIdx === scenes.length - 1) {
        let maxNum = 0;
        for (const sc of scenes) {
          const parsed = parseInt(sc.sceneNumber, 10);
          if (!isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        }
        return `${(maxNum || scenes.length) + 1}`;
      }

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
      location: '',
      realLocation: '',
      timeOfDay: 'Day / INT',
      sluglineText: `காட்சி எண்: ${nextNum}`,
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

    const nextScreenplay: TamilScreenplayData = {
      ...screenplayData,
      scenes: nextScenes,
    };

    screenplayDataRef.current = nextScreenplay;
    setScreenplayData(nextScreenplay);
    setActiveSceneId(newSceneId);
    setHasUnsavedChanges(true);

    // If viewing in single-page mode, advance currentSinglePage to the newly added scene's page
    if (pageViewMode === 'single') {
      const paginated = paginateTwoColumnScript(nextScreenplay, layoutOptions);
      if (paginated.pages.length > 0) {
        setCurrentSinglePage(paginated.pages.length);
      }
    }

    // Immediately save to vault and broadcast to cloud collaborators
    saveToVault(false, nextScreenplay);

    // Scroll directly to the newly created scene heading and focus location
    setTimeout(() => {
      const el = document.getElementById(`scene-header-${newSceneId}`) || document.getElementById(`hdr-sc-${newSceneId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const locInput = el.querySelector('[contenteditable="true"]') as HTMLElement;
        if (locInput) locInput.focus();
      }
    }, 150);

    showToast(`✓ Added Scene ${nextNum} on new page`);
  };

  // Delete scene
  const handleDeleteScene = (sceneId: string) => {
    const sc = screenplayData.scenes.find((s) => s.id === sceneId);
    if (!sc) return;
    if (screenplayData.scenes.length <= 1) {
      showToast('Cannot delete the only scene in the document');
      return;
    }
    localDeletedSceneIdsRef.current.add(sceneId);
    pushToUndoHistory(screenplayData);
    setScreenplayData((prev) => {
      const next = {
        ...prev,
        scenes: prev.scenes.filter((s) => s.id !== sceneId),
      };
      screenplayDataRef.current = next;
      return next;
    });
    setHasUnsavedChanges(true);
    showToast(`✓ Deleted Scene ${sc.sceneNumber}`);
  };

  // Renumber all scenes sequentially (1, 2, 3...)
  const handleRenumberAllScenes = () => {
    pushToUndoHistory(screenplayData);
    setScreenplayData((prev) => {
      const next = {
        ...prev,
        scenes: prev.scenes.map((sc, idx) => ({
          ...sc,
          sceneNumber: `${idx + 1}`,
        })),
      };
      screenplayDataRef.current = next;
      return next;
    });
    setHasUnsavedChanges(true);
    showToast(`✓ Renumbered all ${screenplayData.scenes.length} scenes sequentially (1 to ${screenplayData.scenes.length})`);
  };

  // Update scene metadata
  const handleUpdateScene = (sceneId: string, updates: Partial<TamilScene>) => {
    pushToUndoHistory(screenplayData);
    setScreenplayData((prev) => {
      const next = {
        ...prev,
        scenes: prev.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...updates } : sc)),
      };
      screenplayDataRef.current = next;
      return next;
    });
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

    localDeletedItemIdsRef.current.add(itemId);
    localDirtyItemIdsRef.current.delete(itemId);

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
    setScreenplayData((prev) => {
      const next = {
        ...prev,
        scenes: prev.scenes.map((sc) => ({
          ...sc,
          items: sc.items.filter((it) => it.id !== itemId),
        })),
      };
      screenplayDataRef.current = next;
      return next;
    });

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
    idsToDelete.forEach((id) => {
      localDeletedItemIdsRef.current.add(id);
      localDirtyItemIdsRef.current.delete(id);
    });

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

    setScreenplayData((prev) => {
      const next = {
        ...prev,
        scenes: prev.scenes.map((sc) => ({
          ...sc,
          items: sc.items.filter((it) => !idsToDelete.has(it.id)),
        })),
      };
      screenplayDataRef.current = next;
      return next;
    });

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
    const now = Date.now();
    const newItemId = `item-${now}-${Math.random().toString(36).substring(2, 7)}`;
    localDirtyItemIdsRef.current.set(newItemId, now);
    localDeletedItemIdsRef.current.delete(newItemId);

    const newItem: TamilScriptItem = {
      id: newItemId,
      type: column === 'center' ? 'title' : column === 'right' ? 'dialogue' : 'action',
      column,
      leftAction: column === 'left' ? '' : undefined,
      rightDialogue: column === 'right' ? '' : undefined,
      rightCharacter: column === 'right' ? '' : undefined,
      rawText: '',
      updatedAt: now,
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

      const next = {
        ...prev,
        scenes: nextScenes,
      };
      screenplayDataRef.current = next;
      return next;
    });

    setHasUnsavedChanges(true);
    setTimeout(() => focusNewScriptItem(newItemId, column), 40);
  };

  // Add a new paragraph below
  const handleAddParagraphBelow = (afterItemId?: string, column: 'left' | 'right' | 'center' = 'left') => {
    const now = Date.now();
    const newItemId = `item-${now}-${Math.random().toString(36).substring(2, 7)}`;
    localDirtyItemIdsRef.current.set(newItemId, now);
    localDeletedItemIdsRef.current.delete(newItemId);

    const newItem: TamilScriptItem = {
      id: newItemId,
      type: column === 'center' ? 'title' : column === 'right' ? 'dialogue' : 'action',
      column,
      leftAction: column === 'left' ? '' : undefined,
      rightDialogue: column === 'right' ? '' : undefined,
      rightCharacter: column === 'right' ? '' : undefined,
      rawText: '',
      updatedAt: now,
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

      const next = {
        ...prev,
        scenes: nextScenes,
      };
      screenplayDataRef.current = next;
      return next;
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

      const next = {
        ...prev,
        scenes: finalScenes,
      };
      screenplayDataRef.current = next;
      return next;
    });

    setHasUnsavedChanges(true);
    showToast(`✓ Moved paragraph ${position}`);
  };

  // Split paragraph into separate lines/blocks on Enter or Alt+Click
  const handleSplitParagraph = useCallback((
    itemId: string,
    beforeOrOffset?: number | string,
    afterOrFullText?: string
  ) => {
    const now = Date.now();
    const newItemId = `item-${now}-${Math.random().toString(36).substring(2, 7)}`;
    localDirtyItemIdsRef.current.set(itemId, now);
    localDirtyItemIdsRef.current.set(newItemId, now);
    localDeletedItemIdsRef.current.delete(newItemId);

    pushToUndoHistory(screenplayDataRef.current);

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
          updatedAt: now,
        };

        const newItem: TamilScriptItem = {
          id: newItemId,
          type: isDialogue ? 'dialogue' : isCenter ? (currentItem.type || 'transition') : 'action',
          column: isDialogue ? 'right' : isCenter ? 'center' : 'left',
          leftAction: isLeft ? cleanAfter : undefined,
          rightDialogue: isDialogue ? cleanAfter : undefined,
          rightCharacter: isDialogue ? (currentItem.rightCharacter || '') : undefined,
          rawText: cleanAfter,
          updatedAt: now,
        };

        const newItems = [...scene.items];
        newItems.splice(itemIndex, 1, updatedCurrentItem, newItem);

        return {
          ...scene,
          items: newItems,
        };
      });

      if (!itemFound) return prev;

      const next = {
        ...prev,
        scenes: nextScenes,
      };
      screenplayDataRef.current = next;
      return next;
    });

    setSelectedItemIds(new Set());
    setHasUnsavedChanges(true);
    showToast('✓ Split paragraph into new line');

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
  }, [pushToUndoHistory]);

  // Split single action block at commas (and optional dot) into separate single-shot paragraphs
  const handleSplitActionItemByComma = useCallback((itemId: string, customText?: string) => {
    const now = Date.now();
    pushToUndoHistory(screenplayData);
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
          includeDot: !!layoutOptions.splitActionIncludeDot,
        });

        if (segments.length <= 1) return scene;

        changed = true;
        splitCount = segments.length;
        const newItems: TamilScriptItem[] = segments.map((seg, idx) => {
          const id = idx === 0 ? currentItem.id : `item-${now}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
          localDirtyItemIdsRef.current.set(id, now);
          return {
            ...currentItem,
            id,
            column: 'left',
            type: 'action',
            leftAction: seg,
            rawText: seg,
            rightDialogue: undefined,
            rightCharacter: undefined,
            updatedAt: now,
          };
        });

        const updatedItems = [...scene.items];
        updatedItems.splice(itemIdx, 1, ...newItems);
        const { items: healedItems } = healOrphanedNumeralItems(updatedItems);

        return {
          ...scene,
          items: healedItems,
        };
      });

      if (!changed) return prev;
      const next = { ...prev, scenes: nextScenes };
      screenplayDataRef.current = next;
      return next;
    });

    setHasUnsavedChanges(true);
    if (splitCount > 1) {
      showToast(`✓ Split into ${splitCount} single shot paragraphs`);
    }
  }, [screenplayData, layoutOptions.splitActionIncludeDot, pushToUndoHistory, showToast]);

  // Split all comma/dot separated action blocks across the entire script into distinct shot paragraphs
  const handleSplitAllActionsByComma = useCallback(() => {
    const now = Date.now();
    pushToUndoHistory(screenplayData);
    let totalSplits = 0;
    let newShotsCreated = 0;

    setScreenplayData((prev) => {
      let changed = false;
      const nextScenes = prev.scenes.map((scene) => {
        const newItems: TamilScriptItem[] = [];

        scene.items.forEach((item) => {
          const isAction = item.column === 'left' || item.type === 'action' || (!item.rightDialogue && (item.leftAction || item.rawText));
          const text = (item.leftAction || item.rawText || '').trim();

          const hasComma = text.includes(',') || text.includes('،') || text.includes('，');
          const hasDot = layoutOptions.splitActionIncludeDot && text.includes('.');

          if (isAction && (hasComma || hasDot)) {
            const segments = splitActionTextIntoShots(text, {
              includeComma: true,
              includeDot: !!layoutOptions.splitActionIncludeDot,
            });

            if (segments.length > 1) {
              changed = true;
              totalSplits++;
              newShotsCreated += segments.length;
              segments.forEach((seg, idx) => {
                const id = idx === 0 ? item.id : `item-${now}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
                localDirtyItemIdsRef.current.set(id, now);
                newItems.push({
                  ...item,
                  id,
                  column: 'left',
                  type: 'action',
                  leftAction: seg,
                  rawText: seg,
                  rightDialogue: undefined,
                  rightCharacter: undefined,
                  updatedAt: now,
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

      if (!changed) return prev;
      const next = { ...prev, scenes: nextScenes };
      screenplayDataRef.current = next;
      return next;
    });

    setHasUnsavedChanges(true);
    if (totalSplits > 0) {
      showToast(`✓ Split ${totalSplits} action blocks into ${newShotsCreated} single shot paragraphs!`);
    } else {
      showToast('No comma/dot separated action blocks found to split.');
    }
  }, [screenplayData, layoutOptions.splitActionIncludeDot, pushToUndoHistory, showToast]);

  // Split only the currently highlighted action paragraphs by comma (and optional dot)
  const handleSplitSelectedActionsByComma = useCallback(() => {
    if (selectedItemIds.size === 0) return;
    const now = Date.now();
    pushToUndoHistory(screenplayData);
    let totalSplits = 0;
    let newShotsCreated = 0;

    setScreenplayData((prev) => {
      let changed = false;
      const nextScenes = prev.scenes.map((scene) => {
        const newItems: TamilScriptItem[] = [];

        scene.items.forEach((item) => {
          const isSelected = selectedItemIds.has(item.id);
          const isAction = item.column === 'left' || item.type === 'action' || (!item.rightDialogue && (item.leftAction || item.rawText));
          const text = (item.leftAction || item.rawText || '').trim();

          const hasComma = text.includes(',') || text.includes('،') || text.includes('，');
          const hasDot = layoutOptions.splitActionIncludeDot && text.includes('.');

          if (isSelected && isAction && (hasComma || hasDot)) {
            const segments = splitActionTextIntoShots(text, {
              includeComma: true,
              includeDot: !!layoutOptions.splitActionIncludeDot,
            });

            if (segments.length > 1) {
              changed = true;
              totalSplits++;
              newShotsCreated += segments.length;
              segments.forEach((seg, idx) => {
                const id = idx === 0 ? item.id : `item-${now}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
                localDirtyItemIdsRef.current.set(id, now);
                newItems.push({
                  ...item,
                  id,
                  column: 'left',
                  type: 'action',
                  leftAction: seg,
                  rawText: seg,
                  rightDialogue: undefined,
                  rightCharacter: undefined,
                  updatedAt: now,
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

      if (!changed) return prev;
      const next = { ...prev, scenes: nextScenes };
      screenplayDataRef.current = next;
      return next;
    });

    setHasUnsavedChanges(true);
    if (totalSplits > 0) {
      showToast(`✓ Split ${totalSplits} action blocks into ${newShotsCreated} single shot paragraphs!`);
    } else {
      showToast('No comma/dot separated action blocks selected to split.');
    }
  }, [selectedItemIds, screenplayData, layoutOptions.splitActionIncludeDot, pushToUndoHistory, showToast]);

  // Re-merge orphaned numeral rows (e.g. "1" followed by the description) back together into single unified action rows
  const handleHealNumeralLists = useCallback(() => {
    const now = Date.now();
    pushToUndoHistory(screenplayData);
    let totalHealed = 0;

    setScreenplayData((prev) => {
      let changed = false;
      const nextScenes = prev.scenes.map((scene) => {
        const { items: healedItems, healedCount } = healOrphanedNumeralItems(scene.items);
        if (healedCount > 0) {
          changed = true;
          totalHealed += healedCount;
          healedItems.forEach((it) => {
            localDirtyItemIdsRef.current.set(it.id, now);
          });
          return {
            ...scene,
            items: healedItems,
          };
        }
        return scene;
      });

      if (!changed) return prev;
      const next = { ...prev, scenes: nextScenes };
      screenplayDataRef.current = next;
      return next;
    });

    setHasUnsavedChanges(true);
    if (totalHealed > 0) {
      showToast(`✓ Re-merged ${totalHealed} numeral list items with their action blocks!`);
    } else {
      showToast('No orphaned numeral list items detected.');
    }
  }, [screenplayData, pushToUndoHistory, showToast]);

  // Detect if any scenes contain orphaned numeral list items
  const orphanedNumeralCount = useMemo(() => {
    let count = 0;
    const isNumeralBullet = (raw: string) => {
      const clean = (raw || '').replace(/<[^>]+>/g, '').replace(/[\s\u00A0]+/g, ' ').trim();
      return /^(\(?\d{1,4}[\.\)\:\-]?|\(?[a-zA-Z][\.\)\:\-]?|\(?[ivxIVX]{1,5}[\.\)\:\-]?)$/.test(clean);
    };
    (screenplayData.scenes || []).forEach((scene) => {
      for (let i = 0; i < (scene.items || []).length - 1; i++) {
        const cur = scene.items[i];
        const curText = (cur.leftAction || cur.rawText || '').trim();
        const curIsAction = cur.column === 'left' || cur.type === 'action' || (!cur.rightDialogue && (cur.leftAction || cur.rawText));
        if (curIsAction && isNumeralBullet(curText)) {
          const next = scene.items[i + 1];
          const nextText = (next.leftAction || next.rawText || '').trim();
          const nextIsAction = next.column === 'left' || next.type === 'action' || (!next.rightDialogue && (next.leftAction || next.rawText));
          if (nextIsAction && !isNumeralBullet(nextText) && nextText.length > 0) {
            count++;
          }
        }
      }
    });
    return count;
  }, [screenplayData]);

  // Merge multiple selected action (or dialogue) blocks into a single unified paragraph
  // (Fixes accidental comma splits or combines multiple shots into one paragraph)
  const handleMergeSelectedActionParagraphs = useCallback(() => {
    if (selectedItemIds.size <= 1) {
      showToast('Select 2 or more blocks to merge them into one paragraph.');
      return;
    }
    const now = Date.now();
    pushToUndoHistory(screenplayData);

    let totalMerged = 0;
    let targetItemId: string | null = null;

    setScreenplayData((prev) => {
      let changed = false;

      const nextScenes = prev.scenes.map((scene) => {
        // Collect selected items in this scene in reading order
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
              // Strip accidental trailing comma at merge boundaries to fix comma slips
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
          updatedAt: now,
        };

        localDirtyItemIdsRef.current.set(firstItem.id, now);
        absorbedIds.forEach((id) => {
          localDeletedItemIdsRef.current.add(id);
        });

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
      const next = { ...prev, scenes: nextScenes };
      screenplayDataRef.current = next;
      return next;
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
  }, [selectedItemIds, screenplayData, pushToUndoHistory, showToast]);

  // Mouse Drag / Marquee Multi-Block Selection
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only primary left mouse button
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    // Don't hijack clicks on buttons, inputs, dropdowns, links, or drag handles
    if (target.closest('button, input, select, textarea, a, [data-drag-handle], [role="menu"]')) {
      return;
    }

    // If clicking directly into an editable text element without Shift or Alt, let standard caret placement work
    const isInsideEditable = Boolean(target.closest('[contenteditable="true"]'));
    if (isInsideEditable && !e.shiftKey && !e.altKey) {
      return;
    }

    const isAccumulative = e.shiftKey || e.ctrlKey || e.metaKey;
    marqueeDragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      initialSelected: isAccumulative ? new Set(selectedItemIds) : new Set(),
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const state = marqueeDragStateRef.current;
      if (!state) return;

      const dx = moveEvent.clientX - state.startX;
      const dy = moveEvent.clientY - state.startY;

      // Check drag movement threshold (5px)
      if (!state.isDragging) {
        if (Math.hypot(dx, dy) < 5) return;
        state.isDragging = true;
        document.body.style.userSelect = 'none';
      }

      const left = Math.min(state.startX, moveEvent.clientX);
      const top = Math.min(state.startY, moveEvent.clientY);
      const width = Math.abs(dx);
      const height = Math.abs(dy);

      setMarqueeBox({ left, top, width, height });

      // Auto-scroll when near top or bottom edges of canvasScroller
      if (canvasScrollerRef.current) {
        const scrollerRect = canvasScrollerRef.current.getBoundingClientRect();
        if (moveEvent.clientY < scrollerRect.top + 50) {
          canvasScrollerRef.current.scrollTop -= 14;
        } else if (moveEvent.clientY > scrollerRect.bottom - 50) {
          canvasScrollerRef.current.scrollTop += 14;
        }
      }

      // Hit-test all script row cards with data-item-row-id
      const boxRect = {
        left,
        top,
        right: left + width,
        bottom: top + height,
      };

      const rows = document.querySelectorAll('[data-item-row-id]');
      const candidateSelection = new Set<string>(state.initialSelected);

      rows.forEach((row) => {
        const r = row.getBoundingClientRect();
        const overlaps = !(
          r.right < boxRect.left ||
          r.left > boxRect.right ||
          r.bottom < boxRect.top ||
          r.top > boxRect.bottom
        );
        if (overlaps) {
          const rowId = row.getAttribute('data-item-row-id');
          if (rowId) candidateSelection.add(rowId);
        }
      });

      setSelectedItemIds(candidateSelection);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';

      const state = marqueeDragStateRef.current;
      if (state) {
        // If it was just a plain click without dragging and not accumulative, deselect
        if (!state.isDragging && !isAccumulative && !isInsideEditable) {
          setSelectedItemIds(new Set());
        }
      }

      setMarqueeBox(null);
      marqueeDragStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [selectedItemIds]);

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
        targetEl.dispatchEvent(new CustomEvent('start-edit', { bubbles: true, detail: { caretPosition } }));
        targetEl.focus();
        if (targetEl instanceof HTMLInputElement) {
          if (caretPosition === 'start') {
            targetEl.setSelectionRange(0, 0);
          } else {
            const len = targetEl.value.length;
            targetEl.setSelectionRange(len, len);
          }
        } else {
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
    targetField: 'card' | 'auto' | 'action' | 'dialogue' | 'character' = 'card'
  ) => {
    const idx = orderedItemIds.indexOf(currentItemId);
    if (idx !== -1 && idx < orderedItemIds.length - 1) {
      const nextId = orderedItemIds[idx + 1];
      setSelectedItemIds(new Set([nextId]));
      setLastSelectedId(nextId);
      if (targetField === 'card') {
        const cardEl = document.getElementById(`script-row-card-${nextId}`);
        if (cardEl) {
          cardEl.focus({ preventScroll: true });
          scrollToItem(nextId, 'smooth');
        }
      } else {
        focusScriptItem(nextId, targetField, 'start');
      }
    } else if (idx === orderedItemIds.length - 1) {
      handleAddParagraphBelow(currentItemId, targetField === 'dialogue' ? 'right' : 'left');
    }
  };

  // Jump focus to previous row during keyboard editing
  const handleFocusPrevRow = (
    currentItemId: string,
    targetField: 'card' | 'auto' | 'action' | 'dialogue' | 'character' = 'card'
  ) => {
    const idx = orderedItemIds.indexOf(currentItemId);
    if (idx > 0) {
      const prevId = orderedItemIds[idx - 1];
      setSelectedItemIds(new Set([prevId]));
      setLastSelectedId(prevId);
      if (targetField === 'card') {
        const cardEl = document.getElementById(`script-row-card-${prevId}`);
        if (cardEl) {
          cardEl.focus({ preventScroll: true });
          scrollToItem(prevId, 'smooth');
        }
      } else {
        focusScriptItem(prevId, targetField, 'end');
      }
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

      // MERGE SELECTED PARAGRAPHS: Alt + M or Shift + M (when 2 or more blocks are selected)
      if (
        ((e.altKey && e.key.toLowerCase() === 'm') ||
         (!isInputFocused && e.shiftKey && e.key.toLowerCase() === 'm')) &&
        selectedItemIds.size > 1
      ) {
        e.preventDefault();
        handleMergeSelectedActionParagraphs();
        return;
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

        // Direct typing on selected block:
        // "if im trying to type something while the block is selected that means im trying to write a character name and it only applies if the block is assigned to dialogue."
        if (
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey &&
          e.key.length === 1 &&
          e.key !== ' '
        ) {
          const targetId =
            lastSelectedId ||
            (selectedItemIds.size === 1 ? Array.from(selectedItemIds)[0] : null);
          if (targetId) {
            let targetItem: TamilScriptItem | null = null;
            for (const sc of screenplayData.scenes) {
              const found = sc.items.find((i) => i.id === targetId);
              if (found) {
                targetItem = found;
                break;
              }
            }

            if (targetItem && (targetItem.column === 'right' || targetItem.type === 'dialogue')) {
              const charInput = document.querySelector(
                `[data-char-container="${targetId}"] input`
              ) as HTMLInputElement | null;
              if (charInput) {
                charInput.focus();
                // Without preventDefault, the typed character naturally types into the character input
                return;
              }
            }
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

  // Save changes to Vault and sync across all collaborators
  const saveToVault = useCallback((isManual = false, overrideData?: TamilScreenplayData) => {
    const projId = projectContext.currentProjectId || undefined;
    const currentData = overrideData || screenplayDataRef.current;
    const html = generateTamilLeftRightHtml(currentData);
    const plainText = (currentData.scenes || []).map((sc) => {
      const heading = sc.sluglineText || `Scene ${sc.sceneNumber}${sc.location ? ` - ${sc.location}` : ''}`;
      const itemsText = (sc.items || []).map((it) => {
        if (it.type === 'dialogue') return `${it.rightCharacter || 'Character'}: ${it.rightDialogue || ''}`;
        if (it.type === 'transition') return `> ${it.rawText || ''} <`;
        return it.leftAction || it.rawText || '';
      }).filter(Boolean).join('\n\n');
      return `${heading}\n\n${itemsText}`;
    }).join('\n\n---\n\n');

    let targetDoc = activeDoc;
    let nextList: ProductionDocument[] = [];

    const allDocs = getProductionDocuments(projId);

    if (!targetDoc) {
      targetDoc = {
        id: `doc-twocol-${Date.now()}`,
        projectId: projId,
        title: currentData.title || 'Untitled Screenplay',
        category: 'SCRIPT',
        fileName: `${(currentData.title || 'Screenplay').replace(/\s+/g, '_')}.pdf`,
        fileSize: '120 KB',
        fileType: 'script',
        pageCount: 1,
        uploadedAt: new Date().toISOString(),
        twoColumnData: currentData,
        textContent: plainText,
        htmlContent: html,
        isLeftRightFormat: true,
        hasTwoColumnScript: true,
        author: projectContext.currentUser || 'Collaborator',
        status: 'draft',
        tags: ['2-Column Script', 'Screenplay'],
        annotations: [],
        lastModified: new Date().toISOString()
      };
      nextList = [targetDoc, ...allDocs];
      setSelectedDocId(targetDoc.id);
    } else {
      const updated: ProductionDocument = {
        ...targetDoc,
        title: currentData.title || targetDoc.title,
        twoColumnData: currentData,
        textContent: plainText,
        htmlContent: html,
        isLeftRightFormat: true,
        hasTwoColumnScript: true,
        lastModified: new Date().toISOString(),
      };
      nextList = allDocs.some(d => d.id === updated.id) 
        ? allDocs.map(d => d.id === updated.id ? updated : d)
        : [updated, ...allDocs];
    }

    saveProductionDocuments(
      nextList, 
      projId, 
      false, 
      true, 
      projectContext.currentUser || 'user', 
      clientInstanceIdRef.current
    );
    setDocuments(nextList);
    setHasUnsavedChanges(false);
    setIsAutoSaving(false);
    setLastSavedAt(new Date());

    // Instant Supabase Broadcast across active collaborators
    if (isSupabaseConfigured && projId) {
      try {
        const chan = supabase.channel(`project_changes_${projId}`);
        chan.send({
          type: 'broadcast',
          event: 'two_column_script_synced',
          payload: {
            projectId: projId,
            docId: targetDoc.id,
            twoColumnData: currentData,
            senderId: projectContext.currentUser || 'user',
            senderInstanceId: clientInstanceIdRef.current,
          }
        }).catch(() => {});

        chan.send({
          type: 'broadcast',
          event: 'vault_documents_updated',
          payload: {
            projectId: projId,
            documents: nextList,
            senderId: projectContext.currentUser || 'user',
            senderInstanceId: clientInstanceIdRef.current,
            timestamp: Date.now()
          }
        }).catch(() => {});
      } catch (e) {}
    }

    // Trigger Cloud Project Sync on manual save (Cmd+S / Save button)
    if (isManual) {
      projectContext.setHasUnsavedChanges?.(true);
      if (projectContext.isCloudMode) {
        projectContext.saveProject?.();
      }
      confetti({ particleCount: 25, spread: 50, origin: { y: 0.8 } });
      showToast('✓ Saved 2-Column Screenplay & Synced with Collaborators!');
    }
  }, [activeDoc, projectContext]);

  // Instant real-time collaborative sync across Supabase channels
  useEffect(() => {
    const projId = projectContext.currentProjectId;
    if (!isSupabaseConfigured || !projId) return;

    const channel = supabase.channel(`project_changes_${projId}`)
      .on(
        'broadcast',
        { event: 'two_column_script_synced' },
        (msg: any) => {
          const payload = msg.payload;
          if (!payload || !payload.twoColumnData) return;
          // Ignore own broadcast
          if (payload.senderInstanceId && payload.senderInstanceId === clientInstanceIdRef.current) return;
          if (payload.senderId && payload.senderId === projectContext.currentUser && !payload.senderInstanceId) return;

          console.log('[TwoColumn] Live update received from collaborator:', payload.senderId);
          const currentLocal = screenplayDataRef.current;
          const merged = mergeTwoColumnData(
            currentLocal,
            payload.twoColumnData,
            activeTypingItemIdRef.current,
            localDirtyItemIdsRef.current,
            localDeletedItemIdsRef.current,
            localDeletedSceneIdsRef.current
          );

          screenplayDataRef.current = merged;
          setScreenplayData(merged);

          // Update local documents cache
          const allDocs = getProductionDocuments(projId);
          const nextDocs = allDocs.map((d) => d.id === payload.docId ? { ...d, twoColumnData: merged } : d);
          setDocuments(nextDocs);
          saveProductionDocuments(nextDocs, projId, true);
        }
      )
      .on(
        'broadcast',
        { event: 'vault_documents_updated' },
        (msg: any) => {
          const payload = msg.payload || msg;
          if (!payload || !payload.documents) return;
          if (payload.senderInstanceId && payload.senderInstanceId === clientInstanceIdRef.current) return;
          if (payload.senderId && payload.senderId === projectContext.currentUser && !payload.senderInstanceId) return;

          console.log('[TwoColumn] Live documents updated from collaborator:', payload.senderId);
          const incoming: ProductionDocument[] = payload.documents;
          setDocuments((prev) => mergeProductionDocuments(prev, incoming));

          // Check if active document or newly uploaded script needs to update screenplayData
          const activeStorageId = typeof localStorage !== 'undefined' ? localStorage.getItem('active_two_column_doc_id') : null;
          const curId = activeStorageId || selectedDocId;
          const matchedDoc = incoming.find((d: any) => d.id === curId);
          if (matchedDoc && matchedDoc.twoColumnData && Array.isArray(matchedDoc.twoColumnData.scenes)) {
            const merged = mergeTwoColumnData(
              screenplayDataRef.current,
              matchedDoc.twoColumnData,
              activeTypingItemIdRef.current,
              localDirtyItemIdsRef.current,
              localDeletedItemIdsRef.current,
              localDeletedSceneIdsRef.current
            );
            screenplayDataRef.current = merged;
            setScreenplayData(merged);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectContext.currentProjectId, projectContext.currentUser]);

  // Real-time synchronization from remote collaborators
  useEffect(() => {
    const handleDocsUpdated = (e: any) => {
      if (e.detail?.senderInstanceId && e.detail.senderInstanceId === clientInstanceIdRef.current) {
        return;
      }
      const incoming = Array.isArray(e.detail) 
        ? e.detail 
        : (e.detail?.docs && Array.isArray(e.detail.docs) ? e.detail.docs : null);
      if (!incoming) return;
      
      setDocuments(incoming);
      
      const activeStorageId = typeof localStorage !== 'undefined' ? localStorage.getItem('active_two_column_doc_id') : null;
      const curId = activeStorageId || selectedDocId;
      const remoteDoc = incoming.find((d: any) => d.id === curId)
        || incoming.find((d: any) => d.isLeftRightFormat || d.hasTwoColumnScript || d.category === 'SCRIPT');
      if (remoteDoc) {
        if (selectedDocId !== remoteDoc.id) {
          setSelectedDocId(remoteDoc.id);
        }
        if (remoteDoc.twoColumnData && Array.isArray(remoteDoc.twoColumnData.scenes)) {
          const merged = mergeTwoColumnData(
            screenplayDataRef.current,
            remoteDoc.twoColumnData,
            activeTypingItemIdRef.current,
            localDirtyItemIdsRef.current,
            localDeletedItemIdsRef.current,
            localDeletedSceneIdsRef.current
          );
          screenplayDataRef.current = merged;
          setScreenplayData(merged);
        } else if (!hasUnsavedChanges) {
          const raw = remoteDoc.textContent || '';
          if (raw.trim()) {
            const parsed = parseScreenplayToTamilLeftRight(raw, remoteDoc.title);
            const merged = mergeTwoColumnData(
              screenplayDataRef.current,
              parsed,
              activeTypingItemIdRef.current,
              localDirtyItemIdsRef.current,
              localDeletedItemIdsRef.current,
              localDeletedSceneIdsRef.current
            );
            screenplayDataRef.current = merged;
            setScreenplayData(parsed);
          }
        }
      }
    };
    window.addEventListener('backstage_documents_updated', handleDocsUpdated);
    return () => window.removeEventListener('backstage_documents_updated', handleDocsUpdated);
  }, [selectedDocId, hasUnsavedChanges]);

  // Automatic Debounced Live-Save (saves in background 1.5s after editing stops)
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    setIsAutoSaving(true);
    const timer = setTimeout(() => {
      saveToVault(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, saveToVault]);

  // Flush unsaved changes immediately on page reload / close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasUnsavedChanges && activeDoc) {
        const projId = projectContext.currentProjectId || undefined;
        const html = generateTamilLeftRightHtml(screenplayData);
        const plainText = (screenplayData.scenes || []).map((sc) => {
          const heading = sc.sluglineText || `Scene ${sc.sceneNumber}${sc.location ? ` - ${sc.location}` : ''}`;
          const itemsText = (sc.items || []).map((it) => {
            if (it.type === 'dialogue') return `${it.rightCharacter || 'Character'}: ${it.rightDialogue || ''}`;
            if (it.type === 'transition') return `> ${it.rawText || ''} <`;
            return it.leftAction || it.rawText || '';
          }).filter(Boolean).join('\n\n');
          return `${heading}\n\n${itemsText}`;
        }).join('\n\n---\n\n');

        const updated: ProductionDocument = {
          ...activeDoc,
          title: screenplayData.title || activeDoc.title,
          twoColumnData: screenplayData,
          textContent: plainText,
          htmlContent: html,
          isLeftRightFormat: true,
          hasTwoColumnScript: true,
          lastModified: new Date().toISOString(),
        };
        const nextList = documents.map((d) => (d.id === updated.id ? updated : d));
        saveProductionDocuments(nextList, projId);
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
      <header className={`px-4 py-2 border-b flex items-center justify-between gap-3 shrink-0 shadow-xs z-30 ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#121217] border-zinc-800/90 text-zinc-100'
      }`}>
        {/* Left: Studio Brand, Document Title & Scenes / Find triggers */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded-lg border shrink-0 ${
              isLight
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}>
              <Columns size={16} />
            </span>
            <div className="min-w-0 relative" ref={docSwitcherRef}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[11px] font-black uppercase tracking-wider ${
                  isLight ? 'text-emerald-700' : 'text-emerald-400'
                }`}>
                  Kollywood 2-Column
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono border ${
                  isLight
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50'
                }`}>
                  {totalPages} {totalPages === 1 ? 'Page' : 'Pages'}
                </span>

                {/* Script Switcher Dropdown Button */}
                {scriptVaultDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsDocSwitcherOpen(!isDocSwitcherOpen)}
                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold flex items-center gap-1 border transition-all cursor-pointer ${
                      isDocSwitcherOpen
                        ? 'bg-emerald-500 text-black border-emerald-400'
                        : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700/60'
                    }`}
                    title="Switch active script from Vault"
                  >
                    <span>{scriptVaultDocs.length} {scriptVaultDocs.length === 1 ? 'Script' : 'Scripts'}</span>
                    <ChevronDown size={11} className={`transition-transform ${isDocSwitcherOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
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
                  className={`text-sm font-bold bg-transparent px-1.5 py-0.5 -ml-1.5 rounded-md border border-transparent transition-all outline-none truncate max-w-[150px] sm:max-w-[220px] md:max-w-[280px] ${
                    isLight
                      ? 'hover:border-slate-300 focus:border-emerald-500 focus:bg-white text-slate-800'
                      : 'hover:border-zinc-700 focus:border-emerald-500 focus:bg-zinc-900 text-zinc-100'
                  }`}
                  title="Click to rename document"
                  placeholder="Untitled Screenplay"
                />
                <Edit2 size={11} className="opacity-0 group-hover/title:opacity-60 transition-opacity pointer-events-none text-slate-400 dark:text-zinc-500 shrink-0" />
              </div>

              {/* Document Switcher Dropdown Menu */}
              {isDocSwitcherOpen && (
                <div className={`absolute top-full left-0 mt-1.5 w-72 sm:w-80 rounded-xl border shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md ${
                  isLight ? 'bg-white/95 border-slate-200 text-slate-900' : 'bg-[#18181c]/95 border-zinc-700/80 text-zinc-100'
                }`}>
                  <div className={`px-3 py-1.5 border-b text-[10px] font-black uppercase tracking-wider flex items-center justify-between ${
                    isLight ? 'border-slate-100 text-slate-500' : 'border-zinc-800 text-zinc-400'
                  }`}>
                    <span>Scripts in Vault ({scriptVaultDocs.length})</span>
                    <button
                      onClick={() => {
                        setIsDocSwitcherOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="text-emerald-500 hover:underline flex items-center gap-1 font-bold lowercase first-letter:uppercase"
                    >
                      <Plus size={10} /> Import script
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto py-1 divide-y divide-transparent">
                    {scriptVaultDocs.map((doc) => {
                      const isCurrent = doc.id === activeDoc?.id || doc.id === selectedDocId;
                      return (
                        <div
                          key={doc.id}
                          onClick={() => handleSelectScriptDoc(doc.id)}
                          className={`px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                            isCurrent
                              ? isLight
                                ? 'bg-emerald-50 text-emerald-900 font-bold'
                                : 'bg-emerald-500/15 text-emerald-300 font-bold'
                              : isLight
                              ? 'hover:bg-slate-100 text-slate-800'
                              : 'hover:bg-zinc-800/70 text-zinc-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <FileText size={12} className={isCurrent ? 'text-emerald-500 shrink-0' : 'text-zinc-400 shrink-0'} />
                              <span className="text-xs truncate">{doc.title}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-60 font-mono">
                              <span>{doc.pageCount || 1} {doc.pageCount === 1 ? 'pg' : 'pgs'}</span>
                              <span>•</span>
                              <span>{doc.fileSize || 'Doc'}</span>
                              {doc.isLeftRightFormat && <span className="text-emerald-500">• 2-Col</span>}
                            </div>
                          </div>

                          {isCurrent && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {onNavigateToView && (
                    <div className={`pt-1.5 px-3 border-t flex items-center justify-between text-[11px] ${
                      isLight ? 'border-slate-100 text-slate-600' : 'border-zinc-800 text-zinc-400'
                    }`}>
                      <button
                        onClick={() => {
                          setIsDocSwitcherOpen(false);
                          onNavigateToView('documents');
                        }}
                        className="hover:text-amber-500 transition-colors flex items-center gap-1 py-1"
                      >
                        <Folder size={11} />
                        <span>Manage in Document Vault</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={`w-[1px] h-5 mx-0.5 hidden sm:block ${isLight ? 'bg-slate-200' : 'bg-zinc-700/60'}`} />

          {/* Scenes Sidebar Toggle */}
          <button
            onClick={() => setIsSceneSidebarOpen(!isSceneSidebarOpen)}
            className={`px-2 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              isSceneSidebarOpen
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                : isLight
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
            title="Toggle Scene Cards Navigator (Left side)"
          >
            <PanelLeft size={13} className={isSceneSidebarOpen ? 'text-white' : isLight ? 'text-emerald-600' : 'text-emerald-400'} />
            <span className="hidden md:inline">Scenes</span>
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
            className={`px-2 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
            title="Find & Replace in script (Cmd+F / Ctrl+F)"
          >
            <Search size={13} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
            <span className="hidden lg:inline">Find</span>
          </button>

          {/* Back to Vault Button */}
          {onNavigateToView && (
            <button
              onClick={() => onNavigateToView('documents')}
              className={`px-2 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
              }`}
              title="Return to Document Vault"
            >
              <Folder size={13} className="text-amber-400" />
              <span className="hidden xl:inline">Vault</span>
            </button>
          )}
        </div>

        {/* Center: Add Scene, Undo/Redo & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Add Scene Button */}
          <button
            onClick={() => handleInsertScene(undefined, 'end')}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Add a new scene on a fresh page"
          >
            <Plus size={14} className="stroke-[3]" />
            <span>Add Scene</span>
          </button>

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

          {/* Zoom controls */}
          <div className={`hidden lg:flex items-center gap-0.5 border rounded-lg p-0.5 ${
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
        </div>

        {/* Right: Breakdown, Style, Export Dropdown, Unified Cloud Status, Shortcuts */}
        <div className="flex items-center gap-2">
          {/* Breakdown Drawer Toggle */}
          <button
            onClick={() => {
              setIsBreakdownDrawerOpen(!isBreakdownDrawerOpen);
              if (!isBreakdownDrawerOpen && isStyleDrawerOpen) {
                setIsStyleDrawerOpen(false);
              }
              if (!activeBreakdownSceneId && screenplayData.scenes[0]) {
                setActiveBreakdownSceneId(screenplayData.scenes[0].id);
              }
            }}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              isBreakdownDrawerOpen
                ? isLight
                  ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-xs'
                : isLight
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
            title="Open Production Breakdown Drawer"
          >
            <ListChecks size={13} className={isBreakdownDrawerOpen ? 'text-amber-500' : isLight ? 'text-slate-500' : 'text-zinc-400'} />
            <span className="hidden sm:inline">Breakdown</span>
            {totalTwoColumnBreakdownItems > 0 && (
              <span
                className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded-full"
                style={{ backgroundColor: `${appAccentColor}25`, color: appAccentColor }}
              >
                {totalTwoColumnBreakdownItems}
              </span>
            )}
          </button>

          {/* Format & Style Drawer Toggle */}
          <button
            onClick={() => {
              setIsStyleDrawerOpen(!isStyleDrawerOpen);
              if (!isStyleDrawerOpen && isBreakdownDrawerOpen) {
                setIsBreakdownDrawerOpen(false);
              }
            }}
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
            <span className="hidden sm:inline">Style</span>
          </button>

          {/* Consolidated Export Dropdown Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isExportMenuOpen
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-sm'
                  : isLight
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200/90'
                  : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-800/50'
              }`}
              title="Export Screenplay (PDF, Word docx, Print)"
            >
              <FileDown size={13} className={isExportMenuOpen ? 'text-black' : 'text-emerald-500'} />
              <span>Export</span>
              <ChevronDown size={11} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div className={`absolute right-0 top-full mt-1.5 w-64 rounded-xl border shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
                isLight ? 'bg-white/95 border-slate-200 text-slate-800 shadow-[0_12px_32px_rgba(0,0,0,0.12)]' : 'bg-zinc-950/95 border-zinc-800 text-zinc-100 shadow-2xl'
              }`}>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    setIsExportModalOpen(true);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-zinc-800 text-zinc-100'
                  }`}
                >
                  <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-500">
                    <FileDown size={15} />
                  </div>
                  <div>
                    <div className="font-bold">Export PDF Studio</div>
                    <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Preview & customize 2-column PDF</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleDownloadWordDocx();
                  }}
                  disabled={isExportingDocx}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                    isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-zinc-800 text-zinc-100'
                  }`}
                >
                  <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
                    <Download size={15} />
                  </div>
                  <div>
                    <div className="font-bold">{isExportingDocx ? 'Exporting...' : 'Word (.docx)'}</div>
                    <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Tamil 2-column Word document</div>
                  </div>
                </button>

                <div className={`h-[1px] my-0.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    printTwoColumnVector(screenplayData);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-zinc-800 text-zinc-100'
                  }`}
                >
                  <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-500">
                    <Printer size={15} />
                  </div>
                  <div>
                    <div className="font-bold">Print Screenplay</div>
                    <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>Browser native vector print</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Unified Cloud Status & Manual Save Button */}
          <button
            onClick={() => saveToVault(true)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isAutoSaving
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
                : hasUnsavedChanges
                ? 'bg-amber-500 text-black border-amber-600 hover:bg-amber-400 shadow-xs'
                : isLight
                ? 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 border-emerald-200/80'
                : 'bg-emerald-950/25 hover:bg-emerald-900/40 text-emerald-300 border-emerald-800/40'
            }`}
            title={
              isAutoSaving
                ? 'Auto-saving changes to Vault & Cloud...'
                : hasUnsavedChanges
                ? 'Changes detected (Click to Save Now)'
                : `Synced to Cloud (${lastSavedAt ? lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}) • Click to force save`
            }
          >
            {isAutoSaving ? (
              <>
                <Loader2 size={12} className="animate-spin text-amber-500 shrink-0" />
                <span className="text-[11px] font-bold">Syncing...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <Save size={12} className="text-black shrink-0" />
                <span className="text-[11px] font-bold">Save Now</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold hidden sm:inline">Synced</span>
              </>
            )}
          </button>

          {/* Keyboard Shortcuts Cheatsheet */}
          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className={`p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
            title="Keyboard Shortcuts Cheatsheet (? / F1)"
          >
            <Keyboard size={14} className={isLight ? 'text-slate-500' : 'text-zinc-400'} />
          </button>
        </div>
      </header>

      {/* =========================================================================
          FLOATING SELECTION TOOLBAR (Fixed Overlay HUD - Never shifts screen position)
         ========================================================================= */}
      {selectedCount > 0 && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-fit max-w-[90vw] px-2 pointer-events-auto animate-in fade-in slide-in-from-top-1 duration-150 drop-shadow-2xl">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-md backdrop-blur-md transition-all text-xs ${
              isLight
                ? 'bg-white/90 border-slate-200/90 text-slate-700 shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
                : 'bg-zinc-900/90 border-zinc-800/90 text-zinc-200 shadow-[0_6px_20px_rgba(0,0,0,0.4)]'
            }`}
          >
            {/* Subtle Count Badge */}
            <span className="text-[10.5px] font-mono font-medium px-1.5 py-0.5 rounded text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 whitespace-nowrap">
              {selectedCount} sel
            </span>

            <div className={`w-[1px] h-3.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />

            {/* Compact Column Controls */}
            <div className={`flex items-center gap-0.5 p-0.5 rounded-md border ${
              isLight ? 'bg-slate-50/80 border-slate-200/70' : 'bg-zinc-950/40 border-zinc-800/60'
            }`}>
              <button
                onClick={() => moveParagraphsToColumn('left')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  isLight
                    ? 'hover:bg-white text-slate-600 hover:text-emerald-700'
                    : 'hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400'
                }`}
                title="Move highlighted to Left: காட்சி (Visual/Action) [ArrowLeft / Alt+Left]"
              >
                <ArrowLeft size={10} className="text-emerald-500" />
                <span>Left</span>
              </button>

              <button
                onClick={() => moveParagraphsToColumn('center')}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  isLight
                    ? 'hover:bg-white text-slate-600 hover:text-amber-700'
                    : 'hover:bg-zinc-800 text-zinc-300 hover:text-amber-400'
                }`}
                title="Move highlighted to Center: தலைப்பு (Heading/Transition) [ArrowUp / Alt+C]"
              >
                <span>Center</span>
              </button>

              <button
                onClick={() => moveParagraphsToColumn('right')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                  isLight
                    ? 'hover:bg-white text-slate-600 hover:text-sky-700'
                    : 'hover:bg-zinc-800 text-zinc-300 hover:text-sky-400'
                }`}
                title="Move highlighted to Right: வசனம் (Dialogue) [ArrowRight / Alt+Right]"
              >
                <span>Right</span>
                <ArrowRight size={10} className="text-sky-500" />
              </button>
            </div>

            {/* Comma Shot Splitter Button for Selected Action Blocks */}
            <button
              onClick={handleSplitSelectedActionsByComma}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer border ${
                isLight
                  ? 'bg-amber-50/80 border-amber-200/80 text-amber-800 hover:bg-amber-100'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
              }`}
              title="Split highlighted action blocks at commas/dots into single shot paragraphs (, or . = end of shot)"
            >
              <Scissors size={10} className="text-amber-500" />
              <span>Split Shots</span>
            </button>

            {/* Merge Selected Blocks Button (fixes accidental comma slips or combines blocks) */}
            {selectedCount > 1 && (
              <button
                onClick={handleMergeSelectedActionParagraphs}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-xs'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 shadow-xs'
                }`}
                title="Merge selected blocks into 1 single paragraph [Alt+M] (fixes accidental comma slip)"
              >
                <Combine size={10} className="text-emerald-500" />
                <span>Merge ({selectedCount})</span>
              </button>
            )}

            <div className={`w-[1px] h-3.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />

            {/* Compact Alignment Controls */}
            <div className={`flex items-center gap-0.5 p-0.5 rounded-md border ${
              isLight ? 'bg-slate-50/80 border-slate-200/70' : 'bg-zinc-950/40 border-zinc-800/60'
            }`}>
              <button
                onClick={() => handleUpdateItemAlignment('left')}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title="Align Left"
              >
                <AlignLeft size={11} />
              </button>
              <button
                onClick={() => handleUpdateItemAlignment('center')}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title="Align Center"
              >
                <AlignCenter size={11} />
              </button>
              <button
                onClick={() => handleUpdateItemAlignment('right')}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title="Align Right"
              >
                <AlignRight size={11} />
              </button>
              <button
                onClick={() => handleUpdateItemAlignment('justify')}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title="Justify"
              >
                <AlignJustify size={11} />
              </button>
            </div>

            {/* Compact Color Control */}
            <div className="relative">
              <button
                onClick={() => setBulkColorPickerOpen(!bulkColorPickerOpen)}
                className={`p-1 rounded-md transition-colors cursor-pointer border ${
                  isLight
                    ? 'bg-slate-50/80 hover:bg-white text-slate-600 border-slate-200/70'
                    : 'bg-zinc-950/40 hover:bg-zinc-800 text-zinc-300 border-zinc-800/60'
                }`}
                title="Text Color"
              >
                <Palette size={11} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
              </button>

              {bulkColorPickerOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute top-full right-0 mt-1.5 p-2 rounded-xl border shadow-xl z-50 flex flex-col gap-1.5 min-w-[140px] ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-800 shadow-[0_8px_24px_rgba(0,0,0,0.12)]'
                      : 'bg-zinc-950 border-zinc-700 text-zinc-100'
                  }`}
                >
                  <div className={`flex items-center justify-between text-[10px] font-mono pb-1 border-b ${
                    isLight ? 'text-slate-500 border-slate-200' : 'text-zinc-400 border-zinc-800'
                  }`}>
                    <span>Color</span>
                    <button
                      onClick={() => {
                        handleUpdateItemColor(selectedItemIds, undefined);
                        setBulkColorPickerOpen(false);
                      }}
                      className="text-amber-500 hover:text-amber-600 cursor-pointer flex items-center gap-0.5 text-[9.5px]"
                    >
                      <RotateCcw size={8} />
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
                        className={`w-4.5 h-4.5 rounded-full border hover:scale-110 cursor-pointer transition-transform ${
                          isLight ? 'border-slate-300' : 'border-zinc-700'
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={`w-[1px] h-3.5 ${isLight ? 'bg-slate-200' : 'bg-zinc-800'}`} />

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
              <X size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Marquee Drag-Selection Box */}
      {marqueeBox && (
        <div
          className="fixed pointer-events-none z-50 rounded-lg border border-amber-500/80 bg-amber-500/20 shadow-lg backdrop-blur-xs transition-none"
          style={{
            left: `${marqueeBox.left}px`,
            top: `${marqueeBox.top}px`,
            width: `${marqueeBox.width}px`,
            height: `${marqueeBox.height}px`,
            boxShadow: '0 0 16px rgba(245, 166, 35, 0.35)',
          }}
        >
          <div className="absolute top-1 left-1.5 px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-amber-500 text-black shadow-xs">
            {selectedItemIds.size > 0 ? `${selectedItemIds.size} selected` : 'Drag to Select'}
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
        <div
          ref={canvasScrollerRef}
          onMouseDown={handleCanvasMouseDown}
          onScroll={(e) => {
            try {
              localStorage.setItem('backstage_last_twocol_scroll_top', String(e.currentTarget.scrollTop));
            } catch {}
          }}
          className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center"
        >
          {/* Automatic Helper Banner: Split Numeral Items Detected */}
          {orphanedNumeralCount > 0 && (
            <div className="w-full max-w-[794px] mb-4 p-3.5 rounded-xl border bg-gradient-to-r from-amber-500/15 via-sky-500/10 to-amber-500/15 border-amber-500/30 flex flex-wrap items-center justify-between gap-3 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500 shrink-0">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className={`text-xs font-bold ${isLight ? 'text-amber-950' : 'text-amber-200'}`}>
                    Split Numeral List Items Detected ({orphanedNumeralCount})
                  </div>
                  <div className={`text-[11px] ${isLight ? 'text-amber-800' : 'text-amber-400/90'}`}>
                    Standalone numbers (1, 2, 3...) were separated from their action shots. Click to re-merge them back together.
                  </div>
                </div>
              </div>
              <button
                onClick={handleHealNumeralLists}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0"
              >
                <Sparkles size={13} />
                <span>Fix & Re-merge Numeral Lists Now</span>
              </button>
            </div>
          )}

          <div
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            className={`flex ${pageViewMode === 'spread' ? 'flex-row flex-wrap justify-center gap-8' : 'flex-col gap-10'} items-center pb-24 transition-transform`}
          >
            {pages.length === 0 && (
              <div className={`w-[720px] p-12 rounded-2xl border flex flex-col items-center justify-center text-center shadow-xl my-10 ${
                isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#181820] border-zinc-800 text-zinc-200'
              }`}>
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
                  <Columns size={32} />
                </div>
                <h3 className="text-lg font-bold mb-2">Clean Screenplay Ready</h3>
                <p className="text-xs text-zinc-400 max-w-md mb-6">
                  No scenes yet in this project. Start writing your 2-column Kollywood / Hollywood split script, or import from Document Vault.
                </p>
                <button
                  onClick={() => handleInsertScene(undefined, 'end')}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Add First Scene</span>
                </button>
              </div>
            )}
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
                className={`relative shadow-2xl rounded-xs transition-colors duration-200 border flex flex-col justify-between ${
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
                                        {elem.location || 'Location'}
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
                                        {elem.realLocation || elem.location || 'Real Location'}
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
                        splitActionByComma={layoutOptions.splitActionByComma}
                        splitActionIncludeDot={layoutOptions.splitActionIncludeDot}
                        onSplitActionByComma={handleSplitActionItemByComma}
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

            {/* "+ Add Next Scene (New Page)" Floating Bottom Action Bar */}
            {pages.length > 0 && (
              <div className="w-[794px] max-w-full flex items-center justify-center pt-6 pb-12">
                <button
                  type="button"
                  onClick={() => handleInsertScene(undefined, 'end')}
                  className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs sm:text-sm flex items-center gap-2.5 shadow-xl shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-600"
                >
                  <Plus size={18} className="stroke-[3]" />
                  <span>Add Scene {screenplayData.scenes.length + 1} (New Page)</span>
                </button>
              </div>
            )}
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
                  onChange={(e) => {
                    const newFont = e.target.value;
                    try {
                      localStorage.setItem('user_pref_two_col_font', newFont);
                    } catch (err) {}
                    setLayoutOptions((prev) => ({ ...prev, baseFontFamily: newFont }));
                  }}
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
                  min="12"
                  max="24"
                  step="0.5"
                  value={layoutOptions.baseFontSizePx || 17}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLayoutOptions((prev) => ({ ...prev, baseFontSizePx: val }));
                    if (typeof localStorage !== 'undefined') {
                      localStorage.setItem('user_pref_two_col_font_size', String(val));
                    }
                    setHasUnsavedChanges(true);
                  }}
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

            {/* Action Shots Split by Comma & Dot (Single Shot per Paragraph) */}
            <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-zinc-800'}`}>
              <div className="flex items-center justify-between">
                <label className={`text-xs font-bold font-mono uppercase ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Action Shots (Single Shot per Paragraph)
                </label>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  layoutOptions.splitActionByComma
                    ? (isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/20 text-amber-300')
                    : (isLight ? 'bg-slate-100 text-slate-500' : 'bg-zinc-800 text-zinc-500')
                }`}>
                  {layoutOptions.splitActionByComma ? 'ENABLED' : 'OFF (Default)'}
                </span>
              </div>
              <p className={`text-[11px] leading-tight ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                In the Action column (காட்சி), each comma represents the end of a shot. Enable to split action blocks into individual single-shot paragraphs.
              </p>

              <div className="space-y-2">
                {/* 1. Comma Split Toggle (Default OFF) */}
                <label className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                  layoutOptions.splitActionByComma
                    ? (isLight ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-amber-500/10 border-amber-500/40 text-amber-300')
                    : (isLight ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60')
                }`}>
                  <div>
                    <div className="text-xs font-bold">Split Action Blocks by Comma ( , )</div>
                    <div className="text-[10px] opacity-70">Each comma creates a new single-shot paragraph</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!layoutOptions.splitActionByComma}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setLayoutOptions((prev) => ({ ...prev, splitActionByComma: enabled }));
                      try {
                        localStorage.setItem('user_pref_two_col_split_comma', String(enabled));
                      } catch {}
                      setHasUnsavedChanges(true);
                    }}
                    className="accent-amber-500 cursor-pointer w-4 h-4 ml-2"
                  />
                </label>

                {/* 2. Optional Dot Split Toggle (Default OFF) */}
                <label className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                  layoutOptions.splitActionIncludeDot
                    ? (isLight ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-amber-500/10 border-amber-500/40 text-amber-300')
                    : (isLight ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60')
                }`}>
                  <div>
                    <div className="text-xs font-bold">Also Split on Period / Dot ( . ) (Optional)</div>
                    <div className="text-[10px] opacity-70">Treat full stops as shot boundaries</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!layoutOptions.splitActionIncludeDot}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setLayoutOptions((prev) => ({ ...prev, splitActionIncludeDot: enabled }));
                      try {
                        localStorage.setItem('user_pref_two_col_split_dot', String(enabled));
                      } catch {}
                      setHasUnsavedChanges(true);
                    }}
                    className="accent-amber-500 cursor-pointer w-4 h-4 ml-2"
                  />
                </label>

                {/* 3. Batch Split Action Blocks Button */}
                <button
                  type="button"
                  onClick={handleSplitAllActionsByComma}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border shadow-xs ${
                    isLight
                      ? 'bg-amber-500 hover:bg-amber-600 text-black border-amber-500'
                      : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border-amber-500/40'
                  }`}
                  title="Scan entire script and split all comma/dot separated action blocks into single shot paragraphs"
                >
                  <Scissors size={12} />
                  <span>Split All Existing Action Blocks Now</span>
                </button>

                {/* 4. Fix / Re-merge Numeral Lists Button */}
                <button
                  type="button"
                  onClick={handleHealNumeralLists}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border shadow-xs ${
                    isLight
                      ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300'
                      : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border-sky-500/35'
                  }`}
                  title="Recombine standalone numeral blocks (1, 2, 3...) back into their action shot paragraphs"
                >
                  <Sparkles size={12} className="text-sky-500" />
                  <span>Re-merge / Fix Numeral Lists</span>
                </button>

                {/* 5. Merge Selected Blocks Button */}
                <button
                  type="button"
                  disabled={selectedItemIds.size < 2}
                  onClick={handleMergeSelectedActionParagraphs}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border shadow-xs disabled:opacity-40 disabled:cursor-not-allowed ${
                    isLight
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/35'
                  }`}
                  title="Merge currently selected blocks into 1 single paragraph [Alt+M] (fixes accidental comma slip)"
                >
                  <Combine size={12} className="text-emerald-500" />
                  <span>Merge Selected Blocks {selectedItemIds.size > 1 ? `(${selectedItemIds.size})` : ''}</span>
                </button>
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
                  checked={layoutOptions.autoEndSceneCutTo === true}
                  onChange={(e) => {
                    setLayoutOptions((prev) => ({ ...prev, autoEndSceneCutTo: e.target.checked }));
                    setHasUnsavedChanges(true);
                  }}
                  className="accent-emerald-500 cursor-pointer h-4 w-4"
                />
              </div>

              {/* Custom Transition Text Input */}
              {layoutOptions.autoEndSceneCutTo === true && (
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

        {/* =====================================================================
            15-CATEGORY PRODUCTION BREAKDOWN DRAWER (Collapsible)
           ===================================================================== */}
        {isBreakdownDrawerOpen && activeBreakdownScene && (
          <aside className={`w-96 shrink-0 border-l overflow-y-auto p-5 shadow-2xl flex flex-col gap-4 z-30 transition-all custom-scrollbar ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#141419] border-zinc-800 text-zinc-100'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between pb-3 border-b ${
              isLight ? 'border-slate-200' : 'border-zinc-700/50'
            }`}>
              <div className="flex items-center gap-2">
                <ListChecks size={16} className="text-[#f5a623]" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider">15-Category Breakdown</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded"
                      style={{ backgroundColor: `${appAccentColor}20`, color: appAccentColor }}
                    >
                      {totalTwoColumnBreakdownItems} items
                    </span>
                    <button
                      onClick={handleSyncAllBreakdownsFromBeats}
                      className="text-[10px] font-bold text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Sync all breakdown items from Screenplay & Mass Breakdown"
                    >
                      <RefreshCw size={10} /> Sync
                    </button>
                    {onNavigateToView && (
                      <button
                        onClick={() => onNavigateToView('breakdown')}
                        className="text-[10px] font-bold text-amber-500 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Open full studio view"
                      >
                        Full Studio <ArrowRight size={10} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsBreakdownDrawerOpen(false)}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-900' : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <X size={15} />
              </button>
            </div>

            {/* Scene Selector */}
            <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-zinc-800'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Target Scene
                </label>
                <span className={`text-[10px] font-mono font-bold ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                  Scene {activeBreakdownScene.sceneNumber || 1} of {screenplayData.scenes.length}
                </span>
              </div>
              <select
                value={activeBreakdownScene.id}
                onChange={(e) => setActiveBreakdownSceneId(e.target.value)}
                className={`w-full text-xs font-bold rounded-lg p-2 outline-none border transition-colors cursor-pointer ${
                  isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                }`}
              >
                {screenplayData.scenes.map((s) => {
                  const sCount = ALL_15_CATEGORIES.reduce(
                    (sum, cat) => sum + getTwoColumnCategoryItems(s.breakdown, cat).length,
                    0
                  );
                  return (
                    <option key={s.id} value={s.id}>
                      Scene {s.sceneNumber}: {s.location || 'UNTITLED'} ({s.timeOfDay || 'DAY'}) {sCount > 0 ? `• [${sCount} tags]` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* AI Auto-Analyze & Language Toggle */}
            <div className={`p-3 rounded-xl border ${isLight ? 'bg-amber-50/50 border-amber-200/60' : 'bg-amber-500/5 border-amber-500/20'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                  AI Breakdown
                </span>
                <div className={`flex rounded border p-0.5 ${isLight ? 'bg-white border-slate-200' : 'bg-black border-zinc-800'}`}>
                  <button
                    onClick={() => setBreakdownLanguage('english')}
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded transition-colors cursor-pointer ${
                      breakdownLanguage === 'english' ? 'shadow-xs' : (isLight ? 'text-slate-500 hover:text-slate-800' : 'text-zinc-400 hover:text-white')
                    }`}
                    style={breakdownLanguage === 'english' ? { backgroundColor: appAccentColor, color: '#000000' } : undefined}
                  >
                    ENG
                  </button>
                  <button
                    onClick={() => setBreakdownLanguage('tamil')}
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded transition-colors cursor-pointer ${
                      breakdownLanguage === 'tamil' ? 'shadow-xs' : (isLight ? 'text-slate-500 hover:text-slate-800' : 'text-zinc-400 hover:text-white')
                    }`}
                    style={breakdownLanguage === 'tamil' ? { backgroundColor: appAccentColor, color: '#000000' } : undefined}
                  >
                    TAM
                  </button>
                </div>
              </div>
              <button
                onClick={handleAnalyzeTwoColumnBreakdown}
                disabled={isAnalyzingBreakdown || !aiAvailable}
                className="w-full py-2 font-bold text-xs uppercase rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-xs hover:brightness-110 cursor-pointer"
                style={{ backgroundColor: appAccentColor, color: '#000000' }}
              >
                {isAnalyzingBreakdown ? (
                  <>
                    <Sparkles size={14} className="animate-spin" />
                    <span>Analyzing 15 Categories...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Auto-Analyze Scene (15 Categories)</span>
                  </>
                )}
              </button>
            </div>

            {/* 15 Production Department Sections */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                  15 Production Departments
                </span>
              </div>

              {ALL_15_CATEGORIES.map((category) => {
                const meta = CATEGORY_REGISTRY[category] || {
                  key: category,
                  nameEn: category,
                  nameTa: category,
                  color: '#f5a623',
                  bgColor: 'rgba(245, 166, 35, 0.15)',
                  borderColor: '#f5a623',
                  iconName: 'Tag',
                };
                const IconComponent = getBreakdownCategoryIcon(meta.iconName);
                const items = getTwoColumnCategoryItems(activeBreakdownScene.breakdown, category);
                const isDragOver = dragOverBreakdownCategory === category;
                const inputValue = newTagInputs[category] || '';

                return (
                  <div
                    key={category}
                    className={`border rounded-lg overflow-hidden transition-all ${
                      isLight
                        ? 'bg-slate-50/80 border-slate-200 shadow-2xs'
                        : 'bg-[#181818] border-[#2b2b2b]'
                    }`}
                    style={isDragOver ? { borderColor: meta.color, boxShadow: `0 0 0 2px ${meta.color}80` } : undefined}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverBreakdownCategory(category);
                    }}
                    onDragLeave={() => setDragOverBreakdownCategory(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverBreakdownCategory(null);
                      const data = e.dataTransfer.getData('text/plain');
                      if (!data) return;
                      try {
                        const { category: srcCat, item: itmName } = JSON.parse(data);
                        if (srcCat === category) return;
                        handleRemoveTwoColumnTag(srcCat as BreakdownCategory, itmName);
                        handleAddTwoColumnTag(category, itmName);
                      } catch (err) {
                        console.error('Drop error:', err);
                      }
                    }}
                  >
                    {/* Category Title Banner */}
                    <div
                      className="flex items-center justify-between gap-2 px-3 py-2 border-b"
                      style={{
                        backgroundColor: isLight ? meta.bgColor : `${meta.color}15`,
                        borderColor: isLight ? `${meta.color}35` : `${meta.color}30`,
                      }}
                    >
                      <span
                        className="text-[10.5px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5"
                        style={{ color: meta.color }}
                      >
                        <IconComponent size={12} style={{ color: meta.color }} />
                        <span>{breakdownLanguage === 'tamil' ? meta.nameTa : meta.nameEn}</span>
                      </span>
                      <span
                        className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isLight ? 'bg-white/80 text-slate-700 border border-slate-200' : 'bg-black/50 text-slate-200 border border-white/10'
                        }`}
                      >
                        {items.length}
                      </span>
                    </div>

                    {/* Items List */}
                    <div className="p-2.5">
                      <div className="flex flex-wrap gap-1.5 min-h-[24px] my-1">
                        {items.length === 0 && (
                          <span className={`text-[10px] italic select-none py-0.5 px-1 ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                            No items tagged
                          </span>
                        )}
                        {items.map((item, i) => {
                          const name = typeof item === 'string' ? item : item.name;
                          const source = typeof item === 'string' ? undefined : item.source;
                          return (
                            <div
                              key={i}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', JSON.stringify({ category, item: name }));
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10.5px] border group cursor-move transition-all ${
                                isLight
                                  ? 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 shadow-2xs'
                                  : 'bg-zinc-900 text-zinc-100 border-zinc-800 hover:border-zinc-700'
                              }`}
                              title={source ? `Source: "${source}"` : undefined}
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                              <span>{name}</span>
                              <button
                                onClick={() => handleRemoveTwoColumnTag(category, name)}
                                className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500 hover:text-white cursor-pointer ${
                                  isLight ? 'text-slate-400' : 'text-zinc-500'
                                }`}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Item Input */}
                      <div className="flex gap-1 mt-2">
                        <input
                          value={inputValue}
                          onChange={(e) =>
                            setNewTagInputs((prev) => ({ ...prev, [category]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && inputValue.trim()) {
                              handleAddTwoColumnTag(category, inputValue.trim());
                            }
                          }}
                          className={`flex-1 border rounded px-2 py-1 text-[10px] outline-none transition-colors ${
                            isLight
                              ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                              : 'bg-black/50 border-zinc-700 text-zinc-100 placeholder-zinc-500'
                          }`}
                          placeholder={`Add ${breakdownLanguage === 'tamil' ? meta.nameTa : meta.nameEn}...`}
                        />
                        <button
                          onClick={() => {
                            if (inputValue.trim()) {
                              handleAddTwoColumnTag(category, inputValue.trim());
                            }
                          }}
                          className={`px-2 rounded flex items-center justify-center transition-colors cursor-pointer ${
                            isLight
                              ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
