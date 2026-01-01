
import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
    User, FolderOpen, Plus, Trash2, Clock, 
    ArrowRight, Film, Fingerprint, Mail, Lock, Loader2, Sparkles
} from 'lucide-react';
import { supabase } from '../services/supabase';

const WelcomeScreen: React.FC = () => {
  const { 
      currentUser, login, projectList, 
      selectProject, createProject, deleteProject 
  } = useProject();

  const [usernameInput, setUsernameInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'callsign' | 'login' | 'signup'>('callsign');
  const [loading, setLoading] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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

  // --- LOGIN PHASE ---
  if (!currentUser) {
      return (
          <div className="fixed inset-0 bg-[#050505] flex items-center justify-center font-sans text-white bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
              
              <div className="max-w-md w-full p-8 relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                  <div className="mb-8 p-4 bg-[#f5a623]/10 rounded-full border border-[#f5a623]/20 shadow-[0_0_30px_rgba(245,166,35,0.2)]">
                      <Fingerprint size={48} className="text-[#f5a623]" />
                  </div>
                  
                  <h1 className="text-3xl font-black tracking-tighter uppercase mb-2">Backstage ID</h1>
                  <p className="text-gray-500 text-sm mb-8 text-center">Access the production secure terminal.</p>
                  
                  {authMode === 'callsign' ? (
                    <div className="w-full space-y-4 animate-in fade-in duration-300">
                        <div className="relative group">
                            <User className="absolute left-4 top-3.5 text-gray-500 group-focus-within:text-[#f5a623] transition-colors" size={18} />
                            <input 
                                type="text" 
                                value={usernameInput}
                                onChange={(e) => setUsernameInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && usernameInput.trim() && login(usernameInput.trim())}
                                placeholder="LOCAL CALLSIGN"
                                className="w-full bg-[#111] border border-[#333] rounded-xl py-3 pl-12 pr-4 text-white font-bold tracking-wide outline-none focus:border-[#f5a623] focus:ring-1 focus:ring-[#f5a623] transition-all placeholder-gray-700"
                                autoFocus
                            />
                        </div>
                        
                        <button 
                            onClick={() => usernameInput.trim() && login(usernameInput.trim())}
                            disabled={!usernameInput.trim()}
                            className="w-full bg-[#f5a623] text-black font-black uppercase py-3.5 rounded-xl hover:bg-[#ffb74d] transition-transform active:scale-[0.98] disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
                        >
                            Initialize <ArrowRight size={18} />
                        </button>
                        
                        <div className="pt-4 text-center">
                            <button onClick={() => setAuthMode('login')} className="text-[10px] text-gray-500 hover:text-[#f5a623] uppercase font-bold tracking-widest transition-colors">
                                Use Cloud Account (Supabase)
                            </button>
                        </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSupabaseAuth} className="w-full space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                         <div className="relative group">
                            <Mail className="absolute left-4 top-3.5 text-gray-500" size={18} />
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="EMAIL ADDRESS"
                                className="w-full bg-[#111] border border-[#333] rounded-xl py-3 pl-12 pr-4 text-white font-bold outline-none focus:border-[#f5a623] transition-all"
                            />
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-3.5 text-gray-500" size={18} />
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="PASSWORD"
                                className="w-full bg-[#111] border border-[#333] rounded-xl py-3 pl-12 pr-4 text-white font-bold outline-none focus:border-[#f5a623] transition-all"
                            />
                        </div>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full bg-white text-black font-black uppercase py-3.5 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : (authMode === 'login' ? 'Sign In' : 'Create Account')}
                        </button>

                        <div className="flex justify-between items-center px-2">
                             <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-[10px] text-gray-500 hover:text-white uppercase font-bold tracking-widest">
                                {authMode === 'login' ? 'Need an account?' : 'Already have an account?'}
                             </button>
                             <button type="button" onClick={() => setAuthMode('callsign')} className="text-[10px] text-[#f5a623] hover:text-white uppercase font-bold tracking-widest">
                                Go Back
                             </button>
                        </div>
                    </form>
                  )}
                  
                  <div className="mt-12 text-[10px] text-gray-700 font-mono tracking-[0.2em]">
                      {authMode === 'callsign' ? 'LOCAL STORAGE MODE' : 'CLOUD PERSISTENCE ENABLED'}
                  </div>
              </div>
          </div>
      );
  }

  // --- PROJECT SELECTION PHASE ---
  return (
      <div className="fixed inset-0 bg-[#09090b] text-white flex flex-col font-sans">
          <div className="h-16 border-b border-[#222] bg-[#0c0c0c] flex items-center justify-between px-8 shrink-0">
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#f5a623] rounded flex items-center justify-center shadow-md">
                      <Film size={16} className="text-black" />
                  </div>
                  <span className="font-black text-lg tracking-tight">BACKSTAGE <span className="text-[#f5a623]">SEQUENCER</span></span>
              </div>
              <div className="flex items-center gap-4">
                  <div className="text-right">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-end gap-1">
                          {supabase.auth.getSession() ? <Sparkles size={8} className="text-[#f5a623]" /> : null} OPERATOR
                      </div>
                      <div className="text-sm font-bold text-white truncate max-w-[200px]">{currentUser}</div>
                  </div>
                  <div className="w-10 h-10 bg-[#222] rounded-full border border-[#333] flex items-center justify-center">
                      <User size={20} className="text-gray-400" />
                  </div>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
              <div className="max-w-6xl mx-auto">
                  <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-gray-200">
                      <FolderOpen className="text-[#f5a623]" /> Select Project
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      <div 
                          className={`bg-[#111] border-2 border-dashed border-[#333] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#f5a623] hover:bg-[#151515] transition-all group min-h-[200px] ${isCreating ? 'border-[#f5a623] bg-[#151515]' : ''}`}
                          onClick={() => !isCreating && setIsCreating(true)}
                      >
                          {isCreating ? (
                              <div className="w-full flex flex-col gap-3 animate-in fade-in zoom-in duration-200">
                                  <span className="text-xs font-bold text-[#f5a623] uppercase tracking-wider text-center">New Project Name</span>
                                  <input 
                                      className="bg-black border border-[#444] rounded-lg p-2 text-center text-white outline-none focus:border-[#f5a623] font-bold"
                                      autoFocus
                                      value={newProjectName}
                                      onChange={(e) => setNewProjectName(e.target.value)}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter' && newProjectName.trim()) createProject(newProjectName.trim());
                                          if (e.key === 'Escape') setIsCreating(false);
                                      }}
                                  />
                                  <button 
                                      className="bg-[#f5a623] text-black font-bold py-2 rounded-lg text-xs uppercase hover:brightness-110"
                                      onClick={() => newProjectName.trim() && createProject(newProjectName.trim())}
                                  >
                                      Create
                                  </button>
                              </div>
                          ) : (
                              <>
                                  <div className="w-14 h-14 rounded-full bg-[#222] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg group-hover:bg-[#f5a623]">
                                      <Plus size={28} className="text-[#666] group-hover:text-black transition-colors" />
                                  </div>
                                  <span className="font-bold text-gray-500 group-hover:text-white transition-colors">Create New Project</span>
                              </>
                          )}
                      </div>

                      {projectList.map((project) => (
                          <div 
                              key={project.id}
                              className="bg-[#18181b] border border-[#333] rounded-2xl p-6 relative group hover:border-gray-500 hover:-translate-y-1 transition-all shadow-xl flex flex-col justify-between min-h-[200px] cursor-pointer"
                              onClick={() => selectProject(project.id)}
                          >
                              <div>
                                  <div className="text-xl font-bold text-white mb-2 line-clamp-2 leading-tight group-hover:text-[#f5a623] transition-colors">
                                      {project.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-4">
                                      ID: {project.id.slice(-6)}
                                  </div>
                              </div>

                              <div className="flex items-end justify-between mt-auto">
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                      <Clock size={12} />
                                      {new Date(project.lastModified).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                  </div>
                                  
                                  <button 
                                      onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                                      className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                      title="Delete Project"
                                  >
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>
  );
};

export default WelcomeScreen;
