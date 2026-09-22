import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';
import { 
  BreakdownData, 
  BreakdownItem, 
  BreakdownCategory, 
  CATEGORY_REGISTRY, 
  Beat, 
  AppTask, 
  TaskSubtask, 
  ViewMode 
} from '../../types';
import { generateBreakdown } from '../../services/gemini';
import { batchBreakdownManager, BatchProgressState } from '../../services/batchBreakdownService';
import { saveBreakdownToVault } from '../../services/documentsStorage';
import { syncBreakdownToDepartmentsAndContinuity } from '../../utils/breakdownSync';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import {
  Sparkles,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Printer,
  CheckSquare,
  Square,
  Play,
  Pause,
  XCircle,
  Clock,
  Layers,
  Filter,
  CheckCircle2,
  ListFilter,
  Check,
  FileText,
  Film,
  Download,
  Share2,
  RefreshCw,
  FolderOpen,
  LayoutGrid,
  List as ListIcon,
  Search,
  Zap,
  ArrowRight,
  Eye,
  Sliders,
  AlertCircle,
  X,
  UserCheck,
  Users,
  Flame,
  Car,
  Package,
  Shirt,
  Palette,
  Cat,
  Volume2,
  Home,
  TreePine,
  Camera,
  AlertTriangle,
} from 'lucide-react';

export interface BreakdownViewProps {
  allTasks?: AppTask[];
  onUpdateTask?: (updatedTask: AppTask) => void;
  onAddTask?: (newTask: AppTask) => void;
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

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'UserCheck': return <UserCheck size={14} />;
    case 'Users': return <Users size={14} />;
    case 'Flame': return <Flame size={14} />;
    case 'Car': return <Car size={14} />;
    case 'Package': return <Package size={14} />;
    case 'Sparkles': return <Sparkles size={14} />;
    case 'Shirt': return <Shirt size={14} />;
    case 'Palette': return <Palette size={14} />;
    case 'Cat': return <Cat size={14} />;
    case 'Volume2': return <Volume2 size={14} />;
    case 'Home': return <Home size={14} />;
    case 'TreePine': return <TreePine size={14} />;
    case 'Camera': return <Camera size={14} />;
    case 'Zap': return <Zap size={14} />;
    case 'AlertTriangle': return <AlertTriangle size={14} />;
    default: return <Package size={14} />;
  }
};

