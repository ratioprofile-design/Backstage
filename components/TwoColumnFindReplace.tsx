import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TamilScreenplayData, TamilScene, TamilScriptItem } from '../services/tamilLeftRightEngine';
import {
  Search,
  Replace,
  ArrowUp,
  ArrowDown,
  X,
  ChevronDown,
  Check,
  Sparkles,
  SlidersHorizontal,
  FileText,
} from 'lucide-react';

export type FindScope = 'all' | 'action' | 'dialogue' | 'character' | 'heading';

export interface FindMatch {
  id: string; // Unique match identifier
  sceneId: string;
  itemId?: string; // If inside an item
  field: 'leftAction' | 'rightDialogue' | 'rightCharacter' | 'location' | 'timeOfDay' | 'effects' | 'rawText';
  matchText: string;
  contextPreview: string;
}

export interface TwoColumnFindReplaceProps {
  screenplayData: TamilScreenplayData;
  onUpdateScreenplay: (updater: (prev: TamilScreenplayData) => TamilScreenplayData) => void;
  isOpen: boolean;
  onClose: () => void;
  isLight?: boolean;
  onToast?: (msg: string) => void;
  initialQuery?: string;
  initialShowReplace?: boolean;
}

export const TwoColumnFindReplace: React.FC<TwoColumnFindReplaceProps> = ({
  screenplayData,
  onUpdateScreenplay,
  isOpen,
  onClose,
  isLight = false,
  onToast,
  initialQuery = '',
  initialShowReplace = false,
}) => {
  const [findQuery, setFindQuery] = useState(initialQuery);
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplaceRow, setShowReplaceRow] = useState(initialShowReplace);

  // Search modifiers
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [scope, setScope] = useState<FindScope>('all');

  // Match tracking
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Focus find input whenever opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        findInputRef.current?.select();
        findInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Compute all matches across the screenplay
  const matches = useMemo<FindMatch[]>(() => {
    if (!findQuery.trim()) return [];

    let regex: RegExp;
    try {
      let pattern = findQuery;
      if (!useRegex) {
        // Escape special regex characters
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      regex = new RegExp(pattern, matchCase ? 'g' : 'gi');
    } catch {
      return [];
    }

    const results: FindMatch[] = [];

    screenplayData.scenes.forEach((scene) => {
      // 1. Scene Headings (if scope allows)
      if (scope === 'all' || scope === 'heading') {
        if (scene.location && regex.test(scene.location)) {
          results.push({
            id: `hdr-loc-${scene.id}`,
            sceneId: scene.id,
            field: 'location',
            matchText: scene.location,
            contextPreview: `Scene ${scene.sceneNumber}: ${scene.location}`,
          });
        }
        if (scene.timeOfDay && regex.test(scene.timeOfDay)) {
          results.push({
            id: `hdr-time-${scene.id}`,
            sceneId: scene.id,
            field: 'timeOfDay',
            matchText: scene.timeOfDay,
            contextPreview: `Scene ${scene.sceneNumber} Time: ${scene.timeOfDay}`,
          });
        }
      }

      // 2. Items (Action / Dialogue / Character)
      scene.items.forEach((item) => {
        // Left Column (Action)
        if (scope === 'all' || scope === 'action') {
          const actionText = item.leftAction || (item.column === 'left' ? item.rawText : '');
          if (actionText && regex.test(actionText)) {
            results.push({
              id: `item-act-${item.id}`,
              sceneId: scene.id,
              itemId: item.id,
              field: item.leftAction ? 'leftAction' : 'rawText',
              matchText: actionText,
              contextPreview: actionText.slice(0, 60),
            });
          }
        }

        // Right Column (Dialogue)
        if (scope === 'all' || scope === 'dialogue') {
          const dialogueText = item.rightDialogue || (item.column === 'right' ? item.rawText : '');
          if (dialogueText && regex.test(dialogueText)) {
            results.push({
              id: `item-dlg-${item.id}`,
              sceneId: scene.id,
              itemId: item.id,
              field: item.rightDialogue ? 'rightDialogue' : 'rawText',
              matchText: dialogueText,
              contextPreview: dialogueText.slice(0, 60),
            });
          }
        }

        // Character Name
        if (scope === 'all' || scope === 'character') {
          if (item.rightCharacter && regex.test(item.rightCharacter)) {
            results.push({
              id: `item-char-${item.id}`,
              sceneId: scene.id,
              itemId: item.id,
              field: 'rightCharacter',
              matchText: item.rightCharacter,
              contextPreview: `Character: ${item.rightCharacter}`,
            });
          }
        }
      });
    });

    return results;
  }, [screenplayData, findQuery, matchCase, wholeWord, useRegex, scope]);

  // Adjust active match index if list shrinks
  useEffect(() => {
    if (currentMatchIndex >= matches.length) {
      setCurrentMatchIndex(matches.length > 0 ? 0 : 0);
    }
  }, [matches.length, currentMatchIndex]);

  // Scroll to current match
  const scrollToMatch = useCallback(
    (index: number) => {
      const match = matches[index];
      if (!match) return;

      let el: HTMLElement | null = null;
      if (match.itemId) {
        el = document.querySelector(`[data-item-id="${match.itemId}"]`) as HTMLElement;
      }
      if (!el && match.sceneId) {
        el = document.querySelector(`[data-scene-id="${match.sceneId}"]`) as HTMLElement;
        if (!el) {
          el = document.getElementById(`scene-header-${match.sceneId}`);
        }
      }

      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash subtle highlight ring
        el.classList.add('ring-2', 'ring-amber-400', 'bg-amber-400/10');
        setTimeout(() => {
          el?.classList.remove('ring-2', 'ring-amber-400', 'bg-amber-400/10');
        }, 1500);
      }
    },
    [matches]
  );

  const handleNext = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIdx);
    scrollToMatch(nextIdx);
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIdx);
    scrollToMatch(prevIdx);
  };

  // Replace Single
  const handleReplaceSingle = () => {
    if (matches.length === 0) return;
    const current = matches[currentMatchIndex];
    if (!current) return;

    let regex: RegExp;
    try {
      let pattern = findQuery;
      if (!useRegex) {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      regex = new RegExp(pattern, matchCase ? '' : 'i');
    } catch {
      return;
    }

    onUpdateScreenplay((prev) => {
      const nextScenes = prev.scenes.map((scene) => {
        if (scene.id !== current.sceneId) return scene;

        // Heading field
        if (!current.itemId) {
          if (current.field === 'location') {
            return { ...scene, location: scene.location.replace(regex, replaceQuery) };
          }
          if (current.field === 'timeOfDay') {
            return { ...scene, timeOfDay: scene.timeOfDay.replace(regex, replaceQuery) };
          }
          return scene;
        }

        // Item field
        const nextItems = scene.items.map((it) => {
          if (it.id !== current.itemId) return it;
          const updated = { ...it };

          if (current.field === 'leftAction' && updated.leftAction) {
            updated.leftAction = updated.leftAction.replace(regex, replaceQuery);
          } else if (current.field === 'rightDialogue' && updated.rightDialogue) {
            updated.rightDialogue = updated.rightDialogue.replace(regex, replaceQuery);
          } else if (current.field === 'rightCharacter' && updated.rightCharacter) {
            updated.rightCharacter = updated.rightCharacter.replace(regex, replaceQuery);
          } else if (current.field === 'rawText' && updated.rawText) {
            updated.rawText = updated.rawText.replace(regex, replaceQuery);
          }

          return updated;
        });

        return { ...scene, items: nextItems };
      });

      return { ...prev, scenes: nextScenes };
    });

    onToast?.(`Replaced 1 occurrence`);
    // Advance to next
    handleNext();
  };

  // Replace All
  const handleReplaceAll = () => {
    if (matches.length === 0) return;

    let regex: RegExp;
    try {
      let pattern = findQuery;
      if (!useRegex) {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      regex = new RegExp(pattern, matchCase ? 'g' : 'gi');
    } catch {
      return;
    }

    let count = 0;

    onUpdateScreenplay((prev) => {
      const nextScenes = prev.scenes.map((scene) => {
        let scLocation = scene.location;
        let scTime = scene.timeOfDay;

        if (scope === 'all' || scope === 'heading') {
          if (scLocation && regex.test(scLocation)) {
            scLocation = scLocation.replace(regex, () => {
              count++;
              return replaceQuery;
            });
          }
          if (scTime && regex.test(scTime)) {
            scTime = scTime.replace(regex, () => {
              count++;
              return replaceQuery;
            });
          }
        }

        const nextItems = scene.items.map((it) => {
          let leftAct = it.leftAction;
          let rightDlg = it.rightDialogue;
          let rightChar = it.rightCharacter;
          let raw = it.rawText;

          if ((scope === 'all' || scope === 'action') && leftAct && regex.test(leftAct)) {
            leftAct = leftAct.replace(regex, () => {
              count++;
              return replaceQuery;
            });
          }

          if ((scope === 'all' || scope === 'dialogue') && rightDlg && regex.test(rightDlg)) {
            rightDlg = rightDlg.replace(regex, () => {
              count++;
              return replaceQuery;
            });
          }

          if ((scope === 'all' || scope === 'character') && rightChar && regex.test(rightChar)) {
            rightChar = rightChar.replace(regex, () => {
              count++;
              return replaceQuery;
            });
          }

          if (raw && regex.test(raw)) {
            raw = raw.replace(regex, () => {
              count++;
              return replaceQuery;
            });
          }

          return {
            ...it,
            leftAction: leftAct,
            rightDialogue: rightDlg,
            rightCharacter: rightChar,
            rawText: raw,
          };
        });

        return {
          ...scene,
          location: scLocation,
          timeOfDay: scTime,
          items: nextItems,
        };
      });

      return { ...prev, scenes: nextScenes };
    });

    onToast?.(`Replaced ${count} occurrences across script`);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Enter') {
        if (e.target === findInputRef.current) {
          e.preventDefault();
          if (e.shiftKey) handlePrev();
          else handleNext();
        } else if (e.target === replaceInputRef.current) {
          e.preventDefault();
          handleReplaceSingle();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, handleReplaceSingle, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`absolute top-3 right-5 z-40 w-96 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 transition-all ${
        isLight
          ? 'bg-white/95 border-slate-300 text-slate-800 shadow-slate-400/30'
          : 'bg-[#15151a]/95 border-zinc-700/80 text-zinc-100 shadow-black/80'
      }`}
    >
      {/* Container */}
      <div className="p-3 space-y-2">
        {/* ROW 1: FIND INPUT */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowReplaceRow(!showReplaceRow)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              showReplaceRow
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Toggle Replace"
          >
            <ChevronDown
              size={14}
              className={`transition-transform ${showReplaceRow ? 'rotate-0' : '-rotate-90'}`}
            />
          </button>

          <div className="relative flex-1">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
            />
            <input
              ref={findInputRef}
              type="text"
              value={findQuery}
              onChange={(e) => {
                setFindQuery(e.target.value);
                setCurrentMatchIndex(0);
              }}
              placeholder="Find in script..."
              className={`w-full pl-8 pr-16 py-1.5 text-xs rounded-lg outline-none border transition-all ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  : 'bg-zinc-900/90 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
              }`}
            />

            {/* Match Counter Badge */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-400 pointer-events-none">
              {findQuery.trim() ? (
                matches.length > 0 ? (
                  <span className="font-bold text-emerald-400">
                    {currentMatchIndex + 1}/{matches.length}
                  </span>
                ) : (
                  <span className="text-red-400 font-bold">0</span>
                )
              ) : null}
            </div>
          </div>

          {/* Up / Down Navigation Buttons */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handlePrev}
              disabled={matches.length === 0}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-zinc-800 text-zinc-300'
              }`}
              title="Previous Match (Shift+Enter)"
            >
              <ArrowUp size={13} />
            </button>
            <button
              onClick={handleNext}
              disabled={matches.length === 0}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-zinc-800 text-zinc-300'
              }`}
              title="Next Match (Enter)"
            >
              <ArrowDown size={13} />
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-800' : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title="Close (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ROW 2: REPLACE INPUT (Collapsible) */}
        {showReplaceRow && (
          <div className="flex items-center gap-1.5 pl-7">
            <div className="relative flex-1">
              <Replace
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
              />
              <input
                ref={replaceInputRef}
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder="Replace with..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none border transition-all ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                    : 'bg-zinc-900/90 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                }`}
              />
            </div>

            <button
              onClick={handleReplaceSingle}
              disabled={matches.length === 0}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Replace current match"
            >
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-xs"
              title="Replace all matches across the entire script"
            >
              All
            </button>
          </div>
        )}

        {/* ROW 3: ADVANCED MODIFIERS & SCOPE SELECTOR */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-700/40 text-[10px] font-mono">
          {/* Modifiers: Case, Word, Regex */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMatchCase(!matchCase)}
              className={`px-1.5 py-0.5 rounded font-bold border transition-all ${
                matchCase
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/60 shadow-xs'
                  : 'bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800'
              }`}
              title="Match Case (Case Sensitive)"
            >
              Aa
            </button>
            <button
              onClick={() => setWholeWord(!wholeWord)}
              className={`px-1.5 py-0.5 rounded font-bold border transition-all ${
                wholeWord
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/60 shadow-xs'
                  : 'bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800'
              }`}
              title="Match Whole Word"
            >
              [ab]
            </button>
            <button
              onClick={() => setUseRegex(!useRegex)}
              className={`px-1.5 py-0.5 rounded font-bold border transition-all ${
                useRegex
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/60 shadow-xs'
                  : 'bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800'
              }`}
              title="Use Regular Expression"
            >
              .*
            </button>
          </div>

          {/* Scope Selector: All, Left Action, Right Dialogue, Character, Heading */}
          <div className="flex items-center gap-1">
            <span className="text-zinc-500 font-sans">In:</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as FindScope)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold outline-none border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-800'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-200'
              }`}
            >
              <option value="all">Entire Script</option>
              <option value="action">Action (Left: காட்சி)</option>
              <option value="dialogue">Dialogue (Right: வசனம்)</option>
              <option value="character">Characters Only</option>
              <option value="heading">Scene Headings</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
