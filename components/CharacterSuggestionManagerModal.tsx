import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Plus,
  Edit2,
  Trash2,
  GitMerge,
  AlertTriangle,
  Check,
  RotateCcw,
  Sparkles,
  Users,
  MapPin,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { TamilScene } from '../services/tamilLeftRightEngine';

export interface CharacterOccurrence {
  sceneId: string;
  sceneNumber: string;
  sceneHeading: string;
  type: 'header' | 'dialogue';
  itemId?: string;
  snippet: string;
  speaker?: string;
}

interface CharacterSuggestionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  allKnownCharacters: string[];
  characterCounts: Map<string, number>;
  onRenameCharacter: (oldName: string, newName: string) => void;
  onMergeCharacters: (sourceName: string, targetName: string) => void;
  onDeleteCharacter: (name: string) => void;
  onAddCharacter: (name: string) => void;
  scenes?: TamilScene[];
  onJumpToOccurrence?: (sceneId: string, itemId?: string) => void;
  isLight?: boolean;
}

// Levenshtein distance helper to identify typographical errors
function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export const CharacterSuggestionManagerModal: React.FC<CharacterSuggestionManagerModalProps> = ({
  isOpen,
  onClose,
  allKnownCharacters,
  characterCounts,
  onRenameCharacter,
  onMergeCharacters,
  onDeleteCharacter,
  onAddCharacter,
  scenes,
  onJumpToOccurrence,
  isLight = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [newCharacterInput, setNewCharacterInput] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [mergingSource, setMergingSource] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [expandedName, setExpandedName] = useState<string | null>(null);

  // Pre-calculate occurrences for all characters across the screenplay
  const occurrencesMap = useMemo(() => {
    const map = new Map<string, CharacterOccurrence[]>();
    if (!scenes || scenes.length === 0) return map;

    scenes.forEach((sc) => {
      const sceneHeading = `Scene ${sc.sceneNumber || ''}: ${sc.location || 'Scene'} ${sc.timeOfDay ? `(${sc.timeOfDay})` : ''}`.trim();

      // 1. Scene header characters list
      (sc.characters || []).forEach((c) => {
        const charName = c.trim();
        if (!charName) return;
        const list = map.get(charName) || [];
        list.push({
          sceneId: sc.id,
          sceneNumber: sc.sceneNumber || '1',
          sceneHeading,
          type: 'header',
          snippet: `Listed in Scene Characters: [${(sc.characters || []).join(', ')}]`,
        });
        map.set(charName, list);
      });

      // 2. Dialogue rows
      sc.items.forEach((it) => {
        let charName = (it.rightCharacter || '').trim();
        let dialogueText = (it.rightDialogue || it.rawText || '').trim();

        if (!charName && it.column === 'right' && dialogueText) {
          const m = dialogueText.match(/^([\u0B80-\u0BFFa-zA-Z0-9\s.]{2,30})\s*:\s*(.*)$/);
          if (m) {
            charName = m[1].trim();
            dialogueText = m[2].trim();
          }
        }
        if (charName.endsWith(':')) charName = charName.slice(0, -1).trim();

        if (charName && charName !== 'கதாபாத்திரம்') {
          const list = map.get(charName) || [];
          const textSnippet = dialogueText.replace(/^[^:]+:\s*/, '').trim();
          list.push({
            sceneId: sc.id,
            sceneNumber: sc.sceneNumber || '1',
            sceneHeading,
            type: 'dialogue',
            itemId: it.id,
            speaker: charName,
            snippet: textSnippet ? `"${textSnippet.slice(0, 100)}${textSnippet.length > 100 ? '...' : ''}"` : '(Dialogue line)',
          });
          map.set(charName, list);
        }
      });
    });

    return map;
  }, [scenes]);

  // Filtered list of characters based on search
  const filteredCharacters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allKnownCharacters;
    return allKnownCharacters.filter((name) =>
      name.toLowerCase().includes(q)
    );
  }, [allKnownCharacters, searchQuery]);

  // Smart typo and near-duplicate detector
  const potentialTypos = useMemo(() => {
    const pairs: { suspect: string; suspectCount: number; target: string; targetCount: number; reason: string }[] = [];
    const names = [...allKnownCharacters];

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const name1 = names[i];
        const name2 = names[j];
        const count1 = characterCounts.get(name1) || 0;
        const count2 = characterCounts.get(name2) || 0;

        // Skip identical
        if (name1 === name2) continue;

        // Reason 1: Substring match with common typo suffix (e.g. ரங்கா vs ரங்கான்)
        const isSub = (name1.includes(name2) || name2.includes(name1)) && Math.abs(name1.length - name2.length) <= 2;
        // Reason 2: Levenshtein distance 1 or 2
        const dist = getLevenshteinDistance(name1, name2);
        const isClose = dist > 0 && dist <= 2 && Math.max(name1.length, name2.length) >= 3;

        if (isSub || isClose) {
          // The one with fewer occurrences is likely the suspect/typo
          const suspect = count1 <= count2 ? name1 : name2;
          const target = count1 <= count2 ? name2 : name1;
          const suspectCount = count1 <= count2 ? count1 : count2;
          const targetCount = count1 <= count2 ? count2 : count1;

          // Don't add duplicate pairs
          if (!pairs.some((p) => (p.suspect === suspect && p.target === target) || (p.suspect === target && p.target === suspect))) {
            pairs.push({
              suspect,
              suspectCount,
              target,
              targetCount,
              reason: isSub ? 'Suffix/Letter Variation' : `Distance (${dist} char diff)`,
            });
          }
        }
      }
    }

    return pairs;
  }, [allKnownCharacters, characterCounts]);

  if (!isOpen) return null;

  const handleStartEdit = (name: string) => {
    setEditingName(name);
    setEditValue(name);
    setMergingSource(null);
  };

  const handleSaveEdit = (oldName: string) => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== oldName) {
      onRenameCharacter(oldName, trimmed);
    }
    setEditingName(null);
    setEditValue('');
  };

  const handleStartMerge = (name: string) => {
    setMergingSource(name);
    // Default target to the highest frequency other character or first available
    const others = allKnownCharacters.filter((c) => c !== name);
    const bestTarget = others.sort((a, b) => (characterCounts.get(b) || 0) - (characterCounts.get(a) || 0))[0] || '';
    setMergeTarget(bestTarget);
    setEditingName(null);
  };

  const handleConfirmMerge = (source: string) => {
    if (mergeTarget && mergeTarget !== source) {
      onMergeCharacters(source, mergeTarget);
    }
    setMergingSource(null);
    setMergeTarget('');
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCharacterInput.trim();
    if (trimmed) {
      onAddCharacter(trimmed);
      setNewCharacterInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl max-h-[85vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-[#151518] border-zinc-700/80 text-zinc-100 shadow-[0_25px_60px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
          isLight ? 'border-slate-200 bg-slate-50/70' : 'border-zinc-800 bg-zinc-900/50'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`p-2 rounded-xl border ${
              isLight
                ? 'bg-sky-50 text-sky-700 border-sky-200'
                : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
            }`}>
              <Users size={20} />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                Auto-Suggestion Names Management System
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                  isLight ? 'bg-slate-200 text-slate-700' : 'bg-zinc-800 text-zinc-300'
                }`}>
                  {allKnownCharacters.length} Names
                </span>
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Fix character typos, merge misspelled variants, and curate suggestions across all dialogue lines.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isLight
                ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Potential Typos Notification Box (If detected) */}
        {potentialTypos.length > 0 && (
          <div className={`p-3 sm:px-5 border-b flex flex-col gap-2 ${
            isLight
              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span>{potentialTypos.length} Potential Typo / Variant(s) Detected</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-0.5">
              {potentialTypos.slice(0, 4).map((pt, idx) => (
                <div
                  key={`pt-${idx}`}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                    isLight
                      ? 'bg-white border-amber-300/80 shadow-xs'
                      : 'bg-zinc-900 border-amber-500/30'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(pt.suspect);
                      setExpandedName((prev) => (prev === pt.suspect ? null : pt.suspect));
                    }}
                    className="font-semibold line-through opacity-75 hover:opacity-100 hover:text-amber-600 dark:hover:text-amber-300 underline underline-offset-2 cursor-pointer text-left transition-colors"
                    title={`Click to search "${pt.suspect}" and see where it appears in the script`}
                  >
                    {pt.suspect} <span className="text-[10px] opacity-75 font-mono">({pt.suspectCount})</span>
                  </button>
                  <span>→</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(pt.target);
                      setExpandedName((prev) => (prev === pt.target ? null : pt.target));
                    }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 underline underline-offset-2 cursor-pointer text-left transition-colors"
                    title={`Click to search "${pt.target}" and see where it appears in the script`}
                  >
                    {pt.target} <span className="text-[10px] opacity-75 font-mono">({pt.targetCount})</span>
                  </button>
                  <button
                    onClick={() => onMergeCharacters(pt.suspect, pt.target)}
                    className="ml-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-black transition-colors cursor-pointer shadow-2xs"
                    title={`Replace all occurrences of "${pt.suspect}" with "${pt.target}"`}
                  >
                    Merge
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar: Search & Add New Character */}
        <div className={`p-3 sm:p-4 border-b flex flex-col sm:flex-row items-center gap-3 ${
          isLight ? 'border-slate-200 bg-white' : 'border-zinc-800 bg-[#18181c]'
        }`}>
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isLight ? 'text-slate-400' : 'text-zinc-500'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search character names (e.g. ரங்கா) or click any name below..."
              className={`w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border outline-none font-medium transition-colors ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-800 focus:border-sky-500'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-sky-500'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-200 text-slate-400 hover:text-slate-700' : 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200'
                }`}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Add Approved Character Form */}
          <form onSubmit={handleAddNew} className="flex items-center gap-1.5 w-full sm:w-auto">
            <input
              type="text"
              value={newCharacterInput}
              onChange={(e) => setNewCharacterInput(e.target.value)}
              placeholder="New character name..."
              className={`flex-1 sm:w-48 px-3 py-1.5 text-xs rounded-xl border outline-none font-medium transition-colors ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-800 focus:border-emerald-500'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-emerald-500'
              }`}
            />
            <button
              type="submit"
              disabled={!newCharacterInput.trim()}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Plus size={13} className="stroke-[3]" />
              <span>Add</span>
            </button>
          </form>
        </div>

        {/* Scrollable Character Names List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-slate-100 dark:divide-zinc-800/80">
          {filteredCharacters.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-zinc-500 flex flex-col items-center gap-2">
              <span>No characters found matching "{searchQuery}"</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-sky-500 hover:underline cursor-pointer"
                >
                  Clear search filter
                </button>
              )}
            </div>
          ) : (
            filteredCharacters.map((name) => {
              const count = characterCounts.get(name) || 0;
              const isEditing = editingName === name;
              const isMerging = mergingSource === name;
              const isRare = count <= 1;
              const occurrences = occurrencesMap.get(name) || [];
              const isExpanded = expandedName === name;

              return (
                <div
                  key={name}
                  className={`py-2 px-3 rounded-xl flex flex-col transition-all border ${
                    isExpanded
                      ? isLight
                        ? 'bg-sky-50/50 border-sky-200 shadow-xs'
                        : 'bg-zinc-900/90 border-zinc-700 shadow-md'
                      : isLight
                      ? 'border-transparent hover:bg-slate-50/80'
                      : 'border-transparent hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Left: Character Avatar, Name (Click to search & inspect), Badges */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                        isLight
                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}>
                        {name.charAt(0)}
                      </span>

                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(name);
                              if (e.key === 'Escape') setEditingName(null);
                            }}
                            autoFocus
                            className={`flex-1 px-2.5 py-1 text-xs rounded-lg border outline-none font-bold ${
                              isLight
                                ? 'bg-white border-sky-500 text-slate-900 ring-2 ring-sky-500/20'
                                : 'bg-zinc-950 border-sky-400 text-white ring-2 ring-sky-500/30'
                            }`}
                          />
                          <button
                            onClick={() => handleSaveEdit(name)}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
                            title="Save change everywhere in script"
                          >
                            <Check size={13} className="stroke-[3]" />
                          </button>
                          <button
                            onClick={() => setEditingName(null)}
                            className={`p-1.5 rounded-lg cursor-pointer ${
                              isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-zinc-800 text-zinc-400'
                            }`}
                            title="Cancel"
                          >
                            <RotateCcw size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          {/* Clickable Name: Fills Search & Expands Occurrence Details */}
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery(name);
                              setExpandedName((prev) => (prev === name ? null : name));
                            }}
                            className={`group/name font-bold text-sm tracking-wide break-words text-left transition-colors cursor-pointer flex items-center gap-1.5 ${
                              isLight
                                ? 'hover:text-sky-600 text-slate-900'
                                : 'hover:text-sky-400 text-zinc-100'
                            }`}
                            title={`Click to search "${name}" and inspect where it comes from`}
                          >
                            <span className="group-hover/name:underline underline-offset-2">{name}</span>
                            <Search size={11} className="opacity-0 group-hover/name:opacity-100 text-sky-500 transition-opacity shrink-0" />
                          </button>

                          {/* Occurrence Source Count Pill (Clickable toggle) */}
                          <button
                            type="button"
                            onClick={() => setExpandedName((prev) => (prev === name ? null : name))}
                            className={`text-[11px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all cursor-pointer ${
                              count > 0
                                ? isLight
                                  ? isExpanded
                                    ? 'bg-sky-100 text-sky-800 border-sky-300 font-semibold'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                                  : isExpanded
                                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-semibold'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700'
                                : occurrences.length > 0
                                ? isLight
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 font-bold'
                                  : 'bg-purple-500/15 text-purple-300 border-purple-500/30 font-bold'
                                : isLight
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold'
                            }`}
                            title="Click to see where this name originates in scenes"
                          >
                            <MapPin size={10} className="shrink-0" />
                            <span>
                              {count > 0
                                ? `${count} line${count === 1 ? '' : 's'}`
                                : occurrences.length > 0
                                ? `${occurrences.length} scene hdr`
                                : 'Approved Master'}
                            </span>
                            <ChevronDown
                              size={11}
                              className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>

                          {isRare && count > 0 && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${
                                isLight
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              }`}
                              title="Only appears 1 time in the script. Check if this is a spelling typo."
                            >
                              <AlertTriangle size={10} />
                              <span>Possible Typo</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Actions: Rename, Merge, Delete */}
                    {!isEditing && (
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {isMerging ? (
                          <div className="flex items-center gap-1.5 bg-amber-500/10 p-1 rounded-xl border border-amber-500/30">
                            <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold">Merge into:</span>
                            <select
                              value={mergeTarget}
                              onChange={(e) => setMergeTarget(e.target.value)}
                              className={`text-xs px-2 py-1 rounded-lg border outline-none font-bold ${
                                isLight
                                  ? 'bg-white border-slate-300 text-slate-800'
                                  : 'bg-zinc-900 border-zinc-700 text-zinc-100'
                              }`}
                            >
                              {allKnownCharacters
                                .filter((c) => c !== name)
                                .map((c) => (
                                  <option key={c} value={c}>
                                    {c} ({characterCounts.get(c) || 0} lines)
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={() => handleConfirmMerge(name)}
                              className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer shadow-xs"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setMergingSource(null)}
                              className={`p-1 rounded cursor-pointer ${
                                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* 1. Quick Rename / Fix Typo Everywhere */}
                            <button
                              onClick={() => handleStartEdit(name)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 transition-colors cursor-pointer ${
                                isLight
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                              }`}
                              title={`Rename "${name}" across all scenes`}
                            >
                              <Edit2 size={11} className="text-sky-500" />
                              <span>Rename / Fix</span>
                            </button>

                            {/* 2. Merge into Another Character */}
                            <button
                              onClick={() => handleStartMerge(name)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 transition-colors cursor-pointer ${
                                isLight
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                              }`}
                              title={`Merge "${name}" into another character`}
                            >
                              <GitMerge size={11} className="text-amber-500" />
                              <span>Merge</span>
                            </button>

                            {/* 3. Delete / Exclude from Auto-Suggestions */}
                            <button
                              onClick={() => onDeleteCharacter(name)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isLight
                                  ? 'hover:bg-red-50 text-slate-400 hover:text-red-600 border-slate-200 hover:border-red-300'
                                  : 'hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border-zinc-800 hover:border-red-500/30'
                              }`}
                              title={`Remove "${name}" from auto-suggestions`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Collapsible Where-From Context Panel */}
                  {isExpanded && (
                    <div
                      className={`mt-2.5 p-3 rounded-xl border text-xs flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150 ${
                        isLight
                          ? 'bg-white border-sky-200 text-slate-700 shadow-2xs'
                          : 'bg-zinc-950/80 border-zinc-700/80 text-zinc-300 shadow-inner'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-slate-200 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5 font-bold text-sky-600 dark:text-sky-400">
                          <MapPin size={13} />
                          <span>Where "{name}" is coming from in screenplay ({occurrences.length} place{occurrences.length === 1 ? '' : 's'}):</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedName(null)}
                          className="text-[11px] opacity-60 hover:opacity-100 hover:underline cursor-pointer"
                        >
                          Hide details
                        </button>
                      </div>

                      {occurrences.length === 0 ? (
                        <div className="py-2 text-center text-xs opacity-70 font-mono">
                          This name is currently in the master approved suggestion list, but doesn't appear in any dialogue or scene header yet.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                          {occurrences.map((occ, idx) => (
                            <div
                              key={`occ-${idx}`}
                              className={`p-2 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                                isLight
                                  ? 'bg-slate-50/80 border-slate-200'
                                  : 'bg-zinc-900/90 border-zinc-800'
                              }`}
                            >
                              <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 dark:text-white shrink-0">
                                    Scene {occ.sceneNumber}
                                  </span>
                                  <span className="text-[11px] opacity-70 truncate max-w-[220px]" title={occ.sceneHeading}>
                                    {occ.sceneHeading}
                                  </span>
                                  <span
                                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                                      occ.type === 'header'
                                        ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                                        : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                                    }`}
                                  >
                                    {occ.type === 'header' ? 'Scene Header' : 'Dialogue'}
                                  </span>
                                </div>
                                <p className="text-[11px] opacity-85 font-tamil break-words line-clamp-2 bg-black/5 dark:bg-white/5 p-1.5 rounded">
                                  {occ.snippet}
                                </p>
                              </div>

                              {onJumpToOccurrence && (
                                <button
                                  type="button"
                                  onClick={() => onJumpToOccurrence(occ.sceneId, occ.itemId)}
                                  className="self-end sm:self-center shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                                  title="Jump directly to this location in the screenplay"
                                >
                                  <span>View in Script</span>
                                  <ExternalLink size={11} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className={`p-3 sm:px-5 border-t flex items-center justify-between text-xs ${
          isLight ? 'border-slate-200 bg-slate-50/70 text-slate-600' : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'
        }`}>
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" />
            <span>Renaming or merging updates all dialogue rows & scene headers instantly.</span>
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl font-bold border transition-colors cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700'
            }`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
