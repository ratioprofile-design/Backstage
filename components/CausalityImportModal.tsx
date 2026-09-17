import React, { useState, useRef, useEffect } from 'react';
import { 
  X, UploadCloud, ClipboardPaste, CheckCircle2, AlertCircle, 
  Film, Layers, Users, GitBranch, FileText, Sparkles, ArrowRight 
} from 'lucide-react';
import { isCausalityData, parseCausalityProject, CausalityParseResult } from '../services/causalityParser';
import { ProjectState } from '../types';

interface CausalityImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (projectState: ProjectState, options?: { projectName?: string }) => void;
}

export const CausalityImportModal: React.FC<CausalityImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [parseResult, setParseResult] = useState<CausalityParseResult | null>(null);
  const [rawBackstageState, setRawBackstageState] = useState<ProjectState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      setPastedText('');
      setFileName(null);
      setProjectName('');
      setParseResult(null);
      setRawBackstageState(null);
      setErrorMsg(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const analyzeData = (rawJson: any, nameHint?: string) => {
    setErrorMsg(null);
    setParseResult(null);
    setRawBackstageState(null);

    try {
      if (isCausalityData(rawJson)) {
        const result = parseCausalityProject(rawJson);
        if (result.success && result.projectState) {
          setParseResult(result);
          const detectedTitle = result.projectName || nameHint?.replace(/\.[^/.]+$/, '') || 'Imported Causality Story';
          setProjectName(detectedTitle);
        } else {
          setErrorMsg(result.error || "The file contains Causality structures, but could not be parsed.");
        }
      } else if (rawJson && (Array.isArray(rawJson.beats) || 'scriptConfig' in rawJson)) {
        // Backstage project format
        setRawBackstageState(rawJson as ProjectState);
        const detectedTitle = nameHint?.replace(/\.[^/.]+$/, '') || 'Imported Backstage Project';
        setProjectName(detectedTitle);
      } else {
        setErrorMsg("Unrecognized format. Please provide a valid Causality (.cau, .json) or Backstage (.bst) file.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse JSON content.");
    }
  };

  const handleFileChange = (file: File) => {
    setFileName(file.name);
    setIsProcessing(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        analyzeData(parsed, file.name);
      } catch (err: any) {
        setErrorMsg("Invalid JSON file: " + (err.message || "Parse error"));
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read file from disk.");
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handlePasteChange = (val: string) => {
    setPastedText(val);
    if (!val.trim()) {
      setParseResult(null);
      setRawBackstageState(null);
      setErrorMsg(null);
      return;
    }

    try {
      const parsed = JSON.parse(val);
      analyzeData(parsed, 'Pasted Causality Story');
    } catch (err: any) {
      // While typing or pasting large chunks, show friendly message if partial
      setErrorMsg("Invalid JSON syntax: " + err.message);
      setParseResult(null);
      setRawBackstageState(null);
    }
  };

  const handleFinalImport = () => {
    if (parseResult?.projectState) {
      onImport(parseResult.projectState, { projectName: projectName.trim() || 'Imported Causality Story' });
      onClose();
    } else if (rawBackstageState) {
      onImport(rawBackstageState, { projectName: projectName.trim() || 'Imported Backstage Project' });
      onClose();
    }
  };

  const isReady = !!(parseResult?.projectState || rawBackstageState);
  const beatsCount = parseResult?.projectState?.beats?.length ?? rawBackstageState?.beats?.length ?? 0;
  const disabledCount = parseResult?.stats?.disabledBeatsCount ?? (parseResult?.projectState?.beats || rawBackstageState?.beats || []).filter(b => b.isDisabled).length;
  const tracksCount = parseResult?.projectState?.tracks?.length ?? rawBackstageState?.tracks?.length ?? 0;
  const groupsCount = parseResult?.projectState?.groups?.length ?? rawBackstageState?.groups?.length ?? 0;
  const connectionsCount = parseResult?.projectState?.connections?.length ?? rawBackstageState?.connections?.length ?? 0;
  const charCount = Object.keys(parseResult?.projectState?.characterData || rawBackstageState?.characterData || {}).length;
  const isTamil = parseResult?.projectState?.isTamilMode || rawBackstageState?.isTamilMode;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                Import Story / Causality Project
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  DAW Ready
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Seamlessly import Causality (.cau, .json) or Backstage (.bst) story files
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/30 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 pb-3 px-4 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Upload File (.cau / .json / .bst)
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-2 pb-3 px-4 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'paste'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ClipboardPaste className="w-4 h-4" />
            Paste Raw JSON
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'upload' ? (
            <div>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".cau,.json,.bst"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChange(f);
                }}
              />
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 hover:border-amber-500/60 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-zinc-900/30 hover:bg-zinc-900/60 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 group-hover:bg-amber-500/20 border border-zinc-700 group-hover:border-amber-500/40 flex items-center justify-center text-zinc-400 group-hover:text-amber-400 transition-all mb-3 shadow-inner">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium text-zinc-200 group-hover:text-amber-300 transition-colors">
                  {fileName ? fileName : 'Click to browse or drag & drop story file'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Supports Causality <strong>.cau</strong>, exported <strong>.json</strong>, and Backstage <strong>.bst</strong>
                </p>
                {fileName && (
                  <span className="mt-3 px-3 py-1 rounded-md bg-zinc-800 text-xs text-zinc-300 border border-zinc-700">
                    Selected: {fileName}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  Paste Causality JSON payload:
                </label>
                {pastedText && (
                  <button 
                    onClick={() => handlePasteChange('')}
                    className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    Clear Text
                  </button>
                )}
              </div>
              <textarea
                value={pastedText}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder={'{\n  "formatVersion": 30,\n  "id": "{...}",\n  "objects": [...],\n  "objectLinks": {...}\n}'}
                rows={7}
                className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 resize-y"
              />
            </div>
          )}

          {/* Loading Indicator */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-amber-400 animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
              Inspecting story structures and timeline lanes...
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-200">Import Analysis Warning</p>
                <p className="mt-0.5 text-red-300/90">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Live Data Inspection Card */}
          {isReady && (
            <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                    {parseResult ? 'Causality Story Detected' : 'Backstage Project Detected'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {disabledCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-500/20 text-red-300 border border-red-500/40" title="These beats will be omitted from the screenplay">
                      {disabledCount} Omitted from Screenplay
                    </span>
                  )}
                  {isTamil && (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Tamil Script Detected
                    </span>
                  )}
                </div>
              </div>

              {/* Project Name Field */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Project Title in Sequencer:
                </label>
                <input 
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
                  placeholder="Enter project name..."
                />
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-2.5 text-center">
                  <div className="text-base font-bold text-amber-400">{beatsCount}</div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
                    <Film className="w-3 h-3 text-zinc-500" /> Beats
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-2.5 text-center">
                  <div className="text-base font-bold text-indigo-400">{tracksCount}</div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
                    <Layers className="w-3 h-3 text-zinc-500" /> DAW Tracks
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-2.5 text-center">
                  <div className="text-base font-bold text-sky-400">{groupsCount}</div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
                    <Layers className="w-3 h-3 text-zinc-500" /> Groups / Acts
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-2.5 text-center">
                  <div className="text-base font-bold text-emerald-400">{charCount}</div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
                    <Users className="w-3 h-3 text-zinc-500" /> Characters
                  </div>
                </div>
              </div>

              {/* Lane Chips Preview */}
              {parseResult?.projectState?.tracks && parseResult.projectState.tracks.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    Whiteboard Lanes &rarr; Timeline Tracks:
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {parseResult.projectState.tracks.map((t, idx) => (
                      <span 
                        key={t.id || idx}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-950 border border-zinc-700/80 text-zinc-300"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || '#f59e0b' }} />
                        {t.label || (t as any).name || `Track ${idx + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Connections notice */}
              {connectionsCount > 0 && (
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-1">
                  <GitBranch className="w-3.5 h-3.5 text-amber-400" />
                  <span><strong>{connectionsCount}</strong> causal cause-and-effect link lines mapped across beats</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!isReady}
            onClick={handleFinalImport}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all ${
              isReady
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20 active:scale-[0.98]'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
            }`}
          >
            <span>Import into Sequencer</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
