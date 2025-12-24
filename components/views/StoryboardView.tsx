
import React, { useState, useEffect, useRef, memo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { generateShotList, generateImage } from '../../services/gemini';
import { 
    Wand2, Image as ImageIcon, Film, Loader2, Download, 
    Plus, Trash2, RefreshCw, Play, Pause, Clock, 
    Grid3X3, LayoutGrid, Maximize, Columns, List, Table2,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight, UserCheck
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { Shot, CharacterData } from '../../types';
import { SHOT_SIZES, SHOT_ANGLES } from '../../constants';

// --- MEMOIZED SHOT CARD (GRID VIEW) ---
const StoryCard = memo(({ 
    shot, 
    index, 
    total,
    onUpdate, 
    onAddNext, 
    onDelete, 
    onMove,
    onRender, 
    onDownload, 
    isRendering 
}: { 
    shot: Shot, 
    index: number, 
    total: number,
    onUpdate: (id: string, updates: Partial<Shot>) => void,
    onAddNext: (index: number) => void,
    onDelete: (id: string) => void,
    onMove: (from: number, to: number) => void,
    onRender: (index: number) => void,
    onDownload: (index: number) => void,
    isRendering: boolean
}) => {
    return (
        <div id={`story-card-${index}`} className="bg-[#252525] border border-[#333] rounded-lg overflow-hidden flex flex-col shadow-lg group hover:border-[#444] transition-colors relative">
            
            {/* Header / Toolbar */}
            <div className="bg-[#222] px-2 py-1 flex justify-between items-center border-b border-[#333]">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-[#666] uppercase">Shot {index + 1}</span>
                    
                    {/* Reorder Buttons */}
                    <div className="flex bg-[#1a1a1a] rounded ml-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <button disabled={index === 0} onClick={() => onMove(index, index - 1)} className="p-0.5 hover:text-white disabled:opacity-30"><ArrowLeft size={10} /></button>
                        <button disabled={index === total - 1} onClick={() => onMove(index, index + 1)} className="p-0.5 hover:text-white disabled:opacity-30"><ArrowRight size={10} /></button>
                    </div>
                </div>

                <div className="flex gap-1">
                     <button onClick={() => onAddNext(index)} className="p-1 hover:bg-[#333] text-gray-400 hover:text-green-500 rounded" title="Insert Shot After"><Plus size={12} /></button>
                     <button onClick={() => onDelete(shot.id)} className="p-1 hover:bg-[#333] text-gray-400 hover:text-red-500 rounded" title="Delete Shot"><Trash2 size={12} /></button>
                </div>
            </div>
            
            {/* Visual Area */}
            <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden border-b border-[#333] group-inner">
                {shot.imageUrl ? (
                  <img src={shot.imageUrl} alt="Shot" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-[#333] flex flex-col items-center gap-2">
                     <Film size={32} />
                  </div>
                )}
                
                {/* Overlay Loader */}
                {isRendering && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-accent z-10">
                        <Loader2 className="animate-spin mb-2" size={24} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Rendering...</span>
                    </div>
                )}
            </div>

            {/* Editable Content */}
            <div className="p-3 flex-1 flex flex-col gap-2">
                {/* Scene Ref */}
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[#555] uppercase shrink-0">SCENE</span>
                    <input 
                        className="bg-transparent text-[10px] font-bold text-[#888] w-full outline-none border-b border-transparent focus:border-[#f5a623] transition-colors"
                        value={shot.scene || ''}
                        onChange={(e) => onUpdate(shot.id, { scene: e.target.value })}
                        placeholder="?"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[9px] font-bold text-[#555] uppercase block mb-1">Size</label>
                        <select 
                            className="w-full bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none"
                            value={shot.shotSize}
                            onChange={(e) => onUpdate(shot.id, { shotSize: e.target.value })}
                        >
                            {/* Standard Options */}
                            {SHOT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                            
                            {/* Handle Custom/AI generated values not in list */}
                            {!SHOT_SIZES.includes(shot.shotSize) && shot.shotSize && (
                                <option value={shot.shotSize}>{shot.shotSize} (Custom)</option>
                            )}
                        </select>
                    </div>
                    <div>
                         <label className="text-[9px] font-bold text-[#555] uppercase block mb-1">Angle</label>
                         <select 
                            className="w-full bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none"
                            value={shot.angle}
                            onChange={(e) => onUpdate(shot.id, { angle: e.target.value })}
                        >
                            {SHOT_ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                            {!SHOT_ANGLES.includes(shot.angle) && shot.angle && (
                                <option value={shot.angle}>{shot.angle} (Custom)</option>
                            )}
                        </select>
                    </div>
                </div>

                <div>
                     <label className="text-[9px] font-bold text-[#555] uppercase block mb-1">Subject</label>
                     <input 
                        className="w-full bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none"
                        value={shot.subject}
                        onChange={(e) => onUpdate(shot.id, { subject: e.target.value })}
                    />
                </div>

                <div className="flex-1">
                    <label className="text-[9px] font-bold text-[#555] uppercase block mb-1">Visual Action</label>
                    <textarea 
                        className="w-full h-16 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[10px] text-gray-300 focus:border-[#f5a623] outline-none resize-none leading-relaxed"
                        value={shot.description}
                        onChange={(e) => onUpdate(shot.id, { description: e.target.value })}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="p-2 border-t border-[#333] bg-[#222] flex gap-2">
                <button 
                  onClick={() => onRender(index)}
                  disabled={isRendering}
                  className="flex-1 bg-[#333] border border-[#444] text-[#ccc] py-1.5 rounded text-[10px] font-bold uppercase hover:bg-[#444] hover:text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                   <ImageIcon size={12} /> {shot.imageUrl ? 'Re-Draw' : 'Draw'}
                </button>
                <button 
                  onClick={() => onDownload(index)}
                  className="w-8 bg-[#1a3c28] border border-[#2e7d32] text-[#81c784] rounded flex items-center justify-center hover:bg-[#2e7d32] hover:text-white transition-colors"
                  title="Save Image"
                >
                   <Download size={12} />
                </button>
            </div>
        </div>
    );
}, (prev, next) => {
    return prev.shot === next.shot && prev.index === next.index && prev.isRendering === next.isRendering && prev.total === next.total;
});

// --- MEMOIZED SHOT ROW (TABLE VIEW) ---
const ShotRow = memo(({ 
    shot, 
    index, 
    total,
    onUpdate, 
    onAddNext, 
    onDelete, 
    onMove,
    onRender, 
    isRendering 
}: { 
    shot: Shot, 
    index: number, 
    total: number,
    onUpdate: (id: string, updates: Partial<Shot>) => void,
    onAddNext: (index: number) => void,
    onDelete: (id: string) => void,
    onMove: (from: number, to: number) => void,
    onRender: (index: number) => void,
    isRendering: boolean
}) => {
    return (
        <tr className="border-b border-[#2a2a2a] hover:bg-[#222] transition-colors group">
            {/* Index & Reorder */}
            <td className="p-2 text-center text-xs text-gray-500 font-mono w-14 border-r border-[#2a2a2a]">
                <div className="flex flex-col items-center gap-1">
                    <span>{index + 1}</span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button disabled={index === 0} onClick={() => onMove(index, index - 1)} className="hover:text-[#f5a623] disabled:opacity-30"><ArrowUp size={10} /></button>
                        <button disabled={index === total - 1} onClick={() => onMove(index, index + 1)} className="hover:text-[#f5a623] disabled:opacity-30"><ArrowDown size={10} /></button>
                    </div>
                </div>
            </td>
            
            {/* Visual Action / Thumbnail */}
            <td className="p-2 w-32 border-r border-[#2a2a2a]">
                 <div className="w-28 h-16 bg-black rounded border border-[#333] overflow-hidden relative flex items-center justify-center cursor-pointer hover:border-[#f5a623] group/thumb" onClick={() => onRender(index)}>
                     {shot.imageUrl ? (
                         <img src={shot.imageUrl} className="w-full h-full object-cover" />
                     ) : (
                         <Film size={16} className="text-[#333]" />
                     )}
                     
                     {/* Overlay for generation status/action */}
                     {isRendering ? (
                         <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                             <Loader2 size={16} className="animate-spin text-[#f5a623]" />
                         </div>
                     ) : (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                            <Wand2 size={16} className="text-white" />
                        </div>
                     )}
                 </div>
            </td>

            <td className="p-2 w-20 border-r border-[#2a2a2a]">
                 <input 
                    className="w-full bg-transparent text-xs text-center border-b border-transparent focus:border-[#f5a623] outline-none text-gray-300 placeholder-gray-600"
                    value={shot.scene || ''}
                    onChange={(e) => onUpdate(shot.id, { scene: e.target.value })}
                    placeholder="SC#"
                 />
            </td>
            
            <td className="p-2 w-40 border-r border-[#2a2a2a]">
                <select 
                    className="w-full bg-transparent text-xs text-gray-300 outline-none border border-transparent hover:border-[#333] focus:border-[#f5a623] rounded py-1"
                    value={shot.shotSize}
                    onChange={(e) => onUpdate(shot.id, { shotSize: e.target.value })}
                >
                    {SHOT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                     {!SHOT_SIZES.includes(shot.shotSize) && shot.shotSize && (
                        <option value={shot.shotSize}>{shot.shotSize}</option>
                    )}
                </select>
            </td>
            
            <td className="p-2 w-40 border-r border-[#2a2a2a]">
                <select 
                    className="w-full bg-transparent text-xs text-gray-300 outline-none border border-transparent hover:border-[#333] focus:border-[#f5a623] rounded py-1"
                    value={shot.angle}
                    onChange={(e) => onUpdate(shot.id, { angle: e.target.value })}
                >
                    {SHOT_ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                    {!SHOT_ANGLES.includes(shot.angle) && shot.angle && (
                        <option value={shot.angle}>{shot.angle}</option>
                    )}
                </select>
            </td>
            
            <td className="p-2 w-48 border-r border-[#2a2a2a]">
                 <input 
                    className="w-full bg-transparent text-xs text-gray-300 outline-none border-b border-transparent focus:border-[#f5a623] py-1"
                    value={shot.subject}
                    onChange={(e) => onUpdate(shot.id, { subject: e.target.value })}
                    placeholder="Subject..."
                 />
            </td>
            
            <td className="p-2 border-r border-[#2a2a2a]">
                 <textarea 
                    className="w-full bg-transparent text-xs text-gray-300 resize-none outline-none focus:bg-[#222] rounded p-1 h-14 leading-relaxed"
                    value={shot.description}
                    onChange={(e) => onUpdate(shot.id, { description: e.target.value })}
                    placeholder="Describe the action..."
                 />
            </td>
            
            <td className="p-2 text-center w-20">
                 <div className="flex items-center justify-center gap-1">
                     <button onClick={() => onAddNext(index)} className="p-1.5 text-gray-500 hover:text-green-500 hover:bg-[#333] rounded transition-colors" title="Insert Below">
                         <Plus size={14} />
                     </button>
                     <button onClick={() => onDelete(shot.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-[#333] rounded transition-colors" title="Delete">
                         <Trash2 size={14} />
                     </button>
                 </div>
            </td>
        </tr>
    );
});


const StoryboardView: React.FC = () => {
  const { 
      beats, generatedShots, setGeneratedShots, updateGeneratedShot, 
      addGeneratedShot, removeGeneratedShot, moveGeneratedShot, storyboardConfig,
      characterData // Import Character Data for Continuity
  } = useProject();
  
  // Range Analysis State
  const [startScene, setStartScene] = useState(1);
  const [endScene, setEndScene] = useState(beats.length || 1);
  const [analyzing, setAnalyzing] = useState(false);

  // Render Queue State
  const [delay, setDelay] = useState(5); // Seconds
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const [currentlyRenderingId, setCurrentlyRenderingId] = useState<string | null>(null);
  
  // View Customization - DEFAULTED TO TABLE
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [gridSize, setGridSize] = useState<'sm' | 'md' | 'lg'>('md');
  
  // Ref for cancellation
  const cancelQueueRef = useRef(false);

  // Helper: Get Script Text
  const getScriptSegment = () => {
    const sorted = [...beats].sort((a, b) => a.x - b.x);
    // Be robust about scene numbers
    const validStart = Math.max(1, Math.min(startScene, sorted.length));
    const validEnd = Math.min(sorted.length, Math.max(validStart, endScene));
    
    return sorted.slice(validStart - 1, validEnd)
      .map((b, i) => `SCENE ${validStart + i}: ${b.slug.prefix} ${b.slug.location} - ${b.slug.time}\n${b.content.replace(/<[^>]+>/g, '')}`)
      .join('\n\n');
  };

  // --- 1. ANALYSIS (TEXT -> SHOTS) ---
  const handlePlanShots = async () => {
    setAnalyzing(true);
    try {
      const text = getScriptSegment();
      if (!text.trim()) { alert("No scenes found in that range."); return; }
      
      const shots = await generateShotList(text, storyboardConfig.textModel || 'gemini-3-flash-preview');
      // Map to internal format with unique IDs
      const mappedShots: Shot[] = shots.map((s, i) => ({
          id: `${Date.now()}-${i}`,
          shotSize: s.shotSize || 'WIDE',
          angle: s.angle || 'EYE LEVEL',
          description: s.description || '',
          subject: s.subject || '',
          scene: s.scene || '?',
          imageUrl: null
      }));
      
      setGeneratedShots(mappedShots);
    } catch (e) {
      console.error(e);
      alert("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  // --- PROMPT BUILDER WITH CONTINUITY INJECTION ---
  const buildEnhancedPrompt = (shot: Shot) => {
      let prompt = `Cinematic storyboard frame, style: ${storyboardConfig.style || "Charcoal Sketch"}. \n`;
      prompt += `Shot Type: ${shot.shotSize || 'WIDE'}. Angle: ${shot.angle || 'EYE LEVEL'}. \n`;
      prompt += `Action: ${shot.description || 'No action'}. \n`;
      prompt += `Subject: ${shot.subject || 'Scene'}. \n`;
      prompt += `High contrast, dramatic lighting.`;

      // --- CHARACTER CONTINUITY LOGIC ---
      const subj = shot.subject || '';
      const desc = shot.description || '';
      const combinedText = (subj + ' ' + desc).toLowerCase();
      const matchedChars: string[] = [];

      if (characterData) {
          Object.values(characterData).forEach((char: CharacterData) => {
              if (char && char.name && combinedText.includes(char.name.toLowerCase())) {
                  // Found a character mentioned in this shot!
                  // Build visual profile
                  let visualProfile = `\n[CHARACTER REFERENCE: ${char.name}]`;
                  visualProfile += `\n- Age/Gender: ${char.age} ${char.gender}`;
                  if(char.hair) visualProfile += `\n- Hair: ${char.hair}`;
                  if(char.eyes) visualProfile += `\n- Eyes: ${char.eyes}`;
                  if(char.build) visualProfile += `\n- Build: ${char.build}`;
                  if(char.archetype) visualProfile += `\n- Vibe: ${char.archetype}`;
                  if(char.occupation) visualProfile += `\n- Role: ${char.occupation}`;
                  // Include physiology for specific markers like "Scar", "Glasses", "Tattoos"
                  if(char.physiology) visualProfile += `\n- Visual Notes: ${char.physiology}`;
                  
                  matchedChars.push(visualProfile);
              }
          });
      }

      if (matchedChars.length > 0) {
          prompt += "\n\n*** CHARACTER CONSISTENCY ENFORCED ***";
          prompt += matchedChars.join('\n');
      }

      return prompt;
  };

  // --- 2. SINGLE RENDER ---
  const renderSingleShot = async (index: number) => {
    const shot = generatedShots[index];
    if (!shot) return;
    
    setCurrentlyRenderingId(shot.id);
    try {
      const prompt = buildEnhancedPrompt(shot);
      
      const url = await generateImage(
          prompt, 
          storyboardConfig.aspectRatio || '16:9',
          storyboardConfig.imageModel || 'gemini-2.5-flash-image'
      );
      if (url) {
        updateGeneratedShot(shot.id, { imageUrl: url });
      }
    } catch (e) {
      console.error("Single render failed", e);
    } finally {
      setCurrentlyRenderingId(null);
    }
  };

  // --- 3. QUEUE RENDER (RENDER ALL) ---
  const handleRenderAll = async () => {
    if (generatedShots.length === 0) return;
    
    setIsQueueRunning(true);
    cancelQueueRef.current = false;
    setQueueProgress({ current: 0, total: generatedShots.length });

    // Loop through all shots
    for (let i = 0; i < generatedShots.length; i++) {
        if (cancelQueueRef.current) break;

        const shot = generatedShots[i];
        setQueueProgress({ current: i + 1, total: generatedShots.length });
        setCurrentlyRenderingId(shot.id);

        try {
             const prompt = buildEnhancedPrompt(shot);
             
             const url = await generateImage(
                 prompt, 
                 storyboardConfig.aspectRatio || '16:9',
                 storyboardConfig.imageModel || 'gemini-2.5-flash-image'
             );
             if (url) {
                 updateGeneratedShot(shot.id, { imageUrl: url });
             }
        } catch (e) {
            console.error(`Failed to render shot ${i + 1}`, e);
            // Continue to next despite error
        }

        // DELAY (Throttle)
        if (i < generatedShots.length - 1 && !cancelQueueRef.current) {
             setCurrentlyRenderingId(null); // Clear loading state during wait
             await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
    }

    setCurrentlyRenderingId(null);
    setIsQueueRunning(false);
  };

  const handleStopQueue = () => {
      cancelQueueRef.current = true;
      setIsQueueRunning(false);
      setCurrentlyRenderingId(null);
  };

  const downloadCard = async (index: number) => {
    const el = document.getElementById(`story-card-${index}`);
    if(el) {
      try {
          const canvas = await html2canvas(el, { backgroundColor: '#252525', scale: 2 });
          const link = document.createElement('a');
          link.download = `shot_${index+1}.png`;
          link.href = canvas.toDataURL();
          link.click();
      } catch (e) {
          console.error("Download failed", e);
      }
    }
  };

  const getGridClass = () => {
      switch(gridSize) {
          case 'sm': return 'grid-cols-[repeat(auto-fill,minmax(250px,1fr))]';
          case 'lg': return 'grid-cols-[repeat(auto-fill,minmax(450px,1fr))]';
          default: return 'grid-cols-[repeat(auto-fill,minmax(320px,1fr))]';
      }
  };

  return (
    <div className="w-full h-full bg-[#181818] flex flex-col overflow-hidden">
      
      {/* --- TOP CONTROL BAR (Revised Design) --- */}
      <div className="bg-[#111] h-14 border-b border-[#222] px-4 flex items-center justify-between shrink-0 shadow-sm z-20 gap-4">
        
        {/* Left: Planning Section */}
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#000] border border-[#333] rounded-md px-2 py-1">
               <span className="text-[10px] font-bold text-[#666] uppercase mr-1">SCENE</span>
               <input 
                 type="number" 
                 className="w-8 bg-transparent text-center text-xs font-bold text-white outline-none focus:text-[#f5a623]" 
                 value={startScene} 
                 onChange={e => setStartScene(parseInt(e.target.value))} 
                 min={1} 
               />
               <span className="text-gray-600 font-bold text-xs">-</span>
               <input 
                 type="number" 
                 className="w-8 bg-transparent text-center text-xs font-bold text-white outline-none focus:text-[#f5a623]" 
                 value={endScene} 
                 onChange={e => setEndScene(parseInt(e.target.value))} 
                 min={1} 
               />
            </div>

            <button 
              onClick={handlePlanShots}
              disabled={analyzing || isQueueRunning}
              className="flex items-center gap-2 bg-[#222] hover:bg-[#f5a623] hover:text-black border border-[#333] text-gray-300 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {analyzing ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} className="text-[#f5a623] group-hover:text-black" />} 
              Analyze
            </button>
            
            <button
                onClick={() => addGeneratedShot(generatedShots.length)}
                disabled={isQueueRunning}
                className="flex items-center gap-2 bg-[#222] hover:bg-[#333] border border-[#333] text-gray-300 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all disabled:opacity-50"
            >
                <Plus size={14} /> Add Shot
            </button>
        </div>

        {/* Center: View Options (Grid vs Table) */}
        <div className="flex items-center gap-4">
            <div className="flex bg-[#000] rounded-md p-1 border border-[#333] gap-1">
               <button 
                   onClick={() => setViewMode('table')} 
                   className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${viewMode === 'table' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}
                   title="List View"
               ><List size={14} /></button>
               <button 
                   onClick={() => setViewMode('grid')} 
                   className={`p-1.5 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${viewMode === 'grid' ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}
                   title="Grid View"
               ><LayoutGrid size={14} /></button>
            </div>

            {viewMode === 'grid' && (
                <div className="flex bg-[#000] rounded-md p-1 border border-[#333] gap-1 animate-in fade-in">
                    <button onClick={() => setGridSize('sm')} className={`p-1.5 rounded hover:bg-[#333] ${gridSize === 'sm' ? 'bg-[#333] text-white' : 'text-gray-500'}`}><Grid3X3 size={14} /></button>
                    <button onClick={() => setGridSize('md')} className={`p-1.5 rounded hover:bg-[#333] ${gridSize === 'md' ? 'bg-[#333] text-white' : 'text-gray-500'}`}><LayoutGrid size={14} /></button>
                    <button onClick={() => setGridSize('lg')} className={`p-1.5 rounded hover:bg-[#333] ${gridSize === 'lg' ? 'bg-[#333] text-white' : 'text-gray-500'}`}><Maximize size={14} /></button>
                </div>
            )}
        </div>

        {/* Right: Rendering Engine */}
        <div className="flex items-center gap-3 justify-end">
             <div className="flex items-center gap-2 bg-[#000] px-2 py-1 rounded-md border border-[#333]">
                 <Clock size={12} className="text-[#666]" />
                 <select 
                    value={delay} 
                    onChange={(e) => setDelay(parseInt(e.target.value))}
                    disabled={isQueueRunning}
                    className="bg-transparent text-white text-[10px] font-bold outline-none focus:text-[#f5a623] cursor-pointer"
                 >
                     <option value={2}>2s DELAY</option>
                     <option value={5}>5s DELAY</option>
                     <option value={10}>10s DELAY</option>
                     <option value={20}>20s DELAY</option>
                 </select>
             </div>

             {!isQueueRunning ? (
                 <button 
                    onClick={handleRenderAll}
                    disabled={generatedShots.length === 0}
                    className="h-8 flex items-center gap-2 bg-[#f5a623] hover:bg-[#e09612] text-black px-4 rounded-md text-[10px] font-black uppercase tracking-wide transition-all disabled:opacity-50 disabled:grayscale"
                 >
                    <Play size={12} fill="black" /> Render All
                 </button>
             ) : (
                 <button 
                    onClick={handleStopQueue}
                    className="h-8 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 rounded-md text-[10px] font-black uppercase tracking-wide transition-all shadow-lg animate-pulse"
                 >
                    <Pause size={12} fill="white" /> Stop
                 </button>
             )}
        </div>
      </div>
      
      {/* --- PROGRESS BAR --- */}
      {isQueueRunning && (
          <div className="bg-[#111] border-b border-[#333] px-4 py-2 flex items-center gap-4 shrink-0">
             <div className="text-[10px] font-bold text-[#f5a623] uppercase animate-pulse shrink-0">
                Processing Queue... {queueProgress.current} / {queueProgress.total}
             </div>
             <div className="flex-1 h-2 bg-[#333] rounded-full overflow-hidden">
                <div 
                    className="h-full bg-[#f5a623] transition-all duration-300 ease-out"
                    style={{ width: `${(queueProgress.current / queueProgress.total) * 100}%` }}
                />
             </div>
             <div className="text-[10px] text-gray-500 font-mono shrink-0">
                Next request in {delay}s
             </div>
          </div>
      )}

      {/* --- CONTENT AREA --- */}
      <div className="flex-1 overflow-y-auto bg-[#181818] custom-scrollbar">
        {generatedShots.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-[#333] m-10">
              <Film size={64} className="mb-6 opacity-30" />
              <h3 className="text-xl font-bold text-gray-500 mb-2">Storyboard Empty</h3>
              <p className="text-sm text-gray-600 max-w-md text-center">
                 Select a scene range above and click "Analyze" to generate shots using AI, or click "Add Shot" to start manually.
                 <br/><br/>
                 <span className="text-[#f5a623]">Tip:</span> Configure Visual Style & Aspect Ratio in <b>Backstage &gt; Storyboard Config</b>.
              </p>
           </div>
        ) : (
           <>
              {/* GRID MODE */}
              {viewMode === 'grid' && (
                 <div className={`grid gap-6 p-6 pb-20 ${getGridClass()}`}>
                    {generatedShots.map((shot, i) => (
                       <StoryCard
                          key={shot.id}
                          index={i}
                          total={generatedShots.length}
                          shot={shot}
                          onUpdate={updateGeneratedShot}
                          onAddNext={addGeneratedShot}
                          onDelete={removeGeneratedShot}
                          onMove={moveGeneratedShot}
                          onRender={renderSingleShot}
                          onDownload={downloadCard}
                          isRendering={currentlyRenderingId === shot.id}
                       />
                    ))}
                 </div>
              )}

              {/* TABLE MODE */}
              {viewMode === 'table' && (
                 <div className="min-w-[1000px] p-0 pb-20">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#1a1a1a] text-[10px] font-bold text-gray-500 uppercase tracking-widest sticky top-0 z-10 shadow-lg border-b border-[#333]">
                            <tr>
                                <th className="p-3 border-r border-[#222] w-14 text-center">#</th>
                                <th className="p-3 border-r border-[#222] w-36 text-center">Visual</th>
                                <th className="p-3 border-r border-[#222] w-24 text-center">Scene</th>
                                <th className="p-3 border-r border-[#222] w-40">Shot Size</th>
                                <th className="p-3 border-r border-[#222] w-40">Angle</th>
                                <th className="p-3 border-r border-[#222] w-48">Subject</th>
                                <th className="p-3 border-r border-[#222]">Description</th>
                                <th className="p-3 w-20 text-center">Tools</th>
                            </tr>
                        </thead>
                        <tbody className="bg-[#111]">
                            {generatedShots.map((shot, i) => (
                                <ShotRow
                                    key={shot.id}
                                    index={i}
                                    total={generatedShots.length}
                                    shot={shot}
                                    onUpdate={updateGeneratedShot}
                                    onDelete={removeGeneratedShot}
                                    onAddNext={addGeneratedShot}
                                    onMove={moveGeneratedShot}
                                    onRender={renderSingleShot}
                                    isRendering={currentlyRenderingId === shot.id}
                                />
                            ))}
                        </tbody>
                    </table>
                 </div>
              )}
           </>
        )}
      </div>
    </div>
  );
};

export default StoryboardView;
