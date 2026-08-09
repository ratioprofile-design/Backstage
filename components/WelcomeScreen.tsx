import React from 'react';
import { FilePlus2, FolderOpen, Clock, Film, Cloud, Trash2, ChevronRight, Mail } from 'lucide-react';
import { RecentFile } from '../utils/recentFiles';
import { ProjectMetadata } from '../types';
import { useProject } from '../context/ProjectContext';

interface WelcomeScreenProps {
  recents: RecentFile[];
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onDismiss: () => void;
  isCloudMode?: boolean;
  currentUser?: string | null;
  cloudProjects?: ProjectMetadata[];
  onOpenCloudProject?: (id: string) => void;
  onDeleteCloudProject?: (id: string) => void;
  onOpenAuth?: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  recents,
  onNew,
  onOpen,
  onOpenRecent,
  isCloudMode,
  currentUser,
  cloudProjects,
  onOpenCloudProject,
  onDeleteCloudProject,
}) => {
  const { userRole } = useProject();
  const isWriter = userRole?.includes('writer') || false;

  const [invitedProjects, setInvitedProjects] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (currentUser) {
      import('../services/supabase').then(({ fetchInvitedProjects }) => {
        fetchInvitedProjects(currentUser).then(setInvitedProjects);
      });
    }
  }, [currentUser]);
  return (
    <div className="fixed inset-0 z-[700] bg-[#08080c] text-white flex items-center justify-center font-sans">
      <div className="w-full max-w-[640px] px-8 py-12 bg-[#101014] border border-white/5 rounded-2xl shadow-2xl flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Film className="text-[#f5a623]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-[0.25em] uppercase text-white">Backstage</h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">Screenplay Workspace</p>
          </div>
        </div>

        {/* Quick Actions / Invites */}
        {isWriter ? (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onNew}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-[#f5a623] hover:bg-[#ffb73c] text-black transition-all duration-300 group"
            >
              <FilePlus2 size={24} className="group-hover:scale-110 transition-transform duration-300" />
              <span className="text-xs font-black uppercase tracking-wider">New Script</span>
            </button>

            <button
              onClick={onOpen}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.08] text-white transition-all duration-300 group"
            >
              <FolderOpen size={24} className="text-[#f5a623] group-hover:scale-110 transition-transform duration-300" />
              <span className="text-xs font-black uppercase tracking-wider">Open File</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Elegant Posh Invites Section */}
            <div className="p-6 rounded-xl bg-gradient-to-b from-[#1c1d24] to-[#121318] border border-amber-500/20 shadow-xl flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <Mail size={16} className="text-amber-400" />
                <span className="text-xs font-black uppercase tracking-widest text-amber-400">Workspace Invites</span>
                <span className="ml-auto text-[9px] text-gray-500 truncate max-w-[180px]">{currentUser}</span>
              </div>

              {invitedProjects.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                  {invitedProjects.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-black uppercase tracking-wide text-white">{p.name}</span>
                        <span className="text-[9px] text-gray-400">Invited by Writer</span>
                      </div>
                      <button
                        onClick={() => onOpenCloudProject?.(p.id)}
                        className="px-3 py-1.5 rounded-lg bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider transition-all hover:bg-amber-300 hover:scale-[1.02] active:scale-[0.98] shadow-md"
                      >
                        Join Workspace
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 flex flex-col gap-2">
                  <span className="text-xs text-gray-400 font-semibold">No active workspace invites</span>
                  <span className="text-[10px] text-gray-500 max-w-[340px] mx-auto leading-relaxed">
                    Ask your project writer to invite you using your email: <strong className="text-gray-400 font-bold">{currentUser}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Subtle Little Fallbacks */}
            <div className="flex items-center justify-center gap-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
              <button 
                onClick={onNew} 
                className="hover:text-amber-400/80 transition-colors flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <FilePlus2 size={12} />
                <span>New Project</span>
              </button>
              <span className="text-white/10 font-normal">|</span>
              <button 
                onClick={onOpen} 
                className="hover:text-amber-400/80 transition-colors flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <FolderOpen size={12} />
                <span>Open File</span>
              </button>
            </div>
          </div>
        )}

        {/* Cloud & Recents */}
        <div className="flex flex-col gap-6">
          {isCloudMode && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <Cloud size={14} className="text-[#10b981]" />
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Cloud Projects</span>
                {currentUser && <span className="ml-auto text-[10px] text-gray-500 truncate max-w-[200px]">{currentUser}</span>}
              </div>
              
              {cloudProjects && cloudProjects.length > 0 ? (
                <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1">
                  {cloudProjects.map(p => (
                    <div key={p.id} className="group flex items-center gap-2">
                      <button
                        onClick={() => onOpenCloudProject?.(p.id)}
                        className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-left"
                      >
                        <span className="text-xs font-semibold text-gray-300 truncate">{p.name}</span>
                        <ChevronRight size={12} className="text-gray-500 ml-auto shrink-0" />
                      </button>
                      <button
                        onClick={() => onDeleteCloudProject?.(p.id)}
                        className="p-2 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete project"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-gray-500 py-2">No cloud projects. New scripts will sync automatically.</div>
              )}
            </div>
          )}

          {/* Recent Files */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Clock size={14} className="text-gray-400" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recent Files</span>
            </div>
            
            {recents.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-500 bg-white/5 rounded-xl border border-white/5">
                No recent files yet.
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto pr-1">
                {recents.map(f => (
                  <button
                    key={f.path}
                    onClick={() => onOpenRecent(f.path)}
                    className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-left"
                  >
                    <span className="text-xs font-semibold text-gray-300 truncate">{f.name}</span>
                    <span className="text-[9px] text-gray-500 truncate">{f.path}</span>
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
