import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { PrintSettings, TextStyleConfig, Beat, Shot, CharacterData } from '../types';
import { 
  X, Printer, FileText, Layout, Palette, ListFilter, CheckCircle2, 
  Maximize, MapPin, User, Minus, Plus, Download, Loader2, Check,
  Bold, Italic, Underline, BookOpen, Image as ImageIcon, Users, Hash, PaintBucket,
  Sun, Moon, Box, ArrowRight, MoveHorizontal, MoveVertical, Sunset, Clock,
  Aperture, Lightbulb, Paintbrush, Footprints, Film, Heart, Crown, Shield, Zap, Star,
  Type, Sliders
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface PrintPreviewModalProps {
  onClose: () => void;
}

// Updated Palette
const SCENE_COLORS = [
    { label: 'White', value: '#ffffff' },
    { label: 'Light Gray', value: '#f3f4f6' },
    { label: 'Gray', value: '#9ca3af' },
    { label: 'Dark Gray', value: '#4b5563' },
    { label: 'Black', value: '#000000' },
    { label: 'Cream', value: '#fef9c3' },
    { label: 'Gold', value: '#d97706' },
    { label: 'Orange', value: '#f97316' },
    { label: 'Red', value: '#dc2626' },
    { label: 'Blue', value: '#2563eb' },
    { label: 'Navy', value: '#1e3a8a' },
    { label: 'Purple', value: '#9333ea' },
    { label: 'Green', value: '#16a34a' },
    { label: 'Teal', value: '#0d9488' },
    { label: 'Brown', value: '#78350f' },
];

interface PrintStyleConfig extends TextStyleConfig {
    marginLeft?: number;
    width?: number;
    marginTop?: number;
    marginBottom?: number;
}

const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ onClose }) => {
  const { beats, scriptConfig, characterData, generatedShots, projectList, currentProjectId } = useProject();
  const [activeTab, setActiveTab] = useState<'layout' | 'sections' | 'style' | 'content'>('sections');
  const [scale, setScale] = useState(0.65);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedStyleElement, setSelectedStyleElement] = useState<string>('slugline');
  
  const [sections, setSections] = useState({
      cover: true,
      characters: true,
      storyboard: true,
      script: true
  });

  const [showDialogueNumbers, setShowDialogueNumbers] = useState(false);
  const [colorCoding, setColorCoding] = useState({
      enabled: false,
      intBg: '#e5e7eb',
      extBg: '#d1d5db',
      dayText: '#000000',
      nightText: '#000000',
      twilightText: '#c2410c',
      transitionText: '#4b5563'
  });

  const [pages, setPages] = useState<Beat[][]>([]);
  const hiddenRef = useRef<HTMLDivElement>(null);
  
  const currentProjectName = projectList.find(p => p.id === currentProjectId)?.name || "Untitled Project";
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Standard Script Margins
  const [settings, setSettings] = useState<PrintSettings & { styles: Record<string, PrintStyleConfig> } & { sceneNumbersLeft: boolean, sceneNumbersRight: boolean }>(() => ({
    paperSize: 'a4',
    marginTop: 1.0,
    marginBottom: 1.0,
    marginLeft: 1.5,
    marginRight: 1.0,
    showPageNumbers: true,
    sceneNumbers: true, 
    sceneNumbersLeft: true,
    sceneNumbersRight: true,
    selectedLocations: [],
    selectedCharacters: [],
    styles: {
      slugline: { ...scriptConfig.slugline, marginLeft: 0, width: 100, marginTop: scriptConfig.slugline.marginTop, marginBottom: scriptConfig.slugline.marginBottom }, 
      action: { ...scriptConfig.action, marginLeft: scriptConfig.action.marginLeft, width: scriptConfig.action.width, marginTop: scriptConfig.action.marginTop, marginBottom: scriptConfig.action.marginBottom },
      character: { ...scriptConfig.character, marginLeft: scriptConfig.character.marginLeft, width: scriptConfig.character.width, marginTop: scriptConfig.character.marginTop, marginBottom: scriptConfig.character.marginBottom },
      dialogue: { ...scriptConfig.dialogue, marginLeft: scriptConfig.dialogue.marginLeft, width: scriptConfig.dialogue.width, marginTop: scriptConfig.dialogue.marginTop, marginBottom: scriptConfig.dialogue.marginBottom },
      parenthetical: { ...scriptConfig.parenthetical, marginLeft: scriptConfig.parenthetical.marginLeft, width: scriptConfig.parenthetical.width, marginTop: scriptConfig.parenthetical.marginTop, marginBottom: scriptConfig.parenthetical.marginBottom },
      transition: { ...scriptConfig.transition, marginLeft: scriptConfig.transition.marginLeft, width: scriptConfig.transition.width, marginTop: scriptConfig.transition.marginTop, marginBottom: scriptConfig.transition.marginBottom }
    }
  }));

  // --- DATA PROCESSING ---
  const { allLocations } = useMemo(() => {
    const locs = new Set<string>();
    beats.forEach(b => {
      if (b.slug.location) locs.add(b.slug.location.trim());
    });
    return {
      allLocations: Array.from(locs).sort(),
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

  const chunkArray = <T,>(array: T[], size: number): T[][] => {
      const result = [];
      for (let i = 0; i < array.length; i += size) {
          result.push(array.slice(i, i + size));
      }
      return result;
  };

  // --- CHARACTER PAGINATION ---
  const characterPages = useMemo(() => {
      const chars = Object.values(characterData);
      return chunkArray(chars, 2); // 2 Characters per page (Elite Layout)
  }, [characterData]);

  // --- STORYBOARD PAGINATION (GRID AWARE & COMPACT) ---
  const storyboardPages = useMemo(() => {
      const groups: Record<string, Shot[]> = {};
      generatedShots.forEach(shot => {
          const sceneKey = shot.scene ? String(shot.scene) : 'Unassigned';
          if (!groups[sceneKey]) groups[sceneKey] = [];
          groups[sceneKey].push(shot);
      });
      
      const sortedKeys = Object.keys(groups).sort((a,b) => {
          const numA = parseInt(a);
          const numB = parseInt(b);
          if(!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.localeCompare(b);
      });

      type RenderItem = { type: 'header', text: string } | { type: 'shot', data: Shot };
      const items: RenderItem[] = [];
      
      sortedKeys.forEach(key => {
          items.push({ type: 'header', text: key });
          groups[key].forEach(shot => {
              items.push({ type: 'shot', data: shot });
          });
      });

      // Page Layout Logic
      // Units are arbitrary "weight". Page limit is 100.
      // Goal: Fit 1 Header + 6 Shots (3 rows of 2).
      const LIMIT = 100;
      const COST_HEADER = 15; // Compact header
      const COST_SHOT = 14;   // 14 * 6 = 84.  84 + 15 = 99. Fits!
      
      const pages: RenderItem[][] = [];
      let currentPage: RenderItem[] = [];
      let currentWeight = 0;

      items.forEach(item => {
          const itemCost = item.type === 'header' ? COST_HEADER : COST_SHOT;

          // ORPHAN CHECK: 
          // If adding a header, make sure we have space for at least 1 row of shots (2 shots)
          // Cost of Header + 2 shots = 15 + 28 = 43.
          if (item.type === 'header') {
              if (currentWeight + itemCost + (COST_SHOT * 2) > LIMIT) {
                  // Force break if header + 1 row won't fit
                  pages.push(currentPage);
                  currentPage = [];
                  currentWeight = 0;
              }
          } 
          // Standard capacity check
          else if (currentWeight + itemCost > LIMIT) {
              pages.push(currentPage);
              currentPage = [];
              currentWeight = 0;
          }
          
          currentPage.push(item);
          currentWeight += itemCost;
      });

      if (currentPage.length > 0) pages.push(currentPage);
      return pages;

  }, [generatedShots]);


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
            
            if (currentH + h > writableHeight && currentPage.length > 0) {
                newPages.push(currentPage);
                currentPage = [];
                currentH = 0;
            }

            currentPage.push(filteredBeats[index]);
            currentH += h;
        });

        if (currentPage.length > 0) newPages.push(currentPage);
        if (newPages.length === 0 && filteredBeats.length === 0) setPages([[]]);
        else setPages(newPages);
    }, 50);

  }, [filteredBeats, settings, showDialogueNumbers]);

  // --- STYLES ---
  const dynamicCss = useMemo(() => {
    const genRule = (className: string, config: PrintStyleConfig) => `
      ${className} {
        font-weight: ${config.bold ? 'bold' : 'normal'} !important;
        font-style: ${config.italic ? 'italic' : 'normal'} !important;
        text-decoration: ${config.underline ? 'underline' : 'none'} !important;
        background-color: ${config.highlightColor || 'transparent'} !important;
        margin-left: ${config.marginLeft || 0}% !important;
        width: ${config.width || 100}% !important;
        margin-top: ${config.marginTop || 0}rem !important;
        margin-bottom: ${config.marginBottom || 0}rem !important;
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

      .sc-dialogue[data-dn] { position: relative; }
      .sc-dialogue[data-dn]::before {
          content: '(' attr(data-dn) ')';
          position: absolute;
          left: -45px;
          top: 0;
          font-family: monospace;
          font-size: 8pt;
          color: #999;
          font-weight: normal;
          text-align: right;
          width: 40px;
      }
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

  // --- EXPORT PDF (Improved Geometry Engine) ---
  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: settings.paperSize
      });

      // 1. Precise Geometry Calculations (96 DPI Reference)
      const isLetter = settings.paperSize === 'letter';
      const pageW_in = isLetter ? 8.5 : 8.27;
      const pageH_in = isLetter ? 11 : 11.69;
      
      // Fixed Pixel Dimensions for the Capture Container
      // This forces the layout engine to render exactly as if on the printed page
      const pixelWidth = isLetter ? 816 : 794; // 8.5 * 96, 8.27 * 96
      const pixelHeight = isLetter ? 1056 : 1123;

      // 2. Create SANDBOX Container (Off-screen but explicitly sized)
      // We do NOT use the existing preview elements because they might be scaled by CSS transform.
      // We clone them into a fresh container with fixed pixel dimensions.
      const renderContainer = document.createElement('div');
      renderContainer.style.position = 'fixed';
      renderContainer.style.top = '0';
      renderContainer.style.left = '0';
      renderContainer.style.zIndex = '-9999'; // Hide it
      renderContainer.style.width = `${pixelWidth}px`;
      renderContainer.style.height = `${pixelHeight}px`;
      renderContainer.style.overflow = 'hidden'; // Clip overflow
      renderContainer.style.backgroundColor = '#ffffff';
      document.body.appendChild(renderContainer);

      // Get source elements
      const sourceElements = Array.from(document.querySelectorAll('.bible-page')) as HTMLElement[];

      for (let i = 0; i < sourceElements.length; i++) {
          const original = sourceElements[i];
          const clone = original.cloneNode(true) as HTMLElement;
          
          // 3. Normalize Clone Styles
          // Crucial: Force the clone to fill the pixel-perfect container
          clone.style.transform = 'none';
          clone.style.margin = '0';
          clone.style.boxShadow = 'none';
          clone.style.marginBottom = '0';
          clone.style.width = '100%';  // Fill the 794px container
          clone.style.height = '100%'; // Fill the 1123px container
          clone.style.position = 'relative';
          clone.style.border = 'none';
          clone.style.boxSizing = 'border-box'; // Ensure padding is inside
          
          // Clear container and mount clone
          renderContainer.innerHTML = ''; 
          renderContainer.appendChild(clone);

          // 4. Capture with Explicit Dimensions
          // windowWidth/windowHeight forces media queries/layout to behave like a desktop screen of that size
          const canvas = await html2canvas(renderContainer, {
              scale: 2, // 2x Scale for crisp text (effective 192 DPI)
              useCORS: true,
              logging: false,
              width: pixelWidth,
              height: pixelHeight,
              windowWidth: pixelWidth,
              windowHeight: pixelHeight,
              backgroundColor: '#ffffff'
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.90);

          if (i > 0) pdf.addPage();
          
          // 5. Inject 1:1
          // Since our capture container had the EXACT aspect ratio of the PDF page,
          // mapping it to (0, 0, pageW, pageH) results in ZERO stretching.
          pdf.addImage(imgData, 'JPEG', 0, 0, pageW_in, pageH_in);
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

  const toggleStyle = (element: string, property: keyof TextStyleConfig) => {
    setSettings(prev => ({
      ...prev,
      styles: {
        ...prev.styles,
        [element]: { ...prev.styles[element], [property]: property === 'highlightColor' ? null : !(prev.styles[element] as any)[property] }
      }
    }));
  };

  const updateGeometry = (element: string, property: 'marginLeft' | 'width' | 'marginTop' | 'marginBottom', value: number) => {
      setSettings(prev => ({
          ...prev,
          styles: {
              ...prev.styles,
              [element]: { ...prev.styles[element], [property]: value }
          }
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

  // Styles for SCRIPT pages (using user-defined margins)
  const scriptContentStyle = {
      paddingTop: `${settings.marginTop}in`,
      paddingBottom: `${settings.marginBottom}in`,
      paddingLeft: `${settings.marginLeft}in`,
      paddingRight: `${settings.marginRight}in`,
  };

  // Styles for VISUAL pages (Full width/optimized margins - INDEPENDENT)
  const visualContentStyle = {
      paddingTop: `0.5in`,
      paddingBottom: `0.5in`,
      paddingLeft: `0.5in`,
      paddingRight: `0.5in`,
  };

  const getSlugStyles = (prefix: string, time: string) => {
      let bg = scriptConfig.slugline.highlightColor;
      if (scriptConfig.slugline.paddingEnabled && !bg) bg = '#f3f4f6'; 
      let color = scriptConfig.slugline.color || '#000000';
      let padding = scriptConfig.slugline.paddingEnabled 
          ? `${scriptConfig.slugline.paddingVertical}px ${scriptConfig.slugline.paddingHorizontal}px`
          : '0px';
      
      if (colorCoding.enabled) {
          const p = prefix.toUpperCase();
          const t = time.toUpperCase().trim();
          if (p.includes('INT')) bg = colorCoding.intBg;
          else if (p.includes('EXT')) bg = colorCoding.extBg;
          
          // Enhanced Color Coding
          if (t.includes('NIGHT')) color = colorCoding.nightText;
          else if (t.includes('DAY') || t.includes('MORNING')) color = colorCoding.dayText;
          else if (t.includes('DUSK') || t.includes('TWILIGHT')) color = colorCoding.twilightText;
          else if (t.includes('CONTINUOUS') || t.includes('LATER')) color = colorCoding.transitionText;
          
          if (bg && bg !== 'transparent') padding = '4px 8px';
      }
      return { bg: bg || 'transparent', color, padding };
  };

  const getRoleColor = (role: string) => {
      const r = (role || '').toLowerCase();
      if (r.includes('protagonist') || r.includes('hero')) return '#d97706'; // Gold
      if (r.includes('antagonist') || r.includes('villain')) return '#dc2626'; // Red
      if (r.includes('mentor') || r.includes('sage')) return '#2563eb'; // Blue
      if (r.includes('love')) return '#db2777'; // Pink
      return '#4b5563'; // Silver/Gray
  };

  let globalDialogueCounter = 0;
  const processBeatContent = (html: string, resetCounter = false) => {
      if (resetCounter) globalDialogueCounter = 0;
      if (!showDialogueNumbers) return html;
      return html.replace(/class=["']([^"']*)\bsc-dialogue\b([^"']*)["']/g, (match) => {
          globalDialogueCounter++;
          return `${match} data-dn="${globalDialogueCounter}"`;
      });
  };

  const ColorPicker = ({ label, value, onChange }: { label: string, value: string, onChange: (c: string) => void }) => (
      <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase">{label}</span>
          <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
              {SCENE_COLORS.map(c => (
                  <button 
                    key={c.value} 
                    onClick={() => onChange(c.value)}
                    className={`w-4 h-4 rounded-full border border-gray-600 hover:scale-125 transition-transform ${value === c.value ? 'ring-1 ring-white' : ''}`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
              ))}
          </div>
      </div>
  );

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
                    {['cover', 'script', 'characters', 'storyboard'].map(sec => (
                        <div 
                            key={sec}
                            onClick={() => setSections(s => ({...s, [sec]: !s[sec as keyof typeof s]}))}
                            className={`p-4 rounded border cursor-pointer transition-all flex items-center justify-between ${sections[sec as keyof typeof sections] ? 'bg-[#f5a623]/10 border-[#f5a623]' : 'bg-[#111] border-[#222] hover:border-[#444]'}`}
                        >
                            <div className="flex items-center gap-3">
                                {sec === 'cover' && <BookOpen size={18} className={sections.cover ? "text-[#f5a623]" : "text-gray-500"} />}
                                {sec === 'script' && <FileText size={18} className={sections.script ? "text-[#f5a623]" : "text-gray-500"} />}
                                {sec === 'characters' && <Users size={18} className={sections.characters ? "text-[#f5a623]" : "text-gray-500"} />}
                                {sec === 'storyboard' && <ImageIcon size={18} className={sections.storyboard ? "text-[#f5a623]" : "text-gray-500"} />}
                                <div>
                                    <div className={`text-xs font-bold ${sections[sec as keyof typeof sections] ? 'text-white' : 'text-gray-400'} capitalize`}>{sec}</div>
                                </div>
                            </div>
                            {sections[sec as keyof typeof sections] && <CheckCircle2 size={16} className="text-[#f5a623]" />}
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'layout' && (
              <div className="space-y-8 animate-in slide-in-from-left-2 duration-300">
                 <section className="space-y-4">
                    <label className="text-xs font-bold text-[#666] uppercase tracking-widest flex items-center gap-2">
                        <Maximize size={12}/> Margins (Script Only)
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
                    <div className="space-y-3">
                       <label className="flex items-center justify-between px-4 py-3 bg-[#111] rounded border border-[#222] cursor-pointer hover:border-[#444] transition-all group">
                          <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200">Show Page Numbers</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors ${settings.showPageNumbers ? 'bg-[#f5a623]' : 'bg-[#333]'}`}>
                             <input type="checkbox" checked={settings.showPageNumbers} onChange={e => setSettings(s => ({...s, showPageNumbers: e.target.checked}))} className="sr-only" />
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm`} style={{left: settings.showPageNumbers ? '20px' : '4px'}} />
                          </div>
                       </label>

                       {/* Scene Numbers Configuration */}
                       <div className="bg-[#111] rounded border border-[#222] p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-400">Scene Numbers</span>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setSettings(s => ({...s, sceneNumbersLeft: !s.sceneNumbersLeft}))}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded border transition-all ${settings.sceneNumbersLeft ? 'bg-[#f5a623]/20 border-[#f5a623] text-[#f5a623]' : 'bg-[#0a0a0a] border-[#333] text-gray-500'}`}
                                >
                                    Left
                                </button>
                                <button 
                                    onClick={() => setSettings(s => ({...s, sceneNumbersRight: !s.sceneNumbersRight}))}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded border transition-all ${settings.sceneNumbersRight ? 'bg-[#f5a623]/20 border-[#f5a623] text-[#f5a623]' : 'bg-[#0a0a0a] border-[#333] text-gray-500'}`}
                                >
                                    Right
                                </button>
                            </div>
                       </div>

                       {/* Dialogue Numbers */}
                       <label className="flex items-center justify-between px-4 py-3 bg-[#111] rounded border border-[#222] cursor-pointer hover:border-[#444] transition-all group">
                          <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200">Continuous Dialogue #</span>
                          <div className={`w-9 h-5 rounded-full relative transition-colors ${showDialogueNumbers ? 'bg-[#f5a623]' : 'bg-[#333]'}`}>
                             <input type="checkbox" checked={showDialogueNumbers} onChange={e => setShowDialogueNumbers(e.target.checked)} className="sr-only" />
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm`} style={{left: showDialogueNumbers ? '20px' : '4px'}} />
                          </div>
                       </label>
                    </div>
                 </section>
              </div>
            )}

            {activeTab === 'style' && (
              <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                 
                 {/* 1. TYPOGRAPHY (Existing) */}
                 <div className="bg-[#111] p-4 rounded border border-[#222] space-y-4">
                     <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2"><Type size={12}/> Typography Styles</div>
                     {Object.keys(settings.styles).map((elm) => (
                         <div key={elm} className="flex items-center justify-between">
                             <span className="text-xs text-gray-300 capitalize">{elm}</span>
                             <div className="flex bg-[#222] rounded p-0.5">
                                 <button onClick={() => toggleStyle(elm, 'bold')} className={`p-1 rounded ${settings.styles[elm as any].bold ? 'text-[#f5a623] bg-[#333]' : 'text-gray-600'}`} title="Bold"><Bold size={12}/></button>
                                 <button onClick={() => toggleStyle(elm, 'italic')} className={`p-1 rounded ${settings.styles[elm as any].italic ? 'text-[#f5a623] bg-[#333]' : 'text-gray-600'}`} title="Italic"><Italic size={12}/></button>
                                 <button onClick={() => toggleStyle(elm, 'underline')} className={`p-1 rounded ${settings.styles[elm as any].underline ? 'text-[#f5a623] bg-[#333]' : 'text-gray-600'}`} title="Underline"><Underline size={12}/></button>
                             </div>
                         </div>
                     ))}
                 </div>

                 {/* 2. COLOR CODING (Expanded) */}
                 <div className="bg-[#111] p-4 rounded border border-[#222] space-y-4">
                     <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center gap-2">
                             <PaintBucket size={14} className="text-[#f5a623]" />
                             <span className="text-xs font-bold text-white uppercase">Scene Colors</span>
                         </div>
                         <div className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${colorCoding.enabled ? 'bg-[#f5a623]' : 'bg-[#333]'}`} onClick={() => setColorCoding(c => ({...c, enabled: !c.enabled}))}>
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm`} style={{left: colorCoding.enabled ? '20px' : '4px'}} />
                         </div>
                     </div>
                     
                     <div className={`space-y-4 transition-opacity ${colorCoding.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                         <div>
                             <div className="flex items-center gap-2 mb-2 text-[9px] font-bold text-gray-500 uppercase"><Box size={10} /> Backgrounds</div>
                             <div className="space-y-2 pl-2 border-l border-[#333]">
                                 <ColorPicker label="INT. Scenes" value={colorCoding.intBg} onChange={(c) => setColorCoding(p => ({...p, intBg: c}))} />
                                 <ColorPicker label="EXT. Scenes" value={colorCoding.extBg} onChange={(c) => setColorCoding(p => ({...p, extBg: c}))} />
                             </div>
                         </div>
                         <div>
                             <div className="flex items-center gap-2 mb-2 text-[9px] font-bold text-gray-500 uppercase"><Sun size={10} /> Time of Day Text</div>
                             <div className="space-y-2 pl-2 border-l border-[#333]">
                                 <ColorPicker label="Day" value={colorCoding.dayText} onChange={(c) => setColorCoding(p => ({...p, dayText: c}))} />
                                 <ColorPicker label="Night" value={colorCoding.nightText} onChange={(c) => setColorCoding(p => ({...p, nightText: c}))} />
                                 <ColorPicker label="Twilight/Dusk" value={colorCoding.twilightText} onChange={(c) => setColorCoding(p => ({...p, twilightText: c}))} />
                                 <ColorPicker label="Transitions" value={colorCoding.transitionText} onChange={(c) => setColorCoding(p => ({...p, transitionText: c}))} />
                             </div>
                         </div>
                     </div>
                 </div>

                 {/* 3. ELEMENT GEOMETRY (Margins/Layout) */}
                 <div className="bg-[#111] p-4 rounded border border-[#222] space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                         <Sliders size={14} className="text-[#f5a623]" />
                         <span className="text-xs font-bold text-white uppercase">Fine-Tune Layout</span>
                    </div>
                    
                    {/* Element Selector */}
                    <div className="flex overflow-x-auto gap-1 pb-2 border-b border-[#333] mb-4 custom-scrollbar">
                        {['slugline', 'action', 'character', 'dialogue', 'parenthetical', 'transition'].map(elm => (
                            <button
                                key={elm}
                                onClick={() => setSelectedStyleElement(elm)}
                                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase whitespace-nowrap transition-colors ${selectedStyleElement === elm ? 'bg-[#f5a623] text-black' : 'bg-[#222] text-gray-400 hover:text-white'}`}
                            >
                                {elm.substring(0, 4)}
                            </button>
                        ))}
                    </div>

                    {/* Sliders */}
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                <span>Left Margin (%)</span>
                                <span>{settings.styles[selectedStyleElement as any].marginLeft}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="80" 
                                value={settings.styles[selectedStyleElement as any].marginLeft} 
                                onChange={(e) => updateGeometry(selectedStyleElement, 'marginLeft', parseInt(e.target.value))}
                                className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                <span>Width (%)</span>
                                <span>{settings.styles[selectedStyleElement as any].width}%</span>
                            </div>
                            <input 
                                type="range" min="10" max="100" 
                                value={settings.styles[selectedStyleElement as any].width} 
                                onChange={(e) => updateGeometry(selectedStyleElement, 'width', parseInt(e.target.value))}
                                className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                    <span>Top (rem)</span>
                                    <span>{settings.styles[selectedStyleElement as any].marginTop}</span>
                                </div>
                                <input 
                                    type="range" min="0" max="4" step="0.1"
                                    value={settings.styles[selectedStyleElement as any].marginTop} 
                                    onChange={(e) => updateGeometry(selectedStyleElement, 'marginTop', parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                    <span>Bottom (rem)</span>
                                    <span>{settings.styles[selectedStyleElement as any].marginBottom}</span>
                                </div>
                                <input 
                                    type="range" min="0" max="4" step="0.1"
                                    value={settings.styles[selectedStyleElement as any].marginBottom} 
                                    onChange={(e) => updateGeometry(selectedStyleElement, 'marginBottom', parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#f5a623]"
                                />
                            </div>
                        </div>
                    </div>
                 </div>
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
              {isExporting ? 'Compiling PDF...' : 'Download PDF'}
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

               {/* 2. CHARACTERS (ELITE LAYOUT with FULL WIDTH) */}
               {sections.characters && characterPages.map((pageChars: CharacterData[], pageIdx: number) => (
                   <div key={`chars-page-${pageIdx}`} className="bible-page border border-gray-200" style={{...pageStyle, ...visualContentStyle}}>
                        <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-8">
                            <div className="text-3xl font-serif font-bold uppercase tracking-wide">Cast Manifest</div>
                            <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-gray-500">PG {pageIdx + 1}</div>
                        </div>
                        
                        <div className="flex flex-col gap-8 h-full">
                            {pageChars.map((char: any, i: number) => (
                                <div key={i} className="flex gap-6 break-inside-avoid h-[45%] border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                                    <div className="w-1/3 flex flex-col gap-2">
                                        <div className="flex-1 bg-gray-100 relative overflow-hidden border border-gray-300">
                                            {char.images && char.images[0] ? (
                                                <img src={char.images[0]} className="w-full h-full object-cover grayscale contrast-110" alt={char.name} />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                                                    <User size={48} strokeWidth={1} />
                                                    <span className="text-[9px] uppercase tracking-widest">No Image</span>
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/90 text-white text-[9px] font-bold uppercase tracking-widest py-1 px-2 text-center">
                                                {char.archetype || 'Archetype Unknown'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col">
                                        <div className="flex flex-col border-b-2 border-black pb-2 mb-3">
                                            <h3 className="text-4xl font-serif font-black uppercase tracking-tighter text-black leading-none">{char.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f5a623]">{char.occupation || 'UNKNOWN ROLE'}</span>
                                                <div className="h-px bg-gray-300 flex-1"></div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 bg-gray-50 p-3 border border-gray-200 text-[10px] font-sans">
                                            <div className="flex justify-between border-b border-gray-200 pb-1"><span className="font-bold text-gray-500 uppercase">Age</span><span className="font-medium text-black uppercase">{char.age || '-'}</span></div>
                                            <div className="flex justify-between border-b border-gray-200 pb-1"><span className="font-bold text-gray-500 uppercase">Gender</span><span className="font-medium text-black uppercase">{char.gender || '-'}</span></div>
                                            <div className="flex justify-between border-b border-gray-200 pb-1"><span className="font-bold text-gray-500 uppercase">Ethnicity</span><span className="font-medium text-black uppercase">{char.ethnicity || '-'}</span></div>
                                            <div className="flex justify-between border-b border-gray-200 pb-1"><span className="font-bold text-gray-500 uppercase">Hair/Eyes</span><span className="font-medium text-black uppercase">{char.hair || '-'} / {char.eyes || '-'}</span></div>
                                        </div>

                                        <div className="flex-1">
                                            <p className="font-serif text-xs leading-relaxed text-black text-justify line-clamp-6">
                                                {char.backstory || char.description || (char.physiology ? `${char.physiology} ${char.psychology}` : "No biographical data available.")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                   </div>
               ))}

               {/* 3. STORYBOARD (CINEMATIC GALLERY) */}
               {sections.storyboard && storyboardPages.map((pageItems: any[], pageIdx: number) => (
                   <div key={`story-page-${pageIdx}`} className="bible-page border border-gray-200" style={{...pageStyle, ...visualContentStyle}}>
                       {/* Page Header */}
                       <div className="flex items-center justify-between border-b-4 border-black pb-2 mb-8">
                            <div className="text-4xl font-serif font-black uppercase tracking-tighter">Visual Continuity</div>
                            <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-gray-500 bg-gray-100 px-2 py-1 rounded">Board Pg {pageIdx + 1}</div>
                        </div>

                       {/* Items Container */}
                       <div className="flex flex-wrap -mx-3 content-start">
                           {pageItems.map((item, i) => {
                               if (item.type === 'header') {
                                   return (
                                       <div key={i} className="w-full px-4 mb-4 mt-2 break-inside-avoid">
                                           {/* Slate Header Style */}
                                           <div className="flex items-center gap-4">
                                                <div className="bg-black text-white py-2 px-6 shadow-xl relative z-10">
                                                    <span className="text-lg font-black uppercase tracking-widest">SCENE {item.text}</span>
                                                </div>
                                                {/* Cut Line */}
                                                <div className="flex-1 border-b-2 border-dashed border-black/20 relative"></div>
                                                <div className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em]">CUT TO</div>
                                           </div>
                                       </div>
                                   );
                               } else {
                                   const shot = item.data as Shot;
                                   return (
                                       <div key={i} className="w-1/2 px-3 mb-4 break-inside-avoid">
                                           {/* Double-Matte Card */}
                                           <div className="bg-white p-2 shadow-[0_15px_40px_-12px_rgba(0,0,0,0.15)] h-full flex flex-col relative transition-transform">
                                               
                                               {/* Image Frame with Matte Border */}
                                               <div className="relative border-2 border-zinc-900 bg-zinc-100">
                                                   <div className="aspect-video overflow-hidden bg-zinc-200">
                                                       {shot.imageUrl ? (
                                                           <img src={shot.imageUrl} className="w-full h-full object-cover contrast-[1.1] saturate-[0.9]" alt="Shot" />
                                                       ) : (
                                                           <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                                                               <Film size={32} className="opacity-20 mb-2" />
                                                               <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">No Visual Asset</span>
                                                           </div>
                                                       )}
                                                   </div>
                                                   
                                                   {/* High Contrast Tech Bar */}
                                                   <div className="bg-zinc-900 text-white px-2 py-1.5 flex justify-between items-center border-t border-zinc-800">
                                                       <span className="text-[9px] font-black uppercase tracking-widest text-[#f5a623]">{shot.shotSize}</span>
                                                       <span className="text-[8px] font-bold uppercase tracking-wide text-zinc-400">{shot.angle}</span>
                                                   </div>
                                               </div>

                                               {/* Narrative Block */}
                                               <div className="pt-2 px-1 flex-1 flex flex-col">
                                                   <div className="mb-1.5 border-b border-gray-100 pb-1.5">
                                                       <span className="text-[7px] font-bold uppercase text-gray-400 tracking-[0.2em] block mb-0.5">SUBJECT</span>
                                                       <span className="text-[10px] font-black text-black uppercase leading-none tracking-tight block">{shot.subject || 'SCENE ACTION'}</span>
                                                   </div>
                                                   
                                                   <p className="font-serif text-[9px] leading-snug text-gray-800 line-clamp-2 text-justify">
                                                       {shot.description}
                                                   </p>
                                               </div>
                                           </div>
                                       </div>
                                   );
                               }
                           })}
                       </div>
                   </div>
               ))}

               {/* 4. SCRIPT PAGES (Uses Standard Margins) */}
               {sections.script && (
                   (() => {
                       globalDialogueCounter = 0;
                       return pages.map((pageBeats, pageIndex) => (
                            <div 
                               key={`script-${pageIndex}`}
                               className="bible-page border border-gray-200"
                               style={{...pageStyle, ...scriptContentStyle}}
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
                                    const slugText = `${beat.slug.prefix} ${beat.slug.location} - ${beat.slug.time}`;
                                    const { bg, color, padding } = getSlugStyles(beat.slug.prefix, beat.slug.time);
                                    const finalContent = processBeatContent(beat.content);

                                    return (
                                       <div key={beat.id} className="mb-4 page-break-avoid">
                                         <div 
                                            className="print-slugline font-bold uppercase mb-2"
                                            style={{ 
                                                backgroundColor: bg, 
                                                color: color, 
                                                padding: padding,
                                                borderRadius: '4px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'baseline'
                                            }}
                                         >
                                           <div className="flex gap-4">
                                               {settings.sceneNumbersLeft && <span>{originalIndex + 1}.</span>}
                                               <span>{slugText}</span>
                                           </div>
                                           {settings.sceneNumbersRight && <span>{originalIndex + 1}.</span>}
                                         </div>
                                         <div dangerouslySetInnerHTML={{ __html: finalContent }} />
                                       </div>
                                    );
                                 })}
                               </div>
                            </div>
                       ));
                   })()
               )}
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