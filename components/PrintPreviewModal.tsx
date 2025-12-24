
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { PrintSettings, TextStyleConfig, Beat } from '../types';
import { 
  X, Printer, FileText, Layout, Palette, ListFilter, CheckCircle2, 
  Maximize, MapPin, User, Minus, Plus, Download, Loader2, Check,
  Bold, Italic, Underline, BookOpen, Image as ImageIcon, Users
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface PrintPreviewModalProps {
  onClose: () => void;
}

const HIGHLIGHT_COLORS = [
  { label: 'None', value: null },
  { label: 'Light Gray', value: '#f3f4f6' },
  { label: 'Gray', value: '#d1d5db' },
  { label: 'Yellow', value: '#fff59d' },
  { label: 'Green', value: '#a5d6a7' },
  { label: 'Blue', value: '#90caf9' },
  { label: 'Pink', value: '#f48fb1' },
];

const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ onClose }) => {
  const { beats, scriptConfig, characterData, generatedShots, projectList, currentProjectId } = useProject();
  const [activeTab, setActiveTab] = useState<'layout' | 'sections' | 'style' | 'content'>('sections');
  const [scale, setScale] = useState(0.65);
  const [isExporting, setIsExporting] = useState(false);
  
  // Bible Sections State
  const [sections, setSections] = useState({
      cover: true,
      characters: false,
      storyboard: false,
      script: true
  });

  // Pagination State
  const [pages, setPages] = useState<Beat[][]>([]);
  const hiddenRef = useRef<HTMLDivElement>(null);
  const bibleRef = useRef<HTMLDivElement>(null);
  
  // Project Info
  const currentProjectName = projectList.find(p => p.id === currentProjectId)?.name || "Untitled Project";
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Initialize settings
  const [settings, setSettings] = useState<PrintSettings>(() => ({
    paperSize: 'a4',
    marginTop: 1.0,
    marginBottom: 1.0,
    marginLeft: 1.5,
    marginRight: 1.0,
    showPageNumbers: true,
    sceneNumbers: true,
    selectedLocations: [],
    selectedCharacters: [],
    styles: {
      slugline: { ...scriptConfig.slugline },
      action: { ...scriptConfig.action },
      character: { ...scriptConfig.character },
      dialogue: { ...scriptConfig.dialogue },
      parenthetical: { ...scriptConfig.parenthetical },
      transition: { ...scriptConfig.transition }
    }
  }));

  // --- DATA PROCESSING ---
  const { allLocations, allCharacters } = useMemo(() => {
    const locs = new Set<string>();
    const chars = new Set<string>();
    beats.forEach(b => {
      if (b.slug.location) locs.add(b.slug.location.trim());
      const div = document.createElement('div');
      div.innerHTML = b.content;
      div.querySelectorAll('.sc-character').forEach(el => {
        const name = el.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
        if (name) chars.add(name);
      });
    });
    return {
      allLocations: Array.from(locs).sort(),
      allCharacters: Array.from(chars).sort()
    };
  }, [beats]);

  const filteredBeats = useMemo(() => {
    let result = [...beats].sort((a, b) => a.x - b.x);
    if (settings.selectedLocations.length > 0) {
      result = result.filter(b => settings.selectedLocations.includes(b.slug.location.trim()));
    }
    if (settings.selectedCharacters.length > 0) {
      result = result.filter(b => {
        const div = document.createElement('div');
        div.innerHTML = b.content;
        const charsInScene = Array.from(div.querySelectorAll('.sc-character'))
          .map(el => el.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase());
        return settings.selectedCharacters.some(c => charsInScene.includes(c));
      });
    }
    return result;
  }, [beats, settings.selectedLocations, settings.selectedCharacters]);

  // --- SCRIPT PAGINATION EFFECT ---
  useEffect(() => {
    if (!hiddenRef.current) return;

    // Wait for DOM to render hidden elements
    setTimeout(() => {
        if (!hiddenRef.current) return;
        
        // CSS Inches -> Pixels (Approx 96 DPI for screen preview)
        const DPI = 96;
        const PAGE_HEIGHT = settings.paperSize === 'letter' ? 11 * DPI : 11.69 * DPI;
        
        const topPx = settings.marginTop * DPI;
        const bottomPx = settings.marginBottom * DPI;
        const writableHeight = PAGE_HEIGHT - (topPx + bottomPx);

        const newPages: Beat[][] = [];
        let currentPage: Beat[] = [];
        let currentH = 0;

        const children = Array.from(hiddenRef.current.children) as HTMLElement[];

        children.forEach((child, index) => {
            const h = child.offsetHeight; 
            const marginBottom = 16; 
            const totalItemHeight = h + marginBottom;

            if (currentH + totalItemHeight > writableHeight && currentPage.length > 0) {
                newPages.push(currentPage);
                currentPage = [];
                currentH = 0;
            }

            currentPage.push(filteredBeats[index]);
            currentH += totalItemHeight;
        });

        if (currentPage.length > 0) newPages.push(currentPage);
        if (newPages.length === 0 && filteredBeats.length === 0) setPages([[]]);
        else setPages(newPages);
    }, 50);

  }, [filteredBeats, settings]);

  // --- STYLES ---
  const dynamicCss = useMemo(() => {
    const genRule = (className: string, config: TextStyleConfig) => `
      ${className} {
        font-weight: ${config.bold ? 'bold' : 'normal'} !important;
        font-style: ${config.italic ? 'italic' : 'normal'} !important;
        text-decoration: ${config.underline ? 'underline' : 'none'} !important;
        background-color: ${config.highlightColor || 'transparent'} !important;
      }
    `;
    return `
      .bible-page {
         background: white;
         color: black;
         box-shadow: 0 0 50px -10px rgba(0,0,0,0.5);
         margin-bottom: 40px;
         position: relative;
         overflow: hidden;
      }
      ${genRule('.print-slugline', settings.styles.slugline)}
      ${genRule('.sc-action', settings.styles.action)}
      ${genRule('.sc-character', settings.styles.character)}
      ${genRule('.sc-dialogue', settings.styles.dialogue)}
      ${genRule('.sc-parenthetical', settings.styles.parenthetical)}
      ${genRule('.sc-transition', settings.styles.transition)}
    `;
  }, [settings]);

  useEffect(() => {
    const styleId = 'preview-dynamic-styles';
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    style.innerHTML = dynamicCss;
  }, [dynamicCss]);

  // --- EXPORT PDF ---
  const handleDownloadPDF = async () => {
    setIsExporting(true);
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: settings.paperSize
      });

      // We capture everything inside the main scrollable area
      const scrollContainer = document.getElementById('preview-scroll-container');
      if (!scrollContainer) throw new Error("Container not found");

      // 1. Gather all rendered page elements
      const pageElements = Array.from(scrollContainer.querySelectorAll('.bible-page')) as HTMLElement[];
      
      // 2. Clone them into a hidden container to capture at high res without scaling interference
      const renderContainer = document.createElement('div');
      renderContainer.style.position = 'absolute';
      renderContainer.style.top = '-10000px';
      renderContainer.style.left = '0';
      renderContainer.style.width = settings.paperSize === 'letter' ? '8.5in' : '210mm'; 
      document.body.appendChild(renderContainer);

      for (let i = 0; i < pageElements.length; i++) {
          const original = pageElements[i];
          const clone = original.cloneNode(true) as HTMLElement;
          
          // Clean up visual artifacts for print
          clone.style.transform = 'none';
          clone.style.margin = '0';
          clone.style.boxShadow = 'none';
          clone.style.marginBottom = '0';
          
          renderContainer.appendChild(clone);

          // Render
          const canvas = await html2canvas(clone, {
              scale: 2, // High res
              backgroundColor: '#ffffff',
              useCORS: true,
              logging: false
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();

          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          
          renderContainer.removeChild(clone);
      }

      document.body.removeChild(renderContainer);
      pdf.save(`${currentProjectName.replace(/\s+/g, '_')}_Bible.pdf`);

    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("Failed to export PDF. Please check console.");
    } finally {
      setIsExporting(false);
    }
  };

  const toggleStyle = (element: keyof typeof settings.styles, property: keyof TextStyleConfig) => {
    setSettings(prev => ({
      ...prev,
      styles: {
        ...prev.styles,
        [element]: { ...prev.styles[element], [property]: property === 'highlightColor' ? null : !prev.styles[element][property] }
      }
    }));
  };

  const setHighlight = (element: keyof typeof settings.styles, color: string | null) => {
    setSettings(prev => ({
      ...prev,
      styles: { ...prev.styles, [element]: { ...prev.styles[element], highlightColor: color } }
    }));
  };

  const toggleFilter = (type: 'loc' | 'char', value: string) => {
    setSettings(prev => {
      const list = type === 'loc' ? prev.selectedLocations : prev.selectedCharacters;
      const newList = list.includes(value) ? list.filter(i => i !== value) : [...list, value];
      return { ...prev, [type === 'loc' ? 'selectedLocations' : 'selectedCharacters']: newList };
    });
  };

  const pageStyle = {
      width: settings.paperSize === 'letter' ? '8.5in' : '210mm',
      height: settings.paperSize === 'letter' ? '11in' : '297mm',
  };

  const contentStyle = {
      paddingTop: `${settings.marginTop}in`,
      paddingBottom: `${settings.marginBottom}in`,
      paddingLeft: `${settings.marginLeft}in`,
      paddingRight: `${settings.marginRight}in`,
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-[#09090b] text-gray-100 flex font-sans animate-in fade-in duration-200">
      
      {/* SIDEBAR */}
      <div className="w-[380px] flex flex-col border-r border-[#222] bg-[#0c0c0c] shadow-2xl z-20">
         <div className="h-16 flex items-center justify-between px-6 border-b border-[#222] shrink-0 bg-[#0a0a0a]">
            <h2 className="font-black text-sm uppercase tracking-widest text-[#f5a623] flex items-center gap-2">
              <BookOpen className="text-[#f5a623]" size={18}/> Production Bible
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-md transition-colors text-gray-500 hover:text-white">
              <X size={18}/>
            </button>
         </div>

         <div className="px-6 pt-6 pb-2 bg-[#0c0c0c]">
            <div className="flex bg-[#161616] p-1 rounded-lg border border-[#222] overflow-x-auto">
               {[
                 { id: 'sections', label: 'Sections', icon: BookOpen },
                 { id: 'layout', label: 'Layout', icon: Layout },
                 { id: 'style', label: 'Style', icon: Palette },
                 { id: 'content', label: 'Filter', icon: ListFilter }
               ].map((tab) => (
                 <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === tab.id ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'}`}
                 >
                    <tab.icon size={12} /> {tab.label}
                 </button>
               ))}
            </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-8 bg-[#0c0c0c]">
            
            {activeTab === 'sections' && (
                <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                    <div className="text-xs font-bold text-[#666] uppercase tracking-widest mb-2">Document Components</div>
                    
                    <div 
                        onClick={() => setSections(s => ({...s, cover: !s.cover}))}
                        className={`p-4 rounded border cursor-pointer transition-all flex items-center justify-between ${sections.cover ? 'bg-[#f5a623]/10 border-[#f5a623]' : 'bg-[#111] border-[#222] hover:border-[#444]'}`}
                    >
                        <div className="flex items-center gap-3">
                            <BookOpen size={18} className={sections.cover ? "text-[#f5a623]" : "text-gray-500"} />
                            <div>
                                <div className={`text-xs font-bold ${sections.cover ? 'text-white' : 'text-gray-400'}`}>Cover Page</div>
                                <div className="text-[10px] text-gray-600">Title, Date, Author</div>
                            </div>
                        </div>
                        {sections.cover && <CheckCircle2 size={16} className="text-[#f5a623]" />}
                    </div>

                    <div 
                        onClick={() => setSections(s => ({...s, script: !s.script}))}
                        className={`p-4 rounded border cursor-pointer transition-all flex items-center justify-between ${sections.script ? 'bg-[#f5a623]/10 border-[#f5a623]' : 'bg-[#111] border-[#222] hover:border-[#444]'}`}
                    >
                        <div className="flex items-center gap-3">
                            <FileText size={18} className={sections.script ? "text-[#f5a623]" : "text-gray-500"} />
                            <div>
                                <div className={`text-xs font-bold ${sections.script ? 'text-white' : 'text-gray-400'}`}>Screenplay</div>
                                <div className="text-[10px] text-gray-600">Standard formatted script</div>
                            </div>
                        </div>
                        {sections.script && <CheckCircle2 size={16} className="text-[#f5a623]" />}
                    </div>

                    <div 
                        onClick={() => setSections(s => ({...s, characters: !s.characters}))}
                        className={`p-4 rounded border cursor-pointer transition-all flex items-center justify-between ${sections.characters ? 'bg-[#f5a623]/10 border-[#f5a623]' : 'bg-[#111] border-[#222] hover:border-[#444]'}`}
                    >
                        <div className="flex items-center gap-3">
                            <Users size={18} className={sections.characters ? "text-[#f5a623]" : "text-gray-500"} />
                            <div>
                                <div className={`text-xs font-bold ${sections.characters ? 'text-white' : 'text-gray-400'}`}>Character Bios</div>
                                <div className="text-[10px] text-gray-600">Profiles & Visuals</div>
                            </div>
                        </div>
                        {sections.characters && <CheckCircle2 size={16} className="text-[#f5a623]" />}
                    </div>

                    <div 
                        onClick={() => setSections(s => ({...s, storyboard: !s.storyboard}))}
                        className={`p-4 rounded border cursor-pointer transition-all flex items-center justify-between ${sections.storyboard ? 'bg-[#f5a623]/10 border-[#f5a623]' : 'bg-[#111] border-[#222] hover:border-[#444]'}`}
                    >
                        <div className="flex items-center gap-3">
                            <ImageIcon size={18} className={sections.storyboard ? "text-[#f5a623]" : "text-gray-500"} />
                            <div>
                                <div className={`text-xs font-bold ${sections.storyboard ? 'text-white' : 'text-gray-400'}`}>Storyboard</div>
                                <div className="text-[10px] text-gray-600">Visual Shot List</div>
                            </div>
                        </div>
                        {sections.storyboard && <CheckCircle2 size={16} className="text-[#f5a623]" />}
                    </div>
                </div>
            )}

            {activeTab === 'layout' && (
              <div className="space-y-8 animate-in slide-in-from-left-2 duration-300">
                 <section className="space-y-4">
                    <label className="text-xs font-bold text-[#666] uppercase tracking-widest flex items-center gap-2">
                        <Maximize size={12}/> Margins (Inches)
                    </label>
                    <div className="bg-[#111] p-5 rounded-lg border border-[#222]">
                       <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                           {['Top', 'Bottom', 'Left', 'Right'].map(m => (
                              <div key={m} className="flex items-center justify-between">
                                 <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{m}</span>
                                 <input 
                                    type="number" step="0.1"
                                    value={(settings as any)[`margin${m}`]}
                                    onChange={e => setSettings(s => ({...s, [`margin${m}`]: parseFloat(e.target.value)}))}
                                    className="w-16 bg-[#0a0a0a] border border-[#333] rounded px-2 py-1.5 text-xs font-mono text-white focus:border-[#f5a623] outline-none text-right"
                                 />
                              </div>
                           ))}
                       </div>
                    </div>
                 </section>
                 <section className="space-y-3">
                    <label className="text-xs font-bold text-[#666] uppercase tracking-widest">Options</label>
                    <div className="space-y-2">
                       <label className="flex items-center justify-between px-4 py-3 bg-[#111] rounded border border-[#222] cursor-pointer hover:border-[#444] transition-all group">
                          <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200">Show Page Numbers</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors ${settings.showPageNumbers ? 'bg-[#f5a623]' : 'bg-[#333]'}`}>
                             <input type="checkbox" checked={settings.showPageNumbers} onChange={e => setSettings(s => ({...s, showPageNumbers: e.target.checked}))} className="sr-only" />
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm`} style={{left: settings.showPageNumbers ? '20px' : '4px'}} />
                          </div>
                       </label>
                       <label className="flex items-center justify-between px-4 py-3 bg-[#111] rounded border border-[#222] cursor-pointer hover:border-[#444] transition-all group">
                          <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200">Show Scene Numbers</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors ${settings.sceneNumbers ? 'bg-[#f5a623]' : 'bg-[#333]'}`}>
                             <input type="checkbox" checked={settings.sceneNumbers} onChange={e => setSettings(s => ({...s, sceneNumbers: e.target.checked}))} className="sr-only" />
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm`} style={{left: settings.sceneNumbers ? '20px' : '4px'}} />
                          </div>
                       </label>
                    </div>
                 </section>
              </div>
            )}

            {activeTab === 'style' && (
              <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                 <div className="text-xs font-bold text-[#666] uppercase tracking-widest mb-4">Script Appearance</div>
                 {(Object.keys(settings.styles) as Array<keyof typeof settings.styles>).map(elm => (
                    <div key={elm} className="bg-[#111] p-3 rounded border border-[#222] hover:border-[#333] transition-colors flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-gray-300">{elm}</span>
                      <div className="flex items-center gap-4">
                          <div className="flex gap-1 bg-[#0a0a0a] rounded border border-[#222] p-0.5">
                             <button onClick={() => toggleStyle(elm, 'bold')} className={`p-1.5 rounded transition-all ${settings.styles[elm].bold ? 'bg-[#f5a623] text-black' : 'text-gray-600 hover:text-gray-300'}`} title="Bold"><Bold size={12}/></button>
                             <button onClick={() => toggleStyle(elm, 'italic')} className={`p-1.5 rounded transition-all ${settings.styles[elm].italic ? 'bg-[#f5a623] text-black' : 'text-gray-600 hover:text-gray-300'}`} title="Italic"><Italic size={12}/></button>
                             <button onClick={() => toggleStyle(elm, 'underline')} className={`p-1.5 rounded transition-all ${settings.styles[elm].underline ? 'bg-[#f5a623] text-black' : 'text-gray-600 hover:text-gray-300'}`} title="Underline"><Underline size={12}/></button>
                          </div>
                      </div>
                    </div>
                 ))}
              </div>
            )}

            {activeTab === 'content' && (
              <div className="space-y-8 animate-in slide-in-from-left-2 duration-300">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-[#666] uppercase tracking-widest flex items-center gap-2">
                            <MapPin size={12}/> Locations
                        </label>
                        {settings.selectedLocations.length > 0 && <button onClick={() => setSettings(s => ({...s, selectedLocations: []}))} className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase">Clear All</button>}
                    </div>
                    <div className="max-h-64 overflow-y-auto bg-[#111] rounded-lg border border-[#222] p-2 space-y-1 custom-scrollbar">
                       {allLocations.map(loc => (
                          <div key={loc} onClick={() => toggleFilter('loc', loc)} className={`px-3 py-2 rounded text-xs font-medium cursor-pointer flex items-center justify-between transition-all ${settings.selectedLocations.includes(loc) ? 'bg-[#f5a623]/10 text-[#f5a623] border border-[#f5a623]/20' : 'text-gray-400 hover:bg-[#1a1a1a] border border-transparent'}`}>
                             <span className="truncate">{loc}</span>{settings.selectedLocations.includes(loc) && <Check size={12} />}
                          </div>
                       ))}
                    </div>
                  </div>
              </div>
            )}
         </div>

         <div className="p-6 border-t border-[#222] bg-[#0a0a0a]">
            <button 
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="w-full py-3.5 bg-[#f5a623] hover:bg-[#e09612] text-black rounded font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:grayscale"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {isExporting ? 'Compiling PDF...' : 'Download Bible PDF'}
            </button>
         </div>
      </div>

      {/* PREVIEW CANVAS */}
      <div className="flex-1 bg-[#09090b] relative flex flex-col overflow-hidden">
         <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-[#1a1a1a]/90 backdrop-blur-md border border-[#333] rounded-full px-4 py-2 flex items-center gap-4 shadow-2xl">
               <div className="flex items-center gap-2">
                  <button onClick={() => setScale(s => Math.max(0.25, s - 0.1))} className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"><Minus size={16}/></button>
                  <span className="text-xs font-mono font-bold text-gray-300 w-10 text-center">{Math.round(scale * 100)}%</span>
                  <button onClick={() => setScale(s => Math.min(2.0, s + 0.1))} className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"><Plus size={16}/></button>
               </div>
            </div>
         </div>

         <div id="preview-scroll-container" className="flex-1 overflow-auto flex flex-col items-center p-20 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center', marginBottom: '100px', transition: 'transform 0.15s ease' }}>
               
               {/* 1. COVER PAGE */}
               {sections.cover && (
                   <div className="bible-page flex flex-col justify-between p-24 text-center border border-gray-200" style={pageStyle}>
                       <div className="mt-20">
                           <div className="text-6xl font-black uppercase tracking-tighter mb-4">{currentProjectName}</div>
                           <div className="text-sm font-bold uppercase tracking-[0.3em] text-gray-500">Production Bible</div>
                       </div>
                       <div className="mb-20 space-y-2">
                           <div className="text-sm font-bold uppercase tracking-wider">{currentDate}</div>
                           <div className="text-xs text-gray-400 font-mono">ID: {currentProjectId?.slice(-8)}</div>
                           <div className="w-16 h-1 bg-black mx-auto mt-8"></div>
                       </div>
                   </div>
               )}

               {/* 2. CHARACTERS */}
               {sections.characters && Object.keys(characterData).length > 0 && (
                   <div className="bible-page border border-gray-200" style={{...pageStyle, ...contentStyle}}>
                        <div className="text-2xl font-black uppercase border-b-4 border-black pb-2 mb-8">Character Manifest</div>
                        <div className="grid grid-cols-2 gap-6">
                            {Object.values(characterData).slice(0, 6).map((char: any, i: number) => (
                                <div key={i} className="flex gap-4 border border-gray-300 p-4 rounded-sm break-inside-avoid">
                                    <div className="w-24 h-24 bg-gray-100 shrink-0 border border-gray-200">
                                        {char.images && char.images[0] ? (
                                            <img src={char.images[0]} className="w-full h-full object-cover" alt={char.name} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={24}/></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-black text-lg uppercase leading-none mb-1">{char.name}</div>
                                        <div className="text-xs font-bold text-gray-500 uppercase mb-3">{char.archetype || 'Unknown'}</div>
                                        <div className="grid grid-cols-2 gap-y-1 text-[10px] font-mono text-gray-600">
                                            <div>AGE: {char.age}</div>
                                            <div>ROLE: {char.occupation}</div>
                                            <div className="col-span-2 line-clamp-2 mt-1 italic opacity-80">{char.physiology || char.description}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                   </div>
               )}

               {/* 3. STORYBOARD */}
               {sections.storyboard && generatedShots.length > 0 && (
                   <div className="bible-page border border-gray-200" style={{...pageStyle, ...contentStyle}}>
                       <div className="text-2xl font-black uppercase border-b-4 border-black pb-2 mb-8">Visual Storyboard</div>
                       <div className="grid grid-cols-3 gap-6">
                           {generatedShots.slice(0, 9).map((shot, i) => (
                               <div key={i} className="break-inside-avoid">
                                   <div className="aspect-video bg-gray-100 border border-gray-300 mb-2">
                                       {shot.imageUrl ? (
                                           <img src={shot.imageUrl} className="w-full h-full object-cover" alt="Shot" />
                                       ) : (
                                           <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">NO IMG</div>
                                       )}
                                   </div>
                                   <div className="flex justify-between items-end border-b border-gray-300 pb-1 mb-1">
                                       <span className="text-[10px] font-black uppercase">SC.{shot.scene || '?'}</span>
                                       <span className="text-[8px] font-mono font-bold uppercase text-gray-500">{shot.shotSize}</span>
                                   </div>
                                   <div className="text-[9px] leading-tight text-gray-700 line-clamp-3">{shot.description}</div>
                               </div>
                           ))}
                       </div>
                   </div>
               )}

               {/* 4. SCRIPT PAGES */}
               {sections.script && pages.map((pageBeats, pageIndex) => (
                    <div 
                       key={`script-${pageIndex}`}
                       className="bible-page border border-gray-200"
                       style={{...pageStyle, ...contentStyle}}
                    >
                       {settings.showPageNumbers && (
                           <div className="absolute top-0 right-0 p-4 text-black/40 font-screenplay text-[12pt] pointer-events-none"
                             style={{ paddingTop: `${Math.max(0.5, settings.marginTop - 0.5)}in`, paddingRight: `${settings.marginRight}in` }}
                           >
                             {pageIndex + 1}.
                           </div>
                       )}
                       <div className="w-full h-full overflow-hidden text-black font-screenplay text-[12pt] leading-tight">
                         {pageBeats.map((beat) => {
                            const originalIndex = filteredBeats.findIndex(b => b.id === beat.id);
                            return (
                               <div key={beat.id} className="mb-4 page-break-avoid">
                                 <div className="print-slugline font-bold uppercase mb-2">
                                   {settings.sceneNumbers && `${originalIndex + 1}. `} 
                                   {beat.slug.prefix} {beat.slug.location} - {beat.slug.time}
                                 </div>
                                 <div dangerouslySetInnerHTML={{ __html: beat.content }} />
                               </div>
                            );
                         })}
                       </div>
                    </div>
               ))}
            </div>
         </div>
      </div>
      
      {/* HIDDEN MEASUREMENT CONTAINER */}
      <div 
         ref={hiddenRef}
         className="absolute top-0 left-0 -z-50 invisible bg-white text-black font-screenplay text-[12pt] leading-tight print:hidden pointer-events-none"
         style={{
            width: settings.paperSize === 'letter' 
                ? `calc(8.5in - ${settings.marginLeft + settings.marginRight}in)`
                : `calc(210mm - ${settings.marginLeft + settings.marginRight}in)`,
         }}
      >
          {filteredBeats.map((beat) => (
             <div key={beat.id} className="mb-4">
                <div className="print-slugline font-bold uppercase mb-2">
                    1. {beat.slug.prefix} {beat.slug.location} - {beat.slug.time}
                </div>
                <div dangerouslySetInnerHTML={{ __html: beat.content }} />
             </div>
          ))}
      </div>
    </div>
  );
};

export default PrintPreviewModal;
