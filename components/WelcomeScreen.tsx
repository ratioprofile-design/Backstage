import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
    User, FolderOpen, Plus, Trash2, Clock, 
    ArrowRight, Film, Fingerprint, Mail, Lock, Loader2,
    Cloud, ShieldCheck, Terminal, Copy, Check, RefreshCw,
    LogOut, Database, ChevronRight, Hash, MoreVertical,
    Layout, Sparkles, Wifi, Activity, FileText, Settings
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

  // --- SQL HELPER STRINGS ---
  const SQL_CREATE = `CREATE TABLE projects (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own projects" 
  ON projects FOR ALL 
  USING (auth.uid() = user_id);`;

  const SQL_MIGRATE = "ALTER TABLE projects ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;";
  const activeSql = schemaError === 'TABLE_MISSING' ? SQL_CREATE : SQL_MIGRATE;

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

  // --- CINEMATIC OVERLAY COMPONENT ---
  const CinematicOverlays = () => (
      <div className="fixed inset-0 pointer-events-none z-[60]">
          <div className="absolute inset-0 bg-[#050505] mix-blend-multiply opacity-20"></div>
          {/* Film Grain */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
          {/* Subtle Scanlines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-20"></div>
          {/* Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]"></div>
      </div>
  );

  // --- SCHEMA ERROR PHASE ---
  if (schemaError) {
      return (
          <div className="fixed inset-0 bg-[#020202] flex items-center justify-center font-sans text-gray-200 overflow-hidden">
              <CinematicOverlays />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(220,38,38,0.1),_transparent_70%)]"></div>
              
              <div className="max-w-2xl w-full p-8 relative z-[70] animate-in fade-in zoom-in duration-500">
                  <div className="flex flex-col items-center mb-12">
                      <div className="w-16 h-16 bg-red-600/10 border border-red-600/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(220,38,38,0.2)]">
                          <Database size={28} className="text-red-500" />
                      </div>
                      <h1 className="text-4xl font-serif font-black text-white italic tracking-tight mb-2">Production Interrupted</h1>
                      <p className="text-gray-500 text-xs font-mono uppercase tracking-[0.3em]">Database Schema Mismatch Detected</p>
                  </div>

                  <div className="bg-[#080808] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                      <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                          <div className="flex items-center gap-3">
                              <Terminal size={14} className="text-gray-500" />
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Initialization Script</span>
                          </div>
                          <button onClick={handleCopySql} className="text-[10px] font-black text-[#f5a623] hover:text-white uppercase transition-colors px-3 py-1 bg-white/5 rounded-full">
                              {copied ? 'Copied to Clipboard' : 'Copy SQL'}
                          </button>
                      </div>
                      <div className="p-8 font-mono text-[11px] text-green-500/80 bg-black/40 overflow-x-auto max-h-60 custom-scrollbar leading-relaxed">
                          <code className="whitespace-pre">{activeSql}</code>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <button onClick={clearSchemaError} className="col-span-2 bg-white text-black font-black uppercase py-4 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-[0.98]">
                        <RefreshCw size={18} /> Re-Verify Connection
                    </button>
                    <button onClick={() => { clearSchemaError(); logout(); }} className="py-3 text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors border border-white/5 rounded-xl hover:bg-white/5">
                        Switch to Local
                    </button>
                    <button onClick={() => logout()} className="py-3 text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors border border-white/5 rounded-xl hover:bg-white/5">
                        Exit Session
                    </button>
                  </div>
              </div>
          </div>
      );
  }

  // --- LOGIN PHASE ---
  if (!currentUser) {
      return (
          <div className="fixed inset-0 bg-[#050505] flex items-center justify-center font-sans text-white overflow-hidden">
              <CinematicOverlays />
              {/* Cinematic Background Elements */}
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_40%,_rgba(245,166,35,0.08),_transparent_60%)]"></div>
              <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(circle_at_100%_100%,_rgba(59,130,246,0.04),_transparent_50%)]"></div>

              <div className="max-w-md w-full p-8 relative z-[70] flex flex-col items-center animate-in fade-in duration-1000">
                  <div className="flex flex-col items-center mb-16 text-center">
                      <div className="relative mb-8">
                        <div className="w-24 h-24 bg-gradient-to-br from-[#222] to-[#050505] border border-white/10 rounded-[2rem] flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] group transition-transform hover:scale-105 duration-500 relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(245,166,35,0.2),_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <Film size={44} className="text-[#f5a623] group-hover:rotate-12 transition-transform duration-700 relative z-10" />
                        </div>
                        {isSupabaseConfigured && (
                             <div className="absolute -top-1 -right-1 bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center border-4 border-[#050505] shadow-lg" title="Cloud Sync Active">
                                 <Cloud size={14} className="text-white" />
                             </div>
                        )}
                      </div>
                      <h1 className="text-6xl font-serif italic font-black text-white tracking-tighter mb-4 selection:bg-[#f5a623] selection:text-black">
                        Backstage
                      </h1>
                      <div className="flex items-center gap-4">
                          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#333]"></div>
                          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.5em] whitespace-nowrap">Professional Story Suite</p>
                          <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#333]"></div>
                      </div>
                  </div>
                  
                  <div className="w-full bg-[#0a0a0a]/60 border border-white/5 rounded-[2.5rem] p-10 shadow-[0_30px_100px_rgba(0,0,0,0.8)] backdrop-blur-2xl relative overflow-hidden group/form">
                      {/* Form Sweep Effect */}
                      <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent rotate-45 translate-x-[-100%] group-hover/form:translate-x-[200%] transition-transform duration-[1500ms] pointer-events-none"></div>

                      {authMode === 'callsign' ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Operator Callsign</label>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                                        <span className="text-[8px] font-mono text-orange-500/70 font-bold uppercase">Standby</span>
                                    </div>
                                </div>
                                <div className="relative">
                                    <Fingerprint className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-700" size={18} />
                                    <input 
                                        type="text" 
                                        value={usernameInput}
                                        onChange={(e) => setUsernameInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && usernameInput.trim() && login(usernameInput.trim())}
                                        placeholder="GHOSTWRITER_01"
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-white font-bold text-lg outline-none focus:border-[#f5a623]/40 focus:bg-black/60 transition-all placeholder-gray-800 tracking-wide"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={() => usernameInput.trim() && login(usernameInput.trim())}
                                disabled={!usernameInput.trim()}
                                className="w-full bg-[#f5a623] text-black font-black uppercase py-5 rounded-2xl hover:bg-white transition-all active:scale-[0.98] disabled:opacity-10 shadow-[0_10px_30px_rgba(245,166,35,0.2)] flex items-center justify-center gap-3 group relative overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-3">
                                    Establish Session <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </span>
                            </button>
                            {isSupabaseConfigured && (
                                <button onClick={() => setAuthMode('login')} className="w-full text-[9px] text-gray-500 hover:text-gray-300 uppercase font-black tracking-[0.4em] transition-colors py-2 flex items-center justify-center gap-2">
                                    <Cloud size={12} className="text-blue-500/40" /> Production Link
                                </button>
                            )}
                        </div>
                      ) : (
                        <form onSubmit={handleSupabaseAuth} className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Email Coordinates</label>
                                    <div className="relative">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-700" size={18} />
                                        <input 
                                            type="email" 
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-white font-bold outline-none focus:border-[#f5a623]/40 focus:bg-black/60 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Secure Passkey</label>
                                    <div className="relative">
                                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-700" size={18} />
                                        <input 
                                            type="password" 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-white font-bold outline-none focus:border-[#f5a623]/40 focus:bg-black/60 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#f5a623] text-black font-black uppercase py-5 rounded-2xl hover:bg-white transition-all flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : (authMode === 'login' ? 'Sync Profile' : 'Register Operator')}
                            </button>

                            <div className="flex justify-between items-center px-2 pt-2">
                                <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-[9px] text-gray-500 hover:text-white uppercase font-black tracking-widest transition-colors">
                                    {authMode === 'login' ? 'New ID?' : 'Back to Login'}
                                </button>
                                <button type="button" onClick={() => setAuthMode('callsign')} className="text-[9px] text-gray-500 hover:text-white uppercase font-black tracking-widest transition-colors">
                                    Local Drive
                                </button>
                            </div>
                        </form>
                      )}
                  </div>
                  
                  <div className="mt-16 flex flex-col items-center gap-4 opacity-30 hover:opacity-100 transition-all duration-700">
                      <div className="flex items-center gap-3">
                          <Sparkles size={14} className="text-[#f5a623]" />
                          <span className="text-[9px] font-mono uppercase tracking-[0.6em]">System Version 2.4.0</span>
                      </div>
                      <div className="text-[8px] font-black text-gray-700 uppercase tracking-[0.2em] max-w-[200px] text-center leading-relaxed">
                          Proprietary engine for cinematic planning and narrative geometry.
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // --- PROJECT SELECTION PHASE ---
  return (
      <div className="fixed inset-0 bg-[#020202] text-gray-100 flex flex-col font-sans overflow-hidden">
          <CinematicOverlays />
          {/* Ambient Corner Glows */}
          <div className="absolute top-0 right-0 w-2/3 h-full bg-[radial-gradient(circle_at_100%_0%,_rgba(245,166,35,0.04),_transparent_70%)] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-[radial-gradient(circle_at_0%_100%,_rgba(59,130,246,0.03),_transparent_60%)] pointer-events-none"></div>
          
          <div className="h-24 border-b border-white/5 bg-black/60 backdrop-blur-3xl flex items-center justify-between px-12 shrink-0 z-50">
              <div className="flex items-center gap-10">
                  <div className="flex items-center gap-5 group cursor-default">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#222] to-black rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-[#f5a623]/50 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                          <Film size={26} className="text-[#f5a623]" />
                      </div>
                      <div className="flex flex-col">
                          <h1 className="text-3xl font-serif italic font-black text-white tracking-tighter leading-none">Backstage</h1>
                          <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em] mt-1 ml-0.5">Control Tower</span>
                      </div>
                  </div>
              </div>
              
              <div className="flex items-center gap-12">
                  <div className="flex items-center gap-6">
                      <div className="text-right">
                          <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center justify-end gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured && authMode !== 'callsign' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-orange-500 shadow-[0_0_10px_rgba(245,166,35,0.5)]'}`}></span>
                              {isSupabaseConfigured && authMode !== 'callsign' ? 'Encrypted Cloud' : 'Local Drive'}
                          </div>
                          <div className="text-sm font-black text-white uppercase tracking-wider truncate max-w-[220px]">{currentUser}</div>
                      </div>
                      <div className="w-14 h-14 bg-gradient-to-br from-white/10 to-transparent rounded-full border border-white/10 flex items-center justify-center shadow-inner group">
                          <Fingerprint size={28} className="text-gray-500 group-hover:text-[#f5a623] transition-colors duration-500" />
                      </div>
                  </div>
                  
                  <button onClick={() => logout()} className="p-3 bg-white/5 rounded-xl border border-white/5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all hover:scale-105 active:scale-95 group" title="Terminate Session">
                      <LogOut size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                  </button>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-12 lg:p-20 custom-scrollbar relative z-10">
              <div className="max-w-[1400px] mx-auto">
                  <div className="mb-20 flex items-end justify-between border-b border-white/5 pb-12">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-gray-500 uppercase tracking-widest">Production Archive</span>
                            <div className="h-px w-20 bg-gradient-to-r from-[#333] to-transparent"></div>
                        </div>
                        <h2 className="text-6xl font-serif italic font-black text-white tracking-tighter">Drafts Vault</h2>
                        <p className="text-gray-500 text-[11px] font-black uppercase tracking-[0.4em] flex items-center gap-3">
                            <Hash size={14} className="text-[#f5a623]" /> Sequence Manifest & Scripts
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-3 pb-2">
                          <div className="flex gap-2 mb-2">
                              <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black text-white leading-none">{projectList.length}</span>
                                  <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-1">Volumes</span>
                              </div>
                              <div className="w-px h-8 bg-white/5 mx-2"></div>
                              <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black text-[#f5a623] leading-none">ACTIVE</span>
                                  <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-1">Status</span>
                              </div>
                          </div>
                          <div className="h-1.5 w-32 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full w-2/3 bg-gradient-to-r from-blue-500 to-[#f5a623]"></div>
                          </div>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-12 pb-32">
                      {/* --- CREATE NEW ACTION --- */}
                      <div 
                          className={`
                            relative bg-[#080808]/80 border-2 border-dashed rounded-[3rem] p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-700 group min-h-[380px] overflow-hidden backdrop-blur-md
                            ${isCreating ? 'border-[#f5a623] bg-[#f5a623]/5' : 'border-white/5 hover:border-[#f5a623]/40 hover:bg-white/[0.03]'}
                          `}
                          onClick={() => !isCreating && setIsCreating(true)}
                      >
                          {isCreating ? (
                              <div className="w-full flex flex-col gap-8 animate-in fade-in zoom-in duration-300 relative z-10">
                                  <div className="space-y-2">
                                      <label className="text-[9px] font-black text-[#f5a623] uppercase tracking-widest block text-center">New Project Identity</label>
                                      <input 
                                          className="w-full bg-transparent border-b-2 border-white/10 py-5 px-2 text-center text-white outline-none focus:border-[#f5a623] font-serif italic text-3xl transition-all placeholder-gray-800"
                                          autoFocus
                                          value={newProjectName}
                                          onChange={(e) => setNewProjectName(e.target.value)}
                                          onKeyDown={(e) => {
                                              if (e.key === 'Enter' && newProjectName.trim()) {
                                                  createProject(newProjectName.trim());
                                                  setIsCreating(false);
                                                  setNewProjectName('');
                                              }
                                              if (e.key === 'Escape') setIsCreating(false);
                                          }}
                                          placeholder="Project Title..."
                                      />
                                  </div>
                                  <div className="flex gap-4">
                                      <button onClick={(e) => { e.stopPropagation(); setIsCreating(false); }} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors border border-white/5 rounded-2xl hover:bg-white/5">Abort</button>
                                      <button onClick={() => { if (newProjectName.trim()) createProject(newProjectName.trim()); }} className="flex-2 bg-[#f5a623] text-black font-black py-4 px-8 rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:brightness-110 shadow-[0_10px_30px_rgba(245,166,35,0.3)] transition-all">Initialize Draft</button>
                                  </div>
                              </div>
                          ) : (
                              <>
                                  <div className="relative mb-10">
                                      <div className="absolute inset-0 bg-[#f5a623]/20 rounded-full blur-2xl group-hover:opacity-100 opacity-0 transition-opacity duration-700"></div>
                                      <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center relative z-10 group-hover:scale-110 group-hover:bg-[#f5a623] group-hover:border-[#f5a623] group-hover:shadow-[0_0_40px_rgba(245,166,35,0.4)] transition-all duration-700">
                                          <Plus size={40} className="text-gray-500 group-hover:text-black transition-colors" strokeWidth={3} />
                                      </div>
                                  </div>
                                  <div className="flex flex-col items-center gap-2">
                                      <span className="text-[11px] font-black text-gray-500 group-hover:text-white uppercase tracking-[0.5em] transition-colors">Start Production</span>
                                      <span className="text-[8px] font-mono text-gray-700 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">CREATE_NEW_DRAFT</span>
                                  </div>
                              </>
                          )}
                          <div className="absolute bottom-0 left-0 w-full h-2 bg-white/5 group-hover:bg-[#f5a623] transition-all duration-700"></div>
                      </div>

                      {/* --- PROJECT CARDS --- */}
                      {projectList.map((project, idx) => (
                          <div 
                              key={project.id}
                              className="bg-[#0c0c0c]/80 border border-white/5 rounded-[3rem] p-12 relative group hover:border-[#f5a623]/40 hover:-translate-y-3 transition-all duration-1000 shadow-2xl flex flex-col min-h-[380px] cursor-pointer overflow-hidden animate-in fade-in slide-in-from-bottom-4 backdrop-blur-xl"
                              style={{ animationDelay: `${idx * 100}ms` }}
                              onClick={() => selectProject(project.id)}
                          >
                              {/* Top Accent Strip */}
                              <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5 group-hover:bg-[#f5a623] transition-all duration-700"></div>
                              
                              <div className="relative z-10 flex flex-col h-full">
                                  <div className="flex items-center justify-between mb-12">
                                      <div className="w-12 h-12 bg-white/[0.03] rounded-2xl flex items-center justify-center border border-white/5 group-hover:bg-[#f5a623]/10 group-hover:border-[#f5a623]/20 transition-all duration-500">
                                          <FileText size={24} className="text-[#f5a623]/40 group-hover:text-[#f5a623] transition-colors" />
                                      </div>
                                      <div className="flex flex-col items-end">
                                          <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest group-hover:text-[#f5a623]/60 transition-colors">SEQ-ID</span>
                                          <span className="text-[9px] font-mono text-[#333] uppercase group-hover:text-gray-500 transition-colors">{project.id.slice(-8).toUpperCase()}</span>
                                      </div>
                                  </div>

                                  <div className="space-y-4 mb-auto">
                                      <h3 className="text-4xl font-serif italic font-black text-white line-clamp-3 leading-[1.1] tracking-tight group-hover:text-[#f5a623] transition-all duration-500 selection:bg-white selection:text-black">
                                          {project.name}
                                      </h3>
                                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                                          <div className="h-0.5 w-8 bg-[#f5a623]"></div>
                                          <span className="text-[9px] font-black text-[#f5a623] uppercase tracking-widest">RESUME DRAFT</span>
                                      </div>
                                  </div>

                                  <div className="mt-12 pt-8 border-t border-white/5 flex items-end justify-between">
                                      <div className="flex flex-col gap-2">
                                          <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Modified</span>
                                          <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider group-hover:text-white transition-colors">
                                              <Clock size={14} className="text-gray-700 group-hover:text-[#f5a623]" />
                                              {new Date(project.lastModified).toLocaleDateString(undefined, {month:'long', day:'numeric', year: 'numeric'})}
                                          </div>
                                      </div>
                                      
                                      <button 
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              if (confirm(`CRITICAL ACTION: Permanently terminate production for "${project.name}"? This will erase all sequences, characters, and screenplay data forever. This action cannot be undone.`)) {
                                                  deleteProject(project.id);
                                              }
                                          }} 
                                          className="w-12 h-12 flex items-center justify-center text-gray-800 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all group-hover:opacity-100 opacity-0 group-hover:scale-100 scale-50"
                                      >
                                          <Trash2 size={20} />
                                      </button>
                                  </div>
                              </div>
                              
                              {/* Decorative Binder Rings Aesthetic Overlay */}
                              <div className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-8 opacity-5 group-hover:opacity-10 transition-opacity duration-1000">
                                  {[1,2,3].map(i => <div key={i} className="w-4 h-4 rounded-full border-2 border-white"></div>)}
                              </div>

                              {/* Card Glow Effect */}
                              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#f5a623]/10 rounded-full blur-[80px] group-hover:bg-[#f5a623]/20 transition-all duration-1000 pointer-events-none"></div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>

          {/* Footer Terminal Bar */}
          <div className="h-14 bg-black/80 px-12 border-t border-white/5 flex items-center justify-between shrink-0 z-50 backdrop-blur-2xl">
                <div className="flex items-center gap-10">
                    <div className="flex items-center gap-3">
                        <Activity size={14} className="text-gray-600" />
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Core_Engine: Active</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Sparkles size={14} className="text-blue-500/50" />
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Neural_Processing: Ready</span>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Environment_Secure</span>
                    </div>
                    <div className="h-4 w-[1px] bg-white/10"></div>
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] italic">Ghostwriter Studio v2.4.0</span>
                </div>
          </div>
      </div>
  );
};

export default WelcomeScreen;
