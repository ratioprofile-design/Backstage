import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { isTauri, getTauriFs, getTauriDialog } from '../../utils/desktop';
import { addRecentFile } from '../../utils/recentFiles';
import { ScriptConfig } from '../../types';
import { 
  Save, Upload, Printer, 
  Bold, Italic, Underline, Type, 
  MoveVertical, MoveHorizontal, Settings as SettingsIcon, Eye, Check,
  Highlighter, Sliders, Keyboard, Image as ImageIcon,
  LogOut, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Layers, ArrowUp, ArrowDown, Monitor, Box, 
  Minus, Plus, FileText, ScrollText,
  MousePointer2, ALargeSmall, Globe, Video, Music,
  BoxSelect, Scan, Grid, Zap, Cloud, AlertTriangle, RefreshCw, Wand2,
  Moon, Sun, Coffee, Download, XCircle, Sparkles, Wifi, ShieldCheck, ShieldAlert,
  Key, Cpu, ListChecks, StickyNote, List, Hash, RotateCw, CheckSquare, Quote, WifiOff,
  Palette, Languages, CheckCircle2, ChevronRight, Folder, Pipette, Layout, X,
  Users, UserPlus, Mail, Trash2, CheckCheck, Link2
} from 'lucide-react';
import PrintPreviewModal from '../PrintPreviewModal';
import { 
    AVAILABLE_IMAGE_MODELS, AVAILABLE_TEXT_MODELS, GEMINI_TEXT_MODELS,
    VISUAL_STYLES, NOTE_FONTS, AVAILABLE_ENGLISH_FONTS, AVAILABLE_TAMIL_FONTS,
    ACCENT_COLORS, APP_LANGUAGES, BREAKDOWN_LANGUAGES
} from '../../constants';
import { BlockEditor } from '../BlockEditor';
import { isSupabaseConfigured, supabase, inviteUserToProject } from '../../services/supabase';
import { testApiKey, testGrokKey } from '../../services/gemini';
import { useAiKeyStatus } from '../../context/AiKeyStatusContext';
import { ThemeAnimationSelector } from '../ThemeAnimationSelector';
import { translateUi } from '../../services/appTranslations';

const TEXT_COLORS = [
  { name: 'Black', value: '#000000', class: 'bg-black' },
  { name: 'Charcoal', value: '#333333', class: 'bg-[#333]' },
  { name: 'Midnight Blue', value: '#1e3a8a', class: 'bg-blue-900' },
  { name: 'Dark Green', value: '#14532d', class: 'bg-green-900' },
  { name: 'Maroon', value: '#7f1d1d', class: 'bg-red-900' },
];

const MARKDOWN_COLORS = [
    { name: 'White', value: '#ffffff', class: 'bg-white' },
    { name: 'Gray', value: '#9ca3af', class: 'bg-gray-400' },
    { name: 'Orange', value: '#f5a623', class: 'bg-[#f5a623]' },
    { name: 'Blue', value: '#3b82f6', class: 'bg-blue-500' },
    { name: 'Green', value: '#22c55e', class: 'bg-green-500' },
    { name: 'Red', value: '#ef4444', class: 'bg-red-500' },
    { name: 'Purple', value: '#a855f7', class: 'bg-purple-500' },
];

const BOUND_COLORS = [
    { name: 'Slate', value: '#000000' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Orange', value: '#f5a623' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#a855f7' },
];

const PREVIEW_CONTENT = `
<div class="nl-block nl-h1">Project Notes</div>
<div class="nl-block">This is a standard <b>paragraph block</b> in the scratchpad.</div>
<div class="nl-block nl-h2">Character Ideas</div>
<div class="nl-block nl-num">Protagonist flaw: <i>arrogance</i></div>
<div class="nl-block nl-num">Antagonist motive: <i>survival</i></div>
<div class="nl-block nl-quote">This is a callout block used for quotes or emphasis.</div>
<div class="nl-block nl-check">Unchecked task</div>
<div class="nl-block nl-check nl-checked">Completed task</div>
`;

// --- HELPER COMPONENTS ---

const SidebarItem = ({ active, onClick, icon: Icon, label, desc, accentColor = '#f5a623' }: any) => (
  <button
    onClick={onClick}
    style={{
      borderLeftColor: active ? accentColor : 'transparent',
    }}
    className={`w-full text-left px-4 py-3 rounded-none border-l-2 transition-all flex items-center gap-3 ${
      active ? 'bg-[#151515] text-white font-bold' : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#111]'
    }`}
  >
    <Icon size={16} style={{ color: active ? accentColor : undefined }} className={active ? '' : 'text-gray-500'} />
    <div className="flex-1 min-w-0">
      <div className="text-xs font-bold uppercase tracking-wider truncate">{label}</div>
      {desc && <div className="text-[9px] text-gray-500 font-mono mt-0.5 opacity-70 truncate">{desc}</div>}
    </div>
  </button>
);

const ViewContainer = ({ title, subtitle, children }: any) => {
  const { appLanguage } = useProject();
  const localizedTitle = translateUi(title, appLanguage);
  const localizedSubtitle = subtitle ? translateUi(subtitle, appLanguage) : '';
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 animate-in fade-in duration-300">
      <div className="max-w-5xl mx-auto">
          <div className="mb-8 pb-4 border-b border-[#222]">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-1">{localizedTitle}</h3>
              {localizedSubtitle && <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">{localizedSubtitle}</p>}
          </div>
          {children}
      </div>
    </div>
  );
};

const LargeActionCard = ({ onClick, icon: Icon, title, desc, accent, disabled, accentColor = '#f5a623' }: any) => {
  const { appLanguage } = useProject();
  const localizedTitle = translateUi(title, appLanguage);
  const localizedDesc = desc ? translateUi(desc, appLanguage) : '';
  return (
    <div 
      onClick={disabled ? undefined : onClick} 
      className={`bg-[#111] p-6 rounded-sm border border-[#222] transition-all relative overflow-hidden ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#444] cursor-pointer hover:bg-[#151515] group h-full flex flex-col'
      }`}
    >
      {!disabled && (
          <div className={`absolute top-0 right-0 p-4 opacity-10 transition-opacity group-hover:opacity-20 ${accent ? accent : 'text-gray-500'}`}>
              <Icon size={64} />
          </div>
      )}
      <div className="flex items-center gap-4 mb-3 relative z-10">
        <div className="p-2.5 bg-[#000] border border-[#333] rounded-sm transition-colors">
          <Icon size={20} className={disabled ? 'text-gray-700' : 'text-gray-300 group-hover:text-white'} />
        </div>
        <span className={`text-sm font-bold uppercase tracking-wider ${disabled ? 'text-gray-600' : 'text-gray-100'}`}>{localizedTitle}</span>
      </div>
      <p className={`text-[11px] font-mono leading-relaxed relative z-10 ${disabled ? 'text-gray-700' : 'text-gray-400'}`}>{localizedDesc}</p>
    </div>
  );
};

const Label = ({ children }: any) => (
  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">{children}</label>
);

const Section = ({ title, icon: Icon, children, accentColor = '#f5a623' }: any) => (
  <div className="mb-8">
    <div className="flex items-center gap-2 mb-4 pb-1 border-b border-[#222]">
      <Icon size={14} style={{ color: accentColor }} /> 
      <span className="text-xs font-bold text-white uppercase tracking-wider">{title}</span>
    </div>
    <div className="pl-2 border-l border-[#222] space-y-4">
        {children}
    </div>
  </div>
);

const ToggleBtn = ({ active, onClick, icon: Icon, title, accentColor = '#f5a623' }: any) => (
  <button
    onClick={onClick}
    style={active ? { backgroundColor: accentColor, borderColor: accentColor, color: '#000' } : {}}
    className={`p-1.5 rounded-sm transition-colors border ${active ? 'font-bold' : 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-[#222]'}`}
    title={title}
  >
    <Icon size={14} />
  </button>
);

const NumberControl = ({ label, value, onChange, min, max, step = 1, suffix = '', accentColor = '#f5a623' }: any) => (
  <div className="flex items-center justify-between group py-1">
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-gray-200 transition-colors">{label}</span>
    <div className="flex items-center gap-1">
        <button 
            onMouseDown={(e) => { e.preventDefault(); onChange(Math.max(min, Number((value - step).toFixed(2)))); }}
            className="w-6 h-6 flex items-center justify-center rounded-sm bg-[#111] border border-[#333] text-gray-400 hover:text-white hover:border-gray-500 transition-all hover:bg-[#222]"
        >
            <Minus size={10} />
        </button>
        <div className="min-w-[48px] text-center font-mono text-xs font-bold bg-[#000] border-y border-[#111] h-6 flex items-center justify-center" style={{ color: accentColor }}>
            {value}{suffix}
        </div>
        <button 
            onMouseDown={(e) => { e.preventDefault(); onChange(Math.min(max, Number((value + step).toFixed(2)))); }}
            className="w-6 h-6 flex items-center justify-center rounded-sm bg-[#111] border border-[#333] text-gray-400 hover:text-white hover:border-gray-500 transition-all hover:bg-[#222]"
        >
            <Plus size={10} />
        </button>
    </div>
  </div>
);

const Switch = ({ checked, onChange, activeColor }: any) => (
  <div
    onClick={() => onChange(!checked)}
    className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${checked ? (activeColor || 'bg-[#f5a623]') : 'bg-[#333]'}`}
  >
    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${checked ? 'left-4.5' : 'left-0.5'}`} style={{ left: checked ? '18px' : '2px'}} />
  </div>
);

const FeatureCard = ({ title, desc, icon: Icon, isActive, onToggle, accentColor = '#f5a623' }: any) => (
  <div className="bg-[#111] p-5 rounded-sm border border-[#222] flex items-center justify-between group hover:border-[#444] transition-colors">
    <div className="flex items-center gap-4">
      <div 
        className="w-10 h-10 rounded-sm flex items-center justify-center transition-colors"
        style={isActive ? { backgroundColor: accentColor, color: '#000' } : { backgroundColor: '#000', border: '1px solid #333', color: '#888' }}
      >
        <Icon size={18} />
      </div>
      <div>
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h4>
        <p className="text-[10px] text-gray-400 mt-1 font-mono">{desc}</p>
      </div>
    </div>
    <Switch checked={isActive} onChange={onToggle} />
  </div>
);

const ColorPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="flex gap-1.5">
    {MARKDOWN_COLORS.map((c) => (
      <button
        key={c.name}
        onMouseDown={(e) => { e.preventDefault(); onChange(c.value); }}
        className={`w-4 h-4 rounded-full border transition-all hover:scale-110 flex items-center justify-center ${c.class} ${
          value === c.value ? 'ring-1 ring-white border-transparent scale-110' : 'border-zinc-700 opacity-60 hover:opacity-100'
        }`}
        title={c.name}
      >
        {value === c.value && <Check size={8} className={c.name === 'White' || c.name === 'Gray' ? 'text-zinc-900' : 'text-zinc-100'} />}
      </button>
    ))}
  </div>
);

interface BackstageViewProps {
  onNavigateToBoard?: () => void;
  onClose?: () => void;
  initialCategory?: 'project' | 'appearance' | 'formatting' | 'scratchpad' | 'board' | 'ai' | 'features';
}

