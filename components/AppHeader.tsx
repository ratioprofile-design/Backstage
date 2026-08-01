
import React, { useMemo, useState, useEffect } from 'react';
import { ViewMode } from '../types';
import { useProject } from '../context/ProjectContext';
import { 
    Target, Zap, Clock, Film, RotateCcw, RotateCw, CheckCircle2, 
    TrendingUp, Save, Cloud, CloudOff, Wifi, WifiOff, CloudUpload,
    Loader2, Check, FileCode, Inbox
} from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase';
import { AISceneGeneratorModal } from './AISceneGeneratorModal';

interface AppHeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onRefresh: () => void;
  onPrint?: () => void;
  onOpenInbox?: () => void;
  unreadCount?: number;
}

const AppHeader: React.FC<AppHeaderProps> = ({ 
  currentView, 
  onViewChange, 
  onRefresh,
  onOpenInbox,
  unreadCount = 0
}) => {
  const { 
      isStoryboardFeatureEnabled, writingGoal, dailyStats, beats,
      projectList, currentProjectId,
      undo, redo, canUndo, canRedo,
      saveProject, saveProjectAs, hasUnsavedChanges, currentUser, isCloudMode, isSaving, fileHandle,
      autoGenerate5Scenes
  } = useProject();

  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const activeProjectName = useMemo(() => {
      const proj = projectList.find(p => p.id === currentProjectId);
      return proj ? proj.name : 'SEQUENCER';
  }, [projectList, currentProjectId]);

  const isCloudActive = isCloudMode;

  const views = [
    { id: 'board', label: 'Board' },
    { id: 'script', label: 'Script' },
    { id: 'casting', label: 'Casting & Roster' },
    { id: 'breakdown', label: 'Breakdown' },
    { id: 'crew', label: 'Crew' },
    { id: 'shotlist', label: 'Shot Division' },
    { id: 'storyboard', label: 'Storyboard', hidden: !isStoryboardFeatureEnabled },
    { id: 'schedule', label: 'Scheduling' },
    { id: 'statistics', label: 'Statistics' }
  ].filter(v => !v.hidden);

  // Handle saved confirmation effect
  useEffect(() => {
      if (!isSaving && !hasUnsavedChanges) {
          setShowSavedConfirmation(true);
          const timer = setTimeout(() => setShowSavedConfirmation(false), 2000);
          return () => clearTimeout(timer);
      }
  }, [isSaving, hasUnsavedChanges]);

  // Handle Save Action (Final Draft Logic)
  const handleSaveClick = async () => {
      if (isCloudActive) {
          saveProject();
      } else {
          if (!fileHandle) {
              // First time saving locally, pick location
              await saveProjectAs();
          } else {
              saveProject();
          }
      }
  };

  // Live Progress Calculation
  const progressDisplay = useMemo(() => {
      if (!writingGoal.isActive) return null;
      let totalWords = 0;
      beats.forEach(b => {
          const div = document.createElement('div');
          div.innerHTML = b.content;
          const text = (div.textContent || '').trim();
          if (text.length > 0) {
              totalWords += text.split(/\s+/).filter(w => w.length > 0).length;
          }
      });
      const totalPages = Math.floor(totalWords / 250);
      const isPages = writingGoal.type === 'pages';
      const currentTotal = isPages ? totalPages : totalWords;
      const targetTotal = writingGoal.targetAmount;
      const todayKey = new Date().toISOString().split('T')[0];
      const todayWords = dailyStats[todayKey] || 0;
      const todayPages = Math.floor(todayWords / 250);
      const currentDaily = isPages ? todayPages : todayWords;
      const today = new Date();
      today.setHours(0,0,0,0);
      const dueDate = new Date(writingGoal.deadline);
      dueDate.setHours(0,0,0,0);
      const diffTime = dueDate.getTime() - today.getTime();
      const daysLeft = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const unitsLeft = Math.max(0, targetTotal - currentTotal);
      let dailyTarget = writingGoal.mode === 'habit' ? writingGoal.dailyTarget : (unitsLeft > 0 ? Math.ceil(unitsLeft / daysLeft) : 0);
      const isDailyDone = currentDaily >= dailyTarget && dailyTarget > 0;
      const isProjectDone = currentTotal >= targetTotal;
      const showTotal = isDailyDone || isProjectDone;
      const currentDisplay = showTotal ? currentTotal : currentDaily;
      const targetDisplay = showTotal ? targetTotal : dailyTarget;
      const percent = targetDisplay > 0 ? Math.min(100, Math.round((currentDisplay / targetDisplay) * 100)) : (currentDisplay > 0 ? 100 : 0);
      return { current: currentDisplay, target: targetDisplay, unit: isPages ? 'Pgs' : 'Wds', percent, iDone: isProjectDone, showTotal, label: showTotal ? (isProjectDone ? 'Done' : 'Project') : 'Today' };
  }, [writingGoal, dailyStats, beats]);

  const saveTitle = useMemo(() => {
      if (isSaving) return "Writing to Disk...";
      if (showSavedConfirmation) return "Successfully Saved";
      if (isCloudActive) return hasUnsavedChanges ? "Syncing to Production" : "Synced to Production";
      if (fileHandle) return hasUnsavedChanges ? `Save changes to ${fileHandle.name}` : `${fileHandle.name} is up to date`;
      return "Linked to Local Storage (Click to save to disk file)";
  }, [isSaving, showSavedConfirmation, isCloudActive, hasUnsavedChanges, fileHandle]);

  return (
    <>
      <header className="fixed top-0 left-0 w-full h-[50px] bg-[#111] border-b border-[#3d3d3d] flex items-center justify-between px-5 z-[500] select-none shadow-[0_2px_10px_rgba(0,0,0,0.3)] font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        
        {/* LEFT: Cinematic Logo */}
        <div className="flex items-center gap-4 h-full flex-1">
          <div 
              onClick={() => onViewChange('backstage')}
              className="flex items-center gap-3 cursor-pointer group select-none h-full"
              title="Open Backstage (Settings)"
          >
              <div className="w-8 h-8 rounded bg-gradient-to-br from-[#222] to-[#111] border border-[#333] flex items-center justify-center group-hover:border-[#f5a623] transition-all shadow-sm relative">
                  <Film size={16} className="text-[#f5a623] group-hover:scale-110 transition-transform duration-300" />
              </div>
              
              <div className="flex items-center gap-2 transition-all">
                  <div className="flex flex-col justify-center pt-0.5">
                      <span className="text-[13px] font-black tracking-tight text-white uppercase leading-none group-hover:text-[#f5a623] transition-colors duration-300">
                          Backstage
                      </span>
                      <span className="text-[7px] font-bold tracking-[0.2em] text-[#555] uppercase leading-none mt-0.5 group-hover:text-white transition-colors duration-300 ml-[1px] truncate max-w-[120px]">
                          {fileHandle ? fileHandle.name : activeProjectName}
                      </span>
                  </div>
              </div>
          </div>

          <div className="h-4 w-px bg-[#333] mx-1"></div>

          {/* INBOX ICON (Next to Backstage Logo) - Dedicated Page Switcher */}
          <button
              onClick={() => onViewChange('inbox')}
              className={`relative p-2 rounded-lg transition-all duration-300 border flex items-center justify-center group cursor-pointer ${
                  currentView === 'inbox'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,166,35,0.3)]'
                  : 'bg-[#18181c] border-[#333] text-gray-400 hover:text-amber-400 hover:border-amber-500/50 hover:bg-[#222]'
              }`}
              title="Inbox - Production Tasks & Modification History"
          >
              <Inbox size={18} className="group-hover:scale-110 transition-transform duration-300" />
              {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-black bg-[#f5a623] rounded-full shadow-[0_0_8px_rgba(245,166,35,0.8)] animate-pulse">
                      {unreadCount}
                  </span>
              )}
          </button>
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
                            ? (progressDisplay.iDone ? 'bg-green-500/30' : 'bg-[#f5a623]/30') 
                            : 'bg-blue-600/40' 
                    }`}
                    style={{ width: `${progressDisplay.percent}%` }}
                 />
             )}

             {writingGoal.isActive && progressDisplay ? (
                 <>
                    <div className={`z-10 ${
                        progressDisplay.showTotal
                            ? (progressDisplay.iDone ? 'text-green-500' : 'text-[#f5a623]') 
                            : 'text-blue-400'
                    }`}>
                        {progressDisplay.iDone ? <CheckCircle2 size={14} /> : (progressDisplay.showTotal ? <Target size={14} /> : <TrendingUp size={14} />)}
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

      {/* AI Scene Generator Popup Modal */}
      <AISceneGeneratorModal 
        isOpen={isAiModalOpen} 
        onClose={() => setIsAiModalOpen(false)} 
      />
    </>
  );
};

export default AppHeader;
