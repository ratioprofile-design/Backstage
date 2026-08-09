import React, { useState, useEffect } from 'react';
import { Mail, Trash2, UserPlus, CheckSquare, Square, X, Key, Users, Check, User } from 'lucide-react';
import { useProject } from '../context/ProjectContext';

interface InviteManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Collaborator {
  email: string;
  name?: string;
  role: string;
  editAccess: 'edit' | 'view';
  allowedPages: string[];
}

interface UserProfile {
  name: string;
  email: string;
  defaultRole: string;
}

const AVAILABLE_PAGES = [
  { id: 'board', label: 'Board' },
  { id: 'script', label: 'Script' },
  { id: 'casting', label: 'Casting' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'shotlist', label: 'Shot List' },
  { id: 'production', label: 'Production Plan' }
];

const MOCK_PROFILES: UserProfile[] = [
  { name: 'James Cameron', email: 'writer@backstage.com', defaultRole: 'writer' },
  { name: 'Christopher Nolan', email: 'director@backstage.com', defaultRole: 'director' },
  { name: 'Kathleen Kennedy', email: 'producer@backstage.com', defaultRole: 'producer' },
  { name: 'Sam Mendes', email: 'ad@backstage.com', defaultRole: 'ad' },
  { name: 'Roger Deakins', email: 'cinematographer@backstage.com', defaultRole: 'cinematographer' },
  { name: 'Alex Honnold', email: 'user@backstage.com', defaultRole: 'writer' }
];

