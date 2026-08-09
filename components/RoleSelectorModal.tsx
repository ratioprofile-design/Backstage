import React from 'react';
import { PenTool, Film, Briefcase, Clock, Video } from 'lucide-react';

interface RoleSelectorModalProps {
  onSelectRole: (role: 'writer' | 'director' | 'producer' | 'ad' | 'cinematographer') => void;
}

const RoleSelectorModal: React.FC<RoleSelectorModalProps> = ({ onSelectRole }) => {
  const roles = [
    {
      id: 'writer' as const,
      title: 'Screenwriter / Writer',
      description: 'Focuses on story development, screenplay editing, and character definitions.',
      icon: PenTool,
      color: 'text-amber-400 border-amber-500/20 hover:border-amber-400 bg-amber-500/5',
    },
    {
      id: 'director' as const,
      title: 'Director',
      description: 'Oversees the entire creative vision, storyboards, castings, and shots.',
      icon: Film,
      color: 'text-sky-400 border-sky-500/20 hover:border-sky-400 bg-sky-500/5',
    },
    {
      id: 'producer' as const,
      title: 'Producer',
      description: 'Coordinates production planning, crew management, schedules, and financials.',
      icon: Briefcase,
      color: 'text-emerald-400 border-emerald-500/20 hover:border-emerald-400 bg-emerald-500/5',
    },
    {
      id: 'ad' as const,
      title: 'Assistant Director',
      description: 'Manages scheduling, production flow, and script breakdowns (Read-Only script access).',
      icon: Clock,
      color: 'text-rose-400 border-rose-500/20 hover:border-rose-400 bg-rose-500/5',
    },
    {
      id: 'cinematographer' as const,
      title: 'Cinematographer',
      description: 'Owns shot divisions, storyboards, and production board setups.',
      icon: Video,
      color: 'text-purple-400 border-purple-500/20 hover:border-purple-400 bg-purple-500/5',
    },
  ];

  return (
    <div className="fixed inset-0 z-[800] bg-[#050508]/90 backdrop-blur-md flex items-center justify-center font-sans">
      <div className="w-full max-w-[560px] p-8 bg-[#101014] border border-white/5 rounded-2xl shadow-2xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-xl font-black uppercase tracking-wider text-white">Choose Your Workspace Role</h2>
          <p className="text-xs text-gray-400 max-w-[420px] mx-auto leading-relaxed">
            Select the role that best describes your work. Backstage will customize your views and permissions to optimize your workflow.
          </p>
        </div>

        {/* Roles List */}
        <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
          {roles.map(role => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                onClick={() => onSelectRole(role.id)}
                className={`w-full flex gap-4 p-4 rounded-xl border text-left transition-all duration-300 hover:bg-white/[0.02] hover:-translate-y-0.5 ${role.color}`}
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                  <Icon size={20} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-black uppercase tracking-wide text-white">{role.title}</span>
                  <span className="text-xs text-gray-400 leading-normal">{role.description}</span>
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default RoleSelectorModal;
