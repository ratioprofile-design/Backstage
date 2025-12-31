
import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { signInWithGoogle, isSupabaseConfigured, getCurrentSession } from '../services/supabase';
import { 
    User, FolderOpen, Plus, Trash2, Clock, 
    ArrowRight, Film, Fingerprint, LogIn, Globe,
    AlertTriangle, Server, RefreshCw, Check, HardDrive, Info
} from 'lucide-react';

const WelcomeScreen: React.FC = () => {
  const { 
      currentUser, login, projectList, 
      selectProject, createProject, deleteProject,
      cloudHealth, refreshCloudHealth
  } = useProject();

  const [usernameInput, setUsernameInput] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showGoogleHelp, setShowGoogleHelp] = useState(false);

  // Check for session on mount to handle redirect return
  useEffect(() => {
    getCurrentSession().then(session => {
        if (session?.user) {
            login(session.user.id);
        }
    });
  }, [login]);

  const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const isLocalUser = currentUser && !isUUID(currentUser);

  const handleGoogleLogin = async () => {
      setIsAuthLoading(true);
      try {
          await signInWithGoogle();
          // Redirect happens here
      } catch (e: any) {
          console.error(e);
          if (e.message?.includes('provider')) {
              alert("Google Provider not enabled in Supabase Dashboard.");
          } else {
              alert("Login Failed. Check console for details.");
          }
          setIsAuthLoading(false);
      }
  };

  const handleManualHealthCheck = async () => {
      setIsHealthChecking(true);
      await refreshCloudHealth();
      
      setTimeout(() => {
          setIsHealthChecking(false);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
      }, 800);
  };

  // --- LOGIN PHASE ---
  if (!currentUser) {
      return (
          <div className="fixed inset-0 bg-[#050505] flex items-center justify-center font-sans text-white bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
              
              <div className="max-w-md w-full p-8 relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                  <div className="mb-8 p-4 bg-[#f5a623]/10 rounded-full border border-[#f5a623]/20 shadow-[0_0_40px_rgba(245,166,35,0.1)]">
                      <Fingerprint size={48} className="text-[#f5a623]" />
                  </div>
                  
                  <h1 className="text-3xl font-black tracking-tighter uppercase mb-2">Terminal Login</h1>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-10 text-center opacity-60">Identity verification required</p>
                  
                  <div className="w-full space-y-6">
                      {/* Standard Google Login */}
                      {isSupabaseConfigured() && (
                        <div className="space-y-2">
                            <button 
                                onClick={handleGoogleLogin}
                                disabled={isAuthLoading}
                                className="w-full bg-white text-black font-black uppercase py-3.5 rounded-sm hover:bg-gray-200 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50"
                            >
                                <Globe size={18} className="text-blue-600" />
                                {isAuthLoading ? 'Connecting...' : 'Sign in with Google'}
                            </button>
                            <button 
                                onClick={() => setShowGoogleHelp(!showGoogleHelp)}
                                className="w-full text-[9px] font-bold text-gray-600 uppercase hover:text-gray-400 flex items-center justify-center gap-1.5 py-1"
                            >
                                <Info size={10} /> How do I set this up?
                            </button>
                            
                            {showGoogleHelp && (
                                <div className="p-4 bg-[#111] border border-[#222] rounded text-[10px] text-gray-400 leading-relaxed animate-in slide-in-from-top-2">
                                    <p className="mb-2"><strong className="text-white">Cloud Setup:</strong></p>
                                    <ol className="list-decimal pl-4 space-y-1">
                                        <li>Enable Google in <strong className="text-gray-300">Supabase Auth Providers</strong>.</li>
                                        <li>Create OAuth client in <strong className="text-gray-300">Google Cloud Console</strong>.</li>
                                        <li>Link Client ID & Secret in Supabase.</li>
                                        <li>Add Supabase Redirect URI to Google.</li>
                                    </ol>
                                </div>
                            )}
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                          <div className="h-px flex-1 bg-[#222]"></div>
                          <span className="text-[9px] font-bold text-gray-600 uppercase">OR ACCESS BY CALLSIGN</span>
                          <div className="h-px flex-1 bg-[#222]"></div>
                      </div>

                      <div className="relative group">
                          <User className="absolute left-4 top-3.5 text-gray-500 group-focus-within:text-[#f5a623] transition-colors" size={18} />
                          <input 
                              type="text" 
                              value={usernameInput}
                              onChange={(e) => setUsernameInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && usernameInput.trim() && login(usernameInput.trim())}
                              placeholder="CALLSIGN_ID"
                              className="w-full bg-[#111] border border-[#222] rounded-sm py-3 pl-12 pr-4 text-white font-mono text-sm tracking-widest outline-none focus:border-[#f5a623] transition-all placeholder-gray-800"
                          />
                      </div>
                      
                      <button 
                          onClick={() => usernameInput.trim() && login(usernameInput.trim())}
                          disabled={!usernameInput.trim() || isAuthLoading}
                          className="w-full border border-[#f5a623] text-[#f5a623] hover:bg-[#f5a623] hover:text-black font-black uppercase py-3.5 rounded-sm transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#f5a623] flex items-center justify-center gap-2"
                      >
                          {isAuthLoading ? 'Please wait' : 'Initialize Terminal'} <ArrowRight size={18} />
                      </button>
                  </div>
                  
                  <div className="mt-12 text-[8px] text-gray-700 font-mono uppercase tracking-[0.4em]">
                      Backstage Story Sequencer // Cloud Persisted
                  </div>
              </div>
          </div>
      );
  }

  // --- PROJECT SELECTION PHASE ---
  return (
      <div className="fixed inset-0 bg-[#050505] text-white flex flex-col font-sans">
          {/* Header */}
          <div className="h-16 border-b border-[#1a1a1a] bg-[#0c0c0c] flex items-center justify-between px-8 shrink-0">
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#f5a623] rounded flex items-center justify-center shadow-md">
                      <Film size={16} className="text-black" />
                  </div>
                  <span className="font-black text-lg tracking-tight uppercase">Backstage <span className="text-[#f5a623]">Sequencer</span></span>
              </div>
              <div className="flex items-center gap-5">
                  <div className="text-right">
                      <div className="text-[9px] font-black text-[#555] uppercase tracking-widest leading-none">{isLocalUser ? 'Local Access' : 'Verified Identity'}</div>
                      <div className="text-sm font-bold text-white mt-1">{currentUser.length > 20 ? currentUser.slice(0,8) + '...' : currentUser}</div>
                  </div>
                  <div className="w-10 h-10 bg-[#111] rounded-full border border-[#222] flex items-center justify-center">
                      {isLocalUser ? <HardDrive size={18} className="text-[#f5a623]" /> : <Fingerprint size={20} className="text-[#f5a623]" />}
                  </div>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/20 via-transparent to-transparent pointer-events-none"></div>
              
              <div className="max-w-6xl mx-auto relative z-10">
                  
                  {/* LOCAL USER INFO */}
                  {isLocalUser && (
                      <div className="mb-10 bg-blue-900/10 border border-blue-900/40 rounded-xl p-6 flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
                          <div className="flex items-center gap-4">
                              <div className="p-3 bg-blue-900/20 rounded-full text-blue-400">
                                  <HardDrive size={24} />
                              </div>
                              <div>
                                  <h3 className="text-sm font-black text-blue-400 uppercase tracking-wider">Local Workstation Active</h3>
                                  <p className="text-xs text-gray-400 mt-1 max-w-xl">You are logged in via <strong>Callsign</strong>. Cloud syncing is disabled. Your projects are stored locally in this browser. Use Google Login for cross-device sync.</p>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* CLOUD HEALTH WARNING (ONLY FOR UUID USERS) */}
                  {!isLocalUser && cloudHealth === 'missing-table' && (
                      <div className="mb-10 bg-orange-900/10 border border-orange-900/40 rounded-xl p-6 flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
                          <div className="flex items-center gap-4">
                              <div className="p-3 bg-orange-900/20 rounded-full text-[#f5a623]">
                                  <Server size={24} />
                              </div>
                              <div>
                                  <h3 className="text-sm font-black text-[#f5a623] uppercase tracking-wider">Database Detected?</h3>
                                  <p className="text-xs text-gray-400 mt-1 max-w-xl">If you just ran the SQL command, click <strong>Check Connection</strong>. The "backstage_data" table needs to be verified before cloud features will activate.</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-4">
                              <button 
                                onClick={handleManualHealthCheck}
                                disabled={isHealthChecking}
                                className={`px-5 py-2 rounded font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 ${showSuccess ? 'bg-green-600 text-white' : 'bg-[#f5a623] hover:bg-[#e09612] text-black'}`}
                              >
                                  {isHealthChecking ? <RefreshCw size={14} className="animate-spin" /> : showSuccess ? <Check size={14} /> : <Check size={14} />}
                                  {isHealthChecking ? 'Verifying...' : showSuccess ? 'Connected!' : 'Check Connection'}
                              </button>
                              {!showSuccess && <AlertTriangle size={16} className="text-[#f5a623] animate-pulse" />}
                          </div>
                      </div>
                  )}

                  <div className="flex items-end justify-between mb-10 pb-4 border-b border-[#1a1a1a]">
                    <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3 text-white">
                        <FolderOpen className="text-[#f5a623]" size={28} /> Production Assets
                    </h2>
                    <span className="text-[10px] font-mono text-[#444] mb-1">{projectList.length} PROJECTS FOUND</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                      {/* Create New Card */}
                      <div 
                          className={`bg-[#0c0c0c] border-2 border-dashed border-[#222] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[#f5a623] hover:bg-[#111] transition-all group min-h-[220px] ${isCreating ? 'border-[#f5a623] bg-[#111]' : ''}`}
                          onClick={() => !isCreating && setIsCreating(true)}
                      >
                          {isCreating ? (
                              <div className="w-full flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
                                  <span className="text-[10px] font-black text-[#f5a623] uppercase tracking-[0.2em] text-center">New Project Title</span>
                                  <input 
                                      className="bg-black border border-[#333] rounded-lg p-3 text-center text-white outline-none focus:border-[#f5a623] font-bold text-lg uppercase"
                                      autoFocus
                                      value={newProjectName}
                                      onChange={(e) => setNewProjectName(e.target.value)}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter' && newProjectName.trim()) createProject(newProjectName.trim());
                                          if (e.key === 'Escape') setIsCreating(false);
                                      }}
                                      onBlur={() => { if(!newProjectName) setIsCreating(false); }}
                                  />
                                  <button 
                                      className="bg-[#f5a623] text-black font-black py-3 rounded-lg text-xs uppercase tracking-widest hover:brightness-110 shadow-lg active:scale-95 transition-transform"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => newProjectName.trim() && createProject(newProjectName.trim())}
                                  >
                                      Launch Project
                                  </button>
                              </div>
                          ) : (
                              <>
                                  <div className="w-16 h-16 rounded-full bg-[#111] border border-[#222] flex items-center justify-center mb-6 group-hover:scale-110 transition-all shadow-xl group-hover:bg-[#f5a623] group-hover:border-[#f5a623]">
                                      <Plus size={32} className="text-[#444] group-hover:text-black transition-colors" />
                                  </div>
                                  <span className="text-sm font-black uppercase tracking-widest text-gray-600 group-hover:text-white transition-colors">Start New Entry</span>
                              </>
                          )}
                      </div>

                      {/* Project List */}
                      {projectList.map((project) => (
                          <div 
                              key={project.id}
                              className="bg-[#0c0c0c] border border-[#222] rounded-xl p-8 relative group hover:border-[#f5a623] hover:-translate-y-2 transition-all shadow-2xl flex flex-col justify-between min-h-[220px] cursor-pointer"
                              onClick={() => selectProject(project.id)}
                          >
                              <div className="absolute top-4 right-6 text-6xl font-black text-white/[0.02] pointer-events-none select-none group-hover:text-[#f5a623]/[0.05] transition-colors uppercase">
                                  {project.name.charAt(0)}
                              </div>

                              <div className="relative z-10">
                                  <div className="text-2xl font-black text-gray-200 mb-2 line-clamp-2 leading-none uppercase tracking-tighter group-hover:text-white transition-colors">
                                      {project.name}
                                  </div>
                                  <div className="text-[9px] font-mono text-[#444] uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                                      <div className="w-1 h-1 bg-[#f5a623]"></div>
                                      SECURE_BLOCK: {project.id.slice(-6)}
                                  </div>
                              </div>

                              <div className="flex items-end justify-between mt-auto relative z-10">
                                  <div className="flex flex-col gap-1">
                                      <div className="text-[8px] font-black text-[#444] uppercase tracking-widest">Last Modified</div>
                                      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 group-hover:text-gray-400">
                                          <Clock size={12} />
                                          {new Date(project.lastModified).toLocaleDateString(undefined, {month:'short', day:'numeric', year: 'numeric'})}
                                      </div>
                                  </div>
                                  
                                  <button 
                                      onClick={(e) => { e.stopPropagation(); if(confirm(`Erase "${project.name}" permanently?`)) deleteProject(project.id); }}
                                      className="p-3 text-gray-700 hover:text-red-500 hover:bg-red-900/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-900/30"
                                      title="Delete Project"
                                  >
                                      <Trash2 size={18} />
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
