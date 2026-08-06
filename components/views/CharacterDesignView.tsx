import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { CharacterData } from '../../types';
import { generateImage } from '../../services/gemini';
import DualViewToggle from '../DualViewToggle';
import {
  Users, Film, PenLine, Brain, Image as ImageIcon,
  Plus, Trash2, Link2, FileText, Sparkles, Loader2, User, Wand2,
  ChevronLeft, ChevronRight, Bold, Italic, Underline, Strikethrough, Eraser,
  Lock, LockOpen
} from 'lucide-react';

const BACKSTORY_STYLE_BUTTONS = [
  { command: 'bold', title: 'Bold', icon: Bold },
  { command: 'italic', title: 'Italic', icon: Italic },
  { command: 'underline', title: 'Underline', icon: Underline },
  { command: 'strikeThrough', title: 'Strikethrough', icon: Strikethrough },
] as const;

const BACKSTORY_FONT_SIZES = [
  { value: '2', label: 'Tiny' },
  { value: '3', label: 'Small' },
  { value: '4', label: 'Normal' },
  { value: '5', label: 'Large' },
  { value: '6', label: 'XL' },
  { value: '7', label: 'Huge' },
] as const;

const BILLING_TIERS = [
  { id: 'lead', label: 'Lead Role', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40', badgeLight: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'supporting', label: 'Supporting Role', badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40', badgeLight: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { id: 'day_player', label: 'Day Player', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/40', badgeLight: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'voiceover', label: 'Voice Over', badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40', badgeLight: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { id: 'stunt', label: 'Stunt / Action', badge: 'bg-rose-500/20 text-rose-400 border-rose-500/40', badgeLight: 'bg-rose-100 text-rose-800 border-rose-300' },
  { id: 'extra', label: 'Featured Extra', badge: 'bg-slate-500/20 text-slate-400 border-slate-500/40', badgeLight: 'bg-slate-200 text-slate-800 border-slate-300' },
] as const;

const CharacterDesignView: React.FC<{ onNavigateToView?: (view: 'characterdesign' | 'casting') => void }> = ({ onNavigateToView }) => {
  const { characterData, setCharacterData, beats, appTheme, storyboardConfig, stabilityApiKey, characterDesignLocked, setCharacterDesignLocked } = useProject();
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const isLocked = !!characterDesignLocked;

  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [generatingPortrait, setGeneratingPortrait] = useState(false);

  const roleNames = useMemo(() => {
    const keysSet = new Set<string>(Object.keys(characterData));
    beats.forEach(beat => {
      if (!beat.content) return;
      const temp = document.createElement('div');
      temp.innerHTML = beat.content;
      const charElements = temp.querySelectorAll('.sc-line-character');
      charElements.forEach(charEl => {
        const rawName = (charEl.textContent || '')
          .replace(/\(V\.O\.\)|\(O\.S\.\)|\(CONT'D\)|\(OFF-SCREEN\)|\(VOICE\)/gi, '')
          .trim()
          .toUpperCase();
        if (rawName && rawName.length > 1) keysSet.add(rawName);
      });
    });
    return Array.from(keysSet).sort();
  }, [beats, characterData]);

  const characterMetrics = useMemo(() => {
    const metrics: Record<string, { sceneCount: number; dialogueWords: number }> = {};
    roleNames.forEach(name => { metrics[name] = { sceneCount: 0, dialogueWords: 0 }; });
    beats.forEach(beat => {
      if (!beat.content) return;
      const temp = document.createElement('div');
      temp.innerHTML = beat.content;
      const charElements = temp.querySelectorAll('.sc-line-character');
      charElements.forEach(charEl => {
        const rawName = (charEl.textContent || '')
          .replace(/\(V\.O\.\)|\(O\.S\.\)|\(CONT'D\)|\(OFF-SCREEN\)|\(VOICE\)/gi, '')
          .trim()
          .toUpperCase();
        if (!rawName) return;
        const matchedKey = roleNames.find(k => k.toUpperCase() === rawName || rawName.includes(k.toUpperCase()) || k.toUpperCase().includes(rawName));
        if (matchedKey && metrics[matchedKey]) {
          metrics[matchedKey].sceneCount += 1;
          let nextEl = charEl.nextElementSibling;
          while (nextEl && !nextEl.classList.contains('sc-line-character') && !nextEl.classList.contains('sc-line-slugline')) {
            if (nextEl.classList.contains('sc-line-dialogue')) {
              const text = (nextEl.textContent || '').trim();
              if (text) metrics[matchedKey].dialogueWords += text.split(/\s+/).length;
            }
            nextEl = nextEl.nextElementSibling;
          }
        }
      });
    });
    return metrics;
  }, [beats, roleNames]);

  const activeRoleName = selectedRole !== 'all' && roleNames.includes(selectedRole) ? selectedRole : (roleNames[0] || '');
  const char = activeRoleName ? characterData[activeRoleName] : undefined;
  const metrics = activeRoleName ? (characterMetrics[activeRoleName] || { sceneCount: 0, dialogueWords: 0 }) : { sceneCount: 0, dialogueWords: 0 };

  const avatarUrl = char?.images?.[0] || char?.aiImages?.[0];
  const traitRows: [string, string][] = [
    ['Age', String(char?.age ?? '')],
    ['Gender', char?.gender || ''],
    ['Ethnicity', char?.ethnicity || ''],
    ['Hair', char?.hair || ''],
    ['Eyes', char?.eyes || ''],
    ['Build', char?.build || ''],
  ];
  const overviewChips = [char?.archetype, char?.occupation, char?.height, char?.accent].filter(Boolean) as string[];
  const overviewSummary = [char?.archetype, char?.physiology?.slice(0, 160)].filter(Boolean).join('. ') || '';

  const activeRoleIndex = roleNames.indexOf(activeRoleName);
  const goToPreviousCharacter = () => {
    if (roleNames.length === 0) return;
    const prev = roleNames[(activeRoleIndex - 1 + roleNames.length) % roleNames.length];
    if (prev) setSelectedRole(prev);
  };
  const goToNextCharacter = () => {
    if (roleNames.length === 0) return;
    const next = roleNames[(activeRoleIndex + 1) % roleNames.length];
    if (next) setSelectedRole(next);
  };

  const updateCharacter = (charName: string, updates: Partial<CharacterData>) => {
    setCharacterData(prev => ({
      ...prev,
      [charName]: { ...(prev[charName] || { id: charName, name: charName } as CharacterData), ...updates }
    }));
  };

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder?: string, mono = false) => (
    <div>
      <label className="text-[8.5px] font-mono uppercase text-slate-500 font-bold">{label}</label>
      <input
        type="text"
        value={value || ''}
        placeholder={placeholder}
        disabled={isLocked}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full p-2 border text-xs outline-none ${mono ? 'font-mono' : ''} ${
          isLight ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-[#181a22] border-slate-700 text-white placeholder-slate-600'
        } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
    </div>
  );

  const textArea = (label: string, value: string, onChange: (v: string) => void, rows: number, placeholder?: string) => (
    <div>
      <label className="text-[8.5px] font-mono uppercase text-slate-500 font-bold">{label}</label>
      <textarea
        rows={rows}
        value={value || ''}
        placeholder={placeholder}
        disabled={isLocked}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full p-2.5 border text-xs outline-none resize-none ${
          isLight ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-[#181a22] border-slate-700 text-white placeholder-slate-600'
        } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
    </div>
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: FileList | null = e.target.files;
    if (!files || !activeRoleName) return;
    const fileList: FileList = files;
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && activeRoleName) {
          updateCharacter(activeRoleName, { images: [...(characterData[activeRoleName]?.images || []), reader.result] });
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (url: string) => {
    if (!activeRoleName) return;
    updateCharacter(activeRoleName, { images: (characterData[activeRoleName]?.images || []).filter(x => x !== url) });
  };

  const removeAiImage = (url: string) => {
    if (!activeRoleName) return;
    updateCharacter(activeRoleName, { aiImages: (characterData[activeRoleName]?.aiImages || []).filter(x => x !== url) });
  };

  const buildPortraitPrompt = (c: CharacterData) => {
    const appearance = [c.hair, c.eyes, c.build].filter(Boolean).join(', ');
    return [
      'Studio character portrait, head-and-shoulders, cinematic film lighting, character design reference sheet style.',
      c.name ? `Character name: ${c.name}.` : '',
      c.age ? `Age: ${c.age}.` : '',
      c.gender ? `Gender: ${c.gender}.` : '',
      c.ethnicity ? `Ethnicity: ${c.ethnicity}.` : '',
      appearance ? `Appearance: ${appearance}.` : '',
      c.physiology ? `Physical details: ${c.physiology}.` : '',
      c.occupation ? `Occupation: ${c.occupation}.` : '',
      c.archetype ? `Persona: ${c.archetype}.` : '',
      c.wardrobeNotes ? `Costume: ${c.wardrobeNotes}.` : '',
      'No text, no watermark, photorealistic.'
    ].filter(Boolean).join(' ');
  };

  const handleGeneratePortrait = async () => {
    if (!activeRoleName) return;
    const target = characterData[activeRoleName];
    if (!target) return;
    setGeneratingPortrait(true);
    try {
      const prompt = buildPortraitPrompt(target);
      const url = await generateImage({
        prompt,
        aspectRatio: '4:3',
        model: storyboardConfig.imageModel || 'gemini-2.5-flash-image',
        provider: storyboardConfig.provider,
        stabilityApiKey
      });
      if (url) {
        updateCharacter(activeRoleName, { aiImages: [...(target.aiImages || []), url] });
      } else {
        alert('No image returned. Check your API configuration in Backstage settings.');
      }
    } catch (e: any) {
      console.error('Character portrait generation failed', e);
      alert(`Portrait generation failed:\n${e.message || 'Unknown error'}`);
    } finally {
      setGeneratingPortrait(false);
    }
  };

  const backstoryRef = useRef<HTMLDivElement>(null);
  const savedBackstoryRange = useRef<Range | null>(null);

  useEffect(() => {
    const el = backstoryRef.current;
    if (el && el.innerHTML !== (char?.backstory || '')) {
      el.innerHTML = char?.backstory || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoleName, char?.backstory]);

  const saveBackstorySelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && backstoryRef.current && backstoryRef.current.contains(sel.anchorNode)) {
      savedBackstoryRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const syncBackstoryFromDom = () => {
    if (backstoryRef.current && activeRoleName) {
      updateCharacter(activeRoleName, { backstory: backstoryRef.current.innerHTML });
    }
  };

  const applyBackstoryStyle = (command: string, value?: string) => {
    const el = backstoryRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedBackstoryRange.current) {
      sel?.removeAllRanges();
      sel?.addRange(savedBackstoryRange.current);
    }
    document.execCommand(command, false, value);
    syncBackstoryFromDom();
  };

  const addRelationship = () => {
    if (!activeRoleName) return;
    const current = characterData[activeRoleName]?.relationships || [];
    updateCharacter(activeRoleName, { relationships: [...current, { target: '', type: 'Family', description: '' }] });
  };

  const removeRelationship = (idx: number) => {
    if (!activeRoleName) return;
    updateCharacter(activeRoleName, { relationships: (characterData[activeRoleName]?.relationships || []).filter((_, i) => i !== idx) });
  };

  const confirmedArtist = char?.artists?.find(a => a.id === char.confirmedArtistId || a.status === 'on_board' || a.status === 'contract_signed');

  const panelCls = `border ${isLight ? 'bg-white border-slate-300' : 'bg-[#13151b] border-slate-800'}`;
  const panelTitle = (icon: React.ReactNode, text: string, accent = 'text-amber-500') => (
    <div className={`text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 ${accent}`}>
      {icon}
      <span>{text}</span>
    </div>
  );

  return (
    <div className={`w-full h-full flex flex-col font-sans overflow-hidden text-xs ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-[#0b0c10] text-slate-200'}`}>
      {/* ============================================================
          CHARACTER DESIGN WORKSPACE HEADER (Writer's Page)
      ============================================================ */}
      <header className={`px-5 py-3 border-b flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0 ${isLight ? 'bg-white border-slate-300' : 'bg-[#13151b] border-slate-800'}`}>
        <div className="flex items-center gap-3">
          {onNavigateToView && (
            <DualViewToggle activeView="characterdesign" isLight={isLight} onToggle={onNavigateToView} />
          )}

          <div className="p-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 shrink-0">
            <PenLine size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500">
                CHARACTER DESIGN WORKSPACE
              </span>
              <span className={`text-[10px] font-mono border px-1.5 py-0.2 ${isLight ? 'bg-slate-50 text-slate-600 border-slate-300' : 'bg-[#181a22] text-slate-400 border-slate-700'}`}>
                FOR THE WRITER
              </span>
            </div>
            <h1 className={`text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              CHARACTER BIBLES, PROFILES & RELATIONSHIPS
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] overflow-x-auto py-1">
          <div className={`px-3 py-1.5 border flex items-center gap-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1d26] border-slate-800'}`}>
            <span className="text-slate-500 uppercase text-[9.5px]">CHARACTERS:</span>
            <span className="font-bold text-amber-500">{roleNames.length}</span>
          </div>
          {activeRoleName && (
            <>
              <div className={`px-3 py-1.5 border flex items-center gap-2 ${isLight ? 'bg-sky-50 border-sky-200' : 'bg-sky-950/30 border-sky-900/40'}`}>
                <Film size={11} className="text-sky-500" />
                <span className="text-sky-500 uppercase text-[9.5px]">SCENES:</span>
                <span className="font-bold text-sky-400">{metrics.sceneCount}</span>
              </div>
              <div className={`px-3 py-1.5 border flex items-center gap-2 ${isLight ? 'bg-purple-50 border-purple-200' : 'bg-purple-950/30 border-purple-900/40'}`}>
                <FileText size={11} className="text-purple-500" />
                <span className="text-purple-500 uppercase text-[9.5px]">DIALOGUE WORDS:</span>
                <span className="font-bold text-purple-400">{metrics.dialogueWords}</span>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setCharacterDesignLocked(!isLocked)}
            className={`px-3 py-1.5 border flex items-center gap-2 font-bold uppercase text-[9.5px] tracking-wider transition-colors shrink-0 ${
              isLocked
                ? 'bg-rose-600 border-rose-600 text-white hover:bg-rose-500'
                : isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-600 hover:border-rose-400 hover:text-rose-600'
                  : 'bg-[#1a1d26] border-slate-800 text-slate-400 hover:border-rose-500 hover:text-rose-400'
            }`}
            title={isLocked ? 'Unlock the Character Design page for editing' : 'Lock the Character Design page — no other crew member can edit'}
          >
            {isLocked ? <Lock size={11} /> : <LockOpen size={11} />}
            {isLocked ? 'Locked' : 'Lock'}
          </button>
        </div>
      </header>

      {isLocked && (
        <div className="px-5 py-1.5 bg-rose-600/10 border-b border-rose-600/30 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-rose-500 shrink-0">
          <Lock size={11} />
          <span>
            Page locked by the writer — read-only for crew. Press the <b>Locked</b> button above to unlock and edit.
          </span>
        </div>
      )}

      {/* ============================================================
          CHARACTER ROSTER STRIP
      ============================================================ */}
      <div className={`px-5 py-3 border-b flex flex-col gap-2 shrink-0 ${isLight ? 'bg-slate-200/70 border-slate-300' : 'bg-[#151722] border-slate-800'}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-amber-500" />
            <h2 className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
              SCRIPT & BREAKDOWN CHARACTER ROSTER ({roleNames.length})
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">Pick a character to open its full design bible:</span>
          </div>

          {/* Character selector dropdown + step buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={activeRoleName}
              onChange={(e) => setSelectedRole(e.target.value)}
              className={`px-2 py-1.5 border text-[11px] font-mono outline-none cursor-pointer ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181a22] border-slate-700 text-white'}`}
              title="Select character"
            >
              {roleNames.map(charName => (
                <option key={charName} value={charName}>{charName}</option>
              ))}
            </select>
            <div className="flex items-center border rounded-sm overflow-hidden">
              <button
                type="button"
                onClick={goToPreviousCharacter}
                disabled={roleNames.length === 0}
                className={`px-2 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-40 ${isLight ? 'bg-white hover:bg-slate-100 text-slate-700' : 'bg-[#181a22] hover:bg-[#22262f] text-slate-300'}`}
                title="Previous character"
              >
                <ChevronLeft size={13} />
              </button>
              <span className={`px-2 py-1.5 text-[10px] font-mono border-x ${isLight ? 'bg-slate-50 text-slate-600 border-slate-300' : 'bg-[#12141a] text-slate-400 border-slate-700'}`}>
                {roleNames.length > 0 ? `${activeRoleIndex + 1}/${roleNames.length}` : '0/0'}
              </span>
              <button
                type="button"
                onClick={goToNextCharacter}
                disabled={roleNames.length === 0}
                className={`px-2 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-40 ${isLight ? 'bg-white hover:bg-slate-100 text-slate-700' : 'bg-[#181a22] hover:bg-[#22262f] text-slate-300'}`}
                title="Next character"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto custom-scrollbar py-1">
          {roleNames.map(charName => {
            const c = characterData[charName];
            const m = characterMetrics[charName] || { sceneCount: 0, dialogueWords: 0 };
            const isSelected = selectedRole === charName;
            const tier = BILLING_TIERS.find(t => t.id === c?.billingTier);
            return (
              <div
                key={charName}
                onClick={() => setSelectedRole(charName)}
                className={`px-3 py-2 border cursor-pointer shrink-0 flex flex-col justify-between transition-all min-w-[150px] max-w-[190px] ${
                  isSelected
                    ? (isLight ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-amber-400' : 'bg-[#262a38] text-white border-amber-500 ring-2 ring-amber-500/50')
                    : (isLight ? 'bg-white border-slate-300 hover:bg-slate-50 text-slate-900' : 'bg-[#181a24] border-slate-700/80 hover:bg-[#1e212f] text-slate-200')
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-mono font-bold text-xs uppercase truncate text-amber-400">{charName}</span>
                  <span className={`text-[9px] font-mono px-1 py-0.2 border uppercase shrink-0 ${
                    tier?.[isLight ? 'badgeLight' : 'badge'] || 'bg-slate-800 text-slate-300'
                  }`}>
                    {tier?.label || 'Supporting Role'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9.5px] font-mono opacity-80 mt-1">
                  <span>{m.sceneCount} Scenes</span>
                  <span>•</span>
                  <span>{m.dialogueWords} Words</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================
          FULL DOSSIER / CHARACTER BIBLE EDITOR
          Two columns: left = full editor, right = overview + gallery
      ============================================================ */}
      {activeRoleName && char ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          <div className="flex items-start gap-4 max-w-[1500px] mx-auto">
            {/* LEFT: FULL DOSSIER EDITOR */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Row: Portrait & Identity */}
              <div className={`${panelCls} p-4 space-y-3`}>
                {panelTitle(<Brain size={13} />, `Character Bible — ${activeRoleName}`, 'text-amber-500')}

                {/* Casting status */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[9px] font-mono px-1.5 py-0.2 border uppercase ${isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-[#181a22] border-slate-700 text-slate-400'}`}>
                    {(char.artists?.length || 0)} TALENT CHOICES
                  </span>
                  {confirmedArtist ? (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 border uppercase bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold">
                      ✓ CAST: {confirmedArtist.name}
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 border uppercase bg-amber-500/15 border-amber-500/40 text-amber-400 font-bold">
                      UNCAST — OPEN FOR DIRECTOR
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {field('Playing Age', char.playingAge || '', (v) => updateCharacter(activeRoleName, { playingAge: v }), 'e.g. 28-32', true)}
                  {field('Age (Range)', String(char.age ?? ''), (v) => updateCharacter(activeRoleName, { age: parseInt(v) || 0 }), 'e.g. 30', true)}
                  {field('Gender', char.gender || '', (v) => updateCharacter(activeRoleName, { gender: v }))}
                  {field('Ethnicity', char.ethnicity || '', (v) => updateCharacter(activeRoleName, { ethnicity: v }))}
                  {field('Hair', char.hair || '', (v) => updateCharacter(activeRoleName, { hair: v }))}
                  {field('Eyes', char.eyes || '', (v) => updateCharacter(activeRoleName, { eyes: v }))}
                  {field('Build', char.build || '', (v) => updateCharacter(activeRoleName, { build: v }))}
                  {field('Height', char.height || '', (v) => updateCharacter(activeRoleName, { height: v }))}
                  {field('Accent', char.accent || '', (v) => updateCharacter(activeRoleName, { accent: v }))}
                  {field('Occupation', char.occupation || '', (v) => updateCharacter(activeRoleName, { occupation: v }))}
                  {field('Archetype', char.archetype || '', (v) => updateCharacter(activeRoleName, { archetype: v }))}
                  {field('Aliases (comma)', (char.aliases || []).join(', '), (v) => updateCharacter(activeRoleName, { aliases: v.split(',').map(s => s.trim()).filter(Boolean) }))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[8.5px] font-mono uppercase text-slate-500 font-bold">Billing Tier</label>
                    <select
                      value={char.billingTier || 'supporting'}
                      disabled={isLocked}
                      onChange={(e) => updateCharacter(activeRoleName, { billingTier: e.target.value as CharacterData['billingTier'] })}
                      className={`w-full p-2 border text-xs font-mono outline-none cursor-pointer ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#181a22] border-slate-700'} ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {BILLING_TIERS.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  {field('Billing Number', char.billingNumber !== undefined ? String(char.billingNumber) : '', (v) => updateCharacter(activeRoleName, { billingNumber: parseInt(v) || undefined }), 'e.g. 1', true)}
                  {field('Special Skills', char.specialSkills || '', (v) => updateCharacter(activeRoleName, { specialSkills: v }), 'e.g. Horse riding, Tamil & Telugu')}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {textArea('Physiology', char.physiology || '', (v) => updateCharacter(activeRoleName, { physiology: v }), 3, 'Physical traits, mannerisms, health...')}
                  {textArea('Sociology', char.sociology || '', (v) => updateCharacter(activeRoleName, { sociology: v }), 3, 'Family, class, environment, culture...')}
                  {textArea('Psychology', char.psychology || '', (v) => updateCharacter(activeRoleName, { psychology: v }), 3, 'Drives, fears, contradictions, arc...')}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[8.5px] font-mono uppercase text-slate-500 font-bold">Character Backstory</label>
                    <span className={`text-[8px] font-mono uppercase ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
                      Rich text · drag corner to resize
                    </span>
                  </div>

                  {/* Text style toolbar */}
                  <div className={`flex flex-wrap items-center gap-1 p-1.5 border border-b-0 ${isLocked ? 'opacity-50' : ''} ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#181a22] border-slate-700'}`}>
                    {BACKSTORY_STYLE_BUTTONS.map(btn => {
                      const BtnIcon = btn.icon;
                      return (
                        <button
                          key={btn.command}
                          type="button"
                          title={btn.title}
                          disabled={isLocked}
                          onMouseDown={(e) => { e.preventDefault(); saveBackstorySelection(); applyBackstoryStyle(btn.command); }}
                          className={`p-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isLight ? 'text-slate-600 hover:bg-slate-200 hover:text-slate-900' : 'text-slate-400 hover:bg-[#262a38] hover:text-white'}`}
                        >
                          <BtnIcon size={13} />
                        </button>
                      );
                    })}
                    <span className={`w-px h-4 mx-0.5 ${isLight ? 'bg-slate-300' : 'bg-slate-700'}`} />
                    <button
                      type="button"
                      title="Clear formatting"
                      disabled={isLocked}
                      onMouseDown={(e) => { e.preventDefault(); saveBackstorySelection(); applyBackstoryStyle('removeFormat'); }}
                      className={`p-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isLight ? 'text-slate-600 hover:bg-slate-200 hover:text-slate-900' : 'text-slate-400 hover:bg-[#262a38] hover:text-white'}`}
                    >
                      <Eraser size={13} />
                    </button>
                    <span className={`w-px h-4 mx-0.5 ${isLight ? 'bg-slate-300' : 'bg-slate-700'}`} />
                    <select
                      title="Font family"
                      disabled={isLocked}
                      onMouseDown={saveBackstorySelection}
                      onChange={(e) => { if (e.target.value) { applyBackstoryStyle('fontName', e.target.value); } e.target.value = ''; }}
                      className={`px-1.5 py-1 border text-[10px] font-mono outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-[#12141a] border-slate-700 text-slate-300'}`}
                    >
                      <option value="">Font</option>
                      <option value="Georgia">Serif</option>
                      <option value="Trebuchet MS">Sans</option>
                      <option value="Courier New">Mono</option>
                    </select>
                    <select
                      title="Font size"
                      disabled={isLocked}
                      onMouseDown={saveBackstorySelection}
                      onChange={(e) => { if (e.target.value) { applyBackstoryStyle('fontSize', e.target.value); } e.target.value = ''; }}
                      className={`px-1.5 py-1 border text-[10px] font-mono outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-[#12141a] border-slate-700 text-slate-300'}`}
                    >
                      <option value="">Size</option>
                      {BACKSTORY_FONT_SIZES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Resizable rich text editor */}
                  <div
                    ref={backstoryRef}
                    contentEditable={!isLocked}
                    suppressContentEditableWarning
                    onInput={syncBackstoryFromDom}
                    onKeyUp={saveBackstorySelection}
                    onMouseUp={saveBackstorySelection}
                    className={`min-h-[150px] resize-y overflow-auto p-2.5 border text-xs leading-relaxed outline-none focus:border-amber-500/60 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#181a22] border-slate-700 text-white'
                    } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>

                <div className="pt-1">
                  <label className="text-[8.5px] font-mono uppercase text-slate-500 font-bold">Wardrobe Notes</label>
                  <textarea
                    rows={2}
                    value={char.wardrobeNotes || ''}
                    disabled={isLocked}
                    onChange={(e) => updateCharacter(activeRoleName, { wardrobeNotes: e.target.value })}
                    className={`w-full p-2.5 border text-xs outline-none resize-none ${isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#181a22] border-slate-700 text-white'} ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>

              {/* Relationships */}
              <div className={`${panelCls} p-4 space-y-3`}>
                {panelTitle(<Link2 size={13} />, 'Relationships & Dynamics')}
                {(char.relationships || []).map((rel, idx) => (
                  <div key={idx} className={`grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-center border p-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181a22] border-slate-700'}`}>
                    <input
                      type="text"
                      placeholder="Other character name..."
                      value={rel.target}
                      disabled={isLocked}
                      onChange={(e) => updateCharacter(activeRoleName, { relationships: (char.relationships || []).map((r, i) => i === idx ? { ...r, target: e.target.value } : r) })}
                      className={`p-1.5 border text-xs outline-none disabled:opacity-60 ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    />
                    <input
                      type="text"
                      placeholder="Type (e.g. Mother, Rival)"
                      value={rel.type}
                      disabled={isLocked}
                      onChange={(e) => updateCharacter(activeRoleName, { relationships: (char.relationships || []).map((r, i) => i === idx ? { ...r, type: e.target.value } : r) })}
                      className={`p-1.5 border text-xs outline-none disabled:opacity-60 ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    />
                    <input
                      type="text"
                      placeholder="Dynamic / history between them..."
                      value={rel.description}
                      disabled={isLocked}
                      onChange={(e) => updateCharacter(activeRoleName, { relationships: (char.relationships || []).map((r, i) => i === idx ? { ...r, description: e.target.value } : r) })}
                      className={`p-1.5 border text-xs outline-none disabled:opacity-60 ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeRelationship(idx)}
                      disabled={isLocked}
                      className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {!char.relationships?.length && (
                  <div className="text-center py-4 border border-dashed border-slate-700 text-slate-500 text-[10px] font-mono uppercase">
                    No relationships mapped yet
                  </div>
                )}
                <button
                  type="button"
                  onClick={addRelationship}
                  disabled={isLocked}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors self-start disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={13} />
                  Add Relationship
                </button>
              </div>
            </div>

            {/* RIGHT SIDEBAR: ONE CARD OVERVIEW + IMAGE GALLERY */}
            <aside className="w-[370px] shrink-0 space-y-4 sticky top-0">
              {/* ONE CARD OVERVIEW of selected character */}
              <div className={`${panelCls} overflow-hidden`}>
                <div className="h-1.5 bg-amber-500" />
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">CHARACTER OVERVIEW</div>
                      <h3 className="font-mono font-bold text-lg uppercase tracking-tight text-amber-500 truncate">{activeRoleName}</h3>
                    </div>
                    {(() => {
                      const tier = BILLING_TIERS.find(t => t.id === char.billingTier);
                      return (
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 border uppercase shrink-0 ${
                          tier?.[isLight ? 'badgeLight' : 'badge'] || 'bg-slate-800 text-slate-300'
                        }`}>
                          {tier?.label || 'Supporting Role'}
                        </span>
                      );
                    })()}
                  </div>

                  {confirmedArtist ? (
                    <span className="text-[9.5px] font-mono px-1.5 py-0.2 border uppercase bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold inline-block">
                      ✓ CAST: {confirmedArtist.name}
                    </span>
                  ) : (
                    <span className="text-[9.5px] font-mono px-1.5 py-0.2 border uppercase bg-amber-500/15 border-amber-500/40 text-amber-400 font-bold inline-block">
                      UNCAST — OPEN FOR DIRECTOR
                    </span>
                  )}

                  <div className="flex gap-4">
                    <div className="w-28 h-28 shrink-0 border border-slate-700 overflow-hidden bg-slate-900 flex items-center justify-center">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={36} className="text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-[11px] font-mono space-y-1">
                      {traitRows.map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-2">
                          <span className="text-slate-500 uppercase">{label}</span>
                          <span className="text-slate-200 truncate">{value || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {overviewChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {overviewChips.map((chip, idx) => (
                        <span key={idx} className={`px-2 py-0.5 border text-[9px] font-mono uppercase ${isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-[#181a22] border-slate-700 text-slate-400'}`}>
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className={`border p-2 ${isLight ? 'bg-sky-50 border-sky-200' : 'bg-sky-950/30 border-sky-900/40'}`}>
                      <div className="text-lg font-bold text-sky-500">{metrics.sceneCount}</div>
                      <div className="text-[8.5px] font-mono uppercase text-sky-500">Scenes</div>
                    </div>
                    <div className={`border p-2 ${isLight ? 'bg-purple-50 border-purple-200' : 'bg-purple-950/30 border-purple-900/40'}`}>
                      <div className="text-lg font-bold text-purple-500">{metrics.dialogueWords}</div>
                      <div className="text-[8.5px] font-mono uppercase text-purple-500">Words</div>
                    </div>
                    <div className={`border p-2 ${isLight ? 'bg-amber-50 border-amber-200' : 'bg-amber-950/30 border-amber-900/40'}`}>
                      <div className="text-lg font-bold text-amber-500">{(char.relationships || []).length}</div>
                      <div className="text-[8.5px] font-mono uppercase text-amber-500">Rel.</div>
                    </div>
                  </div>

                  {overviewSummary && (
                    <p className={`text-[11px] leading-relaxed border-t pt-2.5 mt-1 ${isLight ? 'text-slate-500 border-slate-200' : 'text-slate-400 border-slate-800'}`}>
                      {overviewSummary}
                    </p>
                  )}
                </div>
              </div>

              {/* IMAGE GALLERY: AI GENERATED & ATTACHED */}
              <div className={`${panelCls} p-4 space-y-4`}>
                {panelTitle(<Sparkles size={13} />, 'AI Generated Portraits', 'text-violet-500')}
                <div className="grid grid-cols-3 gap-2">
                  {(char.aiImages || []).map((img, idx) => (
                    <div key={idx} className="relative aspect-[4/3] border border-slate-700 bg-slate-900 overflow-hidden group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeAiImage(img)}
                        disabled={isLocked}
                        className="absolute top-1 right-1 p-1 bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleGeneratePortrait}
                    disabled={generatingPortrait || isLocked}
                    className="aspect-[4/3] border border-dashed border-violet-600/60 text-violet-500 hover:text-violet-400 hover:border-violet-500 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {generatingPortrait ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    <span className="text-[7.5px] font-mono uppercase">{generatingPortrait ? 'Generating' : 'Generate'}</span>
                  </button>
                </div>

                {panelTitle(<ImageIcon size={13} />, 'Attached Images', 'text-sky-500')}
                <div className="grid grid-cols-3 gap-2">
                  {(char.images || []).map((img, idx) => (
                    <div key={idx} className="relative aspect-[4/3] border border-slate-700 bg-slate-900 overflow-hidden group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(img)}
                        disabled={isLocked}
                        className="absolute top-1 right-1 p-1 bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                  <label className={`aspect-[4/3] border border-dashed border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-500 cursor-pointer hover:border-amber-500 hover:text-amber-500 transition-colors ${isLocked ? 'pointer-events-none opacity-50 cursor-not-allowed' : ''}`}>
                    <Plus size={16} />
                    <span className="text-[7.5px] font-mono uppercase">Add</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className={`p-8 border border-dashed text-center font-mono text-xs ${isLight ? 'border-slate-400 text-slate-500' : 'border-slate-800 text-slate-500'}`}>
            NO CHARACTERS DETECTED IN SCRIPT YET.<br />
            Write character cue lines in the screenplay to auto-create design bibles here.
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterDesignView;
