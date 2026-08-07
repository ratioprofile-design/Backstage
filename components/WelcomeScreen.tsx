import React from 'react';
import { FilePlus2, FolderOpen, Clock, Film } from 'lucide-react';
import { RecentFile } from '../utils/recentFiles';

interface WelcomeScreenProps {
  recents: RecentFile[];
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onDismiss: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ recents, onNew, onOpen, onOpenRecent, onDismiss }) => {
  return (
    <div className="fixed inset-0 z-[700] bg-[#050505] text-white flex items-center justify-center font-sans">
      <div className="w-full max-w-[880px] px-10">
        <div className="flex items-center justify-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center">
            <Film className="text-[#f5a623]" size={24} />
          </div>
        </div>
        <h1 className="text-center text-3xl font-black tracking-[0.35em] uppercase mb-1">Backstage</h1>
        <p className="text-center text-[11px] font-medium text-gray-500 uppercase tracking-[0.3em] mb-10">Screenplay Workspace</p>

        <div className="grid grid-cols-[1fr_1.1fr] gap-6">
          <div className="flex flex-col gap-3">
            <button
              onClick={onNew}
              className="group flex items-center gap-4 px-5 py-4 rounded-xl bg-[#f5a623] text-black hover:bg-[#ffb73c] transition-all"
            >
              <FilePlus2 size={20} className="shrink-0" />
              <div className="text-left">
                <div className="text-sm font-black uppercase tracking-wider">New Script</div>
                <div className="text-[11px] font-medium text-black/70">Choose where to save a fresh file</div>
              </div>
            </button>

            <button
              onClick={onOpen}
              className="group flex items-center gap-4 px-5 py-4 rounded-xl bg-[#111] border border-white/10 hover:border-[#f5a623]/50 hover:bg-[#161616] transition-all"
            >
              <FolderOpen size={20} className="text-[#f5a623] shrink-0" />
              <div className="text-left">
                <div className="text-sm font-black uppercase tracking-wider">Open File</div>
                <div className="text-[11px] font-medium text-gray-500">Browse for a .bst file on your Mac</div>
              </div>
            </button>

            <button
              onClick={onDismiss}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-[11px] font-bold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
            >
              Skip for now
            </button>
          </div>

          <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} className="text-gray-500" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em]">Recent Files</span>
            </div>
            {recents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <FolderOpen size={28} className="text-gray-700 mb-3" />
                <p className="text-xs text-gray-600">No recent files yet.</p>
                <p className="text-[11px] text-gray-700 mt-1">New or opened scripts will show up here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[260px] pr-1">
                {recents.map(f => (
                  <button
                    key={f.path}
                    onClick={() => onOpenRecent(f.path)}
                    className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-[#111] border border-white/5 hover:border-[#f5a623]/40 hover:bg-[#161616] transition-all text-left"
                  >
                    <span className="text-[13px] font-semibold text-gray-200 truncate">{f.name}</span>
                    <span className="text-[10px] text-gray-600 truncate">{f.path}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
