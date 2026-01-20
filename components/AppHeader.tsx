
import React, { useMemo } from 'react';
import { ViewMode } from '../types';
import { useProject } from '../context/ProjectContext';
import { Target, Zap, Clock, Film, RotateCcw, RotateCw, CheckCircle2, TrendingUp } from 'lucide-react';

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

  // Live Progress Calculation (Smart Daily/Total Switch)
  const progressDisplay = useMemo(() => {
      if (!writingGoal.isActive) return null;

      // 1. Calculate Total Volume
      let totalWords = 0;
      beats.forEach(b => {
          // Robust HTML strip to get pure text content
          const div = document.createElement('div');
          div.innerHTML = b.content;
          const text = (div.textContent || '').trim();
          if (text.length > 0) {
              totalWords += text.split(/\s+/).filter(w => w.length > 0).length;
          }
      });
      // UPDATED: Use floor to count only complete pages
      const totalPages = Math.floor(totalWords / 250);

      // 2. Determine Units
      const isPages = writingGoal.type === 'pages';
      const currentTotal = isPages ? totalPages : totalWords;
      const targetTotal = writingGoal.targetAmount;

      // 3. Calculate Daily Progress
      // FIX: Use toISOString to match ProjectContext's storage key format
      const todayKey = new Date().toISOString().split('T')[0];
      const todayWords = dailyStats[todayKey] || 0;
      // UPDATED: Use floor to count only complete pages
      const todayPages = Math.floor(todayWords / 250);
      const currentDaily = isPages ? todayPages : todayWords;

      // 4. Calculate Dynamic Daily Goal
      const today = new Date();
      today.setHours(0,0,0,0);
      const dueDate = new Date(writingGoal.deadline);
      dueDate.setHours(0,0,0,0);
      
      const diffTime = dueDate.getTime() - today.getTime();
      const daysLeft = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const unitsLeft = Math.max(0, targetTotal - currentTotal);
      
      let dailyTarget = 0;
      if (writingGoal.mode === 'habit') {
          dailyTarget = writingGoal.dailyTarget;
      } else {
          // If we are ahead of schedule, daily target might be 0, but usually we want to keep momentum
          dailyTarget = unitsLeft > 0 ? Math.ceil(unitsLeft / daysLeft) : 0;
      }

      // 5. Determine Display State
      // If user hit daily target, switch to Total Project Progress (Gold)
      // Otherwise show Daily Progress (Blue)
      const isDailyDone = currentDaily >= dailyTarget && dailyTarget > 0;
      const isProjectDone = currentTotal >= targetTotal;

      const showTotal = isDailyDone || isProjectDone;

      const currentDisplay = showTotal ? currentTotal : currentDaily;
      const targetDisplay = showTotal ? targetTotal : dailyTarget;
      
      const percent = targetDisplay > 0 
          ? Math.min(100, Math.round((currentDisplay / targetDisplay) * 100))
          : (currentDisplay > 0 ? 100 : 0);

      return {
          current: currentDisplay,
          target: targetDisplay,
          unit: isPages ? 'Pgs' : 'Wds',
          percent,
          isDone: isProjectDone,
          showTotal, // true = Gold (Project), false = Blue (Daily)
          label: showTotal ? (isProjectDone ? 'Done' : 'Project') : 'Today'
      };
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
            className={`relative overflow-hidden flex items-center gap-3 px-3 py-1.5 rounded-[4px] border transition-all duration-300 group min-w-[140px] h-9 ${
              currentView === 'goals'
                ? 'bg-[#222] border-[#f5a623] shadow-[0_0_10px_rgba(245,166,35,0.2)]'
                : writingGoal.isActive 
                    ? 'bg-[#1a1a1a] border-[#333] hover:border-[#555]' 
                    : 'bg-[#222] border-[#444] text-[#888] hover:border-[#666] hover:text-[#ccc]'
            }`}
            title={progressDisplay ? `${progressDisplay.label} Progress: ${progressDisplay.percent}%` : "Set Goal"}
          >
             {/* Progress Bar Background */}
             {writingGoal.isActive && progressDisplay && (
                 <div 
                    className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ease-out pointer-events-none ${
                        progressDisplay.showTotal
                            ? (progressDisplay.isDone ? 'bg-green-500/30' : 'bg-[#f5a623]/30') // Gold/Green for Total Project
                            : 'bg-blue-600/40' // Blue for Daily Target
                    }`}
                    style={{ width: `${progressDisplay.percent}%` }}
                 />
             )}

             {writingGoal.isActive && progressDisplay ? (
                 <>
                    <div className={`z-10 ${
                        progressDisplay.showTotal
                            ? (progressDisplay.isDone ? 'text-green-500' : 'text-[#f5a623]') 
                            : 'text-blue-400'
                    }`}>
                        {progressDisplay.isDone ? <CheckCircle2 size={14} /> : (progressDisplay.showTotal ? <Target size={14} /> : <TrendingUp size={14} />)}
                    </div>
                    <div className="flex flex-col items-start z-10">
                        <div className="flex items-baseline gap-1">
                            <span className={`text-[10px] font-black uppercase leading-none ${progressDisplay.showTotal ? 'text-gray-200' : 'text-blue-100'}`}>
                                {progressDisplay.current.toLocaleString()}
                            </span>
                            <span className="text-[8px] font-bold text-gray-500 uppercase leading-none">
                                / {progressDisplay.target.toLocaleString()} {progressDisplay.unit}
                            </span>
                        </div>
                        <span className={`text-[8px] font-bold uppercase leading-none mt-0.5 ${progressDisplay.showTotal ? 'text-[#f5a623]' : 'text-blue-400'}`}>
                            {progressDisplay.label}
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
