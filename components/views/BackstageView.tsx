
// ... existing imports
import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
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
  Key, Cpu, ListChecks, StickyNote, Hash, List, GripHorizontal, RotateCw, Lock
} from 'lucide-react';
// ... rest of imports (same as before)
import PrintPreviewModal from '../PrintPreviewModal';
import { 
    AVAILABLE_IMAGE_MODELS, AVAILABLE_TEXT_MODELS,
    VISUAL_STYLES, NOTE_FONTS
} from '../../constants';
import { updateGeminiConfig, generateText } from '../../services/gemini';

// ... (Constants TEXT_COLORS, HIGHLIGHT_COLORS, BOUND_COLORS, AVAILABLE_ENGLISH_FONTS remain same)
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

const HIGHLIGHT_COLORS = [
  { name: 'None', value: null, class: 'bg-transparent border-dashed border-gray-500' },
  { name: 'Light Gray', value: '#f3f4f6', class: 'bg-gray-100' },
  { name: 'Gray', value: '#d1d5db', class: 'bg-gray-300' },
  { name: 'Yellow', value: '#fef08a', class: 'bg-yellow-200' },
  { name: 'Green', value: '#bbf7d0', class: 'bg-green-200' },
  { name: 'Blue', value: '#bfdbfe', class: 'bg-blue-200' },
  { name: 'Pink', value: '#fbcfe8', class: 'bg-pink-200' },
];

