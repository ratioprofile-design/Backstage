import React, { useEffect } from 'react';
import { RotateCcw, ArrowRight, Calendar, Clock, X } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

interface DiffModalProps {
  currentContent: string;
  snapshotContent: string;
  timestamp: number;
  snapshotTitle?: string;
  onRestore: () => void;
  onClose: () => void;
}

const DiffModal: React.FC<DiffModalProps> = ({ 
  currentContent, 
  snapshotContent, 
  timestamp, 
  snapshotTitle,
  onRestore, 
  onClose 
}) => {
  const { appTheme } = useProject();
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const dateStr = new Date(timestamp).toLocaleDateString();
  const timeStr = new Date(timestamp).toLocaleTimeString();

  const styles = `
    .diff-view .sc-line {
        padding: 2px 4px;
        border-radius: 2px;
    }
  `;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
    >
      <style>{styles}</style>
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`w-[95vw] h-[90vh] border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#12141a] border-[#2c303e]'
      }`}>
        
        {/* HEADER */}
        <div className={`h-16 border-b flex items-center justify-between px-6 shrink-0 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181a22] border-[#262832]'
        }`}>
            <div className="flex items-center gap-4">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                    <RotateCcw size={20} />
                </div>
                <div>
                    <h2 className={`font-bold text-lg uppercase tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Version Compare</h2>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5">
                        <span className="flex items-center gap-1"><Calendar size={11}/> {dateStr}</span>
                        <span className="flex items-center gap-1"><Clock size={11}/> {timeStr}</span>
                        {snapshotTitle && <span className="text-amber-500 font-bold">"{snapshotTitle}"</span>}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button 
                    onClick={onClose} 
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                      isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-gray-400 hover:text-white hover:bg-[#222]'
                    }`}
                >
                    Cancel
                </button>
                <button 
                    onClick={onRestore}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                    <RotateCcw size={14} /> Confirm Restore
                </button>
            </div>
        </div>

        {/* COMPARISON BODY */}
        <div className="flex-1 flex overflow-hidden font-screenplay">
            
            {/* CURRENT VERSION (LEFT) */}
            <div className={`flex-1 flex flex-col border-r ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0c0d12] border-[#222]'
            }`}>
                <div className={`h-10 border-b flex items-center justify-between px-4 ${
                  isLight ? 'bg-slate-200/70 border-slate-300' : 'bg-[#111] border-[#222]'
                }`}>
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Current Version</span>
                    <span className="text-[9px] text-slate-400 font-mono">WILL BE OVERWRITTEN</span>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div 
                        className="diff-view text-slate-500 opacity-70 pointer-events-none select-none"
                        dangerouslySetInnerHTML={{ __html: currentContent || '<div class="text-xs italic text-gray-500">Empty</div>' }}
                    />
                </div>
            </div>

            {/* DIVIDER */}
            <div className={`w-12 border-x flex flex-col items-center justify-center gap-4 relative z-10 ${
              isLight ? 'bg-slate-200/80 border-slate-300' : 'bg-[#0a0a0a] border-[#222]'
            }`}>
                <div className={`h-full w-px absolute top-0 left-1/2 -translate-x-1/2 ${isLight ? 'bg-slate-300' : 'bg-[#222]'}`}></div>
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center z-10 ${
                  isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-[#111] border-[#333]'
                }`}>
                    <ArrowRight size={14} className="text-amber-500" />
                </div>
            </div>

            {/* SNAPSHOT VERSION (RIGHT) */}
            <div className={`flex-1 flex flex-col ${
              isLight ? 'bg-white' : 'bg-[#0e0f14]'
            }`}>
                <div className={`h-10 border-b flex items-center justify-between px-4 ${
                  isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-[#111] border-[#222]'
                }`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-emerald-700' : 'text-green-400'}`}>Snapshot to Restore</span>
                    <span className={`text-[9px] font-mono ${isLight ? 'text-emerald-600' : 'text-slate-500'}`}>INCOMING DATA</span>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div 
                        className={`diff-view ${isLight ? 'text-slate-900' : 'text-white'}`}
                        dangerouslySetInnerHTML={{ __html: snapshotContent || '<div class="text-xs italic text-gray-500">Empty</div>' }}
                    />
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default DiffModal;
