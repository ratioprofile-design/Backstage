import React, { useEffect, useRef, useState } from 'react';
import { Beat, BeatVersion } from '../types';
import { useProject } from '../context/ProjectContext';
import { Check, Clock, ChevronDown, History, RefreshCcw } from 'lucide-react';

interface BeatCardProps {
  beat: Beat;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, id: number) => void;
  onDoubleClick: (id: number) => void;
  onViewInScript?: (id: number) => void;
  onLinkStart: (e: React.MouseEvent, id: number) => void;
  sceneNumber: number | null;
  isError?: boolean;
  creationStep?: 'name' | 'summary' | null;
  onCreationStepChange?: (nextStep: 'name' | 'summary' | null) => void;
}

const BeatCard: React.FC<BeatCardProps> = ({ 
  beat, isSelected, onMouseDown, onDoubleClick, onLinkStart, sceneNumber, isError,
  creationStep, onCreationStepChange
}) => {
  const { updateBeat } = useProject();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const summaryInputRef = useRef<HTMLTextAreaElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<'status' | 'version' | null>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  // Local state to prevent immediate global updates
  const [localTitle, setLocalTitle] = useState(beat.title);
  const [localSummary, setLocalSummary] = useState(beat.summary || '');

  // Sync local state when the beat prop changes (e.g. from external undo/redo)
  useEffect(() => {
    setLocalTitle(beat.title);
  }, [beat.title]);

  useEffect(() => {
    setLocalSummary(beat.summary || '');
  }, [beat.summary]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
            setActiveDropdown(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus logic for creation steps
  useEffect(() => {
    if (creationStep === 'name' && nameInputRef.current) {
        nameInputRef.current.focus();
    } else if (creationStep === 'summary' && summaryInputRef.current) {
        summaryInputRef.current.focus();
    }
  }, [creationStep]);

  const commitTitle = () => {
    if (localTitle !== beat.title) {
        updateBeat(beat.id, { title: localTitle });
    }
  };

  const commitSummary = () => {
    if (localSummary !== (beat.summary || '')) {
        updateBeat(beat.id, { summary: localSummary });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTitle();
      if (onCreationStepChange) onCreationStepChange('summary');
    }
  };

  const handleSummaryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitSummary();
      if (onCreationStepChange) onCreationStepChange(null);
    }
  };

  const handleNameBlur = () => {
    commitTitle();
    if (onCreationStepChange && creationStep === 'name') {
        onCreationStepChange('summary');
    }
  };

  const handleSummaryBlur = () => {
    commitSummary();
    if (onCreationStepChange && creationStep === 'summary') {
        onCreationStepChange(null);
    }
  };

  const restoreVersion = (v: BeatVersion) => {
     if (!confirm(`Restore version from ${new Date(v.timestamp).toLocaleTimeString()}? Current unsaved changes will be lost.`)) return;
     
     updateBeat(beat.id, {
         title: v.title,
         summary: v.summary,
         content: v.content
     });
     setActiveDropdown(null);
  };

  const isReady = beat.status === 'ready';

  return (
    <div
      className={`absolute w-[240px] min-h-[160px] bg-[#2d2d2d] border rounded-md flex flex-col select-none cursor-default z-10 transition-all duration-300
      ${isSelected ? 'border-[#f5a623] shadow-[0_0_0_1px_#f5a623,0_8px_20px_rgba(0,0,0,0.5)] z-20' : 'border-[#3d3d3d] shadow-lg'}
      ${creationStep ? 'shadow-[0_0_20px_rgba(245,166,35,0.3)] border-[#f5a623]' : ''}
      `}
      style={{ left: beat.x, top: beat.y, backgroundColor: beat.tint || '#2d2d2d' }}
      onMouseDown={(e) => onMouseDown(e, beat.id)}
      onDoubleClick={() => onDoubleClick(beat.id)}
    >
      <div 
        className="h-3 rounded-t flex items-center justify-between px-1.5 cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: beat.color || '#444' }}
      >
        {sceneNumber !== null && (
          <span 
            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full -mt-2 -mr-1 shadow-sm border border-white/20 text-white ${isError ? 'bg-red-500' : 'bg-black/50'}`}
          >
            {sceneNumber}
          </span>
        )}
      </div>

      <div className="p-2.5 flex-grow flex flex-col">
        {/* BEAT NAME (Title) */}
        {creationStep === 'name' ? (
          <input
            ref={nameInputRef}
            className="font-bold text-sm mb-2 px-1 rounded bg-[#111] text-white border border-[#f5a623] outline-none w-full animate-pulse"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={handleNameBlur}
            placeholder="Name your beat..."
            onMouseDown={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <div className="font-bold text-sm mb-2 px-1 rounded min-h-[1.25em]">
            {beat.title || <span className="text-gray-500 italic">Untitled Beat</span>}
          </div>
        )}

        <div className={`font-screenplay text-[11px] font-bold uppercase mb-1 pb-1 border-b border-[#444] ${(!beat.slug.prefix && !beat.slug.location) ? 'text-white/20' : 'text-[#ccc]'}`}>
          {(!beat.slug.prefix && !beat.slug.location && !beat.slug.time) ? 'INT. LOCATION - DAY' : `${beat.slug.prefix} ${beat.slug.location} - ${beat.slug.time}`}
        </div>
        
        {/* SUMMARY */}
        {creationStep === 'summary' ? (
           <textarea 
             ref={summaryInputRef}
             className="font-sans text-[11px] text-white bg-[#111] border border-[#f5a623] outline-none w-full resize-none p-1 rounded leading-relaxed h-20 animate-pulse"
             value={localSummary}
             onChange={(e) => setLocalSummary(e.target.value)}
             onKeyDown={handleSummaryKeyDown}
             onBlur={handleSummaryBlur}
             placeholder="Write a short summary..."
             onMouseDown={(e) => e.stopPropagation()}
             autoFocus
           />
        ) : (
           <div className="font-sans text-[11px] text-[#aaa] leading-relaxed pointer-events-none line-clamp-3 mb-2">
              {beat.summary || <span className="opacity-30 italic">No summary...</span>}
           </div>
        )}
      </div>

      {/* FOOTER: Dropdowns */}
      <div 
        ref={footerRef}
        className="mt-auto border-t border-[#3d3d3d] bg-[#222] p-1.5 flex justify-between items-center rounded-b relative"
        onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking footer
      >
          {/* Status Dropdown (Left) */}
          <div className="relative">
              <button 
                onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-1 rounded transition-colors ${isReady ? 'text-green-400 bg-green-900/20 hover:bg-green-900/30' : 'text-orange-400 bg-orange-900/20 hover:bg-orange-900/30'}`}
              >
                 {isReady ? <Check size={10} /> : <Clock size={10} />}
                 {isReady ? 'Ready' : 'Not Ready'}
              </button>

              {activeDropdown === 'status' && (
                  <div className="absolute bottom-full left-0 mb-1 w-32 bg-[#1a1a1a] border border-[#333] rounded shadow-xl overflow-hidden z-30 flex flex-col">
                      <button 
                        onClick={() => { updateBeat(beat.id, { status: 'not-ready' }); setActiveDropdown(null); }}
                        className="px-3 py-2 text-[10px] font-bold text-gray-400 hover:text-orange-400 hover:bg-[#252525] text-left flex items-center gap-2"
                      >
                         <Clock size={10} /> Not Ready
                      </button>
                      <button 
                        onClick={() => { updateBeat(beat.id, { status: 'ready' }); setActiveDropdown(null); }}
                        className="px-3 py-2 text-[10px] font-bold text-gray-400 hover:text-green-400 hover:bg-[#252525] text-left flex items-center gap-2"
                      >
                         <Check size={10} /> Ready
                      </button>
                  </div>
              )}
          </div>

          {/* Version History Dropdown (Right) */}
          <div className="relative">
              <button 
                onClick={() => setActiveDropdown(activeDropdown === 'version' ? null : 'version')}
                className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-white transition-colors px-1"
                title="Version History"
              >
                 <History size={10} />
                 <span>v{beat.versions?.length || 0}</span>
                 <ChevronDown size={8} />
              </button>
              
              {activeDropdown === 'version' && (
                  <div className="absolute bottom-full right-0 mb-1 w-48 bg-[#1a1a1a] border border-[#333] rounded shadow-xl overflow-hidden z-30 flex flex-col max-h-40 overflow-y-auto custom-scrollbar">
                      <div className="px-3 py-1.5 text-[9px] font-black text-[#555] uppercase tracking-wider bg-[#111] border-b border-[#222]">
                          History
                      </div>
                      
                      {/* Current State (Just a label) */}
                      <div className="px-3 py-2 text-[10px] text-white border-b border-[#222] bg-[#222]">
                          <span className="font-bold text-green-400">Current</span>
                          <span className="block text-[9px] text-gray-500">Now</span>
                      </div>

                      {beat.versions && beat.versions.length > 0 ? (
                          [...beat.versions].reverse().map((v, i) => (
                              <button
                                key={v.id}
                                onClick={() => restoreVersion(v)}
                                className="px-3 py-2 text-left hover:bg-[#252525] group border-b border-[#222] last:border-0"
                              >
                                  <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-gray-400 group-hover:text-white">v{beat.versions!.length - i}</span>
                                      <RefreshCcw size={8} className="opacity-0 group-hover:opacity-100 text-blue-400" />
                                  </div>
                                  <div className="text-[9px] text-gray-600 font-mono mt-0.5">
                                      {new Date(v.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      {new Date(v.timestamp).toLocaleDateString([], {month: 'short', day: 'numeric'})}
                                  </div>
                              </button>
                          ))
                      ) : (
                          <div className="p-3 text-[9px] text-gray-600 text-center italic">No history yet</div>
                      )}
                  </div>
              )}
          </div>
      </div>

      {/* Output Handle */}
      <div 
        className="absolute -right-2.5 top-5 w-5 h-5 bg-[#444] border-2 border-[#2a2a2a] rounded-full cursor-crosshair z-30 hover:bg-[#f5a623] hover:scale-125 transition-transform flex items-center justify-center"
        onMouseDown={(e) => onLinkStart(e, beat.id)}
      >
        <div className="w-1.5 h-1.5 bg-[#999] rounded-full pointer-events-none" />
      </div>

      {/* Input Visual Handle (Non-interactive) */}
      <div className="absolute -left-2.5 top-5 w-5 h-5 bg-[#2a2a2a] border-2 border-[#555] rounded-full z-20 flex items-center justify-center">
        <div className="w-1.5 h-1.5 bg-[#777] rounded-full" />
      </div>
    </div>
  );
};

export default BeatCard;