
import React, { useEffect, useRef, useState, useMemo, useLayoutEffect, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Search, Plus, Sun, Moon, Coffee, Eye, ZoomIn, ZoomOut, Lock, AlignLeft, User, MessageSquare, Parentheses, ArrowRightLeft, Camera, Music, Type, ListChecks, Sparkles, X, Package, Mic2, Shirt, Wand2, Users, Flame, Map, EyeOff, PanelLeft, History, StickyNote, RotateCcw, Save, Globe, Trash2, GripHorizontal, Bold, Italic, Heading, List, CheckSquare, Underline, Strikethrough, Quote } from 'lucide-react';
import { ScriptEditor, ScriptEditorHandle } from '../ScriptEditor';
import { SlugInput } from '../SlugInput';
import { generateBreakdown } from '../../services/gemini';
import { BreakdownData, BreakdownItem, BeatVersion, Note, Beat } from '../../types';
import { BlockEditor } from '../BlockEditor';
import DiffModal from '../DiffModal';

const A4_WIDTH = 794;  
const A4_HEIGHT = 1123;
const MARGIN_LEFT = 144;
const MARGIN_RIGHT = 96;
const MARGIN_TOP = 96;
const MARGIN_BOTTOM = 96;
const PAGE_GAP = 40; 
const BEAT_SPACING = 0; 
const SLUG_PREFIXES = ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.', 'I./E.', 'E./I.'];
const SLUG_TIMES = ['DAY', 'NIGHT', 'CONTINUOUS', 'MOMENTS LATER', 'MORNING', 'EVENING', 'LATER', 'SAME TIME', 'DAWN', 'DUSK'];

const NOTE_COLORS = [
    { bg: '#222', border: '#333' }, // Default Dark
    { bg: '#3a2a1a', border: '#d97706' }, // Orange
    { bg: '#1a2e1a', border: '#16a34a' }, // Green
    { bg: '#1a2a3a', border: '#2563eb' }, // Blue
    { bg: '#3a1a1a', border: '#dc2626' }, // Red
];

// Helper hook for debouncing
function useDebounce<T extends (...args: any[]) => void>(func: T, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
      return () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      func(...args);
    }, delay);
  }, [func, delay]);
}

// Inner Component for individual beat editor to handle local debounce
interface BeatEditorBlockProps {
    beat: Beat;
    isActive: boolean;
    isReady: boolean;
    uniqueCharacters: string[];
    setActiveFormat: (format: string) => void;
    onUpdateContent: (id: number, content: string) => void;
    onFocus: () => void;
    editorRefCallback: (el: ScriptEditorHandle | null) => void;
}

