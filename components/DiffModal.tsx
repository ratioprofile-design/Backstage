
import React, { useMemo } from 'react';
import { X, RotateCcw, ArrowRight, Calendar, Clock } from 'lucide-react';

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
  const dateStr = new Date(timestamp).toLocaleDateString();
  const timeStr = new Date(timestamp).toLocaleTimeString();

  // Simple visualizer style
  const styles = `
    .diff-view .sc-line {
        padding: 2px 4px;
        border-radius: 2px;
    }
    /* We inherit the global screenplay styles */
  `;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <style>{styles}</style>
      <div className="w-[95vw] h-[90vh] bg-[#121212] border border-[#333] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="h-16 border-b border-[#222] bg-[#181818] flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-2 bg-[#f5a623]/10 rounded text-[#f5a623]">
                    <RotateCcw size={20} />
                </div>
                <div>
                    <h2 className="text-white font-bold text-lg uppercase tracking-tight">Version Compare</h2>
                    <div className="flex items-center gap-3 text-xs text-gray-500 font-mono mt-0.5">
                        <span className="flex items-center gap-1"><Calendar size={10}/> {dateStr}</span>
                        <span className="flex items-center gap-1"><Clock size={10}/> {timeStr}</span>
                        {snapshotTitle && <span className="text-[#f5a623] font-bold">"{snapshotTitle}"</span>}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button 
                    onClick={onClose} 
                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase text-gray-400 hover:text-white hover:bg-[#222] transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={onRestore}
                    className="px-6 py-2.5 bg-[#f5a623] hover:bg-[#e09612] text-black rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                    <RotateCcw size={14} /> Confirm Restore
                </button>
            </div>
        </div>

        {/* COMPARISON BODY */}
        <div className="flex-1 flex overflow-hidden font-screenplay">
            
            {/* CURRENT VERSION (LEFT) */}
            <div className="flex-1 flex flex-col border-r border-[#222] bg-[#0c0c0c]">
                <div className="h-10 border-b border-[#222] flex items-center justify-between px-4 bg-[#111]">
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Current Version</span>
                    <span className="text-[9px] text-[#555] font-mono">WILL BE OVERWRITTEN</span>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div 
                        className="diff-view text-gray-400 opacity-70 pointer-events-none select-none"
                        dangerouslySetInnerHTML={{ __html: currentContent || '<div class="text-xs italic text-gray-700">Empty</div>' }}
                    />
                </div>
            </div>

            {/* DIVIDER */}
            <div className="w-12 bg-[#0a0a0a] border-x border-[#222] flex flex-col items-center justify-center gap-4 relative z-10">
                <div className="h-full w-px bg-[#222] absolute top-0 left-1/2 -translate-x-1/2"></div>
                <div className="w-8 h-8 rounded-full bg-[#111] border border-[#333] flex items-center justify-center z-10">
                    <ArrowRight size={14} className="text-gray-500" />
                </div>
            </div>

            {/* SNAPSHOT VERSION (RIGHT) */}
            <div className="flex-1 flex flex-col bg-[#0e0e0e]">
                <div className="h-10 border-b border-[#222] flex items-center justify-between px-4 bg-[#111]">
                    <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Snapshot to Restore</span>
                    <span className="text-[9px] text-[#555] font-mono">INCOMING DATA</span>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div 
                        className="diff-view text-white"
                        dangerouslySetInnerHTML={{ __html: snapshotContent || '<div class="text-xs italic text-gray-700">Empty</div>' }}
                    />
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default DiffModal;
