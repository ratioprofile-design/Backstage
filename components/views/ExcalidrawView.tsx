import React from 'react';
import { useProject } from '../../context/ProjectContext';
import { ExcalidrawBoard } from '../ExcalidrawBoard';
import { PenTool, Layers, Sparkles, FolderArchive, ArrowLeft } from 'lucide-react';

interface ExcalidrawViewProps {
  onEditBeat?: (id: number) => void;
  onNavigateToView?: (view: any) => void;
}

export const ExcalidrawView: React.FC<ExcalidrawViewProps> = ({ onEditBeat, onNavigateToView }) => {
  const { appTheme, appAccentColor = '#f5a623' } = useProject();
  
  const isLight = appTheme === 'light' || (
    appTheme === 'system' && 
    typeof window !== 'undefined' && 
    window.matchMedia('(prefers-color-scheme: light)').matches
  );

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-[#121214] text-slate-100 select-none">
      {/* Top Header Bar for Excalidraw View */}
      <header className="h-10 px-4 bg-[#18181c]/95 border-b border-[#282830] flex items-center justify-between z-20 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div 
              className="w-6 h-6 rounded flex items-center justify-center shadow-inner"
              style={{ backgroundColor: `${appAccentColor}22`, border: `1px solid ${appAccentColor}55` }}
            >
              <PenTool size={13} style={{ color: appAccentColor }} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Whiteboard Canvas
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
              Excalidraw
            </span>
          </div>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          <p className="text-[11px] text-slate-400 hidden md:block">
            Infinite freehand whiteboard for visual thinking, mind-mapping, character webs & story diagrams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToView && (
            <button
              onClick={() => onNavigateToView('board')}
              className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-400 hover:text-amber-400 hover:bg-white/5 border border-transparent hover:border-amber-500/30 transition-all flex items-center gap-1.5"
              title="Return to Beats DAW Sequencer"
            >
              <ArrowLeft size={12} />
              <span>Back to DAW</span>
            </button>
          )}

          {onNavigateToView && (
            <button
              onClick={() => onNavigateToView('documents')}
              className="px-2.5 py-1 rounded text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-slate-700/60 transition-all flex items-center gap-1.5"
              title="Open Document Vault"
            >
              <FolderArchive size={12} className="text-amber-500" />
              <span>Vault</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Excalidraw Canvas Area */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        <ExcalidrawBoard isLight={isLight} />
      </div>
    </div>
  );
};

export default ExcalidrawView;
