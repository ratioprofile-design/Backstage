
import React, { useMemo } from 'react';
import { ViewMode } from '../types';
import { useProject } from '../context/ProjectContext';
import { Target, Zap, Clock, Film, RotateCcw, RotateCw } from 'lucide-react';

interface AppHeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onRefresh: () => void;
  onPrint?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ currentView, onViewChange, onRefresh }) => {
  const { 
      isStoryboardFeatureEnabled, writingGoal, dailyStats, beats,
      projectList, currentProjectId,
      undo, redo, canUndo, canRedo
  } = useProject();

  const activeProjectName = useMemo(() => {
      const proj = projectList.find(p => p.id === currentProjectId);
      return proj ? proj.name : 'SEQUENCER';
  }, [projectList, currentProjectId]);

  const views = [
    { id: 'board', label: 'Board' },
    { id: 'script', label: 'Script' },
    { id: 'characters', label: 'Characters' },
    { id: 'breakdown', label: 'Breakdown' },
    { id: 'storyboard', label: 'Storyboard', hidden: !isStoryboardFeatureEnabled },
    { id: 'statistics', label: 'Statistics' }
  ].filter(v => !v.hidden);

  // Live Progress Calculation
  const progressDisplay = useMemo(() => {
      if (!writingGoal.isActive) return null;

      if (writingGoal.mode === 'habit') {
          const todayStr = new Date().toISOString().split('T')[0];
          const todayCount = dailyStats[todayStr] || 0;
          const target = writingGoal.dailyTarget || 500;
          const percent = Math.min(100, (todayCount / target) * 100);
          const isDone = todayCount >= target;
          
          return {
              label: `${todayCount} / ${target}`,
              sub: 'Today',
              percent,
              isDone,
              icon: Zap
          };
      } else {
          // Deadline Mode - Calculate Total Words from Script
          let totalWords = 0;
          beats.forEach(b => {
              // Strip tags and replace with space to ensure word separation
              const text = b.content.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
              if (text.length > 0) {
                  totalWords += text.split(/\s+/).filter(w => w.length > 0).length;
              }
          });
          
          const current = writingGoal.type === 'pages' ? Math.ceil(totalWords / 250) : totalWords;
          const target = writingGoal.targetAmount;
          const percent = Math.min(100, (current / target) * 100);
          
          return {
              label: `${current} / ${target}`,
              sub: writingGoal.type === 'pages' ? 'Pages' : 'Words',
              percent,
              isDone: current >= target,
              icon: Clock
          };
      }
  }, [writingGoal, dailyStats, beats]);

  return (
    <>
      <header className="fixed top-0 left-0 w-full h-[50px] bg-[#111] border-b border-[#3d3d3d] flex items-center justify-between px-5 z-[500] select-none shadow-[0_2px_10px_rgba(0,0,0,0.3)] font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        
        {/* LEFT: Cinematic Logo -> Settings */}
        <div className="flex items-center gap-5 h-full flex-1">
          <div 
              onClick={() => onViewChange('backstage')}
              className="flex items-center gap-3 cursor-pointer group select-none h-full"
              title="Open Backstage (Settings)"
          >
              <div className="w-8 h-8 rounded bg-gradient-to-br from-[#222] to-[#111] border border-[#333] flex items-center justify-center group-hover:border-[#f5a623] transition-all shadow-sm">
                  <Film size={16} className="text-[#f5a623] group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="flex flex-col justify-center pt-0.5">
                  <span className="text-[13px] font-black tracking-tight text-white uppercase leading-none group-hover:text-[#f5a623] transition-colors duration-300">
                      Backstage
                  </span>
                  <span className="text-[7px] font-bold tracking-[0.2em] text-[#555] uppercase leading-none mt-0.5 group-hover:text-white transition-colors duration-300 ml-[1px] truncate max-w-[120px]">
                      {activeProjectName}
                  </span>
              </div>
          </div>
        </div>

        {/* CENTER: View Switcher */}
        <div className="flex items-center justify-center gap-[15px] h-full flex-[0_0_auto]">
          <div className="bg-[#222] border border-[#3d3d3d] rounded-[4px] flex overflow-hidden">
            {views.map((view) => (
              <button
                key={view.id}
                onClick={() => onViewChange(view.id as ViewMode)}
                className={`bg-transparent border-none px-3 py-1.5 cursor-pointer text-[12px] font-semibold uppercase transition-all duration-200 border-r border-[#333] last:border-r-0 ${
                  currentView === view.id 
                    ? 'bg-[#333] text-[#f5a623]' 
                    : 'text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a]'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
          
          {/* UNDO / REDO GROUP */}
          <div className="flex bg-[#222] border border-[#3d3d3d] rounded-[4px] overflow-hidden">
             <button 
                onClick={undo}
                disabled={!canUndo}
                className={`px-3 py-1.5 flex items-center justify-center transition-all ${!canUndo ? 'text-[#444] cursor-not-allowed' : 'text-[#888] hover:text-white hover:bg-[#2a2a2a]'}`}
                title="Undo (Ctrl+Z)"
             >
                <RotateCcw size={14} />
             </button>
             <div className="w-px bg-[#3d3d3d]"></div>
             <button 
                onClick={redo}
                disabled={!canRedo}
                className={`px-3 py-1.5 flex items-center justify-center transition-all ${!canRedo ? 'text-[#444] cursor-not-allowed' : 'text-[#888] hover:text-white hover:bg-[#2a2a2a]'}`}
                title="Redo (Ctrl+Y)"
             >
                <RotateCw size={14} />
             </button>
          </div>
        </div>

        {/* RIGHT: Goal / Progress Widget & User */}
        <div className="flex items-center justify-end gap-[10px] h-full flex-1">
          <button 
            onClick={() => onViewChange('goals')}
            className={`relative overflow-hidden flex items-center gap-3 px-3 py-1.5 rounded-[4px] border transition-all duration-300 group min-w-[140px] ${
              currentView === 'goals'
                ? 'bg-[#222] border-[#f5a623] shadow-[0_0_10px_rgba(245,166,35,0.2)]'
                : writingGoal.isActive 
                    ? 'bg-[#1a1a1a] border-[#333] hover:border-[#555]' 
                    : 'bg-[#222] border-[#444] text-[#888] hover:border-[#666] hover:text-[#ccc]'
            }`}
            title="Goal Tracking"
          >
             {/* Progress Bar Background */}
             {writingGoal.isActive && progressDisplay && (
                 <div 
                    className={`absolute left-0 top-0 bottom-0 bg-[#f5a623]/10 transition-all duration-500 ease-out pointer-events-none ${progressDisplay.isDone ? 'bg-green-500/20' : ''}`}
                    style={{ width: `${progressDisplay.percent}%` }}
                 />
             )}

             {writingGoal.isActive && progressDisplay ? (
                 <>
                    <div className={`z-10 ${progressDisplay.isDone ? 'text-green-500 animate-pulse' : 'text-[#f5a623]'}`}>
                        <progressDisplay.icon size={14} />
                    </div>
                    <div className="flex flex-col items-start z-10">
                        <span className={`text-[10px] font-black uppercase leading-none ${progressDisplay.isDone ? 'text-green-400' : 'text-gray-200'}`}>
                            {progressDisplay.label}
                        </span>
                        <span className="text-[8px] font-bold text-gray-500 uppercase leading-none mt-0.5">
                            {progressDisplay.sub}
                        </span>
                    </div>
                 </>
             ) : (
                 <>
                    <Clock size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-wide">Set Deadline</span>
                 </>
             )}
          </button>
        </div>
      </header>
    </>
  );
};

export default AppHeader;