const BeatEditorBlock: React.FC<BeatEditorBlockProps> = React.memo(({ 
    beat, isActive, isReady, uniqueCharacters, setActiveFormat, onUpdateContent, onFocus, editorRefCallback 
}) => {
    // Local debounce to prevent flooding global state on every keystroke
    const debouncedSave = useDebounce((content: string) => {
        onUpdateContent(beat.id, content);
    }, 500);

    // Immediate save handler for blur events
    const handleImmediateSave = (content: string) => {
        onUpdateContent(beat.id, content);
    };

    return (
        <ScriptEditor 
            ref={editorRefCallback} 
            id={`editor-${beat.id}`} 
            initialHtml={beat.content} 
            onSave={debouncedSave} // Use debounced save while typing
            onSaveImmediate={handleImmediateSave} // Instant save on blur
            suggestions={uniqueCharacters} 
            readOnly={isReady} 
            onFocus={onFocus} 
            onActiveFormatChange={setActiveFormat} 
            className="script-body min-h-[1.5em] outline-none" 
            isActive={isActive} 
        />
    );
}, (prev, next) => {
    return prev.beat.id === next.beat.id && 
           prev.beat.content === next.beat.content && 
           prev.isActive === next.isActive && 
           prev.isReady === next.isReady;
});

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
  const { beats, updateBeat, addBeat, scriptViewMode, scriptConfig, setScriptConfig, scratchpadConfig, characterData, geminiApiKey, breakdownLanguage, setBreakdownLanguage, scratchpad, setScratchpad, globalNotes, setGlobalNotes } = useProject();
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [activeBeatId, setActiveBeatId] = useState<number | null>(null);
  const [activeFormat, setActiveFormat] = useState('action');
  
  // Navigation & Sidebar State
  const [showNav, setShowNav] = useState(true);
  const [activeSidebar, setActiveSidebar] = useState<'none' | 'breakdown' | 'scratchpad' | 'history'>('scratchpad');
  const [scratchpadMode, setScratchpadMode] = useState<'global' | 'scene'>('global');
  
  // Dragging State for Notes
  const [draggedNoteIndex, setDraggedNoteIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null); // For visual drop indicator
  
  // Delete Confirmation State
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);

  // Breakdown Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [showSourceHighlights, setShowSourceHighlights] = useState(false);
  
  // Version Restoration Diff State
  const [diffVersion, setDiffVersion] = useState<BeatVersion | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const paperLayerRef = useRef<HTMLDivElement>(null);
  const editorRefs = useRef<Record<number, ScriptEditorHandle | null>>({});
  
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

  const setPaperTheme = (theme: 'white' | 'dark' | 'sepia' | 'red') => {
      setScriptConfig({ ...scriptConfig, paperTheme: theme });
  };

  const sortedBeats = useMemo(() => {
    if (beats.length === 0) return [];
    return [...beats].sort((a, b) => {
        if (Math.abs(a.x - b.x) > 50) return a.x - b.x; 
        return a.y - b.y;
    });
  }, [beats]);

  const activeBeat = useMemo(() => beats.find(b => b.id === activeBeatId), [beats, activeBeatId]);

  const uniqueLocations = useMemo(() => {
      const locs = new Set<string>();
      ['HOUSE', 'KITCHEN', 'BEDROOM', 'OFFICE', 'PARK', 'STREET', 'CAR', 'APARTMENT', 'SCHOOL', 'HOSPITAL'].forEach(l => locs.add(l));
      beats.forEach(b => {
          if (b.slug.location && b.slug.location.trim()) {
              locs.add(b.slug.location.trim());
          }
      });
      return Array.from(locs).sort();
  }, [beats]);

  const uniqueCharacters = useMemo(() => {
      const chars = new Set<string>();
      Object.values(characterData).forEach((c: any) => {
          if (c.name) chars.add(c.name.toUpperCase());
      });
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

  // --- LAYOUT ENGINE TRIGGER (Unchanged) ---
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

  useEffect(() => { handleFitZoom(); }, []);

  useEffect(() => {
      handleFitZoom();
  }, [activeSidebar, showNav]);

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

  // ... (Other handlers unchanged)
  const handleAddScene = () => {
    let maxX = -Infinity; let maxY = 0;
    beats.forEach(b => { if (b.x > maxX) { maxX = b.x; maxY = b.y; } });
    if (maxX === -Infinity) { maxX = 25000; maxY = 25000; }
    const newId = addBeat(maxX + 300, maxY);
    setTimeout(() => {
        const prefixInput = document.getElementById(`beat-prefix-${newId}`);
        if (prefixInput) prefixInput.focus();
        const card = document.getElementById(`beat-${newId}`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleSlugChange = (id: number, field: string, val: string) => {
      const beat = beats.find(b => b.id === id);
      if (beat) updateBeat(id, { slug: { ...beat.slug, [field]: val } });
  };

  const handleContentUpdate = useCallback((id: number, content: string) => {
      updateBeat(id, { content });
  }, [updateBeat]);

  const handleFormat = (type: string) => {
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
      if (result) { updateBeat(activeBeat.id, { breakdown: result }); } 
      else { alert("Failed to analyze breakdown. Check API key."); }
      setIsAnalyzing(false);
  };

  const addTag = (category: keyof BreakdownData, tag: string) => {
      if (!activeBeat) return;
      const current = activeBeat.breakdown || { props: [], sound: [], costume: [], vfx: [], practical: [], cast: [], location: [] };
      const list = current[category] || [];
      const newItem: BreakdownItem = { name: tag, source: '' };
      const exists = list.some(i => (typeof i === 'string' ? i : i.name) === tag);
      if (!exists) { updateBeat(activeBeat.id, { breakdown: { ...current, [category]: [...list, newItem] } }); }
  };

  const removeTag = (category: keyof BreakdownData, tag: string) => {
      if (!activeBeat) return;
      const current = activeBeat.breakdown || { props: [], sound: [], costume: [], vfx: [], practical: [], cast: [], location: [] };
      const list = current[category] || [];
      const newList = list.filter(i => (typeof i === 'string' ? i : i.name) !== tag);
      updateBeat(activeBeat.id, { breakdown: { ...current, [category]: newList } });
  };

  const handleCreateSnapshot = () => {
      if (!activeBeat) return;
      const newVersion: BeatVersion = {
          id: `v-${Date.now()}`,
          timestamp: Date.now(),
          title: activeBeat.title || 'Untitled',
          content: activeBeat.content,
          summary: activeBeat.summary
      };
      const currentVersions = activeBeat.versions || [];
      updateBeat(activeBeat.id, { versions: [...currentVersions, newVersion] });
      setSaveStatus('saved');
  };

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  // TRIGGER DIFF MODAL
  const handleRestoreClick = (v: BeatVersion) => {
      if (!activeBeat) return;
      setDiffVersion(v);
  };

  const confirmRestoreVersion = () => {
      if (!activeBeat || !diffVersion) return;
      
      const backupVersion: BeatVersion = {
          id: `backup-${Date.now()}`,
          timestamp: Date.now(),
          title: activeBeat.title,
          content: activeBeat.content,
          summary: activeBeat.summary
      };
      
      updateBeat(activeBeat.id, {
          title: diffVersion.title,
          content: diffVersion.content,
          summary: diffVersion.summary,
          versions: [...(activeBeat.versions || []), backupVersion]
      });
      
      setDiffVersion(null); // Close modal
  };

  const addNote = () => {
      const newNote: Note = {
          id: `note-${Date.now()}`,
          content: '<div class="nl-block"><br></div>',
          color: '#d97706', // Default accent
          timestamp: Date.now()
      };
      if (scratchpadMode === 'global') {
          setGlobalNotes([...globalNotes, newNote]);
      } else if (activeBeat) {
          const currentNotes = activeBeat.notes || [];
          updateBeat(activeBeat.id, { notes: [...currentNotes, newNote] });
      }
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
      if (scratchpadMode === 'global') {
          setGlobalNotes(globalNotes.map(n => n.id === id ? { ...n, ...updates } : n));
      } else if (activeBeat) {
          const currentNotes = activeBeat.notes || [];
          updateBeat(activeBeat.id, { notes: currentNotes.map(n => n.id === id ? { ...n, ...updates } : n) });
      }
  };

  const deleteNote = (id: string) => {
      if (scratchpadMode === 'global') {
          setGlobalNotes(globalNotes.filter(n => n.id !== id));
      } else if (activeBeat) {
          const currentNotes = activeBeat.notes || [];
          updateBeat(activeBeat.id, { notes: currentNotes.filter(n => n.id !== id) });
      }
      setConfirmDeleteNoteId(null);
  };

  const handleNoteDragStart = (e: React.DragEvent, index: number) => {
      setDraggedNoteIndex(index);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleNoteDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault(); 
      setDragOverIndex(index);
  };

  const handleNoteDragLeave = () => {
      setDragOverIndex(null);
  };

  const handleNoteDrop = (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      setDragOverIndex(null);
      if (draggedNoteIndex === null || draggedNoteIndex === dropIndex) return;

      const currentNotes = scratchpadMode === 'global' ? [...globalNotes] : [...(activeBeat?.notes || [])];
      const draggedNote = currentNotes[draggedNoteIndex];
      
      currentNotes.splice(draggedNoteIndex, 1);
      currentNotes.splice(dropIndex, 0, draggedNote);

      if (scratchpadMode === 'global') {
          setGlobalNotes(currentNotes);
      } else if (activeBeat) {
          updateBeat(activeBeat.id, { notes: currentNotes });
      }
      setDraggedNoteIndex(null);
  };

  const insertMarkdown = (syntax: string) => {
      if (!scratchpadConfig.enableMarkdown) return;
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const node = sel.anchorNode;
      if (!node) return;
      const el = (node.nodeType === 3 ? node.parentNode : node) as HTMLElement;
      const block = el.closest('.nl-block');
      
      if (block) {
          if (block.textContent?.trim() === '') {
              block.textContent = syntax;
          } else {
              block.textContent = syntax + block.textContent;
          }
          const event = new Event('input', { bubbles: true });
          block.closest('.block-editor-content')?.dispatchEvent(event);
          const range = document.createRange();
          range.selectNodeContents(block);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
      }
  };

  const execStyle = (command: string, value: string = '') => {
      document.execCommand(command, false, value);
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
          const el = (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode) as HTMLElement;
          const editor = el.closest('.block-editor-content');
          if (editor) {
              const event = new Event('input', { bubbles: true });
              editor.dispatchEvent(event);
          }
      }
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

  // --- SOURCE HIGHLIGHTING LOGIC ---
  const clearHighlight = () => {
      const editorEl = document.getElementById(`editor-${activeBeatId}`);
      if (!editorEl) return;
      const highlights = editorEl.querySelectorAll('.temp-source-highlight');
      highlights.forEach(span => {
          const parent = span.parentNode;
          if (parent) {
              // Unwrap span
              while (span.firstChild) {
                  parent.insertBefore(span.firstChild, span);
              }
              parent.removeChild(span);
              parent.normalize(); // Merge text nodes
          }
      });
  };

  const highlightSourceText = (text: string, category: keyof BreakdownData) => {
      if (!text || !activeBeatId || !showSourceHighlights) return;
      const editorEl = document.getElementById(`editor-${activeBeatId}`);
      if (!editorEl) return;
      
      // Clear previous first
      clearHighlight();

      const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const search = normalize(text);
      if (!search) return;

      const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null);
      let node;
      while (node = walker.nextNode()) {
          const rawContent = node.textContent || '';
          const rawIndex = rawContent.toLowerCase().indexOf(search);

          if (rawIndex !== -1) {
              const range = document.createRange();
              range.setStart(node, rawIndex);
              range.setEnd(node, rawIndex + search.length);
              
              const span = document.createElement('span');
              span.className = 'temp-source-highlight';
              
              // Category Color Mapping (RGB Triplets)
              let rgb = '250, 204, 21'; // Default Yellow
              switch(category) {
                  case 'location': rgb = '251, 146, 60'; break; // Orange
                  case 'vfx': rgb = '74, 222, 128'; break; // Green
                  case 'practical': rgb = '239, 68, 68'; break; // Red
                  case 'props': rgb = '248, 113, 113'; break; // Light Red
                  case 'sound': rgb = '96, 165, 250'; break; // Blue
                  case 'costume': rgb = '244, 114, 182'; break; // Pink
                  case 'cast': rgb = '250, 204, 21'; break; // Yellow
              }
              
              // Theme Awareness
              const isDark = scriptConfig.paperTheme === 'dark' || scriptConfig.paperTheme === 'red';
              // In light mode (White/Sepia), we use a stronger highlighter style (50% opacity)
              // In dark mode, we use a subtler glow (30% opacity) to keep white text readable
              const bgOpacity = isDark ? '0.3' : '0.5';
              const borderOpacity = isDark ? '0.6' : '0.8';

              span.style.backgroundColor = `rgba(${rgb}, ${bgOpacity})`;
              span.style.borderRadius = '2px';
              span.style.padding = '0 2px';
              span.style.borderBottom = `2px solid rgba(${rgb}, ${borderOpacity})`; // Underline for extra visibility
              
              // Inherit text color from the editor theme (Black for White paper, White for Dark paper)
              // This ensures maximum readability contrast against the paper background
              span.style.color = 'inherit'; 
              span.style.textShadow = 'none';

              try {
                  range.surroundContents(span);
                  span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  return; 
              } catch (e) {
                  console.warn("Highlight failed:", e);
              }
          }
      }
  };

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
      } catch (err) { console.error("Drop failed", err); }
  };

  const TagInput = ({ category }: { category: keyof BreakdownData }) => {
      const [val, setVal] = useState('');
      return (
          <div className="flex gap-1 mt-2">
              <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { addTag(category, val.trim()); setVal(''); } }} className="flex-1 bg-[#111] border border-[#333] rounded px-2 py-1 text-[10px] text-white focus:border-[#f5a623] outline-none" placeholder="Add..." />
              <button onClick={() => { if(val.trim()) { addTag(category, val.trim()); setVal(''); } }} className="px-2 bg-[#222] hover:bg-[#333] text-gray-400 rounded"><Plus size={10}/></button>
          </div>
      );
  };

  const BreakdownSection = ({ title, category, icon: Icon, color }: any) => {
      const items = activeBeat?.breakdown?.[category as keyof BreakdownData] || [];
      const isDragOver = dragOverCategory === category;
      return (
          <div className={`mb-4 rounded-md transition-all ${isDragOver ? 'ring-2 ring-dashed ring-[#f5a623] bg-[#222]' : ''}`} onDragOver={(e) => handleDragOver(e, category)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, category)}>
              <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${color}`}><Icon size={12} /> {title}</div>
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
                            onMouseEnter={() => source && highlightSourceText(source, category)} 
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
      
      {/* SIDEBAR */}
      {showNav && (
        <div className="w-64 bg-[#0a0a0a] border-r border-[#222] flex flex-col shrink-0 z-20 shadow-2xl transition-all">
            <div className="p-4 border-b border-[#222]">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2 text-[#555]" size={14} />
                    <input type="text" placeholder="Find Scene..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#333] rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-[#f5a623] transition-colors" />
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
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="w-full bg-[#111] border-b border-[#222] flex flex-col shrink-0 z-20 shadow-sm select-none">
            {/* TOP BAR */}
            <div className="flex items-center justify-between px-4 py-2 h-12 border-b border-[#222]">
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowNav(!showNav)} className={`w-8 h-8 flex items-center justify-center rounded border transition-all ${showNav ? 'bg-[#222] border-[#333] text-[#f5a623]' : 'bg-[#1a1a1a] border-[#333] text-gray-400 hover:text-white'}`} title="Toggle Navigation"><PanelLeft size={14} /></button>
                    <div className="flex items-center bg-[#1a1a1a] rounded border border-[#333] p-0.5 gap-0.5">
                        {FORMAT_BUTTONS.map((btn) => (
                            <button key={btn.id} onMouseDown={(e) => { e.preventDefault(); handleFormat(btn.id); }} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded-sm transition-all duration-200 flex items-center gap-2 ${activeFormat === btn.id ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-400 hover:text-white hover:bg-[#222]'}`} title={`${btn.label} (${btn.short})`}>
                                <btn.icon size={12} strokeWidth={2.5} />
                                <span className="hidden xl:inline">{btn.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                {/* ... Right controls unchanged ... */}
                <div className="flex items-center gap-4">
                    <div className="flex bg-[#1a1a1a] rounded border border-[#333] p-0.5">
                        <button onClick={() => setActiveSidebar(activeSidebar === 'scratchpad' ? 'none' : 'scratchpad')} className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${activeSidebar === 'scratchpad' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-400 hover:text-white'}`} title="Scratchpad"><StickyNote size={14} /></button>
                        <button onClick={() => setActiveSidebar(activeSidebar === 'breakdown' ? 'none' : 'breakdown')} className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${activeSidebar === 'breakdown' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-400 hover:text-white'}`} title="Scene Breakdown"><ListChecks size={14} /></button>
                        <button onClick={() => setActiveSidebar(activeSidebar === 'history' ? 'none' : 'history')} className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${activeSidebar === 'history' ? 'bg-[#222] text-[#f5a623] shadow-sm' : 'text-gray-400 hover:text-white'}`} title="Version History"><History size={14} /></button>
                    </div>
                    <div className="w-[1px] h-4 bg-[#333]"></div>
                    <div className="flex bg-[#1a1a1a] rounded border border-[#333] p-0.5">
                        <button onClick={() => setPaperTheme('white')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'white' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}><Sun size={12}/></button>
                        <button onClick={() => setPaperTheme('sepia')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'sepia' ? 'bg-[#fdf6e3] text-[#586e75]' : 'text-gray-500 hover:text-white'}`}><Coffee size={12}/></button>
                        <button onClick={() => setPaperTheme('dark')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'dark' ? 'bg-[#1a1a1a] text-white' : 'text-gray-500 hover:text-white'}`}><Moon size={12}/></button>
                        <button onClick={() => setPaperTheme('red')} className={`p-1.5 rounded ${scriptConfig.paperTheme === 'red' ? 'bg-[#000] text-red-500' : 'text-gray-500 hover:text-white'}`}><Eye size={12}/></button>
                    </div>
                    <div className="w-[1px] h-4 bg-[#333]"></div>
                    <div className="flex items-center bg-[#1a1a1a] rounded border border-[#333]">
                        <button onClick={() => setZoom(Math.max(0.2, zoom - 0.1))} className="p-1.5 hover:bg-[#333] text-gray-400 hover:text-white border-r border-[#333]"><ZoomOut size={12} /></button>
                        <button onClick={toggleFitZoom} className="px-3 py-1 text-[10px] font-bold text-gray-300 hover:text-white hover:bg-[#333] border-r border-[#333] transition-colors w-16 text-center">{Math.round(zoom * 100)}%</button>
                        <button onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} className="p-1.5 hover:bg-[#333] text-gray-400 hover:text-white border-l border-[#333]"><ZoomIn size={12} /></button>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            {/* SCROLLER (SCRIPT) */}
            <div ref={scrollerRef} className="flex-1 overflow-y-auto bg-[#121212] relative flex flex-col items-center pb-96 custom-scrollbar">
                <div className="transition-transform duration-200 origin-top py-10" style={{ transform: `scale(${zoom})` }}>
                    <div style={{ position: 'relative', width: `${A4_WIDTH}px`, minHeight: `${A4_HEIGHT}px` }}>
                        <div ref={paperLayerRef} className="absolute top-0 left-0 w-full flex flex-col pointer-events-none z-0"></div>
                        <div ref={contentRef} className="relative z-10 w-full h-full" style={{ ...editorStyle, paddingTop: `${MARGIN_TOP}px`, paddingBottom: `${MARGIN_BOTTOM}px`, paddingLeft: `${MARGIN_LEFT}px`, paddingRight: `${MARGIN_RIGHT}px`, }}>
                            <style>{`.sc-line { color: ${theme.text}; } .sc-slug { color: ${theme.slug}; }`}</style>
                            {sortedBeats.map((beat, i) => {
                                const isReady = beat.status === 'ready';
                                return (
                                    <div key={beat.id} id={`beat-${beat.id}`} className={`beat-block group relative ${activeBeatId === beat.id ? 'z-20' : 'z-10'}`} onFocusCapture={() => setActiveBeatId(beat.id)} onClick={() => setActiveBeatId(beat.id)}>
                                        <div className="absolute -left-16 top-0.5 w-12 text-right font-mono text-xs font-bold select-none opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: theme.pageNum }}>{beat.sceneNumber || i + 1}</div>
                                        <div className="flex items-center gap-2 mb-2 px-2 py-0.5 transition-colors -ml-2 -mr-2" style={{ backgroundColor: activeBeatId === beat.id ? '#f5a623' : theme.slugBg }}>
                                            <div className="flex-1 flex items-center gap-2 font-bold uppercase font-screenplay text-sm">
                                                {/* MODIFIED: Widths increased for Prefix and Time */}
                                                <SlugInput id={`beat-prefix-${beat.id}`} value={beat.slug.prefix} onChange={v => handleSlugChange(beat.id, 'prefix', v)} onNext={() => document.getElementById(`beat-location-${beat.id}`)?.focus()} suggestions={SLUG_PREFIXES} className="w-20 shrink-0" style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }} placeholder="INT." />
                                                <SlugInput id={`beat-location-${beat.id}`} value={beat.slug.location} onChange={v => handleSlugChange(beat.id, 'location', v)} onNext={() => document.getElementById(`beat-time-${beat.id}`)?.focus()} suggestions={uniqueLocations} className="flex-1" style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }} placeholder="LOCATION" />
                                                <span style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }}>-</span>
                                                <SlugInput id={`beat-time-${beat.id}`} value={beat.slug.time} onChange={v => handleSlugChange(beat.id, 'time', v)} onNext={() => editorRefs.current[beat.id]?.focus()} suggestions={SLUG_TIMES} className="w-32 shrink-0" style={{ color: activeBeatId === beat.id ? '#000' : theme.slug }} placeholder="TIME" />
                                            </div>
                                            {isReady && <Lock size={12} className={activeBeatId === beat.id ? "text-black" : "text-green-500 ml-2"} />}
                                        </div>
                                        <div>
                                            <BeatEditorBlock 
                                                beat={beat} 
                                                isActive={activeBeatId === beat.id} 
                                                isReady={isReady} 
                                                uniqueCharacters={uniqueCharacters} 
                                                setActiveFormat={setActiveFormat}
                                                onUpdateContent={handleContentUpdate} 
                                                onFocus={() => setActiveBeatId(beat.id)}
                                                editorRefCallback={(el) => { editorRefs.current[beat.id] = el; }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            <div onClick={handleAddScene} className="mt-8 mx-auto w-full max-w-xl h-6 border-b border-transparent hover:border-[#f5a623]/30 flex items-center justify-center cursor-pointer transition-all duration-300 group opacity-20 hover:opacity-100">
                                <span className="text-[9px] font-bold text-[#666] group-hover:text-[#f5a623] uppercase tracking-[0.2em] flex items-center gap-2 transition-colors"><Plus size={8} /> Add Scene</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDEBAR (CONDITIONAL) */}
            {activeSidebar !== 'none' && (
                <div className="w-[400px] bg-[#161616] border-l border-[#333] flex flex-col animate-in slide-in-from-right-10 duration-200 z-30 shadow-2xl relative overflow-hidden">
                    {/* ... (Sidebar Content - Unchanged) */}
                    <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#1a1a1a] shrink-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black text-[#f5a623] uppercase tracking-widest flex items-center gap-2">
                                {activeSidebar === 'breakdown' && <><ListChecks size={14} /> Scene Breakdown</>}
                                {activeSidebar === 'scratchpad' && <><StickyNote size={14} /> Note Blocks</>}
                                {activeSidebar === 'history' && <><History size={14} /> Version History</>}
                            </h3>
                            {activeSidebar === 'scratchpad' && scratchpadConfig.enableMarkdown && (
                                <div className="flex items-center gap-1 ml-auto bg-[#111] rounded-md border border-[#333] p-1">
                                    <div className="flex gap-0.5">
                                        <button onMouseDown={(e) => { e.preventDefault(); execStyle('bold'); }} className="p-1 hover:bg-[#252525] text-gray-500 hover:text-white rounded transition-colors" title="Bold"><Bold size={10} /></button>
                                        <button onMouseDown={(e) => { e.preventDefault(); execStyle('italic'); }} className="p-1 hover:bg-[#252525] text-gray-500 hover:text-white rounded transition-colors" title="Italic"><Italic size={10} /></button>
                                        <button onMouseDown={(e) => { e.preventDefault(); execStyle('underline'); }} className="p-1 hover:bg-[#252525] text-gray-500 hover:text-white rounded transition-colors" title="Underline"><Underline size={10} /></button>
                                        <button onMouseDown={(e) => { e.preventDefault(); execStyle('strikeThrough'); }} className="p-1 hover:bg-[#252525] text-gray-500 hover:text-white rounded transition-colors" title="Strike"><Strikethrough size={10} /></button>
                                    </div>
                                    <div className="w-px h-3 bg-[#333] mx-1"></div>
                                    <div className="flex gap-0.5">
                                        <button onMouseDown={(e) => { e.preventDefault(); insertMarkdown('# '); }} className="p-1 hover:bg-[#252525] text-gray-500 hover:text-white rounded transition-colors" title="Heading 1"><Heading size={10} /></button>
                                        <button onMouseDown={(e) => { e.preventDefault(); insertMarkdown('## '); }} className="p-1 hover:bg-[#252525] text-gray-500 hover:text-white rounded transition-colors" title="Heading 2"><Heading size={8} /></button>
                                    </div>
                                    <div className="w-px h-3 bg-[#333] mx-1"></div>
                                    <div className="flex gap-0.5">
                                        <button onMouseDown={(e) => { e.preventDefault(); insertMarkdown('- '); }} className="p-1 hover:bg-[#252525] text-gray-500 hover:text-white rounded transition-colors" title="Bullet List"><List size={10} /></button>
                                        <button onMouseDown={(e) => { e.preventDefault(); insertMarkdown('[] '); }} className="p-1 hover:bg-[#252525] text-gray-500 hover:text-white rounded transition-colors" title="Todo"><CheckSquare size={10} /></button>
                                        <button onMouseDown={(e) => { e.preventDefault(); insertMarkdown('> '); }} className="p-1 hover:bg-[#252525] text-gray-500 hover:text-white rounded transition-colors" title="Quote / Callout"><Quote size={10} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 ml-4">
                            {activeSidebar === 'breakdown' && (
                                <button onClick={() => { setShowSourceHighlights(!showSourceHighlights); clearHighlight(); }} className={`p-1.5 rounded transition-colors ${showSourceHighlights ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`} title="Highlight source text in script on hover"><Eye size={14}/></button>
                            )}
                            <button onClick={() => { setActiveSidebar('none'); clearHighlight(); }} className="text-gray-500 hover:text-white"><X size={14}/></button>
                        </div>
                    </div>
                    
                    {/* Content Area */}
                    <div className="flex-1 relative overflow-hidden">
                        
                        {/* BREAKDOWN MODE ... */}
                        {activeSidebar === 'breakdown' && (
                            <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4">
                                {activeBeat ? (
                                    <>
                                        <div className="mb-6 pb-4 border-b border-[#333]">
                                            <h4 className="text-sm font-bold text-white uppercase mb-4">{activeBeat.slug.location || 'Untitled Scene'}</h4>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">Output Language</span>
                                                <div className="flex bg-[#111] rounded border border-[#333] p-0.5">
                                                    <button onClick={() => setBreakdownLanguage('english')} className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${breakdownLanguage === 'english' ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`}>ENG</button>
                                                    <button onClick={() => setBreakdownLanguage('tamil')} className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded ${breakdownLanguage === 'tamil' ? 'bg-[#f5a623] text-black' : 'text-gray-500 hover:text-white'}`}>TAM</button>
                                                </div>
                                            </div>
                                            <button onClick={handleAnalyzeBreakdown} disabled={isAnalyzing || !geminiApiKey} className={`w-full py-2 font-bold text-xs uppercase rounded flex items-center justify-center gap-2 transition-all ${!geminiApiKey ? 'bg-[#222] text-gray-600 cursor-not-allowed' : 'bg-[#f5a623] hover:bg-[#e09612] text-black disabled:opacity-50'}`}>
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
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2"><ListChecks size={32} opacity={0.2} /><span className="text-xs text-center px-4">Select a scene to view or create breakdown items.</span></div>
                                )}
                            </div>
                        )}

                        {/* SCRATCHPAD MODE */}
                        {activeSidebar === 'scratchpad' && (
                            <div className="absolute inset-0 flex flex-col">
                                <div className="px-4 py-3 border-b border-[#333] bg-[#161616]">
                                    <div className="flex bg-black/40 p-1 rounded-lg border border-[#333] relative">
                                        <button 
                                            onClick={() => setScratchpadMode('global')} 
                                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all relative z-10 flex items-center justify-center gap-2 ${scratchpadMode === 'global' ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            <Globe size={10} /> Global Notes
                                        </button>
                                        <button 
                                            onClick={() => setScratchpadMode('scene')} 
                                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all relative z-10 flex items-center justify-center gap-2 ${scratchpadMode === 'scene' ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            <StickyNote size={10} /> Scene Notes
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-[#111]">
                                    {(scratchpadMode === 'global' ? globalNotes : (activeBeat?.notes || [])).map((note, index) => {
                                        const isConfirming = confirmDeleteNoteId === note.id;
                                        // Subtle Border Logic: Using transparency
                                        const borderColor = note.color; // The hex
                                        const subtleBorder = `${borderColor}40`; // 25% opacity
                                        const subtleBg = `${borderColor}05`; // Reduced to 5% opacity for softer look

                                        return (
                                            <div 
                                                key={note.id}
                                                draggable={false} 
                                                onDragOver={(e) => handleNoteDragOver(e, index)}
                                                onDrop={(e) => handleNoteDrop(e, index)}
                                                onDragLeave={handleNoteDragLeave}
                                                className={`mb-4 rounded-md overflow-hidden transition-all shadow-sm group relative ${scratchpadConfig.glassEffect ? 'backdrop-blur-md' : ''}`}
                                                style={{ 
                                                    transition: 'transform 0.2s, opacity 0.2s',
                                                    transform: dragOverIndex === index && scratchpadConfig.enableDragAnimations ? `scale(${scratchpadConfig.dragScale})` : 'scale(1)',
                                                    opacity: dragOverIndex === index && scratchpadConfig.enableDragAnimations ? scratchpadConfig.dragOpacity : 1,
                                                    border: `1px solid ${subtleBorder}`,
                                                    backgroundColor: subtleBg,
                                                    boxShadow: `0 1px 3px rgba(0,0,0,0.3), 0 0 2px ${subtleBorder}`
                                                }}
                                            >
                                                {/* Header */}
                                                <div 
                                                    draggable={true}
                                                    onDragStart={(e) => handleNoteDragStart(e, index)}
                                                    className="flex justify-between items-center px-2 py-1 border-b border-white/5 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors"
                                                    style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
                                                >
                                                    <div className="flex gap-1 items-center">
                                                        <GripHorizontal size={12} className="text-gray-600 mr-2" />
                                                        {NOTE_COLORS.map(c => (
                                                            <div 
                                                                key={c.bg} 
                                                                className={`w-2 h-2 rounded-full cursor-pointer transition-transform hover:scale-125 ${note.color === c.border ? 'ring-1 ring-white' : 'opacity-50 hover:opacity-100'}`}
                                                                style={{ backgroundColor: c.border }}
                                                                onMouseDown={(e) => { e.stopPropagation(); updateNote(note.id, { color: c.border }); }}
                                                            ></div>
                                                        ))}
                                                    </div>
                                                    
                                                    {/* DOUBLE CONFIRM DELETE BUTTON */}
                                                    <button 
                                                        onMouseDown={(e) => { 
                                                            e.stopPropagation(); 
                                                            if(isConfirming) deleteNote(note.id);
                                                            else {
                                                                setConfirmDeleteNoteId(note.id);
                                                                setTimeout(() => setConfirmDeleteNoteId(null), 3000); // Reset after 3s
                                                            }
                                                        }} 
                                                        className={`transition-colors ${isConfirming ? 'text-red-500 animate-pulse bg-red-900/20 px-1 rounded' : 'text-white/30 hover:text-white'}`}
                                                        title={isConfirming ? "Click again to delete" : "Delete Note"}
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                                
                                                {/* Body */}
                                                <div style={{ backgroundColor: 'transparent' }}>
                                                    <BlockEditor 
                                                        value={note.content}
                                                        onChange={(val) => updateNote(note.id, { content: val })}
                                                        className="bg-transparent border-none rounded-none"
                                                        minHeight="80px"
                                                        placeholder="Type '#' for H1, '-' for list..."
                                                        fontFamily={scratchpadConfig.fontFamily}
                                                        fontSize={scratchpadConfig.fontSize}
                                                        style={{ lineHeight: scratchpadConfig.lineHeight }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {(scratchpadMode === 'scene' && !activeBeat) ? (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2"><StickyNote size={32} opacity={0.2} /><span className="text-xs text-center px-4">Select a scene to add notes.</span></div>
                                    ) : (
                                        <button onClick={addNote} className="w-full py-3 mt-2 border border-dashed border-[#333] hover:border-[#f5a623] hover:bg-[#f5a623]/10 text-gray-500 hover:text-[#f5a623] rounded-none text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"><Plus size={14} /> Add Note</button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* HISTORY MODE */}
                        {activeSidebar === 'history' && (
                            <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4">
                                {activeBeat ? (
                                    <div className="flex flex-col h-full">
                                        <div className="mb-4 bg-[#111] p-3 rounded border border-[#333]">
                                            <h4 className="text-xs font-bold text-white uppercase mb-1">{activeBeat.slug.location || 'Untitled'}</h4>
                                            <div className="text-[10px] text-gray-500 font-mono">Current Version</div>
                                        </div>
                                        <button onClick={handleCreateSnapshot} className="w-full py-2 mb-6 bg-[#222] hover:bg-[#333] border border-[#333] text-gray-300 text-xs font-bold uppercase rounded flex items-center justify-center gap-2 transition-all"><Save size={12} /> Create Snapshot</button>
                                        <div className="space-y-2">
                                            {activeBeat.versions && activeBeat.versions.length > 0 ? (
                                                [...activeBeat.versions].reverse().map((v, i) => (
                                                    <div key={v.id} className="bg-[#111] border border-[#222] rounded p-3 group hover:border-[#444] transition-colors">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[10px] font-bold text-[#f5a623] uppercase">v{activeBeat.versions!.length - i}</span>
                                                            <span className="text-[9px] text-gray-500 font-mono">{new Date(v.timestamp).toLocaleString()}</span>
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 mb-3 line-clamp-2 italic opacity-70">{v.summary || "No summary provided."}</div>
                                                        
                                                        {/* UPDATED: USE NEW DIFF MODAL INSTEAD OF DIRECT RESTORE */}
                                                        <button 
                                                            onClick={() => handleRestoreClick(v)} 
                                                            className="w-full py-1.5 bg-[#1a1a1a] hover:bg-[#252525] text-gray-400 hover:text-white border border-[#333] rounded text-[9px] font-bold uppercase flex items-center justify-center gap-2 transition-colors"
                                                        >
                                                            <RotateCcw size={10} /> Restore
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-10 text-gray-600"><History size={32} className="mx-auto mb-2 opacity-20" /><span className="text-xs">No snapshots yet.</span></div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2"><History size={32} opacity={0.2} /><span className="text-xs text-center px-4">Select a scene to view version history.</span></div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
      </div>

      {/* DIFF MODAL */}
      {diffVersion && activeBeat && (
          <DiffModal
              currentContent={activeBeat.content}
              snapshotContent={diffVersion.content}
              timestamp={diffVersion.timestamp}
              snapshotTitle={diffVersion.summary}
              onRestore={confirmRestoreVersion}
              onClose={() => setDiffVersion(null)}
          />
      )}
    </div>
  );
};

export default ScriptView;
