import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText, Download, Copy, Check, ChevronDown, ChevronRight,
  Plus, Search, X, Maximize2, Minimize2, Edit3, Eye, Table as TableIcon,
  Columns, Sparkles, Filter, ShieldAlert, Film, Tag, Clock, User, Layers,
  ExternalLink, CheckSquare, Square, Save, ArrowUpRight, Share2, Printer
} from 'lucide-react';
import { ProductionDocument, BreakdownCategory, CATEGORY_REGISTRY } from '../../../types';
import { DOCUMENT_EMOJIS, markdownToHtml } from '../../../services/markdownEngine';
import * as XLSX from 'xlsx';

interface NotionDocPreviewProps {
  document: ProductionDocument;
  isLight: boolean;
  rawTableRows?: any[][];
  hasSceneColumn?: boolean;
  availableScenes?: string[];
  availableCategories?: string[];
  uniqueDepartmentsCount?: number;
  projectBeats?: any[];
  onSwitchToTableMode?: () => void;
  onSwitchToMarkdownMode?: () => void;
  onSwitchToTwoColumnMode?: () => void;
  onDownloadOriginal?: (doc: ProductionDocument) => void;
  onSaveDocument?: (updatedDoc: ProductionDocument) => void;
  showToast: (msg: string) => void;
}

