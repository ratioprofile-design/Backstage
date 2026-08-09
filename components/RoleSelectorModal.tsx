import React, { useState } from 'react';
import { PenTool, Film, Briefcase, Clock, Video, Check } from 'lucide-react';

export type UserWorkspaceRole = 'writer' | 'director' | 'producer' | 'ad' | 'cinematographer';

interface RoleSelectorModalProps {
  onSelectRoles: (roles: UserWorkspaceRole[]) => void;
}

const RoleSelectorModal: React.FC<RoleSelectorModalProps> = ({ onSelectRoles }) => {
  const [selected, setSelected] = useState<UserWorkspaceRole[]>([]);

  const roles = [
    {
      id: 'writer' as const,
      title: 'Screenwriter / Writer',
      description: 'Focuses on story development, screenplay editing, and character definitions.',
      icon: PenTool,
      color: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
      activeColor: 'border-amber-400 bg-amber-500/10'
    },
    {
      id: 'director' as const,
      title: 'Director',
      description: 'Oversees the entire creative vision, storyboards, castings, and shots.',
      icon: Film,
      color: 'text-sky-400 border-sky-500/20 bg-sky-500/5',
      activeColor: 'border-sky-400 bg-sky-500/10'
    },
    {
      id: 'producer' as const,
      title: 'Producer',
      description: 'Coordinates production planning, crew management, schedules, and financials.',
      icon: Briefcase,
      color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
      activeColor: 'border-emerald-400 bg-emerald-500/10'
    },
    {
      id: 'ad' as const,
      title: 'Assistant Director',
      description: 'Manages scheduling, production flow, and script breakdowns.',
      icon: Clock,
      color: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
      activeColor: 'border-rose-400 bg-rose-500/10'
    },
    {
      id: 'cinematographer' as const,
      title: 'Cinematographer',
      description: 'Owns shot divisions, storyboards, and production board setups.',
      icon: Video,
      color: 'text-purple-400 border-purple-500/20 bg-purple-500/5',
      activeColor: 'border-purple-400 bg-purple-500/10'
    },
  ];

  const handleToggle = (id: UserWorkspaceRole) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (selected.length === 0) return;
    onSelectRoles(selected);
  };

  return (
    <div className="fixed inset-0 z-[800] bg-[#050508]/90 backdrop-blur-md flex items-center justify-center font-sans">
      <div className="w-full max-w-[560px] p-8 bg-[#101014] border border-white/5 rounded-2xl shadow-2xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-xl font-black uppercase tracking-wider text-white">Choose Your Workspace Roles</h2>
          <p className="text-xs text-gray-400 max-w-[420px] mx-auto leading-relaxed">
            Select one or more roles that best describe your work. Backstage will customize your views and permissions.
          </p>
        </div>

        {/* Roles List */}
        <div className="flex flex-col gap-3 max-h-[340px] overflow-y-auto pr-1">
          {roles.map(role => {
            const Icon = role.icon;
            const isSelected = selected.includes(role.id);
            return (
              <button
                key={role.id}
                onClick={() => handleToggle(role.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-300 hover:bg-white/[0.02] ${
                  isSelected ? role.activeColor : role.color
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                  <Icon size={20} />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-sm font-black uppercase tracking-wide text-white">{role.title}</span>
                  <span className="text-xs text-gray-400 leading-normal">{role.description}</span>
                </div>

                {/* Checkbox status indicator */}
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                  isSelected ? 'bg-amber-400 border-amber-400 text-black' : 'border-white/10'
                }`}>
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={selected.length === 0}
          className={`w-full py-3.5 rounded-xl font-black uppercase tracking-wider text-xs transition-all duration-300 ${
            selected.length > 0 
              ? 'bg-amber-400 text-black shadow-lg hover:bg-amber-300 active:scale-[0.98]' 
              : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
          }`}
        >
          Confirm Selection
        </button>

      </div>
    </div>
  );
};

export default RoleSelectorModal;
