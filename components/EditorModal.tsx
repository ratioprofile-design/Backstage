
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { ScriptEditor } from './ScriptEditor';
import { SlugInput } from './SlugInput';
import { BeatVersion, Beat, Connection } from '../types';
import { 
  X, Save, CheckCircle2, Cloud, 
  Clock, Bold, Italic, Underline,
  Palette, Highlighter, ChevronDown,
  AlignLeft, Hash, Type, History, RotateCcw,
  Check, CircleDashed, ArchiveRestore, Plus,
  Layers, ChevronRight, GripHorizontal, Calendar,
  PanelLeft, Lock
} from 'lucide-react';

interface EditorModalProps {
  beatId: number;
  onClose: () => void;
  onViewInScript?: () => void;
  onFocus?: () => void;
  initialOffset?: number;
}

// --- HELPER COMPONENTS ---

const ColorDropdown = ({ icon: Icon, type, title, options, onSelect }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onMouseDown={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
                className={`h-6 px-1.5 rounded-none flex items-center gap-1 transition-all duration-300 ${
                    isOpen 
                    ? 'bg-[#f5a623]/20 text-[#f5a623]' 
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
                title={title}
            >
                <Icon size={14} />
                <ChevronDown size={10} className="opacity-50" />
            </button>
            
            {isOpen && (
                <div className="absolute top-full right-0 mt-1 bg-[#222] border border-[#333] shadow-xl p-2 z-50 grid grid-cols-5 gap-1 w-48 rounded-none">
                    {options.map((opt: any) => (
                        <button
                            key={opt.value || 'none'}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onSelect(opt.value);
                                setIsOpen(false);
                            }}
                            className="w-6 h-6 border border-white/10 hover:scale-110 transition-transform relative rounded-none"
                            style={{ backgroundColor: opt.value || 'transparent' }}
                            title={opt.label}
                        >
                            {!opt.value && <X size={12} className="text-red-400 absolute inset-0 m-auto" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// Simple debounce utility
const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFunc = useCallback((...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
  return debouncedFunc;
};

const TEXT_COLORS = [
    { label: 'Default', value: 'black' },
    { label: 'Red', value: '#ef4444' },
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Green', value: '#22c55e' },
    { label: 'Purple', value: '#a855f7' },
];

const HILITE_COLORS = [
    { label: 'None', value: 'transparent' },
    { label: 'Light Gray', value: '#f3f4f6' },
    { label: 'Gray', value: '#d1d5db' },
    { label: 'Yellow', value: '#fef08a' },
    { label: 'Green', value: '#bbf7d0' },
    { label: 'Blue', value: '#bfdbfe' },
    { label: 'Pink', value: '#fbcfe8' },
];

// --- GRAPH SORT HELPER ---
const getSortedBeats = (beats: Beat[], connections: Connection[]): Beat[] => {
    if (beats.length === 0) return [];

    const adj: Record<number, number[]> = {};
    const inDegree: Record<number, number> = {};
    const beatMap = new Map<number, Beat>();
    
    beats.forEach(b => {
        adj[b.id] = [];
        inDegree[b.id] = 0;
        beatMap.set(b.id, b);
    });

    connections.forEach(c => {
        if (adj[c.from] && inDegree[c.to] !== undefined) {
            adj[c.from].push(c.to);
            inDegree[c.to]++;
        }
    });

    let queue = beats.filter(b => inDegree[b.id] === 0).sort((a, b) => {
        if (Math.abs(a.x - b.x) > 50) return a.x - b.x;
        return a.y - b.y;
    });

    const resultIds: number[] = [];
    const visited = new Set<number>();

    while (queue.length > 0) {
        queue.sort((a, b) => {
             if (Math.abs(a.x - b.x) > 100) return a.x - b.x; 
             return a.y - b.y;
        });

        const u = queue.shift()!;
        if (visited.has(u.id)) continue;
        
        visited.add(u.id);
        resultIds.push(u.id);

        if (adj[u.id]) {
            adj[u.id].forEach(vId => {
                inDegree[vId]--;
                if (inDegree[vId] === 0) {
                    const vBeat = beatMap.get(vId);
                    if (vBeat) queue.push(vBeat);
                }
            });
        }
    }

    const unvisited = beats.filter(b => !visited.has(b.id));
    if (unvisited.length > 0) {
        unvisited.sort((a, b) => a.x - b.x || a.y - b.y);
        unvisited.forEach(b => resultIds.push(b.id));
    }

    return resultIds.map(id => beatMap.get(id)!);
};

const EditorModal: React.FC<EditorModalProps> = ({ beatId, onClose, onViewInScript, onFocus, initialOffset = 0 }) => {
  const { beats, updateBeat, scriptConfig, characterData, groups, connections, setConnections } = useProject();
  
  // Data Retrieval
  const beat = beats.find(b => b.id === beatId);
  const isReady = beat?.status === 'ready';
  const isReadOnly = isReady; 
  
  // --- DRAG IMPLEMENTATION ---
  const modalRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const dragInfo = useRef({ pos1: 0, pos2: 0, pos3: 0, pos4: 0 });

  useEffect(() => {
      if (modalRef.current) {
          const startTop = 80 + (initialOffset || 0);
          const startLeft = 100 + (initialOffset || 0);
          modalRef.current.style.top = `${startTop}px`;
          modalRef.current.style.left = `${startLeft}px`;
      }
  }, []);

  useEffect(() => {
      if (summaryRef.current) {
          summaryRef.current.style.height = 'auto';
          summaryRef.current.style.height = summaryRef.current.scrollHeight + 'px';
      }
  }, [beat?.summary, showSidebar]);

  const dragMouseDown = (e: React.MouseEvent) => {
      // @ts-ignore
      if (e.target.closest('button') || e.target.closest('input')) return;
      e.preventDefault();
      if (onFocus) onFocus();
      modalRef.current?.focus();
      dragInfo.current.pos3 = e.clientX;
      dragInfo.current.pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
  };

  // @ts-ignore
  const elementDrag = (e) => {
      e = e || window.event;
      e.preventDefault();
      dragInfo.current.pos1 = dragInfo.current.pos3 - e.clientX;
      dragInfo.current.pos2 = dragInfo.current.pos4 - e.clientY;
      dragInfo.current.pos3 = e.clientX;
      dragInfo.current.pos4 = e.clientY;
      if (modalRef.current) {
          modalRef.current.style.top = (modalRef.current.offsetTop - dragInfo.current.pos2) + "px";
          modalRef.current.style.left = (modalRef.current.offsetLeft - dragInfo.current.pos1) + "px";
      }
  };

  const closeDragElement = () => {
      document.onmouseup = null;
      document.onmousemove = null;
  };

  // IDs
  const prefixId = `modal-prefix-${beatId}`;
  const locationId = `modal-location-${beatId}`;
  const timeId = `modal-time-${beatId}`;
  const editorId = `modal-editor-${beatId}`;
  const scopeId = `editor-scope-${beatId}`;
  
  // --- SCENE ORDER LOGIC ---
  const sortedBeats = useMemo(() => getSortedBeats(beats, connections), [beats, connections]);
  const sceneIndex = useMemo(() => sortedBeats.findIndex(b => b.id === beatId) + 1, [sortedBeats, beatId]);
  
  const [tempSceneNum, setTempSceneNum] = useState(sceneIndex.toString());

  // Sync temp scene num when actual index changes (e.g. external reorder)
  useEffect(() => {
      setTempSceneNum(sceneIndex.toString());
  }, [sceneIndex]);

  const handleSceneReorder = (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
      const newIndex = parseInt(tempSceneNum);
      if (isNaN(newIndex) || newIndex < 1 || newIndex > beats.length || newIndex === sceneIndex) {
          setTempSceneNum(sceneIndex.toString()); // Revert if invalid or unchanged
          return;
      }

      // Logic: Move current beat to be AFTER the beat at (newIndex - 1)
      const otherBeats = sortedBeats.filter(b => b.id !== beatId);
      
      let newPredecessorId: number | null = null;
      let newSuccessorId: number | null = null;

      if (newIndex === 1) {
          // Moving to start
          newSuccessorId = otherBeats.length > 0 ? otherBeats[0].id : null;
      } else {
          // Moving to middle or end
          // Predecessor is at index (newIndex - 2) because newIndex is 1-based and we removed self
          const pred = otherBeats[newIndex - 2];
          if (pred) newPredecessorId = pred.id;
          
          const succ = otherBeats[newIndex - 1]; // The one currently at that spot
          if (succ) newSuccessorId = succ.id;
      }

      // Re-Link
      let newConns = connections.filter(c => c.from !== beatId && c.to !== beatId);
      
      // If we have a predecessor, connect Pred -> Me
      if (newPredecessorId !== null) {
          // Remove existing link from Pred -> (Old Successor) to avoid branching if we want linear insert
          const existingPredConn = connections.find(c => c.from === newPredecessorId);
          if (existingPredConn && existingPredConn.to === newSuccessorId) {
              newConns = newConns.filter(c => !(c.from === newPredecessorId && c.to === newSuccessorId));
          }
          
          newConns.push({ from: newPredecessorId, to: beatId });
      }

      // If we have a successor, connect Me -> Succ
      if (newSuccessorId !== null) {
          newConns.push({ from: beatId, to: newSuccessorId });
      }

      setConnections(newConns);
  };

  const hierarchy = useMemo(() => {
      if (!beat) return [];
      const bx = beat.x + 120;
      const by = beat.y + 70; 
      const parents = groups.filter(g => 
          bx >= g.x && bx <= g.x + g.width &&
          by >= g.y && by <= g.y + g.height
      );
      // Sort: Largest (Act) -> Smallest (Seq)
      return parents.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  }, [beat, groups]);

  const contentRef = useRef<string>(beat?.content || '');
  
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [activeFormat, setActiveFormat] = useState('action');
  const [activeStyles, setActiveStyles] = useState<string[]>([]);
  const [stats, setStats] = useState({ words: 0, chars: 0, duration: 0, pages: 0 });
  const [editorKey, setEditorKey] = useState(0); 
  
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showVersionMenu, setShowVersionMenu] = useState(false);

  const calculateStats = (html: string) => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const text = tempDiv.innerText || '';
      const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
      const chars = text.length;
      const duration = Math.max(0.5, Math.ceil((words / 200) * 10) / 10); 
      const pages = Math.ceil((words / 250) * 8) / 8;
      setStats({ words, chars, duration, pages });
  };

  const handleManualBackup = () => {
      if (!beat) return;
      const currentContent = contentRef.current;
      const newVersion: BeatVersion = {
          id: `v-${Date.now()}`,
          timestamp: Date.now(),
          title: beat.title || 'Untitled',
          content: currentContent,
          summary: beat.summary
      };
      const currentVersions = beat.versions || [];
      updateBeat(beat.id, { versions: [...currentVersions, newVersion] });
      setSaveStatus('saved'); 
  };

  const restoreVersion = (v: BeatVersion) => {
      if (!beat) return;
      if (confirm(`Restore version from ${new Date(v.timestamp).toLocaleTimeString()}? Current unsaved changes will be moved to history.`)) {
          const currentContent = contentRef.current;
          const backupVersion: BeatVersion = {
              id: `backup-${Date.now()}`,
              timestamp: Date.now(),
              title: beat.title,
              content: currentContent,
              summary: beat.summary
          };
          updateBeat(beat.id, {
              title: v.title,
              content: v.content,
              summary: v.summary,
              versions: [...(beat.versions || []), backupVersion]
          });
          contentRef.current = v.content;
          calculateStats(v.content);
          setEditorKey(prev => prev + 1);
          setShowVersionMenu(false);
      }
  };

  useEffect(() => {
      if (!beat || isReadOnly) return;
      const div = document.createElement('div');
      div.innerHTML = beat.content;
      const text = div.textContent?.trim() || '';
      if (text.length === 0 || (!beat.slug.location && !beat.slug.prefix)) {
          setTimeout(() => {
              const el = document.getElementById(prefixId);
              if (el) (el as HTMLElement).focus();
          }, 150);
      }
  }, []);

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

  useEffect(() => {
      const checkStyles = () => {
          const styles = [];
          if (document.queryCommandState('bold')) styles.push('bold');
          if (document.queryCommandState('italic')) styles.push('italic');
          if (document.queryCommandState('underline')) styles.push('underline');
          setActiveStyles(styles);
      };
      document.addEventListener('selectionchange', checkStyles);
      return () => document.removeEventListener('selectionchange', checkStyles);
  }, []);

  useEffect(() => {
      if (beat?.content) calculateStats(beat.content);
  }, [beat?.content]);

  const saveToContext = useDebounce((id: number, data: any) => {
    setSaveStatus('saving');
    updateBeat(id, data);
    setTimeout(() => setSaveStatus('saved'), 500);
  }, 1000); 

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!beat) return;
    updateBeat(beat.id, { title: e.target.value }); 
  };

  const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!beat) return;
    updateBeat(beat.id, { summary: e.target.value }); 
  };

  const handleSlugChange = (field: string, val: string) => {
    if (!beat || isReadOnly) return;
    updateBeat(beat.id, { 
       slug: { ...beat.slug, [field]: val } 
    });
  };

  const handleContentChange = (html: string) => {
    if (!beat || isReadOnly) return;
    contentRef.current = html;
    calculateStats(html);
    saveToContext(beat.id, { content: html });
  };

  const executeFormat = (type: string) => {
    if (isReadOnly) return;
    document.execCommand('formatBlock', false, 'div'); 
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    let node = sel.anchorNode;
    let block: HTMLElement | null = (node?.nodeType === 3 ? node.parentNode : node) as HTMLElement;
    while (block && !block.classList.contains('sc-line')) {
        if (block.id && block.id.startsWith('modal-editor-')) break;
        block = block.parentElement as HTMLElement;
    }
    if (block && block.classList.contains('sc-line')) {
        if (type === 'parenthetical') {
            block.className = 'sc-line sc-parenthetical';
            if (!block.innerText.startsWith('(')) block.innerText = `(${block.innerText})`;
        } else {
            block.className = `sc-line sc-${type}`;
            if (block.innerText.startsWith('(') && block.innerText.endsWith(')')) {
                block.innerText = block.innerText.replace(/^\(|\)$/g, '');
            }
        }
        setActiveFormat(type);
    }
  };

  const toggleInline = (command: string) => {
    if (isReadOnly) return;
    document.execCommand(command, false);
    const styles = [...activeStyles];
    if (document.queryCommandState(command)) {
        if(!styles.includes(command)) styles.push(command);
    } else {
        const idx = styles.indexOf(command);
        if(idx > -1) styles.splice(idx, 1);
    }
    setActiveStyles(styles);
  };

  const applyColor = (command: string, value: string | null) => {
      if (isReadOnly) return;
      document.execCommand(command, false, value || 'inherit');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
          if (showStatusMenu) { setShowStatusMenu(false); return; }
          if (showVersionMenu) { setShowVersionMenu(false); return; }
          e.stopPropagation();
          onClose();
      }
  };

  if (!beat) return null;

  return (
    <div 
        ref={modalRef}
        tabIndex={-1}
        className="fixed bg-[#1e1e1e] rounded-lg shadow-[0_30px_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden ring-1 ring-white/10 outline-none"
        style={{ 
            width: showSidebar ? 900 : 720,
            height: 550,
        }}
        onMouseDown={(e) => { 
            if(onFocus) onFocus();
            if (e.target !== document.activeElement && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                modalRef.current?.focus();
            }
        }}
        onKeyDown={handleKeyDown}
    >
      <style>{`
        #${scopeId} .sc-line { 
            color: #000000 !important; 
        }
      `}</style>

      {/* WINDOW HEADER (DRAGGABLE) */}
      <div 
        id={beatId + "header"}
        className="window-drag-handle h-9 bg-[#111] border-b border-[#333] flex items-center justify-between px-3 cursor-move select-none shrink-0"
        onMouseDown={dragMouseDown}
      >
          <div className="flex items-center gap-3 text-xs font-bold text-gray-400 pointer-events-none">
              <GripHorizontal size={14} className="text-[#444]" />
              <div className="flex items-center gap-2 pointer-events-auto">
                  <button 
                    onClick={() => setShowSidebar(!showSidebar)}
                    className={`p-1 rounded hover:bg-[#333] transition-colors ${showSidebar ? 'text-[#f5a623]' : 'text-gray-600'}`}
                    title="Toggle Sidebar"
                  >
                      <PanelLeft size={14} />
                  </button>
                  <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-500' : 'bg-[#f5a623]'}`}></span>
                  
                  {/* SEQUENCE HIERARCHY */}
                  {hierarchy.length > 0 && (
                      <div className="flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-0.5 ml-1 max-w-[200px] overflow-hidden whitespace-nowrap">
                          {hierarchy.map((g, i) => (
                              <React.Fragment key={g.id}>
                                  {i > 0 && <span className="text-[#444] mx-1 text-[8px]">›</span>}
                                  <span className="text-[9px] font-bold text-[#f5a623] uppercase truncate" title={g.title}>
                                      {g.title}
                                  </span>
                              </React.Fragment>
                          ))}
                      </div>
                  )}

                  {/* SCENE # AND TITLE INPUT */}
                  <div className="flex items-center gap-2 ml-1 bg-[#1a1a1a] rounded px-1.5 py-0.5 border border-[#333]">
                      <span className="text-[9px] font-bold text-[#666] uppercase">SCENE</span>
                      <input 
                          className="bg-transparent text-white font-bold w-6 text-center focus:text-[#f5a623] outline-none text-[10px]"
                          value={tempSceneNum}
                          onChange={(e) => setTempSceneNum(e.target.value)}
                          onBlur={handleSceneReorder}
                          onKeyDown={(e) => e.key === 'Enter' && handleSceneReorder(e as any)}
                          title="Edit scene number to reorder"
                      />
                      <div className="w-px h-3 bg-[#444]"></div>
                      <span className="text-[10px] font-bold text-white uppercase truncate max-w-[150px]" title={beat.title}>
                          {beat.title || <span className="text-[#555] italic">UNTITLED</span>}
                      </span>
                  </div>

                  {isReadOnly && (
                      <span className="flex items-center gap-1 text-[9px] bg-[#222] px-1.5 py-0.5 rounded text-gray-500 border border-[#333]">
                          <Lock size={10} /> LOCKED
                      </span>
                  )}
              </div>
          </div>
          <div className="flex items-center gap-2">
              <div className="text-[10px] text-gray-600 font-mono hidden sm:block pointer-events-none">ID: {beatId}</div>
              <button 
                onClick={onClose} 
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 hover:text-red-500 text-gray-500 transition-colors cursor-pointer"
                title="Close Window"
                onMouseDown={(e) => e.stopPropagation()} 
              >
                  <X size={14} />
              </button>
          </div>
      </div>
      
      {/* MAIN CONTENT ROW */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* --- LEFT SIDEBAR (STATS & META) --- */}
        {showSidebar && (
            <div className="w-48 bg-[#111] border-r border-[#333] p-4 flex flex-col shrink-0 relative overflow-y-auto custom-scrollbar animate-in slide-in-from-left-4 fade-in duration-200">
             <div className="flex flex-col gap-2 mb-4">
                {hierarchy.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1">
                        <Layers size={10} className="text-gray-500 mr-1" />
                        {hierarchy.map((g, i) => (
                            <React.Fragment key={g.id}>
                                <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wide bg-[#222] border border-[#333] px-1.5 py-0.5 rounded truncate max-w-[80px]" title={g.title}>
                                    {g.title}
                                </span>
                                {i < hierarchy.length - 1 && <ChevronRight size={10} className="text-gray-600" />}
                            </React.Fragment>
                        ))}
                    </div>
                )}
             </div>

             {/* Title Input */}
             <div className="space-y-1 mb-4">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Type size={10} /> Beat Title</label>
                <input 
                   value={beat.title}
                   onChange={handleTitleChange}
                   className="w-full bg-transparent border-b border-[#333] py-1 text-sm font-bold text-gray-200 outline-none transition-colors placeholder-gray-600 focus:border-[#f5a623]"
                   placeholder="Untitled Beat"
                />
             </div>

             {/* Status Dropdown */}
             <div className="mb-4 relative">
                 <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-2"><CheckCircle2 size={10} /> Status</label>
                 <button 
                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded border text-[10px] font-bold uppercase tracking-wide transition-all ${
                        isReady 
                        ? 'bg-green-900/20 border-green-800 text-green-400 hover:bg-green-900/30' 
                        : 'bg-orange-900/10 border-orange-900/30 text-orange-400 hover:bg-orange-900/20'
                    }`}
                 >
                    <span className="flex items-center gap-2">
                        {isReady ? <CheckCircle2 size={12} /> : <CircleDashed size={12} />}
                        {isReady ? 'Done' : 'W.I.P'}
                    </span>
                    <ChevronDown size={10} className="opacity-50" />
                 </button>
                 
                 {showStatusMenu && (
                     <div className="absolute top-full left-0 w-full mt-1 bg-[#222] border border-[#333] rounded shadow-xl z-20 overflow-hidden">
                         <button onClick={() => { updateBeat(beat.id, { status: 'not-ready' }); setShowStatusMenu(false); }} className="w-full text-left px-3 py-2 text-[10px] text-orange-400 hover:bg-[#333] flex items-center gap-2 font-bold"><CircleDashed size={12}/> In Progress</button>
                         <button onClick={() => { updateBeat(beat.id, { status: 'ready' }); setShowStatusMenu(false); }} className="w-full text-left px-3 py-2 text-[10px] text-green-400 hover:bg-[#333] flex items-center gap-2 font-bold"><CheckCircle2 size={12}/> Completed</button>
                     </div>
                 )}
             </div>

             {/* Synopsis */}
             <div className="space-y-2 mb-4">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Synopsis</label>
                <textarea 
                   ref={summaryRef}
                   value={beat.summary || ''}
                   onChange={handleSummaryChange}
                   className="w-full min-h-[5rem] bg-[#1a1a1a] border border-[#333] rounded p-2 text-xs text-gray-300 leading-relaxed outline-none resize-none transition-all custom-scrollbar placeholder-gray-600 overflow-hidden focus:border-[#f5a623] focus:ring-1 focus:ring-[#f5a623]/20"
                   placeholder="What happens?"
                />
             </div>

             {/* Version Control */}
             <div className="mb-4 space-y-2">
                 <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><History size={10} /> Versions</label>
                 
                 <div className="flex flex-col gap-2">
                    <button 
                        onClick={handleManualBackup}
                        className="w-full bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-gray-300 hover:text-white py-1.5 rounded text-[9px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2"
                        title="Save Snapshot"
                    >
                        <Save size={12} /> Save Snapshot
                    </button>

                    <div className="relative">
                        <button 
                            onClick={() => setShowVersionMenu(!showVersionMenu)}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded border border-[#333] bg-[#1a1a1a] text-gray-400 hover:text-white hover:border-[#555] text-[9px] font-bold uppercase tracking-wide transition-all"
                        >
                            <span className="flex items-center gap-1">
                                <ArchiveRestore size={10} />
                                View History ({beat.versions?.length || 0})
                            </span>
                            <ChevronDown size={10} />
                        </button>

                        {showVersionMenu && (
                            <div className="absolute top-full left-0 w-48 mt-1 bg-[#151515] border border-[#333] rounded shadow-2xl z-30 flex flex-col max-h-64 overflow-y-auto custom-scrollbar">
                                <div className="px-3 py-2 bg-[#1a1a1a] border-b border-[#333] text-[9px] font-bold text-gray-500 uppercase tracking-widest sticky top-0">Snapshots</div>
                                {beat.versions && beat.versions.length > 0 ? (
                                    [...beat.versions].reverse().map((v, i) => (
                                        <div
                                            key={v.id}
                                            className="w-full text-left px-3 py-2 border-b border-[#222] hover:bg-[#222] group last:border-0"
                                        >
                                            <div className="flex items-center justify-between text-[10px] text-gray-300 font-bold mb-1">
                                                <span className="flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#f5a623]"></div>
                                                    v{beat.versions!.length - i}
                                                </span>
                                                <button 
                                                    onClick={() => restoreVersion(v)}
                                                    className="text-[9px] text-blue-400 hover:text-white hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    Restore
                                                </button>
                                            </div>
                                            <div className="text-[9px] text-gray-500 flex justify-between font-mono">
                                                <span>{new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                <span>{new Date(v.timestamp).toLocaleDateString([], {month: 'short', day: 'numeric'})}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-3 py-6 text-[9px] text-gray-600 italic text-center flex flex-col items-center gap-2">
                                        <History size={16} />
                                        <span>No backups available</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                 </div>
             </div>

             {/* Stats Grid */}
             <div className="space-y-2 mt-auto">
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#1a1a1a] p-2 rounded border border-[#333] flex flex-col justify-center h-10">
                        <div className="text-[8px] text-gray-500 font-bold uppercase flex items-center gap-1"><Clock size={8} /> Time</div>
                        <div className="text-xs font-black text-gray-300 tracking-tight">~{stats.duration}m</div>
                    </div>
                    <div className="bg-[#1a1a1a] p-2 rounded border border-[#333] flex flex-col justify-center h-10">
                        <div className="text-[8px] text-gray-500 font-bold uppercase flex items-center gap-1"><AlignLeft size={8} /> Words</div>
                        <div className="text-xs font-black text-gray-300 tracking-tight">{stats.words}</div>
                    </div>
                </div>
             </div>

             {/* Footer Status */}
             <div className="flex items-center justify-between pt-3 border-t border-[#333] mt-4">
                <div className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1">
                   {saveStatus === 'saving' ? (
                     <>Saving <Cloud size={10} className="animate-pulse text-[#f5a623]" /></>
                   ) : (
                     <>Synced <CheckCircle2 size={10} className="text-green-500" /></>
                   )}
                </div>
             </div>

            </div>
        )}

        {/* --- RIGHT SIDE (EDITOR) --- */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] relative min-w-0">
            
            {/* 1. SLUGLINE BAR (STICKY) */}
            <div className={`px-4 py-2 border-b border-[#333] flex items-center gap-2 z-30 shrink-0 shadow-lg transition-colors ${isReadOnly ? 'bg-[#151515] opacity-80' : 'bg-[#1e1e1e]'}`}>
                <div className="w-full flex gap-2 items-center font-screenplay">
                    <span className="text-gray-500 font-bold select-none text-xs">{sceneIndex}.</span>
                    <SlugInput
                        id={prefixId}
                        value={beat.slug.prefix}
                        onChange={(val) => handleSlugChange('prefix', val)}
                        suggestions={['INT.', 'EXT.', 'I/E.', 'EXT./INT.']}
                        onNext={() => document.getElementById(locationId)?.focus()}
                        placeholder="INT."
                        readOnly={isReadOnly}
                        className="w-14 shrink-0 font-bold uppercase text-sm border-b border-transparent focus:border-[#f5a623] transition-colors text-gray-200 placeholder-gray-600"
                    />
                    <SlugInput 
                        id={locationId}
                        value={beat.slug.location}
                        onChange={(val) => handleSlugChange('location', val)}
                        suggestions={uniqueLocations} 
                        onNext={() => document.getElementById(timeId)?.focus()}
                        placeholder="LOCATION"
                        readOnly={isReadOnly}
                        className="flex-1 font-bold uppercase text-sm border-b border-transparent focus:border-[#f5a623] transition-colors text-gray-200 placeholder-gray-600"
                    />
                    <span className="text-gray-600 font-bold text-sm">-</span>
                    <SlugInput
                        id={timeId}
                        value={beat.slug.time}
                        onChange={(val) => handleSlugChange('time', val)}
                        suggestions={['DAY', 'NIGHT', 'CONTINUOUS', 'MOMENTS LATER', 'MORNING', 'EVENING']}
                        onNext={() => document.getElementById(editorId)?.focus()}
                        placeholder="DAY"
                        readOnly={isReadOnly}
                        className="w-20 shrink-0 font-bold uppercase text-sm border-b border-transparent focus:border-[#f5a623] transition-colors text-gray-200 placeholder-gray-600"
                        align="right"
                    />
                </div>
            </div>

            {/* 2. FORMATTING TOOLBAR */}
            <div className={`px-4 py-1.5 border-b border-[#333] flex items-center justify-between shrink-0 z-20 transition-colors ${isReadOnly ? 'bg-[#111] pointer-events-none opacity-50' : 'bg-[#111]'}`}>
                <div className="flex items-center gap-1">
                    {['action', 'character', 'dialogue', 'parenthetical', 'transition'].map(t => (
                        <button
                            key={t}
                            onMouseDown={(e) => { e.preventDefault(); executeFormat(t); }}
                            className={`px-2 py-1 text-[9px] font-bold uppercase transition-all rounded ${
                                activeFormat === t ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-500 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {t.substring(0, 4)}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                   <div className="flex items-center bg-[#222] rounded p-0.5 border border-[#333]">
                       <button onMouseDown={(e) => { e.preventDefault(); toggleInline('bold'); }} className={`p-1 rounded ${activeStyles.includes('bold') ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-500 hover:text-white'}`}><Bold size={12} /></button>
                       <button onMouseDown={(e) => { e.preventDefault(); toggleInline('italic'); }} className={`p-1 rounded ${activeStyles.includes('italic') ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-500 hover:text-white'}`}><Italic size={12} /></button>
                       <button onMouseDown={(e) => { e.preventDefault(); toggleInline('underline'); }} className={`p-1 rounded ${activeStyles.includes('underline') ? 'bg-[#f5a623] text-black shadow-sm' : 'text-gray-500 hover:text-white'}`}><Underline size={12} /></button>
                   </div>
                   <div className="w-[1px] h-4 bg-[#333]"></div>
                   <ColorDropdown icon={Palette} title="Text Color" type="foreColor" options={TEXT_COLORS} onSelect={(val: string) => applyColor('foreColor', val)} />
                   <ColorDropdown icon={Highlighter} title="Highlight Color" type="hiliteColor" options={HILITE_COLORS} onSelect={(val: string) => applyColor('hiliteColor', val)} />
                </div>
            </div>

            {/* 3. SCROLLABLE EDITOR (DARK DESK) */}
            <div 
                className="flex-1 overflow-y-auto bg-[#0c0c0c] cursor-text"
                onClick={(e) => {
                   if (!isReadOnly && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'BUTTON') {
                       document.getElementById(editorId)?.focus();
                   }
                }}
            >
                <div className="w-full min-h-full py-6 flex justify-center pb-20">
                    {/* 4. WHITE PAPER CONTAINER - Wider and Fixed Sizing */}
                    <div 
                        id={scopeId}
                        className={`bg-white shadow-xl py-10 pl-12 pr-16 text-black transition-opacity ${isReadOnly ? 'opacity-80' : ''}`}
                        style={{
                            width: '650px', // Slightly wider for comfort
                            minHeight: '800px',
                            maxWidth: '95%' 
                        }}
                    >
                        <ScriptEditor 
                            key={editorKey}
                            id={editorId}
                            initialHtml={contentRef.current} 
                            onSave={handleContentChange}
                            suggestions={uniqueCharacters} 
                            onActiveFormatChange={setActiveFormat}
                            readOnly={isReadOnly}
                            className="script-body outline-none font-screenplay text-[14px] leading-tight w-full break-words"
                            isActive={true} // Modal is always the active editing context when open
                        />
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default EditorModal;
