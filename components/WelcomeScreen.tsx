
import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
    User, FolderOpen, Plus, Trash2, Clock, 
    ArrowRight, Film, Fingerprint, Mail, Lock, Loader2,
    Cloud, Terminal, Hash, Database, Sparkles, LogOut, 
    FileText, Activity, Search
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const WelcomeScreen: React.FC = () => {
  const { 
      currentUser, login, logout, projectList, 
      selectProject, createProject, deleteProject,
      schemaError, clearSchemaError
  } = useProject();

  const [usernameInput, setUsernameInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'callsign' | 'login' | 'signup'>(isSupabaseConfigured ? 'login' : 'callsign');
  const [loading, setLoading] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeSql = schemaError === 'TABLE_MISSING' 
    ? `CREATE TABLE projects (id text PRIMARY KEY, user_id uuid REFERENCES auth.users NOT NULL, name text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz DEFAULT now());`
    : `ALTER TABLE projects ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(activeSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSupabaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        if (authMode === 'login') {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } else {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            alert("Check your email for confirmation!");
        }
    } catch (err: any) {
        alert(err.message);
    } finally {
        setLoading(false);
    }
  };

  const CinematicOverlays = () => (
      <div className="fixed inset-0 pointer-events-none z-[60]">
          <div className="absolute inset-0 bg-[#050505] mix-blend-multiply opacity-20"></div>
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]"></div>
      </div>
  );

  if (schemaError) {
      return (
          <div className="fixed inset-0 bg-[#080808] flex items-center justify-center font-sans text-gray-400">
              <CinematicOverlays />
              <div className="max-w-xl w-full p-10 relative z-[70] animate-in fade-in duration-700">
                  <div className="mb-10 text-center">
                      <Database size={32} className="mx-auto mb-6 text-red-900/50" />
                      <h1 className="text-2xl font-serif italic text-white tracking-tight mb-2">Sync Interrupted</h1>
                      <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em]">Schema Error Detected</p>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Required SQL</span>
                          <button onClick={handleCopySql} className="text-[9px] font-bold text-blue-500 hover:text-white transition-colors">{copied ? 'COPIED' : 'COPY'}</button>
                      </div>
                      <div className="p-6 font-mono text-[10px] text-zinc-500 leading-relaxed overflow-x-auto">
                          <code>{activeSql}</code>
                      </div>
                  </div>
                  <div className="flex flex-col gap-3 mt-10">
                    <button onClick={clearSchemaError} className="w-full bg-white text-black font-bold uppercase py-4 rounded-md text-[10px] tracking-widest hover:bg-zinc-200 transition-all">Re-Verify</button>
                    <button onClick={() => logout()} className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-white transition-colors">Disconnect Account</button>
                  </div>
              </div>
          </div>
      );
  }

  if (!currentUser) {
      return (
          <div className="fixed inset-0 bg-[#080808] flex items-center justify-center font-sans text-white overflow-hidden">
              <CinematicOverlays />
              <div className="absolute top-0 w-full h-full bg-[radial-gradient(circle_at_50%_35%,_rgba(255,255,255,0.02),_transparent_50%)]"></div>

              <div className="max-w-md w-full p-8 relative z-[70] flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  <div className="text-center mb-12">
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-6 mx-auto shadow-2xl">
                          <Film size={20} className="text-[#f5a623]/60" />
                      </div>
                      <h1 className="text-4xl font-serif italic font-black text-white tracking-tight mb-2">Backstage</h1>
                      <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.6em]">Professional Story Suite</div>
                  </div>
                  
                  <div className="w-full bg-black/20 border border-white/5 rounded-3xl p-10 backdrop-blur-xl shadow-2xl">
                      {authMode === 'callsign' ? (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="space-y-4">
                                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Establish Workspace Identity</label>
                                <div className="relative group">
                                    <input 
                                        type="text" 
                                        value={usernameInput}
                                        onChange={(e) => setUsernameInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && usernameInput.trim() && login(usernameInput.trim())}
                                        placeholder="Enter your name or ID"
                                        className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-4 px-6 text-white font-medium outline-none focus:border-white/20 focus:bg-white/[0.04] transition-all placeholder-zinc-700"
                                        autoFocus
                                    />
                                    <Fingerprint className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-800 group-focus-within:text-[#f5a623]/40 transition-colors" size={18} />
                                </div>
                            </div>
                            <button 
                                onClick={() => usernameInput.trim() && login(usernameInput.trim())}
                                disabled={!usernameInput.trim()}
                                className="w-full bg-zinc-100 text-black font-black uppercase py-4 rounded-xl hover:bg-white transition-all active:scale-[0.99] disabled:opacity-10 shadow-xl flex items-center justify-center gap-3 text-[11px] tracking-widest"
                            >
                                Enter Workspace <ArrowRight size={14} />
                            </button>
                            {isSupabaseConfigured && (
                                <button onClick={() => setAuthMode('login')} className="w-full text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-black tracking-widest transition-colors">
                                    Connect Production ID
                                </button>
                            )}
                        </div>
                      ) : (
                        <form onSubmit={handleSupabaseAuth} className="space-y-5 animate-in fade-in duration-500">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Email</label>
                                    <input 
                                        type="email" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3.5 px-5 text-white text-sm outline-none focus:border-white/20 transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Password</label>
                                    <input 
                                        type="password" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3.5 px-5 text-white text-sm outline-none focus:border-white/20 transition-all"
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={loading}
                                className="w-full bg-zinc-100 text-black font-black uppercase py-4 rounded-xl hover:bg-white transition-all flex items-center justify-center gap-3 text-[11px] tracking-widest disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : (authMode === 'login' ? 'Continue' : 'Sign Up')}
                            </button>

                            <div className="flex justify-between items-center px-1 pt-2">
                                <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-black tracking-widest transition-colors">
                                    {authMode === 'login' ? 'New?' : 'Back'}
                                </button>
                                <button type="button" onClick={() => setAuthMode('callsign')} className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-black tracking-widest transition-colors">
                                    Local Driver
                                </button>
                            </div>
                        </form>
                      )}
                  </div>
                  
                  <div className="mt-20 opacity-20 hover:opacity-40 transition-opacity duration-700">
                      <div className="flex items-center gap-3">
                          <span className="text-[8px] font-mono uppercase tracking-[0.4em] text-zinc-500">Suite v2.4.0 • Environment Secure</span>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  return (
      <div className="fixed inset-0 bg-[#080808] text-zinc-400 flex flex-col font-sans overflow-hidden">
          <CinematicOverlays />
          
          <div className="h-20 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 z-50">
              <div className="flex items-center gap-4 group cursor-default">
                  <div className="w-10 h-10 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-center shadow-lg transition-colors group-hover:border-zinc-700">
                      <Film size={18} className="text-[#f5a623]/40 group-hover:text-[#f5a623]/80 transition-colors" />
                  </div>
                  <div className="flex flex-col">
                      <h1 className="text-xl font-serif italic font-black text-white tracking-tight leading-none">Backstage</h1>
                      <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.3em] mt-1">Workspace Control</span>
                  </div>
              </div>
              
              <div className="flex items-center gap-8">
                  <div className="flex items-center gap-5">
                      <div className="text-right">
                          <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">Operator</div>
                          <div className="text-xs font-bold text-zinc-200 uppercase tracking-wider">{currentUser}</div>
                      </div>
                      <div className="w-10 h-10 bg-white/[0.03] rounded-full border border-white/5 flex items-center justify-center shadow-inner group cursor-pointer hover:bg-white/5 transition-colors">
                          <Fingerprint size={20} className="text-zinc-600 group-hover:text-[#f5a623]/60 transition-colors" />
                      </div>
                  </div>
                  
                  <button onClick={() => logout()} className="p-2.5 text-zinc-600 hover:text-red-500 hover:bg-red-900/5 rounded-lg transition-all" title="End Session">
                      <LogOut size={18} />
                  </button>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-12 lg:p-16 custom-scrollbar relative z-10">
              <div className="max-w-6xl mx-auto">
                  <div className="mb-16 flex items-end justify-between border-b border-white/5 pb-8">
                      <div className="space-y-1">
                        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em] mb-4">Archive & Drafts</div>
                        <h2 className="text-4xl font-serif italic font-black text-white tracking-tight">Active Volumes</h2>
                      </div>
                      <div className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest mb-1">{projectList.length} Files Found</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-32">
                      {/* CREATE NEW */}
                      <div 
                          className={`
                            relative bg-black/10 border border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-500 min-h-[300px] overflow-hidden group
                            ${isCreating ? 'border-zinc-500 bg-zinc-900/20' : 'border-white/5 hover:border-zinc-700 hover:bg-white/[0.01]'}
                          `}
                          onClick={() => !isCreating && setIsCreating(true)}
                      >
                          {isCreating ? (
                              <div className="w-full flex flex-col gap-6 animate-in fade-in zoom-in duration-300">
                                  <div className="space-y-1.5 text-center">
                                      <label className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest block">Project Name</label>
                                      <input 
                                          className="w-full bg-transparent border-b border-white/10 py-3 px-2 text-center text-white outline-none focus:border-zinc-500 font-serif italic text-2xl transition-all"
                                          autoFocus
                                          value={newProjectName}
                                          onChange={(e) => setNewProjectName(e.target.value)}
                                          onKeyDown={(e) => {
                                              if (e.key === 'Enter' && newProjectName.trim()) { createProject(newProjectName.trim()); setIsCreating(false); setNewProjectName(''); }
                                              if (e.key === 'Escape') setIsCreating(false);
                                          }}
                                          placeholder="Enter Title..."
                                      />
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={(e) => { e.stopPropagation(); setIsCreating(false); }} className="flex-1 py-3 text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-white transition-colors">Cancel</button>
                                      <button onClick={() => { if (newProjectName.trim()) createProject(newProjectName.trim()); }} className="flex-1 bg-white text-black font-bold py-3 rounded-lg text-[9px] uppercase tracking-widest hover:bg-zinc-200 transition-all">Initialize</button>
                                  </div>
                              </div>
                          ) : (
                              <>
                                  <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-500">
                                      <Plus size={24} className="text-zinc-600 group-hover:text-white transition-colors" />
                                  </div>
                                  <span className="text-[10px] font-bold text-zinc-600 group-hover:text-zinc-400 uppercase tracking-[0.3em] transition-colors">Start New Story</span>
                              </>
                          )}
                      </div>

                      {/* PROJECT CARDS */}
                      {projectList.map((project, idx) => (
                          <div 
                              key={project.id}
                              className="bg-zinc-900/10 border border-white/5 rounded-[2rem] p-10 relative group hover:border-zinc-700 hover:bg-white/[0.01] transition-all duration-700 flex flex-col min-h-[300px] cursor-pointer overflow-hidden animate-in fade-in"
                              style={{ animationDelay: `${idx * 50}ms` }}
                              onClick={() => selectProject(project.id)}
                          >
                              <div className="relative z-10 flex flex-col h-full">
                                  <div className="flex items-center justify-between mb-8 opacity-40 group-hover:opacity-80 transition-opacity">
                                      <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center border border-white/10">
                                          <FileText size={16} className="text-[#f5a623]/60" />
                                      </div>
                                      <span className="text-[8px] font-mono text-zinc-600 font-bold uppercase tracking-widest">#{project.id.slice(-6).toUpperCase()}</span>
                                  </div>

                                  <div className="space-y-3 flex-1">
                                      <h3 className="text-2xl font-serif italic font-black text-zinc-200 line-clamp-3 leading-snug tracking-tight group-hover:text-white transition-colors duration-500">
                                          {project.name}
                                      </h3>
                                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100">
                                          <div className="h-[1px] w-4 bg-[#f5a623]/50"></div>
                                          <span className="text-[8px] font-bold text-[#f5a623]/70 uppercase tracking-widest">Resume Drafting</span>
                                      </div>
                                  </div>

                                  <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-[9px] text-zinc-600 font-bold uppercase tracking-wider group-hover:text-zinc-400 transition-colors">
                                          <Clock size={10} />
                                          {new Date(project.lastModified).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                      </div>
                                      
                                      <button 
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              if (confirm(`Permanently delete "${project.name}"? This action cannot be undone.`)) {
                                                  deleteProject(project.id);
                                              }
                                          }} 
                                          className="text-zinc-800 hover:text-red-900 transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>

          <div className="h-10 bg-black/60 px-10 border-t border-white/5 flex items-center justify-between shrink-0 z-50 text-[8px] font-bold text-zinc-700 uppercase tracking-[0.4em]">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                        <Activity size={10} /> CORE_STABLE
                    </div>
                    <div className="flex items-center gap-2">
                        <Database size={10} /> SYNC_READY
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-zinc-800">Backstage Studio 2025</span>
                </div>
          </div>
      </div>
  );
};

export default WelcomeScreen;
