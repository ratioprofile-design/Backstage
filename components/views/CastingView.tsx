import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../../context/ProjectContext';
import { CharacterData, ArtistOption } from '../../types';
import { generateImage, identifyActorFromImage } from '../../services/gemini';
import { 
  UserCheck, Users, Search, Sliders, FileText, Plus, CheckCircle2, 
  Trash2, Upload, ExternalLink, Star, ArrowUp, ArrowDown, Check, X,
  IndianRupee, Clock, Calendar, ShieldCheck, Film, Layers, Award, Sparkles, Filter,
  Edit3, UserPlus, Phone, Mail, Building2, Link2, Eye, Play, ChevronRight, CheckSquare,
  AlertCircle, Brain, Fingerprint, RefreshCw, Wand2, Heart, User, Image as ImageIcon, GripVertical,
  ChevronLeft, LayoutGrid, ListFilter, ArrowLeftRight, Folder, TrendingUp, DollarSign, Activity, BarChart2, MoreVertical, Printer, Settings, RotateCcw,
  Bold, Italic, Underline, Strikethrough, Eraser
} from 'lucide-react';
import DualViewToggle from '../DualViewToggle';

const BILLING_TIERS = [
  { id: 'lead', label: 'Lead Role', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40', badgeLight: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'supporting', label: 'Supporting Role', badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40', badgeLight: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { id: 'day_player', label: 'Day Player', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/40', badgeLight: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'voiceover', label: 'Voice Over', badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40', badgeLight: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { id: 'stunt', label: 'Stunt / Action', badge: 'bg-rose-500/20 text-rose-400 border-rose-500/40', badgeLight: 'bg-rose-100 text-rose-800 border-rose-300' },
  { id: 'extra', label: 'Featured Extra', badge: 'bg-slate-500/20 text-slate-400 border-slate-500/40', badgeLight: 'bg-slate-200 text-slate-800 border-slate-300' },
] as const;

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

const PIPELINE_STAGES = [
  { id: 'idea', label: 'Wishlist / Idea', color: '#64748b', badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  { id: 'in_talks', label: 'In Discussions', color: '#f59e0b', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { id: 'audition_requested', label: 'Audition Requested', color: '#3b82f6', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { id: 'self_tape_received', label: 'Self-Tape Received', color: '#a855f7', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { id: 'callback', label: 'Callback Invited', color: '#6366f1', badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  { id: 'chemistry_read', label: 'Chemistry Read', color: '#d946ef', badge: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30' },
  { id: 'offer_sent', label: 'Formal Offer Out', color: '#eab308', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { id: 'hold', label: 'On Hold', color: '#94a3b8', badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  { id: 'contract_signed', label: 'Contract Signed', color: '#10b981', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold' },
  { id: 'on_board', label: 'Cast Confirmed', color: '#059669', badge: 'bg-emerald-500 text-black border-emerald-400 font-bold' },
  { id: 'passed', label: 'Passed / Declined', color: '#f43f5e', badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
] as const;

const FEE_TYPES = [
  { id: 'weekly', label: 'Per Week (₹/Wk)' },
  { id: 'daily', label: 'Per Day (₹/Day)' },
  { id: 'flat', label: 'Flat Guarantee (₹)' },
  { id: 'scale', label: 'Guild / Minimum Scale (₹)' },
] as const;

const SAG_TIERS = [
  'Guild / CINTAA Basic Agreement',
  'Tier 1 High Budget (₹2 Cr - ₹10 Cr+)',
  'Tier 2 Mid Budget (₹50 Lakhs - ₹2 Cr)',
  'Tier 3 Low Budget (< ₹50 Lakhs)',
  'Short Film / Independent Agreement',
  'OTT / Digital Series Contract',
  'Buyout / Non-Union Agreement',
] as const;

// Printable columns for the report tables
const ROLES_PRINT_COLUMNS = [
  { key: 'role', label: 'Role' },
  { key: 'tier', label: 'Billing Tier' },
  { key: 'scenes', label: 'Scenes' },
  { key: 'words', label: 'Dialogue Words' },
  { key: 'candidates', label: 'Candidates' },
  { key: 'confirmed', label: 'Confirmed Cast' },
] as const;

const PIPELINE_PRINT_COLUMNS = [
  { key: 'no', label: 'No.' },
  { key: 'photo', label: 'Photo' },
  { key: 'candidate', label: 'Candidate' },
  { key: 'role', label: 'Role' },
  { key: 'stage', label: 'Stage' },
  { key: 'agency', label: 'Agency' },
  { key: 'fee', label: 'Fee Quote' },
] as const;

type PrintColumnKeys = 'role' | 'tier' | 'scenes' | 'words' | 'candidates' | 'confirmed' | 'no' | 'photo' | 'candidate' | 'stage' | 'agency' | 'fee';

interface SegmentedOption<T extends string> { value: T; label: string; }

function SegmentedControl<T extends string>({ value, options, onChange, isLight }: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  isLight: boolean;
}) {
  return (
    <div className={`flex border p-0.5 ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#101217] border-slate-700'}`}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase transition-colors ${
            value === o.value
              ? (isLight ? 'bg-slate-900 text-white' : 'bg-amber-500 text-slate-950')
              : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const PrintCheckRow: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 py-1 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-amber-500" />
    <span>{label}</span>
  </label>
);

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div className="text-[9px] font-mono uppercase tracking-wider text-amber-500 font-bold mb-1.5">{title}</div>
    {children}
  </div>
);

export const CastingView: React.FC<{ onNavigateToView?: (view: 'characterdesign' | 'casting') => void }> = ({ onNavigateToView }) => {
  const { characterData, setCharacterData, beats, appTheme, projectList, currentProjectId, characterDesignLocked } = useProject();
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const isLocked = !!characterDesignLocked;

  // Default View: Pipeline (Hero operational view)
  const [activeViewMode, setActiveViewMode] = useState<'pipeline' | 'matrix' | 'comparison' | 'dossier'>('pipeline');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Kanban Board Column Width & Scroll Navigation Controls
  const [columnWidth, setColumnWidth] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [comparisonCardSize, setComparisonCardSize] = useState<'tiny' | 'xs' | 'sm'>('xs');
  const [isCardSettingsOpen, setIsCardSettingsOpen] = useState(false);
  const [isComparisonCardSettingsOpen, setIsComparisonCardSettingsOpen] = useState(false);
  const [isRosterVisible, setIsRosterVisible] = useState(true);
  const [cardDisplay, setCardDisplay] = useState({
    showSalary: true,
    showVideoLink: true,
    showCastingNotes: true,
  });
  const [isPrintSettingsOpen, setIsPrintSettingsOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState({
    titleText: 'Casting Pipeline & Progress Report',
    productionHouse: '',
    directorName: '',
    showTitle: true,
    includeRolesTable: true,
    includePipelineTable: true,
    includeEmptyRoles: true,
    showCountsInHeaders: true,
    pageSize: 'letter' as 'letter' | 'a4',
    orientation: 'landscape' as 'portrait' | 'landscape',
    fontSize: 'md' as 'sm' | 'md' | 'lg',
    photoSize: 'md' as 'sm' | 'md' | 'lg',
    margins: 'md' as 'sm' | 'md' | 'lg',
    colorMode: 'color' as 'color' | 'grayscale',
    tableBorders: true,
    headerStyle: 'gray' as 'none' | 'gray' | 'black' | 'white',
    zebraStripes: false,
    showPageNumbers: true,
    pipelineStatusFilter: 'all' as string,
    rolesColumns: {
      role: true, tier: true, scenes: true, words: true, candidates: true, confirmed: true
    },
    pipelineColumns: {
      no: true, photo: true, candidate: true, role: true, stage: true, agency: true, fee: true
    }
  });
  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const characterRosterRef = useRef<HTMLDivElement>(null);

  const scrollKanban = (direction: 'left' | 'right') => {
    if (kanbanScrollRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      kanbanScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollRoster = (direction: 'left' | 'right') => {
    if (characterRosterRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      characterRosterRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const getColumnWidthClass = () => {
    switch (columnWidth) {
      case 'sm': return 'w-52';
      case 'lg': return 'w-80';
      case 'xl': return 'w-96';
      default: return 'w-64';
    }
  };

  // Candidate Modal State
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [editingArtistData, setEditingArtistData] = useState<{
    charName: string;
    targetRole?: string;
    artist: ArtistOption;
    isNew: boolean;
  } | null>(null);

  // Card Context Action Menu Popover State
  const [activeCardMenuId, setActiveCardMenuId] = useState<string | null>(null);

  // New Role Creation State
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRoleInputName, setNewRoleInputName] = useState('');

  // Drag and drop state
  const [draggedOverStage, setDraggedOverStage] = useState<string | null>(null);
  const [draggingArtistInfo, setDraggingArtistInfo] = useState<{ charName: string; artistId: string } | null>(null);
  const [newWebPhotoUrl, setNewWebPhotoUrl] = useState('');
  const [isDraggingOverDropzone, setIsDraggingOverDropzone] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState('');

  const [imageSearchResults, setImageSearchResults] = useState<string[]>([]);
  const [selectedSearchImages, setSelectedSearchImages] = useState<string[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [isGoogleImageModalOpen, setIsGoogleImageModalOpen] = useState(false);




  // ALL SCRIPT & BREAKDOWN DETECTED CHARACTERS (Auto-Sync from beats & characterData)
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
        if (rawName && rawName.length > 1) {
          keysSet.add(rawName);
        }
      });
    });

    return Array.from(keysSet).sort();
  }, [beats, characterData]);

  const activeRoleName = selectedRole !== 'all' && roleNames.includes(selectedRole) ? selectedRole : (roleNames[0] || '');

  // Script metrics computation
  const characterMetrics = useMemo(() => {
    const metrics: Record<string, { sceneCount: number; dialogueWords: number }> = {};
    roleNames.forEach(name => {
      metrics[name] = { sceneCount: 0, dialogueWords: 0 };
    });

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
              if (text) {
                metrics[matchedKey].dialogueWords += text.split(/\s+/).length;
              }
            }
            nextEl = nextEl.nextElementSibling;
          }
        }
      });
    });

    return metrics;
  }, [beats, roleNames]);

  // Data Dashboard Metrics Summary
  const stats = useMemo(() => {
    const totalRoles = roleNames.length;
    let confirmedCast = 0;
    let totalCandidates = 0;
    let offersOut = 0;
    let leadsCast = 0;
    let totalLeads = 0;

    roleNames.forEach(name => {
      const char = characterData[name];
      if (!char) return;
      const confirmedArtist = char.artists?.find(a => a.id === char.confirmedArtistId);
      const isCast = Boolean(
        (confirmedArtist && (confirmedArtist.status === 'on_board' || confirmedArtist.status === 'contract_signed')) ||
        char.artists?.some(a => a.status === 'on_board' || a.status === 'contract_signed')
      );
      if (isCast) confirmedCast += 1;
      if (char.billingTier === 'lead') {
        totalLeads += 1;
        if (isCast) leadsCast += 1;
      }
      totalCandidates += char.artists?.length || 0;
      if (char.artists?.some(a => a.status === 'offer_sent')) {
        offersOut += 1;
      }
    });

    const percentCast = totalRoles > 0 ? Math.round((confirmedCast / totalRoles) * 100) : 0;
    return { totalRoles, confirmedCast, totalCandidates, offersOut, percentCast, leadsCast, totalLeads };
  }, [roleNames, characterData]);

  // Flattened Candidate Data List for Pipeline
  const allCandidatesList = useMemo(() => {
    const list: Array<{ charName: string; roleTier: string; artist: ArtistOption }> = [];
    roleNames.forEach(charName => {
      const char = characterData[charName];
      if (!char || !char.artists) return;
      if (selectedRole !== 'all' && selectedRole !== charName) return;
      if (filterTier !== 'all' && char.billingTier !== filterTier) return;

      char.artists.forEach(artist => {
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchName = artist.name.toLowerCase().includes(q);
          const matchChar = charName.toLowerCase().includes(q);
          const matchAgency = (artist.contact?.agency || '').toLowerCase().includes(q);
          const matchNotes = (artist.notes || '').toLowerCase().includes(q);
          if (!matchName && !matchChar && !matchAgency && !matchNotes) return;
        }

        if (filterStatus !== 'all') {
          if (filterStatus === 'confirmed' && artist.status !== 'on_board' && artist.status !== 'contract_signed') return;
          if (filterStatus === 'in_progress' && (artist.status === 'on_board' || artist.status === 'contract_signed' || artist.status === 'passed')) return;
          if (filterStatus === 'passed' && artist.status !== 'passed') return;
        }

        list.push({
          charName,
          roleTier: char.billingTier || 'supporting',
          artist
        });
      });
    });
    return list;
  }, [roleNames, characterData, selectedRole, filterTier, filterStatus, searchTerm]);

  // Group candidates by stage
  const pipelineByStage = useMemo(() => {
    const map: Record<string, Array<{ charName: string; roleTier: string; artist: ArtistOption }>> = {};
    PIPELINE_STAGES.forEach(s => { map[s.id] = []; });
    allCandidatesList.forEach(item => {
      const stage = item.artist.status || 'idea';
      if (map[stage]) {
        map[stage].push(item);
      } else {
        map['idea'].push(item);
      }
    });
    return map;
  }, [allCandidatesList]);

  // Handlers
  const updateCharacter = (charName: string, updates: Partial<CharacterData>) => {
    setCharacterData(prev => ({
      ...prev,
      [charName]: {
        ...(prev[charName] || {
          name: charName,
          age: 30,
          gender: 'Unspecified',
          ethnicity: '',
          hair: '',
          eyes: '',
          build: '',
          occupation: '',
          archetype: '',
          physiology: '',
          sociology: '',
          psychology: '',
          backstory: '',
          images: [],
          relationships: [],
          artists: []
        }),
        ...updates
      }
    }));
  };

  // Rich-text backstory editor (mirrors the writer page; respects its lock)
  const backstoryRef = useRef<HTMLDivElement>(null);
  const savedBackstoryRange = useRef<Range | null>(null);

  useEffect(() => {
    const el = backstoryRef.current;
    const html = (activeRoleName && characterData[activeRoleName]?.backstory) || '';
    if (el && el.innerHTML !== html) {
      el.innerHTML = html;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoleName, characterData[activeRoleName]?.backstory, activeViewMode]);

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

  const handleAddNewRole = () => {
    const trimmed = newRoleInputName.trim().toUpperCase();
    if (!trimmed) return;
    updateCharacter(trimmed, {
      name: trimmed,
      billingTier: 'supporting',
      age: 30,
      gender: 'Unspecified',
      artists: []
    });
    setSelectedRole(trimmed);
    setNewRoleInputName('');
    setIsCreatingRole(false);
  };

  const handleDeleteRole = (charName: string) => {
    if (!confirm(`Delete character role "${charName}" and associated candidate records?`)) return;
    setCharacterData(prev => {
      const copy = { ...prev };
      delete copy[charName];
      return copy;
    });
    if (selectedRole === charName) setSelectedRole('all');
  };

  const handleOpenNewCandidateModal = (targetRole?: string) => {
    let roleToUse = targetRole || (selectedRole !== 'all' ? selectedRole : roleNames[0]);
    if (!roleToUse) {
      roleToUse = 'LEAD CHARACTER 1';
      updateCharacter(roleToUse, {
        name: roleToUse,
        billingTier: 'lead',
        age: 30,
        gender: 'Unspecified',
        artists: []
      });
    }

    const char = characterData[roleToUse];
    const existingCount = char?.artists?.length || 0;

    const newArtist: ArtistOption = {
      id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `Candidate ${existingCount + 1}`,
      rank: existingCount + 1,
      status: 'idea',
      rating: 4,
      dealTerms: { feeQuote: '', feeType: 'weekly', sagTier: 'Guild / CINTAA Basic Agreement' },
      contact: { agency: '', agentName: '', phone: '', email: '' },
      notes: ''
    };

    setEditingArtistData({
      charName: roleToUse,
      targetRole: roleToUse,
      artist: newArtist,
      isNew: true
    });
    setImageSearchQuery('');
    setImageSearchResults([]);
    setSelectedSearchImages([]);
    setIsCandidateModalOpen(true);
  };

  const handleOpenEditCandidateModal = (charName: string, artist: ArtistOption) => {
    const photos = artist.photos && artist.photos.length > 0
      ? artist.photos
      : (artist.photoUrl ? [artist.photoUrl] : []);
    const mainPhoto = artist.photoUrl || photos[0] || '';

    setEditingArtistData({
      charName,
      targetRole: charName,
      artist: {
        ...artist,
        photos,
        photoUrl: mainPhoto
      },
      isNew: false
    });
    setImageSearchQuery(artist.name.startsWith('Candidate') ? '' : artist.name);
    setImageSearchResults([]);
    setSelectedSearchImages([]);
    setIsCandidateModalOpen(true);
    setActiveCardMenuId(null);
  };

  const handleSaveCandidateModal = () => {
    if (!editingArtistData) return;
    const { charName, targetRole, artist, isNew } = editingArtistData;
    const destinationRole = targetRole || charName;

    const photos = artist.photos && artist.photos.length > 0
      ? artist.photos
      : (artist.photoUrl ? [artist.photoUrl] : []);
    const mainPhoto = artist.photoUrl || photos[0] || '';

    const normalizedArtist: ArtistOption = {
      ...artist,
      photos,
      photoUrl: mainPhoto
    };

    if (destinationRole !== charName && !isNew) {
      const oldChar = characterData[charName];
      if (oldChar?.artists) {
        const updatedOld = oldChar.artists.filter(a => a.id !== artist.id);
        updateCharacter(charName, { artists: updatedOld });
      }
      const newChar = characterData[destinationRole];
      const existingNew = newChar?.artists || [];
      updateCharacter(destinationRole, { artists: [...existingNew, normalizedArtist] });
    } else {
      const char = characterData[destinationRole];
      const existing = char?.artists || [];
      let updatedArtists: ArtistOption[];
      if (isNew) {
        updatedArtists = [...existing, normalizedArtist];
      } else {
        updatedArtists = existing.map(a => a.id === artist.id ? normalizedArtist : a);
      }
      updateCharacter(destinationRole, { artists: updatedArtists });
    }

    setIsCandidateModalOpen(false);
    setEditingArtistData(null);
  };

  const handleDeleteArtist = (charName: string, artistId: string) => {
    const char = characterData[charName];
    if (!char || !char.artists) return;
    const updated = char.artists.filter(art => art.id !== artistId);
    const reordered = updated.map((art, idx) => ({ ...art, rank: idx + 1 }));
    updateCharacter(charName, { 
      artists: reordered,
      confirmedArtistId: char.confirmedArtistId === artistId ? undefined : char.confirmedArtistId
    });
    setActiveCardMenuId(null);
  };

  const handleConfirmArtist = (charName: string, artistId: string) => {
    const char = characterData[charName];
    if (!char || !char.artists) return;
    const isAlreadyConfirmed = char.confirmedArtistId === artistId;
    const updatedArtists = char.artists.map(art => {
      if (art.id === artistId) {
        return { ...art, status: isAlreadyConfirmed ? 'idea' : 'on_board' as const };
      }
      return art;
    });

    updateCharacter(charName, {
      artists: updatedArtists,
      confirmedArtistId: isAlreadyConfirmed ? undefined : artistId
    });
    setActiveCardMenuId(null);
  };

  const handleMoveCandidateStage = (charName: string, artistId: string, newStage: ArtistOption['status']) => {
    const char = characterData[charName];
    if (!char || !char.artists) return;
    const updated = char.artists.map(art => art.id === artistId ? { ...art, status: newStage } : art);
    const isCastStage = newStage === 'on_board' || newStage === 'contract_signed';
    updateCharacter(charName, { 
      artists: updated,
      confirmedArtistId: isCastStage ? artistId : (char.confirmedArtistId === artistId ? undefined : char.confirmedArtistId)
    });
    setActiveCardMenuId(null);
  };

  const handleDragStart = (charName: string, artistId: string) => {
    setDraggingArtistInfo({ charName, artistId });
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDraggedOverStage(stageId);
  };

  const handleDropStage = (e: React.DragEvent, targetStage: ArtistOption['status']) => {
    e.preventDefault();
    setDraggedOverStage(null);
    if (draggingArtistInfo) {
      handleMoveCandidateStage(draggingArtistInfo.charName, draggingArtistInfo.artistId, targetStage);
      setDraggingArtistInfo(null);
    }
  };

  const handleSearchActorImages = async (queryToUse?: string) => {
    const rawQuery = (queryToUse || imageSearchQuery || '').trim();
    if (!rawQuery || isSearchingImages) return;

    // Strip generic casting words to get the clean actor name
    const cleanName = rawQuery.replace(/\b(candidate|lead|supporting|headshot|casting|role|\d+)\b/gi, '').trim() || rawQuery;
    // Append "actor" for better relevance on photo APIs
    const actorQuery = `${cleanName} actor`;

    setIsSearchingImages(true);
    setSelectedSearchImages([]);
    setImageSearchResults([]);

    const seenUrls = new Set<string>();

    // Progressive updater: push results to UI as each source finishes
    const flushResults = (newUrls: string[]) => {
      const fresh = newUrls.filter(u => u && typeof u === 'string' && u.length > 10 && !seenUrls.has(u));
      if (fresh.length === 0) return;
      fresh.forEach(u => seenUrls.add(u));
      setImageSearchResults(prev => [...prev, ...fresh]);
    };

    const fetchWithTimeout = async (url: string, timeoutMs = 4000) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    // --- Source 1: Wikipedia – search by actor name + fetch page images ---
    const taskWiki = async () => {
      try {
        // Step 1: find the most relevant Wikipedia pages for this actor
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(actorQuery)}&srlimit=10&format=json&origin=*`;
        const sRes = await fetchWithTimeout(searchUrl, 4000);
        if (!sRes.ok) return;
        const sData = await sRes.json();
        const pageIds: number[] = (sData.query?.search || []).map((r: any) => r.pageid).slice(0, 10);
        if (pageIds.length === 0) return;

        // Fast pass: grab lead/thumbnail images for immediate preview
        const thumbUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds.join('|')}&prop=pageimages&pithumbsize=1000&pilimit=10&format=json&origin=*`;
        const tRes = await fetchWithTimeout(thumbUrl, 4000);
        if (tRes.ok) {
          const tData = await tRes.json();
          const thumbUrls: string[] = [];
          Object.values(tData.query?.pages || {}).forEach((page: any) => {
            if (page.thumbnail?.source) thumbUrls.push(page.thumbnail.source.replace(/\/\d+px-/, '/600px-'));
          });
          flushResults(thumbUrls);
        }

        // Step 2: fetch all images for those pages (parallel per page)
        const fetchPageImages = async (pageId: number) => {
          const imagesUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=images&imlimit=50&format=json&origin=*`;
          const iRes = await fetchWithTimeout(imagesUrl, 4000);
          if (!iRes.ok) return;
          const iData = await iRes.json();
          const filenames: string[] = [];
          Object.values(iData.query?.pages || {}).forEach((page: any) => {
            (page.images || []).forEach((img: any) => {
              const title: string = img.title || '';
              if (/\.(jpg|jpeg|png|webp)/i.test(title) && !/logo|flag|map|signature|coat|seal|icon|svg/i.test(title)) {
                filenames.push(title);
              }
            });
          });

          if (filenames.length === 0) return;

          // Step 3: resolve filenames to actual URLs in parallel batches
          const batchSize = 25;
          const batches: string[][] = [];
          for (let i = 0; i < Math.min(filenames.length, 50); i += batchSize) {
            batches.push(filenames.slice(i, i + batchSize));
          }
          await Promise.all(batches.map(async (batch) => {
            const infoUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${batch.map(encodeURIComponent).join('|')}&prop=imageinfo&iiprop=url|mime&format=json&origin=*`;
            const rRes = await fetchWithTimeout(infoUrl, 4000);
            if (!rRes.ok) return;
            const rData = await rRes.json();
            const batchUrls: string[] = [];
            Object.values(rData.query?.pages || {}).forEach((page: any) => {
              const info = page.imageinfo?.[0];
              const url = info?.url;
              if (url && /\.(jpg|jpeg|png|webp)/i.test(url) && (info.mime || '').startsWith('image/')) batchUrls.push(url);
            });
            flushResults(batchUrls);
          }));
        };

        await Promise.all(pageIds.map(fetchPageImages));
      } catch (e) {}
    };

    // --- Source 2: Wikimedia Commons – dedicated media search for actor name ---
    const taskCommons = async () => {
      try {
        // Search with actor name directly
        const q = encodeURIComponent(cleanName);
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=60&prop=imageinfo&iiprop=url|mime&format=json&origin=*`;
        const res = await fetchWithTimeout(commonsUrl, 5000);
        if (!res.ok) return;
        const data = await res.json();
        const urls: string[] = [];
        Object.values(data.query?.pages || {}).forEach((page: any) => {
          const info = page.imageinfo?.[0];
          if (!info) return;
          const url: string = info.url || '';
          const mime: string = info.mime || '';
          // Only allow portrait-likely image formats, skip SVG/audio/video
          if (url && /\.(jpg|jpeg|png|webp)/i.test(url) && mime.startsWith('image/')) {
            urls.push(url);
          }
        });
        flushResults(urls);
      } catch (e) {}
    };

    // --- Source 3: OpenVerse – free/open image search (Wikimedia-backed) ---
    const taskOpenVerse = async () => {
      try {
        const q = encodeURIComponent(cleanName);
        const pages = [1, 2];
        await Promise.all(pages.map(async (page) => {
          const url = `https://api.openverse.org/v1/images/?q=${q}&license_type=commercial,modification&page_size=30&page=${page}&mature=false`;
          const res = await fetchWithTimeout(url, 6000);
          if (!res.ok) return;
          const data = await res.json();
          const urls: string[] = (data.results || []).map((item: any) => item.url).filter(Boolean);
          flushResults(urls);
        }));
      } catch (e) {}
    };

    // --- Source 4: Wikipedia search with broader "film" / "celebrity" context ---
    const taskWikiExtra = async () => {
      try {
        // Extra pass: search for "[Name] film actor" on Wikipedia to catch disambiguation pages (parallel)
        const variants = [`${cleanName} film`, `${cleanName} actress`, `${cleanName} biography`];
        await Promise.all(variants.map(async (variant) => {
          const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(variant)}&srlimit=3&format=json&origin=*`;
          const sRes = await fetchWithTimeout(searchUrl, 4000);
          if (!sRes.ok) return;
          const sData = await sRes.json();
          const pageIds: number[] = (sData.query?.search || []).map((r: any) => r.pageid);
          if (pageIds.length === 0) return;

          const thumbUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds.join('|')}&prop=pageimages&pithumbsize=1000&pilimit=5&format=json&origin=*`;
          const tRes = await fetchWithTimeout(thumbUrl, 4000);
          if (!tRes.ok) return;
          const tData = await tRes.json();
          const thumbUrls: string[] = [];
          Object.values(tData.query?.pages || {}).forEach((page: any) => {
            if (page.thumbnail?.source) thumbUrls.push(page.thumbnail.source.replace(/\/\d+px-/, '/600px-'));
          });
          flushResults(thumbUrls);
        }));
      } catch (e) {}
    };

    try {
      // Run all sources concurrently; each flushes to UI as it completes
      await Promise.allSettled([taskWiki(), taskCommons(), taskOpenVerse(), taskWikiExtra()]);
    } catch (error) {
      console.error('Error searching actor images:', error);
    } finally {
      setIsSearchingImages(false);
    }
  };

  const handleAddSelectedSearchImages = () => {
    if (selectedSearchImages.length === 0 || !editingArtistData) return;
    setEditingArtistData(prev => {
      if (!prev) return null;
      const existing = prev.artist.photos || [];
      const updated = [...existing, ...selectedSearchImages];
      return {
        ...prev,
        artist: {
          ...prev.artist,
          photos: updated,
          photoUrl: prev.artist.photoUrl || selectedSearchImages[0] || ''
        }
      };
    });
    setSelectedSearchImages([]);
    setIsGoogleImageModalOpen(false);
  };

  const triggerActorRecognition = async (base64Url: string, forceOverride: boolean = false) => {
    if (!base64Url || isIdentifying) return;
    setIsIdentifying(true);
    try {
      const name = await identifyActorFromImage(base64Url);
      if (name && name.trim()) {
        setEditingArtistData(prev => {
          if (!prev) return null;
          const currentName = prev.artist.name.trim();
          const isDefault = currentName.startsWith('Candidate') || !currentName || forceOverride;
          if (isDefault) {
            return {
              ...prev,
              artist: {
                ...prev.artist,
                name: name
              }
            };
          }
          return prev;
        });
      }
    } catch (e) {
      console.error("AI Actor Recognition error:", e);
    } finally {
      setIsIdentifying(false);
    }
  };

  const handleDropzoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverDropzone(true);
  };

  const handleDropzoneDragLeave = () => {
    setIsDraggingOverDropzone(false);
  };

  const handleDropzoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverDropzone(false);
    
    if (!editingArtistData) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleArtistPhotosUpload(e.dataTransfer.files);
      return;
    }

    const imageUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:image'))) {
      handleAddPhotoFromUrl(imageUrl);
      
      const htmlData = e.dataTransfer.getData('text/html');
      if (htmlData) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlData, 'text/html');
        const img = doc.querySelector('img');
        if (img) {
          const altText = img.getAttribute('alt') || img.getAttribute('title') || '';
          if (altText && altText.trim()) {
            let cleanName = altText.replace(/Image result for/gi, '')
                                  .replace(/photo/gi, '')
                                  .replace(/headshot/gi, '')
                                  .replace(/picture/gi, '')
                                  .replace(/[|\-_].*$/, '')
                                  .trim();
            if (cleanName && cleanName.length > 2 && cleanName.length < 50) {
              setEditingArtistData(prev => {
                if (!prev) return null;
                const currentName = prev.artist.name.trim();
                const isDefault = currentName.startsWith('Candidate') || !currentName;
                if (isDefault) {
                  return {
                    ...prev,
                    artist: { ...prev.artist, name: cleanName }
                  };
                }
                return prev;
              });
            }
          }
        }
      }
    }
  };

  const handleArtistPhotosUpload = (files: FileList) => {
    if (!editingArtistData) return;
    const newPhotos: string[] = [];
    Array.from(files).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const url = e.target.result as string;
          newPhotos.push(url);
          if (newPhotos.length === files.length) {
            setEditingArtistData(prev => {
              if (!prev) return null;
              const existingPhotos = prev.artist.photos || [];
              const combined = [...existingPhotos, ...newPhotos];
              return {
                ...prev,
                artist: {
                  ...prev.artist,
                  photos: combined,
                  photoUrl: prev.artist.photoUrl || combined[0] || ''
                }
              };
            });
            const currentName = editingArtistData.artist.name.trim();
            const isDefault = currentName.startsWith('Candidate') || !currentName;
            if (isDefault && newPhotos[0]) {
              triggerActorRecognition(newPhotos[0]);
            }
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddPhotoFromUrl = (url: string) => {
    if (!url || !editingArtistData) return;
    setEditingArtistData(prev => {
      if (!prev) return null;
      const existing = prev.artist.photos || [];
      const updated = [...existing, url];
      return {
        ...prev,
        artist: {
          ...prev.artist,
          photos: updated,
          photoUrl: prev.artist.photoUrl || url
        }
      };
    });
  };


  const handleRemoveArtistPhoto = (photoToRemove: string) => {
    if (!editingArtistData) return;
    setEditingArtistData(prev => {
      if (!prev) return null;
      const existing = prev.artist.photos || [];
      const filtered = existing.filter(p => p !== photoToRemove);
      return {
        ...prev,
        artist: {
          ...prev.artist,
          photos: filtered,
          photoUrl: prev.artist.photoUrl === photoToRemove ? (filtered[0] || '') : prev.artist.photoUrl
        }
      };
    });
  };

  const handleSetMainArtistPhoto = (photo: string) => {
    if (!editingArtistData) return;
    setEditingArtistData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        artist: {
          ...prev.artist,
          photoUrl: photo
        }
      };
    });
  };

  return (
    <div className={`w-full h-full flex flex-col font-sans overflow-hidden text-xs ${
      isLight ? 'bg-slate-100 text-slate-800' : 'bg-[#0b0c10] text-slate-200'
    }`}>
      
      {/* =========================================================================
          DATA-DENSE STUDIO HEADER & METRICS DASHBOARD TOOLBAR
      ========================================================================= */}
      <header className={`px-5 py-3 border-b flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0 ${
        isLight ? 'bg-white border-slate-300' : 'bg-[#13151b] border-slate-800'
      }`}>
        
        {/* DUAL VIEW TOGGLE: Screenwriter (Script) <-> Casting */}
        {onNavigateToView && (
          <DualViewToggle activeView="casting" isLight={isLight} onToggle={onNavigateToView} />
        )}

        {/* Title & Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500">
                CASTING DASHBOARD & PIPELINE
              </span>
              <span className={`text-[10px] font-mono border px-1.5 py-0.2 ${
                isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
              }`}>
                {stats.confirmedCast}/{stats.totalRoles} ROLES CAST ({stats.percentCast}%)
              </span>
            </div>
            <h1 className={`text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              CASTING DEPT OPERATIONAL HUB
            </h1>
          </div>
        </div>

        {/* Dense KPI Metric Strip */}
        <div className="flex items-center gap-4 font-mono text-[11px] overflow-x-auto py-1">
          <div className={`px-3 py-1.5 border flex items-center gap-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1d26] border-slate-800'
          }`}>
            <span className="text-slate-500 uppercase text-[9.5px]">ROLES DETECTED:</span>
            <span className="font-bold text-amber-500">{roleNames.length}</span>
          </div>

          <div className={`px-3 py-1.5 border flex items-center gap-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1d26] border-slate-800'
          }`}>
            <span className="text-slate-500 uppercase text-[9.5px]">TALENT CHOICES:</span>
            <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{stats.totalCandidates}</span>
          </div>

          <div className={`px-3 py-1.5 border flex items-center gap-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1d26] border-slate-800'
          }`}>
            <span className="text-slate-500 uppercase text-[9.5px]">OFFERS OUT:</span>
            <span className="font-bold text-red-500">{stats.offersOut}</span>
          </div>

          <div className={`px-3 py-1.5 border flex items-center gap-2 ${
            isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-950/30 border-emerald-900/40'
          }`}>
            <span className="text-emerald-500 uppercase text-[9.5px]">CONFIRMED CAST:</span>
            <span className="font-bold text-emerald-400">{stats.confirmedCast}</span>
          </div>
        </div>

        {/* Primary View Switcher & Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex border p-0.5 ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-[#1a1d26] border-slate-800'}`}>
            <button
              onClick={() => setActiveViewMode('pipeline')}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                activeViewMode === 'pipeline'
                  ? (isLight ? 'bg-white text-slate-900 shadow-xs font-bold' : 'bg-[#262a36] text-white font-bold')
                  : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
              }`}
            >
              <LayoutGrid size={13} />
              <span>Pipeline Board</span>
            </button>

            <button
              onClick={() => setActiveViewMode('matrix')}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                activeViewMode === 'matrix'
                  ? (isLight ? 'bg-white text-slate-900 shadow-xs font-bold' : 'bg-[#262a36] text-white font-bold')
                  : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
              }`}
            >
              <ListFilter size={13} />
              <span>Roles Matrix</span>
            </button>

            <button
              onClick={() => setActiveViewMode('comparison')}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                activeViewMode === 'comparison'
                  ? (isLight ? 'bg-white text-slate-900 shadow-xs font-bold' : 'bg-[#262a36] text-white font-bold')
                  : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
              }`}
            >
              <ArrowLeftRight size={13} />
              <span>Comparison</span>
            </button>

            <button
              onClick={() => setActiveViewMode('dossier')}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                activeViewMode === 'dossier'
                  ? (isLight ? 'bg-white text-slate-900 shadow-xs font-bold' : 'bg-[#262a36] text-white font-bold')
                  : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
              }`}
            >
              <Folder size={13} />
              <span>Dossier</span>
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className={`px-3 py-1.5 border text-xs flex items-center gap-1.5 shadow-xs transition-colors font-bold ${
              isLight ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800' : 'bg-[#181c27] border-slate-700 hover:bg-slate-800 text-slate-200'
            }`}
            title="Print Pipeline & Progress Report"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>

          {/* Print Settings Gear + Popover */}
          <div className="relative">
            <button
              onClick={() => setIsPrintSettingsOpen(o => !o)}
              className={`p-2 border text-xs flex items-center justify-center shadow-xs transition-colors ${
                isPrintSettingsOpen
                  ? (isLight ? 'bg-slate-900 text-white border-slate-900' : 'bg-amber-500 text-slate-950 border-amber-400')
                  : (isLight ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800' : 'bg-[#181c27] border-slate-700 hover:bg-slate-800 text-slate-200')
              }`}
              title="Print Settings"
            >
              <Settings size={14} />
            </button>

            {isPrintSettingsOpen && (
              <div
                className={`absolute right-0 top-9 w-[30rem] max-w-[95vw] border shadow-2xl z-[6000] text-xs ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#161922] border-slate-700 text-slate-200'}`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Popover Header */}
                <div className={`px-3 py-2 border-b flex items-center justify-between ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#1a1d27] border-slate-800'}`}>
                  <div className="flex items-center gap-1.5 font-mono font-bold uppercase tracking-wider text-[10px]">
                    <Settings size={12} className="text-amber-500" />
                    <span>Print Settings</span>
                  </div>
                  <button onClick={() => setIsPrintSettingsOpen(false)} className="text-slate-400 hover:text-white">
                    <X size={12} />
                  </button>
                </div>

                <div className="p-3 space-y-3 max-h-[75vh] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-2 gap-3 items-start">
                    {/* Content Toggles */}
                    <SettingsSection title="Content">
                      <PrintCheckRow
                        label="Report title & header info"
                        checked={printSettings.showTitle}
                        onChange={(v) => setPrintSettings(ps => ({ ...ps, showTitle: v }))}
                      />
                      <PrintCheckRow
                        label="Roles & Casting Status table"
                        checked={printSettings.includeRolesTable}
                        onChange={(v) => setPrintSettings(ps => ({ ...ps, includeRolesTable: v }))}
                      />
                      <PrintCheckRow
                        label="Pipeline candidates table"
                        checked={printSettings.includePipelineTable}
                        onChange={(v) => setPrintSettings(ps => ({ ...ps, includePipelineTable: v }))}
                      />
                      {printSettings.includeRolesTable && (
                        <PrintCheckRow
                          label="Include roles with no candidates"
                          checked={printSettings.includeEmptyRoles}
                          onChange={(v) => setPrintSettings(ps => ({ ...ps, includeEmptyRoles: v }))}
                        />
                      )}
                      <PrintCheckRow
                        label="Show counts in section headers"
                        checked={printSettings.showCountsInHeaders}
                        onChange={(v) => setPrintSettings(ps => ({ ...ps, showCountsInHeaders: v }))}
                      />
                    </SettingsSection>

                    {/* Table Style */}
                    <SettingsSection title="Table Style">
                      <PrintCheckRow
                        label="Show table borders"
                        checked={printSettings.tableBorders}
                        onChange={(v) => setPrintSettings(ps => ({ ...ps, tableBorders: v }))}
                      />
                      <div className="mb-1">
                        <div className="text-[9px] font-mono uppercase text-slate-500 mb-1">TABLE HEADING</div>
                        <SegmentedControl
                          value={printSettings.headerStyle}
                          options={[{ value: 'none', label: 'Off' }, { value: 'gray', label: 'Gray' }, { value: 'black', label: 'Black' }, { value: 'white', label: 'White' }]}
                          onChange={(v) => setPrintSettings(ps => ({ ...ps, headerStyle: v }))}
                          isLight={isLight}
                        />
                      </div>
                      <PrintCheckRow
                        label="Zebra striping"
                        checked={printSettings.zebraStripes}
                        onChange={(v) => setPrintSettings(ps => ({ ...ps, zebraStripes: v }))}
                      />
                      <PrintCheckRow
                        label="Page numbers in footer"
                        checked={printSettings.showPageNumbers}
                        onChange={(v) => setPrintSettings(ps => ({ ...ps, showPageNumbers: v }))}
                      />
                    </SettingsSection>
                  </div>

                  {printSettings.includePipelineTable && (
                    <SettingsSection title="Pipeline Status Filter">
                      <div className="text-[9px] font-mono uppercase text-slate-500 mb-1">Print only candidates in this stage</div>
                      <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-1 whitespace-nowrap">
                        <button
                          onClick={() => setPrintSettings(ps => ({ ...ps, pipelineStatusFilter: 'all' }))}
                          className={`shrink-0 px-2 py-0.5 text-[9px] font-mono font-bold uppercase border transition-colors ${
                            printSettings.pipelineStatusFilter === 'all'
                              ? (isLight ? 'bg-slate-900 text-white border-slate-900' : 'bg-amber-500 text-slate-950 border-amber-400')
                              : (isLight ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100' : 'bg-[#0d0e13] border-slate-700 text-slate-400 hover:bg-slate-800')
                          }`}
                        >
                          All
                        </button>
                        {PIPELINE_STAGES.map(stage => (
                          <button
                            key={stage.id}
                            onClick={() => setPrintSettings(ps => ({ ...ps, pipelineStatusFilter: stage.id }))}
                            className={`shrink-0 px-2 py-0.5 text-[9px] font-mono font-bold uppercase border transition-colors ${
                              printSettings.pipelineStatusFilter === stage.id
                                ? (isLight ? 'bg-slate-900 text-white border-slate-900' : 'bg-amber-500 text-slate-950 border-amber-400')
                                : (isLight ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100' : 'bg-[#0d0e13] border-slate-700 text-slate-400 hover:bg-slate-800')
                            }`}
                          >
                            {stage.label}
                          </button>
                        ))}
                      </div>
                    </SettingsSection>
                  )}

                  {printSettings.showTitle && (
                    <SettingsSection title="Report Header / Footer">
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={printSettings.titleText}
                          onChange={(e) => setPrintSettings(ps => ({ ...ps, titleText: e.target.value }))}
                          placeholder="Report title"
                          className={`w-full p-1.5 border text-xs font-mono outline-none focus:border-amber-500 ${
                            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0d0e13] border-slate-700 text-white'
                          }`}
                        />
                        <input
                          type="text"
                          value={printSettings.productionHouse}
                          onChange={(e) => setPrintSettings(ps => ({ ...ps, productionHouse: e.target.value }))}
                          placeholder="Production House (footer)"
                          className={`w-full p-1.5 border text-xs font-mono outline-none focus:border-amber-500 ${
                            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0d0e13] border-slate-700 text-white'
                          }`}
                        />
                        <input
                          type="text"
                          value={printSettings.directorName}
                          onChange={(e) => setPrintSettings(ps => ({ ...ps, directorName: e.target.value }))}
                          placeholder="Director Name (footer)"
                          className={`w-full p-1.5 border text-xs font-mono outline-none focus:border-amber-500 ${
                            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0d0e13] border-slate-700 text-white'
                          }`}
                        />
                      </div>
                    </SettingsSection>
                  )}

                  {/* Page Setup */}
                  <SettingsSection title="Page Setup">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] font-mono uppercase text-slate-500 mb-1">PAGE SIZE</div>
                        <SegmentedControl
                          value={printSettings.pageSize}
                          options={[{ value: 'letter', label: 'Letter' }, { value: 'a4', label: 'A4' }]}
                          onChange={(v) => setPrintSettings(ps => ({ ...ps, pageSize: v }))}
                          isLight={isLight}
                        />
                      </div>
                      <div>
                        <div className="text-[9px] font-mono uppercase text-slate-500 mb-1">ORIENTATION</div>
                        <SegmentedControl
                          value={printSettings.orientation}
                          options={[{ value: 'portrait', label: 'Port' }, { value: 'landscape', label: 'Land' }]}
                          onChange={(v) => setPrintSettings(ps => ({ ...ps, orientation: v }))}
                          isLight={isLight}
                        />
                      </div>
                      <div>
                        <div className="text-[9px] font-mono uppercase text-slate-500 mb-1">MARGINS</div>
                        <SegmentedControl
                          value={printSettings.margins}
                          options={[{ value: 'sm', label: 'Narrow' }, { value: 'md', label: 'Normal' }, { value: 'lg', label: 'Wide' }]}
                          onChange={(v) => setPrintSettings(ps => ({ ...ps, margins: v }))}
                          isLight={isLight}
                        />
                      </div>
                      <div>
                        <div className="text-[9px] font-mono uppercase text-slate-500 mb-1">COLORS</div>
                        <SegmentedControl
                          value={printSettings.colorMode}
                          options={[{ value: 'color', label: 'Color' }, { value: 'grayscale', label: 'B&W' }]}
                          onChange={(v) => setPrintSettings(ps => ({ ...ps, colorMode: v }))}
                          isLight={isLight}
                        />
                      </div>
                      <div>
                        <div className="text-[9px] font-mono uppercase text-slate-500 mb-1">FONT SIZE</div>
                        <SegmentedControl
                          value={printSettings.fontSize}
                          options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]}
                          onChange={(v) => setPrintSettings(ps => ({ ...ps, fontSize: v }))}
                          isLight={isLight}
                        />
                      </div>
                      <div>
                        <div className="text-[9px] font-mono uppercase text-slate-500 mb-1">PHOTO SIZE</div>
                        <SegmentedControl
                          value={printSettings.photoSize}
                          options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]}
                          onChange={(v) => setPrintSettings(ps => ({ ...ps, photoSize: v }))}
                          isLight={isLight}
                        />
                      </div>
                    </div>
                  </SettingsSection>

                  {/* Roles & Pipeline Columns */}
                  <div className="grid grid-cols-2 gap-3 items-start">
                    {printSettings.includeRolesTable && (
                      <SettingsSection title="Roles Table Columns">
                        <div className="grid grid-cols-2 gap-x-2">
                          {ROLES_PRINT_COLUMNS.map(col => (
                            <PrintCheckRow
                              key={col.key}
                              label={col.label}
                              checked={printSettings.rolesColumns[col.key]}
                              onChange={(v) => setPrintSettings(ps => ({ ...ps, rolesColumns: { ...ps.rolesColumns, [col.key]: v } }))}
                            />
                          ))}
                        </div>
                      </SettingsSection>
                    )}

                    {printSettings.includePipelineTable && (
                      <SettingsSection title="Pipeline Table Columns">
                        <div className="grid grid-cols-2 gap-x-2">
                          {PIPELINE_PRINT_COLUMNS.map(col => (
                            <PrintCheckRow
                              key={col.key}
                              label={col.label}
                              checked={printSettings.pipelineColumns[col.key]}
                              onChange={(v) => setPrintSettings(ps => ({ ...ps, pipelineColumns: { ...ps.pipelineColumns, [col.key]: v } }))}
                            />
                          ))}
                        </div>
                      </SettingsSection>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => setPrintSettings({
                        titleText: 'Casting Pipeline & Progress Report',
                        productionHouse: '',
                        directorName: '',
                        showTitle: true,
                        includeRolesTable: true,
                        includePipelineTable: true,
                        includeEmptyRoles: true,
                        showCountsInHeaders: true,
                        pageSize: 'letter',
                        orientation: 'landscape',
                        margins: 'md',
                        colorMode: 'color',
                        fontSize: 'md',
                        photoSize: 'md',
                        tableBorders: true,
                        headerStyle: 'gray',
                        zebraStripes: false,
                        showPageNumbers: true,
                        pipelineStatusFilter: 'all',
                        rolesColumns: { role: true, tier: true, scenes: true, words: true, candidates: true, confirmed: true },
                        pipelineColumns: { no: true, photo: true, candidate: true, role: true, stage: true, agency: true, fee: true }
                      })}
                      className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase border flex items-center gap-1 ${
                        isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-[#101217] border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <RotateCcw size={10} />
                      Reset
                    </button>
                    <button
                      onClick={() => { setIsPrintSettingsOpen(false); window.print(); }}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] font-mono uppercase flex items-center gap-1"
                    >
                      <Printer size={11} />
                      Apply & Print
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card Display Settings Gear + Popover */}
          <div className="relative">
            <button
              onClick={() => setIsCardSettingsOpen(o => !o)}
              className={`p-2 border text-xs flex items-center justify-center shadow-xs transition-colors ${
                isCardSettingsOpen
                  ? (isLight ? 'bg-slate-900 text-white border-slate-900' : 'bg-amber-500 text-slate-950 border-amber-400')
                  : (isLight ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800' : 'bg-[#181c27] border-slate-700 hover:bg-slate-800 text-slate-200')
              }`}
              title="Card Display Settings"
            >
              <Eye size={14} />
            </button>

            {isCardSettingsOpen && (
              <div
                className={`absolute right-0 top-9 w-72 border shadow-2xl z-[6000] text-xs ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#161922] border-slate-700 text-slate-200'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`px-3 py-2 border-b flex items-center justify-between ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#1a1d27] border-slate-800'}`}>
                  <div className="flex items-center gap-1.5 font-mono font-bold uppercase tracking-wider text-[10px]">
                    <Eye size={12} className="text-amber-500" />
                    <span>Card Display</span>
                  </div>
                  <button onClick={() => setIsCardSettingsOpen(false)} className="text-slate-400 hover:text-white">
                    <X size={12} />
                  </button>
                </div>
                <div className="p-3 space-y-2">
                  <div className="text-[9px] font-mono uppercase tracking-wider text-amber-500 font-bold mb-1.5">INFO SHOWN ON CARDS</div>
                  <PrintCheckRow
                    label="Salary / Fee Quote"
                    checked={cardDisplay.showSalary}
                    onChange={(v) => setCardDisplay(cd => ({ ...cd, showSalary: v }))}
                  />
                  <PrintCheckRow
                    label="Self-Tape / Video Link"
                    checked={cardDisplay.showVideoLink}
                    onChange={(v) => setCardDisplay(cd => ({ ...cd, showVideoLink: v }))}
                  />
                  <PrintCheckRow
                    label="Casting Notes"
                    checked={cardDisplay.showCastingNotes}
                    onChange={(v) => setCardDisplay(cd => ({ ...cd, showCastingNotes: v }))}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => handleOpenNewCandidateModal()}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <UserPlus size={14} />
            <span>+ Add Talent Choice</span>
          </button>
        </div>
      </header>

      {/* =========================================================================
          SCRIPT & BREAKDOWN CHARACTERS ROSTER SECTION (HERO CHARACTER CAROUSEL)
      ========================================================================= */}
      <div className={`px-5 py-3 border-b flex flex-col gap-2 shrink-0 ${
        isLight ? 'bg-slate-200/70 border-slate-300' : 'bg-[#151722] border-slate-800'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRosterVisible(v => !v)}
              className={`p-1 border text-xs transition-colors ${
                isLight ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700' : 'bg-[#1a1d28] border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
              title={isRosterVisible ? 'Collapse Roster' : 'Expand Roster'}
            >
              <ChevronRight size={14} className={`transition-transform ${isRosterVisible ? 'rotate-90' : ''}`} />
            </button>
            <Users size={15} className="text-amber-500" />
            <h2 className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
              SCRIPT & BREAKDOWN CHARACTERS ROSTER ({roleNames.length})
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">Select a character to filter talent choices travelling the pipeline:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollRoster('left')}
              className={`p-1 border text-xs ${isLight ? 'bg-white border-slate-300 hover:bg-slate-100' : 'bg-[#1a1d28] border-slate-700 hover:bg-slate-800'}`}
              title="Scroll Left"
            >
              <ChevronLeft size={13} />
            </button>

            <button
              onClick={() => scrollRoster('right')}
              className={`p-1 border text-xs ${isLight ? 'bg-white border-slate-300 hover:bg-slate-100' : 'bg-[#1a1d28] border-slate-700 hover:bg-slate-800'}`}
              title="Scroll Right"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Horizontal Character Roster Cards Bar */}
        {isRosterVisible && (
        <div ref={characterRosterRef} className="flex gap-2 overflow-x-auto custom-scrollbar py-1">
          {/* All Characters Chip */}
          <div
            onClick={() => setSelectedRole('all')}
            className={`px-3 py-2 border cursor-pointer shrink-0 flex flex-col justify-between transition-all min-w-[130px] ${
              selectedRole === 'all'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-xs'
                : (isLight ? 'bg-white border-slate-300 hover:bg-slate-50 text-slate-800' : 'bg-[#1a1d28] border-slate-700 hover:bg-[#202432] text-slate-200')
            }`}
          >
            <div className="text-[11px] font-bold uppercase font-mono">ALL CHARACTERS</div>
            <div className="text-[9.5px] font-mono opacity-80 mt-1">Master Pipeline</div>
            <div className="text-[9.5px] font-mono mt-1 font-bold">
              {stats.totalCandidates} Total Choices
            </div>
          </div>

          {/* Individual Detected Characters */}
          {roleNames.map(charName => {
            const char = characterData[charName];
            const metrics = characterMetrics[charName] || { sceneCount: 0, dialogueWords: 0 };
            const candidatesCount = char?.artists?.length || 0;
            const confirmedArtist = char?.artists?.find(a => a.id === char.confirmedArtistId || a.status === 'on_board' || a.status === 'contract_signed');
            const isSelected = selectedRole === charName;

            return (
              <div
                key={charName}
                onClick={() => setSelectedRole(charName)}
                className={`px-3 py-2 border cursor-pointer shrink-0 flex flex-col justify-between transition-all min-w-[160px] max-w-[200px] ${
                  isSelected
                    ? (isLight ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-amber-400' : 'bg-[#262a38] text-white border-amber-500 ring-2 ring-amber-500/50')
                    : (isLight ? 'bg-white border-slate-300 hover:bg-slate-50 text-slate-900' : 'bg-[#181a24] border-slate-700/80 hover:bg-[#1e212f] text-slate-200')
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-mono font-bold text-xs uppercase truncate text-amber-400">{charName}</span>
                  <span className={`text-[9px] font-mono px-1 py-0.2 border uppercase shrink-0 ${
                    BILLING_TIERS.find(t => t.id === char?.billingTier)?.[isLight ? 'badgeLight' : 'badge'] || 'bg-slate-800 text-slate-300'
                  }`}>
                    {char?.billingTier || 'SUPPORTING'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[9.5px] font-mono opacity-80 mt-1">
                  <span>{metrics.sceneCount} Scenes</span>
                  <span>•</span>
                  <span>{metrics.dialogueWords} Words</span>
                </div>

                <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-slate-700/40 font-mono text-[9.5px]">
                  <span className="font-bold">{candidatesCount} Talent Choice{candidatesCount !== 1 ? 's' : ''}</span>
                  
                  {confirmedArtist ? (
                    <span className="text-emerald-400 font-bold truncate">✓ {confirmedArtist.name.split(' ')[0]}</span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenNewCandidateModal(charName);
                      }}
                      className="text-amber-400 hover:underline font-bold"
                    >
                      + Add Talent
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* =========================================================================
          CONTROL & FILTERING RIBBON
      ========================================================================= */}
      <div className={`px-5 py-2 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
        isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#111217] border-slate-800'
      }`}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Quick Search */}
          <div className={`relative flex items-center border ${isLight ? 'bg-white border-slate-300' : 'bg-[#181a22] border-slate-700'}`}>
            <Search className={`absolute left-2.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} size={13} />
            <input
              type="text"
              placeholder="Filter candidate, agency, role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-8 pr-3 py-1 text-xs outline-none w-60 bg-transparent ${
                isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-500'
              }`}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="pr-2 text-slate-400 hover:text-slate-200">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Selected Character Indicator */}
          {selectedRole !== 'all' && (
            <div className="flex items-center gap-2 text-xs font-mono font-bold bg-amber-500/10 text-amber-400 px-2.5 py-1 border border-amber-500/30">
              <span>FILTERED FOR: {selectedRole}</span>
              <button onClick={() => setSelectedRole('all')} className="hover:text-white">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Billing Tier Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500">TIER:</span>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className={`text-xs px-2 py-1 border outline-none cursor-pointer ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181a22] border-slate-700 text-slate-200'
              }`}
            >
              <option value="all">All Tiers</option>
              {BILLING_TIERS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Kanban Board Column Size Controller */}
          {activeViewMode === 'pipeline' && (
            <div className="flex items-center gap-1.5 text-xs border-l border-slate-700/60 pl-3">
              <span className="text-[10px] font-mono uppercase text-slate-500">COL WIDTH:</span>
              <div className={`flex border p-0.5 ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-[#181a22] border-slate-700'}`}>
                {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setColumnWidth(sz)}
                    className={`px-2 py-0.5 text-[10px] font-mono uppercase font-bold transition-colors ${
                      columnWidth === sz
                        ? (isLight ? 'bg-white text-slate-900 shadow-xs' : 'bg-amber-500 text-slate-950 font-bold')
                        : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Scroll Navigation Controls & Visual Progress Ratio */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {/* Horizontal Scroll Buttons for Pipeline Board */}
          {activeViewMode === 'pipeline' && (
            <div className="flex items-center gap-1 border-r border-slate-700/60 pr-3">
              <button
                onClick={() => scrollKanban('left')}
                className={`p-1.5 border flex items-center gap-1 transition-colors ${
                  isLight ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800' : 'bg-[#181a22] border-slate-700 hover:bg-slate-800 text-slate-200'
                }`}
                title="Scroll Kanban Left"
              >
                <ChevronLeft size={13} />
                <span className="text-[10px] font-bold">PREV</span>
              </button>

              <button
                onClick={() => scrollKanban('right')}
                className={`p-1.5 border flex items-center gap-1 transition-colors ${
                  isLight ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800' : 'bg-[#181a22] border-slate-700 hover:bg-slate-800 text-slate-200'
                }`}
                title="Scroll Kanban Right"
              >
                <span className="text-[10px] font-bold">NEXT</span>
                <ChevronRight size={13} />
              </button>
            </div>
          )}

          <span className="text-slate-500 text-[10px] uppercase hidden sm:inline">PROGRESS:</span>
          <div className={`w-28 h-2.5 border overflow-hidden ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-slate-800 border-slate-700'}`}>
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${stats.percentCast}%` }} />
          </div>
          <span className="font-bold text-emerald-500">{stats.percentCast}%</span>
        </div>
      </div>

      {/* =========================================================================
          VIEW MODE 1: PRIORITY HERO - DATA-DENSE PIPELINE KANBAN BOARD
      ========================================================================= */}
      {activeViewMode === 'pipeline' && (
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {/* Side Scroll Button (Left Overlay) */}
          <button
            onClick={() => scrollKanban('left')}
            className={`absolute left-1 top-1/2 -translate-y-1/2 z-30 p-2 border shadow-lg transition-all opacity-80 hover:opacity-100 ${
              isLight ? 'bg-white border-slate-300 text-slate-900 hover:bg-amber-400' : 'bg-[#181c27] border-slate-700 text-white hover:bg-amber-500 hover:text-black'
            }`}
            title="Scroll Pipeline Left"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Side Scroll Button (Right Overlay) */}
          <button
            onClick={() => scrollKanban('right')}
            className={`absolute right-1 top-1/2 -translate-y-1/2 z-30 p-2 border shadow-lg transition-all opacity-80 hover:opacity-100 ${
              isLight ? 'bg-white border-slate-300 text-slate-900 hover:bg-amber-400' : 'bg-[#181c27] border-slate-700 text-white hover:bg-amber-500 hover:text-black'
            }`}
            title="Scroll Pipeline Right"
          >
            <ChevronRight size={16} />
          </button>

          {/* Scrollable Pipeline Columns Container */}
          <div ref={kanbanScrollRef} className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar p-3 px-8">
            <div className="flex gap-2.5 h-full min-w-max pb-1">
              {PIPELINE_STAGES.map(stage => {
                const stageItems = pipelineByStage[stage.id] || [];
                const isOver = draggedOverStage === stage.id;

                return (
                  <div
                    key={stage.id}
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDrop={(e) => handleDropStage(e, stage.id as any)}
                    className={`${getColumnWidthClass()} flex flex-col h-full border transition-all ${
                      isLight 
                        ? (isOver ? 'bg-amber-100/50 border-amber-400' : 'bg-white border-slate-200')
                        : (isOver ? 'bg-[#1d202b] border-amber-500/80' : 'bg-[#13151b] border-slate-800')
                    }`}
                  >
                    {/* Column Header */}
                    <div className={`p-2 border-b flex items-center justify-between shrink-0 ${
                      isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181b24] border-slate-800'
                    }`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 shrink-0" style={{ backgroundColor: stage.color }} />
                        <h3 className={`text-[11px] font-bold uppercase truncate ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                          {stage.label}
                        </h3>
                      </div>

                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 border ${
                        isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-[#101217] border-slate-700 text-slate-300'
                      }`}>
                        {stageItems.length}
                      </span>
                    </div>

                    {/* Candidate List Container */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-1.5">
                      {stageItems.map(({ charName, artist }) => {
                        const isConfirmed = artist.status === 'on_board' || artist.status === 'contract_signed';
                        const isMenuOpen = activeCardMenuId === artist.id;

                        return (
                          <div
                            key={artist.id}
                            draggable
                            onDragStart={() => handleDragStart(charName, artist.id)}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditCandidateModal(charName, artist);
                            }}
                            title="Double-click to edit candidate details"
                            className={`p-2.5 border transition-all cursor-grab active:cursor-grabbing hover:border-amber-500/60 relative ${
                              isConfirmed
                                ? (isLight ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-950/30 border-emerald-800/80')
                                : (isLight ? 'bg-slate-50 border-slate-200 hover:bg-white' : 'bg-[#181a22] border-slate-800/90 hover:bg-[#1d202a]')
                            }`}
                          >
                            {/* Candidate Card Top Row: Bigger Picture & Names & Context Menu */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5 min-w-0">
                                {/* Candidate Picture Thumbnail with Badge */}
                                <div className="w-14 h-14 border-2 border-slate-700 shrink-0 bg-slate-900 overflow-hidden flex items-center justify-center shadow-sm relative">
                                  <span className="absolute top-0 left-0 bg-amber-500 text-slate-950 text-[9px] font-mono font-black px-1 z-10">
                                    #{artist.rank || 1}
                                  </span>
                                  {artist.photoUrl ? (
                                    <img src={artist.photoUrl} alt={artist.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-sm font-mono font-black text-amber-400">{artist.name.charAt(0)}</span>
                                  )}
                                </div>

                                <div className="min-w-0 space-y-1">
                                  {/* Candidate Badge & Actor Name */}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[9.5px] font-mono font-black rounded-xs shrink-0">
                                      CANDIDATE #{artist.rank || 1}
                                    </span>
                                    <h4 className={`text-sm font-black tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                      {artist.name}
                                    </h4>
                                  </div>

                                  {/* Character Role Badge */}
                                  <div className="inline-flex items-center gap-1 text-[10.5px] font-mono font-black uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 border border-amber-500/30 truncate">
                                    <span>FOR:</span>
                                    <span className="truncate">{charName}</span>
                                  </div>

                                  {artist.rating ? (
                                    <div className="flex items-center gap-0.5">
                                      {Array.from({ length: 10 }, (_, idx) => idx + 1).map(i => (
                                        <Star
                                          key={i}
                                          size={9}
                                          className={i <= (artist.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}
                                        />
                                      ))}
                                    </div>
                                  ) : null}

                                  {/* Key Dates Row (below rating) */}
                                  {(artist.auditionDate || artist.callbackDate || artist.offerDate) && (
                                    <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase font-bold flex-wrap">
                                      {artist.auditionDate && (
                                        <span className="flex items-center gap-1 text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.2">
                                          <Clock size={9} /> AUD {artist.auditionDate}
                                        </span>
                                      )}
                                      {artist.callbackDate && (
                                        <span className="flex items-center gap-1 text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.2">
                                          <Clock size={9} /> CB {artist.callbackDate}
                                        </span>
                                      )}
                                      {artist.offerDate && (
                                        <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2">
                                          <Check size={9} /> OFFER {artist.offerDate}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Card Context Menu Trigger Button */}
                              <div className="relative shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCardMenuId(isMenuOpen ? null : artist.id);
                                  }}
                                  className={`p-1.5 border transition-colors ${
                                    isLight ? 'bg-white border-slate-300 hover:bg-slate-200 text-slate-700' : 'bg-[#12141a] border-slate-700 hover:bg-slate-800 text-slate-300'
                                  }`}
                                  title="Candidate Options"
                                >
                                  <MoreVertical size={13} />
                                </button>

                                {/* Candidate Options Popover Context Menu */}
                                {isMenuOpen && (
                                  <div 
                                    className={`absolute right-0 top-7 w-48 border shadow-xl z-50 py-1 text-xs font-mono font-bold ${
                                      isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#1a1d27] border-slate-700 text-slate-200'
                                    }`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => handleOpenEditCandidateModal(charName, artist)}
                                      className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-amber-500 hover:text-slate-950 transition-colors"
                                    >
                                      <Edit3 size={12} />
                                      <span>Edit Candidate Details</span>
                                    </button>

                                    <button
                                      onClick={() => handleConfirmArtist(charName, artist.id)}
                                      className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-emerald-500 hover:text-slate-950 transition-colors"
                                    >
                                      <CheckCircle2 size={12} />
                                      <span>{isConfirmed ? 'Unmark Cast Status' : 'Confirm as Casted'}</span>
                                    </button>

                                    {stage.id !== 'passed' && (
                                      <button
                                        onClick={() => {
                                          const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === stage.id);
                                          if (currentIdx < PIPELINE_STAGES.length - 1) {
                                            handleMoveCandidateStage(charName, artist.id, PIPELINE_STAGES[currentIdx + 1].id as any);
                                          }
                                        }}
                                        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-blue-500 hover:text-white transition-colors"
                                      >
                                        <ChevronRight size={12} />
                                        <span>Move to Next Stage</span>
                                      </button>
                                    )}

                                    {stage.id !== 'idea' && (
                                      <button
                                        onClick={() => {
                                          const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === stage.id);
                                          if (currentIdx > 0) {
                                            handleMoveCandidateStage(charName, artist.id, PIPELINE_STAGES[currentIdx - 1].id as any);
                                          }
                                        }}
                                        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-colors"
                                      >
                                        <ChevronLeft size={12} />
                                        <span>Move to Prev Stage</span>
                                      </button>
                                    )}

                                    <div className="my-1 border-t border-slate-700/60" />

                                    <button
                                      onClick={() => handleDeleteArtist(charName, artist.id)}
                                      className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-600 hover:text-white transition-colors text-rose-400"
                                    >
                                      <Trash2 size={12} />
                                      <span>Delete Record</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {cardDisplay.showSalary && (
                              <div className={`mt-2 p-2 border font-mono text-[10px] space-y-1 ${
                                isLight ? 'bg-white border-slate-200' : 'bg-[#111319] border-slate-800'
                              }`}>
                                <div className="flex justify-between items-center flex-wrap gap-1">
                                  <span className="text-slate-500 uppercase text-[9px] font-bold">SALARY QUOTE:</span>
                                  <span className="font-black text-emerald-500 text-xs">{artist.feeQuote || artist.dealTerms?.feeQuote || 'No Quote'}</span>
                                </div>

                                <div className="flex justify-between items-center flex-wrap gap-1 pt-0.5 border-t border-slate-800/40">
                                  <span className="text-slate-500 uppercase text-[9px] font-bold">SALARY TYPE:</span>
                                  <span className="font-bold text-cyan-400">
                                    {FEE_TYPES.find(f => f.id === artist.dealTerms?.feeType)?.label.replace(/\s*\(.*\)/, '') || artist.dealTerms?.feeType || 'Per Week'}
                                  </span>
                                </div>

                                {artist.dealTerms?.sagTier && (
                                  <div className="text-[9px] text-slate-400 truncate pt-0.5">
                                    <span className="text-slate-500">UNION:</span> {artist.dealTerms.sagTier}
                                  </div>
                                )}
                              </div>
                            )}

                            {artist.contact?.agency && (
                              <div className="text-[10px] text-slate-400 font-mono truncate mt-1">
                                <span className="text-slate-500">AGENCY:</span> <span className="font-bold text-slate-300">{artist.contact.agency}</span>
                              </div>
                            )}

                            {cardDisplay.showVideoLink && artist.auditionUrl && (
                              <a
                                href={artist.auditionUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={`mt-1 flex items-center gap-1 text-[10px] font-mono truncate transition-colors ${
                                  isLight ? 'text-cyan-700 hover:text-cyan-900' : 'text-cyan-400 hover:text-cyan-300'
                                }`}
                              >
                                <Play size={10} />
                                <span>Self-Tape / Reel Video</span>
                              </a>
                            )}

                            {cardDisplay.showCastingNotes && artist.notes && (
                              <p className={`mt-1 text-[10px] font-mono italic truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                <span className="text-slate-500 uppercase text-[9px] not-italic font-bold">NOTES:</span> "{artist.notes}"
                              </p>
                            )}

                            {/* Quick Actions Bar */}
                            <div className="mt-2 pt-1.5 border-t border-dashed border-slate-700/60 flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1">
                                {stage.id !== 'idea' && (
                                  <button
                                    onClick={() => {
                                      const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === stage.id);
                                      if (currentIdx > 0) {
                                        handleMoveCandidateStage(charName, artist.id, PIPELINE_STAGES[currentIdx - 1].id as any);
                                      }
                                    }}
                                    className={`px-1 py-0.5 border text-[9px] ${
                                      isLight ? 'bg-white border-slate-300 hover:bg-slate-200 text-slate-800' : 'bg-[#12141a] border-slate-700 hover:bg-slate-800 text-slate-300'
                                    }`}
                                    title="Move Previous"
                                  >
                                    <ChevronLeft size={10} />
                                  </button>
                                )}

                                {stage.id !== 'passed' && (
                                  <button
                                    onClick={() => {
                                      const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === stage.id);
                                      if (currentIdx < PIPELINE_STAGES.length - 1) {
                                        handleMoveCandidateStage(charName, artist.id, PIPELINE_STAGES[currentIdx + 1].id as any);
                                      }
                                    }}
                                    className={`px-1 py-0.5 border text-[9px] ${
                                      isLight ? 'bg-white border-slate-300 hover:bg-slate-200 text-slate-800' : 'bg-[#12141a] border-slate-700 hover:bg-slate-800 text-slate-300'
                                    }`}
                                    title="Move Next"
                                  >
                                    <ChevronRight size={10} />
                                  </button>
                                )}
                              </div>

                              <select
                                value={artist.status}
                                onChange={(e) => handleMoveCandidateStage(charName, artist.id, e.target.value as ArtistOption['status'])}
                                className={`px-1.5 py-0.5 text-[9.5px] font-bold uppercase border outline-none max-w-[130px] truncate ${
                                  isConfirmed
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                    : (isLight ? 'bg-slate-200 hover:bg-emerald-500 hover:text-white border-slate-300 text-slate-800' : 'bg-[#12141a] hover:bg-emerald-500 hover:text-slate-950 border-slate-700 text-slate-300')
                                }`}
                                title="Change status"
                              >
                                {PIPELINE_STAGES.map(stage => (
                                  <option key={stage.id} value={stage.id}>{stage.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}

                      {stageItems.length === 0 && (
                        <div className={`p-4 border border-dashed text-center text-[10px] font-mono ${
                          isLight ? 'border-slate-300 text-slate-400' : 'border-slate-800 text-slate-600'
                        }`}>
                          NO CANDIDATES
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE 2: ROSTER & AUDITION MATRIX TABLE
      ========================================================================= */}
      {activeViewMode === 'matrix' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
              ROSTER & SCREEN TIME METRICS TABLE
            </h2>
            <button
              onClick={() => setIsCreatingRole(true)}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
            >
              + Create Role
            </button>
          </div>

          {isCreatingRole && (
            <div className={`p-3 border flex items-center gap-2 ${isLight ? 'bg-white border-amber-400' : 'bg-[#181a22] border-amber-500/80'}`}>
              <input
                type="text"
                placeholder="Role name (e.g. INSPECTOR VIKRAM)..."
                value={newRoleInputName}
                onChange={(e) => setNewRoleInputName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNewRole()}
                className={`flex-1 px-2.5 py-1 border text-xs font-mono outline-none ${isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`}
                autoFocus
              />
              <button onClick={handleAddNewRole} className="px-3 py-1 bg-amber-500 text-slate-950 font-bold text-xs uppercase">Save</button>
              <button onClick={() => setIsCreatingRole(false)} className={`px-2.5 py-1 text-xs border ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>Cancel</button>
            </div>
          )}

          <div className={`border overflow-x-auto ${isLight ? 'bg-white border-slate-300' : 'bg-[#13151b] border-slate-800'}`}>
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className={`border-b font-mono ${isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-[#181a22] border-slate-800 text-slate-300'}`}>
                  <th className="p-2.5 uppercase text-[10px]">Role Name</th>
                  <th className="p-2.5 uppercase text-[10px]">Billing Tier</th>
                  <th className="p-2.5 uppercase text-[10px] text-center">Scenes</th>
                  <th className="p-2.5 uppercase text-[10px] text-center">Dialogue Words</th>
                  <th className="p-2.5 uppercase text-[10px]">Confirmed Cast</th>
                  <th className="p-2.5 uppercase text-[10px] text-center">Candidates</th>
                  <th className="p-2.5 uppercase text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roleNames.map(roleName => {
                  const char = characterData[roleName];
                  const metrics = characterMetrics[roleName] || { sceneCount: 0, dialogueWords: 0 };
                  const confirmedArtist = char?.artists?.find(a => a.id === char.confirmedArtistId || a.status === 'on_board' || a.status === 'contract_signed');
                  const candidatesCount = char?.artists?.length || 0;

                  return (
                    <tr key={roleName} className={`border-b ${isLight ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-800/60 hover:bg-[#181a22]'}`}>
                      <td className="p-2.5 font-bold font-mono text-amber-500">{roleName}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 text-[10px] border font-mono ${BILLING_TIERS.find(t => t.id === char?.billingTier)?.[isLight ? 'badgeLight' : 'badge'] || 'bg-slate-800 text-slate-300'}`}>
                          {BILLING_TIERS.find(t => t.id === char?.billingTier)?.label || char?.billingTier || 'Supporting'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold">{metrics.sceneCount}</td>
                      <td className="p-2.5 text-center font-mono font-bold">{metrics.dialogueWords}</td>
                      <td className="p-2.5 font-bold text-emerald-500">
                        {confirmedArtist ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 size={13} /> {confirmedArtist.name}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic font-normal text-[11px]">Uncast</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold">{candidatesCount}</td>
                      <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenNewCandidateModal(roleName)}
                            className="px-2 py-1 bg-amber-500 text-slate-950 font-bold text-[10px] uppercase"
                          >
                            + Candidate
                          </button>
                          <button
                            onClick={() => handleDeleteRole(roleName)}
                            className="p-1 text-rose-400 hover:bg-rose-950/40 border border-rose-800/40"
                            title="Delete role"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE 3: CANDIDATE COMPARISON MATRIX
      ========================================================================= */}
      {activeViewMode === 'comparison' && (() => {
        const gridCls = `grid gap-3 ${
          comparisonCardSize === 'sm'
            ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            : comparisonCardSize === 'xs'
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'
        }`;

        const renderComparisonCard = (charName: string, artist: ArtistOption) => {
          const isConfirmed = characterData[charName]?.confirmedArtistId === artist.id || artist.status === 'on_board' || artist.status === 'contract_signed';
          const stageLabel = PIPELINE_STAGES.find(s => s.id === artist.status)?.label || artist.status;
          return (
            <div
              key={artist.id}
              className={`border flex flex-col justify-between ${
                comparisonCardSize === 'tiny' ? 'p-1.5 space-y-1.5' : 'p-3 space-y-2.5'
              } ${
                isLight ? 'bg-white border-slate-300' : 'bg-[#13151b] border-slate-800'
              }`}
            >
              <div className="space-y-2">
                <div className={`relative w-full border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center aspect-square`}>
                  {artist.photoUrl ? (
                    <img src={artist.photoUrl} alt={artist.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserCheck size={32} className="text-amber-500" />
                  )}
                  <span className="absolute top-1 left-1 bg-amber-500 text-slate-950 text-[9px] font-mono font-black px-1.5 z-10">
                    #{artist.rank || 1}
                  </span>
                  {isConfirmed && (
                    <span className="absolute bottom-1 right-1 bg-emerald-500 text-slate-950 text-[8.5px] font-mono font-black px-1.5 py-0.5 z-10">
                      ✓ CASTED
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1">
                  <h3 className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{artist.name}</h3>
                  {cardDisplay.showSalary && (
                    <span className="text-xs font-mono font-bold text-emerald-500 truncate">{artist.feeQuote || 'No Quote'}</span>
                  )}
                </div>

                <div className={`space-y-1.5 ${comparisonCardSize === 'tiny' ? 'hidden' : ''}`}>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 10 }, (_, idx) => idx + 1).map(i => (
                      <Star
                        key={i}
                        size={9}
                        className={i <= (artist.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase font-bold flex-wrap">
                    {artist.auditionDate && (
                      <span className="flex items-center gap-1 text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.2">
                        <Clock size={9} /> AUD {artist.auditionDate}
                      </span>
                    )}
                    {artist.callbackDate && (
                      <span className="flex items-center gap-1 text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.2">
                        <Clock size={9} /> CB {artist.callbackDate}
                      </span>
                    )}
                  </div>
                </div>

                {comparisonCardSize !== 'tiny' && (
                <div className={`p-2 border text-[11px] font-mono space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181a22] border-slate-800'}`}>
                  <div><span className="text-slate-500 uppercase text-[9px]">STAGE:</span> <span className="font-bold text-amber-500">{stageLabel}</span></div>
                  {artist.contact?.agency && (
                    <div><span className="text-slate-500 uppercase text-[9px]">AGENCY:</span> <span className="font-bold truncate block">{artist.contact.agency}</span></div>
                  )}
                  {artist.contact?.agentName && (
                    <div><span className="text-slate-500 uppercase text-[9px]">AGENT:</span> <span className="truncate block">{artist.contact.agentName}</span></div>
                  )}
                  {(artist.contact?.phone || artist.contact?.email) && (
                    <div><span className="text-slate-500 uppercase text-[9px]">CONTACT:</span> <span className="truncate block">{artist.contact?.phone || artist.contact?.email}</span></div>
                  )}
                  {comparisonCardSize === 'sm' && artist.dealTerms?.sagTier && (
                    <div><span className="text-slate-500 uppercase text-[9px]">UNION:</span> <span className="truncate block">{artist.dealTerms.sagTier}</span></div>
                  )}
                </div>
                )}

                {cardDisplay.showVideoLink && artist.auditionUrl && (
                  <a
                    href={artist.auditionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center gap-1 text-[10px] font-mono truncate transition-colors ${
                      isLight ? 'text-cyan-700 hover:text-cyan-900' : 'text-cyan-400 hover:text-cyan-300'
                    }`}
                  >
                    <Play size={10} />
                    <span>Self-Tape / Reel Video</span>
                  </a>
                )}

                {cardDisplay.showCastingNotes && artist.notes && comparisonCardSize !== 'tiny' && (
                  <p className={`text-[11px] italic p-2 border ${isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-[#181a22] border-slate-800 text-slate-300'}`}>
                    "{artist.notes}"
                  </p>
                )}
              </div>

              <div className={`flex items-center justify-between gap-2 border-t border-slate-800 ${comparisonCardSize === 'tiny' ? 'pt-1' : 'pt-2'}`}>
                <button
                  onClick={() => handleOpenEditCandidateModal(charName, artist)}
                  className={`text-[10px] font-mono border ${isLight ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-[#181a22] border-slate-700 text-slate-300'} ${comparisonCardSize === 'tiny' ? 'px-1.5 py-0.5' : 'px-2.5 py-1'}`}
                >
                  Edit
                </button>
                <select
                  value={artist.status}
                  onChange={(e) => handleMoveCandidateStage(charName, artist.id, e.target.value as ArtistOption['status'])}
                  className={`text-[10px] font-bold uppercase border outline-none max-w-[140px] truncate ${
                    isConfirmed ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  } ${comparisonCardSize === 'tiny' ? 'px-1 py-0.5' : 'px-2 py-1'}`}
                  title="Change status"
                >
                  {PIPELINE_STAGES.map(stage => (
                    <option key={stage.id} value={stage.id}>{stage.label}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        };

        return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
              SIDE-BY-SIDE CANDIDATE EVALUATION
            </h2>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Card Size Control */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-500">CARD SIZE:</span>
                <div className={`flex border p-0.5 ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-[#181a22] border-slate-700'}`}>
                  {(['tiny', 'xs', 'sm'] as const).map(sz => (
                    <button
                      key={sz}
                      onClick={() => setComparisonCardSize(sz)}
                      className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase transition-colors ${
                        comparisonCardSize === sz
                          ? (isLight ? 'bg-slate-900 text-white shadow-xs' : 'bg-amber-500 text-slate-950 font-bold')
                          : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
                      }`}
                    >
                      {sz === 'tiny' ? 'TINY' : sz === 'xs' ? 'XS' : 'SM'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase text-slate-500">ROLE:</span>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className={`px-2.5 py-1 border text-xs font-mono outline-none ${
                    isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181a22] border-slate-700 text-white'
                  }`}
                >
                  <option value="all">All Roles</option>
                  {roleNames.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Card Display Gear + Popover */}
              <div className="relative">
                <button
                  onClick={() => setIsComparisonCardSettingsOpen(o => !o)}
                  className={`p-1.5 border flex items-center justify-center transition-colors ${
                    isComparisonCardSettingsOpen
                      ? (isLight ? 'bg-slate-900 text-white border-slate-900' : 'bg-amber-500 text-slate-950 border-amber-400')
                      : (isLight ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800' : 'bg-[#181a22] border-slate-700 hover:bg-slate-800 text-slate-200')
                  }`}
                  title="Card Display Settings"
                >
                  <Eye size={14} />
                </button>

                {isComparisonCardSettingsOpen && (
                  <div
                    className={`absolute right-0 top-8 w-72 border shadow-2xl z-[6000] text-xs ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#161922] border-slate-700 text-slate-200'}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={`px-3 py-2 border-b flex items-center justify-between ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#1a1d27] border-slate-800'}`}>
                      <div className="flex items-center gap-1.5 font-mono font-bold uppercase tracking-wider text-[10px]">
                        <Eye size={12} className="text-amber-500" />
                        <span>Card Display</span>
                      </div>
                      <button onClick={() => setIsComparisonCardSettingsOpen(false)} className="text-slate-400 hover:text-white">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-amber-500 font-bold mb-1.5">INFO SHOWN ON CARDS</div>
                      <PrintCheckRow
                        label="Salary / Fee Quote"
                        checked={cardDisplay.showSalary}
                        onChange={(v) => setCardDisplay(cd => ({ ...cd, showSalary: v }))}
                      />
                      <PrintCheckRow
                        label="Self-Tape / Video Link"
                        checked={cardDisplay.showVideoLink}
                        onChange={(v) => setCardDisplay(cd => ({ ...cd, showVideoLink: v }))}
                      />
                      <PrintCheckRow
                        label="Casting Notes"
                        checked={cardDisplay.showCastingNotes}
                        onChange={(v) => setCardDisplay(cd => ({ ...cd, showCastingNotes: v }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedRole === 'all' ? (
            roleNames.filter(r => (characterData[r]?.artists?.length || 0) > 0).length ? (
              roleNames.filter(r => (characterData[r]?.artists?.length || 0) > 0).map(r => (
                <div key={r} className="space-y-2">
                  <h3 className={`text-[11px] font-mono font-bold uppercase tracking-wider border-b pb-1 flex items-center justify-between ${
                    isLight ? 'text-slate-900 border-slate-300' : 'text-amber-400 border-slate-700'
                  }`}>
                    <span>{r}</span>
                    <span className={`text-[9.5px] font-mono px-1.5 py-0.2 border ${isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-[#1a1d27] border-slate-700 text-slate-400'}`}>
                      {characterData[r]?.artists?.length || 0} CANDIDATES
                    </span>
                  </h3>
                  <div className={gridCls}>
                    {characterData[r]!.artists!.map(artist => renderComparisonCard(r, artist))}
                  </div>
                </div>
              ))
            ) : (
              <div className={`p-8 border border-dashed text-center font-mono text-xs ${isLight ? 'border-slate-300 text-slate-400' : 'border-slate-800 text-slate-500'}`}>
                NO CANDIDATES FOUND. CLICK "+ ADD TALENT CHOICE" TO ADD RECORDS.
              </div>
            )
          ) : (
            selectedRole && characterData[selectedRole]?.artists?.length ? (
              <div className={gridCls}>
                {characterData[selectedRole]!.artists!.map(artist => renderComparisonCard(selectedRole, artist))}
              </div>
            ) : (
              <div className={`p-8 border border-dashed text-center font-mono text-xs ${isLight ? 'border-slate-300 text-slate-400' : 'border-slate-800 text-slate-500'}`}>
                NO CANDIDATES FOUND FOR "{selectedRole}". CLICK "+ CANDIDATE" TO ADD RECORDS.
              </div>
            )
          )}
        </div>
        );
      })()}

      {/* =========================================================================
          VIEW MODE 4: SECONDARY CHARACTER DOSSIER (DEMOTED)
      ========================================================================= */}
      {activeViewMode === 'dossier' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
              CHARACTER PROFILE & DOSSIER (SECONDARY ARCHIVE)
            </h2>
            <select
              value={activeRoleName}
              onChange={(e) => setSelectedRole(e.target.value)}
              className={`px-2.5 py-1 border text-xs font-mono outline-none ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181a22] border-slate-700 text-white'
              }`}
            >
              {roleNames.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {activeRoleName && characterData[activeRoleName] ? (() => {
            const char = characterData[activeRoleName];
            const metrics = characterMetrics[activeRoleName] || { sceneCount: 0, dialogueWords: 0 };
            const confirmedArtist = char.artists?.find(a => a.id === char.confirmedArtistId || a.status === 'on_board' || a.status === 'contract_signed');
            const avatarUrl = char.images?.[0] || char.aiImages?.[0];
            const tier = BILLING_TIERS.find(t => t.id === char.billingTier);
            const traitRows: [string, string][] = [
              ['Age', String(char.age ?? '')],
              ['Gender', char.gender || ''],
              ['Ethnicity', char.ethnicity || ''],
              ['Hair', char.hair || ''],
              ['Eyes', char.eyes || ''],
              ['Build', char.build || ''],
            ];
            const overviewChips = [char.archetype, char.occupation, char.height, char.accent].filter(Boolean) as string[];
            const overviewSummary = [char.archetype, char.physiology?.slice(0, 160)].filter(Boolean).join('. ') || '';
            return (
              <div className="flex items-start gap-4 max-w-[1500px] mx-auto">
                {/* LEFT: DOSSIER EDITOR */}
                <div className={`flex-1 min-w-0 border p-4 space-y-3 ${isLight ? 'bg-white border-slate-300' : 'bg-[#13151b] border-slate-800'}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Brain size={13} className="text-amber-500" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500">Character Bible — {activeRoleName}</span>
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9.5px] font-mono uppercase text-slate-500">PLAYING AGE</label>
                      <input
                        type="number"
                        value={char.age || 30}
                        disabled={isLocked}
                        onChange={(e) => updateCharacter(activeRoleName, { age: parseInt(e.target.value) })}
                        className={`w-full p-1.5 border text-xs outline-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#181a22] border-slate-700'} ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    <div>
                      <label className="text-[9.5px] font-mono uppercase text-slate-500">GENDER</label>
                      <input
                        type="text"
                        value={char.gender || ''}
                        disabled={isLocked}
                        onChange={(e) => updateCharacter(activeRoleName, { gender: e.target.value })}
                        className={`w-full p-1.5 border text-xs outline-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#181a22] border-slate-700'} ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    <div>
                      <label className="text-[9.5px] font-mono uppercase text-slate-500">ARCHETYPE</label>
                      <input
                        type="text"
                        value={char.archetype || ''}
                        disabled={isLocked}
                        onChange={(e) => updateCharacter(activeRoleName, { archetype: e.target.value })}
                        className={`w-full p-1.5 border text-xs outline-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#181a22] border-slate-700'} ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9.5px] font-mono uppercase text-slate-500">CHARACTER BACKSTORY</label>

                    {/* Text style toolbar */}
                    <div className={`flex flex-wrap items-center gap-1 p-1.5 border border-b-0 mt-1.5 ${isLocked ? 'opacity-50' : ''} ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#181a22] border-slate-700'}`}>
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

                    {/* Full rich-text content, mirroring the writer's editor */}
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
                </div>

                {/* RIGHT: CHARACTER OVERVIEW CARD */}
                <aside className="w-[370px] shrink-0 space-y-4 sticky top-0">
                  <div className={`border overflow-hidden ${isLight ? 'bg-white border-slate-300' : 'bg-[#13151b] border-slate-800'}`}>
                    <div className="h-1.5 bg-amber-500" />
                    <div className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">CHARACTER OVERVIEW</div>
                          <h3 className="font-mono font-bold text-lg uppercase tracking-tight text-amber-500 truncate">{activeRoleName}</h3>
                        </div>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 border uppercase shrink-0 ${
                          tier?.[isLight ? 'badgeLight' : 'badge'] || 'bg-slate-800 text-slate-300'
                        }`}>
                          {tier?.label || 'Supporting Role'}
                        </span>
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
                              <span className={`truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{value || '—'}</span>
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
                </aside>
              </div>
            );
          })() : (
            <div className="p-6 border border-dashed text-center font-mono text-xs text-slate-500">
              SELECT A ROLE TO EDIT DOSSIER
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          CANDIDATE EDIT / CREATE POPUP MODAL WITH ALL ESSENTIAL OPTIONS
      ========================================================================= */}
      {isCandidateModalOpen && editingArtistData && (
        <div className="fixed inset-0 bg-slate-950/75 z-[9999] flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl border shadow-2xl flex flex-col max-h-[92vh] ${
            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#13151c] border-slate-800 text-slate-100'
          }`}>
            
            {/* Modal Header */}
            <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#191c26] border-slate-800'
            }`}>
              <div className="flex items-center gap-2 flex-wrap">
                <UserCheck size={18} className="text-amber-500" />
                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-mono font-black uppercase">
                  CANDIDATE #{editingArtistData.artist.rank || 1}
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  {editingArtistData.isNew ? '• ADD NEW CANDIDATE' : `• EDIT RECORD: ${editingArtistData.artist.name}`}
                </h3>
              </div>

              <button
                onClick={() => { setIsCandidateModalOpen(false); setEditingArtistData(null); }}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              
              {/* Row 1: Candidate Name, Assigned Role, Pipeline Stage */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[9.5px] font-mono uppercase text-slate-500 font-bold flex items-center justify-between">
                    <span>Candidate Full Name *</span>
                    {editingArtistData.artist.photoUrl && (
                      <button
                        type="button"
                        onClick={() => triggerActorRecognition(editingArtistData.artist.photoUrl, true)}
                        disabled={isIdentifying}
                        className="text-[9px] text-amber-500 hover:text-amber-400 flex items-center gap-1 uppercase disabled:opacity-50 font-bold"
                      >
                        <Brain size={10} />
                        {isIdentifying ? 'Scanning...' : 'AI Scan Actor Name'}
                      </button>
                    )}
                  </label>
                  <input
                    type="text"
                    value={editingArtistData.artist.name}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: { ...prev.artist, name: e.target.value }
                    } : null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const q = editingArtistData.artist.name.trim();
                        if (q) {
                          setImageSearchQuery(q);
                          setIsGoogleImageModalOpen(true);
                          handleSearchActorImages(q);
                        }
                      }
                    }}
                    placeholder="Type name & press Enter to Google image search..."
                    className={`w-full p-2 border text-xs font-bold outline-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#1a1d28] border-slate-700'}`}
                  />
                </div>


                <div>
                  <label className="text-[9.5px] font-mono uppercase text-amber-500 font-bold">Auditioning Role *</label>
                  <select
                    value={editingArtistData.targetRole || editingArtistData.charName}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      targetRole: e.target.value
                    } : null)}
                    className={`w-full p-2 border text-xs font-bold outline-none cursor-pointer ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#1a1d28] border-slate-700'}`}
                  >
                    {roleNames.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9.5px] font-mono uppercase text-slate-500 font-bold">Pipeline Stage *</label>
                  <select
                    value={editingArtistData.artist.status}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: { ...prev.artist, status: e.target.value as any }
                    } : null)}
                    className={`w-full p-2 border text-xs font-bold outline-none cursor-pointer ${isLight ? 'bg-slate-50 border-slate-300 text-amber-600' : 'bg-[#1a1d28] border-slate-700 text-amber-400'}`}
                  >
                    {PIPELINE_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>



              {/* Headshots Gallery & Main Photo Selector Dropzone */}
              <div 
                onDragOver={handleDropzoneDragOver}
                onDragLeave={handleDropzoneDragLeave}
                onDrop={handleDropzoneDrop}
                className={`p-3.5 border space-y-3 transition-all relative ${
                  isDraggingOverDropzone
                    ? 'border-2 border-dashed border-amber-400 bg-amber-500/15 scale-[1.01]'
                    : (isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1d28] border-slate-800')
                }`}
              >
                {isDraggingOverDropzone && (
                  <div className="absolute inset-0 bg-amber-500/20 flex flex-col items-center justify-center pointer-events-none z-10 font-mono font-bold text-amber-400 text-xs">
                    <Upload size={24} className="animate-bounce mb-1" />
                    <span>DROP HEADSHOT IMAGE HERE</span>
                  </div>
                )}
                
                {/* Primary Hero Actions: Search & Upload */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-[11px] font-mono font-bold uppercase text-amber-500 flex items-center gap-1.5">
                    <ImageIcon size={14} />
                    <span>Headshot Portfolio & Spotlight Picture</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const q = imageSearchQuery || (editingArtistData?.artist?.name && !editingArtistData.artist.name.startsWith('Candidate') ? editingArtistData.artist.name : '');
                        setImageSearchQuery(q);
                        setIsGoogleImageModalOpen(true);
                        if (q) handleSearchActorImages(q);
                      }}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Search size={14} />
                      <span>Search Google Images</span>
                    </button>

                    <label className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-mono font-bold cursor-pointer transition-colors flex items-center gap-1.5">
                      <Upload size={14} />
                      <span>+ Upload Headshots</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) handleArtistPhotosUpload(e.target.files);
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Primary Drag & Drop Banner Area */}
                <div className={`p-4 border-2 border-dashed text-center font-mono space-y-1 transition-colors ${
                  isLight ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-700 bg-[#12141a] text-slate-300'
                }`}>
                  <div className="flex items-center justify-center gap-2 font-bold text-xs text-amber-400">
                    <Upload size={16} />
                    <span>DRAG & DROP HEADSHOT IMAGES HERE</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Drag photo files from your computer or web images directly onto this card
                  </div>
                </div>

                {/* Secondary Option: Direct Image URL Paste */}
                <details className="pt-1 text-[10px] font-mono text-slate-400">
                  <summary className="cursor-pointer hover:text-slate-200 select-none">
                    Alternative Option: Paste Direct Image URL
                  </summary>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="text"
                      placeholder="Paste image web URL..."
                      value={newWebPhotoUrl}
                      onChange={(e) => setNewWebPhotoUrl(e.target.value)}
                      className={`flex-1 p-1.5 border text-xs font-mono outline-none ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newWebPhotoUrl) {
                          handleAddPhotoFromUrl(newWebPhotoUrl);
                          setNewWebPhotoUrl('');
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-mono font-bold border ${isLight ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'}`}
                    >
                      Add URL
                    </button>
                  </div>
                </details>


                {/* Headshots Grid */}
                {(() => {
                  const currentPhotos = editingArtistData.artist.photos && editingArtistData.artist.photos.length > 0
                    ? editingArtistData.artist.photos
                    : (editingArtistData.artist.photoUrl ? [editingArtistData.artist.photoUrl] : []);

                  if (currentPhotos.length === 0) return null;
                  return (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
                      {currentPhotos.map((photo, pIdx) => {
                        const isMain = photo === editingArtistData.artist.photoUrl;
                        return (
                          <div
                            key={pIdx}
                            onClick={() => handleSetMainArtistPhoto(photo)}
                            className={`relative aspect-square border-2 overflow-hidden cursor-pointer group bg-slate-900 ${
                              isMain ? 'border-amber-400 ring-2 ring-amber-500/40' : 'border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            <img src={photo} alt="" className="w-full h-full object-cover" />
                            {isMain && (
                              <div className="absolute top-1 left-1 bg-amber-400 text-slate-950 font-mono font-bold text-[8px] px-1 uppercase">
                                MAIN
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveArtistPhoto(photo);
                              }}
                              className="absolute top-1 right-1 p-1 bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              {/* Rating & Key Dates */}
              <div className={`p-2.5 border space-y-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1d28] border-slate-800'}`}>
                <div className="text-[10px] font-mono font-bold uppercase text-amber-500 flex items-center gap-1.5">
                  <Award size={12} />
                  <span>Rating & Key Dates</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                  <div>
                    <label className="text-[8.5px] font-mono uppercase text-slate-500">Talent Rating</label>
                    <div className="flex items-center gap-0.5 mt-1">
                      {Array.from({ length: 10 }, (_, idx) => idx + 1).map(i => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setEditingArtistData(prev => prev ? {
                            ...prev,
                            artist: { ...prev.artist, rating: prev.artist.rating === i ? undefined : i }
                          } : null)}
                          className="p-0 hover:scale-110 transition-transform"
                          title={`${i} star${i !== 1 ? 's' : ''}`}
                        >
                          <Star
                            size={15}
                            className={i <= (editingArtistData.artist.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-600 hover:text-slate-500'}
                          />
                        </button>
                      ))}
                      <span className="text-[9px] font-mono text-slate-500 ml-0.5">
                        {editingArtistData.artist.rating ? `${editingArtistData.artist.rating}/10` : ''}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[8.5px] font-mono uppercase text-slate-500">Audition</label>
                    <input
                      type="date"
                      value={editingArtistData.artist.auditionDate || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: { ...prev.artist, auditionDate: e.target.value }
                      } : null)}
                      className={`w-full py-1 px-1.5 border text-[10px] font-mono outline-none ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    />
                  </div>

                  <div>
                    <label className="text-[8.5px] font-mono uppercase text-slate-500">Callback</label>
                    <input
                      type="date"
                      value={editingArtistData.artist.callbackDate || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: { ...prev.artist, callbackDate: e.target.value }
                      } : null)}
                      className={`w-full py-1 px-1.5 border text-[10px] font-mono outline-none ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    />
                  </div>

                  <div>
                    <label className="text-[8.5px] font-mono uppercase text-slate-500">Offer</label>
                    <input
                      type="date"
                      value={editingArtistData.artist.offerDate || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: { ...prev.artist, offerDate: e.target.value }
                      } : null)}
                      className={`w-full py-1 px-1.5 border text-[10px] font-mono outline-none ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    />
                  </div>
                </div>

              </div>

              </div>              {/* Representation Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[9.5px] font-mono uppercase text-slate-500">Agency Name</label>
                  <input
                    type="text"
                    placeholder="e.g. CAA / WME / UTA / Independent"
                    value={editingArtistData.artist.contact?.agency || ''}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: {
                        ...prev.artist,
                        contact: { ...(prev.artist.contact || {}), agency: e.target.value }
                      }
                    } : null)}
                    className={`w-full p-2 border text-xs outline-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#1a1d28] border-slate-700'}`}
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-mono uppercase text-slate-500">Agent Name</label>
                  <input
                    type="text"
                    placeholder="Agent name..."
                    value={editingArtistData.artist.contact?.agentName || ''}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: {
                        ...prev.artist,
                        contact: { ...(prev.artist.contact || {}), agentName: e.target.value }
                      }
                    } : null)}
                    className={`w-full p-2 border text-xs outline-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#1a1d28] border-slate-700'}`}
                  />
                </div>
              </div>

              {/* Secondary Contact Grid: Agent Phone/Email & Manager */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[9.5px] font-mono uppercase text-slate-500">Agent Phone</label>
                  <input
                    type="text"
                    placeholder="Agent phone..."
                    value={editingArtistData.artist.contact?.agentPhone || ''}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: {
                        ...prev.artist,
                        contact: { ...(prev.artist.contact || {}), agentPhone: e.target.value }
                      }
                    } : null)}
                    className={`w-full p-2 border text-xs outline-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#1a1d28] border-slate-700'}`}
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-mono uppercase text-slate-500">Agent Email</label>
                  <input
                    type="email"
                    placeholder="agent@agency.com..."
                    value={editingArtistData.artist.contact?.agentEmail || ''}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: {
                        ...prev.artist,
                        contact: { ...(prev.artist.contact || {}), agentEmail: e.target.value }
                      }
                    } : null)}
                    className={`w-full p-2 border text-xs outline-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#1a1d28] border-slate-700'}`}
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-mono uppercase text-slate-500">Manager Name</label>
                  <input
                    type="text"
                    placeholder="Manager name..."
                    value={editingArtistData.artist.contact?.managerName || ''}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: {
                        ...prev.artist,
                        contact: { ...(prev.artist.contact || {}), managerName: e.target.value }
                      }
                    } : null)}
                    className={`w-full p-2 border text-xs outline-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#1a1d28] border-slate-700'}`}
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-mono uppercase text-slate-500">Manager Phone</label>
                  <input
                    type="text"
                    placeholder="Manager phone..."
                    value={editingArtistData.artist.contact?.managerPhone || ''}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: {
                        ...prev.artist,
                        contact: { ...(prev.artist.contact || {}), managerPhone: e.target.value }
                      }
                    } : null)}
                    className={`w-full p-2 border text-xs outline-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#1a1d28] border-slate-700'}`}
                  />
                </div>
              </div>

              {/* Links: Video Reel / IMDb */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[9.5px] font-mono uppercase text-slate-500">Self-Tape / Reel Video Link</label>
                  <input
                    type="text"
                    placeholder="https://vimeo.com/... or YouTube link"
                    value={editingArtistData.artist.auditionUrl || ''}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: { ...prev.artist, auditionUrl: e.target.value }
                    } : null)}
                    className={`w-full p-2 border text-xs outline-none ${isLight ? 'bg-slate-50 border-slate-300 text-cyan-700' : 'bg-[#1a1d28] border-slate-700 text-cyan-400'}`}
                  />
                </div>

                <div>
                  <label className="text-[9.5px] font-mono uppercase text-slate-500">IMDb / Portfolio Link</label>
                  <input
                    type="text"
                    placeholder="https://imdb.com/name/nm..."
                    value={editingArtistData.artist.imdbUrl || ''}
                    onChange={(e) => setEditingArtistData(prev => prev ? {
                      ...prev,
                      artist: { ...prev.artist, imdbUrl: e.target.value }
                    } : null)}
                    className={`w-full p-2 border text-xs outline-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#1a1d28] border-slate-700'}`}
                  />
                </div>
              </div>

              {/* Casting Notes */}
              <div>
                <label className="text-[9.5px] font-mono uppercase text-slate-500">Casting Notes & Feedback</label>
                <textarea
                  rows={3}
                  value={editingArtistData.artist.notes || ''}
                  onChange={(e) => setEditingArtistData(prev => prev ? {
                    ...prev,
                    artist: { ...prev.artist, notes: e.target.value }
                  } : null)}
                  className={`w-full p-2.5 border text-xs outline-none resize-none ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-[#1a1d28] border-slate-700'}`}
                  placeholder="Notes on auditions, availability, chemistry reads, director feedback..."
                />
              </div>

              {/* Salary, Fee Quote & Union Agreements */}
              <div className={`p-3.5 border space-y-3 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1d28] border-slate-800'}`}>
                <div className="text-[11px] font-mono font-bold uppercase text-emerald-500 flex items-center gap-1.5">
                  <IndianRupee size={14} />
                  <span>Salary, Fee Quote & Union Agreements</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9.5px] font-mono uppercase text-slate-500">Salary / Fee Quote (₹)</label>
                    <input
                      type="text"
                      placeholder="e.g. ₹5,00,000 or ₹25,00/day"
                      value={editingArtistData.artist.dealTerms?.feeQuote || editingArtistData.artist.feeQuote || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          feeQuote: e.target.value,
                          dealTerms: { ...(prev.artist.dealTerms || { feeType: 'weekly', sagTier: '' }), feeQuote: e.target.value }
                        }
                      } : null)}
                      className={`w-full p-2 border text-xs font-mono font-bold outline-none ${isLight ? 'bg-white border-slate-300 text-emerald-700' : 'bg-[#12141a] border-slate-700 text-emerald-400'}`}
                    />
                  </div>

                  <div>
                    <label className="text-[9.5px] font-mono uppercase text-slate-500">Salary Structure Type</label>
                    <select
                      value={editingArtistData.artist.dealTerms?.feeType || 'weekly'}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          dealTerms: { ...(prev.artist.dealTerms || { feeQuote: '', sagTier: '' }), feeType: e.target.value as any }
                        }
                      } : null)}
                      className={`w-full p-2 border text-xs font-mono outline-none cursor-pointer ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    >
                      {FEE_TYPES.map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9.5px] font-mono uppercase text-slate-500">Union / Guild Tier</label>
                    <select
                      value={editingArtistData.artist.dealTerms?.sagTier || SAG_TIERS[0]}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          dealTerms: { ...(prev.artist.dealTerms || { feeQuote: '', feeType: 'weekly' }), sagTier: e.target.value }
                        }
                      } : null)}
                      className={`w-full p-2 border text-xs font-mono outline-none cursor-pointer ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    >
                      {SAG_TIERS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-slate-800/50">
                  <div>
                    <label className="text-[9.5px] font-mono uppercase text-slate-500">Billing Guarantee</label>
                    <input
                      type="text"
                      placeholder="e.g. Above title / Below title / Co-star"
                      value={editingArtistData.artist.dealTerms?.billingGuarantee || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          dealTerms: { ...(prev.artist.dealTerms || { feeQuote: '', feeType: 'weekly', sagTier: '' }), billingGuarantee: e.target.value }
                        }
                      } : null)}
                      className={`w-full p-2 border text-xs font-mono outline-none ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    />
                  </div>

                  <div>
                    <label className="text-[9.5px] font-mono uppercase text-slate-500">Travel / Per Diem</label>
                    <input
                      type="text"
                      placeholder="e.g. ₹5,000/day + first class travel"
                      value={editingArtistData.artist.dealTerms?.travelPerDiem || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          dealTerms: { ...(prev.artist.dealTerms || { feeQuote: '', feeType: 'weekly', sagTier: '' }), travelPerDiem: e.target.value }
                        }
                      } : null)}
                      className={`w-full p-2 border text-xs font-mono outline-none ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    />
                  </div>

                  <div>
                    <label className="text-[9.5px] font-mono uppercase text-slate-500">Rider Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Vanity trailer, hair & makeup lead, no wetting..."
                      value={editingArtistData.artist.dealTerms?.riderNotes || ''}
                      onChange={(e) => setEditingArtistData(prev => prev ? {
                        ...prev,
                        artist: {
                          ...prev.artist,
                          dealTerms: { ...(prev.artist.dealTerms || { feeQuote: '', feeType: 'weekly', sagTier: '' }), riderNotes: e.target.value }
                        }
                      } : null)}
                      className={`w-full p-2 border text-xs font-mono outline-none ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                    />
                  </div>
                </div>
              </div>

              {/* Availability Window (subtle, collapsed by default) */}
              <details className={`border ${isLight ? 'bg-slate-50/50 border-slate-200' : 'bg-[#13151b]/40 border-slate-800/70'}`}>
                <summary className="px-3 py-2 cursor-pointer select-none flex items-center justify-between gap-2 text-[9.5px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    Availability Window
                    {editingArtistData.artist.availability?.isConfirmedAvailable && (
                      <span className="text-emerald-500 font-bold">✓ Confirmed</span>
                    )}
                  </span>
                  <span className="text-slate-500">▾</span>
                </summary>
                <div className="px-3 py-3 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9.5px] font-mono uppercase text-slate-500">Available From</label>
                      <input
                        type="date"
                        value={editingArtistData.artist.availability?.availableFrom || ''}
                        onChange={(e) => setEditingArtistData(prev => prev ? {
                          ...prev,
                          artist: {
                            ...prev.artist,
                            availability: { ...(prev.artist.availability || {}), availableFrom: e.target.value }
                          }
                        } : null)}
                        className={`w-full p-2 border text-xs font-mono outline-none ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                      />
                    </div>

                    <div>
                      <label className="text-[9.5px] font-mono uppercase text-slate-500">Available To</label>
                      <input
                        type="date"
                        value={editingArtistData.artist.availability?.availableTo || ''}
                        onChange={(e) => setEditingArtistData(prev => prev ? {
                          ...prev,
                          artist: {
                            ...prev.artist,
                            availability: { ...(prev.artist.availability || {}), availableTo: e.target.value }
                          }
                        } : null)}
                        className={`w-full p-2 border text-xs font-mono outline-none ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                      />
                    </div>

                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-[10px] font-mono uppercase text-slate-500 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(editingArtistData.artist.availability?.isConfirmedAvailable)}
                          onChange={(e) => setEditingArtistData(prev => prev ? {
                            ...prev,
                            artist: {
                              ...prev.artist,
                              availability: { ...(prev.artist.availability || {}), isConfirmedAvailable: e.target.checked }
                            }
                          } : null)}
                          className="accent-emerald-500 w-4 h-4"
                        />
                        <span className={editingArtistData.artist.availability?.isConfirmedAvailable ? 'text-emerald-500' : ''}>
                          Availability Confirmed
                        </span>
                      </label>
                    </div>

                    <div className="md:col-span-3">
                      <label className="text-[9.5px] font-mono uppercase text-slate-500">Blackout / Hold Dates Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Blocked Dec 20-28, prior commitment on weekends..."
                        value={editingArtistData.artist.availability?.blackoutNotes || ''}
                        onChange={(e) => setEditingArtistData(prev => prev ? {
                          ...prev,
                          artist: {
                            ...prev.artist,
                            availability: { ...(prev.artist.availability || {}), blackoutNotes: e.target.value }
                          }
                        } : null)}
                        className={`w-full p-2 border text-xs font-mono outline-none ${isLight ? 'bg-white border-slate-300' : 'bg-[#12141a] border-slate-700'}`}
                      />
                    </div>
                  </div>
                </div>
              </details>

            </div>

            {/* Modal Footer with Actions */}
            <div className={`p-4 border-t flex items-center justify-between gap-3 shrink-0 ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#191c26] border-slate-800'
            }`}>
              <div className="flex items-center gap-2">
                {!editingArtistData.isNew && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete candidate "${editingArtistData.artist.name}"?`)) {
                        handleDeleteArtist(editingArtistData.charName, editingArtistData.artist.id);
                        setIsCandidateModalOpen(false);
                        setEditingArtistData(null);
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-800 text-rose-300 border border-rose-800/80 text-xs font-mono font-bold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Delete Candidate</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setIsCandidateModalOpen(false); setEditingArtistData(null); }}
                  className={`px-3.5 py-1.5 text-xs font-mono border ${isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-[#12141a] border-slate-700 text-slate-300'}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCandidateModal}
                  className="px-5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs uppercase tracking-wider"
                >
                  {editingArtistData.isNew ? 'Save New Candidate' : 'Save Changes'}
                </button>
                {/* =========================================================================
          IN-APP GOOGLE IMAGE SEARCH SUB-MODAL POPUP OVERLAY
      ========================================================================= */}
      {isGoogleImageModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 z-[10000] flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl border shadow-2xl flex flex-col max-h-[85vh] ${
            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#12141c] border-slate-800 text-slate-100'
          }`}>
            {/* Modal Header */}
            <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181b26] border-slate-800'
            }`}>
              <div className="flex items-center gap-2">
                <Search size={18} className="text-amber-500" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider">
                  GOOGLE IMAGE SEARCH (IN-APP SELECTOR)
                </h3>
              </div>

              <button
                onClick={() => setIsGoogleImageModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Controls Header */}
            <div className={`p-4 border-b flex items-center gap-3 shrink-0 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#151722] border-slate-800/80'
            }`}>
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  placeholder="Type actor name (e.g. Brad Pitt, Deepika Padukone)..."
                  value={imageSearchQuery}
                  onChange={(e) => setImageSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchActorImages()}
                  className={`w-full px-3 py-2 border text-xs font-mono font-bold outline-none ${
                    isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0d0e13] border-slate-700 text-white'
                  }`}
                  autoFocus
                />
              </div>

              <button
                onClick={() => handleSearchActorImages()}
                disabled={isSearchingImages}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Search size={14} />
                <span>{isSearchingImages ? 'Searching...' : 'Search Images'}</span>
              </button>
            </div>

            {/* Results Body */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
              {isSearchingImages ? (
                <div className="py-16 text-center space-y-2 font-mono text-xs text-amber-500">
                  <RefreshCw size={24} className="animate-spin mx-auto" />
                  <div>Searching Google & Web Images for "{imageSearchQuery}"...</div>
                </div>
              ) : imageSearchResults.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-slate-400">
                      FOUND {imageSearchResults.length} IMAGES. SELECT ONE OR MORE:
                    </span>
                    <span className="text-[11px] font-mono font-bold text-amber-400">
                      {selectedSearchImages.length} SELECTED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {imageSearchResults.map((imgUrl, idx) => {
                      const isSelected = selectedSearchImages.includes(imgUrl);
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedSearchImages(prev =>
                              prev.includes(imgUrl)
                                ? prev.filter(x => x !== imgUrl)
                                : [...prev, imgUrl]
                            );
                          }}
                          className={`relative aspect-square border-2 overflow-hidden cursor-pointer group bg-slate-800 transition-all ${
                            isSelected ? 'border-amber-400 scale-95 ring-4 ring-amber-500/40' : 'border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Hide the entire tile on broken images
                              const tile = (e.currentTarget as HTMLImageElement).closest<HTMLDivElement>('.aspect-square');
                              if (tile) tile.style.display = 'none';
                            }}
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-amber-500/30 flex items-center justify-center">
                              <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                                <Check size={16} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center font-mono text-xs text-slate-500">
                  ENTER AN ACTOR'S NAME AND CLICK SEARCH TO FIND HEADSHOTS.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t flex items-center justify-between shrink-0 ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181b26] border-slate-800'
            }`}>
              <div className="text-xs font-mono text-slate-400">
                {selectedSearchImages.length > 0 ? `${selectedSearchImages.length} photo(s) selected` : 'No photos selected'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGoogleImageModalOpen(false)}
                  className={`px-3.5 py-1.5 text-xs font-mono border ${isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-[#12141a] border-slate-700 text-slate-300'}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddSelectedSearchImages}
                  disabled={selectedSearchImages.length === 0}
                  className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import Selected Photos ({selectedSearchImages.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          SIMPLE PRINT SHEET (hidden on screen, shown only when printing)
      ========================================================================= */}
      {createPortal(
        <div id="casting-print-sheet">
          <style>{`
            #casting-print-sheet { display: none; }
            @media print {
              @page { size: ${printSettings.pageSize} ${printSettings.orientation}; margin: ${printSettings.margins === 'sm' ? 8 : printSettings.margins === 'lg' ? 18 : 12}mm; }
              ${printSettings.showPageNumbers ? `@page { @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9px; font-family: Arial, Helvetica, sans-serif; color: #555; } }` : ''}
              body * { visibility: hidden; }
              #casting-print-sheet, #casting-print-sheet * { visibility: visible !important; }
              #casting-print-sheet {
                display: block !important;
                position: absolute !important;
                top: 0; left: 0; width: 100%;
                background: #fff; color: #000;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                font-family: Arial, Helvetica, sans-serif;
                font-size: ${printSettings.fontSize === 'sm' ? 11 : printSettings.fontSize === 'lg' ? 15 : 13}px;
                padding: 20px 24px; box-sizing: border-box;
                ${printSettings.colorMode === 'grayscale' ? 'filter: grayscale(1);' : ''}
              }
              #casting-print-sheet h2 { margin: 0 0 2px; font-size: 1.5em; text-transform: uppercase; }
              #casting-print-sheet .cp-meta { font-size: 1em; color: #333; margin-bottom: 12px; }
              #casting-print-sheet .cp-section { font-weight: bold; margin: 12px 0 5px; font-size: 1.15em; }
              #casting-print-sheet table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              #casting-print-sheet th, #casting-print-sheet td { border: ${printSettings.tableBorders ? '1px solid #000' : 'none'}; padding: 6px 8px; font-size: 1em; text-align: left; }
              #casting-print-sheet th { background: ${printSettings.headerStyle === 'black' ? '#000' : printSettings.headerStyle === 'gray' ? '#eee' : 'transparent'}; color: ${printSettings.headerStyle === 'black' ? '#fff' : '#000'}; font-weight: bold; }
              ${printSettings.zebraStripes ? '#casting-print-sheet tbody tr:nth-child(even) td { background: #f3f3f3; }' : ''}
              #casting-print-sheet td.c { text-align: center; }
              #casting-print-sheet tr { page-break-inside: avoid; }
              #casting-print-sheet img.cp-photo { width: ${printSettings.photoSize === 'sm' ? 4 : printSettings.photoSize === 'lg' ? 7 : 5.5}em; height: ${printSettings.photoSize === 'sm' ? 4 : printSettings.photoSize === 'lg' ? 7 : 5.5}em; object-fit: cover; border: ${printSettings.tableBorders ? '1px solid #000' : 'none'}; }
            }
          `}</style>

          {printSettings.showTitle && (
            <>
              <h2>{printSettings.titleText || 'Casting Pipeline & Progress Report'}</h2>
              <div className="cp-meta">
                Project: {projectList.find(p => p.id === currentProjectId)?.name || '—'} &nbsp;·&nbsp; {new Date().toLocaleDateString()}
                {printSettings.productionHouse && <> &nbsp;·&nbsp; Production House: {printSettings.productionHouse}</>}
                {printSettings.directorName && <> &nbsp;·&nbsp; Director: {printSettings.directorName}</>}
              </div>
            </>
          )}

          {printSettings.includeRolesTable && (
            <>
              <div className="cp-section">Roles & Casting Status{printSettings.showCountsInHeaders ? ` (${roleNames.length} roles · ${stats.confirmedCast} cast · ${stats.percentCast}%)` : ''}</div>
              <table>
                <thead>
                  <tr>
                    {ROLES_PRINT_COLUMNS.filter(c => printSettings.rolesColumns[c.key]).map(c => (
                      <th key={c.key} className={c.key === 'scenes' || c.key === 'words' || c.key === 'candidates' ? 'c' : ''}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roleNames.filter(roleName =>
                    printSettings.includeEmptyRoles || (characterData[roleName]?.artists?.length || 0) > 0
                  ).map(roleName => {
                    const char = characterData[roleName];
                    const metrics = characterMetrics[roleName] || { sceneCount: 0, dialogueWords: 0 };
                    const confirmedArtist = char?.artists?.find(a => a.id === char.confirmedArtistId || a.status === 'on_board' || a.status === 'contract_signed');
                    const cells: Record<string, React.ReactNode> = {
                      role: roleName,
                      tier: BILLING_TIERS.find(t => t.id === char?.billingTier)?.label || char?.billingTier || 'Supporting',
                      scenes: <span className="c">{metrics.sceneCount}</span>,
                      words: <span className="c">{metrics.dialogueWords}</span>,
                      candidates: <span className="c">{char?.artists?.length || 0}</span>,
                      confirmed: confirmedArtist ? confirmedArtist.name : '',
                    };
                    return (
                      <tr key={roleName}>
                        {ROLES_PRINT_COLUMNS.filter(c => printSettings.rolesColumns[c.key]).map(c => (
                          <td key={c.key}>{cells[c.key]}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {printSettings.includePipelineTable && (() => {
            const filteredCandidates = printSettings.pipelineStatusFilter === 'all'
              ? allCandidatesList
              : allCandidatesList.filter(({ artist }) => artist.status === printSettings.pipelineStatusFilter);
            const filterLabel = PIPELINE_STAGES.find(s => s.id === printSettings.pipelineStatusFilter)?.label;
            return (
            <>
              <div className="cp-section">
                {printSettings.pipelineStatusFilter === 'all' ? 'Pipeline — All Candidates by Stage' : `Pipeline — ${filterLabel}`}
                {printSettings.showCountsInHeaders ? ` (${filteredCandidates.length} candidates)` : ''}
              </div>
              <table>
                <thead>
                  <tr>
                    {PIPELINE_PRINT_COLUMNS.filter(c => printSettings.pipelineColumns[c.key]).map(c => (
                      <th key={c.key} className={c.key === 'photo' ? 'c' : ''}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map(({ charName, artist }, idx) => {
                    const cells: Record<string, React.ReactNode> = {
                      no: <span className="c">{idx + 1}</span>,
                      photo: artist.photoUrl ? <img className="cp-photo" src={artist.photoUrl} alt="" /> : '',
                      candidate: <span className="font-bold uppercase">{artist.name}</span>,
                      role: charName,
                      stage: PIPELINE_STAGES.find(s => s.id === artist.status)?.label || artist.status,
                      agency: artist.contact?.agency || '—',
                      fee: artist.feeQuote || artist.dealTerms?.feeQuote || '—',
                    };
                    return (
                      <tr key={artist.id}>
                        {PIPELINE_PRINT_COLUMNS.filter(c => printSettings.pipelineColumns[c.key]).map(c => (
                          <td key={c.key} className={c.key === 'photo' || c.key === 'no' ? 'c' : ''}>{cells[c.key]}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
            );
          })()}
        </div>,
        document.body
      )}

    </div>
  );
};

export default CastingView;