export const BreakdownView: React.FC<BreakdownViewProps> = ({
  allTasks = [],
  onUpdateTask,
  onAddTask,
  onNavigateToView,
}) => {
  const {
    beats,
    updateBeat,
    breakdownLanguage,
    appTheme,
    generalAiModel,
    openrouterKey,
    currentProjectId,
    projectList = [],
  } = useProject();
  const { aiAvailable } = useAiKeyStatus();

  const isLight =
    appTheme === 'light' ||
    (appTheme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches);

  const isTamil = breakdownLanguage === 'tamil';

  // Navigation state: selected scene index
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'sheet' | 'manifest'>('sheet');
  const [manifestFilterCategory, setManifestFilterCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Single scene analyzing state
  const [isAnalyzingSingle, setIsAnalyzingSingle] = useState<boolean>(false);

  // Modal states
  const [activeAddCategory, setActiveAddCategory] = useState<BreakdownCategory | null>(null);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemDesc, setNewItemDesc] = useState<string>('');
  const [newItemCount, setNewItemCount] = useState<number>(1);

  // Batch Selection Modal state
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [selectedBeatIds, setSelectedBeatIds] = useState<Set<number>>(
    () => new Set(beats.map((b) => b.id))
  );
  const [batchFilter, setBatchFilter] = useState<'ALL' | 'UNBROKEN' | 'BROKEN'>('ALL');

  // Background Batch Progress State
  const [batchState, setBatchState] = useState<BatchProgressState>(() =>
    batchBreakdownManager.getState()
  );

  // Toast / notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Script Drawer toggle
  const [showScriptDrawer, setShowScriptDrawer] = useState<boolean>(false);

  useEffect(() => {
    return batchBreakdownManager.subscribe((state) => {
      setBatchState(state);
    });
  }, []);

  // Ensure selected index is valid
  useEffect(() => {
    if (selectedSceneIndex >= beats.length && beats.length > 0) {
      setSelectedSceneIndex(beats.length - 1);
    }
  }, [beats.length, selectedSceneIndex]);

  const currentBeat = beats[selectedSceneIndex] || beats[0];

  // Helper: Extract items for a specific category from a Beat's breakdownData
  const getBeatCategoryItems = (beat: Beat, category: BreakdownCategory): BreakdownItem[] => {
    if (!beat.breakdownData) return [];
    const bd = beat.breakdownData;

    // 1. Direct 15 category key
    const list = (bd as any)[category];
    if (Array.isArray(list) && list.length > 0) {
      return list.map((item, idx) => {
        if (typeof item === 'string') {
          return { id: `item-${category}-${idx}`, category, name: item, count: 1 };
        }
        return {
          id: item.id || `item-${category}-${idx}`,
          category: item.category || category,
          name: item.name || 'Unknown Item',
          nameTa: item.nameTa,
          description: item.description,
          descriptionTa: item.descriptionTa,
          count: item.count || 1,
          source: item.source,
          departmentId: item.departmentId,
        };
      });
    }

    // 2. Check unified items array
    if (Array.isArray(bd.items)) {
      const matched = bd.items.filter((i) => i.category === category);
      if (matched.length > 0) return matched;
    }

    // 3. Fallback to legacy keys
    if (category === 'PROPS' && Array.isArray(bd.props)) {
      return bd.props.map((i: any) => (typeof i === 'string' ? { name: i, count: 1 } : i));
    }
    if (category === 'SOUND' && Array.isArray(bd.sound)) {
      return bd.sound.map((i: any) => (typeof i === 'string' ? { name: i, count: 1 } : i));
    }
    if (category === 'WARDROBE' && Array.isArray(bd.costume)) {
      return bd.costume.map((i: any) => (typeof i === 'string' ? { name: i, count: 1 } : i));
    }
    if (category === 'SFX' && (Array.isArray(bd.vfx) || Array.isArray(bd.practical))) {
      return [...(bd.vfx || []), ...(bd.practical || [])].map((i: any) => (typeof i === 'string' ? { name: i, count: 1 } : i));
    }
    if (category === 'CAST' && Array.isArray(bd.cast)) {
      return bd.cast.map((i: any) => (typeof i === 'string' ? { name: i, count: 1 } : i));
    }
    if (category === 'SET_DRESSING' && Array.isArray(bd.location)) {
      return bd.location.map((i: any) => (typeof i === 'string' ? { name: i, count: 1 } : i));
    }

    return [];
  };

  // Check if beat has any breakdown items
  const hasBreakdown = (beat: Beat): boolean => {
    if (!beat.breakdownData) return false;
    const bd = beat.breakdownData;
    if (Array.isArray(bd.items) && bd.items.length > 0) return true;
    for (const cat of ALL_15_CATEGORIES) {
      const items = (bd as any)[cat];
      if (Array.isArray(items) && items.length > 0) return true;
    }
    if (Array.isArray(bd.props) && bd.props.length > 0) return true;
    if (Array.isArray(bd.sound) && bd.sound.length > 0) return true;
    if (Array.isArray(bd.costume) && bd.costume.length > 0) return true;
    if (Array.isArray(bd.cast) && bd.cast.length > 0) return true;
    return false;
  };

  const currentSceneTotalItems = useMemo(() => {
    if (!currentBeat) return 0;
    return ALL_15_CATEGORIES.reduce((acc, cat) => acc + getBeatCategoryItems(currentBeat, cat).length, 0);
  }, [currentBeat]);

  // Handle Scene Switcher
  const handleNextScene = () => {
    if (selectedSceneIndex < beats.length - 1) {
      setSelectedSceneIndex(selectedSceneIndex + 1);
    }
  };

  const handlePrevScene = () => {
    if (selectedSceneIndex > 0) {
      setSelectedSceneIndex(selectedSceneIndex - 1);
    }
  };

  // Run AI Breakdown on current scene
  const handleBreakdownCurrentScene = async () => {
    if (!currentBeat) return;
    setIsAnalyzingSingle(true);
    try {
      const scriptText = currentBeat.content
        ? currentBeat.content.replace(/<[^>]*>/g, ' ').trim()
        : `${currentBeat.slug?.prefix || 'INT.'} ${currentBeat.slug?.location || 'LOCATION'} - ${currentBeat.slug?.time || 'DAY'}\n${currentBeat.summary || currentBeat.title || ''}`;

      const res = await generateBreakdown(
        scriptText,
        generalAiModel || 'gemini-3.6-flash',
        isTamil ? 'tamil' : 'english',
        openrouterKey
      );

      if (res) {
        updateBeat(currentBeat.id, { breakdownData: res });
        confetti({
          particleCount: 45,
          spread: 55,
          origin: { y: 0.7 },
          colors: ['#f5a623', '#38bdf8', '#10b981', '#f43f5e'],
        });
        showToast(isTamil ? `காட்சி ${currentBeat.sceneNumber || `#${currentBeat.id}`} குறிப்புகள் பகுப்பாய்வு செய்யப்பட்டது!` : `Scene ${currentBeat.sceneNumber || `#${currentBeat.id}`} breakdown extracted!`);
      }
    } catch (e: any) {
      console.error(e);
      showToast('AI Breakdown failed. Check API Key.');
    } finally {
      setIsAnalyzingSingle(false);
    }
  };

  // Batch Breakdown Triggers
  const handleStartBatchAll = () => {
    batchBreakdownManager.startBatch(
      beats,
      isTamil ? 'tamil' : 'english',
      generalAiModel || 'gemini-3.6-flash',
      openrouterKey,
      (updatedBeat) => {
        updateBeat(updatedBeat.id, { breakdownData: updatedBeat.breakdownData });
      }
    );
    setIsBatchModalOpen(false);
  };

  const handleStartBatchSelected = () => {
    const targetBeats = beats.filter((b) => selectedBeatIds.has(b.id));
    if (targetBeats.length === 0) return;
    batchBreakdownManager.startBatch(
      targetBeats,
      isTamil ? 'tamil' : 'english',
      generalAiModel || 'gemini-3.6-flash',
      openrouterKey,
      (updatedBeat) => {
        updateBeat(updatedBeat.id, { breakdownData: updatedBeat.breakdownData });
      }
    );
    setIsBatchModalOpen(false);
  };

  const handleStartBatchUnbroken = () => {
    const unbroken = beats.filter((b) => !hasBreakdown(b));
    if (unbroken.length === 0) {
      showToast(isTamil ? 'அனைத்து காட்சிகளுக்கும் ஏற்கனவே குறிப்புகள் உள்ளன!' : 'All scenes already have breakdown items!');
      return;
    }
    batchBreakdownManager.startBatch(
      unbroken,
      isTamil ? 'tamil' : 'english',
      generalAiModel || 'gemini-3.6-flash',
      openrouterKey,
      (updatedBeat) => {
        updateBeat(updatedBeat.id, { breakdownData: updatedBeat.breakdownData });
      }
    );
    setIsBatchModalOpen(false);
  };

  // Add Item to current scene
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !activeAddCategory || !currentBeat) return;

    const newItem: BreakdownItem = {
      id: `item-${activeAddCategory}-${Date.now()}`,
      category: activeAddCategory,
      name: newItemName.trim(),
      nameTa: isTamil ? newItemName.trim() : undefined,
      description: newItemDesc.trim() || undefined,
      descriptionTa: isTamil && newItemDesc.trim() ? newItemDesc.trim() : undefined,
      count: Number(newItemCount) || 1,
      isCustom: true,
      source: 'Manual entry',
    };

    const currentData = currentBeat.breakdownData || {
      props: [],
      sound: [],
      costume: [],
      vfx: [],
      practical: [],
      cast: [],
      location: [],
      items: [],
    };

    const existingCatItems = getBeatCategoryItems(currentBeat, activeAddCategory);
    const updatedCatItems = [...existingCatItems, newItem];

    const updatedData: BreakdownData = {
      ...currentData,
      [activeAddCategory]: updatedCatItems,
      items: [...(currentData.items || []).filter((i) => i.category !== activeAddCategory), ...updatedCatItems],
    };

    updateBeat(currentBeat.id, { breakdownData: updatedData });
    setNewItemName('');
    setNewItemDesc('');
    setNewItemCount(1);
    setActiveAddCategory(null);
    showToast(`Added to ${CATEGORY_REGISTRY[activeAddCategory].nameEn}`);
  };

  // Delete Item from current scene
  const handleDeleteItem = (category: BreakdownCategory, itemIndex: number) => {
    if (!currentBeat || !currentBeat.breakdownData) return;
    const catItems = getBeatCategoryItems(currentBeat, category);
    const updatedCatItems = catItems.filter((_, idx) => idx !== itemIndex);

    const currentData = currentBeat.breakdownData;
    const updatedData: BreakdownData = {
      ...currentData,
      [category]: updatedCatItems,
      items: (currentData.items || []).filter((i, idx) => !(i.category === category && idx === itemIndex)),
    };

    updateBeat(currentBeat.id, { breakdownData: updatedData });
  };

  // Save 1st AD Breakdown sheet to Vault
  const handleSaveToVault = () => {
    if (!currentBeat) return;
    const sceneNum = currentBeat.sceneNumber || `#${currentBeat.id}`;
    const sceneTitle = currentBeat.title || `${currentBeat.slug?.prefix || 'INT.'} ${currentBeat.slug?.location || 'LOCATION'}`;

    const sheetRows: any[][] = [
      ['#', 'Category', 'Element / Item Name', 'Department', 'Notes / Specifications', 'Status']
    ];
    let count = 1;
    ALL_15_CATEGORIES.forEach((cat) => {
      const items = getBeatCategoryItems(currentBeat, cat);
      items.forEach((item) => {
        sheetRows.push([
          String(count++),
          cat,
          item.name,
          item.departmentId || CATEGORY_REGISTRY[cat]?.nameEn || cat,
          item.description || (item.count ? `Qty: ${item.count}` : '') || '',
          'Confirmed'
        ]);
      });
    });

    saveBreakdownToVault(sceneTitle, sceneNum, currentSceneTotalItems, undefined, sheetRows);
    confetti({ particleCount: 30, spread: 45, origin: { y: 0.6 } });
    showToast(`✓ Saved Scene ${sceneNum} Breakdown Sheet directly to Document Vault!`);
  };

  // Department & Continuity sync
  const handleSyncDepartments = () => {
    setIsSyncing(true);
    try {
      const res = syncBreakdownToDepartmentsAndContinuity(beats, allTasks);
      showToast(`⚡ Synced: ${res.stats.tasksCreated + res.stats.tasksUpdated} tasks across ${res.stats.deptsCount} departments & ${res.stats.looksCreated} continuity looks!`);
    } catch (e) {
      console.error(e);
      showToast('Sync encountered an error.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    try {
      const rows: any[] = [];
      beats.forEach((b) => {
        const sceneNum = b.sceneNumber || `#${b.id}`;
        const loc = `${b.slug?.prefix || 'INT.'} ${b.slug?.location || 'LOCATION'} - ${b.slug?.time || 'DAY'}`;
        ALL_15_CATEGORIES.forEach((cat) => {
          const items = getBeatCategoryItems(b, cat);
          items.forEach((item) => {
            rows.push({
              'Scene Number': sceneNum,
              'Heading': loc,
              'Category': CATEGORY_REGISTRY[cat].nameEn,
              'Category (Tamil)': CATEGORY_REGISTRY[cat].nameTa,
              'Item Name': item.name,
              'Count': item.count || 1,
              'Description': item.description || '',
              'Script Reference': item.source || '',
            });
          });
        });
      });

      if (rows.length === 0) {
        showToast('No breakdown items found to export.');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Production Breakdown');
      XLSX.writeFile(workbook, `Production_Breakdown_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Exported Production Breakdown spreadsheet!');
    } catch (e) {
      console.error(e);
      showToast('Export failed.');
    }
  };

  // Compute Scene Statistics
  const totalBrokenScenes = beats.filter((b) => hasBreakdown(b)).length;
  const unbrokenScenesCount = beats.length - totalBrokenScenes;

  // Scene details calculation
  const sceneWordCount = currentBeat?.content ? currentBeat.content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length : 0;
  const estimatedEighths = Math.max(1, Math.round(sceneWordCount / 28));
  const pagesString = estimatedEighths >= 8 ? `${Math.floor(estimatedEighths / 8)} ${estimatedEighths % 8}/8` : `${estimatedEighths}/8`;
  const estimatedSeconds = Math.round((estimatedEighths / 8) * 60);

  return (
    <div className={`w-full h-full flex flex-col font-sans overflow-hidden ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0f0f13] text-gray-100'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-950/90 text-white border border-white/10 shadow-2xl backdrop-blur-md text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 size={15} className="text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Live Background Batch Breakdown Progress Banner */}
      {batchState.isRunning && (
        <div className="no-print p-3.5 px-6 bg-[#090d16] text-white border-b border-sky-500/20 shadow-xl flex items-center justify-between flex-wrap gap-3 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Sparkles size={15} className="animate-spin" />
            </div>
            <div>
              <div className="text-xs font-black tracking-tight">
                {isTamil
                  ? `AI மொத்த குறிப்பு பிரித்தெடுத்தல்: காட்சி ${batchState.completedCount} / ${batchState.totalScenes} (${batchState.percent}%)`
                  : `AI Batch Breakdown in Progress: Scene ${batchState.completedCount} of ${batchState.totalScenes} (${batchState.percent}%)`}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {isTamil
                  ? `பகுப்பாய்வு செய்யப்படும் காட்சி: காட்சி ${batchState.currentSceneNumber} (${batchState.currentSceneLocation})`
                  : `Analyzing: Scene ${batchState.currentSceneNumber} • ${batchState.currentSceneLocation}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {batchState.estimatedSecondsRemaining > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-sky-400 font-mono font-bold">
                <Clock size={13} />
                <span>~{batchState.estimatedSecondsRemaining}s left</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              {batchState.isPaused ? (
                <button
                  onClick={() => batchBreakdownManager.resume()}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                >
                  <Play size={12} />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={() => batchBreakdownManager.pause()}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 transition-all border border-white/10"
                >
                  <Pause size={12} />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={() => batchBreakdownManager.cancel()}
                className="px-2.5 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1 transition-all"
              >
                <XCircle size={12} />
                <span>Cancel</span>
              </button>
            </div>
          </div>

          {/* Progress bar line */}
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-sky-400 transition-all duration-300 rounded-full"
              style={{ width: `${batchState.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. Top Header Toolbar */}
      <div className={`p-3 px-6 border-b flex items-center justify-between flex-wrap gap-3 shrink-0 ${isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#14141a] border-[#222]'}`}>
        {/* Left: Scene Switcher / Pagination */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevScene}
              disabled={selectedSceneIndex === 0}
              className="p-1.5 rounded-lg border border-inherit disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Previous Scene"
            >
              <ChevronLeft size={15} />
            </button>

            <select
              value={selectedSceneIndex}
              onChange={(e) => setSelectedSceneIndex(Number(e.target.value))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border outline-none cursor-pointer max-w-[340px] truncate ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#1c1c24] border-white/10 text-white'
              }`}
            >
              {beats.map((b, idx) => {
                const broken = hasBreakdown(b);
                const sNum = b.sceneNumber || `#${b.id}`;
                const sLoc = `${b.slug?.prefix || 'INT.'} ${b.slug?.location || 'LOCATION'}`;
                return (
                  <option key={b.id} value={idx}>
                    {broken ? '✓ ' : '○ '}
                    Scene {sNum}: {sLoc}
                  </option>
                );
              })}
            </select>

            <button
              onClick={handleNextScene}
              disabled={selectedSceneIndex === beats.length - 1}
              className="p-1.5 rounded-lg border border-inherit disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Next Scene"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <span className="text-xs font-mono text-gray-400 pl-1">
            {selectedSceneIndex + 1} / {beats.length || 1}
          </span>
        </div>

        {/* Right: Actions (Breakdown Current, Breakdown All, Sync, Save to Vault, Print) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* AI Breakdown All / Batch Modal Button */}
          <button
            onClick={() => setIsBatchModalOpen(true)}
            disabled={batchState.isRunning}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 transition-all shadow-sm border border-sky-400/30 disabled:opacity-50"
            title="Breakdown each and every scene automatically in the background"
          >
            <Sparkles size={13} />
            <span>AI Breakdown All ({beats.length})</span>
          </button>

          {/* AI Breakdown Current Scene */}
          <button
            onClick={handleBreakdownCurrentScene}
            disabled={isAnalyzingSingle || batchState.isRunning}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black flex items-center gap-1.5 transition-all shadow-sm border border-amber-600 disabled:opacity-50"
            title="Run AI breakdown on this active scene"
          >
            <Sparkles size={13} />
            <span>{isAnalyzingSingle ? 'Analyzing Scene...' : 'Breakdown Scene'}</span>
          </button>

          {/* Save to Vault */}
          <button
            onClick={handleSaveToVault}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-colors ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-[#1c1c24] hover:bg-[#282834] border-white/10 text-slate-200'
            }`}
            title="Save this 1st AD Breakdown Sheet to the Document Vault"
          >
            <FolderOpen size={13} className="text-amber-400" />
            <span>Save to Vault</span>
          </button>

          {/* Sync to Departments & Continuity */}
          <button
            onClick={handleSyncDepartments}
            disabled={isSyncing}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-colors ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-[#1c1c24] hover:bg-[#282834] border-white/10 text-slate-200'
            }`}
            title="Synchronize breakdown items into department tasks and continuity looks"
          >
            <Zap size={13} className="text-emerald-400" />
            <span>{isSyncing ? 'Syncing...' : 'Sync Depts'}</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className={`p-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
              isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-white/10 hover:bg-white/10 text-gray-300'
            }`}
            title="Export Breakdown to Excel Spreadsheet"
          >
            <Download size={14} />
          </button>

          {/* Print Sheet */}
          <button
            onClick={() => window.print()}
            className={`p-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
              isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-white/10 hover:bg-white/10 text-gray-300'
            }`}
            title="Print B&W 1st AD Breakdown Sheet"
          >
            <Printer size={14} />
          </button>
        </div>
      </div>

      {/* 3. Main Scene Overview & Breakdown Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {currentBeat ? (
          <>
            {/* Scene Header Card (Classic 1st AD Top Summary) */}
            <div className={`p-5 rounded-2xl border transition-all ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#14141a] border-[#222] shadow-lg'
            }`}>
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex-1 min-w-[280px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase font-mono bg-amber-500 text-black shadow-xs">
                      SCENE {currentBeat.sceneNumber || `#${currentBeat.id}`}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400 font-bold">
                      SHOOT DAY {currentBeat.boardId ? currentBeat.boardId + 1 : 1}
                    </span>
                  </div>

                  <h1 className="text-base md:text-lg font-black tracking-tight">
                    {currentBeat.slug?.prefix || 'INT.'} {currentBeat.slug?.location || 'LOCATION'} — {currentBeat.slug?.time || 'DAY'}
                  </h1>

                  <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                    {currentBeat.summary || (currentBeat.content ? currentBeat.content.replace(/<[^>]*>/g, ' ').slice(0, 160) + '...' : 'No scene synopsis added.')}
                  </p>
                </div>

                {/* Metadata counters */}
                <div className="flex items-center gap-5 border-l border-inherit pl-5 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Page Length</span>
                    <strong className="text-sm font-black text-amber-500">{pagesString} pgs</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Screen Time</span>
                    <strong className="text-sm font-black">~{estimatedSeconds}s</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase font-bold">Total Items</span>
                    <strong className="text-sm font-black text-emerald-400">{currentSceneTotalItems}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 15-Category Production Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
              {ALL_15_CATEGORIES.map((catKey) => {
                const meta = CATEGORY_REGISTRY[catKey];
                const items = getBeatCategoryItems(currentBeat, catKey);

                return (
                  <div
                    key={catKey}
                    className={`rounded-xl border flex flex-col transition-all duration-150 overflow-hidden ${
                      items.length > 0
                        ? isLight
                          ? 'bg-white border-slate-300 shadow-xs'
                          : 'bg-[#16161e] border-white/10 shadow-sm'
                        : isLight
                        ? 'bg-slate-50/60 border-slate-200/80 opacity-80'
                        : 'bg-[#121217] border-white/5 opacity-60'
                    }`}
                  >
                    {/* Category Card Header */}
                    <div
                      className="p-2.5 px-3 flex items-center justify-between border-b"
                      style={{
                        backgroundColor: meta.bgColor,
                        borderColor: meta.borderColor + '40',
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span style={{ color: meta.color }} className="shrink-0">
                          {getCategoryIcon(meta.iconName)}
                        </span>
                        <div className="truncate">
                          <span className="text-xs font-bold truncate block leading-tight" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>
                            {isTamil ? meta.nameTa : meta.nameEn}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Count Badge */}
                        <span
                          className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold"
                          style={{
                            backgroundColor: meta.color + '30',
                            color: meta.color,
                          }}
                        >
                          {items.length}
                        </span>

                        {/* + Add Item button */}
                        <button
                          onClick={() => {
                            setActiveAddCategory(catKey);
                            setNewItemName('');
                            setNewItemDesc('');
                            setNewItemCount(1);
                          }}
                          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          title={`Add item to ${meta.nameEn}`}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Category Items List */}
                    <div className="p-2.5 flex-1 min-h-[90px] max-h-[220px] overflow-y-auto space-y-1.5">
                      {items.length > 0 ? (
                        items.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className={`p-1.5 px-2 rounded-lg border text-xs flex items-center justify-between group transition-all ${
                              isLight ? 'bg-slate-50 hover:bg-white border-slate-200' : 'bg-[#1c1c24] hover:bg-[#23232e] border-white/5'
                            }`}
                          >
                            <div className="flex-1 min-w-0 pr-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold truncate text-[11.5px]">
                                  {item.name}
                                </span>
                                {(item.count || 1) > 1 && (
                                  <span className="text-[9.5px] font-mono px-1 rounded bg-black/10 dark:bg-white/10 opacity-70">
                                    x{item.count}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteItem(catKey, idx)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:text-red-300 transition-opacity shrink-0"
                              title="Delete Item"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center text-center p-3 text-[10.5px] text-gray-400 italic">
                          No {meta.nameEn.toLowerCase()} noted
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Film size={48} className="mb-3 opacity-30" />
            <p className="font-bold">No screenplay scenes found in this project.</p>
          </div>
        )}
      </div>

      {/* 4. Modal: Add Item to Category */}
      {activeAddCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#181822] border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-inherit">
              <div className="flex items-center gap-2">
                <span style={{ color: CATEGORY_REGISTRY[activeAddCategory].color }}>
                  {getCategoryIcon(CATEGORY_REGISTRY[activeAddCategory].iconName)}
                </span>
                <h2 className="text-sm font-black">
                  Add to {CATEGORY_REGISTRY[activeAddCategory].nameEn}
                </h2>
              </div>
              <button
                onClick={() => setActiveAddCategory(null)}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-400"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Vintage Machete / Black Scorpio SUV..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#121218] border-white/10 text-white'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Count / Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newItemCount}
                    onChange={(e) => setNewItemCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-mono ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#121218] border-white/10 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Department
                  </label>
                  <div className={`px-3 py-2 text-xs rounded-xl border font-semibold truncate ${
                    isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-[#121218] border-white/10 text-gray-400'
                  }`}>
                    {CATEGORY_REGISTRY[activeAddCategory].nameEn}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Usage Description / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Hero handles in climax, blunted edges required..."
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className={`w-full p-2.5 text-xs rounded-xl border outline-none resize-none ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#121218] border-white/10 text-white'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveAddCategory(null)}
                  className="px-3 py-2 text-xs font-bold rounded-xl text-gray-400 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-all shadow-sm"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Batch Breakdown Selection */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`w-full max-w-xl p-6 rounded-2xl border shadow-2xl flex flex-col max-h-[85vh] ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#181822] border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-inherit shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-sky-400" />
                <h2 className="text-sm font-black">AI Batch Breakdown Manager</h2>
              </div>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-400"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4 shrink-0">
              Select which scenes you want to break down automatically in the background. You can continue writing and editing while the background AI queue runs.
            </p>

            {/* Filter Pills */}
            <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
              <div className="flex items-center gap-1.5">
                {(['ALL', 'UNBROKEN', 'BROKEN'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setBatchFilter(filter)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                      batchFilter === filter
                        ? 'bg-sky-500/20 text-sky-400 border-sky-400/40'
                        : isLight
                        ? 'bg-slate-100 border-slate-200 text-slate-600'
                        : 'bg-[#121218] border-white/5 text-gray-400'
                    }`}
                  >
                    {filter === 'ALL' && `All (${beats.length})`}
                    {filter === 'UNBROKEN' && `Unbroken (${unbrokenScenesCount})`}
                    {filter === 'BROKEN' && `Broken (${totalBrokenScenes})`}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  if (selectedBeatIds.size === beats.length) {
                    setSelectedBeatIds(new Set());
                  } else {
                    setSelectedBeatIds(new Set(beats.map((b) => b.id)));
                  }
                }}
                className="text-[11px] font-bold text-sky-400 hover:underline"
              >
                {selectedBeatIds.size === beats.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Scene Checkbox List */}
            <div className="flex-1 overflow-y-auto border border-inherit rounded-xl p-2 space-y-1 my-2">
              {beats
                .filter((b) => {
                  const broken = hasBreakdown(b);
                  if (batchFilter === 'UNBROKEN') return !broken;
                  if (batchFilter === 'BROKEN') return broken;
                  return true;
                })
                .map((b) => {
                  const isChecked = selectedBeatIds.has(b.id);
                  const broken = hasBreakdown(b);
                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        const next = new Set(selectedBeatIds);
                        if (next.has(b.id)) next.delete(b.id);
                        else next.add(b.id);
                        setSelectedBeatIds(next);
                      }}
                      className={`p-2 rounded-lg border cursor-pointer flex items-center justify-between transition-colors ${
                        isChecked
                          ? isLight ? 'bg-sky-50 border-sky-300' : 'bg-sky-500/10 border-sky-500/30'
                          : isLight ? 'bg-slate-50 border-slate-200 hover:bg-white' : 'bg-[#121218] border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isChecked ? 'bg-sky-500 border-sky-600 text-white' : 'border-gray-500'
                        }`}>
                          {isChecked && <Check size={11} strokeWidth={3} />}
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-xs">
                            Scene {b.sceneNumber || `#${b.id}`}: {b.slug?.prefix || 'INT.'} {b.slug?.location || 'LOCATION'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono">
                        <span className={broken ? 'text-emerald-400 font-bold' : 'text-gray-400'}>
                          {broken ? '✓ Broken' : '○ Empty'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Batch Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-inherit shrink-0">
              <button
                type="button"
                onClick={handleStartBatchUnbroken}
                disabled={unbrokenScenesCount === 0}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 disabled:opacity-40 transition-colors"
              >
                Breakdown Unbroken ({unbrokenScenesCount})
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-3 py-2 text-xs font-bold rounded-xl text-gray-400 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartBatchSelected}
                  disabled={selectedBeatIds.size === 0}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Sparkles size={13} />
                  <span>Start Batch ({selectedBeatIds.size})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BreakdownView;