export const InviteManagerModal: React.FC<InviteManagerModalProps> = ({ isOpen, onClose }) => {
  const { currentProjectId, appTheme } = useProject();
  const isLight = appTheme === 'light';

  // State to hold collaborators (mocked initially, stored in localStorage)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('writer');
  const [inviteEdit, setInviteEdit] = useState<'edit' | 'view'>('edit');
  const [invitePages, setInvitePages] = useState<string[]>(['board', 'script', 'casting', 'storyboard', 'shotlist', 'production']);

  // Suggestion & Selection state
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Request invite state
  const [requestProjectId, setRequestProjectId] = useState('');
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  // Filter profiles based on typed text
  const filteredProfiles = MOCK_PROFILES.filter(p => 
    p.email.toLowerCase().includes(inviteEmail.toLowerCase()) ||
    p.name.toLowerCase().includes(inviteEmail.toLowerCase())
  );

  // Load collaborators on open
  useEffect(() => {
    if (!isOpen) return;
    const stored = localStorage.getItem(`collaborators_${currentProjectId || 'default'}`);
    if (stored) {
      setCollaborators(JSON.parse(stored));
    } else {
      // Default mock users
      const initial: Collaborator[] = [
        {
          email: 'writer@backstage.com',
          name: 'James Cameron',
          role: 'Writer',
          editAccess: 'edit',
          allowedPages: ['board', 'script', 'casting', 'storyboard']
        },
        {
          email: 'director@backstage.com',
          name: 'Christopher Nolan',
          role: 'Director',
          editAccess: 'view',
          allowedPages: ['board', 'script', 'casting', 'storyboard', 'shotlist', 'production']
        },
        {
          email: 'cinematographer@backstage.com',
          name: 'Roger Deakins',
          role: 'Cinematographer',
          editAccess: 'edit',
          allowedPages: ['storyboard', 'shotlist', 'board']
        }
      ];
      setCollaborators(initial);
      localStorage.setItem(`collaborators_${currentProjectId || 'default'}`, JSON.stringify(initial));
    }
  }, [isOpen, currentProjectId]);

  const saveCollaborators = (updated: Collaborator[]) => {
    setCollaborators(updated);
    localStorage.setItem(`collaborators_${currentProjectId || 'default'}`, JSON.stringify(updated));
  };

  const handleSelectProfile = (profile: UserProfile) => {
    setSelectedProfile(profile);
    setInviteEmail(profile.email);
    setInviteRole(profile.defaultRole);
    setShowSuggestions(false);
  };

  const handleClearSelection = () => {
    setSelectedProfile(null);
    setInviteEmail('');
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const emailToInvite = selectedProfile ? selectedProfile.email : inviteEmail.toLowerCase().trim();
    const nameToInvite = selectedProfile ? selectedProfile.name : emailToInvite.split('@')[0];

    // Check if already invited
    if (collaborators.some(c => c.email.toLowerCase() === emailToInvite.toLowerCase())) {
      alert('This person is already a collaborator.');
      return;
    }

    const newCollab: Collaborator = {
      email: emailToInvite,
      name: nameToInvite,
      role: inviteRole.charAt(0).toUpperCase() + inviteRole.slice(1),
      editAccess: inviteEdit,
      allowedPages: invitePages
    };

    const updated = [...collaborators, newCollab];
    saveCollaborators(updated);
    setInviteEmail('');
    setSelectedProfile(null);
    alert(`Invite sent successfully to ${newCollab.name || newCollab.email}!`);
  };

  const handleRequestInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestProjectId.trim()) return;
    setRequestStatus('sending');
    setTimeout(() => {
      setRequestStatus('success');
      setRequestProjectId('');
      setTimeout(() => setRequestStatus('idle'), 4000);
    }, 1500);
  };

  const togglePageAccess = (collabEmail: string, pageId: string) => {
    const updated = collaborators.map(c => {
      if (c.email === collabEmail) {
        const pages = c.allowedPages.includes(pageId)
          ? c.allowedPages.filter(p => p !== pageId)
          : [...c.allowedPages, pageId];
        return { ...c, allowedPages: pages };
      }
      return c;
    });
    saveCollaborators(updated);
  };

  const changeEditAccess = (collabEmail: string, access: 'edit' | 'view') => {
    const updated = collaborators.map(c => {
      if (c.email === collabEmail) {
        return { ...c, editAccess: access };
      }
      return c;
    });
    saveCollaborators(updated);
  };

  const handleRemoveCollaborator = (email: string) => {
    if (confirm(`Are you sure you want to remove ${email}?`)) {
      const updated = collaborators.filter(c => c.email !== email);
      saveCollaborators(updated);
    }
  };

  const toggleInvitePage = (pageId: string) => {
    setInvitePages(prev =>
      prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className={`w-full max-w-4xl rounded-2xl border flex flex-col h-[80vh] overflow-hidden ${isLight ? 'bg-white border-slate-200 text-slate-900 shadow-2xl' : 'bg-[#151515] border-[#2d2d2d] text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)]'}`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${isLight ? 'border-slate-100 bg-slate-50' : 'border-[#2d2d2d] bg-[#1a1a1a]'}`}>
          <div className="flex items-center gap-2.5">
            <Users className="text-amber-500 animate-pulse" size={20} />
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider">Project Collaboration Manager</h3>
              <p className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Invite partners, manage workspace page permissions, and configure editing privileges.</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${isLight ? 'text-slate-400 hover:text-slate-900 hover:bg-slate-200' : 'text-gray-400 hover:text-white'}`}>
            <X size={18} />
          </button>
        </div>

        {/* Content Panel (Split Left Form & Right Collaborators Management) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Form: Inviting & Requesting */}
          <div className={`w-full md:w-80 p-5 overflow-y-auto border-r ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-[#222] bg-[#121212]'}`}>
            
            {/* Invite Form */}
            <form onSubmit={handleSendInvite} className="mb-8">
              <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-wider mb-4 flex items-center gap-2">
                <UserPlus size={14} /> Send Project Invite
              </h4>
              <div className="space-y-4">
                
                {/* Profile selection / search container */}
                <div className="relative">
                  <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Search Profile by Email ID</label>
                  
                  {selectedProfile ? (
                    /* Display Selected Profile Card */
                    <div className={`p-3 rounded-lg border flex items-center justify-between transition-all ${isLight ? 'bg-amber-500/5 border-amber-500/25' : 'bg-amber-500/[0.03] border-amber-500/20'}`}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-black text-[10px] font-black flex items-center justify-center uppercase">
                          {selectedProfile.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-black truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{selectedProfile.name}</p>
                          <p className={`text-[9px] truncate ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{selectedProfile.email}</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleClearSelection}
                        className={`p-1 rounded-full transition-colors ${isLight ? 'hover:bg-slate-200 text-slate-400 hover:text-slate-900' : 'hover:bg-white/10 text-gray-500 hover:text-white'}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    /* Search input */
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 text-gray-500" size={12} />
                      <input 
                        type="text"
                        required
                        value={inviteEmail}
                        onChange={(e) => {
                          setInviteEmail(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Type email / profile ID..."
                        className={`w-full text-xs pl-8 pr-3 py-2 rounded border outline-none focus:border-amber-500 ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-black border-[#333] text-white'}`}
                      />

                      {/* Suggestion Dropdown */}
                      {showSuggestions && inviteEmail.trim().length > 0 && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setShowSuggestions(false)} />
                          <div className={`absolute left-0 right-0 top-9 z-40 rounded-lg border shadow-xl max-h-48 overflow-y-auto divide-y ${isLight ? 'bg-white border-slate-200 divide-slate-100' : 'bg-[#181818] border-[#2d2d2d] divide-[#222]'}`}>
                            {filteredProfiles.length > 0 ? (
                              filteredProfiles.map(p => (
                                <div 
                                  key={p.email}
                                  onClick={() => handleSelectProfile(p)}
                                  className={`p-2.5 flex items-center gap-2 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}
                                >
                                  <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 text-[9px] font-black flex items-center justify-center uppercase shrink-0">
                                    {p.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0 text-left">
                                    <div className={`text-[10px] font-black truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{p.name}</div>
                                    <div className="text-[9px] text-gray-500 truncate">{p.email}</div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div 
                                onClick={() => setShowSuggestions(false)}
                                className={`p-2.5 text-[9px] italic text-center ${isLight ? 'text-slate-400' : 'text-gray-500'}`}
                              >
                                Profile not registered. Invite guest anyway.
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                </div>

                <div>
                  <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Workspace Role</label>
                  <select 
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded border outline-none focus:border-amber-500 ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-black border-[#333] text-white'}`}
                  >
                    <option value="writer">Writer / Screenwriter</option>
                    <option value="director">Director</option>
                    <option value="producer">Producer</option>
                    <option value="ad">Assistant Director</option>
                    <option value="cinematographer">Cinematographer</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Editing Privilege</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInviteEdit('edit')}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase border rounded transition-all ${inviteEdit === 'edit' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : (isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-[#333] text-gray-400 hover:bg-[#1a1a1a]')}`}
                    >
                      Can Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteEdit('view')}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase border rounded transition-all ${inviteEdit === 'view' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : (isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-[#333] text-gray-400 hover:bg-[#1a1a1a]')}`}
                    >
                      View Only
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-[9px] font-bold uppercase mb-2 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Accessible Pages</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {AVAILABLE_PAGES.map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => toggleInvitePage(p.id)}
                        className={`py-1 px-2 text-[9px] border rounded text-left flex items-center justify-between ${invitePages.includes(p.id) ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : (isLight ? 'border-slate-200 text-slate-500' : 'border-[#2d2d2d] text-gray-500')}`}
                      >
                        {p.label}
                        {invitePages.includes(p.id) ? <CheckSquare size={10} /> : <Square size={10} />}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-black font-black uppercase tracking-wider text-xs rounded transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus size={14} /> Send Invitation
                </button>
              </div>
            </form>

            <div className={`h-px ${isLight ? 'bg-slate-200' : 'bg-[#222]'} my-6`}></div>

            {/* Request Invite */}
            <form onSubmit={handleRequestInvite}>
              <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-wider mb-4 flex items-center gap-2">
                <Key size={14} /> Request Invite
              </h4>
              <div className="space-y-4">
                <div>
                  <label className={`block text-[9px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Project Reference ID</label>
                  <input 
                    type="text"
                    required
                    value={requestProjectId}
                    onChange={(e) => setRequestProjectId(e.target.value)}
                    placeholder="proj_8x3f9..."
                    className={`w-full text-xs px-3 py-2 rounded border outline-none focus:border-amber-500 ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-black border-[#333] text-white'}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={requestStatus === 'sending'}
                  className="w-full py-2 bg-[#222] hover:bg-[#333] border border-[#333] text-white font-black uppercase tracking-wider text-xs rounded transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {requestStatus === 'sending' ? 'Sending Request...' : 'Submit Request'}
                </button>
                {requestStatus === 'success' && (
                  <p className="text-[9px] text-green-400 font-bold text-center leading-normal animate-pulse">Request sent to Project Owner! You will receive an alert once approved.</p>
                )}
              </div>
            </form>
          </div>

          {/* Right Section: Manage Existing Collaborators list */}
          <div className="flex-1 p-5 overflow-y-auto flex flex-col">
            <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-wider mb-4 flex items-center gap-2">
              <Users size={14} /> Workspace Collaborators ({collaborators.length})
            </h4>

            {collaborators.length === 0 ? (
              <div className={`flex flex-col items-center justify-center flex-1 py-12 ${isLight ? 'text-slate-300' : 'text-gray-600'}`}>
                <Users size={48} strokeWidth={1} className="mb-2" />
                <span className="text-xs">No active collaborators invited yet.</span>
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                {collaborators.map((collab) => (
                  <div 
                    key={collab.email}
                    className={`p-4 border rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${isLight ? 'bg-slate-50/50 border-slate-200 hover:bg-slate-50' : 'bg-white/[0.01] border-[#222] hover:bg-white/[0.02]'}`}
                  >
                    {/* User profile & basic info */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-black font-black text-xs flex items-center justify-center uppercase shrink-0 shadow-sm">
                        {(collab.name || collab.email).charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-black flex items-center gap-2">
                          <span className={isLight ? 'text-slate-900' : 'text-white'}>{collab.name || collab.email}</span>
                          <span className="px-1.5 py-0.5 rounded text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black uppercase tracking-wider">{collab.role}</span>
                        </div>
                        {collab.name && (
                          <div className="text-[9px] text-gray-500 mt-0.5">{collab.email}</div>
                        )}
                        
                        {/* Edit Access Privileges toggle */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className={`text-[9px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Privilege:</span>
                          <select
                            value={collab.editAccess}
                            onChange={(e) => changeEditAccess(collab.email, e.target.value as 'edit' | 'view')}
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border outline-none ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-black border-[#333] text-gray-300'}`}
                          >
                            <option value="edit">Can Edit Everything</option>
                            <option value="view">View/Read Only</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Page Permissions checkboxes */}
                    <div className="flex-1 max-w-lg lg:px-4">
                      <span className={`block text-[9px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-505' : 'text-gray-500'}`}>Page Permissions</span>
                      <div className="flex flex-wrap gap-1.5">
                        {AVAILABLE_PAGES.map(p => {
                          const hasAccess = collab.allowedPages.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => togglePageAccess(collab.email, p.id)}
                              className={`px-2 py-1 text-[8px] font-black uppercase rounded border transition-all flex items-center gap-1 ${hasAccess ? 'bg-green-500/10 border-green-500/30 text-green-400' : (isLight ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-[#181818] border-[#222] text-gray-500')}`}
                            >
                              <span className={`w-1 h-1 rounded-full ${hasAccess ? 'bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]' : 'bg-transparent border border-gray-600'}`}></span>
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Trash remove button */}
                    <div className="flex items-center justify-end shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-white/5">
                      <button
                        onClick={() => handleRemoveCollaborator(collab.email)}
                        className={`p-2 rounded-lg transition-colors flex items-center justify-center ${isLight ? 'hover:bg-red-50 text-slate-400 hover:text-red-500' : 'hover:bg-red-500/10 text-gray-500 hover:text-red-400'}`}
                        title="Remove Collaborator"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
