
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ViewMode } from '../types';
import { useProject } from '../context/ProjectContext';
import {
    Target, Zap, Clock, Film, RotateCcw, RotateCw, CheckCircle2, 
    TrendingUp, Save, Cloud, CloudOff, Wifi, WifiOff, CloudUpload,
    Loader2, Check, FileCode, Inbox, Sun, Moon, LogIn, LogOut, ChevronDown, ChevronLeft, ChevronRight, Sparkles, User, Settings, Folder, Pencil,
    Workflow, PenTool, FileText, Columns, Layers, Video, Image as ImageIcon, Calendar, CalendarCheck, ClipboardList, Files
} from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase';
import { useAiKeyStatus } from '../context/AiKeyStatusContext';
import { AISceneGeneratorModal } from './AISceneGeneratorModal';
import { InviteManagerModal } from './InviteManagerModal';
import { Users as UsersIcon } from 'lucide-react';
import { ThemeToggleButton } from './ThemeToggleButton';
import { translateUi } from '../services/appTranslations';

export interface NavGroupItem {
  id: ViewMode;
  label: string;
  description?: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  hidden?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  shortLabel: string;
  align?: 'left' | 'center' | 'right';
  items: NavGroupItem[];
}

interface AppHeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onRefresh: () => void;
  onPrint?: () => void;
  onOpenInbox?: () => void;
  unreadCount?: number;
  onOpenAuth?: () => void;
  onAskAnything?: () => void;
  onOpenSettings?: () => void;
  hideViewSwitcher?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  backViewName?: string | null;
  forwardViewName?: string | null;
}

