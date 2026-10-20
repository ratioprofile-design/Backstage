import React, { useState, useEffect, useMemo } from 'react';
import { TamilScreenplayData, TamilScene } from '../services/tamilLeftRightEngine';
import {
  aiScriptAlignmentManager,
  AlignmentProgressState,
  AlignmentOptions,
} from '../services/aiScriptAlignmentEngine';
import {
  Sparkles,
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Split,
  Type,
  Wand2,
  Maximize2,
  Minimize2,
  FileText,
  ShieldCheck,
  ChevronRight,
  Sliders,
  Check,
} from 'lucide-react';

export interface TwoColumnAiAlignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenplayData: TamilScreenplayData;
  isLight: boolean;
  onStartAlignment: (options: AlignmentOptions) => void;
  onCancelAlignment: () => void;
  onUndoAlignment?: () => void;
  canUndo?: boolean;
}

export const TwoColumnAiAlignmentModal: React.FC<TwoColumnAiAlignmentModalProps> = ({
  isOpen,
  onClose,
  screenplayData,
  isLight,
  onStartAlignment,
  onCancelAlignment,
  onUndoAlignment,
  canUndo = false,
}) => {
  const [progressState, setProgressState] = useState<AlignmentProgressState>(() =>
    aiScriptAlignmentManager.getState()
  );

  // Model & options configuration
  const [selectedModel, setSelectedModel] = useState<string>('gemini-flash-latest');
  const [mergeNumberedShots, setMergeNumberedShots] = useState<boolean>(true);
  const [standardizeHeadings, setStandardizeHeadings] = useState<boolean>(true);
  const [detectContinuousDialogue, setDetectContinuousDialogue] = useState<boolean>(true);
  const [correctTamilTypos, setCorrectTamilTypos] = useState<boolean>(true);
  const [sceneRangeMode, setSceneRangeMode] = useState<'all' | 'custom'>('all');
  const [startSceneIdx, setStartSceneIdx] = useState<number>(1);
  const [endSceneIdx, setEndSceneIdx] = useState<number>(() => screenplayData.scenes.length || 1);

  // Subscribe to real-time background manager state updates
  useEffect(() => {
    const unsubscribe = aiScriptAlignmentManager.subscribe((state) => {
      setProgressState(state);
    });
    return unsubscribe;
  }, []);

  // Update endSceneIdx if scenes length changes
  useEffect(() => {
    if (screenplayData.scenes.length > 0) {
      setEndSceneIdx(screenplayData.scenes.length);
    }
  }, [screenplayData.scenes.length]);

  const totalItemsCount = useMemo(() => {
    return screenplayData.scenes.reduce((acc, sc) => acc + (sc.items?.length || 0), 0);
  }, [screenplayData.scenes]);

  if (!isOpen) return null;

  const isRunning = progressState.isRunning;
  const isPaused = progressState.isPaused;
  const percent = progressState.percent;
  const completedCount = progressState.completedCount;
  const totalScenes = progressState.totalScenes || screenplayData.scenes.length;
  const isFinished = !isRunning && completedCount > 0 && completedCount >= totalScenes;

  const handleStart = () => {
    const opts: AlignmentOptions = {
      model: selectedModel,
      mergeNumberedShots,
      standardizeHeadings,
      detectContinuousDialogue,
      correctTamilTypos,
      startSceneIndex: sceneRangeMode === 'custom' ? Math.max(0, startSceneIdx - 1) : 0,
      endSceneIndex: sceneRangeMode === 'custom' ? Math.min(screenplayData.scenes.length, endSceneIdx) : screenplayData.scenes.length,
    };
    onStartAlignment(opts);
  };

  const formatSeconds = (sec: number) => {
    if (sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-zinc-950 border-zinc-800 text-zinc-100'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isLight ? 'border-slate-200 bg-slate-50/80' : 'border-zinc-800/80 bg-zinc-900/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-black shadow-md shadow-emerald-500/20">
              <Sparkles size={20} className={isRunning ? 'animate-spin' : ''} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                <span>AI Screenplay Alignment Engine</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Kollywood 2-Col
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Autonomous background formatting, Word document alignment & typo repair
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close modal (alignment will keep running in the background)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
              isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-zinc-900/40 border-zinc-800/80'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="text-emerald-500 shrink-0" size={24} />
              <div className="truncate">
                <div className="font-bold text-sm truncate">{screenplayData.title || 'Untitled Screenplay'}</div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                  <span>🎬 {screenplayData.scenes.length} Scenes</span>
                  <span>•</span>
                  <span>📄 ~200 Pages</span>
                  <span>•</span>
                  <span>📝 {totalItemsCount} Elements</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Word (.docx) Ready
              </span>
            </div>
          </div>

          {/* ACTIVE EXECUTION MONITOR VIEW */}
          {(isRunning || isPaused || isFinished) && (
            <div
              className={`p-5 rounded-xl border space-y-4 ${
                isLight ? 'bg-emerald-50/40 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    {isRunning && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        isPaused ? 'bg-amber-400' : isFinished ? 'bg-emerald-500' : 'bg-emerald-500'
                      }`}
                    ></span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {isFinished
                      ? '✓ Screenplay Alignment Complete'
                      : isPaused
                      ? '⏸ Alignment Paused'
                      : '⚡ AI Aligning Screenplay in Background'}
                  </span>
                </div>

                {!isFinished && (
                  <div className="text-xs font-mono font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <Clock size={13} />
                    <span>ETA: {formatSeconds(progressState.estimatedSecondsRemaining)}</span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span>
                    Scene {completedCount} of {totalScenes} ({percent}%)
                  </span>
                  <span className="truncate max-w-[240px] text-slate-500 dark:text-zinc-400 text-right">
                    {progressState.currentSceneLocation
                      ? `Sc ${progressState.currentSceneNumber}: ${progressState.currentSceneLocation}`
                      : 'Formatting scenes...'}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Live Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                <div
                  className={`p-2.5 rounded-lg border text-center ${
                    isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase">Actions</div>
                  <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {progressState.stats.actionsAligned}
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-center ${
                    isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase">Dialogues</div>
                  <div className="text-base font-black text-teal-600 dark:text-teal-400 mt-0.5">
                    {progressState.stats.dialoguesAligned}
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-center ${
                    isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase">Shots Merged</div>
                  <div className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {progressState.stats.shotNumbersMerged}
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-center ${
                    isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase">Typos Fixed</div>
                  <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {progressState.stats.typosCorrected}
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-center ${
                    isLight ? 'bg-white border-slate-200' : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase">Headings</div>
                  <div className="text-base font-black text-purple-600 dark:text-purple-400 mt-0.5">
                    {progressState.stats.headingsStandardized}
                  </div>
                </div>
              </div>

              {/* Real-time controls */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {isRunning && !isPaused && (
                    <button
                      onClick={() => aiScriptAlignmentManager.pause()}
                      className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Pause size={13} />
                      <span>Pause</span>
                    </button>
                  )}

                  {isPaused && (
                    <button
                      onClick={() => aiScriptAlignmentManager.resume()}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Play size={13} />
                      <span>Resume</span>
                    </button>
                  )}

                  {isRunning && (
                    <button
                      onClick={onCancelAlignment}
                      className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <X size={13} />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-xs font-semibold cursor-pointer"
                >
                  Run in Background ▾
                </button>
              </div>
            </div>
          )}

          {/* CONFIGURATION & ALIGNMENT PLAN */}
          {!isRunning && !isFinished && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Sliders size={13} />
                  <span>Alignment Plan & Formatting Rules</span>
                </h3>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  5 Operations Enabled
                </span>
              </div>

              {/* Rules Checklist */}
              <div className="space-y-2.5">
                {/* 1. Action vs Dialogue Columns */}
                <div
                  className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                    isLight ? 'bg-slate-50/60 border-slate-200' : 'bg-zinc-900/40 border-zinc-800/80'
                  }`}
                >
                  <div className="mt-0.5 p-1 rounded-md bg-emerald-500/10 text-emerald-500 shrink-0">
                    <Split size={14} />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-sm">Kollywood 2-Column Segregation</div>
                    <p className="text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      Automatically routes visual descriptions & camera direction to the Left Column (காட்சி),
                      character dialogue to the Right Column (வசனம்), and transitions/montages to the Center.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">Active</span>
                </div>

                {/* 2. Numbered Shots Merging */}
                <div
                  onClick={() => setMergeNumberedShots(!mergeNumberedShots)}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    mergeNumberedShots
                      ? isLight
                        ? 'bg-slate-50/60 border-slate-200'
                        : 'bg-zinc-900/40 border-zinc-800/80'
                      : 'opacity-60 bg-transparent border-dashed'
                  }`}
                >
                  <div className="mt-0.5 p-1 rounded-md bg-indigo-500/10 text-indigo-500 shrink-0">
                    <Layers size={14} />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-sm">Merge Numbered Shots (1., 2., 3.)</div>
                    <p className="text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      Re-merges split shot numbers from Word exports into cohesive action shot paragraphs ending with a dash "-".
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={mergeNumberedShots}
                    onChange={(e) => setMergeNumberedShots(e.target.checked)}
                    className="accent-emerald-500 mt-1 cursor-pointer"
                  />
                </div>

                {/* 3. Scene Headings Normalization */}
                <div
                  onClick={() => setStandardizeHeadings(!standardizeHeadings)}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    standardizeHeadings
                      ? isLight
                        ? 'bg-slate-50/60 border-slate-200'
                        : 'bg-zinc-900/40 border-zinc-800/80'
                      : 'opacity-60 bg-transparent border-dashed'
                  }`}
                >
                  <div className="mt-0.5 p-1 rounded-md bg-purple-500/10 text-purple-500 shrink-0">
                    <FileText size={14} />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-sm">Standardize Scene Headings</div>
                    <p className="text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      Formats Scene Number, Script Location, Real Shooting Location, and Time of Day (e.g. Day / INT) into standard Kollywood headers.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={standardizeHeadings}
                    onChange={(e) => setStandardizeHeadings(e.target.checked)}
                    className="accent-emerald-500 mt-1 cursor-pointer"
                  />
                </div>

                {/* 4. Continuous Dialogue Detection */}
                <div
                  onClick={() => setDetectContinuousDialogue(!detectContinuousDialogue)}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    detectContinuousDialogue
                      ? isLight
                        ? 'bg-slate-50/60 border-slate-200'
                        : 'bg-zinc-900/40 border-zinc-800/80'
                      : 'opacity-60 bg-transparent border-dashed'
                  }`}
                >
                  <div className="mt-0.5 p-1 rounded-md bg-teal-500/10 text-teal-500 shrink-0">
                    <Wand2 size={14} />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-sm">Auto-Detect Continuous Dialogue</div>
                    <p className="text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      Detects continuous speeches interrupted only by action beats and inserts standard (continues) / (தொடர்ந்து) cues.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={detectContinuousDialogue}
                    onChange={(e) => setDetectContinuousDialogue(e.target.checked)}
                    className="accent-emerald-500 mt-1 cursor-pointer"
                  />
                </div>

                {/* 5. Tamil Phonetic & Word Export Typo Repair */}
                <div
                  onClick={() => setCorrectTamilTypos(!correctTamilTypos)}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    correctTamilTypos
                      ? isLight
                        ? 'bg-slate-50/60 border-slate-200'
                        : 'bg-zinc-900/40 border-zinc-800/80'
                      : 'opacity-60 bg-transparent border-dashed'
                  }`}
                >
                  <div className="mt-0.5 p-1 rounded-md bg-amber-500/10 text-amber-500 shrink-0">
                    <Type size={14} />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-sm">Tamil Phonetic & Word Export Typo Repair</div>
                    <p className="text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      Auto-corrects common Word export OCR and phonetic spelling slips (e.g. "பகள்" → "பகல்", "அனிந்து" → "அணிந்து", "பதட்டம்" → "பதற்றம்").
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={correctTamilTypos}
                    onChange={(e) => setCorrectTamilTypos(e.target.checked)}
                    className="accent-emerald-500 mt-1 cursor-pointer"
                  />
                </div>
              </div>

              {/* AI Model & Scope Selection */}
              <div
                className={`p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-4 ${
                  isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-zinc-900/40 border-zinc-800/80'
                }`}
              >
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1.5">
                    AI Alignment Engine Model
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-lg border font-medium outline-none ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-800'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-100'
                    }`}
                  >
                    <option value="gemini-flash-latest">Gemini Flash Latest (Recommended - Fast & Generous)</option>
                    <option value="gemini-3.6-flash">Gemini 3.6 Flash (High Precision)</option>
                    <option value="openrouter/anthropic/claude-3.5-haiku">OpenRouter Claude 3.5 Haiku</option>
                    <option value="groq-llama-3.3-70b-versatile">Groq Llama 3.3 70B (Fastest)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1.5">
                    Processing Scope
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSceneRangeMode('all')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border text-center transition-all cursor-pointer ${
                        sceneRangeMode === 'all'
                          ? 'bg-emerald-500 text-black border-emerald-400 font-bold shadow-xs'
                          : isLight
                          ? 'bg-white text-slate-700 border-slate-200'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      Entire 200 Pgs ({screenplayData.scenes.length} Sc)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSceneRangeMode('custom')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border text-center transition-all cursor-pointer ${
                        sceneRangeMode === 'custom'
                          ? 'bg-emerald-500 text-black border-emerald-400 font-bold shadow-xs'
                          : isLight
                          ? 'bg-white text-slate-700 border-slate-200'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      Custom Range
                    </button>
                  </div>
                  {sceneRangeMode === 'custom' && (
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span>Scene</span>
                      <input
                        type="number"
                        min={1}
                        max={screenplayData.scenes.length}
                        value={startSceneIdx}
                        onChange={(e) => setStartSceneIdx(parseInt(e.target.value) || 1)}
                        className={`w-16 px-2 py-1 rounded border text-center ${
                          isLight ? 'bg-white border-slate-300' : 'bg-zinc-800 border-zinc-700'
                        }`}
                      />
                      <span>to</span>
                      <input
                        type="number"
                        min={1}
                        max={screenplayData.scenes.length}
                        value={endSceneIdx}
                        onChange={(e) => setEndSceneIdx(parseInt(e.target.value) || screenplayData.scenes.length)}
                        className={`w-16 px-2 py-1 rounded border text-center ${
                          isLight ? 'bg-white border-slate-300' : 'bg-zinc-800 border-zinc-700'
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Undo Safeguard Guarantee Notice */}
              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                  isLight ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                }`}
              >
                <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                <span>
                  <strong>100% Non-Destructive:</strong> A full backup snapshot is automatically preserved. You can click <strong>Undo AI Alignment</strong> at any time to instantly revert.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-t ${
            isLight ? 'border-slate-200 bg-slate-50/80' : 'border-zinc-800/80 bg-zinc-900/60'
          }`}
        >
          <div>
            {canUndo && onUndoAlignment && (
              <button
                onClick={onUndoAlignment}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                title="Undo AI Alignment and restore previous script state"
              >
                <RotateCcw size={13} />
                <span>Undo AI Alignment</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {isRunning ? 'Keep Running in Background' : 'Close'}
            </button>

            {!isRunning && (
              <button
                onClick={handleStart}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-black text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Sparkles size={14} />
                <span>Auto-Align Screenplay ({screenplayData.scenes.length} Scenes)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
