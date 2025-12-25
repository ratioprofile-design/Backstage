
import React, { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Search, Plus, Sun, Moon, Coffee, Eye, ZoomIn, ZoomOut, Lock, AlignLeft, User, MessageSquare, Parentheses, ArrowRightLeft, Camera, Music, Type, ListChecks, Sparkles, X, Package, Mic2, Shirt, Wand2, Users, Flame, Map, EyeOff, LayoutTemplate } from 'lucide-react';
import { ScriptEditor, ScriptEditorHandle } from '../ScriptEditor';
import { SlugInput } from '../SlugInput';
import { generateBreakdown } from '../../services/gemini';
import { BreakdownData, BreakdownItem } from '../../types';
import BoardView from './BoardView'; // Import BoardView for the sidebar

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
  const { beats, updateBeat, addBeat, scriptViewMode, scriptConfig, setScriptConfig, characterData, geminiApiKey, breakdownLanguage, setBreakdownLanguage } = useProject();
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [activeBeatId, setActiveBeatId] = useState<number | null>(null);
  const [activeFormat, setActiveFormat] = useState('action');
  
  // Sidebar State
  const [activeSidebar, setActiveSidebar] = useState<'none' | 'breakdown' | 'board'>('none');
  
  // Breakdown Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [showSourceHighlights, setShowSourceHighlights] = useState(false);
  
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

  const activeBeat = useMemo(() => beats.find(b => b.id === activeBeatId), [beats, activeBeatId]);

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
      Object.values(characterData).forEach((c: any) => {
          if (c.name) chars.add(c.name.toUpperCase());
      });

      // 2. Add from existing Script content (Dynamic)
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

  // Update zoom when sidebar toggles
  useEffect(() => {
      handleFitZoom();
  }, [activeSidebar]);

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

  const handleAnalyzeBreakdown = async () => {
      if (!activeBeat || !geminiApiKey) return;
      setIsAnalyzing(true);
      
      const div = document.createElement('div');
      div.innerHTML = activeBeat.content;
      const text = div.innerText;
      
      const result = await generateBreakdown(text, 'gemini-3-flash-preview', geminiApiKey, breakdownLanguage);
      if (result) {
          updateBeat(activeBeat.id, { breakdown: result });
      } else {
          alert("Failed to analyze breakdown. Check API key.");
      }
      setIsAnalyzing(false);
  };

  const addTag = (category: keyof BreakdownData, tag: string) => {
      if (!activeBeat) return;
      const current = activeBeat.breakdown || { props: [], sound: [], costume: [], vfx: [], practical: [], cast: [], location: [] };
      const list = current[category] || [];
      
      // Store as Item
      const newItem: BreakdownItem = { name: tag, source: '' };
      
      // Check for duplicates
      const exists = list.some(i => (typeof i === 'string' ? i : i.name) === tag);
      
      if (!exists) {
          updateBeat(activeBeat.id, { breakdown: { ...current, [category]: [...list, newItem] } });
      }
  };

  const removeTag = (category: keyof BreakdownData, tag: string) => {
      if (!activeBeat) return;
      const current = activeBeat.breakdown || { props: [], sound: [], costume: [], vfx: [], practical: [], cast: [], location: [] };
      const list = current[category] || [];
      const newList = list.filter(i => (typeof i === 'string' ? i : i.name) !== tag);
      updateBeat(activeBeat.id, { breakdown: { ...current, [category]: newList } });
  };

  const filteredBeats = useMemo(() => {
      if (!searchTerm) return sortedBeats;
      const lower = searchTerm.toLowerCase();
      return sortedBeats.filter(b => 
          (b.slug.location || '').toLowerCase().includes(lower) || 
          (b.content || '').toLowerCase().includes(lower) ||
          (b.title || '').toLowerCase().includes(lower)
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

  // --- SOURCE HIGHLIGHTING ---
  const highlightSourceText = (text: string) => {
      if (!text || !activeBeatId || !showSourceHighlights) return;
      
      const editorEl = document.getElementById(`editor-${activeBeatId}`);
      if (!editorEl) return;

      const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const search = normalize(text);
      if (!search) return;

      const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null);
      let node;
      while (node = walker.nextNode()) {
          const content = normalize(node.textContent || '');
          const index = content.indexOf(search);
          if (index !== -1) {
              const rawContent = node.textContent || '';
              const rawIndex = rawContent.toLowerCase().indexOf(search);
              
              if (rawIndex !== -1) {
                  const range = document.createRange();
                  range.setStart(node, rawIndex);
                  range.setEnd(node, rawIndex + search.length);
                  
                  const sel = window.getSelection();
                  sel?.removeAllRanges();
                  sel?.addRange(range);
                  
                  const element = node.parentElement;
                  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  return; // Stop after first match
              }
          }
      }
  };

  const clearHighlight = () => {
      if (showSourceHighlights) {
          window.getSelection()?.removeAllRanges();
      }
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, category: keyof BreakdownData, item: string) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ category, item }));
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, category: keyof BreakdownData) => {
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move';
      setDragOverCategory(category);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      setDragOverCategory(null);
  };

  const handleDrop = (e: React.DragEvent, targetCategory: keyof BreakdownData) => {
      e.preventDefault();
      setDragOverCategory(null);
      const data = e.dataTransfer.getData('text/plain');
      if (!data) return;
      
      try {
          const { category: sourceCategory, item: itemName } = JSON.parse(data);
          if (sourceCategory === targetCategory) return; 

          if (activeBeat) {
              const current = activeBeat.breakdown || { props: [], sound: [], costume: [], vfx: [], practical: [], cast: [], location: [] };
              
              const getName = (i: string | BreakdownItem) => typeof i === 'string' ? i : i.name;

              const sourceArray = current[sourceCategory as keyof BreakdownData] || [];
              const itemObj = sourceArray.find(i => getName(i) === itemName);
              const newSourceList = sourceArray.filter(i => getName(i) !== itemName);
              
              const targetList = current[targetCategory] || [];
              const newTargetList = targetList.some(i => getName(i) === itemName) 
                  ? targetList 
                  : [...targetList, itemObj || { name: itemName, source: '' }];

              updateBeat(activeBeat.id, {
                  breakdown: {
                      ...current,
                      [sourceCategory]: newSourceList,
                      [targetCategory]: newTargetList
                  }
              });
          }
      } catch (err) {
          console.error("Drop failed", err);
      }
  };

  const TagInput = ({ category }: { category: keyof BreakdownData }) => {
      const [val, setVal] = useState('');
      return (
          <div className="flex gap-1 mt-2">
              <input 
                  value={val}
                  onChange={e => setVal(e.target.value)}
                  onKeyDown={e => {
                      if (e.key === 'Enter' && val.trim()) {
                          addTag(category, val.trim());
                          setVal('');
                      }
                  }}
                  className="flex-1 bg-[#111] border border-[#333] rounded px-2 py-1 text-[10px] text-white focus:border-[#f5a623] outline-none"
                  placeholder="Add..."
              />
              <button onClick={() => { if(val.trim()) { addTag(category, val.trim()); setVal(''); } }} className="px-2 bg-[#222] hover:bg-[#333] text-gray-400 rounded"><Plus size={10}/></button>
          </div>
      );
  };

  const BreakdownSection = ({ title, category, icon: Icon, color }: any) => {
      const items = activeBeat?.breakdown?.[category as keyof BreakdownData] || [];
      const isDragOver = dragOverCategory === category;

      return (
          <div 
            className={`mb-4 rounded-md transition-all ${isDragOver ? 'ring-2 ring-dashed ring-[#f5a623] bg-[#222]' : ''}`}
            onDragOver={(e) => handleDragOver(e, category)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, category)}
          >
              <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${color}`}>
                  <Icon size={12} /> {title}
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[30px]">
                  {items.length === 0 && <span className="text-[10px] text-gray-700 italic select-none">None</span>}
                  {items.map((item, i) => {
                      const name = typeof item === 'string' ? item : item.name;
                      const source = typeof item === 'string' ? undefined : item.source;
                      
                      return (
                          <div 
                            key={i} 
                            draggable
                            onDragStart={(e) => handleDragStart(e, category, name)}
                            onMouseEnter={() => source && highlightSourceText(source)}
                            onMouseLeave={clearHighlight}
                            className={`flex items-center gap-1 bg-[#222] px-2 py-1 rounded text-[10px] text-gray-300 border border-[#333] group cursor-move hover:border-[#f5a623] transition-colors ${showSourceHighlights && source ? 'hover:bg-[#f5a623] hover:text-black' : ''}`}
                            title={source ? `Source: "${source}"` : "No source info"}
                          >
                              {name}
                              <button onClick={() => removeTag(category as keyof BreakdownData, name)} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100"><X size={10}/></button>
                          </div>
                      );
                  })}
              </div>
              <TagInput category={category as keyof BreakdownData} />
          </div>
      );
  };

  const isApiConnected = !!geminiApiKey;

  return (
    <div className="flex w-full h-full bg-[#0c0c0c] overflow-hidden font-sans">
      
      {/* SIDEBAR: SCENE NAVIGATOR */}
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
                        setActiveBeatId(beat.id);
                    }}
                    className={`w-full text-left p-2.5 rounded group transition-all flex items-center gap-3 border-l-2 ${activeBeatId === beat.id ? 'bg-[#1a1a1a] border-[#f5a623]' : 'border-transparent hover:bg-[#151515] hover:border-[#333]'}`}
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
                
                {/* RIGHT: Theme, Zoom, Breakdown Toggle */}
                <div className="flex items-center gap-4">
                    {/* Sidebar Toggles */}
                    <div className="flex bg-[#1a1a1a] rounded border border-[#333] p-0.5">
                        <button 
                            onClick={() => setActiveSidebar(activeSidebar === 'breakdown' ? 'none' : 'breakdown')}
                            className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${activeSidebar === 'breakdown' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-400 hover:text-white'}`}
                            title="Toggle Breakdown Panel"
                        >
                            <ListChecks size={14} /> Breakdown
                        </button>
                        <button 
                            onClick={() => setActiveSidebar(activeSidebar === 'board' ? 'none' : 'board')}
                            className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${activeSidebar === 'board' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-400 hover:text-white'}`}
                            title="Toggle Beat Board Panel"
                        >
                            <LayoutTemplate size={14} /> Board
                        </button>
                    </div>

                    <div className="w-[1px] h-4 bg-[#333]"></div>

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

        <div className="flex-1 flex overflow-hidden">
            {/* SCROLLER (SCRIPT) */}
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
                                        className={`beat-block group relative ${activeBeatId === beat.id ? 'z-20' : 'z-10'}`}
                                        onFocusCapture={() => setActiveBeatId(beat.id)}
                                        onClick={() => setActiveBeatId(beat.id)}
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
                                            style={{ backgroundColor: activeBeatId === beat.id ? '#f5a623' : theme.slugBg }}
                                        >
                                            <div className="flex-1 flex items-center gap-2 font-bold uppercase font-screenplay text-sm">
                                                <SlugInput 
                                                    id={`beat-prefix-${beat.id}`}
                                                    value={beat.slug.prefix} 
                                                    onChange={v => handleSlugChange(beat.id, 'prefix', v)}
                                                    onNext={() => document.getElementById(`beat-location-${beat.id}`)?.focus()}
                                                    suggestions={SLUG_PREFIXES}
                                                    className="w-12 shrink-0"
                                                    style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }}
                                                    placeholder="INT."
                                                />
                                                <SlugInput 
                                                    id={`beat-location-${beat.id}`}
                                                    value={beat.slug.location} 
                                                    onChange={v => handleSlugChange(beat.id, 'location', v)}
                                                    onNext={() => document.getElementById(`beat-time-${beat.id}`)?.focus()}
                                                    suggestions={uniqueLocations}
                                                    className="flex-1"
                                                    style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }}
                                                    placeholder="LOCATION"
                                                />
                                                <span style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }}>-</span>
                                                <SlugInput 
                                                    id={`beat-time-${beat.id}`}
                                                    value={beat.slug.time} 
                                                    onChange={v => handleSlugChange(beat.id, 'time', v)}
                                                    onNext={() => editorRefs.current[beat.id]?.focus()}
                                                    suggestions={SLUG_TIMES}
                                                    className="w-24 shrink-0"
                                                    style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }}
                                                    placeholder="TIME"
                                                />
                                            </div>
                                            {isReady && <Lock size={12} className={activeBeatId === beat.id ? "text-black" : "text-green-500 ml-2"} />}
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

            {/* RIGHT SIDEBAR (CONDITIONAL) */}
            {activeSidebar !== 'none' && (
                <div className="w-[400px] bg-[#161616] border-l border-[#333] flex flex-col animate-in slide-in-from-right-10 duration-200 z-30 shadow-2xl relative overflow-hidden">
                    
                    {/* Header */}
                    <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#1a1a1a] shrink-0">
                        <h3 className="text-xs font-black text-[#f5a623] uppercase tracking-widest flex items-center gap-2">
                            {activeSidebar === 'breakdown' ? <ListChecks size={14} /> : <LayoutTemplate size={14} />}
                            {activeSidebar === 'breakdown' ? 'Scene Breakdown' : 'Beat Board'}
                        </h3>
                        <div className="flex gap-2">
                            {activeSidebar === 'breakdown' && (
                                <button 
                                    onClick={() => { setShowSourceHighlights(!showSourceHighlights); clearHighlight(); }} 
                                    className={`p-1.5 rounded transition-colors ${showSourceHighlights ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`}
                                    title="Highlight source text in script on hover"
                                >
                                    {showSourceHighlights ? <Eye size={14}/> : <EyeOff size={14}/>}
                                </button>
                            )}
                            <button onClick={() => { setActiveSidebar('none'); clearHighlight(); }} className="text-gray-500 hover:text-white"><X size={14}/></button>
                        </div>
                    </div>
                    
                    {/* Content Area */}
                    <div className="flex-1 relative overflow-hidden">
                        
                        {/* BREAKDOWN MODE */}
                        {activeSidebar === 'breakdown' && (
                            <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4">
                                {activeBeat ? (
                                    <>
                                        <div className="mb-6 pb-4 border-b border-[#333]">
                                            <h4 className="text-sm font-bold text-white uppercase mb-4">{activeBeat.slug.location || 'Untitled Scene'}</h4>
                                            
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">Output Language</span>
                                                <div className="flex bg-[#111] rounded border border-[#333] p-0.5">
                                                    <button 
                                                        onClick={() => setBreakdownLanguage('english')}
                                                        className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${breakdownLanguage === 'english' ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`}
                                                    >ENG</button>
                                                    <button 
                                                        onClick={() => setBreakdownLanguage('tamil')}
                                                        className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${breakdownLanguage === 'tamil' ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`}
                                                    >TAM</button>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={handleAnalyzeBreakdown}
                                                disabled={isAnalyzing || !geminiApiKey}
                                                className={`w-full py-2 font-bold text-xs uppercase rounded flex items-center justify-center gap-2 transition-all ${!geminiApiKey ? 'bg-[#222] text-gray-600 cursor-not-allowed' : 'bg-[#f5a623] hover:bg-[#e09612] text-black disabled:opacity-50'}`}
                                            >
                                                {isAnalyzing ? <Sparkles size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                                                {isAnalyzing ? 'Analyzing...' : (geminiApiKey ? 'Auto-Analyze' : 'API Key Missing')}
                                            </button>
                                        </div>

                                        <BreakdownSection title="Location Scenario" category="location" icon={Map} color="text-orange-400" />
                                        <BreakdownSection title="Visual Effects" category="vfx" icon={Wand2} color="text-green-400" />
                                        <BreakdownSection title="Practical Effects" category="practical" icon={Flame} color="text-red-500" />
                                        <BreakdownSection title="Props" category="props" icon={Package} color="text-red-400" />
                                        <BreakdownSection title="Sound / SFX" category="sound" icon={Mic2} color="text-blue-400" />
                                        <BreakdownSection title="Wardrobe" category="costume" icon={Shirt} color="text-pink-400" />
                                        <BreakdownSection title="Cast / Extras" category="cast" icon={Users} color="text-yellow-400" />
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                                        <ListChecks size={32} opacity={0.2} />
                                        <span className="text-xs text-center px-4">Select a scene to view or create breakdown items.</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* BOARD MODE */}
                        {activeSidebar === 'board' && (
                            <div className="absolute inset-0">
                                <BoardView onEditBeat={(id) => { 
                                    // Scroll script to beat when clicked in sidebar board
                                    const el = document.getElementById(`beat-${id}`);
                                    if (el) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setActiveBeatId(id);
                                    }
                                }} />
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ScriptView;
