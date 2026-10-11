import React, { useState, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  Upload, FileText, CheckCircle2, AlertTriangle, Search, X, 
  Trash2, Instagram, Phone, Sparkles, Filter, ExternalLink,
  Users, Check, ArrowRight, RefreshCw, FileSpreadsheet, MessageSquare, Clipboard
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { 
  parseWhatsAppChat, 
  parseTalentSpreadsheet, 
  parsePastedTalentTable, 
  parseUniversalTalentInput,
  ParsedTalentItem, 
  TalentImportResult 
} from '../services/talentImporter';

interface MassTalentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (count: number) => void;
}

export const MassTalentImportModal: React.FC<MassTalentImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const { talentPool, addTalentToPool, appTheme } = useProject();
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const [activeTab, setActiveTab] = useState<'whatsapp' | 'spreadsheet' | 'paste'>('whatsapp');
  const [importResult, setImportResult] = useState<TalentImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'new' | 'duplicates'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setStatusMessage(`Parsing "${file.name}"...`);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'txt' || ext === 'csv' || file.type.includes('text') || file.type.includes('csv')) {
        const text = await file.text();
        const res = parseUniversalTalentInput(text, talentPool);
        setImportResult(res);
        setStatusMessage(`Successfully detected ${res.totalParsed} profiles from "${file.name}".`);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const res = await parseTalentSpreadsheet(file, talentPool);
        setImportResult(res);
        setStatusMessage(`Successfully detected ${res.totalParsed} profiles from spreadsheet.`);
      } else {
        alert('Unsupported file format. Please upload a .txt, .csv, or .xlsx file.');
      }
    } catch (err: any) {
      console.error('Import parse error:', err);
      alert(`Failed to parse file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePastedParse = () => {
    if (!pastedText.trim()) return;
    setIsProcessing(true);

    try {
      const res = parseUniversalTalentInput(pastedText, talentPool);
      setImportResult(res);
      setStatusMessage(`Detected ${res.totalParsed} profiles (${res.newCount} new, ${res.duplicateCount} duplicates).`);
    } catch (err: any) {
      console.error('Paste parse error:', err);
      alert(`Failed to parse text: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleItemSelection = (id: string) => {
    if (!importResult) return;
    setImportResult({
      ...importResult,
      items: importResult.items.map((it) =>
        it.id === id ? { ...it, selected: !it.selected } : it
      ),
    });
  };

  const setAllSelection = (selected: boolean) => {
    if (!importResult) return;
    setImportResult({
      ...importResult,
      items: importResult.items.map((it) => ({
        ...it,
        selected: it.isDuplicate ? false : selected,
      })),
    });
  };

  const removeItem = (id: string) => {
    if (!importResult) return;
    const filtered = importResult.items.filter((it) => it.id !== id);
    const dups = filtered.filter((i) => i.isDuplicate).length;
    setImportResult({
      items: filtered,
      totalParsed: filtered.length,
      newCount: filtered.length - dups,
      duplicateCount: dups,
    });
  };

  const updateItemField = (id: string, field: keyof ParsedTalentItem, value: any) => {
    if (!importResult) return;
    setImportResult({
      ...importResult,
      items: importResult.items.map((it) =>
        it.id === id ? { ...it, [field]: value } : it
      ),
    });
  };

  const filteredItems = useMemo(() => {
    if (!importResult) return [];
    return importResult.items.filter((item) => {
      if (filterMode === 'new' && item.isDuplicate) return false;
      if (filterMode === 'duplicates' && !item.isDuplicate) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchHandle = (item.instagramHandle || '').toLowerCase().includes(q);
        const matchPhone = (item.phone || '').includes(q);
        const matchTags = (item.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchHandle && !matchPhone && !matchTags) return false;
      }
      return true;
    });
  }, [importResult, filterMode, searchTerm]);

  const selectedCount = useMemo(() => {
    if (!importResult) return 0;
    return importResult.items.filter((it) => it.selected).length;
  }, [importResult]);

  const handleCommitImport = () => {
    if (!importResult) return;
    const selected = importResult.items.filter((it) => it.selected);
    if (selected.length === 0) {
      alert('Please select at least one talent profile to import.');
      return;
    }

    // Clean out temporary UI fields before saving to pool
    const toImport = selected.map(({ isDuplicate, duplicateReason, selected: _, ...rest }) => ({
      ...rest,
    }));

    addTalentToPool(toImport);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {}

    if (onImportComplete) {
      onImportComplete(toImport.length);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full max-w-5xl h-[88vh] flex flex-col rounded-xl shadow-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#12141a] border-slate-800 text-slate-100'
        }`}
      >
        {/* HEADER BAR */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181a22] border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <Upload size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Mass Talent Importer</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Bulk Casting Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingest 700+ actor submissions directly from WhatsApp casting groups & Excel spreadsheets.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!importResult ? (
            /* STEP 1: INGESTION SCREEN */
            <div className="flex-1 flex flex-col p-6 overflow-y-auto">
              {/* Tab Selector */}
              <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
                <button
                  onClick={() => setActiveTab('whatsapp')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'whatsapp'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <MessageSquare size={16} />
                  <span>WhatsApp Chat Export</span>
                </button>

                <button
                  onClick={() => setActiveTab('spreadsheet')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'spreadsheet'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <FileSpreadsheet size={16} />
                  <span>Spreadsheet (Excel / CSV)</span>
                </button>

                <button
                  onClick={() => setActiveTab('paste')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'paste'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Clipboard size={16} />
                  <span>Direct Paste Dump</span>
                </button>
              </div>

              {/* Ingestion Mode Explainer & Drag Drop */}
              {activeTab !== 'paste' ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full max-w-2xl border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-amber-500 bg-amber-500/10 scale-[1.01]'
                        : isLight
                        ? 'border-slate-300 hover:border-slate-400 bg-slate-50'
                        : 'border-slate-700 hover:border-slate-600 bg-[#161821]'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                      accept={activeTab === 'whatsapp' ? '.txt,text/plain' : '.xlsx,.xls,.csv'}
                      className="hidden"
                    />

                    <div className="p-4 rounded-full bg-amber-500/10 text-amber-400 mb-4">
                      {activeTab === 'whatsapp' ? <MessageSquare size={36} /> : <FileSpreadsheet size={36} />}
                    </div>

                    <h3 className="text-base font-bold mb-1">
                      {activeTab === 'whatsapp'
                        ? 'Drop your WhatsApp `_chat.txt` file here'
                        : 'Drop your Excel (.xlsx, .xls) or CSV file here'}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mb-4">
                      {activeTab === 'whatsapp'
                        ? 'In WhatsApp on your phone: Tap the casting group info → Export Chat (Without Media) → Drop the exported text file here.'
                        : 'Supports Google Sheets, Excel sheets, and CSV with columns for Name, Instagram handle/URL, Phone, Age, and Notes.'}
                    </p>

                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow-md"
                    >
                      Browse Files
                    </button>
                  </div>

                  {/* Instructions hint */}
                  <div className="mt-6 max-w-xl text-center text-[11px] text-slate-500 font-mono">
                    💡 Tip: Automatic regex and deduplication will extract `@handles`, direct profile links, contact numbers, and physical stats while skipping group admin messages.
                  </div>
                </div>
              ) : (
                /* DIRECT PASTE DUMP */
                <div className="flex-1 flex flex-col">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      Paste WhatsApp messages or Google Sheets table rows below:
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {pastedText.length} characters
                    </span>
                  </div>

                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={`Example WhatsApp forwarded text:\n\n1. Vikram\nAge: 27\nHeight: 5'11\nIG: instagram.com/vikram_actor\nPh: 9876543210\n\n2. Priya\nAge: 24\nIG: @priya_official\nPh: 9123456789`}
                    className={`flex-1 w-full p-4 rounded-xl font-mono text-xs border resize-none focus:outline-none focus:border-amber-500 ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900'
                        : 'bg-[#151720] border-slate-800 text-slate-200'
                    }`}
                  />

                  <div className="mt-4 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setPastedText('')}
                      className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handlePastedParse}
                      disabled={!pastedText.trim() || isProcessing}
                      className="px-5 py-2.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md"
                    >
                      <Sparkles size={15} />
                      <span>Extract & Analyze Profiles</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: VERIFICATION & REVIEW TABLE */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* TOP STATS STRIP & FILTERS */}
              <div
                className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#161822] border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">Total Extracted:</span>
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-800 text-white border border-slate-700">
                      {importResult.totalParsed}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400">New Profiles:</span>
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                      {importResult.newCount}
                    </span>
                  </div>

                  {importResult.duplicateCount > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-400">Duplicates Detected:</span>
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-amber-950/60 text-amber-400 border border-amber-800/60">
                        {importResult.duplicateCount}
                      </span>
                    </div>
                  )}
                </div>

                {/* SEARCH & FILTER CONTROLS */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search candidate..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:border-amber-500 font-sans ${
                        isLight ? 'bg-white border-slate-300' : 'bg-[#101217] border-slate-700 text-white'
                      }`}
                    />
                  </div>

                  <div className="flex items-center border rounded-lg overflow-hidden border-slate-700 text-[11px] font-semibold">
                    <button
                      onClick={() => setFilterMode('all')}
                      className={`px-3 py-1.5 transition-colors ${
                        filterMode === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All ({importResult.totalParsed})
                    </button>
                    <button
                      onClick={() => setFilterMode('new')}
                      className={`px-3 py-1.5 transition-colors ${
                        filterMode === 'new' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      New Only ({importResult.newCount})
                    </button>
                    <button
                      onClick={() => setFilterMode('duplicates')}
                      className={`px-3 py-1.5 transition-colors ${
                        filterMode === 'duplicates' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Duplicates ({importResult.duplicateCount})
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setImportResult(null);
                      setPastedText('');
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <RefreshCw size={13} />
                    <span>Re-upload</span>
                  </button>
                </div>
              </div>

              {/* SELECTION ACTION BAR */}
              <div
                className={`px-6 py-2 border-b flex items-center justify-between text-xs font-mono text-slate-400 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#11131a] border-slate-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span>Selected: <strong className="text-amber-400 font-bold">{selectedCount}</strong> / {importResult.totalParsed}</span>
                  <button
                    onClick={() => setAllSelection(true)}
                    className="text-amber-500 hover:underline cursor-pointer"
                  >
                    Select All New
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => setAllSelection(false)}
                    className="hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>

                <div className="text-[11px] text-slate-500">
                  Showing {filteredItems.length} items
                </div>
              </div>

              {/* TABLE LIST */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead
                    className={`sticky top-0 z-10 font-mono text-[10.5px] uppercase tracking-wider border-b ${
                      isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-[#181a24] border-slate-800 text-slate-400'
                    }`}
                  >
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCount > 0 && selectedCount === importResult.newCount}
                          onChange={(e) => setAllSelection(e.target.checked)}
                          className="accent-amber-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-3 w-56">Actor / Name</th>
                      <th className="p-3 w-48">Instagram Handle</th>
                      <th className="p-3 w-36">Phone / Contact</th>
                      <th className="p-3 w-32">Physical Stats</th>
                      <th className="p-3 w-40">Tags / Role</th>
                      <th className="p-3">Status / Duplicate Note</th>
                      <th className="p-3 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          item.isDuplicate
                            ? isLight ? 'bg-amber-50/50' : 'bg-amber-950/10'
                            : item.selected
                            ? isLight ? 'bg-amber-50/30' : 'bg-amber-500/5'
                            : ''
                        } hover:bg-slate-800/20`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!item.selected}
                            onChange={() => toggleItemSelection(item.id)}
                            className="accent-amber-500 cursor-pointer"
                          />
                        </td>

                        {/* Name */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                              {item.name.charAt(0).toUpperCase()}
                            </div>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItemField(item.id, 'name', e.target.value)}
                              className={`w-full font-semibold bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 focus:outline-none transition-colors ${
                                isLight ? 'text-slate-900' : 'text-slate-100'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Instagram */}
                        <td className="p-3 font-mono text-[11px]">
                          {item.instagramHandle ? (
                            <div className="flex items-center gap-1.5">
                              <Instagram size={13} className="text-pink-400 shrink-0" />
                              <span className="font-bold text-pink-400">{item.instagramHandle}</span>
                              {item.instagramUrl && (
                                <a
                                  href={item.instagramUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open Instagram Profile"
                                  className="text-slate-500 hover:text-white p-0.5 rounded transition-colors"
                                >
                                  <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">No IG detected</span>
                          )}
                        </td>

                        {/* Phone */}
                        <td className="p-3 font-mono text-[11px]">
                          {item.phone ? (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Phone size={12} className="text-emerald-400 shrink-0" />
                              <span>{item.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* Stats */}
                        <td className="p-3 text-[11px] text-slate-300">
                          <div className="flex items-center gap-2">
                            {item.age && <span>{item.age} yrs</span>}
                            {item.height && <span className="text-slate-400">• {item.height}</span>}
                            {item.gender && <span className="text-slate-400">• {item.gender}</span>}
                            {!item.age && !item.height && !item.gender && (
                              <span className="text-slate-500">—</span>
                            )}
                          </div>
                        </td>

                        {/* Tags */}
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {item.tags && item.tags.length > 0 ? (
                              item.tags.slice(0, 3).map((t, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                                >
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 text-[11px]">—</span>
                            )}
                          </div>
                        </td>

                        {/* Status / Duplicate */}
                        <td className="p-3">
                          {item.isDuplicate ? (
                            <div className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                              <AlertTriangle size={13} className="shrink-0" />
                              <span>{item.duplicateReason}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                              <CheckCircle2 size={13} className="shrink-0" />
                              <span>Ready to import</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            title="Discard candidate"
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredItems.length === 0 && (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                    <Users size={32} className="mb-2 opacity-50" />
                    <p className="text-xs font-semibold">No candidates match current search or filter.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER BAR */}
        <div
          className={`px-6 py-4 border-t flex items-center justify-between shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181a22] border-slate-800'
          }`}
        >
          <div className="text-xs text-slate-400">
            {importResult && (
              <span>
                Ready to add <strong className="text-amber-400 font-bold">{selectedCount}</strong> candidates to your Master Talent Pool.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>

            {importResult && (
              <button
                onClick={handleCommitImport}
                disabled={selectedCount === 0}
                className="px-6 py-2.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <Check size={16} />
                <span>Import {selectedCount} Actors into Talent Pool</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