const BackstageView: React.FC<BackstageViewProps> = ({ onNavigateToBoard, onClose, initialCategory = 'project' }) => {
  const { 
    scriptConfig, setScriptConfig, scriptViewMode, setScriptViewMode,
    isTamilMode, setTamilMode, 
    tamilFontFamily, setTamilFontFamily, tamilFontScale, setTamilFontScale, 
    isOsInputMode, setOsInputMode, osInputShortcut, setOsInputShortcut,
    storyboardConfig, setStoryboardConfig, isStoryboardFeatureEnabled, setStoryboardFeatureEnabled,
    scratchpadConfig, setScratchpadConfig,
    boardLayerOrder = ['annotations', 'text', 'connections', 'groups', 'beats'], setBoardLayerOrder,
    loadProject, closeProject, downloadProject, saveProjectAs, fileHandle, filePath, setFilePath,
    beats, currentUser, isCloudMode, projectList, selectProject, currentProjectId,
    collaborators = [], setCollaborators,
    openrouterKey, setOpenrouterKey,
    grokKey, setGrokKey,
    generalAiModel, setGeneralAiModel,
    appTheme = 'dark', setAppTheme,
    appAccentColor = '#f5a623', setAppAccentColor,
    appLanguage = 'english', setAppLanguage,
    navLayout = 'horizontal', setNavLayout,
    breakdownLanguage = 'english', setBreakdownLanguage,
    isPdfDropEnabled, setPdfDropEnabled,
    isRedoEnabled, setRedoEnabled
  } = useProject();

  const { aiAvailable, router: routerStatus, gemini: geminiStatus, testing: keysTesting, refresh: refreshKeyStatus } = useAiKeyStatus();

  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const [activeCategory, setActiveCategory] = useState<'project' | 'appearance' | 'formatting' | 'scratchpad' | 'board' | 'ai' | 'features'>(initialCategory);

  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  const [selectedFormatElement, setSelectedFormatElement] = useState<keyof ScriptConfig | 'visualization'>('action');
  
  // Preview States
  const [previewMode, setPreviewMode] = useState<'example' | 'real'>('example');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  
  // Install & API 
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [tempOpenrouterKey, setTempOpenrouterKey] = useState(
      openrouterKey || import.meta.env.VITE_TOKENROUTER_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY || ''
  );
  const [keyTestStatus, setKeyTestStatus] = useState<'idle' | 'testing' | 'valid' | 'nocredit' | 'invalid'>('idle');
  const [keyTestError, setKeyTestError] = useState('');
  const [keyTestProvider, setKeyTestProvider] = useState('');

  const handleTestOpenrouterKey = async () => {
      const key = tempOpenrouterKey.trim();
      if (!key) return;
      setKeyTestStatus('testing');
      setKeyTestError('');
      setKeyTestProvider('');
      const result = await testApiKey(key);
      setKeyTestProvider(result.provider);
      setKeyTestError(result.error || '');
      if (!result.ok) setKeyTestStatus('invalid');
      else if (!result.quotaOk) setKeyTestStatus('nocredit');
      else setKeyTestStatus('valid');
      refreshKeyStatus(key);
  };

  const [grokTestStatus, setGrokTestStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [grokTestError, setGrokTestError] = useState('');

  const handleTestGrokKey = async () => {
      const key = tempGrokKey.trim();
      if (!key) return;
      setGrokTestStatus('testing');
      setGrokTestError('');
      const result = await testGrokKey(key);
      setGrokTestError(result.error || '');
      if (!result.ok) setGrokTestStatus('invalid');
      else setGrokTestStatus('valid');
  };

  useEffect(() => {
      setTempOpenrouterKey(openrouterKey || import.meta.env.VITE_TOKENROUTER_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY || '');
  }, [openrouterKey]);

  const [tempGrokKey, setTempGrokKey] = useState(
      grokKey || ''
  );

  useEffect(() => {
      setTempGrokKey(grokKey || '');
  }, [grokKey]);

  // --- COLLABORATION & TEAM SETTINGS ---
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Writer');
  const [inviteAccess, setInviteAccess] = useState<'edit' | 'view'>('edit');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pendingEmails, setPendingEmails] = useState<string[]>([]);

  // Load pending invites from Supabase or simulated invites
  useEffect(() => {
    if (!currentProjectId) return;
    if (isSupabaseConfigured) {
      supabase
        .from('project_invites')
        .select('invitee_email')
        .eq('project_id', currentProjectId)
        .then(({ data, error }) => {
          if (data && !error) {
            setPendingEmails(data.map((inv: any) => (inv.invitee_email || '').toLowerCase().trim()));
          }
        });
    } else {
      try {
        const invites = JSON.parse(localStorage.getItem('simulated_invites') || '[]');
        const filtered = invites
          .filter((inv: any) => inv.project_id === currentProjectId)
          .map((inv: any) => (inv.invitee_email || '').toLowerCase().trim());
        setPendingEmails(filtered);
      } catch {
        setPendingEmails([]);
      }
    }
  }, [currentProjectId]);

  const activeProject = projectList?.find(p => p.id === currentProjectId);
  const activeProjectName = activeProject?.name || 'Backstage Screenplay';

  const handleCopyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?project=${currentProjectId || 'default'}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    if (collaborators.some((c: any) => (c.email || '').toLowerCase() === cleanEmail)) {
      setInviteFeedback({ type: 'error', message: 'This person is already a collaborator on this project.' });
      setTimeout(() => setInviteFeedback(null), 4000);
      return;
    }

    if (pendingEmails.includes(cleanEmail)) {
      setInviteFeedback({ type: 'error', message: 'An invitation is already pending for this email.' });
      setTimeout(() => setInviteFeedback(null), 4000);
      return;
    }

    setIsInviting(true);
    try {
      const name = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
      const newCollab = {
        email: cleanEmail,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        role: inviteRole,
        editAccess: inviteAccess,
        allowedPages: ['board', 'script', 'casting', 'storyboard', 'shotlist', 'production']
      };

      const updated = [...collaborators, newCollab];
      setCollaborators(updated);

      await inviteUserToProject(
        currentProjectId || 'default',
        activeProjectName,
        cleanEmail,
        currentUser || 'Project Owner'
      );

      setPendingEmails(prev => [...prev, cleanEmail]);
      setInviteEmail('');
      setInviteFeedback({ type: 'success', message: `Invitation sent to ${cleanEmail}!` });
      setTimeout(() => setInviteFeedback(null), 4000);
    } catch (err: any) {
      setInviteFeedback({ type: 'error', message: err?.message || 'Failed to send invitation.' });
      setTimeout(() => setInviteFeedback(null), 4000);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveCollaborator = async (email: string, isPending?: boolean) => {
    const cleanEmail = email.toLowerCase().trim();
    if (isPending) {
      if (isSupabaseConfigured && currentProjectId) {
        await supabase
          .from('project_invites')
          .delete()
          .eq('project_id', currentProjectId)
          .eq('invitee_email', cleanEmail);
      }
      try {
        const invites = JSON.parse(localStorage.getItem('simulated_invites') || '[]');
        const remaining = invites.filter((inv: any) => !(inv.project_id === currentProjectId && inv.invitee_email === cleanEmail));
        localStorage.setItem('simulated_invites', JSON.stringify(remaining));
      } catch {}
      setPendingEmails(prev => prev.filter(e => e !== cleanEmail));
    } else {
      const updated = collaborators.filter((c: any) => (c.email || '').toLowerCase() !== cleanEmail);
      setCollaborators(updated);
    }
  };

  const handleEditAccessChange = (email: string, access: 'edit' | 'view') => {
    const updated = collaborators.map((c: any) => {
      if ((c.email || '').toLowerCase() === email.toLowerCase()) {
        return { ...c, editAccess: access };
      }
      return c;
    });
    setCollaborators(updated);
  };

  // Build unified collaborators list (active collaborators + pending invites)
  const combinedCollaborators = useMemo(() => {
    const list: any[] = [];
    const seenEmails = new Set<string>();

    collaborators.forEach((c: any) => {
      const email = (c.email || '').toLowerCase().trim();
      if (email && !seenEmails.has(email)) {
        seenEmails.add(email);
        list.push({
          ...c,
          isPending: false,
          isCurrentUser: currentUser && email === currentUser.toLowerCase().trim()
        });
      }
    });

    pendingEmails.forEach(email => {
      const clean = email.toLowerCase().trim();
      if (clean && !seenEmails.has(clean)) {
        seenEmails.add(clean);
        list.push({
          email: clean,
          name: clean.split('@')[0],
          role: 'Collaborator',
          editAccess: 'edit',
          isPending: true,
          isCurrentUser: false
        });
      }
    });

    return list;
  }, [collaborators, pendingEmails, currentUser]);

  const blockBounds = scriptConfig.blockBounds;
  const updateBlockBounds = (updates: any) => setScriptConfig({ 
      ...scriptConfig, 
      blockBounds: { ...scriptConfig.blockBounds, ...updates } 
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          const projName = file.name.replace(/\.[^/.]+$/, "");
          loadProject(data, { projectName: projName });
          alert("Project Loaded Successfully!");
          if (onNavigateToBoard) {
            onNavigateToBoard();
          }
        } catch (err) {
          console.error("Failed to load project", err);
          alert("Invalid project file");
        }
      };
      reader.readAsText(file);
    }
    e.target.value = ''; 
  };

  const handleLoadTauriFile = async () => {
    try {
      const dialog = await getTauriDialog();
      if (dialog) {
        const selected = await dialog.open({
          filters: [
            { name: 'Story & Screenplay Files (*.bst, *.json, *.cau)', extensions: ['bst', 'json', 'cau'] },
            { name: 'Backstage File (*.bst)', extensions: ['bst'] },
            { name: 'Causality Project (*.cau, *.json)', extensions: ['cau', 'json'] }
          ],
          multiple: false
        });
        if (selected) {
          const fs = await getTauriFs();
          if (fs) {
            const content = await fs.readTextFile(selected as string);
            const data = JSON.parse(content);
            const projName = (selected as string).split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || 'Imported Project';
            loadProject(data, { projectName: projName });
            setFilePath(selected as string);
            addRecentFile(selected as string);
            alert("Project Loaded Successfully!");
            if (onNavigateToBoard) {
              onNavigateToBoard();
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to load project via Tauri", err);
      alert("Invalid project file");
    }
  };

  const updateFormat = (elm: keyof ScriptConfig, prop: string, val: any) => {
    if (elm === 'slugline') {
       setScriptConfig({
          ...scriptConfig,
          slugline: { ...scriptConfig.slugline, [prop]: val }
       });
    } else {
       const targetConfig = scriptConfig[elm as keyof ScriptConfig];
       if (targetConfig) {
           setScriptConfig({
              ...scriptConfig,
              [elm]: { ...targetConfig as any, [prop]: val }
           });
       }
    }
  };

  const setPaperTheme = (theme: 'white' | 'dark' | 'sepia' | 'red') => {
      setScriptConfig({ ...scriptConfig, paperTheme: theme });
  };

  const moveLayer = (index: number, direction: 'up' | 'down') => {
      const newOrder = [...boardLayerOrder];
      if (direction === 'up') {
          if (index >= newOrder.length - 1) return;
          [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      } else {
          if (index <= 0) return;
          [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
      }
      setBoardLayerOrder(newOrder);
  };

  const getLayerLabel = (id: string) => {
      switch(id) {
          case 'beats': return 'Beats (Cards)';
          case 'text': return 'Text Labels';
          case 'annotations': return 'Drawings & Pictures';
          case 'connections': return 'Lines (Connections)';
          case 'groups': return 'Sequence (Groups)';
          default: return id;
      }
  };

  const getLayerIcon = (id: string) => {
      switch(id) {
          case 'beats': return <Box size={14} style={{ color: appAccentColor }} />;
          case 'text': return <Type size={14} className="text-blue-400" />;
          case 'annotations': return <Highlighter size={14} className="text-pink-400" />;
          case 'connections': return <Sliders size={14} className="text-green-400" />;
          case 'groups': return <Box size={14} className="text-gray-500" />;
          default: return <Box size={14} />;
      }
  };

  if (showPrintPreview) {
    return <PrintPreviewModal onClose={() => setShowPrintPreview(false)} />;
  }

  const formatTabs: { id: keyof ScriptConfig; label: string; icon?: any }[] = [
    { id: 'slugline', label: 'Slugline', icon: Box },
    { id: 'action', label: 'Action', icon: AlignLeft },
    { id: 'character', label: 'Character', icon: MousePointer2 },
    { id: 'dialogue', label: 'Dialogue', icon: Type },
    { id: 'parenthetical', label: 'Paren', icon: Box },
    { id: 'transition', label: 'Transit', icon: ArrowDown },
    { id: 'shot', label: 'Shot', icon: Video },
    { id: 'lyrics', label: 'Lyrics', icon: Music },
  ];

  const currentConfig = (selectedFormatElement !== 'visualization')
    ? (scriptConfig[selectedFormatElement as keyof ScriptConfig] as any)
    : null;
  const currentAlign = currentConfig?.textAlign || 'left';

  const slugContainerStyle = {
    paddingTop: scriptConfig.slugline.paddingEnabled ? `${scriptConfig.slugline.paddingVertical}px` : '0px',
    paddingBottom: scriptConfig.slugline.paddingEnabled ? `${scriptConfig.slugline.paddingVertical}px` : '0px',
    paddingLeft: scriptConfig.slugline.paddingEnabled ? `${scriptConfig.slugline.paddingHorizontal}px` : '0px',
    paddingRight: scriptConfig.slugline.paddingEnabled ? `${scriptConfig.slugline.paddingHorizontal}px` : '0px',
    marginTop: `${scriptConfig.slugline.marginTop}rem`,
    marginBottom: `${scriptConfig.slugline.marginBottom}rem`,
    backgroundColor: scriptConfig.slugline.paddingEnabled ? (scriptConfig.slugline.highlightColor || '#e5e7eb') : 'transparent',
  };

  const slugFontStyle = {
      fontSize: `${scriptConfig.slugline.fontSize}px`,
      fontFamily: isTamilMode && tamilFontFamily && tamilFontFamily !== scriptConfig.slugline.fontFamily ? `'${scriptConfig.slugline.fontFamily}', '${tamilFontFamily}', "Courier Prime", monospace` : `'${scriptConfig.slugline.fontFamily}', "Courier Prime", monospace`,
      textAlign: scriptConfig.slugline.textAlign as any,
      lineHeight: scriptConfig.slugline.lineHeight,
      letterSpacing: `${scriptConfig.slugline.letterSpacing}px`,
      fontWeight: scriptConfig.slugline.bold ? 'bold' : 'normal',
      fontStyle: scriptConfig.slugline.italic ? 'italic' : 'normal',
      textDecoration: scriptConfig.slugline.underline ? 'underline' : 'none',
      color: scriptConfig.slugline.color || '#000000'
  };

  const firstBeat = beats.length > 0 ? beats[0] : null;

  return (
    <div className={`w-full h-full flex overflow-hidden font-sans ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-[#050505] text-white'}`}>
        {/* Left Navigation Sidebar */}
        <div className={`w-64 border-r flex flex-col shrink-0 z-20 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-[#222]'}`}>
           <div className="p-6">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 mb-1" style={{ color: appAccentColor }}>
                  <SettingsIcon size={14} /> {translateUi('Backstage Settings', appLanguage)}
              </h2>
              <p className="text-[10px] text-gray-500 font-mono">{translateUi('SYSTEM & DISPLAY CONFIG', appLanguage)}</p>
           </div>
           
           <nav className="flex-1 space-y-px mt-1 overflow-y-auto">
              <SidebarItem 
                  active={activeCategory === 'project'} 
                  onClick={() => setActiveCategory('project')} 
                  icon={Folder} 
                  label={translateUi('Project Settings', appLanguage)} 
                  desc={translateUi('Collaborate, Save & Export', appLanguage)}
                  accentColor={appAccentColor}
              />
              <SidebarItem 
                  active={activeCategory === 'appearance'} 
                  onClick={() => setActiveCategory('appearance')} 
                  icon={Palette} 
                  label={translateUi('Appearance & Themes', appLanguage)} 
                  desc={translateUi('Dark/Light Mode & Colors', appLanguage)}
                  accentColor={appAccentColor}
              />
              <SidebarItem 
                  active={activeCategory === 'formatting'} 
                  onClick={() => setActiveCategory('formatting')} 
                  icon={Type} 
                  label={translateUi('Script Typography', appLanguage)} 
                  desc={translateUi('Fonts, Spacing & Layout', appLanguage)}
                  accentColor={appAccentColor}
              />
              <SidebarItem 
                  active={activeCategory === 'scratchpad'} 
                  onClick={() => setActiveCategory('scratchpad')} 
                  icon={StickyNote} 
                  label={translateUi('Notes & Scratchpad', appLanguage)} 
                  desc={translateUi('Editor & Markdown Style', appLanguage)}
                  accentColor={appAccentColor}
              />
              <SidebarItem 
                  active={activeCategory === 'board'} 
                  onClick={() => setActiveCategory('board')} 
                  icon={Layers} 
                  label={translateUi('Board Layers', appLanguage)} 
                  desc={translateUi('Z-Index Layer Stack', appLanguage)}
                  accentColor={appAccentColor}
              />
              <SidebarItem 
                  active={activeCategory === 'ai'} 
                  onClick={() => setActiveCategory('ai')} 
                  icon={Sparkles} 
                  label={translateUi('AI', appLanguage)} 
                  desc={translateUi('Models, Keys & Assistant', appLanguage)}
                  accentColor={appAccentColor}
              />
              <SidebarItem 
                  active={activeCategory === 'features'} 
                  onClick={() => setActiveCategory('features')} 
                  icon={Sliders} 
                  label={translateUi('System Tools', appLanguage)} 
                  desc={translateUi('Tamil, OS Keys & Exports', appLanguage)}
                  accentColor={appAccentColor}
              />
           </nav>
           
           <div className="p-4 border-t border-[#222] space-y-2">
              {onClose && (
                <button 
                    onClick={onClose}
                    className="w-full py-2.5 rounded-sm font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:brightness-110"
                    style={{ backgroundColor: appAccentColor, color: '#000' }}
                >
                    <Check size={14} /> {translateUi('Done / Close', appLanguage)}
                </button>
              )}
              <button 
                  onClick={closeProject}
                  className="w-full py-2.5 rounded-sm border border-red-900/30 bg-red-900/5 text-red-500 hover:bg-red-900/20 hover:text-red-400 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                  <LogOut size={12} className="group-hover:-translate-x-1 transition-transform"/> {translateUi('Exit Project', appLanguage)}
              </button>
           </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 bg-[#0c0c0c] flex flex-col overflow-hidden relative">
            <div 
              className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3 opacity-15"
              style={{ backgroundColor: appAccentColor }}
            />

            {onClose && (
              <div className="absolute top-4 right-6 z-30 flex items-center gap-2">
                <button
                  onClick={onClose}
                  className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-md text-xs font-bold uppercase tracking-wider ${
                    isLight 
                      ? 'bg-white/95 border-slate-300 text-slate-700 hover:text-black hover:bg-white hover:border-slate-400 shadow-slate-200' 
                      : 'bg-[#18181c]/95 border-[#333] text-gray-300 hover:text-white hover:bg-[#222228] hover:border-gray-500'
                  }`}
                  title="Close Backstage Settings (Esc)"
                >
                  <X size={14} />
                  <span>{translateUi('Close', appLanguage)}</span>
                </button>
              </div>
            )}

            {/* TAB 1: APPEARANCE & THEMES */}
            {activeCategory === 'appearance' && (
                <ViewContainer title="Appearance & Themes" subtitle="Customize interface mode, accent color palettes, and languages.">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* 0. NAVIGATION LAYOUT (HORIZONTAL TOP BAR VS VERTICAL SIDEBAR) */}
                        <div className="md:col-span-2 bg-[#111] p-6 rounded-sm border border-[#222]">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                                  <Layout size={16} style={{ color: appAccentColor }} /> Navigation Layout
                                </h4>
                                <p className="text-xs text-gray-400 mt-1">Choose between the classic top page header switcher or a modern collapsible vertical sidebar.</p>
                              </div>
                              <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-[#222] text-gray-300 border border-[#333]">
                                Active: {navLayout === 'vertical' ? 'VERTICAL SIDEBAR' : 'HORIZONTAL TOP BAR'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                              {/* Horizontal Top Bar Option */}
                              <div 
                                onClick={() => setNavLayout('horizontal')}
                                className={`p-5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between h-36 relative overflow-hidden group ${
                                  navLayout === 'horizontal' ? 'bg-[#181818] border-2 shadow-lg' : 'bg-[#0f0f0f] border-[#222] hover:border-[#444] hover:bg-[#141414]'
                                }`}
                                style={{ borderColor: navLayout === 'horizontal' ? appAccentColor : undefined }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="w-8 h-8 rounded flex items-center justify-center bg-[#222] text-white">
                                    <Layout size={16} />
                                  </div>
                                  {navLayout === 'horizontal' && <CheckCircle2 size={18} style={{ color: appAccentColor }} />}
                                </div>
                                <div>
                                  <div className="text-xs font-black uppercase text-white tracking-wider">Horizontal Top Bar</div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Classic view tabs placed directly in the top header</div>
                                </div>
                              </div>

                              {/* Vertical Sidebar Option */}
                              <div 
                                onClick={() => setNavLayout('vertical')}
                                className={`p-5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between h-36 relative overflow-hidden group ${
                                  navLayout === 'vertical' ? 'bg-[#181818] border-2 shadow-lg' : 'bg-[#0f0f0f] border-[#222] hover:border-[#444] hover:bg-[#141414]'
                                }`}
                                style={{ borderColor: navLayout === 'vertical' ? appAccentColor : undefined }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="w-8 h-8 rounded flex items-center justify-center bg-[#222] text-white">
                                    <AlignJustify size={16} className="rotate-90" />
                                  </div>
                                  {navLayout === 'vertical' && <CheckCircle2 size={18} style={{ color: appAccentColor }} />}
                                </div>
                                <div>
                                  <div className="text-xs font-black uppercase text-white tracking-wider">Vertical Sidebar</div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Collapsible vertical sidebar rail on the left side</div>
                                </div>
                              </div>
                            </div>
                        </div>

                        {/* 1. LIGHT / DARK / SYSTEM THEME */}
                        <div className="md:col-span-2 bg-[#111] p-6 rounded-sm border border-[#222]">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                                  <Sun size={16} style={{ color: appAccentColor }} /> Entire App Theme
                                </h4>
                                <p className="text-xs text-gray-400 mt-1">Select your preferred viewing mode for the entire Backstage interface.</p>
                              </div>
                              <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-[#222] text-gray-300 border border-[#333]">
                                Active: {appTheme.toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                              {/* Dark Mode Option */}
                              <div 
                                onClick={(e) => setAppTheme('dark', e)}
                                className={`p-5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between h-32 relative overflow-hidden group ${
                                  appTheme === 'dark' ? 'bg-[#181818] border-2 shadow-lg' : 'bg-[#0f0f0f] border-[#222] hover:border-[#444] hover:bg-[#141414]'
                                }`}
                                style={{ borderColor: appTheme === 'dark' ? appAccentColor : undefined }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="w-8 h-8 rounded flex items-center justify-center bg-[#222] text-white">
                                    <Moon size={16} />
                                  </div>
                                  {appTheme === 'dark' && <CheckCircle2 size={18} style={{ color: appAccentColor }} />}
                                </div>
                                <div>
                                  <div className="text-xs font-black uppercase text-white tracking-wider">Dark Theme</div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">High-contrast, dark canvas</div>
                                </div>
                              </div>

                              {/* Light Mode Option */}
                              <div 
                                onClick={(e) => setAppTheme('light', e)}
                                className={`p-5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between h-32 relative overflow-hidden group ${
                                  appTheme === 'light' ? 'bg-[#181818] border-2 shadow-lg' : 'bg-[#0f0f0f] border-[#222] hover:border-[#444] hover:bg-[#141414]'
                                }`}
                                style={{ borderColor: appTheme === 'light' ? appAccentColor : undefined }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="w-8 h-8 rounded flex items-center justify-center bg-white text-black">
                                    <Sun size={16} />
                                  </div>
                                  {appTheme === 'light' && <CheckCircle2 size={18} style={{ color: appAccentColor }} />}
                                </div>
                                <div>
                                  <div className="text-xs font-black uppercase text-white tracking-wider">Light Theme</div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Clean light theme for daylight</div>
                                </div>
                              </div>

                              {/* System Preference */}
                              <div 
                                onClick={(e) => setAppTheme('system', e)}
                                className={`p-5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between h-32 relative overflow-hidden group ${
                                  appTheme === 'system' ? 'bg-[#181818] border-2 shadow-lg' : 'bg-[#0f0f0f] border-[#222] hover:border-[#444] hover:bg-[#141414]'
                                }`}
                                style={{ borderColor: appTheme === 'system' ? appAccentColor : undefined }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="w-8 h-8 rounded flex items-center justify-center bg-[#222] text-gray-300">
                                    <Monitor size={16} />
                                  </div>
                                  {appTheme === 'system' && <CheckCircle2 size={18} style={{ color: appAccentColor }} />}
                                </div>
                                <div>
                                  <div className="text-xs font-black uppercase text-white tracking-wider">Auto / System</div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Match OS theme settings</div>
                                </div>
                              </div>
                            </div>
                        </div>

                        {/* 2. THEME SWITCH ANIMATION STYLE */}
                        <div className="md:col-span-2 bg-[#111] p-6 rounded-sm border border-[#222]">
                          <ThemeAnimationSelector variant="detailed" columns={3} showTestButton={true} />
                        </div>

                        {/* 3. ACCENT COLOR PALETTE */}
                        <div className="md:col-span-2 bg-[#111] p-6 rounded-sm border border-[#222]">
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                              <div>
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                                  <Palette size={16} style={{ color: appAccentColor }} /> Theme / Accent Color
                                </h4>
                                <p className="text-xs text-gray-400 mt-1">Select a curated palette swatch or pick any custom accent color for active indicators, buttons, and highlights.</p>
                              </div>
                              <div className="flex items-center gap-2 bg-[#000] px-3 py-1.5 rounded border border-[#222]">
                                <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: appAccentColor }} />
                                <span className="text-xs font-mono text-white font-bold">{appAccentColor}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-6">
                              {ACCENT_COLORS.map(color => {
                                const isSelected = appAccentColor.toLowerCase() === color.value.toLowerCase();
                                return (
                                  <button
                                    key={color.name}
                                    onClick={() => setAppAccentColor(color.value)}
                                    className={`p-3 rounded-lg border transition-all flex flex-col items-center justify-center gap-2 group ${
                                      isSelected ? 'bg-[#1a1a1a] border-white scale-105 shadow-md' : 'bg-[#0a0a0a] border-[#222] hover:border-[#444] hover:bg-[#141414]'
                                    }`}
                                  >
                                    <div 
                                      className="w-8 h-8 rounded-full border border-white/20 shadow-inner flex items-center justify-center transition-transform group-hover:scale-110"
                                      style={{ backgroundColor: color.value }}
                                    >
                                      {isSelected && <Check size={14} className="text-black drop-shadow-sm font-bold" />}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300 text-center">{color.name}</span>
                                  </button>
                                );
                              })}

                              {/* CUSTOM COLOR PICKER BUTTON */}
                              <label className={`p-3 rounded-lg border transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group relative ${
                                !ACCENT_COLORS.some(c => c.value.toLowerCase() === appAccentColor.toLowerCase())
                                  ? 'bg-[#1a1a1a] border-white scale-105 shadow-md'
                                  : 'bg-[#0a0a0a] border-[#222] hover:border-[#444] hover:bg-[#141414]'
                              }`}>
                                <input
                                  type="color"
                                  value={appAccentColor.startsWith('#') && appAccentColor.length === 7 ? appAccentColor : '#f5a623'}
                                  onChange={(e) => setAppAccentColor(e.target.value)}
                                  className="absolute opacity-0 inset-0 w-full h-full cursor-pointer z-10"
                                  title="Pick custom accent color"
                                />
                                <div 
                                  className="w-8 h-8 rounded-full border border-white/20 shadow-inner flex items-center justify-center transition-transform group-hover:scale-110 relative overflow-hidden"
                                  style={{ 
                                    backgroundColor: !ACCENT_COLORS.some(c => c.value.toLowerCase() === appAccentColor.toLowerCase())
                                      ? appAccentColor
                                      : '#222'
                                  }}
                                >
                                  {!ACCENT_COLORS.some(c => c.value.toLowerCase() === appAccentColor.toLowerCase()) ? (
                                    <Check size={14} className="text-black drop-shadow-sm font-bold" />
                                  ) : (
                                    <Pipette size={14} className="text-white drop-shadow-sm" />
                                  )}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300 text-center">Custom Pick</span>
                              </label>
                            </div>

                            {/* HEX INPUT & LIVE PREVIEW BAR */}
                            <div className="mt-6 pt-5 border-t border-[#222] flex items-center justify-between flex-wrap gap-4">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                  <Pipette size={14} style={{ color: appAccentColor }} /> Custom Hex Code
                                </span>
                                <div className="flex items-center gap-2 bg-[#0a0a0a] px-3 py-1.5 rounded-lg border border-[#333] focus-within:border-white transition-colors">
                                  <span className="text-gray-500 font-mono text-xs">#</span>
                                  <input
                                    type="text"
                                    value={appAccentColor.replace('#', '')}
                                    onChange={(e) => {
                                      const cleanHex = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                                      if (cleanHex.length === 6) {
                                        setAppAccentColor('#' + cleanHex);
                                      } else {
                                        setAppAccentColor('#' + cleanHex);
                                      }
                                    }}
                                    placeholder="f5a623"
                                    maxLength={6}
                                    className="w-20 bg-transparent text-xs font-mono font-bold text-white uppercase outline-none"
                                  />
                                  <input
                                    type="color"
                                    value={appAccentColor.startsWith('#') && appAccentColor.length === 7 ? appAccentColor : '#f5a623'}
                                    onChange={(e) => setAppAccentColor(e.target.value)}
                                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                                    title="Open color palette"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-mono">Preview:</span>
                                <button 
                                  className="px-3 py-1.5 rounded text-xs font-bold text-black shadow transition-all hover:brightness-110"
                                  style={{ backgroundColor: appAccentColor }}
                                >
                                  Primary Action
                                </button>
                                <span 
                                  className="px-3 py-1 rounded text-xs font-mono font-bold border"
                                  style={{ color: appAccentColor, borderColor: appAccentColor, backgroundColor: `${appAccentColor}20` }}
                                >
                                  Active Tag
                                </span>
                              </div>
                            </div>
                        </div>

                        {/* 3. APP LANGUAGE & BREAKDOWN LANGUAGE */}
                        <div className="bg-[#111] p-6 rounded-sm border border-[#222] space-y-4">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                              <Languages size={16} style={{ color: appAccentColor }} /> App Language
                            </h4>
                            <p className="text-xs text-gray-400">Select the primary interface language for application controls and navigation.</p>
                            
                            <div className="space-y-2 mt-4">
                              <select
                                value={appLanguage}
                                onChange={(e) => setAppLanguage(e.target.value as any)}
                                className="w-full bg-[#000] border border-[#333] rounded px-3 py-2.5 text-xs font-bold text-white focus:border-[#f5a623] outline-none tracking-wide"
                              >
                                {APP_LANGUAGES.map(lang => (
                                  <option key={lang.value} value={lang.value}>
                                    {lang.flag} {lang.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                        </div>

                        <div className="bg-[#111] p-6 rounded-sm border border-[#222] space-y-4">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                              <ListChecks size={16} style={{ color: appAccentColor }} /> Breakdown Language
                            </h4>
                            <p className="text-xs text-gray-400">Select the language used when generating pre-production scene breakdowns.</p>
                            
                            <div className="space-y-2 mt-4">
                              <select
                                value={breakdownLanguage}
                                onChange={(e) => setBreakdownLanguage(e.target.value as any)}
                                className="w-full bg-[#000] border border-[#333] rounded px-3 py-2.5 text-xs font-bold text-white focus:border-[#f5a623] outline-none tracking-wide"
                              >
                                {BREAKDOWN_LANGUAGES.map(lang => (
                                  <option key={lang.value} value={lang.value}>
                                    {lang.flag} {lang.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                        </div>

                        {/* 4. SCRIPT PAPER THEME PREVIEW */}
                        <div className="md:col-span-2 bg-[#111] p-6 rounded-sm border border-[#222]">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                                  <Eye size={16} style={{ color: appAccentColor }} /> Script View Paper Palette
                                </h4>
                                <p className="text-xs text-gray-400 mt-1">Configure background & reader paper styling for the Script View editor.</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                              <button
                                onClick={() => setPaperTheme('white')}
                                className={`p-4 rounded border text-left flex flex-col justify-between h-20 transition-all ${
                                  scriptConfig.paperTheme === 'white' ? 'border-2 border-white bg-white text-black font-bold shadow-md' : 'border-[#333] bg-white/90 text-black/70 hover:opacity-100 opacity-75'
                                }`}
                              >
                                <div className="text-xs font-black uppercase tracking-wider">White Paper</div>
                                <div className="text-[10px] font-mono">Standard Studio White</div>
                              </button>

                              <button
                                onClick={() => setPaperTheme('sepia')}
                                className={`p-4 rounded border text-left flex flex-col justify-between h-20 transition-all ${
                                  scriptConfig.paperTheme === 'sepia' ? 'border-2 border-amber-600 bg-[#fdf6e3] text-[#586e75] font-bold shadow-md' : 'border-[#333] bg-[#fdf6e3]/90 text-[#586e75]/80 hover:opacity-100 opacity-75'
                                }`}
                              >
                                <div className="text-xs font-black uppercase tracking-wider">Sepia Vintage</div>
                                <div className="text-[10px] font-mono">Warm Reader Tint</div>
                              </button>

                              <button
                                onClick={() => setPaperTheme('dark')}
                                className={`p-4 rounded border text-left flex flex-col justify-between h-20 transition-all ${
                                  scriptConfig.paperTheme === 'dark' ? 'border-2 border-white bg-[#1a1a1a] text-white font-bold shadow-md' : 'border-[#333] bg-[#1a1a1a]/90 text-gray-400 hover:opacity-100 opacity-75'
                                }`}
                              >
                                <div className="text-xs font-black uppercase tracking-wider">Midnight Dark</div>
                                <div className="text-[10px] font-mono">Low-light Screenplay</div>
                              </button>

                              <button
                                onClick={() => setPaperTheme('red')}
                                className={`p-4 rounded border text-left flex flex-col justify-between h-20 transition-all ${
                                  scriptConfig.paperTheme === 'red' ? 'border-2 border-red-500 bg-black text-red-500 font-bold shadow-md' : 'border-[#333] bg-black text-red-700 hover:opacity-100 opacity-75'
                                }`}
                              >
                                <div className="text-xs font-black uppercase tracking-wider">Night Vision Red</div>
                                <div className="text-[10px] font-mono">Darkroom Eye-Safe</div>
                              </button>
                            </div>
                        </div>
                    </div>
                </ViewContainer>
            )}

            {/* TAB 2: PROJECT & FILES */}
            {activeCategory === 'project' && (
                <ViewContainer title="Project Settings" subtitle="Invite collaborators, manage local data, cloud synchronization, and backups.">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                        {/* 1. INVITE PEOPLE TO COLLABORATE (SIMPLE & MODERN) */}
                        <div className={`md:col-span-2 p-6 rounded-xl border transition-all ${
                          isLight
                            ? 'bg-white border-slate-200 shadow-sm text-slate-800'
                            : 'bg-[#111114] border-[#222228] shadow-lg text-white'
                        }`}>
                          {/* Section Header */}
                          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b ${
                            isLight ? 'border-slate-100' : 'border-[#222228]'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border shadow-xs"
                                style={{
                                  backgroundColor: `${appAccentColor}18`,
                                  borderColor: `${appAccentColor}40`,
                                  color: appAccentColor
                                }}
                              >
                                <Users size={18} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-wider">
                                  {translateUi('Invite Collaborators', appLanguage)}
                                </h4>
                                <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                  {translateUi('Work with co-writers, directors, and crew members on this screenplay in real time.', appLanguage)}
                                </p>
                              </div>
                            </div>

                            {/* Quick Copy Link Button */}
                            <button
                              type="button"
                              onClick={handleCopyInviteLink}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer select-none self-start sm:self-auto ${
                                copiedLink
                                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold'
                                  : isLight
                                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                                    : 'bg-[#18181c] hover:bg-[#222228] border-[#2c2c34] text-gray-300'
                              }`}
                              title="Copy invitation link to clipboard"
                            >
                              {copiedLink ? <CheckCheck size={14} className="text-emerald-400" /> : <Link2 size={14} />}
                              <span>{copiedLink ? translateUi('Link Copied!', appLanguage) : translateUi('Copy Invite Link', appLanguage)}</span>
                            </button>
                          </div>

                          {/* Simple Inline Invite Form */}
                          <form onSubmit={handleSendInvite} className="pt-4 pb-2">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              {/* Email Input */}
                              <div className="relative flex-1 min-w-0">
                                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                <input
                                  type="text"
                                  required
                                  value={inviteEmail}
                                  onChange={(e) => setInviteEmail(e.target.value)}
                                  placeholder="Colleague email (e.g. nolan@cinema.com)..."
                                  className={`w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border outline-none transition-colors ${
                                    isLight
                                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500 focus:bg-white'
                                      : 'bg-[#0a0a0c] border-[#2a2a30] text-white focus:border-amber-500 focus:bg-black'
                                  }`}
                                />
                              </div>

                              {/* Role Selector */}
                              <div className="w-full sm:w-44 shrink-0">
                                <select
                                  value={inviteRole}
                                  onChange={(e) => setInviteRole(e.target.value)}
                                  className={`w-full text-xs px-3 py-2.5 rounded-lg border outline-none transition-colors cursor-pointer ${
                                    isLight
                                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500'
                                      : 'bg-[#0a0a0c] border-[#2a2a30] text-white focus:border-amber-500'
                                  }`}
                                >
                                  <option value="Writer">Writer</option>
                                  <option value="Director">Director</option>
                                  <option value="Producer">Producer</option>
                                  <option value="Assistant Director">Assistant Director</option>
                                  <option value="Cinematographer">Cinematographer</option>
                                  <option value="Editor">Editor</option>
                                  <option value="Crew">Crew / Production</option>
                                </select>
                              </div>

                              {/* Access Permission Toggle */}
                              <div className={`flex rounded-lg border p-0.5 shrink-0 ${
                                isLight ? 'border-slate-200 bg-slate-100' : 'border-[#2a2a30] bg-black/40'
                              }`}>
                                <button
                                  type="button"
                                  onClick={() => setInviteAccess('edit')}
                                  className={`px-3 py-1.5 text-[11px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                                    inviteAccess === 'edit'
                                      ? 'bg-amber-500 text-black shadow-xs font-black'
                                      : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {translateUi('Can Edit', appLanguage)}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInviteAccess('view')}
                                  className={`px-3 py-1.5 text-[11px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                                    inviteAccess === 'view'
                                      ? 'bg-amber-500 text-black shadow-xs font-black'
                                      : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {translateUi('View Only', appLanguage)}
                                </button>
                              </div>

                              {/* Submit Button */}
                              <button
                                type="submit"
                                disabled={isInviting || !inviteEmail.trim()}
                                className="px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                style={{
                                  backgroundColor: appAccentColor,
                                  color: '#000'
                                }}
                              >
                                <UserPlus size={14} />
                                <span>{isInviting ? 'Inviting...' : 'Invite'}</span>
                              </button>
                            </div>

                            {/* Inline Feedback Banner */}
                            {inviteFeedback && (
                              <div className={`mt-3 px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                                inviteFeedback.type === 'success'
                                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                              }`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                <span>{inviteFeedback.message}</span>
                              </div>
                            )}
                          </form>

                          {/* Collaborators List */}
                          <div className={`mt-4 pt-4 border-t ${isLight ? 'border-slate-100' : 'border-[#222228]'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                                Team Members ({combinedCollaborators.length})
                              </span>
                              {currentUser && (
                                <span className="text-[10px] text-gray-500 font-mono">
                                  Current Account: <strong className={isLight ? 'text-slate-800' : 'text-gray-300'}>{currentUser}</strong>
                                </span>
                              )}
                            </div>

                            {combinedCollaborators.length === 0 ? (
                              <div className={`p-6 rounded-lg border border-dashed text-center ${
                                isLight ? 'border-slate-200 text-slate-400 bg-slate-50/50' : 'border-[#222228] text-gray-500 bg-[#0a0a0c]/50'
                              }`}>
                                <Users size={22} className="mx-auto mb-1.5 opacity-40" />
                                <p className="text-xs font-semibold">No external collaborators invited yet.</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">Enter an email address above to invite team members to this screenplay.</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {combinedCollaborators.map((collab) => {
                                  const isOwner = collab.isCurrentUser;
                                  return (
                                    <div 
                                      key={collab.email}
                                      className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                                        collab.isPending 
                                          ? (isLight ? 'bg-amber-50/30 border-amber-200/50' : 'bg-amber-500/[0.02] border-amber-500/15')
                                          : (isLight ? 'bg-slate-50/80 border-slate-200 hover:bg-slate-50' : 'bg-[#0e0e11] border-[#222228] hover:bg-[#131317]')
                                      }`}
                                    >
                                      {/* Left Info */}
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div 
                                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 border"
                                          style={{
                                            backgroundColor: `${appAccentColor}20`,
                                            borderColor: `${appAccentColor}40`,
                                            color: appAccentColor
                                          }}
                                        >
                                          {(collab.name || collab.email).charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                              {collab.name || collab.email}
                                            </span>
                                            {isOwner && (
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                Owner (You)
                                              </span>
                                            )}
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                                              isLight ? 'bg-slate-200/70 text-slate-700 border-slate-300' : 'bg-white/5 text-gray-400 border-white/10'
                                            }`}>
                                              {collab.role}
                                            </span>
                                            {collab.isPending ? (
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                Pending Invite
                                              </span>
                                            ) : (
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                Active
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[10px] text-gray-500 truncate mt-0.5">{collab.email}</div>
                                        </div>
                                      </div>

                                      {/* Right Controls */}
                                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                        {!isOwner && (
                                          <>
                                            <select
                                              value={collab.editAccess || 'edit'}
                                              onChange={(e) => handleEditAccessChange(collab.email, e.target.value as 'edit' | 'view')}
                                              className={`text-[10px] font-bold px-2 py-1 rounded border outline-none cursor-pointer transition-colors ${
                                                isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-[#18181c] border-[#2c2c34] text-gray-300'
                                              }`}
                                            >
                                              <option value="edit">Can Edit</option>
                                              <option value="view">View Only</option>
                                            </select>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveCollaborator(collab.email, collab.isPending)}
                                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                                isLight 
                                                  ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' 
                                                  : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                                              }`}
                                              title={collab.isPending ? "Cancel invitation" : "Remove collaborator"}
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* CLOUD STATUS CARD */}
                        <div className="md:col-span-2 bg-[#111] p-6 rounded-sm border border-[#222]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${isSupabaseConfigured ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                                        {isSupabaseConfigured ? <Wifi size={24} /> : <WifiOff size={24} />}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white uppercase tracking-tight">
                                            {isSupabaseConfigured ? 'Cloud Sync Active' : 'Local Storage Mode'}
                                        </h4>
                                        <p className="text-xs text-gray-400 font-mono mt-1">
                                            {isSupabaseConfigured 
                                                ? `Synchronizing with production servers as ${currentUser || 'Cloud User'}` 
                                                : 'Running isolated on this browser. Save local backup file for backups.'}
                                        </p>
                                    </div>
                                </div>
                                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isSupabaseConfigured ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                                    {isSupabaseConfigured ? 'CONNECTED' : 'OFFLINE'}
                                </div>
                            </div>
                        </div>
                        {/* PROJECT SWITCHER & INVITED PROJECTS */}
                        {projectList && projectList.length > 0 && (
                            <div className="md:col-span-2 bg-[#111] p-6 rounded-sm border border-[#222] space-y-6">
                                {/* SECTION 1: MY OWN WORKSPACES */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest pb-1 border-b border-[#222] flex items-center justify-between">
                                        <span>My Own Workspaces (Online & Offline)</span>
                                        <span className="text-[9px] text-gray-500">{(projectList.filter(p => !p.isInvited)).length} Projects</span>
                                    </h4>
                                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                        {(projectList.filter(p => !p.isInvited)).map(proj => {
                                            const isCurrent = proj.id === currentProjectId;
                                            return (
                                                <div 
                                                    key={proj.id} 
                                                    className={`flex items-center justify-between p-3 rounded border transition-all ${
                                                        isCurrent 
                                                            ? 'bg-amber-500/10 border-amber-500/30' 
                                                            : 'bg-[#151515] border-[#222] hover:border-[#333]'
                                                    }`}
                                                >
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-bold text-white truncate block">{proj.name}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => selectProject(proj.id)}
                                                        disabled={isCurrent}
                                                        style={isCurrent ? { borderColor: 'rgba(245,166,35,0.4)', color: '#f5a623' } : {}}
                                                        className={`px-3 py-1 text-[9px] font-black uppercase rounded border transition-all ${
                                                            isCurrent 
                                                                ? 'opacity-60 cursor-default font-bold' 
                                                                : 'bg-[#222] border-[#333] hover:border-gray-500 text-gray-300'
                                                        }`}
                                                    >
                                                        {isCurrent ? 'Active' : 'Open'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {(projectList.filter(p => !p.isInvited)).length === 0 && (
                                            <div className="text-[10px] text-gray-500 py-2">No personal workspaces found.</div>
                                        )}
                                    </div>
                                </div>

                                {/* SECTION 2: COLLABORATIONS */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest pb-1 border-b border-amber-500/10 flex items-center justify-between">
                                        <span>Collaborations</span>
                                        <span className="text-[9px] text-gray-500">{(projectList.filter(p => p.isInvited)).length} Projects</span>
                                    </h4>
                                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                        {(projectList.filter(p => p.isInvited)).map(proj => {
                                            const isCurrent = proj.id === currentProjectId;
                                            return (
                                                <div 
                                                    key={proj.id} 
                                                    className={`flex items-center justify-between p-3 rounded border transition-all ${
                                                        isCurrent 
                                                            ? 'bg-amber-500/10 border-amber-500/30' 
                                                            : 'bg-[#151515] border-[#222] hover:border-[#333]'
                                                    }`}
                                                >
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-bold text-white truncate block">{proj.name}</span>
                                                        <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider mt-0.5 block">
                                                            Invited Workspace
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => selectProject(proj.id)}
                                                        disabled={isCurrent}
                                                        style={isCurrent ? { borderColor: 'rgba(245,166,35,0.4)', color: '#f5a623' } : {}}
                                                        className={`px-3 py-1 text-[9px] font-black uppercase rounded border transition-all ${
                                                            isCurrent 
                                                                ? 'opacity-60 cursor-default font-bold' 
                                                                : 'bg-[#222] border-[#333] hover:border-gray-500 text-gray-300'
                                                        }`}
                                                    >
                                                        {isCurrent ? 'Active' : 'Open'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {(projectList.filter(p => p.isInvited)).length === 0 && (
                                            <div className="text-[10px] text-gray-500 py-2">No invited collaborations.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* EXPORT PDF */}
                        <div className="md:col-span-2">
                            <LargeActionCard 
                                onClick={() => setShowPrintPreview(true)}
                                icon={Printer}
                                title="Print / Export PDF"
                                desc="Format your screenplay for industry standard formatted PDF output and custom print settings."
                                accent="text-green-500"
                                accentColor={appAccentColor}
                            />
                        </div>

                        {/* FILE HANDLING */}
                        <LargeActionCard 
                            onClick={saveProjectAs}
                            icon={Save}
                            title="Save As Native File"
                            desc={fileHandle || filePath ? "Save current project to linked native file." : "Link project to a local .bst file on your disk for direct auto-saving."}
                            accentColor={appAccentColor}
                        />

                        <LargeActionCard 
                            onClick={downloadProject}
                            icon={Download}
                            title="Download Backup File"
                            desc="Export a standalone .bst JSON backup file containing all script beats, storyboard shots, and metadata."
                            accentColor={appAccentColor}
                        />

                        <div className="md:col-span-2">
                          <input type="file" ref={fileInputRef} onChange={handleFileLoad} accept=".bst,.json,.cau" className="hidden" />
                          <LargeActionCard 
                              onClick={isTauri() ? handleLoadTauriFile : () => fileInputRef.current?.click()}
                              icon={Upload}
                              title="Load Project File (.bst, .json, .cau)"
                              desc="Import and open an existing Backstage (.bst) or Causality Story (.cau, .json) file from your disk."
                              accentColor={appAccentColor}
                          />
                        </div>
                    </div>
                </ViewContainer>
            )}

            {/* TAB 3: SCRIPT TYPOGRAPHY */}
            {activeCategory === 'formatting' && (
                <div className="flex flex-col h-full animate-in fade-in duration-300">
                    <div className="px-8 py-5 shrink-0 z-10 bg-[#0c0c0c]/90 backdrop-blur-sm border-b border-[#222] flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                <Type style={{ color: appAccentColor }} size={20}/> Script Typography
                            </h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global View</span>
                            <div className="flex bg-[#111] rounded-sm p-0.5 border border-[#222]">
                                <button 
                                    onClick={() => setScriptViewMode('page')}
                                    className={`px-3 py-1.5 rounded-sm flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${scriptViewMode === 'page' ? 'bg-[#222] shadow-sm text-white' : 'text-gray-500 hover:text-white'}`}
                                    style={scriptViewMode === 'page' ? { color: appAccentColor } : {}}
                                ><FileText size={12} /> Page</button>
                                <button 
                                    onClick={() => setScriptViewMode('continuous')}
                                    className={`px-3 py-1.5 rounded-sm flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${scriptViewMode === 'continuous' ? 'bg-[#222] shadow-sm text-white' : 'text-gray-500 hover:text-white'}`}
                                    style={scriptViewMode === 'continuous' ? { color: appAccentColor } : {}}
                                ><ScrollText size={12} /> Continuous</button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#0c0c0c]">
                        <div className="w-80 overflow-y-auto border-r border-[#222] bg-[#0f0f0f]">
                            <div className="p-4 border-b border-[#222]">
                                <Label>Select Element to Style</Label>
                                <div className="grid grid-cols-2 gap-2 mt-2 mb-4">
                                    {formatTabs.map(tab => {
                                        const isActive = selectedFormatElement === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setSelectedFormatElement(tab.id)}
                                                className={`
                                                    flex items-center gap-2 px-3 py-2 rounded-sm border transition-all duration-200
                                                    ${isActive 
                                                        ? 'bg-[#181818] text-white font-bold' 
                                                        : 'bg-[#151515] border-[#222] text-gray-500 hover:border-[#333] hover:text-gray-300'}
                                                `}
                                                style={isActive ? { borderColor: appAccentColor, color: appAccentColor } : {}}
                                            >
                                                {tab.icon && (() => { const TabIcon = tab.icon; return <TabIcon size={12} className={isActive ? '' : 'opacity-50'} style={isActive ? { color: appAccentColor } : {}} />; })()}
                                                <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="h-px bg-[#222] mb-4"></div>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setSelectedFormatElement('visualization')}
                                        className={`
                                            w-full flex items-center gap-2 px-3 py-3 rounded-sm border transition-all duration-200
                                            ${selectedFormatElement === 'visualization'
                                                ? 'bg-[#181818] font-bold' 
                                                : 'bg-[#151515] border-[#222] text-gray-500 hover:border-[#333] hover:text-gray-300'}
                                        `}
                                        style={selectedFormatElement === 'visualization' ? { borderColor: appAccentColor, color: appAccentColor } : {}}
                                    >
                                        <BoxSelect size={14} style={selectedFormatElement === 'visualization' ? { color: appAccentColor } : {}} className={selectedFormatElement === 'visualization' ? '' : 'opacity-50'} />
                                        <div className="flex flex-col items-start">
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Layout Viz</span>
                                            <span className="text-[8px] opacity-60">Global Block Bounds</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="p-6 space-y-8">
                                {selectedFormatElement === 'visualization' ? (
                                    <>
                                        <Section title="Bounds Control" icon={BoxSelect} accentColor={appAccentColor}>
                                            <div className="flex items-center justify-between mb-4">
                                                <Label>Show Bounds</Label>
                                                <Switch checked={blockBounds.enabled} onChange={(v: boolean) => updateBlockBounds({ enabled: v })} activeColor={appAccentColor} />
                                            </div>
                                            <div className={`space-y-6 ${!blockBounds.enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                                                <div className="space-y-2">
                                                    <Label>Scope</Label>
                                                    <div className="flex bg-[#111] rounded p-0.5 border border-[#333]">
                                                        <button onClick={() => updateBlockBounds({ mode: 'active' })} className="flex-1 py-1.5 text-[10px] font-bold uppercase rounded text-white" style={blockBounds.mode === 'active' ? { backgroundColor: appAccentColor, color: '#000' } : { color: '#888' }}>Active Focus</button>
                                                        <button onClick={() => updateBlockBounds({ mode: 'all' })} className="flex-1 py-1.5 text-[10px] font-bold uppercase rounded text-white" style={blockBounds.mode === 'all' ? { backgroundColor: appAccentColor, color: '#000' } : { color: '#888' }}>X-Ray All</button>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Fill Opacity</Label>
                                                    <input 
                                                        type="range" min="0" max="100" 
                                                        value={blockBounds.opacity} 
                                                        onChange={(e) => updateBlockBounds({ opacity: parseInt(e.target.value) })}
                                                        className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer"
                                                        style={{ accentColor: appAccentColor }}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Outline Style</Label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['none', 'dashed', 'dotted', 'solid'].map((style) => (
                                                            <button
                                                                key={style}
                                                                onClick={() => updateBlockBounds({ outlineStyle: style })}
                                                                className={`px-2 py-1.5 text-[10px] font-bold uppercase rounded border ${blockBounds.outlineStyle === style ? 'text-white' : 'border-[#333] text-gray-500 hover:bg-[#222]'}`}
                                                                style={blockBounds.outlineStyle === style ? { borderColor: appAccentColor, color: appAccentColor } : {}}
                                                            >
                                                                {style}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </Section>
                                    </>
                                ) : (
                                    <>
                                        <Section title="Typography" icon={ALargeSmall} accentColor={appAccentColor}>
                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <Label>Font Family</Label>
                                                    <select 
                                                        value={currentConfig?.fontFamily || 'Courier Prime'}
                                                        onChange={e => updateFormat(selectedFormatElement as any, 'fontFamily', e.target.value)}
                                                        className="w-full bg-[#111] border border-[#333] rounded-sm px-2 py-1.5 text-xs text-white focus:border-[#f5a623] outline-none"
                                                    >
                                                        {AVAILABLE_ENGLISH_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex bg-[#111] rounded-sm border border-[#333] p-0.5">
                                                        <ToggleBtn active={currentConfig?.bold} onClick={() => updateFormat(selectedFormatElement as any, 'bold', !currentConfig?.bold)} icon={Bold} title="Bold" accentColor={appAccentColor} />
                                                        <ToggleBtn active={currentConfig?.italic} onClick={() => updateFormat(selectedFormatElement as any, 'italic', !currentConfig?.italic)} icon={Italic} title="Italic" accentColor={appAccentColor} />
                                                        <ToggleBtn active={currentConfig?.underline} onClick={() => updateFormat(selectedFormatElement as any, 'underline', !currentConfig?.underline)} icon={Underline} title="Underline" accentColor={appAccentColor} />
                                                    </div>
                                                    <div className="flex gap-1.5">
                                                        {TEXT_COLORS.map(c => (
                                                            <button 
                                                                key={c.name} 
                                                                onClick={() => updateFormat(selectedFormatElement as any, 'color', c.value)}
                                                                className={`w-5 h-5 rounded-full border ${c.class} flex items-center justify-center ${currentConfig?.color === c.value ? 'border-white ring-1 ring-white/50' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-1 pt-2">
                                                    <NumberControl label="Size (px)" value={currentConfig?.fontSize} min={10} max={32} onChange={(v: number) => updateFormat(selectedFormatElement as any, 'fontSize', v)} accentColor={appAccentColor} />
                                                    <NumberControl label="Line Height" value={currentConfig?.lineHeight} step={0.1} min={0.8} max={2.5} onChange={(v: number) => updateFormat(selectedFormatElement as any, 'lineHeight', v)} accentColor={appAccentColor} />
                                                    <NumberControl label="Letter Spacing" value={currentConfig?.letterSpacing || 0} step={0.5} min={-2} max={10} suffix="px" onChange={(v: number) => updateFormat(selectedFormatElement as any, 'letterSpacing', v)} accentColor={appAccentColor} />
                                                </div>
                                            </div>
                                        </Section>
                                        <Section title="Layout & Spacing" icon={MoveVertical} accentColor={appAccentColor}>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <Label>Alignment</Label>
                                                    <div className="flex bg-[#111] border border-[#333] rounded-sm p-0.5">
                                                        {['left', 'center', 'right', 'justify'].map(align => (
                                                            <button 
                                                                key={align}
                                                                onClick={() => updateFormat(selectedFormatElement as any, 'textAlign', align)}
                                                                className={`p-1.5 rounded-sm ${currentAlign === align ? 'text-black font-bold' : 'text-gray-500 hover:text-white'}`}
                                                                style={currentAlign === align ? { backgroundColor: appAccentColor } : {}}
                                                            >
                                                                {align === 'left' && <AlignLeft size={12} />}
                                                                {align === 'center' && <AlignCenter size={12} />}
                                                                {align === 'right' && <AlignRight size={12} />}
                                                                {align === 'justify' && <AlignJustify size={12} />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <NumberControl label="Margin Top" value={currentConfig?.marginTop} suffix="rem" step={0.1} min={0} max={5} onChange={(v: number) => updateFormat(selectedFormatElement as any, 'marginTop', v)} accentColor={appAccentColor} />
                                                    <NumberControl label="Margin Bottom" value={currentConfig?.marginBottom} suffix="rem" step={0.1} min={0} max={5} onChange={(v: number) => updateFormat(selectedFormatElement as any, 'marginBottom', v)} accentColor={appAccentColor} />
                                                    {selectedFormatElement !== 'slugline' && (
                                                        <>
                                                            <div className="h-px bg-[#222] my-2"></div>
                                                            <NumberControl label="Indent (Left)" value={currentConfig?.marginLeft} suffix="%" min={0} max={100} onChange={(v: number) => updateFormat(selectedFormatElement as any, 'marginLeft', v)} accentColor={appAccentColor} />
                                                            <NumberControl label="Width" value={currentConfig?.width} suffix="%" min={10} max={100} onChange={(v: number) => updateFormat(selectedFormatElement as any, 'width', v)} accentColor={appAccentColor} />
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </Section>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Script Paper Preview */}
                        <div className="flex-1 overflow-auto bg-[#0c0c0c] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] relative">
                            <div className="absolute top-6 right-6 z-20 flex bg-[#1a1a1a] rounded-full p-1 border border-[#333] shadow-xl">
                                <button 
                                    onClick={() => setPreviewMode('example')}
                                    className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-full transition-all flex items-center gap-2 ${previewMode === 'example' ? 'text-black font-bold shadow-sm' : 'text-gray-500 hover:text-white'}`}
                                    style={previewMode === 'example' ? { backgroundColor: appAccentColor } : {}}
                                >
                                    <Monitor size={12} /> Blueprint
                                </button>
                                <button 
                                    onClick={() => setPreviewMode('real')}
                                    className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-full transition-all flex items-center gap-2 ${previewMode === 'real' ? 'text-black font-bold shadow-sm' : 'text-gray-500 hover:text-white'}`}
                                    style={previewMode === 'real' ? { backgroundColor: appAccentColor } : {}}
                                >
                                    <Eye size={12} /> Live Data
                                </button>
                            </div>
                            <div className="min-h-full flex items-center justify-center p-12">
                                <div 
                                    className="sc-paper-preview w-full max-w-[210mm] aspect-[210/297] shadow-2xl rounded-sm p-16 overflow-hidden relative transition-all duration-500 shrink-0 border border-black/5"
                                >
                                    <div className="absolute top-8 right-8 text-black/40 font-screenplay text-xs opacity-40">1.</div>
                                    <div className="font-screenplay text-[12pt] leading-tight w-full h-full relative">
                                        <div className="animate-in fade-in zoom-in duration-300">
                                            {previewMode === 'example' ? (
                                                <div className="space-y-0">
                                                    <div className={`sc-line sc-shot ${selectedFormatElement === 'shot' ? 'sc-active-block' : ''}`}>CLOSE ON: A flickering neon sign.</div>
                                                    <div className={`sc-line sc-slugline ${selectedFormatElement === 'slugline' ? 'sc-active-block' : ''}`}>EXT. RAIN-SLICKED ALLEY - NIGHT</div>
                                                    <div className={`sc-line sc-action ${selectedFormatElement === 'action' ? 'sc-active-block' : ''}`}>The hum of the city is a dull roar. KAI (20s) leans against the brickwork, synthetic rain dripping from his cowl.</div>
                                                    <div className={`sc-line sc-character ${selectedFormatElement === 'character' ? 'sc-active-block' : ''}`}>KAI</div>
                                                    <div className={`sc-line sc-parenthetical ${selectedFormatElement === 'parenthetical' ? 'sc-active-block' : ''}`}>(into a comm-link)</div>
                                                    <div className={`sc-line sc-dialogue ${selectedFormatElement === 'dialogue' ? 'sc-active-block' : ''}`}>Tell the Don the shipment is compromised. Sector 4 is crawling with Enforcers.</div>
                                                    <div className={`sc-line sc-lyrics ${selectedFormatElement === 'lyrics' ? 'sc-active-block' : ''}`}>♫ No way home, no way out... ♫</div>
                                                    <div className={`sc-line sc-transition ${selectedFormatElement === 'transition' ? 'sc-active-block' : ''}`}>FADE OUT.</div>
                                                </div>
                                            ) : (
                                                firstBeat ? (
                                                    <div className="real-content-view">
                                                        <div className={`sc-line sc-slugline ${selectedFormatElement === 'slugline' ? 'sc-active-block' : ''}`}
                                                             style={slugContainerStyle}>
                                                            <span style={slugFontStyle}>
                                                                {firstBeat.slug.prefix || 'INT.'} {firstBeat.slug.location || 'LOCATION'} - {firstBeat.slug.time || 'DAY'}
                                                            </span>
                                                        </div>
                                                        <div dangerouslySetInnerHTML={{ __html: firstBeat.content }} className="mt-4" />
                                                    </div>
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                                                        <FileText size={48} className="mb-4 opacity-20"/>
                                                        <span className="text-sm font-bold uppercase tracking-widest text-gray-300">No Scenes Found</span>
                                                        <span className="text-[10px] text-gray-400 mt-2 font-mono">Create a beat on the board to see it here.</span>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: SCRATCHPAD & NOTES */}
            {activeCategory === 'scratchpad' && (
                <ViewContainer title="Notes & Scratchpad" subtitle="Configure global scratchpad behavior, markdown fonts, list markers and callout colors.">
                    <div className="flex h-full bg-[#0c0c0c]">
                        <div className="w-96 overflow-y-auto border-r border-[#222] bg-[#0f0f0f] p-6 space-y-8">
                            <Section title="General Behavior" icon={Sliders} accentColor={appAccentColor}>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label>Enable Markdown</Label>
                                        <Switch checked={scratchpadConfig.enableMarkdown} onChange={(v: boolean) => setScratchpadConfig({...scratchpadConfig, enableMarkdown: v})} activeColor={appAccentColor} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>Glass Effect</Label>
                                        <Switch checked={scratchpadConfig.glassEffect} onChange={(v: boolean) => setScratchpadConfig({...scratchpadConfig, glassEffect: v})} activeColor={appAccentColor} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>Drag Animations</Label>
                                        <Switch checked={scratchpadConfig.enableDragAnimations} onChange={(v: boolean) => setScratchpadConfig({...scratchpadConfig, enableDragAnimations: v})} activeColor={appAccentColor} />
                                    </div>
                                </div>
                            </Section>
                            <Section title="Typography" icon={Type} accentColor={appAccentColor}>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Scratchpad Font</Label>
                                        <select 
                                            value={scriptConfig.noteFont || '"Inter", sans-serif'}
                                            onChange={(e) => setScriptConfig({...scriptConfig, noteFont: e.target.value})}
                                            className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-xs text-white focus:border-[#f5a623] outline-none"
                                        >
                                            {NOTE_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <NumberControl label="Base Text Size (px)" value={scratchpadConfig.fontSize || 14} min={10} max={32} onChange={(v: number) => setScratchpadConfig({...scratchpadConfig, fontSize: v})} accentColor={appAccentColor} />
                                        <NumberControl label="Line Height" value={scratchpadConfig.lineHeight || 1.6} step={0.1} min={1} max={2.5} onChange={(v: number) => setScratchpadConfig({...scratchpadConfig, lineHeight: v})} accentColor={appAccentColor} />
                                        <NumberControl label="Block Spacing (px)" value={scratchpadConfig.blockSpacing || 2} min={0} max={20} onChange={(v: number) => setScratchpadConfig({...scratchpadConfig, blockSpacing: v})} accentColor={appAccentColor} />
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                        <div className="w-1/2 pr-2">
                                            <NumberControl label="H1 Size (px)" value={scratchpadConfig.h1FontSize || 24} min={16} max={48} onChange={(v: number) => setScratchpadConfig({...scratchpadConfig, h1FontSize: v})} accentColor={appAccentColor} />
                                        </div>
                                        <div className="w-1/2 pl-2">
                                            <NumberControl label="H2 Size (px)" value={scratchpadConfig.h2FontSize || 18} min={14} max={36} onChange={(v: number) => setScratchpadConfig({...scratchpadConfig, h2FontSize: v})} accentColor={appAccentColor} />
                                        </div>
                                    </div>
                                </div>
                            </Section>
                            <Section title="Lists & Todos" icon={List} accentColor={appAccentColor}>
                                <div className="space-y-6">
                                    <div className="space-y-4 pb-4 border-b border-[#222]">
                                        <div className="text-[10px] font-bold text-white uppercase tracking-widest bg-[#111] px-2 py-1 rounded inline-block">Numbered Lists</div>
                                        <NumberControl label="Marker Size (%)" value={scratchpadConfig.listMarkerSize || 100} min={50} max={200} step={5} onChange={(v: number) => setScratchpadConfig({...scratchpadConfig, listMarkerSize: v})} accentColor={appAccentColor} />
                                        <NumberControl label="Vertical Offset (px)" value={scratchpadConfig.listMarkerTopOffset || 0} min={-10} max={20} step={1} onChange={(v: number) => setScratchpadConfig({...scratchpadConfig, listMarkerTopOffset: v})} accentColor={appAccentColor} />
                                        <div className="flex items-center justify-between">
                                            <Label>Marker Color</Label>
                                            <ColorPicker value={scratchpadConfig.listMarkerColor} onChange={(v) => setScratchpadConfig({...scratchpadConfig, listMarkerColor: v})} />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="text-[10px] font-bold text-white uppercase tracking-widest bg-[#111] px-2 py-1 rounded inline-block flex items-center gap-2">
                                            <CheckSquare size={12} /> Checkboxes
                                        </div>
                                        <NumberControl label="Box Size (px)" value={scratchpadConfig.checkboxSize || 12} min={8} max={24} step={1} onChange={(v: number) => setScratchpadConfig({...scratchpadConfig, checkboxSize: v})} accentColor={appAccentColor} />
                                        <NumberControl label="Vertical Offset (px)" value={scratchpadConfig.checkboxTopOffset || 0} min={-10} max={20} step={1} onChange={(v: number) => setScratchpadConfig({...scratchpadConfig, checkboxTopOffset: v})} accentColor={appAccentColor} />
                                        <div className="flex items-center justify-between">
                                            <Label>Border Color</Label>
                                            <ColorPicker value={scratchpadConfig.todoBorder} onChange={(v) => setScratchpadConfig({...scratchpadConfig, todoBorder: v})} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label>Check Color</Label>
                                            <ColorPicker value={scratchpadConfig.todoCheckColor} onChange={(v) => setScratchpadConfig({...scratchpadConfig, todoCheckColor: v})} />
                                        </div>
                                    </div>
                                </div>
                            </Section>
                            <Section title="Callouts & Quotes" icon={Quote} accentColor={appAccentColor}>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label>Border Color</Label>
                                        <ColorPicker value={scratchpadConfig.calloutBorder} onChange={(v) => setScratchpadConfig({...scratchpadConfig, calloutBorder: v})} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>Background Tint</Label>
                                        <ColorPicker value={scratchpadConfig.calloutBackground} onChange={(v) => setScratchpadConfig({...scratchpadConfig, calloutBackground: v})} />
                                    </div>
                                </div>
                            </Section>
                        </div>

                        {/* Live Preview */}
                        <div className="flex-1 overflow-auto bg-[#181818] p-10 flex justify-center items-start">
                            <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-lg p-6 shadow-2xl">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Eye size={12} /> Live Preview
                                </div>
                                <div className="relative">
                                    <BlockEditor 
                                        value={PREVIEW_CONTENT} 
                                        onChange={() => {}} 
                                        readOnly={true}
                                        config={{...scratchpadConfig, fontFamily: scriptConfig.noteFont}}
                                        minHeight="200px"
                                        showToolbar={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </ViewContainer>
            )}

            {/* TAB 5: BOARD LAYERS */}
            {activeCategory === 'board' && (
                <ViewContainer title="Board Layer Stack" subtitle="Adjust the z-index visual stacking order of elements on the canvas.">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="bg-[#111] border border-[#222] rounded-sm p-6">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Layer Stack (Top to Bottom)</h4>
                            <div className="space-y-2">
                                {[...boardLayerOrder].reverse().map((layerId, i) => {
                                    const actualIndex = boardLayerOrder.length - 1 - i;
                                    return (
                                        <div key={layerId} className="flex items-center gap-4 bg-[#1a1a1a] p-4 rounded-sm border border-[#222] group hover:border-[#333] transition-colors">
                                            <div className="flex flex-col gap-1">
                                                <button disabled={actualIndex === boardLayerOrder.length - 1} onClick={() => moveLayer(actualIndex, 'up')} className="text-gray-500 hover:text-white disabled:opacity-20"><ArrowUp size={14}/></button>
                                                <button disabled={actualIndex === 0} onClick={() => moveLayer(actualIndex, 'down')} className="text-gray-500 hover:text-white disabled:opacity-20"><ArrowDown size={14}/></button>
                                            </div>
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="p-2 bg-[#222] rounded">{getLayerIcon(layerId)}</div>
                                                <span className="text-sm font-bold text-gray-200 capitalize">{getLayerLabel(layerId)}</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-gray-500 font-bold">Z-{actualIndex + 1}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </ViewContainer>
            )}

            {/* TAB 6: AI HUB */}
            {activeCategory === 'ai' && (
                <ViewContainer title="AI" subtitle="One place for every AI feature — storyboard generation, documentation & breakdowns, and the Ask Anything assistant.">
                    <div className="grid grid-cols-1 gap-6 max-w-4xl">
                        <div className="bg-[#111] p-6 rounded-sm border border-[#222]">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-10 h-10 rounded-sm flex items-center justify-center text-black" style={{ backgroundColor: appAccentColor }}>
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-white uppercase tracking-wider">AI Models &amp; API Keys</h4>
                                    <p className="text-xs text-gray-400 mt-1">Gemini powers storyboarding via the GEMINI_API_KEY environment variable. Documentation, breakdowns &amp; the Ask Anything assistant run on your NVIDIA Nemotron / Moonshot Kimi models through TokenRouter.</p>
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 px-3 py-2 mb-4 rounded border text-[11px] font-semibold ${aiAvailable ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                                <span className={`w-2 h-2 rounded-full ${keysTesting ? 'bg-amber-400 animate-pulse' : aiAvailable ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]' : 'bg-red-500 shadow-[0_0_6px_rgba(248,113,113,0.8)]'}`}></span>
                                {keysTesting
                                    ? 'Checking API keys...'
                                    : aiAvailable
                                        ? (routerStatus.state === 'valid'
                                            ? `AI ready — ${routerStatus.provider} key OK${geminiStatus.state === 'valid' ? ' · Gemini key OK' : ''}`
                                            : 'AI ready — running on Gemini key (TokenRouter has no credit)')
                                        : 'AI unavailable — no working API key. Fix a key below to re-enable AI features.'}
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <Label>API Key (TokenRouter / OpenRouter)</Label>
                                    <p className="text-[10px] text-gray-500 mt-1 mb-2">Your TokenRouter key is baked in as the default — it unlocks NVIDIA Nemotron &amp; Moonshot Kimi. OpenRouter keys (sk-or-v1-...) are auto-detected. Leave empty to use Gemini for everything.</p>
                                    <div className="flex gap-2 relative">
                                        <input 
                                            type="password"
                                            value={tempOpenrouterKey}
                                            onChange={(e) => setTempOpenrouterKey(e.target.value)}
                                            className="w-full bg-[#000] border border-[#333] rounded px-3 py-2 text-xs text-white focus:border-[#f5a623] outline-none"
                                            placeholder="sk-... (TokenRouter) or sk-or-v1-... (OpenRouter)"
                                        />
                                        <button 
                                            onClick={() => { setOpenrouterKey(tempOpenrouterKey); setKeyTestStatus('idle'); }}
                                            className="px-4 py-2 bg-[#222] border border-[#333] hover:bg-[#333] text-white text-xs font-bold uppercase rounded"
                                        >
                                            Save
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3 mt-3">
                                        <button 
                                            onClick={handleTestOpenrouterKey}
                                            disabled={keyTestStatus === 'testing' || !tempOpenrouterKey.trim()}
                                            className="px-3 py-1.5 bg-[#000] border border-[#333] hover:border-[#f5a623] disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-bold uppercase text-gray-300 rounded transition-all"
                                        >
                                            {keyTestStatus === 'testing' ? 'Testing...' : 'Test Key'}
                                        </button>
                                        {keyTestStatus !== 'idle' && (
                                            <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${
                                                keyTestStatus === 'valid' ? 'text-green-400' : 
                                                keyTestStatus === 'nocredit' ? 'text-amber-400' :
                                                keyTestStatus === 'invalid' ? 'text-red-400' : 'text-amber-400'
                                            }`}>
                                                <span className={`w-2 h-2 rounded-full ${
                                                    keyTestStatus === 'valid' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]' : 
                                                    keyTestStatus === 'nocredit' ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,166,35,0.8)]' :
                                                    keyTestStatus === 'invalid' ? 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]' : 'bg-amber-400 animate-pulse'
                                                }`}></span>
                                                {keyTestStatus === 'valid' ? `Key Valid — ${keyTestProvider}` :
                                                 keyTestStatus === 'nocredit' ? `Key Valid — ${keyTestProvider} needs credit${keyTestError ? ` (${keyTestError})` : ''}` :
                                                 keyTestStatus === 'invalid' ? `Key Invalid${keyTestError ? ` — ${keyTestError}` : ''}` : 'Testing Connection...'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <Label>Grok API Key</Label>
                                    <p className="text-[10px] text-gray-500 mt-1 mb-2">Used for Grok 2 and Grok Beta models. Keys start with "gsk_".</p>
                                    <div className="flex gap-2">
                                        <input 
                                            type="password"
                                            value={tempGrokKey}
                                            onChange={(e) => setTempGrokKey(e.target.value)}
                                            className="w-full bg-[#000] border border-[#333] rounded px-3 py-2 text-xs text-white focus:border-[#f5a623] outline-none"
                                            placeholder="gsk_..."
                                        />
                                        <button 
                                            onClick={() => { setGrokKey(tempGrokKey); localStorage.setItem('grok_api_key', tempGrokKey); alert("Grok API key saved!"); }}
                                            className="px-4 py-2 bg-[#222] border border-[#333] hover:bg-[#333] text-white text-xs font-bold uppercase rounded"
                                        >
                                            Save
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3 mt-3">
                                        <button 
                                            onClick={handleTestGrokKey}
                                            disabled={grokTestStatus === 'testing' || !tempGrokKey.trim()}
                                            className="px-3 py-1.5 bg-[#000] border border-[#333] hover:border-[#f5a623] disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-bold uppercase text-gray-300 rounded transition-all"
                                        >
                                            {grokTestStatus === 'testing' ? 'Testing...' : 'Test Key'}
                                        </button>
                                        {grokTestStatus !== 'idle' && (
                                            <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${
                                                grokTestStatus === 'valid' ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                                <span className={`w-2 h-2 rounded-full ${
                                                    grokTestStatus === 'valid' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]' : 
                                                    grokTestStatus === 'invalid' ? 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]' : 'bg-amber-400 animate-pulse'
                                                }`}></span>
                                                {grokTestStatus === 'valid' ? (tempGrokKey.trim().startsWith('gsk_') ? `Key Valid — Groq API is active` : `Key Valid — Grok API is active`) :
                                                 grokTestStatus === 'invalid' ? `Key Invalid${grokTestError ? ` — ${grokTestError}` : ''}` : 'Testing Connection...'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <Label>Gemini API Key</Label>
                                    <p className="text-[10px] text-gray-500 mt-1 mb-2">Storyboard generation and the automatic AI fallback always run on Gemini. The key comes from <span className="text-gray-300">VITE_GEMINI_API_KEY</span> in the <span className="text-gray-300">.env</span> file (or a Google AI Studio key).</p>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => refreshKeyStatus()}
                                            disabled={keysTesting}
                                            className="px-3 py-1.5 bg-[#000] border border-[#333] hover:border-[#f5a623] disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-bold uppercase text-gray-300 rounded transition-all"
                                        >
                                            {keysTesting ? 'Testing...' : 'Test Gemini Key'}
                                        </button>
                                        <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${
                                            keysTesting ? 'text-amber-400' :
                                            geminiStatus.state === 'valid' ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                            <span className={`w-2 h-2 rounded-full ${
                                                keysTesting ? 'bg-amber-400 animate-pulse' :
                                                geminiStatus.state === 'valid' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]' : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]'
                                            }`}></span>
                                            {keysTesting ? 'Checking...' :
                                             geminiStatus.state === 'valid' ? 'Gemini Key Valid' :
                                             `Gemini Key Not Working${geminiStatus.error ? ` — ${geminiStatus.error}` : ''}`}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <Label>General Purpose AI Model (Docs, Breakdown, Analysis, Ask Anything)</Label>
                                    <p className="text-[10px] text-gray-500 mt-1 mb-2">Used for script breakdowns, scene analysis and the Ask Anything assistant. Select Gemini or an NVIDIA/Kimi model via your TokenRouter key.</p>
                                    <select 
                                        value={generalAiModel}
                                        onChange={(e) => setGeneralAiModel(e.target.value)}
                                        className="w-full bg-[#000] border border-[#333] rounded px-3 py-2 text-xs text-white focus:border-[#f5a623] outline-none"
                                    >
                                        {AVAILABLE_TEXT_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#111] p-6 rounded-sm border border-[#222]">
                            <h4 className="text-sm font-bold text-white uppercase mb-1">Storyboard Model Configuration</h4>
                            <p className="text-[10px] text-gray-500 mb-4">Storyboard generation always runs on Google Gemini (Gemini / Imagen).</p>
                            <div className="space-y-4">
                                <div>
                                    <Label>Image Generation Model</Label>
                                    <select 
                                        value={storyboardConfig.imageModel}
                                        onChange={(e) => setStoryboardConfig({...storyboardConfig, imageModel: e.target.value})}
                                        className="w-full bg-[#000] border border-[#333] rounded px-3 py-2 text-xs text-white focus:border-[#f5a623] outline-none"
                                    >
                                        {AVAILABLE_IMAGE_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <Label>Script Analysis Model</Label>
                                    <p className="text-[10px] text-gray-500 mt-1 mb-2">Used to break down scenes into shot lists. Gemini only.</p>
                                    <select 
                                        value={storyboardConfig.textModel}
                                        onChange={(e) => setStoryboardConfig({...storyboardConfig, textModel: e.target.value})}
                                        className="w-full bg-[#000] border border-[#333] rounded px-3 py-2 text-xs text-white focus:border-[#f5a623] outline-none"
                                    >
                                        {GEMINI_TEXT_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#111] p-6 rounded-sm border border-[#222]">
                            <h4 className="text-sm font-bold text-white uppercase mb-4">Visual Defaults</h4>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Aspect Ratio</Label>
                                    <select 
                                        value={storyboardConfig.aspectRatio}
                                        onChange={(e) => setStoryboardConfig({...storyboardConfig, aspectRatio: e.target.value})}
                                        className="w-full bg-[#000] border border-[#333] rounded px-3 py-2 text-xs text-white focus:border-[#f5a623] outline-none"
                                    >
                                        <option value="16:9">16:9 (Cinematic)</option>
                                        <option value="4:3">4:3 (Classic)</option>
                                        <option value="1:1">1:1 (Square)</option>
                                        <option value="9:16">9:16 (Mobile)</option>
                                        <option value="2.35:1">2.35:1 (Anamorphic)</option>
                                    </select>
                                </div>
                                <div>
                                    <Label>Default Art Style</Label>
                                    <input 
                                        type="text"
                                        value={storyboardConfig.style}
                                        onChange={(e) => setStoryboardConfig({...storyboardConfig, style: e.target.value})}
                                        className="w-full bg-[#000] border border-[#333] rounded px-3 py-2 text-xs text-white focus:border-[#f5a623] outline-none"
                                        placeholder="e.g. Charcoal Sketch"
                                    />
                                </div>
                             </div>
                        </div>
                    </div>
                </ViewContainer>
            )}

            {/* TAB 7: SYSTEM TOOLS */}
            {activeCategory === 'features' && (
                <ViewContainer title="System Tools & Options" subtitle="Configure experimental capabilities, OS shortcuts, and input modes.">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {installPrompt && (
                            <div 
                                className="bg-[#111] p-5 rounded-sm border border-[#f5a623] shadow-[0_0_15px_rgba(245,166,35,0.2)] flex items-center justify-between group cursor-pointer hover:bg-[#181818] transition-colors"
                                onClick={handleInstallApp}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-sm flex items-center justify-center text-black" style={{ backgroundColor: appAccentColor }}>
                                        <Download size={20} strokeWidth={3} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Install Web App</h4>
                                        <p className="text-[10px] text-gray-400 mt-1 font-mono font-bold">Install Backstage as a desktop application.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <FeatureCard title="Tamil Transliteration" desc="Type phonetically in English to automatically generate Tamil script." icon={Globe} isActive={isTamilMode} onToggle={setTamilMode} accentColor={appAccentColor} />
                        {isTamilMode && (
                            <div className="bg-[#111] p-4 rounded-sm border border-[#222] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tamil Font Engine</h4>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Select preferred Tamil typeface for scriptwriting and live rendering.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={tamilFontFamily || 'Meera Inimai'}
                                        onChange={(e) => setTamilFontFamily(e.target.value)}
                                        className="bg-[#000] border border-[#333] rounded-sm px-3 py-1.5 text-xs font-bold text-white focus:border-[#f5a623] outline-none"
                                        style={{ borderColor: appAccentColor }}
                                    >
                                        {AVAILABLE_TAMIL_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        <FeatureCard title="Storyboard AI Features" desc="Enable AI generation capabilities for creating visual storyboard shots." icon={ImageIcon} isActive={isStoryboardFeatureEnabled} onToggle={setStoryboardFeatureEnabled} accentColor={appAccentColor} />
                        <FeatureCard title="Redo Keyboard Shortcuts" desc="Enable Ctrl+Y or Cmd+Shift+Z redo functionality." icon={RotateCw} isActive={isRedoEnabled} onToggle={setRedoEnabled} accentColor={appAccentColor} />
                        
                        <div className="md:col-span-2 bg-[#111] p-6 rounded-sm border border-[#222]">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex gap-4">
                                    <div className="p-3 bg-[#1a1a1a] rounded-sm text-blue-500"><Keyboard size={24} /></div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm uppercase tracking-wide">OS Input Trigger</h4>
                                        <p className="text-xs text-gray-400 mt-1">Simulate keypress events on specific script actions.</p>
                                    </div>
                                </div>
                                <Switch checked={isOsInputMode} onChange={setOsInputMode} activeColor="bg-blue-600" />
                            </div>
                            {isOsInputMode && (
                                <div className="border-t border-[#222] pt-6 mt-4">
                                    <Label>Trigger Key Configuration</Label>
                                    <select value={osInputShortcut} onChange={(e) => setOsInputShortcut(e.target.value)} className="mt-2 w-full max-w-xs bg-[#000] border border-[#333] rounded-sm px-4 py-2.5 text-xs font-bold text-white focus:border-blue-500 outline-none uppercase tracking-wide">
                                        <option value="NumLock">Num Lock</option>
                                        <option value="ScrollLock">Scroll Lock</option>
                                        <option value="F1">F1</option>
                                        <option value="F13">F13</option>
                                        <option value="Alt+L">Alt + L</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </ViewContainer>
            )}
        </div>
    </div>
  );
};

export default BackstageView;