const BOUND_COLORS = [
    { name: 'Slate', value: '#000000' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Orange', value: '#f5a623' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#a855f7' },
];

const AVAILABLE_ENGLISH_FONTS = [
    { label: 'Courier Prime', value: 'Courier Prime' },
    { label: 'Vijaya', value: 'Vijaya' },
    { label: 'Courier New', value: 'Courier New' },
    { label: 'Helvetica Neue', value: 'Helvetica Neue' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Times New Roman', value: 'Times New Roman' },
    { label: 'Georgia', value: 'Georgia' },
];

// ... (Helper Components SidebarItem, ViewContainer, LargeActionCard, Label, Section, ToggleBtn, NumberControl, Switch, FeatureCard, ColorPicker, getStyle remain same)
const SidebarItem = ({ active, onClick, icon: Icon, label, desc }: any) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-4 py-3 rounded-none border-l-2 transition-all flex items-center gap-3 ${active ? 'bg-[#151515] border-[#f5a623] text-white' : 'border-transparent text-[#666] hover:text-gray-300 hover:bg-[#111]'}`}
  >
    <Icon size={16} className={active ? "text-[#f5a623]" : ""} />
    <div>
      <div className="text-xs font-bold uppercase tracking-wider">{label}</div>
      {desc && <div className="text-[9px] text-gray-500 font-mono mt-0.5 opacity-70">{desc}</div>}
    </div>
  </button>
);

const ViewContainer = ({ title, subtitle, children }: any) => (
  <div className="flex-1 overflow-y-auto p-10 animate-in fade-in duration-300">
    <div className="max-w-5xl mx-auto">
        <div className="mb-10 pb-4 border-b border-[#222]">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-1">{title}</h3>
            {subtitle && <p className="text-xs font-mono text-[#555] uppercase tracking-widest">{subtitle}</p>}
        </div>
        {children}
    </div>
  </div>
);

const LargeActionCard = ({ onClick, icon: Icon, title, desc, accent }: any) => (
  <div onClick={onClick} className="bg-[#111] p-6 rounded-sm border border-[#222] hover:border-[#444] cursor-pointer transition-all hover:bg-[#151515] group h-full flex flex-col relative overflow-hidden">
    <div className={`absolute top-0 right-0 p-4 opacity-10 transition-opacity group-hover:opacity-20 ${accent ? accent.replace('text-', 'text-') : 'text-gray-500'}`}>
        <Icon size={64} />
    </div>
    <div className="flex items-center gap-4 mb-4 relative z-10">
      <div className={`p-2 bg-[#000] border border-[#333] rounded-sm transition-colors`}>
        <Icon size={20} className={`text-[#666] ${accent ? `group-hover:${accent}` : 'group-hover:text-white'}`} />
      </div>
      <span className="text-sm font-bold text-gray-200 uppercase tracking-wider">{title}</span>
    </div>
    <p className="text-[10px] text-gray-500 font-mono leading-relaxed relative z-10">{desc}</p>
  </div>
);

const Label = ({ children }: any) => (
  <label className="text-[9px] font-bold text-[#555] uppercase tracking-widest block mb-2">{children}</label>
);

const Section = ({ title, icon: Icon, children }: any) => (
  <div className="mb-8">
    <div className="flex items-center gap-2 mb-4 pb-1 border-b border-[#222]">
      <Icon size={12} className="text-[#f5a623]" /> 
      <span className="text-xs font-bold text-white uppercase tracking-wider">{title}</span>
    </div>
    <div className="pl-2 border-l border-[#222] space-y-4">
        {children}
    </div>
  </div>
);

const ToggleBtn = ({ active, onClick, icon: Icon, title }: any) => (
  <button
    onClick={onClick}
    className={`p-1.5 rounded-sm transition-colors border ${active ? 'bg-[#f5a623] border-[#f5a623] text-black' : 'bg-transparent border-transparent text-[#666] hover:text-white hover:bg-[#222]'}`}
    title={title}
  >
    <Icon size={14} />
  </button>
);

const NumberControl = ({ label, value, onChange, min, max, step = 1, suffix = '' }: any) => (
  <div className="flex items-center justify-between group py-1">
    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">{label}</span>
    <div className="flex items-center gap-1">
        <button 
            onMouseDown={(e) => { e.preventDefault(); onChange(Math.max(min, Number((value - step).toFixed(2)))); }}
            className="w-6 h-6 flex items-center justify-center rounded-sm bg-[#111] border border-[#333] text-gray-500 hover:text-white hover:border-gray-500 transition-all hover:bg-[#222]"
        >
            <Minus size={10} />
        </button>
        <div className="min-w-[48px] text-center font-mono text-xs font-bold text-[#f5a623] bg-[#000] border-y border-[#111] h-6 flex items-center justify-center">
            {value}{suffix}
        </div>
        <button 
            onMouseDown={(e) => { e.preventDefault(); onChange(Math.min(max, Number((value + step).toFixed(2)))); }}
            className="w-6 h-6 flex items-center justify-center rounded-sm bg-[#111] border border-[#333] text-gray-500 hover:text-white hover:border-gray-500 transition-all hover:bg-[#222]"
        >
            <Plus size={10} />
        </button>
    </div>
  </div>
);

const Switch = ({ checked, onChange, activeColor = 'bg-[#f5a623]' }: any) => (
  <div
    onClick={() => onChange(!checked)}
    className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${checked ? activeColor : 'bg-[#333]'}`}
  >
    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${checked ? 'left-4.5' : 'left-0.5'}`} style={{ left: checked ? '18px' : '2px'}} />
  </div>
);

const FeatureCard = ({ title, desc, icon: Icon, isActive, onToggle }: any) => (
  <div className="bg-[#111] p-5 rounded-sm border border-[#222] flex items-center justify-between group hover:border-[#444] transition-colors">
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-sm flex items-center justify-center transition-colors ${isActive ? 'bg-[#f5a623] text-black' : 'bg-[#000] border border-[#333] text-gray-500'}`}>
        <Icon size={18} />
      </div>
      <div>
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h4>
        <p className="text-[10px] text-gray-500 mt-1 font-mono">{desc}</p>
      </div>
    </div>
    <Switch checked={isActive} onChange={onToggle} />
  </div>
);

const ColorPicker = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
    <div className="flex items-center justify-between py-1">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        <div className="flex gap-1.5">
            {MARKDOWN_COLORS.map(c => (
                <button 
                    key={c.name} 
                    onClick={() => onChange(c.value)}
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${c.class} ${value === c.value ? 'border-white ring-1 ring-white/50' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    title={c.name}
                />
            ))}
        </div>
    </div>
);

const getStyle = (config: any, isSelected: boolean, showBounds: boolean) => ({
    fontSize: `${config.fontSize}px`,
    fontFamily: `${config.fontFamily || 'Courier Prime'}, "TamilDynamic", monospace`,
    fontWeight: config.bold ? 'bold' : 'normal',
    fontStyle: config.italic ? 'italic' : 'normal',
    textDecoration: config.underline ? 'underline' : 'none',
    color: config.color || '#000000',
    backgroundColor: config.highlightColor || 'transparent',
    lineHeight: config.lineHeight,
    letterSpacing: `${config.letterSpacing || 0}px`,
    marginTop: `${config.marginTop}rem`,
    marginBottom: `${config.marginBottom}rem`,
    marginLeft: config.marginLeft ? `${config.marginLeft}%` : '0',
    width: config.width ? `${config.width}%` : '100%',
    textAlign: config.textAlign || 'left',
    transition: 'all 0.2s',
    outline: 'none',
    boxShadow: 'none',
    position: 'relative' as any,
    zIndex: isSelected ? 10 : 1,
});

interface BackstageViewProps {
  onNavigateToBoard?: () => void;
}

const BackstageView: React.FC<BackstageViewProps> = ({ onNavigateToBoard }) => {
  const { 
    scriptConfig, setScriptConfig, scriptViewMode, setScriptViewMode,
    isTamilMode, setTamilMode, 
    isOsInputMode, setOsInputMode, osInputShortcut, setOsInputShortcut,
    storyboardConfig, setStoryboardConfig, isStoryboardFeatureEnabled, setStoryboardFeatureEnabled,
    scratchpadConfig, setScratchpadConfig,
    boardLayerOrder = ['annotations', 'text', 'connections', 'groups', 'beats'], setBoardLayerOrder,
    saveProject, loadProject, closeProject,
    beats,
    googleDriveConfig, setGoogleDriveConfig, connectToDrive, disconnectFromDrive, backupToDrive, isDriveSyncing, isDriveConnecting,
    geminiApiKey, setGeminiApiKey,
    stabilityApiKey, setStabilityApiKey,
    breakdownLanguage, setBreakdownLanguage,
    breakdownLockedOnly, setBreakdownLockedOnly,
    isPdfDropEnabled, setPdfDropEnabled,
    isRedoEnabled, setRedoEnabled
  } = useProject();

  const [activeCategory, setActiveCategory] = useState<'project' | 'formatting' | 'scratchpad' | 'board' | 'storyboard' | 'features'>('formatting');
  const [selectedFormatElement, setSelectedFormatElement] = useState<keyof ScriptConfig | 'visualization'>('action');
  
  // Preview States
  const [previewMode, setPreviewMode] = useState<'example' | 'real'>('example');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isPreviewDragging, setIsPreviewDragging] = useState(false); 
  
  // Install & API 
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [tempClientId, setTempClientId] = useState(googleDriveConfig.clientId || '');
  const [tempApiKey, setTempApiKey] = useState(googleDriveConfig.apiKey || '');
  const [tempGeminiKey, setTempGeminiKey] = useState(geminiApiKey || '');
  const [tempStabilityKey, setTempStabilityKey] = useState(stabilityApiKey || '');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed' | 'invalid'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [keyUpdateStatus, setKeyUpdateStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
      setTempGeminiKey(geminiApiKey || '');
      setTempStabilityKey(stabilityApiKey || '');
  }, [geminiApiKey, stabilityApiKey]);

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

  const handleDriveConnect = () => {
      connectToDrive(tempApiKey, tempClientId);
  };

  const handleTestConnection = async () => {
      setStatusMsg('');
      const key = tempGeminiKey.trim();

      if (!key) {
          setTestStatus('invalid');
          setStatusMsg("Please enter a key.");
          return;
      }

      if (key.includes(".apps.googleusercontent.com") || key.includes(".com")) {
          setTestStatus('invalid');
          setStatusMsg("❌ You entered a Client ID. Use an API Key (starts with 'AIza').");
          return;
      }

      if (!key.startsWith("AIza")) {
          setTestStatus('invalid');
          setStatusMsg("❌ Invalid Format. Google API Keys start with 'AIza'.");
          return;
      }
      
      setTestStatus('testing');
      try {
          const result = await generateText("Reply with the specific word: OK", 'gemini-3-flash-preview', key);
          
          if (result && result.trim().toUpperCase().includes("OK")) {
              setTestStatus('success');
              setStatusMsg("✅ Connection Successful!");
              setGeminiApiKey(key);
              updateGeminiConfig(key); 
          } else {
              setTestStatus('failed');
              setStatusMsg("Connection Failed. Key may be expired.");
          }
      } catch (error) {
          console.error("Test failed", error);
          setTestStatus('failed');
          setStatusMsg("Connection Failed. Check internet or key validity.");
      }
  };
  
  const handleUpdateKey = () => {
      setKeyUpdateStatus('saving');
      setGeminiApiKey(tempGeminiKey);
      updateGeminiConfig(tempGeminiKey);
      setTimeout(() => {
          setKeyUpdateStatus('saved');
          setTimeout(() => {
              setKeyUpdateStatus('idle');
          }, 2000); 
      }, 500);
  };

  // ... (rest of helper functions: handleFileLoad, updateFormat, setPaperTheme, moveLayer, getLayerLabel, getLayerIcon)
  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          loadProject(data);
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
              [elm]: { ...targetConfig, [prop]: val }
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
          case 'beats': return 'Beat Cards';
          case 'text': return 'Text Labels';
          case 'annotations': return 'Drawings';
          case 'connections': return 'Connections';
          case 'groups': return 'Scene Groups';
          default: return id;
      }
  };

  const getLayerIcon = (id: string) => {
      switch(id) {
          case 'beats': return <Box size={14} className="text-[#f5a623]" />;
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

  // ... (formatTabs, currentConfig, currentAlign, currentHighlight, slugContainerStyle, slugFontStyle, firstBeat logic)
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
  const currentHighlight = currentConfig?.highlightColor;

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
      fontFamily: `${scriptConfig.slugline.fontFamily}, "TamilDynamic", monospace`,
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
    <div className="w-full h-full bg-[#050505] flex overflow-hidden font-sans">
        
        {/* --- SIDEBAR --- */}
        <div className="w-60 bg-[#0a0a0a] border-r border-[#222] flex flex-col shrink-0 z-20 shadow-2xl">
           {/* ... existing sidebar code ... */}
           <div className="p-6">
              <h2 className="text-xs font-black text-[#f5a623] uppercase tracking-[0.2em] flex items-center gap-2 mb-1">
                  <SettingsIcon size={14} /> Backstage
              </h2>
              <p className="text-[10px] text-[#555] font-mono">SYSTEM CONFIG</p>
           </div>
           
           <nav className="flex-1 space-y-px mt-2">
              <SidebarItem 
                  active={activeCategory === 'project'} 
                  onClick={() => setActiveCategory('project')} 
                  icon={Save} label="Project & Files" 
                  desc="Save, Load, Export"
              />
              <SidebarItem 
                  active={activeCategory === 'formatting'} 
                  onClick={() => setActiveCategory('formatting')} 
                  icon={Type} label="Script Styling" 
                  desc="Fonts & Layout"
              />
              <SidebarItem 
                  active={activeCategory === 'scratchpad'} 
                  onClick={() => setActiveCategory('scratchpad')} 
                  icon={StickyNote} label="Notes & Scratchpad" 
                  desc="Editor Behavior"
              />
              <SidebarItem 
                  active={activeCategory === 'board'} 
                  onClick={() => setActiveCategory('board')} 
                  icon={Layers} label="Board Layers" 
                  desc="Z-Index Stack"
              />
              {isStoryboardFeatureEnabled && (
                  <SidebarItem 
                      active={activeCategory === 'storyboard'} 
                      onClick={() => setActiveCategory('storyboard')} 
                      icon={ImageIcon} label="Storyboard AI" 
                      desc="Visual Config"
                  />
              )}
              <SidebarItem 
                  active={activeCategory === 'features'} 
                  onClick={() => setActiveCategory('features')} 
                  icon={Sliders} label="Features" 
                  desc="Experimental"
              />
           </nav>
           
           <div className="p-4 border-t border-[#222]">
              <button 
                  onClick={closeProject}
                  className="w-full py-3 rounded-sm border border-red-900/30 bg-red-900/5 text-red-500 hover:bg-red-900/20 hover:text-red-400 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 group"
              >
                  <LogOut size={12} className="group-hover:-translate-x-1 transition-transform"/> Exit Project
              </button>
           </div>
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="flex-1 bg-[#0c0c0c] flex flex-col overflow-hidden relative">
            
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#f5a623]/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

            {/* 1. PROJECT VIEW */}
            {activeCategory === 'project' && (
                <ViewContainer title="Project Management" subtitle="Manage local data and export options.">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                        {/* ... existing project cards ... */}
                        <LargeActionCard 
                            onClick={saveProject}
                            icon={Save}
                            title="Save Project"
                            desc="Download a .bst (Backstage Story File) backup."
                            accent="text-[#f5a623]"
                        />
                        <LargeActionCard 
                            onClick={() => fileInputRef.current?.click()}
                            icon={Upload}
                            title="Load Project"
                            desc="Restore from a previously saved .json or .bst file."
                            accent="text-blue-500"
                        />
                        <input type="file" ref={fileInputRef} className="hidden" accept=".json,.bst" onChange={handleFileLoad} />
                        
                        <div className="md:col-span-2">
                            <LargeActionCard 
                                onClick={() => setShowPrintPreview(true)}
                                icon={Printer}
                                title="Print / Export PDF"
                                desc="Format your script for industry standard PDF output."
                                accent="text-green-500"
                            />
                        </div>

                        {/* GOOGLE DRIVE CONFIG (SAME AS BEFORE) */}
                        <div className="md:col-span-2 bg-[#111] p-6 rounded-sm border border-[#222] mt-4">
                            <div className="flex items-center gap-3 mb-6">
                                <div className={`p-2 rounded ${googleDriveConfig.enabled ? 'bg-green-500/10 text-green-500' : 'bg-[#222] text-gray-500'}`}>
                                    <Cloud size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Google Drive Backup</h4>
                                    <p className="text-[10px] text-gray-500">Auto-sync your project to a private Google Drive file.</p>
                                </div>
                            </div>

                            {!googleDriveConfig.enabled && (
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <Label>Client ID</Label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 text-xs text-white focus:border-[#f5a623] outline-none"
                                            value={tempClientId}
                                            onChange={(e) => setTempClientId(e.target.value)}
                                            placeholder="OAuth 2.0 Client ID"
                                        />
                                    </div>
                                    <div>
                                        <Label>API Key</Label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 text-xs text-white focus:border-[#f5a623] outline-none"
                                            value={tempApiKey}
                                            onChange={(e) => setTempApiKey(e.target.value)}
                                            placeholder="Drive API Key"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-4 border-t border-[#222] pt-4">
                                {googleDriveConfig.enabled ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-green-500 uppercase flex items-center gap-1"><Check size={12}/> Connected</span>
                                        </div>
                                        <button 
                                            onClick={() => backupToDrive(true)}
                                            disabled={isDriveSyncing}
                                            className="px-4 py-2 bg-[#222] hover:bg-[#333] text-white rounded text-xs font-bold uppercase flex items-center gap-2"
                                        >
                                            <RefreshCw size={12} className={isDriveSyncing ? "animate-spin" : ""} /> {isDriveSyncing ? "Syncing..." : "Sync Now"}
                                        </button>
                                        <div className="flex items-center gap-2 ml-auto">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase">Auto-Backup</span>
                                            <Switch checked={googleDriveConfig.autoBackup} onChange={(v: boolean) => setGoogleDriveConfig({...googleDriveConfig, autoBackup: v})} />
                                        </div>
                                        <button 
                                            onClick={disconnectFromDrive}
                                            className="px-4 py-2 border border-red-900 bg-red-900/10 text-red-500 hover:bg-red-900/20 rounded text-xs font-bold uppercase flex items-center gap-2"
                                        >
                                            <XCircle size={12} /> Disconnect
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={handleDriveConnect}
                                        disabled={isDriveConnecting}
                                        className="px-6 py-2 bg-[#f5a623] hover:bg-[#e09612] text-black rounded text-xs font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isDriveConnecting && <RefreshCw size={12} className="animate-spin" />}
                                        {isDriveConnecting ? 'Connecting...' : 'Connect Account'}
                                    </button>
                                )}
                            </div>
                            <div className="mt-2 text-[9px] text-gray-600 font-mono">
                                * Requires Google Cloud Project with Drive API enabled.
                            </div>
                        </div>
                    </div>
                </ViewContainer>
            )}

            {/* 2. FORMATTING SETTINGS */}
            {activeCategory === 'formatting' && (
                <div className="flex flex-col h-full animate-in fade-in duration-300">
                    {/* ... existing formatting UI code ... */}
                    {/* Header */}
                    <div className="px-8 py-6 shrink-0 z-10 bg-[#0c0c0c]/90 backdrop-blur-sm border-b border-[#222] flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                <Type className="text-[#f5a623]" size={20}/> Script Styling
                            </h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold text-[#555] uppercase tracking-widest">Global View</span>
                            <div className="flex bg-[#111] rounded-sm p-0.5 border border-[#222]">
                                <button 
                                    onClick={() => setScriptViewMode('page')}
                                    className={`px-3 py-1.5 rounded-sm flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${scriptViewMode === 'page' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-500 hover:text-white'}`}
                                ><FileText size={12} /> Page</button>
                                <button 
                                    onClick={() => setScriptViewMode('continuous')}
                                    className={`px-3 py-1.5 rounded-sm flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${scriptViewMode === 'continuous' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-500 hover:text-white'}`}
                                ><ScrollText size={12} /> Continuous</button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#0c0c0c]">
                        {/* LEFT: Controls */}
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
                                                        ? 'bg-[#f5a623]/10 border-[#f5a623] text-[#f5a623]' 
                                                        : 'bg-[#151515] border-[#222] text-gray-500 hover:border-[#333] hover:text-gray-300'}
                                                `}
                                            >
                                                {tab.icon && <tab.icon size={12} className={isActive ? 'text-[#f5a623]' : 'opacity-50'} />}
                                                <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* ... Rest of formatting sidebar ... */}
                                <div className="h-px bg-[#222] mb-4"></div>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setSelectedFormatElement('visualization')}
                                        className={`
                                            w-full flex items-center gap-2 px-3 py-3 rounded-sm border transition-all duration-200
                                            ${selectedFormatElement === 'visualization'
                                                ? 'bg-[#f5a623]/10 border-[#f5a623] text-[#f5a623]' 
                                                : 'bg-[#151515] border-[#222] text-gray-500 hover:border-[#333] hover:text-gray-300'}
                                        `}
                                    >
                                        <BoxSelect size={14} className={selectedFormatElement === 'visualization' ? 'text-[#f5a623]' : 'opacity-50'} />
                                        <div className="flex flex-col items-start">
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Layout Viz</span>
                                            <span className="text-[8px] opacity-60">Global Block Bounds</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Detailed Config Render ... omitted for brevity as it's unchanged */}
                            <div className="p-6 space-y-8">
                                {/* ... (Same as original file) ... */}
                                {selectedFormatElement === 'visualization' ? (
                                    /* ... */
                                    <Section title="Appearance" icon={Eye}>
                                        <div className="space-y-4">
                                            <Label>Paper Theme</Label>
                                            <div className="flex bg-[#111] rounded border border-[#333] p-0.5">
                                                <button onClick={() => setPaperTheme('white')} className={`flex-1 py-1.5 rounded flex items-center justify-center gap-2 ${scriptConfig.paperTheme === 'white' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}><Sun size={12}/> Light</button>
                                                <button onClick={() => setPaperTheme('sepia')} className={`flex-1 py-1.5 rounded flex items-center justify-center gap-2 ${scriptConfig.paperTheme === 'sepia' ? 'bg-[#fdf6e3] text-[#586e75]' : 'text-gray-500 hover:text-white'}`}><Coffee size={12}/> Sepia</button>
                                                <button onClick={() => setPaperTheme('dark')} className={`flex-1 py-1.5 rounded flex items-center justify-center gap-2 ${scriptConfig.paperTheme === 'dark' ? 'bg-[#1a1a1a] text-white' : 'text-gray-500 hover:text-white'}`}><Moon size={12}/> Dark</button>
                                            </div>
                                        </div>
                                    </Section>
                                ) : (
                                    /* ... */
                                    <Section title="Typography" icon={ALargeSmall}>
                                        {/* ... */}
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
                                            {/* ... */}
                                        </div>
                                    </Section>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Live Preview (Same as original) */}
                        <div className="flex-1 overflow-auto bg-[#0c0c0c] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] relative">
                            {/* ... Preview content ... */}
                            <div className="min-h-full flex items-center justify-center p-12">
                                <div className="bg-white w-full max-w-[210mm] aspect-[210/297] shadow-2xl rounded-sm p-16 overflow-hidden relative transition-all duration-500 shrink-0">
                                    <div className="absolute top-8 right-8 text-black/40 font-screenplay text-xs">1.</div>
                                    <div className="font-screenplay text-black text-[12pt] leading-tight w-full h-full relative">
                                        <div className="animate-in fade-in zoom-in duration-300">
                                            <div style={slugContainerStyle} className={`flex items-center rounded transition-all duration-200 sc-line ${selectedFormatElement === 'slugline' ? 'sc-active-block' : ''}`}>
                                                <span className="text-gray-400 mr-2 text-xs select-none">1.</span>
                                                <span style={slugFontStyle}>INT. COFFEE SHOP - DAY</span>
                                            </div>
                                            <div className={`sc-line sc-action ${selectedFormatElement === 'action' ? 'sc-active-block' : ''}`} style={getStyle(scriptConfig.action, false, false)}>The steam rises from a porcelain cup. JOHN (30s) sits nervously.</div>
                                            {/* ... more preview items ... */}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. NOTES & SCRATCHPAD */}
            {activeCategory === 'scratchpad' && (
                // ... same as original ...
                <ViewContainer title="Notes & Scratchpad" subtitle="Customize the editor behavior for notes.">
                    {/* ... content ... */}
                </ViewContainer>
            )}

            {/* 4. BOARD LAYERS */}
            {activeCategory === 'board' && (
                // ... same as original ...
                <ViewContainer title="Board Layers" subtitle="Adjust the visual stacking order of elements on the board.">
                    {/* ... content ... */}
                </ViewContainer>
            )}

            {/* 5. STORYBOARD CONFIG */}
            {activeCategory === 'storyboard' && (
                // ... same as original ...
                <ViewContainer title="Storyboard AI" subtitle="Configure generative models for shot visualization.">
                    {/* ... content ... */}
                </ViewContainer>
            )}

            {/* 6. FEATURES */}
            {activeCategory === 'features' && (
                <ViewContainer title="System Features" subtitle="Enable experimental tools and accessibility options.">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <FeatureCard 
                            title="Enable Redo History" 
                            desc="Allow re-applying undone changes. Keep off to save memory during heavy edits."
                            icon={RotateCw}
                            isActive={isRedoEnabled}
                            onToggle={setRedoEnabled}
                        />

                        {/* Breakdown Language */}
                        <div className="bg-[#111] p-5 rounded-sm border border-[#222] flex items-center justify-between group hover:border-[#444] transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-sm flex items-center justify-center bg-[#000] border border-[#333] text-gray-500`}>
                                    <ListChecks size={18} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Breakdown Language</h4>
                                    <p className="text-[10px] text-gray-500 mt-1 font-mono">Select the language for generated breakdown lists.</p>
                                </div>
                            </div>
                            <div className="flex bg-[#000] rounded p-0.5 border border-[#333]">
                                <button 
                                    onClick={() => setBreakdownLanguage('english')}
                                    className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${breakdownLanguage === 'english' ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`}
                                >English</button>
                                <button 
                                    onClick={() => setBreakdownLanguage('tamil')}
                                    className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${breakdownLanguage === 'tamil' ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`}
                                >Tamil</button>
                            </div>
                        </div>

                        {/* NEW: Breakdown Locked Only */}
                        <FeatureCard 
                            title="Analyze Locked Scenes Only" 
                            desc="If enabled, Breakdown Analysis will skip scenes not marked as 'Ready' (Locked)."
                            icon={Lock}
                            isActive={breakdownLockedOnly}
                            onToggle={setBreakdownLockedOnly}
                        />

                        <FeatureCard 
                            title="Tamil Transliteration" 
                            desc="Type phonetically in English to generate Tamil script automatically."
                            icon={Globe}
                            isActive={isTamilMode}
                            onToggle={setTamilMode}
                        />
                        <FeatureCard 
                            title="Storyboard AI" 
                            desc="Enable Generative AI features for creating storyboard visuals."
                            icon={ImageIcon}
                            isActive={isStoryboardFeatureEnabled}
                            onToggle={setStoryboardFeatureEnabled}
                        />
                        <FeatureCard 
                            title="PDF Drag-and-Drop Import" 
                            desc="Enable experimental PDF parsing. Drag a PDF onto the board to convert to beats."
                            icon={FileText}
                            isActive={isPdfDropEnabled}
                            onToggle={setPdfDropEnabled}
                        />
                        
                        {/* AI CONFIGURATION CARD (Same as before) */}
                        <div className="md:col-span-2 bg-[#1e1e1e] p-6 rounded-sm border border-[#f5a623] shadow-[0_0_15px_rgba(245,166,35,0.2)]">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-sm flex items-center justify-center bg-[#f5a623] text-black">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-white uppercase tracking-wider">Generative AI Configuration</h4>
                                    <p className="text-xs text-gray-400 mt-1">Required for Script Analysis (Gemini) and Default Image Generation.</p>
                                </div>
                            </div>
                            
                            <div className="bg-[#151515] p-4 rounded border border-[#333]">
                                <Label>Gemini API Key</Label>
                                <div className="flex gap-2 mb-2 relative">
                                    <Key size={14} className="absolute left-3 top-3 text-gray-500" />
                                    <input 
                                        type="password"
                                        value={tempGeminiKey}
                                        onChange={(e) => setTempGeminiKey(e.target.value)}
                                        placeholder="AIza..."
                                        className={`flex-1 bg-[#0a0a0a] border rounded px-3 py-2 pl-9 text-xs text-white outline-none font-mono transition-colors ${
                                            testStatus === 'invalid' ? 'border-red-500 focus:border-red-500' : 'border-[#333] focus:border-[#f5a623]'
                                        }`}
                                    />
                                    <button 
                                        onClick={handleTestConnection}
                                        className={`px-3 py-2 rounded text-xs font-bold uppercase border transition-all flex items-center gap-2 ${
                                            testStatus === 'success' ? 'bg-green-900/30 border-green-600 text-green-500' :
                                            testStatus === 'failed' || testStatus === 'invalid' ? 'bg-red-900/30 border-red-600 text-red-500' :
                                            testStatus === 'testing' ? 'bg-[#222] border-[#444] text-white' :
                                            'bg-[#222] border-[#333] text-gray-400 hover:bg-[#333] hover:text-white'
                                        }`}
                                        title="Test Connection"
                                        disabled={testStatus === 'testing' || !tempGeminiKey}
                                    >
                                        {testStatus === 'testing' ? <RefreshCw size={12} className="animate-spin"/> : 
                                         testStatus === 'success' ? <ShieldCheck size={12}/> : 
                                         testStatus === 'failed' || testStatus === 'invalid' ? <ShieldAlert size={12}/> :
                                         <Wifi size={12}/>}
                                        {testStatus === 'testing' ? 'Testing...' : 'Test'}
                                    </button>
                                    <button 
                                        onClick={handleUpdateKey}
                                        disabled={keyUpdateStatus !== 'idle'}
                                        className={`px-4 py-2 rounded text-xs font-bold uppercase flex items-center gap-2 transition-all min-w-[100px] justify-center ${
                                            keyUpdateStatus === 'saved' ? 'bg-green-500 text-black' : 
                                            keyUpdateStatus === 'saving' ? 'bg-[#333] text-white' :
                                            'bg-[#f5a623] hover:bg-[#e09612] text-black'
                                        }`}
                                    >
                                        {keyUpdateStatus === 'saving' && <RefreshCw size={14} className="animate-spin" />}
                                        {keyUpdateStatus === 'saved' && <Check size={14} />}
                                        {keyUpdateStatus === 'idle' && 'Update'}
                                        {keyUpdateStatus === 'saving' && 'Saving...'}
                                        {keyUpdateStatus === 'saved' && 'Saved!'}
                                    </button>
                                </div>
                                {statusMsg && (
                                    <p className={`text-[10px] mt-1 font-bold flex items-center gap-1.5 ${
                                        testStatus === 'success' ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                        {testStatus !== 'success' && <AlertTriangle size={10}/>} {statusMsg}
                                    </p>
                                )}
                                <p className="text-[9px] text-gray-500 mt-2 font-mono leading-relaxed">
                                    <span className="text-[#f5a623]">Note:</span> This key must start with "AIza". Do not use a Client ID. 
                                    This key is stored locally in your project file.
                                </p>
                            </div>
                        </div>

                        {installPrompt && (
                            <div 
                                className="bg-[#1e1e1e] p-5 rounded-sm border border-[#f5a623] shadow-[0_0_15px_rgba(245,166,35,0.2)] flex items-center justify-between group cursor-pointer hover:bg-[#252525] transition-colors"
                                onClick={handleInstallApp}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-sm flex items-center justify-center bg-[#f5a623] text-black">
                                        <Download size={20} strokeWidth={3} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Install Web App</h4>
                                        <p className="text-[10px] text-gray-400 mt-1 font-mono">Install Backstage as a native desktop application.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* OS Input Mode (Same as before) */}
                        <div className="md:col-span-2 bg-[#111] p-6 rounded-sm border border-[#222]">
                            {/* ... */}
                        </div>
                    </div>
                </ViewContainer>
            )}

        </div>
    </div>
  );
};

export default BackstageView;
