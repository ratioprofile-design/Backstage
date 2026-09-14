import React, { useMemo, useState, useEffect } from 'react';
import { ViewMode } from '../types';
import { useProject } from '../context/ProjectContext';
import {
  Film, LayoutGrid, FileText, Users, Layers, Clock, Video, Image as ImageIcon,
  Calendar, CalendarCheck, Files, ClipboardList, TrendingUp,
  PanelLeftClose, PanelLeft, Settings, Sun, Moon, Sparkles, Inbox,
  RotateCcw, RotateCw, Target, CheckCircle2, Check, PenTool, SlidersHorizontal,
  User, Cloud, CloudOff, Wifi, WifiOff, LogOut, LogIn, Users as UsersIcon
} from 'lucide-react';
import { useAiKeyStatus } from '../context/AiKeyStatusContext';
import { InviteManagerModal } from './InviteManagerModal';

interface AppSidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings?: () => void;
  onOpenInbox?: () => void;
  unreadCount?: number;
  onAskAnything?: () => void;
  onPrint?: () => void;
  onOpenAuth?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentView,
  onViewChange,
  isCollapsed,
  onToggleCollapse,
  onOpenSettings,
  onOpenInbox,
  unreadCount = 0,
  onAskAnything,
  onOpenAuth
}) => {
  const {
    isStoryboardFeatureEnabled, writingGoal, dailyStats, beats,
    projectList, currentProjectId, fileHandle,
    undo, redo, canUndo, canRedo,
    appTheme, setAppTheme, appAccentColor = '#f5a623',
    navLayout, setNavLayout,
    hasUnsavedChanges, isSaving, currentUser, isCloudMode,
    cloudOffline, supabaseUser, logout
  } = useProject();

  const { aiAvailable } = useAiKeyStatus();
  const isLight = appTheme === 'light';

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  useEffect(() => {
    if (!isSaving && !hasUnsavedChanges) {
      setShowSavedConfirmation(true);
      const timer = setTimeout(() => setShowSavedConfirmation(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, hasUnsavedChanges]);

  const activeProjectName = useMemo(() => {
    const proj = projectList.find(p => p.id === currentProjectId);
    return proj ? proj.name : 'SEQUENCER';
  }, [projectList, currentProjectId]);

  const isCloudActive = isCloudMode;

  const navItems = useMemo(() => {
    const list = [
      { id: 'board' as ViewMode, label: 'Beats DAW', icon: SlidersHorizontal },
      { id: 'excalidraw' as ViewMode, label: 'Excalidraw', icon: PenTool },
      { id: 'script' as ViewMode, label: 'Script', icon: FileText },
      { id: 'casting' as ViewMode, label: 'Casting & Roster', icon: Users },
      { id: 'breakdown' as ViewMode, label: 'Breakdown', icon: Layers },
      { id: 'continuity' as ViewMode, label: 'Continuity', icon: Clock },
      { id: 'crew' as ViewMode, label: 'Crew', icon: Users },
      { id: 'shotlist' as ViewMode, label: 'Shot Division', icon: Video },
      { id: 'storyboard' as ViewMode, label: 'Storyboard', icon: ImageIcon, hidden: !isStoryboardFeatureEnabled },
      { id: 'schedule' as ViewMode, label: 'Production Plan', icon: Calendar },
      { id: 'dood' as ViewMode, label: 'DOOD', icon: CalendarCheck },
      { id: 'documents' as ViewMode, label: 'Vault', icon: Files },
      { id: 'callsheet' as ViewMode, label: 'Call Sheet', icon: ClipboardList },
      { id: 'statistics' as ViewMode, label: 'Statistics', icon: TrendingUp },
    ];
    return list.filter(item => !item.hidden);
  }, [isStoryboardFeatureEnabled]);

  // Live Goal Progress Calculation
  const progressDisplay = useMemo(() => {
    if (!writingGoal || !writingGoal.isActive) return null;
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
    const percent = Math.min(100, Math.round((currentTotal / (targetTotal || 1)) * 100));
    return { percent, isDone: currentTotal >= targetTotal };
  }, [writingGoal, beats]);

  return (
    <>
      <aside
        className={`no-print shrink-0 flex flex-col h-screen select-none z-40 transition-all duration-300 border-r ${
          isLight
            ? 'bg-white border-gray-200 text-gray-800'
            : 'bg-[#111114] border-[#26262a] text-gray-200'
        }`}
        style={{
          width: isCollapsed ? '64px' : '230px'
        }}
      >
        {/* Brand Header */}
        <div
          className={`h-[50px] px-3 flex items-center border-b transition-all ${
            isLight ? 'border-gray-200 bg-gray-50/50' : 'border-[#26262a] bg-[#0c0c0e]'
          } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
        >
          {!isCollapsed ? (
            <div
              onClick={() => onViewChange('backstage')}
              className="flex items-center gap-2.5 cursor-pointer group min-w-0 flex-1 mr-2"
              title="Open Backstage Settings"
            >
              <div
                className="w-7 h-7 rounded flex items-center justify-center shrink-0 border transition-all"
                style={{
                  backgroundColor: `${appAccentColor}15`,
                  borderColor: `${appAccentColor}40`
                }}
              >
                <Film size={15} style={{ color: appAccentColor }} className="group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-black uppercase tracking-tight truncate group-hover:text-amber-400 transition-colors">
                  Backstage
                </span>
                <span
                  className="text-[8px] font-mono uppercase tracking-widest truncate font-semibold"
                  style={{ color: appAccentColor }}
                >
                  {fileHandle ? fileHandle.name : activeProjectName}
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onViewChange('backstage')}
              className="w-8 h-8 rounded flex items-center justify-center border transition-all group"
              style={{
                backgroundColor: `${appAccentColor}15`,
                borderColor: `${appAccentColor}40`
              }}
              title="Backstage Settings"
            >
              <Film size={16} style={{ color: appAccentColor }} className="group-hover:scale-110 transition-transform" />
            </button>
          )}

          {/* Collapse / Expand Toggle Button */}
          {!isCollapsed && (
            <button
              onClick={onToggleCollapse}
              className={`p-1.5 rounded transition-colors ${
                isLight
                  ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                  : 'text-gray-400 hover:text-white hover:bg-[#222]'
              }`}
              title="Collapse Sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {/* When collapsed: expand button at top of list */}
        {isCollapsed && (
          <div className="py-2 flex justify-center border-b border-[#26262a]/50">
            <button
              onClick={onToggleCollapse}
              className={`p-1.5 rounded transition-colors ${
                isLight
                  ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                  : 'text-gray-400 hover:text-white hover:bg-[#222]'
              }`}
              title="Expand Sidebar"
            >
              <PanelLeft size={16} />
            </button>
          </div>
        )}

        {/* Main Navigation List */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5 custom-scrollbar">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md transition-all duration-150 relative group ${
                  isCollapsed ? 'justify-center' : 'justify-start text-left'
                } ${
                  isActive
                    ? isLight
                      ? 'bg-amber-50 font-bold shadow-sm'
                      : 'font-bold shadow-sm'
                    : isLight
                      ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-[#1a1a1e]'
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: isLight ? `${appAccentColor}18` : `${appAccentColor}18`,
                        color: appAccentColor
                      }
                    : {}
                }
              >
                {/* Active Left Indicator Pill */}
                {isActive && (
                  <div
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r"
                    style={{ backgroundColor: appAccentColor }}
                  />
                )}

                <Icon
                  size={16}
                  className={`shrink-0 transition-transform ${
                    isActive ? 'scale-105' : 'group-hover:scale-105'
                  }`}
                  style={isActive ? { color: appAccentColor } : {}}
                />

                {!isCollapsed && (
                  <span className="text-[12px] uppercase font-semibold tracking-wide truncate flex-1">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Utility Bar */}
        <div
          className={`pt-2 pb-2.5 px-2 border-t space-y-2 ${
            isLight ? 'border-gray-200 bg-gray-50/70' : 'border-[#26262a] bg-[#0c0c0e]'
          }`}
        >
          {/* Action Icons Row (Inbox, Ask Anything, Goal, Theme, Undo/Redo, Settings) */}
          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1.5' : 'justify-between gap-1'} px-0.5`}>
            {/* INBOX */}
            <button
              onClick={() => onOpenInbox?.()}
              className={`relative p-1.5 rounded-lg transition-colors ${
                currentView === 'inbox'
                  ? 'text-amber-400 bg-amber-500/10'
                  : isLight
                    ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/80'
                    : 'text-gray-400 hover:text-white hover:bg-[#1e1e24]'
              }`}
              title="Production Inbox"
            >
              <Inbox size={15} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[9px] font-black text-black bg-[#f5a623] rounded-full animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* ASK ANYTHING */}
            <button
              onClick={() => onAskAnything?.()}
              disabled={!aiAvailable}
              className={`p-1.5 rounded-lg transition-colors ${
                isLight
                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                  : 'text-[#f5a623] hover:text-amber-300 hover:bg-[#252018]'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              title="Ask Anything (AI Assistant)"
            >
              <Sparkles size={15} />
            </button>

            {/* WRITING GOAL */}
            <button
              onClick={() => onViewChange('goals')}
              className={`p-1.5 rounded-lg transition-colors ${
                currentView === 'goals'
                  ? 'text-amber-400 bg-amber-500/10'
                  : isLight
                    ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/80'
                    : 'text-gray-400 hover:text-white hover:bg-[#1e1e24]'
              }`}
              title="Goals & Deadlines"
            >
              {progressDisplay?.isDone ? (
                <CheckCircle2 size={15} className="text-emerald-400" />
              ) : (
                <Target size={15} style={progressDisplay ? { color: appAccentColor } : {}} />
              )}
            </button>

            {/* THEME TOGGLE */}
            <button
              onClick={() => setAppTheme(appTheme === 'light' ? 'dark' : 'light')}
              className={`p-1.5 rounded-lg transition-colors ${
                isLight
                  ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/80'
                  : 'text-gray-400 hover:text-white hover:bg-[#1e1e24]'
              }`}
              title={`Switch to ${appTheme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {appTheme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            {/* UNDO / REDO (expanded view) */}
            {!isCollapsed && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="p-1 rounded text-gray-400 hover:text-white disabled:text-gray-600 disabled:hover:text-gray-600 transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  <RotateCcw size={13} />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="p-1 rounded text-gray-400 hover:text-white disabled:text-gray-600 disabled:hover:text-gray-600 transition-colors"
                  title="Redo (Ctrl+Y)"
                >
                  <RotateCw size={13} />
                </button>
              </div>
            )}

            {/* SETTINGS GEAR */}
            <button
              onClick={() => onOpenSettings?.()}
              className={`p-1.5 rounded-lg transition-colors ${
                isLight
                  ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/80'
                  : 'text-gray-400 hover:text-white hover:bg-[#1e1e24]'
              }`}
              title="Settings & Preferences"
            >
              <Settings size={15} />
            </button>
          </div>

          {/* USER ACCOUNT & CLOUD STATUS ROW */}
          <div className="pt-2 border-t border-[#26262a]/60 relative">
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-1' : 'justify-between px-2 py-1.5'
              } rounded-md transition-colors ${
                isLight ? 'hover:bg-gray-100' : 'hover:bg-[#1a1a1e]'
              }`}
              title={isCloudActive ? `Signed in as ${currentUser}` : 'Account & Cloud'}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative shrink-0">
                  {supabaseUser?.user_metadata?.avatar_url ? (
                    <img
                      src={supabaseUser.user_metadata.avatar_url}
                      alt="Profile"
                      className={`w-6 h-6 rounded-full object-cover border ${
                        isOnline ? 'border-green-500' : 'border-yellow-500'
                      }`}
                    />
                  ) : (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black bg-gradient-to-br from-[#f5a623] to-[#ffb73c] text-black border ${
                      isOnline ? 'border-green-500' : 'border-yellow-500'
                    }`}>
                      {currentUser ? currentUser.charAt(0).toUpperCase() : <User size={12} />}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black ${
                      isOnline ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                  />
                </div>

                {!isCollapsed && (
                  <div className="flex flex-col text-left min-w-0 flex-1">
                    <span className="text-[11px] font-semibold truncate">
                      {currentUser || 'Local User'}
                    </span>
                    <span className="text-[9px] font-mono text-gray-400 truncate flex items-center gap-1">
                      {isCloudActive ? (
                        cloudOffline ? <><WifiOff size={8} /> Offline</> : <><Cloud size={8} className="text-emerald-400" /> Synced</>
                      ) : (
                        <><CloudOff size={8} /> Local Mode</>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </button>

            {/* Dropdown Menu Popup */}
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-[900]" onClick={() => setShowUserMenu(false)} />
                <div className="absolute left-full bottom-2 ml-2 z-[901] w-64 bg-[#161616] border border-[#333] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {isCloudActive ? (
                    <>
                      <div className="px-4 py-3 border-b border-[#2a2a2a]">
                        <div className={`text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5 ${
                          cloudOffline ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                          {cloudOffline ? <WifiOff size={11} /> : <Cloud size={11} />}
                          {cloudOffline ? 'Offline — Saved Locally' : 'Cloud Sync Active'}
                        </div>
                        <div className="text-[13px] font-semibold text-white truncate">{currentUser || 'Cloud User'}</div>
                        <div className="text-[10px] text-gray-500">
                          {cloudOffline ? 'Network down — edits saved locally.' : 'Projects are backed up & synced'}
                        </div>
                      </div>
                      <button
                        onClick={() => { setShowUserMenu(false); setIsInviteModalOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-amber-500 hover:bg-amber-500/10 border-b border-[#2a2a2a] transition-colors"
                      >
                        <UsersIcon size={13} /> Project Collaboration
                      </button>
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
                          <CloudOff size={11} /> Local Mode
                        </div>
                        <div className="text-[10px] text-gray-500 leading-relaxed">
                          Working on this device. Sign in to sync across devices.
                        </div>
                      </div>
                      <button
                        onClick={() => { setShowUserMenu(false); setIsInviteModalOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-amber-500 hover:bg-amber-500/10 border-b border-[#2a2a2a] transition-colors"
                      >
                        <UsersIcon size={13} /> Project Collaboration
                      </button>
                      <button
                        onClick={() => { setShowUserMenu(false); onOpenAuth?.(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#f5a623] hover:bg-[#f5a623]/10 transition-colors"
                      >
                        <LogIn size={13} /> Sign In to Cloud
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Project Collaboration Modal */}
      <InviteManagerModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </>
  );
};
