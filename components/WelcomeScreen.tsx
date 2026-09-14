import React, { useState, useEffect, useMemo } from 'react';
import { 
  FilePlus2, FolderOpen, Clock, Film, Cloud, Trash2, ChevronRight, 
  Mail, LogOut, Search, Sparkles, PenTool, ArrowRight, User, 
  Layers, CheckCircle2, Play, BookOpen, X, Command, AlertTriangle
} from 'lucide-react';
import { RecentFile } from '../utils/recentFiles';
import { ProjectMetadata } from '../types';
import { useProject } from '../context/ProjectContext';
import { isTauri } from '../utils/desktop';

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

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  recents,
  onNew,
  onOpen,
  onOpenRecent,
  onDismiss,
  isCloudMode,
  currentUser,
  cloudProjects = [],
  onOpenCloudProject,
  onDeleteCloudProject,
  onOpenAuth,
}) => {
  const { 
    userRole, logout, schemaError, projectList, selectProject, 
    autoGenerate5Scenes, setActiveBoardId, appAccentColor = '#f5a623' 
  } = useProject();

  const [activeTab, setActiveTab] = useState<'recents' | 'cloud' | 'invites'>('recents');
  const [searchQuery, setSearchQuery] = useState('');
  const [invitedProjects, setInvitedProjects] = useState<any[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);

  // Fetch workspace invites from Supabase
  useEffect(() => {
    if (currentUser) {
      setIsLoadingInvites(true);
      import('../services/supabase')
        .then(({ fetchInvitedProjects }) => fetchInvitedProjects(currentUser))
        .then(data => {
          setInvitedProjects(data || []);
          // Auto-focus invites tab if there are active invites
          if (data && data.length > 0) {
            setActiveTab('invites');
          }
        })
        .catch(err => console.error('Failed to load invites:', err))
        .finally(() => setIsLoadingInvites(false));
    }
  }, [currentUser]);

  // Keyboard shortcut listener for Welcome Screen (Esc, Ctrl+N, Ctrl+O)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        onNew();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        onOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss, onNew, onOpen]);

  // Filtered recent files
  const filteredRecents = useMemo(() => {
    if (!recents) return [];
    if (!searchQuery.trim()) return recents;
    const q = searchQuery.toLowerCase();
    return recents.filter(f => 
      f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    );
  }, [recents, searchQuery]);

  // Filtered cloud projects
  const filteredCloudProjects = useMemo(() => {
    const list = cloudProjects && cloudProjects.length > 0 ? cloudProjects : projectList;
    if (!list) return [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(p => p.name.toLowerCase().includes(q));
  }, [cloudProjects, projectList, searchQuery]);

  // Filtered invites
  const filteredInvites = useMemo(() => {
    if (!invitedProjects) return [];
    if (!searchQuery.trim()) return invitedProjects;
    const q = searchQuery.toLowerCase();
    return invitedProjects.filter(p => 
      p.name.toLowerCase().includes(q) || (p.invitedBy && p.invitedBy.toLowerCase().includes(q))
    );
  }, [invitedProjects, searchQuery]);

  // Quick Action: Launch Demo Screenplay
  const handleLoadDemoProject = () => {
    autoGenerate5Scenes();
    onDismiss();
  };

  // Quick Action: Launch Directly onto Excalidraw Whiteboard
  const handleLaunchExcalidraw = () => {
    setActiveBoardId(1);
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-[700] bg-[#07070a] text-white flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans select-none overflow-hidden">
      {/* Background Ambient Glows */}
      <div 
        className="absolute -top-[15%] -left-[10%] w-[550px] h-[550px] rounded-full blur-[140px] pointer-events-none opacity-25"
        style={{ background: appAccentColor }}
      />
      <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-blue-600/15 blur-[160px] pointer-events-none" />

      {/* Main Glassmorphic Studio Hub Container */}
      <div className="relative w-full max-w-[1020px] h-[660px] max-h-[92vh] bg-[#101116]/95 border border-white/10 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col md:flex-row overflow-hidden">
        
        {/* ================= LEFT PANEL: Studio Actions & Branding ================= */}
        <div className="w-full md:w-[380px] p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/10 flex flex-col justify-between bg-gradient-to-b from-white/[0.03] to-transparent shrink-0">
          
          {/* Studio Brand Header */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3.5">
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg border relative group"
                style={{ 
                  background: `linear-gradient(135deg, ${appAccentColor}25, ${appAccentColor}08)`,
                  borderColor: `${appAccentColor}50` 
                }}
              >
                <Film size={22} style={{ color: appAccentColor }} className="group-hover:scale-110 transition-transform duration-300" />
                <div 
                  className="absolute inset-0 rounded-xl blur-sm opacity-30 pointer-events-none" 
                  style={{ background: appAccentColor }}
                />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black tracking-[0.2em] uppercase text-white leading-none">
                    Backstage
                  </span>
                  <span 
                    className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded tracking-wider border shadow-xs"
                    style={{ 
                      color: appAccentColor, 
                      borderColor: `${appAccentColor}40`,
                      background: `${appAccentColor}15`
                    }}
                  >
                    Studio
                  </span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Screenplay & Story Sequencer
                </span>
              </div>
            </div>

            {/* Schema Error Banner if any */}
            {schemaError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-red-400 text-[10px]">
                  <AlertTriangle size={12} />
                  <span>Database Schema Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed text-red-300/90">
                  {schemaError === 'TABLE_MISSING' ? 'Projects or invites table missing.' : 'Required schema columns missing.'}
                </p>
              </div>
            )}

            {/* Primary Action Cards */}
            <div className="flex flex-col gap-2.5 mt-2">
              {/* 1. New Screenplay */}
              <button
                onClick={onNew}
                className="flex items-center justify-between p-3.5 rounded-xl text-black font-black transition-all duration-200 shadow-md group hover:brightness-105 active:scale-[0.99] border border-black/10 text-left"
                style={{
                  background: `linear-gradient(135deg, ${appAccentColor}, #ffb73c)`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-black/15 flex items-center justify-center shrink-0">
                    <FilePlus2 size={18} className="text-black group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-wider">New Screenplay</span>
                    <span className="text-[10px] font-medium text-black/80">Start fresh scene draft</span>
                  </div>
                </div>
                <kbd className="text-[10px] font-mono font-bold bg-black/20 px-2 py-1 rounded text-black shrink-0">
                  Ctrl+N
                </kbd>
              </button>

              {/* 2. Open Project File */}
              <button
                onClick={onOpen}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white transition-all duration-200 group active:scale-[0.99] text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <FolderOpen size={18} style={{ color: appAccentColor }} className="group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200 group-hover:text-white">Open / Import File</span>
                    <span className="text-[10px] text-gray-400">Backstage (.bst) or Causality (.cau, .json)</span>
                  </div>
                </div>
                <kbd className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-1 rounded border border-white/5 shrink-0">
                  Ctrl+O
                </kbd>
              </button>

              {/* 3. Open Excalidraw Whiteboard */}
              <button
                onClick={handleLaunchExcalidraw}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 text-white transition-all duration-200 group text-left"
                title="Launch infinite whiteboard sketching canvas"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <PenTool size={15} className="text-purple-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Excalidraw Whiteboard</span>
                    <span className="text-[9px] text-gray-500">Infinite sketching & beat canvas</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-gray-600 group-hover:text-white transition-colors shrink-0" />
              </button>

              {/* 4. Quick Starter Demo Project */}
              <button
                onClick={handleLoadDemoProject}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 text-white transition-all duration-200 group text-left"
                title="Load 5-scene demo project with breakdown and beatboard"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Sparkles size={15} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Explore Demo Screenplay</span>
                    <span className="text-[9px] text-gray-500">Test scenes, beats & dialogue</span>
                  </div>
                </div>
                <Play size={12} className="text-gray-600 group-hover:text-emerald-400 transition-colors shrink-0" />
              </button>
            </div>
          </div>

          {/* Bottom Profile & Direct Studio Access */}
          <div className="pt-4 border-t border-white/10 flex flex-col gap-3 mt-4">
            {/* User Details */}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2a2a35] to-[#181820] border border-white/10 flex items-center justify-center shrink-0">
                  <User size={13} className="text-gray-300" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-white truncate max-w-[150px]">
                    {currentUser || 'Guest Writer'}
                  </span>
                  <span className="text-[9px] font-mono text-gray-500 uppercase truncate">
                    {userRole?.includes('writer') ? 'Head Writer' : (userRole || 'Screenwriter')}
                  </span>
                </div>
              </div>

              {currentUser ? (
                <button
                  onClick={() => logout()}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-[10px] flex items-center gap-1 cursor-pointer"
                  title="Sign out of workspace"
                >
                  <LogOut size={13} />
                </button>
              ) : onOpenAuth ? (
                <button
                  onClick={onOpenAuth}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-black text-[10px] uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1"
                  title="Sign in or create account"
                >
                  <User size={11} />
                  <span>Log In</span>
                </button>
              ) : null}
            </div>

            {/* Direct Continue Button */}
            <button
              onClick={onDismiss}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all group"
            >
              <span>Continue to Workspace</span>
              <kbd className="text-[9px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-gray-400 group-hover:text-white">
                Esc
              </kbd>
            </button>
          </div>
        </div>

        {/* ================= RIGHT PANEL: Recents, Cloud & Invites ================= */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0c0d12]/60 p-6 md:p-8 overflow-hidden">
          
          {/* Top Bar: Tabs & Search Input */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-white/10">
            {/* Segmented Navigation Tabs */}
            <div className="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/5 rounded-xl">
              <button
                onClick={() => setActiveTab('recents')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  activeTab === 'recents'
                    ? 'bg-white/10 text-white shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Clock size={13} />
                <span>Recent Scripts</span>
              </button>

              <button
                onClick={() => setActiveTab('cloud')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  activeTab === 'cloud'
                    ? 'bg-white/10 text-white shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Cloud size={13} />
                <span>Cloud Projects</span>
                {filteredCloudProjects.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {filteredCloudProjects.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('invites')}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  activeTab === 'invites'
                    ? 'bg-white/10 text-amber-400 shadow-xs'
                    : 'text-gray-400 hover:text-amber-300'
                }`}
              >
                <Mail size={13} />
                <span>Invites</span>
                {invitedProjects.length > 0 && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
            </div>

            {/* Live Search Input */}
            <div className="relative w-full sm:w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter scripts..."
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500/50 focus:bg-white/[0.06] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Tab Content List Container */}
          <div className="flex-1 overflow-y-auto pr-1 mt-4 space-y-2">
            
            {/* TAB 1: Recent Files */}
            {activeTab === 'recents' && (
              <>
                {filteredRecents.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2.5">
                    {filteredRecents.map((file, idx) => (
                      <div
                        key={file.path || idx}
                        onClick={() => onOpenRecent(file.path)}
                        className="group flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.07] border border-white/5 hover:border-white/15 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-2">
                          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 group-hover:scale-105 transition-transform">
                            <Film size={16} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                              {file.name}
                            </span>
                            <span className="text-[10px] font-mono text-gray-500 truncate max-w-[340px]">
                              {file.path}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="hidden sm:inline text-[10px] text-gray-500 font-mono">
                            Open
                          </span>
                          <ChevronRight size={14} className="text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                      <Clock size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">No Recent Files Found</h4>
                      <p className="text-[11px] text-gray-500 max-w-[280px] mt-1 leading-relaxed">
                        {searchQuery ? `No files matching "${searchQuery}"` : 'Files you open or save locally will automatically appear here.'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: Cloud Projects */}
            {activeTab === 'cloud' && (
              <>
                {filteredCloudProjects.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2.5">
                    {filteredCloudProjects.map((proj) => (
                      <div
                        key={proj.id}
                        className="group flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.07] border border-white/5 hover:border-white/15 transition-all"
                      >
                        <div 
                          onClick={() => onOpenCloudProject ? onOpenCloudProject(proj.id) : selectProject(proj.id)}
                          className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer mr-2"
                        >
                          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400 group-hover:scale-105 transition-transform">
                            <Cloud size={16} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                              {proj.name}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono flex items-center gap-2">
                              <span>Cloud Workspace</span>
                              {proj.updatedAt && (
                                <>
                                  <span>•</span>
                                  <span>{new Date(proj.updatedAt).toLocaleDateString()}</span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => onOpenCloudProject ? onOpenCloudProject(proj.id) : selectProject(proj.id)}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                          >
                            Open
                          </button>

                          {onDeleteCloudProject && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete cloud project "${proj.name}"?`)) {
                                  onDeleteCloudProject(proj.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete project"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                      <Cloud size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                        {currentUser ? 'No Cloud Projects' : 'Sign In Required for Cloud Sync'}
                      </h4>
                      <p className="text-[11px] text-gray-500 max-w-[280px] mt-1 leading-relaxed">
                        {currentUser
                          ? 'Projects created while logged in are automatically backed up to your production cloud.'
                          : 'Log in with your account to access your cloud scripts, automated backups, and shared production workspaces.'
                        }
                      </p>
                    </div>
                    {!currentUser && onOpenAuth && (
                      <button
                        onClick={onOpenAuth}
                        className="mt-1 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        Log In to Access Cloud
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* TAB 3: Production Invites */}
            {activeTab === 'invites' && (
              <>
                {filteredInvites.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2.5">
                    {filteredInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-500/[0.08] to-transparent border border-amber-500/30 shadow-lg"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 mr-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
                            <Mail size={18} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black uppercase tracking-wider text-white truncate">
                              {inv.name}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              Invited by <strong className="text-amber-400 font-bold">{inv.invitedBy || 'Writer'}</strong>
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (onOpenCloudProject) onOpenCloudProject(inv.id);
                            onDismiss();
                          }}
                          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
                        >
                          Join Workspace
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                      <Mail size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                        {currentUser ? 'No Active Invites' : 'Sign In to View Collaboration Invites'}
                      </h4>
                      <p className="text-[11px] text-gray-500 max-w-[320px] mt-1 leading-relaxed">
                        {currentUser
                          ? `When other writers or producers invite you by email (${currentUser}), collaborative productions appear here.`
                          : 'Sign in to check for invitations sent to your email from directors, screenwriters, or producers.'
                        }
                      </p>
                    </div>
                    {!currentUser && onOpenAuth && (
                      <button
                        onClick={onOpenAuth}
                        className="mt-1 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        Log In to View Invites
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

          </div>

          {/* Quick Shortcuts Footer */}
          <div className="pt-3.5 mt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-500 font-mono">
            <div className="flex items-center gap-4">
              <span><kbd className="bg-white/10 px-1 py-0.5 rounded text-gray-300">Ctrl+N</kbd> New</span>
              <span><kbd className="bg-white/10 px-1 py-0.5 rounded text-gray-300">Ctrl+O</kbd> Open</span>
              <span><kbd className="bg-white/10 px-1 py-0.5 rounded text-gray-300">Esc</kbd> Dismiss</span>
            </div>
            <span>Backstage Production Engine</span>
          </div>

        </div>

      </div>
    </div>
  );
};

export default WelcomeScreen;
