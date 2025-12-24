
import React, { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Search, Plus, Sun, Moon, Coffee, Eye, ZoomIn, ZoomOut, Lock, AlignLeft, User, MessageSquare, Parentheses, ArrowRightLeft, Camera, Music, Type } from 'lucide-react';
import { ScriptEditor, ScriptEditorHandle } from '../ScriptEditor';
import { SlugInput } from '../SlugInput';

// --- CONSTANTS ---
// Standard A4 Dimensions at 96 DPI
const A4_WIDTH = 794;  // 8.27in
const A4_HEIGHT = 1123; // 11.69in

// Standard Screenplay Margins (in pixels)
const MARGIN_LEFT = 144;
const MARGIN_RIGHT = 96;
const MARGIN_TOP = 96;
const MARGIN_BOTTOM = 96;

const PAGE_GAP = 40; 
// Zero spacing for tighter continuous flow (relying on element margins)
const BEAT_SPACING = 0; 

// Common Slugline Options
const SLUG_PREFIXES = ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.', 'I./E.', 'E./I.'];
const SLUG_TIMES = ['DAY', 'NIGHT', 'CONTINUOUS', 'MOMENTS LATER', 'MORNING', 'EVENING', 'LATER', 'SAME TIME', 'DAWN', 'DUSK'];

// --- DOM LAYOUT ENGINE ---
const runPaginationPass = (
    container: HTMLElement, 
    paperLayer: HTMLElement, 
    contentLayer: HTMLElement,
    theme: any,
    viewMode: 'continuous' | 'page'
) => {
    if (!container || !paperLayer || !contentLayer) return;

    const beats = Array.from(contentLayer.querySelectorAll('.beat-block')) as HTMLElement[];
    const totalPageHeight = A4_HEIGHT + PAGE_GAP;
    
    // --- CONTINUOUS MODE ---
    if (viewMode === 'continuous') {
        let currentY = MARGIN_TOP;

        beats.forEach((beat, i) => {
            const spacing = i === 0 ? 0 : BEAT_SPACING;
            beat.style.marginTop = `${spacing}px`; 
            currentY += spacing + beat.offsetHeight;
        });

        const requiredHeight = Math.max(A4_HEIGHT, currentY + MARGIN_BOTTOM);

        const existingPages = paperLayer.querySelectorAll('.bg-page');
        if (existingPages.length !== 1 || paperLayer.dataset.theme !== theme.bg || paperLayer.dataset.mode !== 'continuous') {
            paperLayer.innerHTML = '';
            paperLayer.dataset.theme = theme.bg;
            paperLayer.dataset.mode = 'continuous';
            
            const page = document.createElement('div');
            page.className = 'bg-page';
            page.style.position = 'absolute';
            page.style.left = '0';
            page.style.top = '0';
            page.style.width = `${A4_WIDTH}px`;
            page.style.minHeight = `${requiredHeight}px`; 
            page.style.height = '100%'; 
            page.style.backgroundColor = theme.bg;
            page.style.boxShadow = theme.shadow;
            page.style.transition = 'background-color 0.3s';
            
            paperLayer.appendChild(page);
        } else {
            const page = existingPages[0] as HTMLElement;
            page.style.minHeight = `${requiredHeight}px`;
        }
        return;
    }

    // --- PAGE VIEW MODE ---
    let prevBottom = MARGIN_TOP;

    beats.forEach((beat, i) => {
        const height = beat.offsetHeight;
        let targetTop = prevBottom + (i === 0 ? 0 : BEAT_SPACING);
        let pageIndex = Math.floor(targetTop / totalPageHeight);
        
        const pageStart = pageIndex * totalPageHeight;
        const pageWritableStart = pageStart + MARGIN_TOP;
        const pageWritableEnd = pageStart + A4_HEIGHT - MARGIN_BOTTOM;

        if (targetTop < pageWritableStart) {
            targetTop = pageWritableStart;
        }

        if (targetTop + height > pageWritableEnd) {
            if (targetTop > pageWritableStart) {
                pageIndex++;
                const nextPageStart = pageIndex * totalPageHeight;
                targetTop = nextPageStart + MARGIN_TOP;
            }
        }

        const margin = Math.max(0, targetTop - prevBottom);
        beat.style.marginTop = `${margin}px`;
        
        prevBottom = targetTop + height;
    });

    const lastPageNeeded = Math.floor((prevBottom - 1) / totalPageHeight);
    const requiredPages = Math.max(1, lastPageNeeded + 1);
    
    const existingPages = paperLayer.querySelectorAll('.bg-page');
    if (existingPages.length !== requiredPages || paperLayer.dataset.theme !== theme.bg || paperLayer.dataset.mode !== 'page') {
        paperLayer.innerHTML = '';
        paperLayer.dataset.theme = theme.bg;
        paperLayer.dataset.mode = 'page';
        
        for (let i = 0; i < requiredPages; i++) {
            const page = document.createElement('div');
            page.className = 'bg-page';
            page.style.position = 'absolute';
            page.style.left = '0';
            page.style.top = `${i * totalPageHeight}px`;
            page.style.width = `${A4_WIDTH}px`;
            page.style.height = `${A4_HEIGHT}px`;
            page.style.backgroundColor = theme.bg;
            page.style.boxShadow = theme.shadow;
            page.style.transition = 'background-color 0.3s';
            
            const num = document.createElement('div');
            num.textContent = `${i + 1}.`;
            num.style.position = 'absolute';
            num.style.top = '40px';
            num.style.right = '40px';
            num.style.fontFamily = 'Courier Prime, monospace';
            num.style.fontSize = '12px';
            num.style.fontWeight = 'bold';
            num.style.color = theme.pageNum;
            num.style.opacity = '0.5';
            
            page.appendChild(num);
            paperLayer.appendChild(page);
        }
    }
};

