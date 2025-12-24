import React, { useState, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { ScriptConfig } from '../types';
import { 
  X, Sliders, Keyboard, FileText, Save, Upload, Printer, 
  Bold, Italic, Underline, Monitor, Type, AlignLeft, 
  MoveVertical, MoveHorizontal, Palette, Settings as SettingsIcon, Eye, Check,
  Highlighter
} from 'lucide-react';
import PrintPreviewModal from './PrintPreviewModal';

interface SettingsModalProps {
  onClose: () => void;
}

const TEXT_COLORS = [
  { name: 'Black', value: '#000000', class: 'bg-black' },
  { name: 'Charcoal', value: '#333333', class: 'bg-[#333]' },
  { name: 'Midnight Blue', value: '#1e3a8a', class: 'bg-blue-900' },
  { name: 'Dark Green', value: '#14532d', class: 'bg-green-900' },
  { name: 'Maroon', value: '#7f1d1d', class: 'bg-red-900' },
];

const HIGHLIGHT_COLORS = [
  { name: 'None', value: null, class: 'bg-transparent border-dashed border-gray-500' },
  { name: 'Yellow', value: '#fef08a', class: 'bg-yellow-200' },
  { name: 'Green', value: '#bbf7d0', class: 'bg-green-200' },
  { name: 'Blue', value: '#bfdbfe', class: 'bg-blue-200' },
  { name: 'Pink', value: '#fbcfe8', class: 'bg-pink-200' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { 
    scriptConfig, setScriptConfig, 
    isTamilMode, setTamilMode,
    isOsInputMode, setOsInputMode, osInputShortcut, setOsInputShortcut,
    saveProject, loadProject
  } = useProject();

  const [activeCategory, setActiveCategory] = useState<'project' | 'formatting' | 'features'>('formatting');
  const [selectedFormatElement, setSelectedFormatElement] = useState<keyof ScriptConfig>('slugline');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          loadProject(data);
          alert("Project Loaded Successfully!");
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
       const targetConfig = scriptConfig[elm];
       if (typeof targetConfig === 'object' && targetConfig !== null) {
           setScriptConfig({
              ...scriptConfig,
              [elm]: { ...targetConfig, [prop]: val }
           });
       }
    }
  };

  // If Print Preview is open, show it instead of the settings
  if (showPrintPreview) {
    return <PrintPreviewModal onClose={() => setShowPrintPreview(false)} />;
  }

  const formatElements: { id: keyof ScriptConfig; label: string }[] = [
    { id: 'slugline', label: 'Slugline (Scene Header)' },
    { id: 'action', label: 'Action' },
    { id: 'character', label: 'Character' },
    { id: 'dialogue', label: 'Dialogue' },
    { id: 'parenthetical', label: 'Parenthetical' },
    { id: 'transition', label: 'Transition' },
  ];

  // Helper styles for the Slugline preview
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
      fontWeight: scriptConfig.slugline.bold ? 'bold' : 'normal',
      fontStyle: scriptConfig.slugline.italic ? 'italic' : 'normal',
      textDecoration: scriptConfig.slugline.underline ? 'underline' : 'none',
      color: scriptConfig.slugline.color || '#000000'
  };

  const currentColor = scriptConfig[selectedFormatElement as any].color || '#000000';
  const currentHighlight = scriptConfig[selectedFormatElement as any].highlightColor;

  return (
    <div className="fixed inset-0 bg-black/90 z-[3000] flex items-center justify-center backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-[900px] h-[85vh] bg-[#121212] border border-[#333] rounded-2xl shadow-2xl flex overflow-hidden relative">
        
        {/* SIDEBAR NAVIGATION */}
        <div className="w-64 bg-[#1a1a1a] border-r border-[#333] flex flex-col">
           <div className="p-6 border-b border-[#333]">
              <h2 className="text-sm font-black text-[#f5a623] uppercase tracking-widest flex items-center gap-2">
                  <SettingsIcon size={16} /> Settings
              </h2>
           </div>
           
           <div className="flex-1 py-4 px-3 space-y-1">
              <button 
                onClick={() => setActiveCategory('project')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${activeCategory === 'project' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-[#888] hover:text-white hover:bg-[#222]'}`}
              >
                 <Save size={16} /> Project & Files
              </button>
              <button 
                onClick={() => setActiveCategory('formatting')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${activeCategory === 'formatting' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-[#888] hover:text-white hover:bg-[#222]'}`}
              >
                 <Type size={16} /> Formatting
              </button>
              <button 
                onClick={() => setActiveCategory('features')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${activeCategory === 'features' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-[#888] hover:text-white hover:bg-[#222]'}`}
              >
                 <Sliders size={16} /> Features
              </button>
           </div>

           <div className="p-4 border-t border-[#333]">
              <button onClick={onClose} className="w-full py-2.5 rounded-lg border border-[#444] text-[#888] hover:text-white hover:bg-[#333] hover:border-[#666] text-xs font-bold uppercase transition-all">
                 Close Settings
              </button>
           </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 bg-[#121212] flex flex-col overflow-hidden">
            
            {/* 1. PROJECT SETTINGS */}
            {activeCategory === 'project' && (
                <div className="flex-1 overflow-y-auto p-8 animate-in slide-in-from-right-4 duration-300">
                    <h3 className="text-xl font-bold text-white mb-6">Project Management</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div onClick={saveProject} className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333] hover:border-[#f5a623] cursor-pointer transition-all hover:bg-[#252525] group">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-[#2a2a2a] rounded-full group-hover:bg-[#f5a623]/20 transition-colors"><Save size={24} className="text-[#888] group-hover:text-[#f5a623]" /></div>
                                <span className="text-lg font-bold text-gray-200">Save Project</span>
                            </div>
                            <p className="text-xs text-gray-500 ml-[60px]">Download local .json backup</p>
                        </div>

                        <div onClick={() => fileInputRef.current?.click()} className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333] hover:border-blue-500 cursor-pointer transition-all hover:bg-[#252525] group">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-[#2a2a2a] rounded-full group-hover:bg-blue-500/20 transition-colors"><Upload size={24} className="text-[#888] group-hover:text-blue-500" /></div>
                                <span className="text-lg font-bold text-gray-200">Load Project</span>
                            </div>
                            <p className="text-xs text-gray-500 ml-[60px]">Restore from .json file</p>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileLoad} />
                        </div>

                        <div onClick={() => setShowPrintPreview(true)} className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333] hover:border-green-500 cursor-pointer transition-all hover:bg-[#252525] group col-span-2">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-[#2a2a2a] rounded-full group-hover:bg-green-500/20 transition-colors"><Printer size={24} className="text-[#888] group-hover:text-green-500" /></div>
                                <span className="text-lg font-bold text-gray-200">Print / Export PDF</span>
                            </div>
                            <p className="text-xs text-gray-500 ml-[60px]">Standard industry formatting export</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. FORMATTING SETTINGS (MASTER-DETAIL) */}
            {activeCategory === 'formatting' && (
                <div className="flex h-full animate-in slide-in-from-right-4 duration-300">
                    
                    {/* Element List */}
                    <div className="w-56 border-r border-[#333] overflow-y-auto bg-[#161616]">
                        <div className="p-4 text-xs font-bold text-[#666] uppercase tracking-wider">Elements</div>
                        {formatElements.map(el => (
                            <button
                                key={el.id}
                                onClick={() => setSelectedFormatElement(el.id)}
                                className={`w-full text-left px-5 py-3 text-sm font-medium transition-colors border-l-2 ${selectedFormatElement === el.id ? 'bg-[#222] text-[#f5a623] border-[#f5a623]' : 'border-transparent text-[#999] hover:bg-[#1e1e1e] hover:text-white'}`}
                            >
                                {el.label}
                            </button>
                        ))}
                    </div>

                    {/* Controls & Preview */}
                    <div className="flex-1 overflow-y-auto bg-[#121212] flex flex-col">
                        <div className="p-8">
                            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                {formatElements.find(e => e.id === selectedFormatElement)?.label}
                            </h3>
                            <p className="text-xs text-[#666] mb-8">Customize appearance and layout for this element type.</p>

                            <div className="space-y-8 max-w-2xl">
                                
                                {/* Typography Group */}
                                <div className="bg-[#1e1e1e] rounded-xl border border-[#333] p-5">
                                    <div className="flex items-center gap-2 mb-4 text-[#888] text-xs font-bold uppercase tracking-wider">
                                        <Type size={14} /> Typography
                                    </div>
                                    <div className="flex gap-4 items-center mb-6 flex-wrap">
                                        {/* Style Toggles */}
                                        <div className="flex bg-[#111] rounded-lg p-1 border border-[#333]">
                                            <button 
                                                onClick={() => updateFormat(selectedFormatElement, 'bold', !scriptConfig[selectedFormatElement as any].bold)}
                                                className={`p-2 rounded hover:bg-[#333] transition-colors ${scriptConfig[selectedFormatElement as any].bold ? 'text-[#f5a623] bg-[#f5a623]/10' : 'text-[#666]'}`}
                                                title="Bold"
                                            ><Bold size={18} /></button>
                                            <button 
                                                onClick={() => updateFormat(selectedFormatElement, 'italic', !scriptConfig[selectedFormatElement as any].italic)}
                                                className={`p-2 rounded hover:bg-[#333] transition-colors ${scriptConfig[selectedFormatElement as any].italic ? 'text-[#f5a623] bg-[#f5a623]/10' : 'text-[#666]'}`}
                                                title="Italic"
                                            ><Italic size={18} /></button>
                                            <button 
                                                onClick={() => updateFormat(selectedFormatElement, 'underline', !scriptConfig[selectedFormatElement as any].underline)}
                                                className={`p-2 rounded hover:bg-[#333] transition-colors ${scriptConfig[selectedFormatElement as any].underline ? 'text-[#f5a623] bg-[#f5a623]/10' : 'text-[#666]'}`}
                                                title="Underline"
                                            ><Underline size={18} /></button>
                                        </div>
                                        
                                        <div className="w-[1px] h-6 bg-[#333]"></div>

                                        {/* Color Palette (Text) */}
                                        <div className="flex items-center gap-2">
                                            {TEXT_COLORS.map(color => (
                                                <button
                                                    key={color.name}
                                                    onClick={() => updateFormat(selectedFormatElement, 'color', color.value)}
                                                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${color.class} ${currentColor === color.value ? 'border-[#f5a623] shadow-[0_0_8px_rgba(245,166,35,0.4)]' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                                    title={`Text: ${color.name}`}
                                                >
                                                    {currentColor === color.value && <Check size={12} className="text-white" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Font Size Slider */}
                                    <div className="mb-6">
                                        <div className="flex justify-between mb-2 text-xs text-[#999]">
                                            <span>Font Size</span> <span className="text-white">{(scriptConfig[selectedFormatElement as any] as any).fontSize}px</span>
                                        </div>
                                        <input 
                                            type="range" min="10" max="32" 
                                            value={(scriptConfig[selectedFormatElement as any] as any).fontSize} 
                                            onChange={e => updateFormat(selectedFormatElement, 'fontSize', parseInt(e.target.value))} 
                                            className="w-full accent-[#f5a623] h-1 bg-[#333] rounded-lg appearance-none cursor-pointer" 
                                        />
                                    </div>

                                    {/* Scene Number Size (Slugline Only) */}
                                    {selectedFormatElement === 'slugline' && (
                                        <div>
                                            <div className="flex justify-between mb-2 text-xs text-[#999]">
                                                <span>Scene # Size</span> <span className="text-white">{scriptConfig.slugline.sceneNumberFontSize}px</span>
                                            </div>
                                            <input type="range" min="8" max="24" value={scriptConfig.slugline.sceneNumberFontSize} onChange={e => updateFormat('slugline', 'sceneNumberFontSize', parseInt(e.target.value))} className="w-full accent-[#f5a623] h-1 bg-[#333] rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                    )}
                                </div>

                                {/* Highlighting Group */}
                                <div className="bg-[#1e1e1e] rounded-xl border border-[#333] p-5">
                                    <div className="flex items-center gap-2 mb-4 text-[#888] text-xs font-bold uppercase tracking-wider">
                                        <Highlighter size={14} /> Highlighter
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {HIGHLIGHT_COLORS.map(color => (
                                            <button
                                                key={color.name}
                                                onClick={() => updateFormat(selectedFormatElement, 'highlightColor', color.value)}
                                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${color.class} ${currentHighlight === color.value ? 'border-[#f5a623] shadow-[0_0_8px_rgba(245,166,35,0.4)]' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                                title={`Highlight: ${color.name}`}
                                            >
                                                {currentHighlight === color.value && <Check size={14} className="text-black/50" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Spacing Group */}
                                <div className="bg-[#1e1e1e] rounded-xl border border-[#333] p-5">
                                    <div className="flex items-center gap-2 mb-4 text-[#888] text-xs font-bold uppercase tracking-wider">
                                        <MoveVertical size={14} /> Spacing (Gaps)
                                    </div>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div>
                                            <div className="flex justify-between mb-2 text-xs text-[#999]">
                                                <span>Margin Top (rem)</span> <span className="text-white">{scriptConfig[selectedFormatElement as any].marginTop}</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="5" step="0.1"
                                                value={scriptConfig[selectedFormatElement as any].marginTop} 
                                                onChange={e => updateFormat(selectedFormatElement, 'marginTop', parseFloat(e.target.value))} 
                                                className="w-full accent-[#f5a623] h-1 bg-[#333] rounded-lg appearance-none cursor-pointer" 
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-2 text-xs text-[#999]">
                                                <span>Margin Bottom (rem)</span> <span className="text-white">{scriptConfig[selectedFormatElement as any].marginBottom}</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="5" step="0.1"
                                                value={scriptConfig[selectedFormatElement as any].marginBottom} 
                                                onChange={e => updateFormat(selectedFormatElement, 'marginBottom', parseFloat(e.target.value))} 
                                                className="w-full accent-[#f5a623] h-1 bg-[#333] rounded-lg appearance-none cursor-pointer" 
                                            />
                                        </div>
                                    </div>
                                    
                                    {selectedFormatElement === 'slugline' && (
                                        <div className="grid grid-cols-2 gap-8 mt-6 pt-6 border-t border-[#333]">
                                            <div className="col-span-2 mb-4 flex items-center justify-between">
                                                <label className="text-xs text-[#999]">Enable Box Padding</label>
                                                <div 
                                                    onClick={() => updateFormat('slugline', 'paddingEnabled', !scriptConfig.slugline.paddingEnabled)}
                                                    className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${scriptConfig.slugline.paddingEnabled ? 'bg-[#f5a623]' : 'bg-gray-600'}`}
                                                >
                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${scriptConfig.slugline.paddingEnabled ? 'left-6' : 'left-1'}`} />
                                                </div>
                                            </div>
                                            
                                            <div className={!scriptConfig.slugline.paddingEnabled ? 'opacity-50 pointer-events-none' : ''}>
                                                <div className="flex justify-between mb-2 text-xs text-[#999]">
                                                    <span>Internal Padding V (px)</span> <span className="text-white">{scriptConfig.slugline.paddingVertical}</span>
                                                </div>
                                                <input type="range" min="0" max="20" value={scriptConfig.slugline.paddingVertical} onChange={e => updateFormat('slugline', 'paddingVertical', parseInt(e.target.value))} className="w-full accent-[#f5a623] h-1 bg-[#333] rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                            <div className={!scriptConfig.slugline.paddingEnabled ? 'opacity-50 pointer-events-none' : ''}>
                                                <div className="flex justify-between mb-2 text-xs text-[#999]">
                                                    <span>Internal Padding H (px)</span> <span className="text-white">{scriptConfig.slugline.paddingHorizontal}</span>
                                                </div>
                                                <input type="range" min="0" max="20" value={scriptConfig.slugline.paddingHorizontal} onChange={e => updateFormat('slugline', 'paddingHorizontal', parseInt(e.target.value))} className="w-full accent-[#f5a623] h-1 bg-[#333] rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Geometry Group */}
                                {selectedFormatElement !== 'slugline' && (
                                    <div className="bg-[#1e1e1e] rounded-xl border border-[#333] p-5">
                                        <div className="flex items-center gap-2 mb-4 text-[#888] text-xs font-bold uppercase tracking-wider">
                                            <MoveHorizontal size={14} /> Geometry
                                        </div>
                                        <div className="grid grid-cols-2 gap-8">
                                            <div>
                                                <div className="flex justify-between mb-2 text-xs text-[#999]">
                                                    <span>Indent / Left Margin (%)</span> <span className="text-white">{(scriptConfig[selectedFormatElement as any] as any).marginLeft}%</span>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="100" 
                                                    value={(scriptConfig[selectedFormatElement as any] as any).marginLeft} 
                                                    onChange={e => updateFormat(selectedFormatElement, 'marginLeft', parseInt(e.target.value))} 
                                                    className="w-full accent-[#f5a623] h-1 bg-[#333] rounded-lg appearance-none cursor-pointer" 
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-2 text-xs text-[#999]">
                                                    <span>Width (%)</span> <span className="text-white">{(scriptConfig[selectedFormatElement as any] as any).width}%</span>
                                                </div>
                                                <input 
                                                    type="range" min="10" max="100" 
                                                    value={(scriptConfig[selectedFormatElement as any] as any).width} 
                                                    onChange={e => updateFormat(selectedFormatElement, 'width', parseInt(e.target.value))} 
                                                    className="w-full accent-[#f5a623] h-1 bg-[#333] rounded-lg appearance-none cursor-pointer" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* LIVE PREVIEW SECTION */}
                                <div className="mt-8 border-t border-[#333] pt-8">
                                    <div className="flex items-center gap-2 mb-4 text-[#888] text-xs font-bold uppercase tracking-wider">
                                        <Eye size={14} /> Live Preview
                                    </div>
                                    
                                    <div className="bg-white border border-gray-300 rounded-xl overflow-hidden p-6 relative shadow-inner">
                                        <div className="absolute top-3 right-3 text-[10px] text-gray-400 font-bold uppercase">Editor Canvas</div>
                                        
                                        <div className="font-screenplay leading-tight text-black select-none" style={{ fontSize: '16px' }}>
                                            
                                            {/* Slugline Preview */}
                                            <div 
                                                className={`flex items-center rounded transition-colors border border-transparent ${selectedFormatElement === 'slugline' ? 'ring-2 ring-[#f5a623] z-10 relative' : 'opacity-80'}`}
                                                style={slugContainerStyle}
                                            >
                                                <span className="text-gray-500 mr-2 select-none" style={{fontSize: `${scriptConfig.slugline.sceneNumberFontSize}px`}}>1.</span>
                                                <span className="uppercase" style={slugFontStyle}>INT. COFFEE SHOP - DAY</span>
                                            </div>

                                            {/* Action Preview */}
                                            <div 
                                                className={`sc-line sc-action transition-opacity ${selectedFormatElement === 'action' ? 'ring-2 ring-[#f5a623]/50 z-10 relative' : 'opacity-80'}`}
                                                style={{ fontSize: `${scriptConfig.action.fontSize}px`, backgroundColor: scriptConfig.action.highlightColor || 'transparent' }}
                                            >
                                                The steam rises from a porcelain cup. JOHN (30s) sits nervously, tapping his foot against the table leg.
                                            </div>

                                            {/* Character Preview */}
                                            <div 
                                                className={`sc-line sc-character transition-opacity ${selectedFormatElement === 'character' ? 'ring-2 ring-[#f5a623]/50 z-10 relative' : 'opacity-80'}`}
                                                style={{ fontSize: `${scriptConfig.character.fontSize}px`, backgroundColor: scriptConfig.character.highlightColor || 'transparent' }}
                                            >
                                                JOHN
                                            </div>

                                            {/* Parenthetical Preview */}
                                            <div 
                                                className={`sc-line sc-parenthetical transition-opacity ${selectedFormatElement === 'parenthetical' ? 'ring-2 ring-[#f5a623]/50 z-10 relative' : 'opacity-80'}`}
                                                style={{ fontSize: `${scriptConfig.parenthetical.fontSize}px`, backgroundColor: scriptConfig.parenthetical.highlightColor || 'transparent' }}
                                            >
                                                (to himself)
                                            </div>

                                            {/* Dialogue Preview */}
                                            <div 
                                                className={`sc-line sc-dialogue transition-opacity ${selectedFormatElement === 'dialogue' ? 'ring-2 ring-[#f5a623]/50 z-10 relative' : 'opacity-80'}`}
                                                style={{ fontSize: `${scriptConfig.dialogue.fontSize}px`, backgroundColor: scriptConfig.dialogue.highlightColor || 'transparent' }}
                                            >
                                                This is taking longer than I expected. Maybe she's not coming.
                                            </div>

                                            {/* Transition Preview */}
                                            <div 
                                                className={`sc-line sc-transition transition-opacity ${selectedFormatElement === 'transition' ? 'ring-2 ring-[#f5a623]/50 z-10 relative' : 'opacity-80'}`}
                                                style={{ fontSize: `${scriptConfig.transition.fontSize}px`, backgroundColor: scriptConfig.transition.highlightColor || 'transparent' }}
                                            >
                                                CUT TO:
                                            </div>

                                            {/* Action Preview (Follow up) */}
                                            <div 
                                                className={`sc-line sc-action transition-opacity ${selectedFormatElement === 'action' ? 'ring-2 ring-[#f5a623]/50 z-10 relative' : 'opacity-80'}`}
                                                style={{ fontSize: `${scriptConfig.action.fontSize}px`, backgroundColor: scriptConfig.action.highlightColor || 'transparent' }}
                                            >
                                                He checks his watch again.
                                            </div>

                                        </div>
                                    </div>
                                    <p className="text-[10px] text-[#555] mt-2 text-center">Preview uses your current layout settings.</p>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. FEATURES SETTINGS */}
            {activeCategory === 'features' && (
                <div className="flex-1 overflow-y-auto p-8 animate-in slide-in-from-right-4 duration-300">
                    <h3 className="text-xl font-bold text-white mb-6">Features & Accessibility</h3>
                    
                    <div className="grid grid-cols-1 gap-4 max-w-3xl">
                        {/* Tamil Mode */}
                        <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333] flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold transition-colors ${isTamilMode ? 'bg-[#f5a623] text-black shadow-[0_0_15px_rgba(245,166,35,0.4)]' : 'bg-[#2a2a2a] text-gray-500'}`}>
                                    அ
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-white">Tamil Transliteration</h4>
                                    <p className="text-xs text-gray-500 mt-1 max-w-sm">Enable phonetic typing suggestions. Type in English (Tanglish), get Tamil script.</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={isTamilMode} onChange={(e) => setTamilMode(e.target.checked)} className="sr-only peer" />
                                <div className="w-12 h-7 bg-[#333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#f5a623]"></div>
                            </label>
                        </div>

                        {/* OS Input Mode */}
                        <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#333]">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold transition-colors ${isOsInputMode ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-[#2a2a2a] text-gray-500'}`}>
                                        <Keyboard size={28} />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-white">OS Input Trigger</h4>
                                        <p className="text-xs text-gray-500 mt-1 max-w-sm">Simulate a specific key press when entering/leaving Dialogue blocks (e.g., for controlling lighting software).</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={isOsInputMode} onChange={(e) => setOsInputMode(e.target.checked)} className="sr-only peer" />
                                    <div className="w-12 h-7 bg-[#333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                            </div>
                            
                            {isOsInputMode && (
                                <div className="bg-[#151515] p-4 rounded-lg border border-[#333] ml-[76px]">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2 tracking-wider">Trigger Key</label>
                                    <div className="relative">
                                        <select 
                                            value={osInputShortcut} 
                                            onChange={(e) => setOsInputShortcut(e.target.value)}
                                            className="w-full bg-[#222] border border-[#444] text-white p-2.5 rounded-md text-sm outline-none focus:border-blue-500 appearance-none"
                                        >
                                            <option value="NumLock">Num Lock</option>
                                            <option value="ScrollLock">Scroll Lock</option>
                                            <option value="F1">F1</option>
                                            <option value="F13">F13</option>
                                            <option value="Alt+L">Alt + L</option>
                                        </select>
                                        <Keyboard size={14} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;