export const NotionDocPreview: React.FC<NotionDocPreviewProps> = ({
  document: doc,
  isLight,
  rawTableRows = [],
  hasSceneColumn = false,
  availableScenes = [],
  availableCategories = [],
  uniqueDepartmentsCount = 1,
  projectBeats = [],
  onSwitchToTableMode,
  onSwitchToMarkdownMode,
  onSwitchToTwoColumnMode,
  onDownloadOriginal,
  onSaveDocument,
  showToast,
}) => {
  // Notion Document Layout Settings
  const [isFullWidth, setIsFullWidth] = useState<boolean>(() => {
    try {
      return localStorage.getItem('backstage_notion_fullwidth') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<'document' | 'database' | 'edit'>('document');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [docIcon, setDocIcon] = useState<string>(() => {
    if (doc.category === 'BREAKDOWN' || doc.builtInType === 'breakdown') return '📋';
    if (doc.category === 'SCRIPT' || doc.isLeftRightFormat) return '🎬';
    if (doc.category === 'CALLSHEET') return '📑';
    if (doc.category === 'RESEARCH') return '🔍';
    const firstChar = (doc.title || '').trim().split(' ')[0];
    return DOCUMENT_EMOJIS.includes(firstChar) ? firstChar : '📄';
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);

  // Collapsible Scenes Toggle State (default all expanded for full overview)
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>({});
  
  // Interactive Checklist per element row (persisted in local state)
  const [checkedElements, setCheckedElements] = useState<Record<string, boolean>>({});

  // Inline Editing State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedTitle, setEditedTitle] = useState<string>(doc.title || '');
  const [editedHtml, setEditedHtml] = useState<string>(doc.htmlContent || (doc.textContent ? `<p>${doc.textContent.replace(/\n/g, '<br/>')}</p>` : ''));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const editCanvasRef = useRef<HTMLDivElement>(null);

  // In-Document Database Table Search & Filters
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [tableCategoryFilter, setTableCategoryFilter] = useState<string>('ALL');
  const [tableSceneFilter, setTableSceneFilter] = useState<string>('ALL');

  const isBreakdownDoc = doc.category === 'BREAKDOWN' || doc.builtInType === 'breakdown' || !!doc.sheetData;

  // Toggle Full Width Page Setting
  const toggleFullWidth = () => {
    const next = !isFullWidth;
    setIsFullWidth(next);
    try {
      localStorage.setItem('backstage_notion_fullwidth', String(next));
    } catch (e) {}
  };

  // Group Table Rows by Scene for Notion Toggle Sections
  const sceneGroupedRows = useMemo(() => {
    if (!rawTableRows || rawTableRows.length === 0) return {};
    const groups: Record<string, any[][]> = {};
    rawTableRows.forEach((r) => {
      const sc = hasSceneColumn ? String(r[1] || 'General').trim() : 'Production Elements';
      if (!groups[sc]) groups[sc] = [];
      groups[sc].push(r);
    });
    return groups;
  }, [rawTableRows, hasSceneColumn]);

  const sceneKeys = useMemo(() => Object.keys(sceneGroupedRows), [sceneGroupedRows]);

  // Initialize all scenes as expanded by default
  useEffect(() => {
    if (sceneKeys.length > 0) {
      const initial: Record<string, boolean> = {};
      sceneKeys.forEach((k) => {
        initial[k] = true;
      });
      setExpandedScenes(initial);
    }
  }, [sceneKeys]);

  const toggleScene = (sc: string) => {
    setExpandedScenes((prev) => ({
      ...prev,
      [sc]: !prev[sc],
    }));
  };

  const expandAllScenes = () => {
    const all: Record<string, boolean> = {};
    sceneKeys.forEach((k) => { all[k] = true; });
    setExpandedScenes(all);
    showToast('✓ Expanded all scene sections');
  };

  const collapseAllScenes = () => {
    const none: Record<string, boolean> = {};
    sceneKeys.forEach((k) => { none[k] = false; });
    setExpandedScenes(none);
    showToast('✓ Collapsed all scene sections');
  };

  const toggleElementChecked = (elemId: string) => {
    setCheckedElements((prev) => ({
      ...prev,
      [elemId]: !prev[elemId],
    }));
  };

  // Filtered Rows for Database Table Tab
  const filteredDatabaseRows = useMemo(() => {
    return rawTableRows.filter((r) => {
      const scene = hasSceneColumn ? String(r[1] || '') : '';
      const cat = hasSceneColumn ? String(r[2] || '').toUpperCase() : String(r[1] || '').toUpperCase();
      const name = hasSceneColumn ? String(r[3] || '').toLowerCase() : String(r[2] || '').toLowerCase();
      const dept = hasSceneColumn ? String(r[4] || '').toLowerCase() : String(r[3] || '').toLowerCase();
      const notes = hasSceneColumn ? String(r[5] || '').toLowerCase() : String(r[4] || '').toLowerCase();
      const status = hasSceneColumn ? String(r[6] || '').toLowerCase() : String(r[5] || '').toLowerCase();

      if (tableSceneFilter !== 'ALL' && scene !== tableSceneFilter) return false;
      if (tableCategoryFilter !== 'ALL' && cat !== tableCategoryFilter) return false;

      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.trim().toLowerCase();
        const matches = name.includes(q) || dept.includes(q) || notes.includes(q) || cat.toLowerCase().includes(q) || status.includes(q) || scene.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [rawTableRows, hasSceneColumn, tableSceneFilter, tableCategoryFilter, tableSearchQuery]);

  // Export Table as Excel
  const handleExportExcel = () => {
    try {
      const headers = hasSceneColumn
        ? ['#', 'Scene', 'Category', 'Element / Item Name', 'Department', 'Notes & Specifications', 'Status']
        : ['#', 'Category', 'Element / Item Name', 'Department', 'Notes & Specifications', 'Status'];

      const exportRows = [headers, ...rawTableRows];
      const ws = XLSX.utils.aoa_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Production Breakdown');
      const filename = `${(doc.title || 'Production_Breakdown').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast(`✓ Exported ${filename}`);
    } catch (err) {
      console.error(err);
      showToast('Export failed. Check table data.');
    }
  };

  // Copy Table as TSV to Clipboard
  const handleCopyTsv = () => {
    try {
      const headers = hasSceneColumn
        ? ['#', 'Scene', 'Category', 'Element / Item Name', 'Department', 'Notes & Specifications', 'Status']
        : ['#', 'Category', 'Element / Item Name', 'Department', 'Notes & Specifications', 'Status'];

      const lines = [headers.join('\t'), ...rawTableRows.map((r) => r.join('\t'))].join('\n');
      navigator.clipboard.writeText(lines);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      showToast('✓ Copied table data to clipboard (TSV)');
    } catch (e) {
      showToast('Failed to copy to clipboard');
    }
  };

  // Save In-Place Edits
  const handleSaveEdits = () => {
    let finalHtml = editedHtml;
    if (editCanvasRef.current) {
      finalHtml = editCanvasRef.current.innerHTML;
    }
    const updated: ProductionDocument = {
      ...doc,
      title: editedTitle.trim() || doc.title,
      htmlContent: finalHtml,
      updatedAt: new Date().toISOString(),
    };
    if (onSaveDocument) {
      onSaveDocument(updated);
    }
    setIsEditing(false);
    setHasUnsavedChanges(false);
    showToast('✓ Saved changes to Notion document!');
  };

  // Category Badge Color Map for Notion Tags
  const getCategoryPillStyle = (cat: string) => {
    const upper = cat.toUpperCase();
    switch (upper) {
      case 'CAST':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30 dark:bg-purple-950/40 dark:text-purple-300';
      case 'PROPS':
        return 'bg-amber-500/15 text-amber-500 border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300';
      case 'STUNTS':
        return 'bg-rose-500/15 text-rose-500 border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300';
      case 'SFX':
        return 'bg-orange-500/15 text-orange-500 border-orange-500/30 dark:bg-orange-950/40 dark:text-orange-300';
      case 'VFX':
        return 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30 dark:bg-cyan-950/40 dark:text-cyan-300';
      case 'VEHICLES':
        return 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30 dark:bg-yellow-950/40 dark:text-yellow-300';
      case 'WARDROBE':
        return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300';
      case 'SOUND':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-300';
      default:
        return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30 dark:bg-zinc-800 dark:text-zinc-300';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    const s = String(status).toLowerCase();
    if (s.includes('confirm') || s.includes('ready') || s.includes('approved')) {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (s.includes('rig') || s.includes('rehears') || s.includes('sched')) {
      return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    }
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  };

  return (
    <div className={`w-full flex flex-col items-center pb-24 font-sans transition-all duration-200 select-text ${
      isLight ? 'text-slate-900' : 'text-zinc-100'
    }`}>
      {/* =========================================================================
          THE NOTION PAGE CONTAINER
         ========================================================================= */}
      <div
        className={`w-full transition-all duration-200 rounded-2xl border shadow-2xl overflow-hidden ${
          isFullWidth ? 'max-w-6xl' : 'max-w-4xl'
        } ${
          isLight
            ? 'bg-white border-slate-200 shadow-[0_12px_45px_rgba(0,0,0,0.06)]'
            : 'bg-[#191919] border-[#2c2c30] shadow-[0_20px_60px_rgba(0,0,0,0.7)]'
        }`}
      >
        {/* =========================================================================
            1. NOTION PAGE COVER BANNER
           ========================================================================= */}
        <div className="relative w-full h-40 sm:h-48 overflow-hidden bg-gradient-to-r from-zinc-950 via-[#181820] to-[#241a12] border-b border-zinc-800/80">
          {/* Subtle Ambient Film Grain / Glow */}
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#f5a623_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#f5a623] via-amber-400 to-yellow-500" />

          {/* Top Actions Floating Inside Cover */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            {/* Full Width Toggle (Notion Page Setting) */}
            <button
              onClick={toggleFullWidth}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border border-white/10 backdrop-blur-md transition-all text-xs flex items-center gap-1 shadow-md cursor-pointer"
              title={isFullWidth ? 'Default Page Width' : 'Full Width Page (Notion Style)'}
            >
              {isFullWidth ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span className="hidden sm:inline text-[11px] font-medium">{isFullWidth ? 'Narrow' : 'Full Width'}</span>
            </button>

            {/* Download Original File */}
            <button
              onClick={() => onDownloadOriginal ? onDownloadOriginal(doc) : null}
              className="px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border border-white/10 backdrop-blur-md transition-all text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              title="Download original file from vault"
            >
              <Download size={13} className="text-[#f5a623]" />
              <span className="hidden sm:inline text-[11px] font-medium">Download Asset</span>
            </button>

            {/* Copy Link / TSV */}
            <button
              onClick={handleCopyTsv}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border border-white/10 backdrop-blur-md transition-all text-xs shadow-md cursor-pointer"
              title="Copy table data as TSV"
            >
              {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>

          {/* Subtle Banner Badge */}
          <div className="absolute bottom-3 right-6 text-[10px] font-mono tracking-widest text-zinc-500 uppercase select-none">
            BACKSTAGE NOTION VAULT &bull; PRODUCTION DOCUMENT
          </div>
        </div>

        {/* =========================================================================
            2. NOTION PAGE HEADER (ICON + TITLE + PROPERTIES)
           ========================================================================= */}
        <div className="px-8 sm:px-14 pt-0 pb-6 relative">
          {/* Floating Notion Page Icon */}
          <div className="relative inline-block -mt-9 sm:-mt-11 mb-4 z-10">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`text-4xl sm:text-5xl p-2 rounded-2xl border shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#1e1e24] border-zinc-700/80'
              }`}
              title="Click to change page icon"
            >
              {docIcon}
            </button>

            {/* Emoji Picker Popover */}
            {showEmojiPicker && (
              <div className={`absolute top-16 left-0 z-50 p-2.5 rounded-2xl shadow-2xl border flex flex-wrap gap-1.5 w-64 animate-in fade-in zoom-in-95 duration-150 ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#1f1f26] border-zinc-700'
              }`}>
                {DOCUMENT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setDocIcon(emoji);
                      setShowEmojiPicker(false);
                      showToast(`✓ Updated page icon to ${emoji}`);
                    }}
                    className="w-8 h-8 text-xl flex items-center justify-center rounded-xl hover:bg-amber-500/20 cursor-pointer transition-transform hover:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Document Title */}
          <div className="mb-6">
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => {
                  setEditedTitle(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className={`w-full text-2xl sm:text-4xl font-black tracking-tight bg-transparent border-b outline-none pb-2 ${
                  isLight ? 'border-slate-300 text-slate-900 focus:border-[#f5a623]' : 'border-zinc-700 text-white focus:border-[#f5a623]'
                }`}
                placeholder="Document Title..."
              />
            ) : (
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight mb-2">
                {doc.title}
              </h1>
            )}

            {doc.titleTa && (
              <p className="text-sm font-medium text-amber-500/90 font-serif mb-1">
                {doc.titleTa}
              </p>
            )}
          </div>

          {/* =========================================================================
              3. NOTION PAGE PROPERTIES (METADATA BAR)
             ========================================================================= */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2.5 gap-x-6 py-4 px-4 rounded-xl border text-xs mb-6 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1e1e24]/70 border-zinc-800/80'
          }`}>
            {/* Category / Type */}
            <div className="flex items-center gap-2.5">
              <span className="text-zinc-400 font-mono text-[11px] flex items-center gap-1 w-20 shrink-0">
                <Tag size={12} className="text-zinc-500" />
                <span>Type</span>
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-[#f5a623]/20 text-[#f5a623] border border-[#f5a623]/40">
                {doc.category || 'DOCUMENT'}
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2.5">
              <span className="text-zinc-400 font-mono text-[11px] flex items-center gap-1 w-20 shrink-0">
                <Layers size={12} className="text-zinc-500" />
                <span>Status</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 border ${
                getStatusBadgeStyle(doc.status || 'Approved')
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                <span>{doc.status || 'Approved'}</span>
              </span>
            </div>

            {/* Author / Production Unit */}
            <div className="flex items-center gap-2.5">
              <span className="text-zinc-400 font-mono text-[11px] flex items-center gap-1 w-20 shrink-0">
                <User size={12} className="text-zinc-500" />
                <span>Unit</span>
              </span>
              <span className="font-medium text-zinc-300 truncate">
                {doc.author || '1st AD & Production Unit'}
              </span>
            </div>

            {/* File Source Asset */}
            <div className="flex items-center gap-2.5">
              <span className="text-zinc-400 font-mono text-[11px] flex items-center gap-1 w-20 shrink-0">
                <FileText size={12} className="text-zinc-500" />
                <span>Asset</span>
              </span>
              <span className="font-mono text-[11px] text-zinc-300 truncate">
                {doc.fileName || 'Indexed Document'} • {doc.fileSize || 'Standard'}
              </span>
            </div>

            {/* Scope / Breakdown Stats */}
            {isBreakdownDoc && (
              <div className="flex items-center gap-2.5">
                <span className="text-zinc-400 font-mono text-[11px] flex items-center gap-1 w-20 shrink-0">
                  <Film size={12} className="text-zinc-500" />
                  <span>Scope</span>
                </span>
                <span className="font-bold text-[#f5a623] font-mono text-[11px]">
                  {sceneKeys.length || availableScenes.length || 1} Scenes • {rawTableRows.length} Elements
                </span>
              </div>
            )}

            {/* Last Updated */}
            <div className="flex items-center gap-2.5">
              <span className="text-zinc-400 font-mono text-[11px] flex items-center gap-1 w-20 shrink-0">
                <Clock size={12} className="text-zinc-500" />
                <span>Updated</span>
              </span>
              <span className="text-zinc-400 text-[11px]">
                {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : 'Active Production'}
              </span>
            </div>
          </div>

          {/* =========================================================================
              4. NOTION VIEW TABS BAR (DOCUMENT vs. DATABASE TABLE vs. LIVE EDIT)
             ========================================================================= */}
          <div className="flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/80 pb-3 mb-6 gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-[#151518] border border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setActiveTab('document')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'document'
                    ? 'bg-[#f5a623] text-black shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/5'
                }`}
              >
                <Eye size={13} />
                <span>Notion Document</span>
              </button>

              {isBreakdownDoc && (
                <button
                  onClick={() => {
                    setActiveTab('database');
                    if (onSwitchToTableMode) onSwitchToTableMode();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'database'
                      ? 'bg-[#f5a623] text-black shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/5'
                  }`}
                >
                  <TableIcon size={13} />
                  <span>Database Table</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20">
                    {rawTableRows.length}
                  </span>
                </button>
              )}

              <button
                onClick={() => {
                  setActiveTab('edit');
                  setIsEditing(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'edit'
                    ? 'bg-[#f5a623] text-black shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/5'
                }`}
              >
                <Edit3 size={13} />
                <span>Live Edit</span>
              </button>

              {(doc.isLeftRightFormat || doc.hasTwoColumnScript || doc.category === 'SCRIPT') && onSwitchToTwoColumnMode && (
                <button
                  onClick={onSwitchToTwoColumnMode}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/5 cursor-pointer"
                >
                  <Columns size={13} />
                  <span>Script Studio</span>
                </button>
              )}
            </div>

            {/* Document Quick Actions */}
            <div className="flex items-center gap-2">
              {isBreakdownDoc && activeTab === 'document' && (
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={expandAllScenes}
                    className="px-2 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/5 transition-all"
                  >
                    Expand All
                  </button>
                  <span className="text-zinc-600">&bull;</span>
                  <button
                    onClick={collapseAllScenes}
                    className="px-2 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/5 transition-all"
                  >
                    Collapse All
                  </button>
                </div>
              )}

              {isEditing && (
                <button
                  onClick={handleSaveEdits}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <Save size={13} />
                  <span>Save Changes</span>
                </button>
              )}
            </div>
          </div>

          {/* =========================================================================
              5. TAB CONTENT 1: NOTION DOCUMENT VIEW (RICH CANVAS)
             ========================================================================= */}
          {activeTab === 'document' && (
            <div className="space-y-8 animate-in fade-in duration-150">
              {/* Executive KPI Summary Tiles (for Breakdown Docs) */}
              {isBreakdownDoc && rawTableRows.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1e1e24]/60 border-zinc-800'
                  }`}>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Total Elements</span>
                    <span className="text-2xl font-black text-[#f5a623] font-mono mt-0.5">{rawTableRows.length}</span>
                  </div>

                  <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1e1e24]/60 border-zinc-800'
                  }`}>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Departments</span>
                    <span className="text-2xl font-black text-sky-400 font-mono mt-0.5">{uniqueDepartmentsCount}</span>
                  </div>

                  <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1e1e24]/60 border-zinc-800'
                  }`}>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Script Scenes</span>
                    <span className="text-2xl font-black text-purple-400 font-mono mt-0.5">{sceneKeys.length || availableScenes.length || 1}</span>
                  </div>

                  <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1e1e24]/60 border-zinc-800'
                  }`}>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Shoot Day</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5">DAY 1</span>
                  </div>
                </div>
              )}

              {/* Notion Callout Block for Scene Synopsis & Production Scope */}
              {doc.textContent && (
                <div className={`p-4 rounded-xl border-l-4 border flex items-start gap-3.5 text-xs leading-relaxed transition-all ${
                  isLight
                    ? 'bg-amber-50/70 border-amber-200 border-l-[#f5a623] text-slate-800'
                    : 'bg-[#1e1b15] border-amber-500/20 border-l-[#f5a623] text-amber-100/90'
                }`}>
                  <div className="w-7 h-7 rounded-lg bg-[#f5a623]/20 flex items-center justify-center shrink-0 text-[#f5a623] font-bold text-sm">
                    💡
                  </div>
                  <div className="flex-1">
                    <strong className="text-[#f5a623] font-mono uppercase text-[10px] block mb-1 tracking-wider">
                      Executive Summary & Production Scope
                    </strong>
                    <div className="whitespace-pre-line font-sans opacity-90">
                      {doc.textContent.length > 500 ? `${doc.textContent.slice(0, 500)}...` : doc.textContent}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Scene Jump Directory (Notion Anchor Pills) */}
              {isBreakdownDoc && sceneKeys.length > 1 && (
                <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 flex-wrap ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#18181d] border-zinc-800'
                }`}>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <Sparkles size={13} className="text-[#f5a623]" />
                    <span>Quick Jump:</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sceneKeys.map((sc) => {
                      const count = sceneGroupedRows[sc]?.length || 0;
                      return (
                        <button
                          key={sc}
                          onClick={() => {
                            setExpandedScenes((prev) => ({ ...prev, [sc]: true }));
                            const el = document.getElementById(`notion-scene-${sc.replace(/\s+/g, '-')}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                            isLight
                              ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                          }`}
                        >
                          <span>{sc}</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded-full bg-black/10 dark:bg-white/10">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  NOTION COLLAPSIBLE SCENE TOGGLE SECTIONS (PART 1: SCENE LEDGER)
                 ========================================================================= */}
              {isBreakdownDoc && sceneKeys.length > 0 ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/80 pb-2">
                    <h2 className="text-base font-black uppercase tracking-wider text-[#f5a623] flex items-center gap-2">
                      <span>Part 1: Scene-by-Scene Breakdown Ledger</span>
                      <span className="text-xs font-mono font-normal text-zinc-400">({sceneKeys.length} Scenes)</span>
                    </h2>
                  </div>

                  {sceneKeys.map((sc, scIdx) => {
                    const items = sceneGroupedRows[sc] || [];
                    const isExpanded = expandedScenes[sc] !== false;
                    const matchingBeat = projectBeats.find((b: any, bIdx: number) => {
                      const beatNum = b.order !== undefined ? b.order + 1 : bIdx + 1;
                      const scNum = parseInt(sc.replace(/\D/g, '') || '0', 10);
                      return beatNum === scNum || b.title?.toLowerCase().includes(sc.toLowerCase());
                    });

                    const sceneHeading = matchingBeat
                      ? `${matchingBeat.slug?.prefix || 'INT.'} ${matchingBeat.slug?.location || matchingBeat.title || 'LOCATION'} - ${matchingBeat.slug?.time || 'DAY'}`
                      : `PRODUCTION LOCATION • SCENE SETUP`;

                    const synopsis = matchingBeat?.content ? matchingBeat.content.replace(/<[^>]*>/g, ' ').slice(0, 180).trim() : '';

                    return (
                      <div
                        id={`notion-scene-${sc.replace(/\s+/g, '-')}`}
                        key={sc}
                        className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                          isLight
                            ? 'bg-white border-slate-200 shadow-sm'
                            : 'bg-[#1c1c22] border-zinc-800 shadow-md'
                        }`}
                      >
                        {/* Notion Toggle Header */}
                        <div
                          onClick={() => toggleScene(sc)}
                          className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                            isLight
                              ? 'hover:bg-slate-50 bg-slate-50/50'
                              : 'hover:bg-zinc-800/40 bg-zinc-900/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              className="p-1 rounded-md text-zinc-400 hover:text-[#f5a623] transition-colors"
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#f5a623] text-black">
                              {sc}
                            </span>
                            <h3 className="font-bold text-sm truncate text-inherit">
                              {sceneHeading}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                              DAY {Math.ceil((scIdx + 1) / 2)}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-[#f5a623] border border-amber-500/30">
                              {items.length} Elements
                            </span>
                          </div>
                        </div>

                        {/* Collapsible Content */}
                        {isExpanded && (
                          <div className="p-4 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/60 space-y-3 animate-in fade-in duration-100">
                            {synopsis && (
                              <div className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                                isLight ? 'bg-amber-50/50 border-amber-200/60 text-amber-900' : 'bg-amber-500/5 border-amber-500/20 text-amber-200/80'
                              }`}>
                                <span className="font-bold font-mono text-[9.5px] uppercase tracking-wider text-[#f5a623] block mb-0.5">
                                  Dramatic Scope:
                                </span>
                                {synopsis}
                              </div>
                            )}

                            {/* Notion Scene Elements Table */}
                            <div className="overflow-x-auto rounded-lg border border-zinc-200/70 dark:border-zinc-800/80">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className={`border-b font-mono text-[10.5px] uppercase tracking-wider font-bold ${
                                    isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-[#151518] text-zinc-400 border-zinc-800'
                                  }`}>
                                    <th className="py-2.5 px-3 w-10 text-center">✓</th>
                                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                                    <th className="py-2.5 px-3 w-28">Category</th>
                                    <th className="py-2.5 px-3 w-48">Element / Item Name</th>
                                    <th className="py-2.5 px-3 w-32">Department</th>
                                    <th className="py-2.5 px-3 min-w-[200px]">Notes & Specifications</th>
                                    <th className="py-2.5 px-3 w-28 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800/60 font-sans">
                                  {items.map((r, itemIdx) => {
                                    const num = r[0] || itemIdx + 1;
                                    const cat = String(hasSceneColumn ? r[2] : r[1] || 'PROPS').toUpperCase();
                                    const name = hasSceneColumn ? r[3] : r[2];
                                    const dept = hasSceneColumn ? r[4] : r[3];
                                    const notes = hasSceneColumn ? r[5] : r[4];
                                    const status = hasSceneColumn ? r[6] : r[5];
                                    const elemKey = `${sc}_${num}_${name}`;
                                    const isChecked = !!checkedElements[elemKey];

                                    return (
                                      <tr
                                        key={elemKey}
                                        onClick={() => toggleElementChecked(elemKey)}
                                        className={`transition-colors cursor-pointer group ${
                                          isChecked
                                            ? isLight ? 'bg-emerald-50/50 text-slate-500' : 'bg-emerald-950/20 text-zinc-400'
                                            : isLight
                                            ? itemIdx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/60'
                                            : itemIdx % 2 === 0 ? 'bg-[#19191e] hover:bg-zinc-800/50' : 'bg-[#16161a] hover:bg-zinc-800/50'
                                        }`}
                                      >
                                        <td className="py-2.5 px-3 text-center">
                                          <button
                                            type="button"
                                            className={`p-0.5 rounded transition-transform ${
                                              isChecked ? 'text-emerald-500 scale-110' : 'text-zinc-500 group-hover:text-zinc-300'
                                            }`}
                                          >
                                            {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                                          </button>
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-500">
                                          {num}
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getCategoryPillStyle(cat)}`}>
                                            {cat}
                                          </span>
                                        </td>
                                        <td className={`py-2.5 px-3 font-bold ${isChecked ? 'line-through opacity-70' : ''}`}>
                                          {name}
                                        </td>
                                        <td className="py-2.5 px-3 text-zinc-400 font-mono text-[11px]">
                                          {dept}
                                        </td>
                                        <td className="py-2.5 px-3 text-zinc-400">
                                          {notes || '—'}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadgeStyle(status || 'Confirmed')}`}>
                                            {status || 'Confirmed'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* =========================================================================
                  PART 2: CROSS-SCENE LOGISTICS & ROSTERS ("AND STUFF")
                 ========================================================================= */}
              {isBreakdownDoc && (
                <div className="pt-6 border-t border-zinc-200/50 dark:border-zinc-800/80 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-black uppercase tracking-wider text-sky-400 flex items-center gap-2">
                      <span>Part 2: Cross-Scene Department Directory & Logistics ("and stuff")</span>
                    </h2>
                  </div>

                  {/* Cast Appearance Ledger */}
                  <div className={`rounded-xl border overflow-hidden ${
                    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1c1c22] border-zinc-800 shadow-md'
                  }`}>
                    <div className="p-3 bg-zinc-900 text-white flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                      <span>🎭 Master Cast Appearance Ledger Across Scenes</span>
                      <span className="text-[10px] font-mono text-zinc-400">CROSS-SCENE SYNC</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className={`border-b font-mono text-[10.5px] uppercase font-bold ${
                            isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-[#151518] text-zinc-400 border-zinc-800'
                          }`}>
                            <th className="py-2.5 px-4">Character Name</th>
                            <th className="py-2.5 px-4">Role Classification</th>
                            <th className="py-2.5 px-4">Scenes Required</th>
                            <th className="py-2.5 px-4 text-center">Total Scenes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800/60 font-sans">
                          {rawTableRows.filter((r) => String(hasSceneColumn ? r[2] : r[1]).toUpperCase() === 'CAST').map((r, i) => (
                            <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="py-2.5 px-4 font-bold text-inherit">{hasSceneColumn ? r[3] : r[2]}</td>
                              <td className="py-2.5 px-4 text-zinc-400">{hasSceneColumn ? r[4] : r[3]}</td>
                              <td className="py-2.5 px-4 text-zinc-400 font-mono">{hasSceneColumn ? r[1] : 'Scene 1'}</td>
                              <td className="py-2.5 px-4 text-center font-bold text-[#f5a623] font-mono">1</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Safety Directives Callout */}
                  <div className={`p-4 rounded-xl border-l-4 border flex items-start gap-3.5 text-xs leading-relaxed ${
                    isLight
                      ? 'bg-rose-50/70 border-rose-200 border-l-rose-500 text-rose-900'
                      : 'bg-rose-950/20 border-rose-900/40 border-l-rose-500 text-rose-200'
                  }`}>
                    <ShieldAlert size={20} className="text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-rose-400 font-mono uppercase text-[10px] block mb-1 tracking-wider">
                        ⚠️ Production Safety Standby & Turnaround Directives
                      </strong>
                      <p className="mb-1">1. <strong>Class C Fire Marshals:</strong> Mandatory for all scenes involving pyrotechnic conduit sparks, incinerator burns, or atmospheric haze generators.</p>
                      <p className="mb-1">2. <strong>Stunt Decelerator Inspections:</strong> All overhead rigging, catwalk wire rigs, and breakaway glass panels must be proof-tested by the Stunt Coordinator 90 minutes prior to first call.</p>
                      <p className="mb-0">3. <strong>Actor Turnaround & Medical:</strong> 12-hour rest turnaround guaranteed between night shoots and day unit calls.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  STANDARD / RICH DOCUMENT HTML PREVIEW (WHEN NOT A BREAKDOWN)
                 ========================================================================= */}
              {!isBreakdownDoc && (
                <div
                  className="prose dark:prose-invert max-w-none text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: doc.htmlContent || (doc.textContent ? markdownToHtml(doc.textContent) : '<p class="text-zinc-500">Document preview ready.</p>')
                  }}
                />
              )}
            </div>
          )}

          {/* =========================================================================
              TAB CONTENT 2: NOTION DATABASE TABLE VIEW
             ========================================================================= */}
          {activeTab === 'database' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Database Search & Filter Toolbar */}
              <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#18181d] border-zinc-800'
              }`}>
                <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
                  <div className="relative flex-1 sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search elements, notes, departments..."
                      value={tableSearchQuery}
                      onChange={(e) => setTableSearchQuery(e.target.value)}
                      className={`w-full pl-9 pr-7 py-1.5 text-xs rounded-xl border outline-none font-medium transition-all ${
                        isLight ? 'bg-white border-slate-200 focus:border-[#f5a623]' : 'bg-zinc-900 border-zinc-800 focus:border-[#f5a623]'
                      }`}
                    />
                    {tableSearchQuery && (
                      <button onClick={() => setTableSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400">
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {hasSceneColumn && sceneKeys.length > 0 && (
                    <select
                      value={tableSceneFilter}
                      onChange={(e) => setTableSceneFilter(e.target.value)}
                      className={`text-xs font-bold rounded-xl border px-3 py-1.5 outline-none font-mono ${
                        isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <option value="ALL">All Scenes ({rawTableRows.length})</option>
                      {sceneKeys.map((sc) => (
                        <option key={sc} value={sc}>{sc}</option>
                      ))}
                    </select>
                  )}

                  <select
                    value={tableCategoryFilter}
                    onChange={(e) => setTableCategoryFilter(e.target.value)}
                    className={`text-xs font-bold rounded-xl border px-3 py-1.5 outline-none ${
                      isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <option value="ALL">All Categories</option>
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download size={13} />
                    <span>Export Excel</span>
                  </button>
                  <button
                    onClick={handleCopyTsv}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <Copy size={13} />
                    <span>Copy TSV</span>
                  </button>
                </div>
              </div>

              {/* Full Notion Table */}
              <div className={`rounded-xl border overflow-hidden ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#18181d] border-zinc-800'
              }`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className={`border-b font-mono text-[10.5px] uppercase font-bold tracking-wider ${
                        isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-[#131316] text-zinc-400 border-zinc-800'
                      }`}>
                        <th className="py-3 px-3.5 w-12 text-center">#</th>
                        {hasSceneColumn && <th className="py-3 px-3.5 w-24">Scene</th>}
                        <th className="py-3 px-3.5 w-32">Category</th>
                        <th className="py-3 px-3.5 w-52">Element / Item Name</th>
                        <th className="py-3 px-3.5 w-32">Department</th>
                        <th className="py-3 px-3.5 min-w-[240px]">Notes & Specifications</th>
                        <th className="py-3 px-3.5 w-28 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800/60 font-sans">
                      {filteredDatabaseRows.length > 0 ? (
                        filteredDatabaseRows.map((r, i) => {
                          const num = r[0] || i + 1;
                          const scene = hasSceneColumn ? r[1] : '';
                          const cat = String(hasSceneColumn ? r[2] : r[1] || 'PROPS').toUpperCase();
                          const name = hasSceneColumn ? r[3] : r[2];
                          const dept = hasSceneColumn ? r[4] : r[3];
                          const notes = hasSceneColumn ? r[5] : r[4];
                          const status = hasSceneColumn ? r[6] : r[5];

                          return (
                            <tr
                              key={i}
                              className={`transition-colors ${
                                isLight
                                  ? i % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/60'
                                  : i % 2 === 0 ? 'bg-[#18181d] hover:bg-zinc-800/50' : 'bg-[#151519] hover:bg-zinc-800/50'
                              }`}
                            >
                              <td className="py-2.5 px-3.5 text-center font-mono font-bold text-zinc-500">
                                {num}
                              </td>
                              {hasSceneColumn && (
                                <td className="py-2.5 px-3.5 font-mono text-[11px] font-bold text-[#f5a623]">
                                  {scene}
                                </td>
                              )}
                              <td className="py-2.5 px-3.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getCategoryPillStyle(cat)}`}>
                                  {cat}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 font-bold text-inherit">
                                {name}
                              </td>
                              <td className="py-2.5 px-3.5 text-zinc-400 font-mono text-[11px]">
                                {dept}
                              </td>
                              <td className="py-2.5 px-3.5 text-zinc-400">
                                {notes || '—'}
                              </td>
                              <td className="py-2.5 px-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadgeStyle(status || 'Confirmed')}`}>
                                  {status || 'Confirmed'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={hasSceneColumn ? 7 : 6} className="py-12 text-center text-zinc-500">
                            No elements matched the search or filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB CONTENT 3: NOTION LIVE EDIT CANVAS
             ========================================================================= */}
          {activeTab === 'edit' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-400">
                <span>Notion In-Place Canvas &bull; Type freely to update document</span>
                <span>Auto-preserving caret</span>
              </div>

              <div
                ref={editCanvasRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => setHasUnsavedChanges(true)}
                dangerouslySetInnerHTML={{ __html: editedHtml }}
                className={`outline-none min-h-[450px] p-6 rounded-xl border leading-relaxed text-sm focus:ring-1 focus:ring-[#f5a623]/40 ${
                  isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#151518] border-zinc-800 text-zinc-100'
                }`}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setActiveTab('document');
                    setIsEditing(false);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdits}
                  className="px-4 py-1.5 rounded-xl bg-[#f5a623] hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Save size={13} />
                  <span>Save Document</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