const AppHeader: React.FC<AppHeaderProps> = ({ 
  currentView, 
  onViewChange, 
  onRefresh,
  onOpenInbox,
  unreadCount = 0,
  onOpenAuth,
  onAskAnything,
  onOpenSettings,
  hideViewSwitcher = false,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  backViewName,
  forwardViewName
}) => {
  const { 
      isStoryboardFeatureEnabled, writingGoal, dailyStats, beats,
      projectList, currentProjectId,
      undo, redo, canUndo, canRedo,
      saveProject, saveProjectAs, hasUnsavedChanges, currentUser, isCloudMode, isSaving, fileHandle,
      autoGenerate5Scenes, appTheme, setAppTheme, logout, cloudOffline, supabaseUser, userRole, appAccentColor,
      appLanguage,
      collaborators = [],
      currentProjectName,
      isCurrentProjectShared,
      renameProject,
      closeProject,
      selectProject
  } = useProject();

  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [newProjectNameInput, setNewProjectNameInput] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  const { aiAvailable, router, gemini, testing } = useAiKeyStatus();
  const aiStatusTitle = testing
      ? 'Checking AI API keys...'
      : aiAvailable
        ? (router.state === 'valid' ? `${router.provider} key OK · Gemini key ${gemini.state === 'valid' ? 'OK' : 'off'}` : 'AI ready (Gemini key OK)')
        : `AI unavailable — no working API key${gemini.state === 'invalid' ? ' (Gemini key ' + (gemini.error ? 'error' : 'not set') + ')' : ''}${router.state === 'nocredit' ? ' (TokenRouter needs credit)' : ''}. Fix in Backstage > AI.`;

  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!showProjectDropdown) return;
    const handleOutside = () => setShowProjectDropdown(false);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [showProjectDropdown]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const activeProjectName = useMemo(() => {
      const proj = projectList.find(p => p.id === currentProjectId);
      if (proj && proj.name && proj.name !== 'SEQUENCER') return proj.name;
      if (currentProjectName) return currentProjectName;
      return 'Untitled Project';
  }, [projectList, currentProjectId, currentProjectName]);

  const isShared = useMemo(() => {
      const proj = projectList.find(p => p.id === currentProjectId);
      return Boolean(proj?.isInvited || isCurrentProjectShared);
  }, [projectList, currentProjectId, isCurrentProjectShared]);

  const isCloudActive = isCloudMode;

  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openGroupId) return;
    const handleOutside = (e: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target as Node)) {
        setOpenGroupId(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroupId(null);
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [openGroupId]);

  const navGroups = useMemo(() => {
    return [
      {
        id: 'writing',
        label: translateUi('Writing', appLanguage),
        shortLabel: translateUi('Writing', appLanguage),
        items: [
          { 
            id: 'board' as ViewMode, 
            label: translateUi('Causality Short', appLanguage) !== 'Causality Short' ? translateUi('Causality Short', appLanguage) : 'Causality',
            icon: Workflow
          },
          { 
            id: 'excalidraw' as ViewMode, 
            label: translateUi('Excalidraw Short', appLanguage) !== 'Excalidraw Short' ? translateUi('Excalidraw Short', appLanguage) : 'Excalidraw',
            icon: PenTool
          },
          { 
            id: 'script' as ViewMode, 
            label: translateUi('Screenplay', appLanguage),
            icon: FileText
          },
          { 
            id: 'two-column-script' as ViewMode, 
            label: translateUi('Script', appLanguage),
            icon: Columns
          },
        ]
      },
      {
        id: 'pre-production',
        label: translateUi('Pre-Production', appLanguage),
        shortLabel: translateUi('Pre-Pro', appLanguage),
        items: [
          { 
            id: 'casting' as ViewMode, 
            label: translateUi('Casting', appLanguage),
            icon: UsersIcon
          },
          { 
            id: 'breakdown' as ViewMode, 
            label: translateUi('Breakdown', appLanguage),
            icon: Layers
          },
          { 
            id: 'continuity' as ViewMode, 
            label: translateUi('Continuity', appLanguage),
            icon: Clock
          },
          { 
            id: 'crew' as ViewMode, 
            label: translateUi('Crew', appLanguage),
            icon: ClipboardList
          },
        ]
      },
      {
        id: 'visuals',
        label: translateUi('Visuals', appLanguage),
        shortLabel: translateUi('Visuals', appLanguage),
        items: [
          { 
            id: 'shotlist' as ViewMode, 
            label: translateUi('Shot Division', appLanguage),
            icon: Video
          },
          { 
            id: 'storyboard' as ViewMode, 
            label: translateUi('Storyboard', appLanguage),
            icon: ImageIcon,
            hidden: !isStoryboardFeatureEnabled 
          },
        ].filter(item => !item.hidden)
      },
      {
        id: 'production',
        label: translateUi('Production', appLanguage),
        shortLabel: translateUi('Production', appLanguage),
        items: [
          { 
            id: 'schedule' as ViewMode, 
            label: translateUi('Schedule', appLanguage),
            icon: Calendar
          },
          { 
            id: 'dood' as ViewMode, 
            label: translateUi('DOOD Short', appLanguage) !== 'DOOD Short' ? translateUi('DOOD Short', appLanguage) : 'DOOD',
            icon: CalendarCheck
          },
          { 
            id: 'callsheet' as ViewMode, 
            label: translateUi('Call Sheet', appLanguage),
            icon: Files
          },
        ]
      },
      {
        id: 'studio',
        label: translateUi('Studio', appLanguage),
        shortLabel: translateUi('Studio', appLanguage),
        items: [
          { 
            id: 'documents' as ViewMode, 
            label: translateUi('Documents', appLanguage),
            icon: Folder
          },
          { 
            id: 'statistics' as ViewMode, 
            label: translateUi('Statistics', appLanguage),
            icon: TrendingUp
          },
        ]
      }
    ];
  }, [isStoryboardFeatureEnabled, appLanguage]);

  const allViews = useMemo(() => {
    return navGroups.flatMap(g => g.items);
  }, [navGroups]);



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
      if (isCloudActive && cloudOffline) return "Offline — Saved Locally (will sync when back online)";
      if (isCloudActive) return hasUnsavedChanges ? "Syncing to Production" : "Synced to Production";
      if (fileHandle) return hasUnsavedChanges ? `Save changes to ${fileHandle.name}` : `${fileHandle.name} is up to date`;
      return "Linked to Local Storage (Click to save to disk file)";
  }, [isSaving, showSavedConfirmation, isCloudActive, cloudOffline, hasUnsavedChanges, fileHandle]);

  return (
    <>
      <header className={`w-full h-[42px] bg-[#111] border-b border-[#3d3d3d] flex items-center justify-between px-3.5 shrink-0 z-[500] select-none shadow-[0_2px_10px_rgba(0,0,0,0.3)] font-['Helvetica_Neue',Helvetica,Arial,sans-serif]`}>
        
        {/* LEFT: Cinematic Logo + Grouped Project Strip */}
        <div className="flex items-center gap-3 h-full flex-1">
          {/* Logo */}
          <div 
              className="flex items-center gap-2.5 select-none h-full"
              title={fileHandle ? fileHandle.name : activeProjectName}
          >
              <div className="w-7 h-7 rounded bg-gradient-to-br from-[#222] to-[#111] border border-[#333] flex items-center justify-center shadow-sm relative">
                  <Film size={14} className="text-[#f5a623]" />
              </div>
              
              <div className="flex items-center gap-2 transition-all">
                  <div className="flex flex-col justify-center pt-0.5">
                      <span className="text-[11.5px] font-black tracking-tight text-white uppercase leading-none">
                          {translateUi('Backstage', appLanguage)}
                      </span>
                  </div>
              </div>
          </div>

          {/* BACK & FORWARD NAVIGATION BUTTONS */}
          <div className="flex items-center bg-[#1c1c20] border border-[#383842] rounded-[5px] p-0.5 shrink-0 select-none shadow-sm">
            <button
              type="button"
              onClick={onGoBack}
              disabled={!canGoBack}
              className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                canGoBack
                  ? 'text-gray-200 hover:text-white hover:bg-[#2c2c36] active:scale-95 cursor-pointer'
                  : 'text-gray-600 opacity-30 cursor-not-allowed pointer-events-none'
              }`}
              title={canGoBack ? `Back to ${backViewName || 'Previous Page'} (Alt + ← / Cmd + [)` : 'Back (Alt + ←)'}
              aria-label="Back"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="w-px h-3 bg-[#383842] mx-0.5" />
            <button
              type="button"
              onClick={onGoForward}
              disabled={!canGoForward}
              className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                canGoForward
                  ? 'text-gray-200 hover:text-white hover:bg-[#2c2c36] active:scale-95 cursor-pointer'
                  : 'text-gray-600 opacity-30 cursor-not-allowed pointer-events-none'
              }`}
              title={canGoForward ? `Forward to ${forwardViewName || 'Next Page'} (Alt + → / Cmd + ])` : 'Forward (Alt + →)'}
              aria-label="Forward"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* GROUPED PROJECT & ACTIONS STRIP (Project Switcher, Exit, Inbox, AI) */}
          <div className="bg-[#222] border border-[#3d3d3d] rounded-[4px] flex relative select-none items-center">
            
            {/* Active Project Pill with Switcher Dropdown */}
            <div className="relative flex items-center">
              <div 
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#2a2a2a] cursor-pointer group border-r border-[#333] transition-colors max-w-[260px]"
                  onClick={() => {
                    if (!isRenamingProject) setShowProjectDropdown(prev => !prev);
                  }}
                  title={isShared ? `Shared Project: ${fileHandle ? fileHandle.name : activeProjectName}` : `${activeProjectName} (Click to switch project)`}
              >
                  <Folder size={13} className="text-amber-400 shrink-0" />
                  {isRenamingProject ? (
                      <input
                          type="text"
                          autoFocus
                          value={newProjectNameInput}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setNewProjectNameInput(e.target.value)}
                          onBlur={async () => {
                              setIsRenamingProject(false);
                              const trimmed = newProjectNameInput.trim();
                              if (trimmed && trimmed !== activeProjectName && currentProjectId) {
                                  await renameProject(currentProjectId, trimmed);
                              }
                          }}
                          onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                  setIsRenamingProject(false);
                                  const trimmed = newProjectNameInput.trim();
                                  if (trimmed && trimmed !== activeProjectName && currentProjectId) {
                                      await renameProject(currentProjectId, trimmed);
                                  }
                              } else if (e.key === 'Escape') {
                                  setIsRenamingProject(false);
                              }
                          }}
                          className="bg-black/90 border border-amber-500 text-xs font-bold text-white px-1.5 py-0.5 rounded outline-none w-28 truncate"
                      />
                  ) : (
                      <span className="text-xs font-bold text-white tracking-wide truncate max-w-[130px]">
                          {fileHandle ? fileHandle.name : activeProjectName}
                      </span>
                  )}
                  {isShared ? (
                      <span className="px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded shrink-0">
                          Shared
                      </span>
                  ) : (
                      !isRenamingProject && (
                          <button
                              type="button"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setNewProjectNameInput(fileHandle ? fileHandle.name : activeProjectName);
                                  setIsRenamingProject(true);
                              }}
                              className="opacity-40 hover:opacity-100 hover:text-amber-400 p-0.5 rounded transition-all cursor-pointer"
                              title="Rename Project"
                          >
                              <Pencil size={11} />
                          </button>
                      )
                  )}
                  <ChevronDown size={11} className={`text-gray-400 group-hover:text-amber-400 transition-transform ${showProjectDropdown ? 'rotate-180 text-amber-400' : ''}`} />
              </div>

              {/* Projects Dropdown Menu */}
              {showProjectDropdown && (
                  <div 
                      className="absolute left-0 top-full mt-1.5 w-64 bg-[#14141a] border border-[#333] rounded-xl shadow-2xl py-1.5 z-50 text-left backdrop-blur-md"
                      onClick={(e) => e.stopPropagation()}
                  >
                      <div className="px-3 py-1.5 border-b border-[#282834] flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cloud Projects</span>
                          <span className="text-[10px] text-amber-400 font-semibold">{projectList.length} total</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1">
                          {projectList.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-gray-400 text-center">No other projects found</div>
                          ) : (
                              projectList.map((p) => {
                                  const isCurrent = p.id === currentProjectId;
                                  return (
                                      <button
                                          key={p.id}
                                          type="button"
                                          onClick={() => {
                                              setShowProjectDropdown(false);
                                              if (!isCurrent) selectProject(p.id);
                                          }}
                                          className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-white/5 transition-colors cursor-pointer ${
                                              isCurrent ? 'bg-amber-500/10 text-amber-300 font-bold' : 'text-gray-300'
                                          }`}
                                      >
                                          <div className="truncate flex-1">
                                              <div className="text-xs truncate">{p.name || 'Untitled Screenplay'}</div>
                                              <div className="text-[9px] text-gray-400">
                                                  {p.isInvited ? `Shared by ${p.invitedBy || 'Team'}` : 'Cloud Project'}
                                              </div>
                                          </div>
                                          {isCurrent && <Check size={13} className="text-amber-400 shrink-0" />}
                                      </button>
                                  );
                              })
                          )}
                      </div>
                      <div className="px-2 pt-1 border-t border-[#282834]">
                          <button
                              type="button"
                              onClick={() => {
                                  setShowProjectDropdown(false);
                                  closeProject();
                                  window.dispatchEvent(new CustomEvent('backstage:show-welcome'));
                              }}
                              className="w-full px-2.5 py-1.5 text-center text-[11px] font-semibold text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                          >
                              Open Studio Hub / New Project...
                          </button>
                      </div>
                  </div>
              )}
            </div>

            {/* Inbox Button */}
            <button
                onClick={() => onViewChange('inbox')}
                className={`relative px-3 py-1.5 flex items-center justify-center transition-all border-r border-[#333] cursor-pointer ${
                    currentView === 'inbox'
                    ? 'bg-[#333] text-[#f5a623]'
                    : 'text-gray-400 hover:text-[#f5a623] hover:bg-[#2a2a2a]'
                }`}
                title={translateUi('Inbox', appLanguage)}
            >
                <Inbox size={14} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-black text-black bg-[#f5a623] rounded-full shadow-[0_0_8px_rgba(245,166,35,0.8)] animate-pulse">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Ask Anything (AI Assistant) */}
            <button
                onClick={() => onAskAnything?.()}
                disabled={!aiAvailable}
                className="px-3 py-1.5 flex items-center gap-1.5 text-[#f5a623] hover:bg-[#2a2a2a] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={translateUi('Ask Anything (AI Assistant)', appLanguage)}
            >
                <Sparkles size={14} className="fill-[#f5a623]/30" />
                <span className="text-[11px] font-black uppercase tracking-wider">AI</span>
            </button>
          </div>
        </div>

        {/* CENTER: Grouped View Switcher in Original Connected Strip */}
        <div className="flex items-center justify-center gap-[15px] h-full flex-[0_0_auto]">
          {!hideViewSwitcher ? (
            <div ref={navContainerRef} className="bg-[#222] border border-[#3d3d3d] rounded-[4px] flex relative select-none">
              {navGroups.map((group, groupIdx) => {
                const isActiveGroup = group.items.some(i => i.id === currentView);
                const activeItemInGroup = group.items.find(i => i.id === currentView);
                const isOpen = openGroupId === group.id;
                const isLast = groupIdx === navGroups.length - 1;

                return (
                  <div key={group.id} className="relative flex">
                    <button
                      type="button"
                      onClick={() => setOpenGroupId(isOpen ? null : group.id)}
                      onMouseEnter={() => {
                        if (openGroupId && openGroupId !== group.id) {
                          setOpenGroupId(group.id);
                        }
                      }}
                      className={`bg-transparent border-none px-3.5 py-1.5 cursor-pointer text-[12px] font-semibold uppercase transition-all duration-200 flex items-center gap-1.5 ${
                        !isLast ? 'border-r border-[#333]' : ''
                      } ${
                        isActiveGroup
                          ? 'bg-[#333] text-[#f5a623]'
                          : 'text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a]'
                      }`}
                      title={`${group.label}: Click to switch page`}
                    >
                      <span>
                        {isActiveGroup && activeItemInGroup
                          ? `${group.shortLabel}: ${activeItemInGroup.label}`
                          : group.shortLabel}
                      </span>
                      <ChevronDown 
                        size={11} 
                        className={`transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#f5a623]' : isActiveGroup ? 'text-[#f5a623]/80' : 'opacity-60'
                        }`} 
                      />
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                      <div 
                        className={`absolute top-full mt-1 min-w-[190px] bg-[#222] border border-[#3d3d3d] rounded-[4px] shadow-[0_12px_30px_rgba(0,0,0,0.7)] z-[600] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
                          group.id === 'production' || group.id === 'studio' 
                            ? 'right-0' 
                            : 'left-0'
                        }`}
                      >
                        {group.items.map((item) => {
                          const isItemActive = currentView === item.id;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                onViewChange(item.id);
                                setOpenGroupId(null);
                              }}
                              className={`w-full px-3.5 py-2 text-left text-[12px] font-semibold uppercase transition-all duration-150 cursor-pointer flex items-center justify-between border-b border-[#2d2d2d] last:border-b-0 ${
                                isItemActive
                                  ? 'bg-[#333] text-[#f5a623]'
                                  : 'text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a]'
                              }`}
                            >
                              <span>{item.label}</span>
                              {isItemActive && (
                                <Check size={12} className="text-[#f5a623] shrink-0 ml-2 stroke-[2.5]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 bg-[#1a1a1e] border border-[#333] rounded-[4px]">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">{translateUi('Active View:', appLanguage)}</span>
              <span className="text-[12px] font-black uppercase tracking-wider" style={{ color: appAccentColor || '#f5a623' }}>
                {allViews.find(v => v.id === currentView)?.label || (currentView as string).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* RIGHT: Grouped Tools (Undo/Redo, Goal, Theme, Settings) & User */}
        <div className="flex items-center justify-end gap-[10px] h-full flex-1">
          
          {/* GROUPED TOOLS STRIP */}
          <div className="flex bg-[#222] border border-[#3d3d3d] rounded-[4px] overflow-hidden select-none">
            {/* Undo */}
            <button 
                onClick={undo}
                disabled={!canUndo}
                className={`px-3 py-1.5 flex items-center justify-center transition-all border-r border-[#333] ${!canUndo ? 'text-[#444] cursor-not-allowed' : 'text-[#888] hover:text-white hover:bg-[#2a2a2a]'}`}
                title={translateUi('Undo (Ctrl+Z)', appLanguage)}
            >
                <RotateCcw size={14} />
            </button>
            
            {/* Redo */}
            <button 
                onClick={redo}
                disabled={!canRedo}
                className={`px-3 py-1.5 flex items-center justify-center transition-all border-r border-[#333] ${!canRedo ? 'text-[#444] cursor-not-allowed' : 'text-[#888] hover:text-white hover:bg-[#2a2a2a]'}`}
                title={translateUi('Redo (Ctrl+Y)', appLanguage)}
            >
                <RotateCw size={14} />
            </button>

            {/* Goal Progress */}
            <button 
              onClick={() => onViewChange('goals')}
              className={`relative px-3 py-1.5 flex items-center justify-center transition-all border-r border-[#333] cursor-pointer overflow-hidden ${
                currentView === 'goals'
                  ? 'bg-[#333] text-[#f5a623]'
                  : writingGoal.isActive 
                      ? 'text-gray-300 hover:bg-[#2a2a2a]' 
                      : 'text-[#888] hover:text-[#ccc] hover:bg-[#2a2a2a]'
              }`}
              title={writingGoal.isActive && progressDisplay ? `${translateUi('Goal Progress:', appLanguage)} ${progressDisplay.current}/${progressDisplay.target} ${progressDisplay.unit} (${progressDisplay.percent}%) — ${progressDisplay.label}` : translateUi('Set Deadline / Writing Goal', appLanguage)}
            >
              {/* Progress Bar Background */}
              {writingGoal.isActive && progressDisplay && (
                <div 
                  className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ease-out pointer-events-none ${
                    progressDisplay.showTotal
                      ? (progressDisplay.isDone ? 'bg-green-500/30' : 'bg-[#f5a623]/30') 
                      : 'bg-blue-600/40' 
                  }`}
                  style={{ width: `${progressDisplay.percent}%` }}
                />
              )}

              {writingGoal.isActive && progressDisplay ? (
                <div className={`z-10 ${
                  progressDisplay.showTotal
                    ? (progressDisplay.isDone ? 'text-green-500' : 'text-[#f5a623]') 
                    : 'text-blue-400'
                }`}>
                  {progressDisplay.isDone ? <CheckCircle2 size={14} /> : (progressDisplay.showTotal ? <Target size={14} /> : <TrendingUp size={14} />)}
                </div>
              ) : (
                <Clock size={14} className="z-10" />
              )}
            </button>

            {/* Theme Toggle Button */}
            <div className="px-2.5 py-1.5 flex items-center justify-center border-r border-[#333] hover:bg-[#2a2a2a] transition-all">
              <ThemeToggleButton variant="header" size={14} />
            </div>

            {/* Settings Gear Button */}
            <button
              onClick={() => onOpenSettings?.()}
              className="px-3 py-1.5 flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#2a2a2a] transition-all cursor-pointer"
              title={translateUi('Open Backstage Settings Panel', appLanguage)}
            >
              <Settings size={14} />
            </button>
          </div>

          {/* CLOUD / USER MENU */}
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="relative w-8 h-8 rounded-full flex items-center justify-center transition-all focus:outline-none shrink-0 cursor-pointer"
              title={isCloudActive ? `Signed in as ${currentUser}` : 'Sign in'}
            >
              {supabaseUser?.user_metadata?.avatar_url ? (
                <img
                  src={supabaseUser.user_metadata.avatar_url}
                  alt="Profile"
                  className={`w-8 h-8 rounded-full object-cover border-2 ${isOnline ? 'border-green-500' : 'border-yellow-500'}`}
                />
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black bg-gradient-to-br from-[#f5a623] to-[#ffb73c] text-black border-2 ${isOnline ? 'border-green-500' : 'border-yellow-500'}`}>
                  {currentUser ? currentUser.charAt(0).toUpperCase() : <User size={14} />}
                </div>
              )}
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-[900]" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-11 z-[901] w-64 bg-[#161616] border border-[#333] rounded-xl shadow-2xl overflow-hidden">
                  {currentUser ? (
                    <>
                      <div className="px-4 py-3 border-b border-[#2a2a2a]">
                        <div className={`text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5 ${
                          isCloudActive ? (cloudOffline ? 'text-amber-500' : 'text-emerald-500') : 'text-gray-400'
                        }`}>
                          {isCloudActive ? (cloudOffline ? <WifiOff size={11} /> : <Cloud size={11} />) : <CloudOff size={11} />}
                          {isCloudActive ? (cloudOffline ? 'Offline — Saved Locally' : 'Cloud Sync Active') : 'Local Writer Profile'}
                        </div>
                        <div className="text-[13px] font-semibold text-white truncate">{currentUser}</div>
                        <div className="text-[10px] text-gray-500">
                          {isCloudActive
                            ? (cloudOffline ? 'Network down — edits saved to disk & local storage. Will auto-sync when back online.' : 'Projects are backed up & synced')
                            : 'Working locally on this device.'}
                        </div>
                      </div>
                      <button
                        onClick={() => { setShowUserMenu(false); onOpenSettings ? onOpenSettings() : setIsInviteModalOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-amber-500 hover:bg-amber-500/10 border-b border-[#2a2a2a] transition-colors"
                      >
                        <UsersIcon size={13} /> Project Collaboration
                      </button>
                      {!isCloudActive && onOpenAuth && (
                        <button
                          onClick={() => { setShowUserMenu(false); onOpenAuth(); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#f5a623] hover:bg-[#f5a623]/10 border-b border-[#2a2a2a] transition-colors"
                        >
                          <LogIn size={13} /> Sign In / Cloud Account
                        </button>
                      )}
                      <button
                        onClick={async () => { setShowUserMenu(false); await logout(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut size={13} /> Sign Out
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-3 border-b border-[#2a2a2a]">
                        <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-1.5">
                          <CloudOff size={11} /> Guest / Local Mode
                        </div>
                        <div className="text-[10px] text-gray-500 leading-relaxed">
                          Working on this device only. Sign in to save and sync across devices.
                        </div>
                      </div>
                      <button
                        onClick={() => { setShowUserMenu(false); onOpenSettings ? onOpenSettings() : setIsInviteModalOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-amber-500 hover:bg-amber-500/10 border-b border-[#2a2a2a] transition-colors"
                      >
                        <UsersIcon size={13} /> Project Collaboration
                      </button>
                      <button
                        onClick={() => { setShowUserMenu(false); onOpenAuth?.(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#f5a623] hover:bg-[#f5a623]/10 transition-colors"
                      >
                        <LogIn size={13} /> Sign In
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* AI Scene Generator Popup Modal */}
      <AISceneGeneratorModal 
        isOpen={isAiModalOpen} 
        onClose={() => setIsAiModalOpen(false)} 
      />

      {/* Project Invite & Collaboration Modal */}
      <InviteManagerModal 
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </>
  );
};

export default AppHeader;