const ScriptView: React.FC = () => {
  const { beats, updateBeat, addBeat, scriptViewMode, scriptConfig, setScriptConfig, characterData } = useProject();
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [activeBeatId, setActiveBeatId] = useState<number | null>(null);
  const [activeFormat, setActiveFormat] = useState('action');
  
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const paperLayerRef = useRef<HTMLDivElement>(null);
  const editorRefs = useRef<Record<number, ScriptEditorHandle | null>>({});
  
  // Theme Styles
  const getThemeStyles = () => {
      switch(scriptConfig.paperTheme) {
          case 'dark': return { 
              bg: '#1a1a1a', text: '#e5e5e5', slug: '#bbbbbb', accent: '#333333', 
              pageNum: '#555', shadow: '0 0 0 1px #333',
              slugBg: '#2a2a2a'
          };
          case 'sepia': return { 
              bg: '#fdf6e3', text: '#586e75', slug: '#b58900', accent: '#eee8d5', 
              pageNum: '#93a1a1', shadow: '0 2px 10px rgba(0,0,0,0.1)',
              slugBg: '#eee8d5'
          };
          case 'red': return { 
              bg: '#000000', text: '#ff5555', slug: '#ff0000', accent: '#1a0000', 
              pageNum: '#330000', shadow: '0 0 0 1px #330000',
              slugBg: '#111111'
          };
          default: return { 
              bg: 'white', text: 'black', slug: '#555555', accent: '#f5f5f5', 
              pageNum: '#ccc', shadow: '0 4px 12px rgba(0,0,0,0.15)',
              slugBg: '#e5e7eb'
          }; 
      }
  };
  const theme = getThemeStyles();

  // Helper to set theme
  const setPaperTheme = (theme: 'white' | 'dark' | 'sepia' | 'red') => {
      setScriptConfig({ ...scriptConfig, paperTheme: theme });
  };

  // Sorting
  const sortedBeats = useMemo(() => {
    if (beats.length === 0) return [];
    return [...beats].sort((a, b) => {
        if (Math.abs(a.x - b.x) > 50) return a.x - b.x; 
        return a.y - b.y;
    });
  }, [beats]);

  // Unique Locations for Autocomplete
  const uniqueLocations = useMemo(() => {
      const locs = new Set<string>();
      // Pre-seed common
      ['HOUSE', 'KITCHEN', 'BEDROOM', 'OFFICE', 'PARK', 'STREET', 'CAR', 'APARTMENT', 'SCHOOL', 'HOSPITAL'].forEach(l => locs.add(l));
      beats.forEach(b => {
          if (b.slug.location && b.slug.location.trim()) {
              locs.add(b.slug.location.trim());
          }
      });
      return Array.from(locs).sort();
  }, [beats]);

  // Unique Characters for Autocomplete
  const uniqueCharacters = useMemo(() => {
      const chars = new Set<string>();
      
      // 1. Add from Character Manifest (Created Characters)
      // This includes any character you've explicitly added via the "Add Character" button
      Object.values(characterData).forEach((c: any) => {
          if (c.name) chars.add(c.name.toUpperCase());
      });

      // 2. Add from existing Script content (Dynamic)
      // This preserves any ad-hoc characters typed directly into the script
      beats.forEach(b => {
          const div = document.createElement('div');
          div.innerHTML = b.content;
          div.querySelectorAll('.sc-character').forEach(el => {
              const name = el.textContent?.trim().replace(/\s*\(.*\)$/, '').toUpperCase();
              if (name && name.length > 1) chars.add(name);
          });
      });

      return Array.from(chars).sort();
  }, [beats, characterData]);

  // --- LAYOUT ENGINE TRIGGER ---
  useLayoutEffect(() => {
      const container = scrollerRef.current;
      const paper = paperLayerRef.current;
      const content = contentRef.current;
      if (!container || !paper || !content) return;
      const run = () => runPaginationPass(container, paper, content, theme, scriptViewMode);
      run();
      const observer = new ResizeObserver(() => window.requestAnimationFrame(run));
      const beatEls = content.querySelectorAll('.beat-block');
      beatEls.forEach(el => observer.observe(el));
      observer.observe(content);
      return () => observer.disconnect();
  }, [sortedBeats, theme, zoom, scriptViewMode]); 

  // Auto Fit Zoom on Mount
  useEffect(() => { handleFitZoom(); }, []);

  const handleFitZoom = () => {
      if (scrollerRef.current) {
          const w = scrollerRef.current.clientWidth;
          const fit = (w - 60) / A4_WIDTH;
          setZoom(Math.min(1.5, Math.max(0.2, fit)));
      }
  };

  const toggleFitZoom = () => {
      if (zoom === 1.0) handleFitZoom();
      else setZoom(1.0);
  };

  const handleAddScene = () => {
    let maxX = -Infinity; let maxY = 0;
    beats.forEach(b => { if (b.x > maxX) { maxX = b.x; maxY = b.y; } });
    if (maxX === -Infinity) { maxX = 25000; maxY = 25000; }
    
    // Add the beat and get ID
    const newId = addBeat(maxX + 300, maxY);
    
    // Focus logic: Wait for render, then focus prefix
    setTimeout(() => {
        const prefixInput = document.getElementById(`beat-prefix-${newId}`);
        if (prefixInput) prefixInput.focus();
        
        // Scroll new beat into view
        const card = document.getElementById(`beat-${newId}`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleSlugChange = (id: number, field: string, val: string) => {
      const beat = beats.find(b => b.id === id);
      if (beat) updateBeat(id, { slug: { ...beat.slug, [field]: val } });
  };

  const handleFormat = (type: string) => {
      // Optimistically update UI
      setActiveFormat(type);
      if (activeBeatId !== null && editorRefs.current[activeBeatId]) {
          editorRefs.current[activeBeatId]?.executeFormat(type);
      }
  };

  const filteredBeats = useMemo(() => {
      if (!searchTerm) return sortedBeats;
      const lower = searchTerm.toLowerCase();
      return sortedBeats.filter(b => 
          b.slug.location.toLowerCase().includes(lower) || 
          b.content.toLowerCase().includes(lower) ||
          b.title.toLowerCase().includes(lower)
      );
  }, [sortedBeats, searchTerm]);

  const editorStyle = {
      '--color-action': theme.text,
      '--color-character': theme.text,
      '--color-dialogue': theme.text,
      '--color-parenthetical': theme.text,
      '--color-transition': theme.text,
  } as React.CSSProperties;

  const FORMAT_BUTTONS = [
      { id: 'action', label: '1. Action', short: 'Opt+1', icon: AlignLeft },
      { id: 'character', label: '2. Character', short: 'Opt+2', icon: User },
      { id: 'dialogue', label: '3. Dialogue', short: 'Opt+3', icon: MessageSquare },
      { id: 'parenthetical', label: '4. Paren', short: 'Opt+4', icon: Parentheses },
      { id: 'transition', label: '5. Trans', short: 'Opt+5', icon: ArrowRightLeft },
      { id: 'shot', label: '6. Shot', short: 'Opt+6', icon: Camera },
      { id: 'lyrics', label: '7. Lyrics', short: 'Opt+7', icon: Music },
  ];

  return (
    <div className="flex w-full h-full bg-[#0c0c0c] overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <div className="w-64 bg-[#0a0a0a] border-r border-[#222] flex flex-col shrink-0 z-20 shadow-2xl">
         <div className="p-4 border-b border-[#222]">
            <div className="relative">
                <Search className="absolute left-2.5 top-2 text-[#555]" size={14} />
                <input 
                    type="text" placeholder="Find Scene..." 
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-[#f5a623] transition-colors"
                />
            </div>
         </div>
         <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
            {filteredBeats.map((beat, i) => (
                <button 
                    key={beat.id}
                    onClick={() => {
                        const el = document.getElementById(`beat-${beat.id}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="w-full text-left p-2.5 rounded hover:bg-[#1a1a1a] group transition-all flex items-center gap-3 border-l-2 border-transparent hover:border-[#f5a623]"
                >
                    <span className="text-[10px] font-bold font-mono w-5 shrink-0 text-right text-[#444] group-hover:text-[#f5a623]">{beat.sceneNumber || i + 1}</span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <div className="text-xs font-bold truncate uppercase flex-1 text-gray-400 group-hover:text-white">{beat.slug.location || 'UNTITLED SCENE'}</div>
                            {beat.status === 'ready' && <Lock size={10} className="text-green-500" />}
                        </div>
                    </div>
                </button>
            ))}
         </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="w-full bg-[#111] border-b border-[#222] flex flex-col shrink-0 z-20 shadow-sm select-none">
            
            {/* TOP BAR: Combined Controls */}
            <div className="flex items-center justify-between px-4 py-2 h-12 border-b border-[#222]">
                <div className="flex items-center gap-4">
                    {/* LEFT: Format Buttons (Inline) */}
                    <div className="flex items-center bg-[#1a1a1a] rounded border border-[#333] p-0.5 gap-0.5">
                        {FORMAT_BUTTONS.map((btn) => (
                            <button
                                key={btn.id}
                                onMouseDown={(e) => { e.preventDefault(); handleFormat(btn.id); }}
                                className={`
                                    px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded-sm transition-all duration-200 flex items-center gap-2
                                    ${activeFormat === btn.id 
                                        ? 'bg-[#f5a623] text-black shadow-sm' 
                                        : 'text-gray-400 hover:text-white hover:bg-[#222]'
                                    }
                                `}
                                title={`${btn.label} (${btn.short})`}
                            >
                                <btn.icon size={12} strokeWidth={2.5} />
                                <span className="hidden xl:inline">{btn.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* RIGHT: Theme & Zoom */}
                <div className="flex items-center gap-4">
                    {/* Theme Toggles */}
                    <div className="flex bg-[#1a1a1a] rounded border border-[#333] p-0.5">
                        <button onClick={() => setPaperTheme('white')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'white' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}><Sun size={12}/></button>
                        <button onClick={() => setPaperTheme('sepia')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'sepia' ? 'bg-[#fdf6e3] text-[#586e75]' : 'text-gray-500 hover:text-white'}`}><Coffee size={12}/></button>
                        <button onClick={() => setPaperTheme('dark')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'dark' ? 'bg-[#1a1a1a] text-white' : 'text-gray-500 hover:text-white'}`}><Moon size={12}/></button>
                        <button onClick={() => setPaperTheme('red')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'red' ? 'bg-[#000] text-red-500' : 'text-gray-500 hover:text-white'}`}><Eye size={12}/></button>
                    </div>
                    
                    <div className="w-[1px] h-4 bg-[#333]"></div>
                    
                    {/* Zoom Controls */}
                    <div className="flex items-center bg-[#1a1a1a] rounded border border-[#333]">
                        <button onClick={() => setZoom(Math.max(0.2, zoom - 0.1))} className="p-1.5 hover:bg-[#333] text-gray-400 hover:text-white border-r border-[#333]"><ZoomOut size={12} /></button>
                        
                        <button onClick={toggleFitZoom} className="px-3 py-1 text-[10px] font-bold text-gray-300 hover:text-white hover:bg-[#333] border-r border-[#333] transition-colors w-16 text-center">
                            {Math.round(zoom * 100)}%
                        </button>
                        
                        <button onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} className="p-1.5 hover:bg-[#333] text-gray-400 hover:text-white border-l border-[#333]"><ZoomIn size={12} /></button>
                    </div>
                </div>
            </div>
        </div>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto bg-[#121212] relative flex flex-col items-center pb-96 custom-scrollbar">
            <div 
                className="transition-transform duration-200 origin-top py-10"
                style={{ transform: `scale(${zoom})` }}
            >
                <div style={{ position: 'relative', width: `${A4_WIDTH}px`, minHeight: `${A4_HEIGHT}px` }}>
                    
                    {/* BACKGROUND LAYER */}
                    <div ref={paperLayerRef} className="absolute top-0 left-0 w-full flex flex-col pointer-events-none z-0"></div>

                    {/* CONTENT LAYER */}
                    <div 
                        ref={contentRef}
                        className="relative z-10 w-full h-full"
                        style={{
                            ...editorStyle,
                            paddingTop: `${MARGIN_TOP}px`, 
                            paddingBottom: `${MARGIN_BOTTOM}px`,
                            paddingLeft: `${MARGIN_LEFT}px`,
                            paddingRight: `${MARGIN_RIGHT}px`,
                        }}
                    >
                        <style>{`
                            .sc-line { color: ${theme.text}; }
                            .sc-slug { color: ${theme.slug}; }
                        `}</style>

                        {sortedBeats.map((beat, i) => {
                            const isReady = beat.status === 'ready';
                            return (
                                <div 
                                    key={beat.id} 
                                    id={`beat-${beat.id}`}
                                    className="beat-block group relative"
                                >
                                    {/* SCENE NUMBER (OUTSIDE SLUGLINE) */}
                                    <div 
                                        className="absolute -left-16 top-0.5 w-12 text-right font-mono text-xs font-bold select-none opacity-50 group-hover:opacity-100 transition-opacity"
                                        style={{ color: theme.pageNum }}
                                    >
                                        {beat.sceneNumber || i + 1}
                                    </div>

                                    {/* SLUGLINE BAR */}
                                    <div 
                                        className="flex items-center gap-2 mb-2 px-2 py-0.5 transition-colors -ml-2 -mr-2"
                                        style={{ backgroundColor: theme.slugBg }}
                                    >
                                        <div className="flex-1 flex items-center gap-2 font-bold uppercase font-screenplay text-sm">
                                            <SlugInput 
                                                id={`beat-prefix-${beat.id}`}
                                                value={beat.slug.prefix} 
                                                onChange={v => handleSlugChange(beat.id, 'prefix', v)}
                                                onNext={() => document.getElementById(`beat-location-${beat.id}`)?.focus()}
                                                suggestions={SLUG_PREFIXES}
                                                className="w-12 shrink-0"
                                                style={{ color: theme.slug }}
                                                placeholder="INT."
                                            />
                                            <SlugInput 
                                                id={`beat-location-${beat.id}`}
                                                value={beat.slug.location} 
                                                onChange={v => handleSlugChange(beat.id, 'location', v)}
                                                onNext={() => document.getElementById(`beat-time-${beat.id}`)?.focus()}
                                                suggestions={uniqueLocations}
                                                className="flex-1"
                                                style={{ color: theme.slug }}
                                                placeholder="LOCATION"
                                            />
                                            <span style={{ color: theme.slug }}>-</span>
                                            <SlugInput 
                                                id={`beat-time-${beat.id}`}
                                                value={beat.slug.time} 
                                                onChange={v => handleSlugChange(beat.id, 'time', v)}
                                                onNext={() => editorRefs.current[beat.id]?.focus()}
                                                suggestions={SLUG_TIMES}
                                                className="w-24 shrink-0"
                                                style={{ color: theme.slug }}
                                                placeholder="TIME"
                                            />
                                        </div>
                                        {isReady && <Lock size={12} className="text-green-500 ml-2" />}
                                    </div>

                                    {/* EDITOR */}
                                    <div>
                                        <ScriptEditor 
                                            ref={(el) => { editorRefs.current[beat.id] = el; }}
                                            id={`editor-${beat.id}`}
                                            initialHtml={beat.content}
                                            onSave={(html) => updateBeat(beat.id, { content: html })}
                                            suggestions={uniqueCharacters}
                                            readOnly={isReady}
                                            onFocus={() => setActiveBeatId(beat.id)}
                                            onActiveFormatChange={setActiveFormat}
                                            className="script-body min-h-[1.5em] outline-none"
                                            isActive={activeBeatId === beat.id}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {/* EXTREMELY SUBTLE ADD SCENE BUTTON */}
                        <div 
                            onClick={handleAddScene}
                            className="mt-8 mx-auto w-full max-w-xl h-6 border-b border-transparent hover:border-[#f5a623]/30 flex items-center justify-center cursor-pointer transition-all duration-300 group opacity-20 hover:opacity-100"
                        >
                            <span className="text-[9px] font-bold text-[#666] group-hover:text-[#f5a623] uppercase tracking-[0.2em] flex items-center gap-2 transition-colors">
                                <Plus size={8} /> Add Scene
                            </span>
                        </div>

                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptView;
