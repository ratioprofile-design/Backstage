
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { generateImage } from '../../services/gemini';
import { 
    User, Plus, Trash2, Search, 
    Fingerprint, Brain, Users, Activity, 
    Mic2, Sparkles, MoreHorizontal, Camera,
    Network, FileText, Link2, X,
    Bold, Italic
} from 'lucide-react';
import { CharacterData, CharacterRelationship } from '../../types';
import { 
    CHARACTER_GENDERS, CHARACTER_HAIR, CHARACTER_EYES, 
    CHARACTER_BUILDS, CHARACTER_ARCHETYPES, CHARACTER_ROLES,
    RELATIONSHIP_TYPES
} from '../../constants';

// --- NOTION-LIKE EDITOR ---
// A robust block-based editor wrapper around contentEditable
const NotionLikeEditor = ({ value, onChange, placeholder, minHeight = "150px" }: any) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isLocked = useRef(false); // Prevents circular updates during typing

    // Initial Sync & External Updates
    useEffect(() => {
        if (editorRef.current && !isLocked.current) {
            // Only update if content is significantly different to avoid cursor jumps
            if (editorRef.current.innerHTML !== value) {
                const isHtml = /<[a-z][\s\S]*>/i.test(value);
                if (!value) {
                    editorRef.current.innerHTML = `<div class="nl-block"></div>`;
                } else if (!isHtml) {
                    // Convert plain text newlines to divs
                    editorRef.current.innerHTML = value.split('\n').map((line: string) => `<div class="nl-block">${line}</div>`).join('');
                } else {
                    editorRef.current.innerHTML = value;
                }
            }
        }
    }, [value]);

    const emitChange = () => {
        if (editorRef.current) {
            isLocked.current = true; 
            onChange(editorRef.current.innerHTML);
            // Release lock after render cycle
            setTimeout(() => isLocked.current = false, 0);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            
            // Find current block
            let currentBlock = range.startContainer as HTMLElement;
            // Traverse up to find the block div
            while (currentBlock && (!currentBlock.classList || !currentBlock.classList.contains('nl-block'))) {
                if (currentBlock === editorRef.current) break;
                currentBlock = currentBlock.parentElement as HTMLElement;
            }
            
            if (currentBlock && currentBlock !== editorRef.current) {
                // Create new block
                const newBlock = document.createElement('div');
                newBlock.className = 'nl-block';
                
                // Continue List Logic (but not headers)
                if (currentBlock.classList.contains('nl-list')) {
                    newBlock.className = 'nl-block nl-list';
                } else if (currentBlock.classList.contains('nl-check')) {
                    newBlock.className = 'nl-block nl-check'; // Continue checkbox
                }
                
                newBlock.innerHTML = '<br>'; // Placeholder for caret
                currentBlock.after(newBlock);
                
                // Move caret
                const newRange = document.createRange();
                newRange.setStart(newBlock, 0);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
                
                emitChange();
            } else {
                // Fallback if empty
                document.execCommand('insertHTML', false, '<div class="nl-block"><br></div>');
            }
        } else if (e.key === ' ') {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            
            let node = range.startContainer;
            let block = (node.nodeType === 3 ? node.parentNode : node) as HTMLElement;
            
            while (block && (!block.classList || !block.classList.contains('nl-block'))) {
                if (block === editorRef.current) break;
                block = block.parentElement as HTMLElement;
            }

            if (block && block.classList.contains('nl-block')) {
                // We only check for triggers if the caret is at the start or text matches exactly
                // Using .trim() helps catch cases where invisible chars might be present
                const text = (block.textContent || '').trim();
                let type = '';
                
                if (text === '#') type = 'nl-h1';
                else if (text === '##') type = 'nl-h2';
                else if (text === '-') type = 'nl-list';
                else if (text === '>') type = 'nl-quote';
                else if (text === '[]') type = 'nl-check';
                
                if (type) {
                    e.preventDefault(); // Consume the space
                    block.className = `nl-block ${type}`;
                    block.innerHTML = '<br>'; // Clear trigger char
                    
                    // Reset caret to inside the cleared block
                    const newRange = document.createRange();
                    newRange.setStart(block, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    
                    emitChange();
                }
            }
        } else if (e.key === 'Backspace') {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            
            if (range.collapsed) {
                let block = (range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer) as HTMLElement;
                while (block && (!block.classList || !block.classList.contains('nl-block'))) {
                    if (block === editorRef.current) break;
                    block = block.parentElement as HTMLElement;
                }

                if (block && block.classList.contains('nl-block')) {
                    const text = block.textContent || '';
                    // If block is empty (or has zero-width space) and has a style, revert style
                    // Using regex to check for 'empty' content which might include <br> or whitespace
                    const isEmpty = !text.trim() || text === '\u200B';
                    
                    if (isEmpty && block.className !== 'nl-block') {
                        e.preventDefault();
                        block.className = 'nl-block';
                        emitChange();
                    }
                }
            }
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        // Handle Checkbox Toggling
        const target = e.target as HTMLElement;
        let block = target;
        while (block && !block.classList?.contains('nl-block') && block !== editorRef.current) {
            block = block.parentElement as HTMLElement;
        }

        if (block && block.classList?.contains('nl-check')) {
            const rect = block.getBoundingClientRect();
            // Click within left 30px (where the pseudo-checkbox is)
            if (e.clientX - rect.left < 30) {
                e.preventDefault(); // Prevent caret moving there if possible
                block.classList.toggle('nl-checked');
                emitChange();
            }
        }
    }

    // --- FORMATTING COMMANDS ---
    const exec = (cmd: string) => {
        document.execCommand(cmd, false);
        editorRef.current?.focus();
    };

    return (
        <div className="w-full bg-[#0a0a0a] rounded border border-[#222] hover:border-[#333] transition-all flex flex-col overflow-hidden group focus-within:border-[#f5a623] focus-within:shadow-[0_0_15px_rgba(245,166,35,0.1)]" style={{ minHeight }}>
            {/* CSS Injection */}
            <style>{`
                .nl-block { position: relative; min-height: 1.5em; margin-bottom: 0.25em; padding: 2px 4px; border-radius: 2px; line-height: 1.6; }
                .nl-block:focus { outline: none; }
                
                /* H1 - Bold, Larger, Underlined slightly */
                .nl-h1 { font-size: 1.5em !important; font-weight: 800; color: #fff; margin-top: 0.75em; margin-bottom: 0.5em; border-bottom: 1px solid #333; padding-bottom: 4px; }
                
                /* H2 - Orange Accent */
                .nl-h2 { font-size: 1.25em !important; font-weight: 700; color: #f5a623; margin-top: 0.75em; margin-bottom: 0.25em; }
                
                /* List */
                .nl-list { padding-left: 26px; }
                .nl-list::before { content: '•'; position: absolute; left: 10px; color: #f5a623; font-weight: bold; top: 0; }
                
                /* Quote */
                .nl-quote { border-left: 3px solid #f5a623; padding-left: 12px; font-style: italic; color: #888; background: rgba(245,166,35,0.05); border-radius: 0 4px 4px 0; }
                
                /* Checkbox - Interactive Look */
                .nl-check { padding-left: 30px; position: relative; }
                .nl-check::before { 
                    content: ''; 
                    position: absolute; left: 6px; top: 6px; 
                    width: 14px; height: 14px; 
                    border: 1px solid #555; 
                    border-radius: 3px; 
                    background: #111;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .nl-check:hover::before { border-color: #888; }
                
                /* Checked State */
                .nl-checked { text-decoration: line-through; color: #555; }
                .nl-checked::before { 
                    background: #f5a623; 
                    border-color: #f5a623; 
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E");
                    background-size: 10px;
                    background-position: center;
                    background-repeat: no-repeat;
                }
            `}</style>
            
            {/* Toolbar */}
            <div className="flex items-center gap-1 bg-[#111] border-b border-[#222] px-2 py-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button onClick={() => exec('bold')} className="p-1 hover:bg-[#222] rounded text-gray-500 hover:text-white" title="Bold"><Bold size={12}/></button>
                <button onClick={() => exec('italic')} className="p-1 hover:bg-[#222] rounded text-gray-500 hover:text-white" title="Italic"><Italic size={12}/></button>
                <div className="w-px h-3 bg-[#333] mx-1"></div>
                <div className="flex gap-3 text-[9px] text-gray-600 font-mono items-center ml-1">
                    <span><b>#</b> H1</span>
                    <span><b>##</b> H2</span>
                    <span><b>-</b> List</span>
                    <span><b>{'>'}</b> Quote</span>
                    <span><b>[]</b> Check</span>
                </div>
            </div>

            <div 
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={emitChange}
                onKeyDown={handleKeyDown}
                onClick={handleClick}
                className="flex-1 p-4 outline-none text-base text-gray-300 font-sans leading-relaxed custom-scrollbar"
                data-placeholder={placeholder}
            />
        </div>
    );
};

const CharacterView: React.FC = () => {
  const { characterData, setCharacterData, beats } = useProject();
  const [selectedCharId, setSelectedCharId] = useState<string | null>(Object.keys(characterData)[0] || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'backstory' | 'network'>('profile');

  // --- AUTO SCAN ON MOUNT ---
  useEffect(() => {
      const foundNames = new Set<string>();
      beats.forEach(beat => {
          const div = document.createElement('div');
          div.innerHTML = beat.content;
          const charElements = div.querySelectorAll('.sc-character');
          charElements.forEach(el => {
              const rawName = el.textContent || '';
              const cleanName = rawName.replace(/\s*\(.*\)$/, '').trim().toUpperCase();
              if (cleanName && cleanName.length > 1) {
                  foundNames.add(cleanName);
              }
          });
      });

      if (foundNames.size > 0) {
          setCharacterData((prev: Record<string, CharacterData>) => {
              const newState = { ...prev };
              let hasChanges = false;
              foundNames.forEach(name => {
                  if (!newState[name]) {
                      newState[name] = {
                          name,
                          physiology: '', sociology: '', psychology: '', backstory: '',
                          age: 30, gender: 'Unknown', hair: 'Dark', eyes: 'Brown', build: 'Average',
                          occupation: 'Unspecified', archetype: 'The Unknown',
                          images: [],
                          relationships: []
                      };
                      hasChanges = true;
                  }
              });
              return hasChanges ? newState : prev;
          });
      }
  }, [beats, setCharacterData]);

  // --- DATA HANDLING ---
  const characters = useMemo(() => {
      const all = Object.entries(characterData);
      if (!searchTerm) return all;
      return all.filter(([name, data]) => 
          name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          (data as CharacterData).archetype.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [characterData, searchTerm]);

  const selectedChar = selectedCharId ? characterData[selectedCharId] : null;

  // Legacy Safety
  if (selectedChar && !selectedChar.relationships) selectedChar.relationships = [];
  if (selectedChar && !selectedChar.backstory) selectedChar.backstory = '';

  const handleAddCharacter = () => {
    const name = `CHARACTER ${Object.keys(characterData).length + 1}`;
    const newChar: CharacterData = {
      name,
      physiology: '', sociology: '', psychology: '', backstory: '',
      age: 30, gender: 'Unknown', hair: 'Dark', eyes: 'Brown', build: 'Average',
      occupation: 'Unspecified', archetype: 'The Unknown',
      images: [],
      relationships: []
    };
    setCharacterData(prev => ({ ...prev, [name]: newChar }));
    setSelectedCharId(name);
  };

  const updateCharacter = (name: string, updates: Partial<CharacterData>) => {
    setCharacterData(prev => ({ ...prev, [name]: { ...prev[name], ...updates } }));
  };

  const handleDelete = (name: string) => {
      if(!confirm(`Delete ${name}?`)) return;
      const newMap = { ...characterData };
      delete newMap[name];
      setCharacterData(newMap);
      if (selectedCharId === name) setSelectedCharId(null);
  };

  const handleRename = (oldName: string, newName: string) => {
    if (oldName === newName || !newName.trim()) return;
    const upperNewName = newName.toUpperCase();
    if (characterData[upperNewName]) { alert("Character name already exists."); return; }

    setCharacterData(prev => {
      const data = prev[oldName];
      const newState = { ...prev };
      delete newState[oldName];
      newState[upperNewName] = { ...data, name: upperNewName };
      return newState;
    });
    setSelectedCharId(upperNewName);
  };

  const generatePortrait = async (char: CharacterData) => {
    setIsGenerating(true);
    const prompt = `Cinematic character portrait, close-up, dramatic lighting, shot on 35mm film. 
      Subject: ${char.name}, ${char.age} years old, ${char.gender}.
      Appearance: ${char.hair} hair, ${char.eyes} eyes, ${char.build} build.
      Vibe: ${char.archetype}, ${char.occupation}. 
      Style: Hyper-realistic, shallow depth of field, detailed texture.`;
    
    const img = await generateImage(prompt, '1:1'); 
    if (img) {
      updateCharacter(char.name, { images: [img, ...char.images] });
    }
    setIsGenerating(false);
  };

  // --- RELATIONSHIP LOGIC ---
  const addRelationship = (targetName: string, type: string) => {
      if (!selectedChar) return;
      const currentRels = selectedChar.relationships || [];
      if (currentRels.some(r => r.target === targetName)) return;
      const newRel: CharacterRelationship = { target: targetName, type, description: '' };
      updateCharacter(selectedChar.name, { relationships: [...currentRels, newRel] });
  };

  const removeRelationship = (targetName: string) => {
      if (!selectedChar) return;
      const currentRels = selectedChar.relationships || [];
      updateCharacter(selectedChar.name, { relationships: currentRels.filter(r => r.target !== targetName) });
  };

  const updateRelationship = (targetName: string, field: keyof CharacterRelationship, value: string) => {
      if (!selectedChar) return;
      const currentRels = selectedChar.relationships || [];
      const updated = currentRels.map(r => r.target === targetName ? { ...r, [field]: value } : r);
      updateCharacter(selectedChar.name, { relationships: updated });
  };

  return (
    <div className="flex w-full h-full bg-[#050505] text-gray-200 font-sans overflow-hidden">
      
      {/* --- SIDEBAR: CAST LIST --- */}
      <div className="w-72 border-r border-[#222] flex flex-col bg-[#0a0a0a] shrink-0 z-20">
        <div className="p-4 border-b border-[#222] space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#555]">Cast Manifest</span>
                <button onClick={handleAddCharacter} className="p-1.5 bg-[#f5a623] hover:bg-[#e09612] text-black rounded transition-all shadow-lg hover:scale-105"><Plus size={14} strokeWidth={3} /></button>
            </div>
            <div className="relative group">
                <Search className="absolute left-2.5 top-2 text-[#444] group-focus-within:text-[#f5a623] transition-colors" size={14} />
                <input type="text" placeholder="Search cast..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#151515] border border-[#222] rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-[#f5a623] transition-all" />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {characters.map(([name, data]) => (
            <div key={name} onClick={() => setSelectedCharId(name)} className={`group p-2 flex items-center gap-3 cursor-pointer rounded-lg border border-transparent transition-all ${selectedCharId === name ? 'bg-[#1a1a1a] border-[#333] shadow-md' : 'hover:bg-[#111] hover:border-[#222]'}`}>
              <div className={`w-10 h-10 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center border ${selectedCharId === name ? 'border-[#f5a623]' : 'border-[#333]'} bg-[#000] relative`}>
                {data.images.length > 0 ? (
                  <img src={data.images[0]} alt={name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <User size={18} className="text-[#333]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                  <div className={`truncate text-sm font-bold ${selectedCharId === name ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>{name}</div>
                  <div className="truncate text-[10px] font-mono text-[#555] uppercase">{data.archetype || 'Archetype'}</div>
              </div>
              {selectedCharId === name && (
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(name); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-[#444] hover:text-red-500 transition-opacity"><Trash2 size={12} /></button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* --- MAIN STAGE --- */}
      <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

        {selectedChar ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-12 relative z-10 flex flex-col">
            <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                
                {/* --- HEADER --- */}
                <div className="lg:col-span-12 flex flex-col gap-4 border-b border-[#222] pb-6 mb-2">
                    <div className="flex items-end justify-between">
                        <div className="w-full">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 bg-[#f5a623]/10 border border-[#f5a623]/20 text-[#f5a623] text-[9px] font-black uppercase tracking-wider rounded">{selectedChar.gender || 'UNKNOWN'}</span>
                                <span className="px-2 py-0.5 bg-[#222] border border-[#333] text-gray-400 text-[9px] font-black uppercase tracking-wider rounded">{selectedChar.age} YEARS</span>
                            </div>
                            <input className="text-5xl font-black bg-transparent border-none outline-none w-full text-white placeholder-gray-700 focus:ring-0 uppercase tracking-tighter" value={selectedChar.name} onChange={(e) => handleRename(selectedChar.name, e.target.value)} placeholder="NAME" />
                            <div className="flex items-center gap-2 mt-1 w-full max-w-md">
                                <span className="text-xs font-mono text-[#555] uppercase shrink-0">// ROLE:</span>
                                <VitalInput className="bg-transparent border-b border-transparent focus:border-[#f5a623] outline-none text-gray-400 text-sm font-mono uppercase tracking-wide w-full px-0 py-0" value={selectedChar.occupation} onChange={(val: string) => updateCharacter(selectedChar.name, { occupation: val })} options={CHARACTER_ROLES} placeholder="OCCUPATION / ROLE" naked={true} />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-1 border-b border-[#222]">
                        <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'profile' ? 'border-[#f5a623] text-[#f5a623]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Profile</button>
                        <button onClick={() => setActiveTab('backstory')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'backstory' ? 'border-[#f5a623] text-[#f5a623]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Backstory</button>
                        <button onClick={() => setActiveTab('network')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'network' ? 'border-[#f5a623] text-[#f5a623]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>Network</button>
                    </div>
                </div>

                {activeTab === 'profile' && (
                    <>
                        {/* --- LEFT COLUMN --- */}
                        <div className="lg:col-span-4 space-y-6 animate-in slide-in-from-left-2 duration-300">
                            <div className="group relative w-full aspect-square bg-[#0a0a0a] border border-[#222] rounded-lg overflow-hidden shadow-2xl">
                                {selectedChar.images.length > 0 ? (
                                    <img src={selectedChar.images[0]} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-[#222]">
                                        <Fingerprint size={64} strokeWidth={1} />
                                        <span className="text-[10px] font-mono mt-4 uppercase tracking-widest text-[#444]">No Subject Image</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3">
                                    <button onClick={() => generatePortrait(selectedChar)} disabled={isGenerating} className="px-6 py-2 bg-[#f5a623] hover:bg-[#e09612] text-black font-bold uppercase text-xs tracking-wider rounded-full flex items-center gap-2 transform hover:scale-105 transition-all disabled:opacity-50 disabled:grayscale">
                                        {isGenerating ? <Sparkles className="animate-spin" size={14}/> : <Camera size={14}/>} {isGenerating ? 'Rendering...' : 'Generate ID'}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-5">
                                <div className="flex items-center gap-2 mb-4 border-b border-[#222] pb-2">
                                    <Activity size={14} className="text-[#f5a623]" />
                                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Biometrics</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <VitalInput label="Age" value={selectedChar.age} onChange={(v: string) => updateCharacter(selectedChar.name, { age: parseInt(v) || 0 })} type="number" />
                                    <VitalInput label="Gender" value={selectedChar.gender} onChange={(v: string) => updateCharacter(selectedChar.name, { gender: v })} options={CHARACTER_GENDERS} />
                                    <VitalInput label="Hair" value={selectedChar.hair} onChange={(v: string) => updateCharacter(selectedChar.name, { hair: v })} options={CHARACTER_HAIR} />
                                    <VitalInput label="Eyes" value={selectedChar.eyes} onChange={(v: string) => updateCharacter(selectedChar.name, { eyes: v })} options={CHARACTER_EYES} />
                                    <div className="col-span-2">
                                        <VitalInput label="Build / Physique" value={selectedChar.build} onChange={(v: string) => updateCharacter(selectedChar.name, { build: v })} options={CHARACTER_BUILDS} />
                                    </div>
                                    <div className="col-span-2">
                                        <VitalInput label="Voice / Tone" value={selectedChar.archetype} onChange={(v: string) => updateCharacter(selectedChar.name, { archetype: v })} icon={Mic2} options={CHARACTER_ARCHETYPES} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- RIGHT COLUMN --- */}
                        <div className="lg:col-span-8 space-y-6 animate-in slide-in-from-right-2 duration-300">
                            <DossierSection title="Physiology" icon={Fingerprint} color="text-red-400" desc="Physical appearance, defects, heredity, health.">
                                <NotionLikeEditor value={selectedChar.physiology} onChange={(v: string) => updateCharacter(selectedChar.name, { physiology: v })} placeholder="Type here... Use markdown shortcuts (#, -, >)" />
                            </DossierSection>
                            <DossierSection title="Sociology" icon={Users} color="text-blue-400" desc="Class, occupation, education, home life, religion, politics.">
                                <NotionLikeEditor value={selectedChar.sociology} onChange={(v: string) => updateCharacter(selectedChar.name, { sociology: v })} placeholder="Type here..." />
                            </DossierSection>
                            <DossierSection title="Psychology" icon={Brain} color="text-purple-400" desc="Moral standards, ambitions, frustrations, temperament, complexes.">
                                <NotionLikeEditor value={selectedChar.psychology} onChange={(v: string) => updateCharacter(selectedChar.name, { psychology: v })} placeholder="Type here..." />
                            </DossierSection>
                        </div>
                    </>
                )}

                {activeTab === 'backstory' && (
                    <div className="lg:col-span-12 animate-in fade-in duration-300">
                        <DossierSection title="Character History" icon={FileText} color="text-[#f5a623]" desc="Comprehensive backstory, childhood, and key life events.">
                            <NotionLikeEditor value={selectedChar.backstory || ''} onChange={(v: string) => updateCharacter(selectedChar.name, { backstory: v })} placeholder="Once upon a time..." minHeight="400px" />
                        </DossierSection>
                    </div>
                )}

                {activeTab === 'network' && (
                    <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300 h-full">
                        <div className="lg:col-span-1 bg-[#0a0a0a] border border-[#222] rounded-lg p-5 flex flex-col">
                            <div className="flex items-center gap-2 mb-4 border-b border-[#222] pb-2">
                                <Link2 size={14} className="text-[#f5a623]" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Relationships</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto mb-4 space-y-2">
                                {(selectedChar.relationships || []).map((rel, idx) => (
                                    <div key={idx} className="bg-[#111] p-3 rounded border border-[#222] group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-white">{rel.target}</span>
                                            <button onClick={() => removeRelationship(rel.target)} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={12} /></button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={rel.type} onChange={(e) => updateRelationship(rel.target, 'type', e.target.value)} className="bg-[#0a0a0a] border border-[#333] text-[10px] text-gray-300 px-2 py-1 rounded outline-none focus:border-[#f5a623]">
                                                {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <input value={rel.description || ''} onChange={(e) => updateRelationship(rel.target, 'description', e.target.value)} placeholder="Details..." className="bg-[#0a0a0a] border border-[#333] text-[10px] text-gray-300 px-2 py-1 rounded outline-none focus:border-[#f5a623]" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-auto border-t border-[#222] pt-4">
                                <label className="text-[9px] font-mono text-[#555] uppercase mb-1 block">Add Connection</label>
                                <div className="flex gap-2">
                                    <select id="new-rel-target" className="flex-1 bg-[#151515] border border-[#333] text-xs text-gray-300 px-2 py-1.5 rounded outline-none focus:border-[#f5a623]">
                                        {characters.map(([name]) => name !== selectedChar.name && <option key={name} value={name}>{name}</option>)}
                                    </select>
                                    <button onClick={() => { const sel = document.getElementById('new-rel-target') as HTMLSelectElement; if (sel && sel.value) addRelationship(sel.value, 'Acquaintance'); }} className="px-3 bg-[#f5a623] hover:bg-[#e09612] text-black rounded text-xs font-bold">Add</button>
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-2 bg-[#000] border border-[#222] rounded-lg relative overflow-hidden flex items-center justify-center">
                            <div className="absolute top-4 left-4 flex items-center gap-2 z-10 pointer-events-none">
                                <Network size={14} className="text-[#f5a623]" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Neural Map</h3>
                            </div>
                            <NeuralMap characters={characterData} selectedId={selectedChar.name} onSelect={setSelectedCharId} />
                        </div>
                    </div>
                )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-[#333]">
             <Fingerprint size={64} strokeWidth={1} className="mb-4" />
             <span className="text-sm font-mono uppercase tracking-widest">Select Subject for Analysis</span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- SUB COMPONENTS ---

const NeuralMap = ({ characters, selectedId, onSelect }: { characters: Record<string, CharacterData>, selectedId: string, onSelect: (id: string) => void }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const nodes = useMemo(() => {
        const charArray = Object.values(characters);
        const count = charArray.length;
        const centerX = 400, centerY = 300, radius = 200;
        return charArray.map((char, i) => {
            const angle = (i / count) * 2 * Math.PI - (Math.PI / 2);
            return {
                id: char.name, x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle), data: char
            };
        });
    }, [characters]);

    const links = useMemo(() => {
        const linkList: any[] = [];
        nodes.forEach(node => {
            if (node.data.relationships) {
                node.data.relationships.forEach((rel: any) => {
                    const targetNode = nodes.find(n => n.id === rel.target);
                    if (targetNode) {
                        const existing = linkList.find(l => (l.source.id === node.id && l.target.id === targetNode.id) || (l.source.id === targetNode.id && l.target.id === node.id));
                        if (!existing) linkList.push({ source: node, target: targetNode, type: rel.type });
                    }
                });
            }
        });
        return linkList;
    }, [nodes]);

    const getLinkColor = (type: string) => {
        switch(type) {
            case 'Enemy': case 'Rival': return '#ef4444';
            case 'Friend': case 'Ally': return '#22c55e';
            case 'Family': case 'Sibling': return '#3b82f6';
            case 'Lover': case 'Spouse': return '#ec4899';
            default: return '#555';
        }
    };

    return (
        <svg ref={svgRef} viewBox="0 0 800 600" className="w-full h-full bg-[#050505] cursor-move">
            <defs>
                <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a1a" strokeWidth="1"/></pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
            {links.map((link, i) => (<line key={i} x1={link.source.x} y1={link.source.y} x2={link.target.x} y2={link.target.y} stroke={getLinkColor(link.type)} strokeWidth="1.5" strokeOpacity="0.6"/>))}
            {nodes.map(node => {
                const isSelected = node.id === selectedId;
                const hasImage = node.data.images && node.data.images.length > 0;
                return (
                    <g key={node.id} onClick={() => onSelect(node.id)} className="cursor-pointer transition-all duration-300">
                        {isSelected && <circle cx={node.x} cy={node.y} r="35" fill="none" stroke="#f5a623" strokeWidth="2" opacity="0.5" className="animate-pulse" />}
                        <circle cx={node.x} cy={node.y} r="28" fill="#111" stroke={isSelected ? "#f5a623" : "#333"} strokeWidth={isSelected ? 3 : 1} filter={isSelected ? "url(#glow)" : ""} />
                        {hasImage ? (
                            <>
                                <defs><pattern id={`img-${node.id}`} x="0" y="0" width="1" height="1"><image href={node.data.images[0]} x="0" y="0" width="56" height="56" preserveAspectRatio="xMidYMid slice" /></pattern></defs>
                                <circle cx={node.x} cy={node.y} r="26" fill={`url(#img-${node.id})`} />
                            </>
                        ) : (
                            <text x={node.x} y={node.y} dy="5" textAnchor="middle" fill="#ccc" fontSize="16" fontWeight="bold" pointerEvents="none">{node.id && node.id.length >= 2 ? node.id.substring(0,2) : "??"}</text>
                        )}
                        <text x={node.x} y={node.y + 45} textAnchor="middle" fill={isSelected ? "#fff" : "#666"} fontSize="10" fontWeight="bold" letterSpacing="1">{node.id || '??'}</text>
                    </g>
                );
            })}
        </svg>
    );
};

const VitalInput = ({ label, value, onChange, type = 'text', icon: Icon, options = [], className, naked, placeholder }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const showDropdown = isOpen && options.length > 0;
    const filteredOptions = options.filter((opt: string) => opt.toLowerCase().includes(String(value).toLowerCase()));
    return (
        <div className={`group relative ${naked ? '' : 'mb-0'}`} ref={containerRef}>
            {!naked && <label className="text-[9px] font-mono text-[#555] uppercase mb-1 block flex items-center gap-1.5">{Icon && <Icon size={10} />} {label}</label>}
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setIsOpen(true)} className={className || "w-full bg-[#111] border-b border-[#333] text-gray-300 text-sm font-medium py-1 px-0 outline-none focus:border-[#f5a623] transition-colors placeholder-gray-700"} placeholder={placeholder || "-"} autoComplete="off" />
            {showDropdown && filteredOptions.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-[#1a1a1a] border border-[#333] z-[100] max-h-40 overflow-y-auto shadow-xl rounded-b-md mt-1 custom-scrollbar">
                    {filteredOptions.map((opt: string) => (
                        <div key={opt} className="px-3 py-2 text-xs text-gray-400 hover:bg-[#333] hover:text-white cursor-pointer transition-colors border-b border-[#222] last:border-0 font-medium" onMouseDown={(e) => { e.preventDefault(); onChange(opt); setIsOpen(false); }}>{opt}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DossierSection = ({ title, icon: Icon, color, desc, children }: any) => (
    <div className="border border-[#222] bg-[#111] rounded-lg overflow-hidden group flex flex-col min-h-[200px]">
        <div className="px-5 py-3 border-b border-[#222] bg-[#151515] flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded bg-[#0a0a0a] border border-[#222] ${color}`}><Icon size={16} /></div>
                <div><h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">{title}</h3><p className="text-[10px] text-[#555] font-mono leading-none mt-0.5">{desc}</p></div>
            </div>
            <MoreHorizontal size={14} className="text-[#333]" />
        </div>
        <div className="flex-1 flex flex-col">
            {children}
        </div>
    </div>
);

export default CharacterView;
