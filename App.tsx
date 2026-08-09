
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { AiKeyStatusProvider } from './context/AiKeyStatusContext';
import AppHeader from './components/AppHeader';
import BoardView from './components/views/BoardView';
import ScriptView from './components/views/ScriptView';
import CastingView from './components/views/CastingView';
import CharacterDesignView from './components/views/CharacterDesignView';
import StoryboardView from './components/views/StoryboardView';
import ScheduleView from './components/views/ScheduleView';
import StatisticsView from './components/views/StatisticsView';
import BackstageView from './components/views/BackstageView';
import GoalView from './components/views/GoalView';
import BreakdownView from './components/views/BreakdownView';
import CrewView from './components/views/CrewView';
import ShotListView from './components/views/ShotListView';
import ContinuityView from './components/views/ContinuityView';
import EditorModal from './components/EditorModal';
import PrintPreviewModal from './components/PrintPreviewModal';
import NewProjectModal from './components/NewProjectModal';
import WelcomeScreen from './components/WelcomeScreen';
import AuthScreen from './components/AuthScreen';
import InboxModal, { DEFAULT_INBOX_TASKS } from './components/InboxModal';
import InboxView from './components/views/InboxView';
import { AIAssistantModal } from './components/AIAssistantModal';
import RoleSelectorModal from './components/RoleSelectorModal';
import { ViewMode, ScriptConfig, AppTask, ProjectState } from './types';
import { INITIAL_STATE } from './constants';
import { Loader2, Film, Cloud } from 'lucide-react';
import { isTauri, getTauriFs, getTauriDialog } from './utils/desktop';
import { getRecentFiles, addRecentFile, RecentFile } from './utils/recentFiles';
import { isSupabaseConfigured } from './services/supabase';

const StyleInjector: React.FC = () => {
  const { scriptConfig, scratchpadConfig, appTheme, appAccentColor } = useProject();
  const { blockBounds, paperTheme, slugline } = scriptConfig;

  useEffect(() => {
    const accent = appAccentColor || '#f5a623';
    
    // Set --app-accent globally on document element and body
    document.documentElement.style.setProperty('--app-accent', accent);
    document.body.style.setProperty('--app-accent', accent);
    
    // Apply app theme class to body/html
    const isLight = appTheme === 'light' || (appTheme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
    if (isLight) {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }

    const styleId = 'dynamic-script-styling';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    // Script Element Variables
    const elements = ['action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'lyrics'] as const;
    const elementVars = elements.map(el => {
      const conf = scriptConfig[el];
      return `
        --margin-${el}: ${conf.marginLeft}%;
        --width-${el}: ${conf.width}%;
        --mt-${el}: ${conf.marginTop}rem;
        --mb-${el}: ${conf.marginBottom}rem;
        --size-${el}: ${conf.fontSize}px;
        --font-${el}: '${conf.fontFamily}', "Courier Prime", monospace;
        --align-${el}: ${conf.textAlign};
        --lh-${el}: ${conf.lineHeight};
        --ls-${el}: ${conf.letterSpacing}px;
        --weight-${el}: ${conf.bold ? 'bold' : 'normal'};
        --style-${el}: ${conf.italic ? 'italic' : 'normal'};
        --dec-${el}: ${conf.underline ? 'underline' : 'none'};
        --color-${el}: ${conf.color};
        --bg-${el}: ${conf.highlightColor || 'transparent'};
      `;
    }).join('\n');

    // Slugline Variables
    const slugVars = `
        --size-slug: ${slugline.fontSize}px;
        --font-slug: '${slugline.fontFamily}', "Courier Prime", monospace;
        --align-slug: ${slugline.textAlign};
        --lh-slug: ${slugline.lineHeight};
        --ls-slug: ${slugline.letterSpacing}px;
        --weight-slug: ${slugline.bold ? 'bold' : 'normal'};
        --style-slug: ${slugline.italic ? 'italic' : 'normal'};
        --dec-slug: ${slugline.underline ? 'underline' : 'none'};
        --color-slug: ${slugline.color};
        --bg-slug: ${slugline.paddingEnabled ? (slugline.highlightColor || 'rgba(0,0,0,0.05)') : 'transparent'};
        --padding-v-slug: ${slugline.paddingEnabled ? slugline.paddingVertical + 'px' : '0px'};
        --padding-h-slug: ${slugline.paddingEnabled ? slugline.paddingHorizontal + 'px' : '0px'};
        --mt-slug: ${slugline.marginTop}rem;
        --mb-slug: ${slugline.marginBottom}rem;
    `;

    // Scratchpad Variables
    const spVars = `
        --sp-h1-color: ${scratchpadConfig.h1Color};
        --sp-h2-color: ${scratchpadConfig.h2Color};
        --sp-bold-color: ${scratchpadConfig.boldColor};
        --sp-italic-color: ${scratchpadConfig.italicColor};
        --sp-list-marker: ${scratchpadConfig.listMarkerColor};
        --sp-h1-deco: ${scratchpadConfig.h1Underline ? 'underline' : 'none'};
        --sp-h2-deco: ${scratchpadConfig.h2Underline ? 'underline' : 'none'};
        --sp-h1-style: ${scratchpadConfig.h1Italic ? 'italic' : 'normal'};
        --sp-h2-style: ${scratchpadConfig.h2Italic ? 'italic' : 'normal'};
        --sp-callout-bg: ${scratchpadConfig.calloutBackground};
        --sp-callout-border: ${scratchpadConfig.calloutBorder};
        --sp-todo-border: ${scratchpadConfig.todoBorder};
        --sp-todo-check: ${scratchpadConfig.todoCheckColor};
    `;

    // Theme Colors
    let themeCss = '';
    if (paperTheme === 'dark') themeCss = '--bg-paper: #1a1a1a; --text-paper: #e5e5e5; --accent-paper: #2a2a2a;';
    else if (paperTheme === 'sepia') themeCss = '--bg-paper: #fdf6e3; --text-paper: #586e75; --accent-paper: #eee8d5;';
    else if (paperTheme === 'red') themeCss = '--bg-paper: #000000; --text-paper: #ff5555; --accent-paper: #111111;';
    else themeCss = '--bg-paper: #ffffff; --text-paper: #000000; --accent-paper: #e5e7eb;';

    // Layout Visualization
    const color = blockBounds.color || '#f5a623';
    const opacity = (blockBounds.opacity || 10) / 100;
    const outline = blockBounds.outlineStyle !== 'none' ? `1px ${blockBounds.outlineStyle} ${color}` : 'none';
    const selector = blockBounds.mode === 'all' ? '.sc-line' : '.sc-active-block';

    let funStyles = '';
    if (blockBounds.funMode === 'blueprint') {
        funStyles = `background-color: rgba(0, 50, 150, ${opacity}) !important; border: 1px dashed rgba(255,255,255,0.4) !important; box-shadow: inset 0 0 10px rgba(0,0,0,0.2) !important;`;
    } else if (blockBounds.funMode === 'cyber') {
        funStyles = `background-color: rgba(20, 20, 20, ${opacity}) !important; border: 1px solid ${color} !important; box-shadow: 0 0 8px ${color}, inset 0 0 4px ${color} !important;`;
    } else if (blockBounds.funMode === 'glass') {
        funStyles = `background-color: rgba(255, 255, 255, ${opacity}) !important; backdrop-filter: blur(4px) !important; border: 1px solid rgba(255,255,255,0.3) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;`;
    } else {
        funStyles = `background-color: ${color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')} !important; outline: ${outline} !important;`;
    }

    styleEl.innerHTML = `
      :root {
        --app-accent: ${accent};
        ${elementVars}
        ${slugVars}
        ${spVars}
        ${themeCss}
      }
      .light-theme {
        color-scheme: light;
      }
      .dark-theme {
        color-scheme: dark;
      }
      ${blockBounds.enabled ? `${selector} { ${funStyles} transition: all 0.2s ease; }` : ''}
      .sc-active-block { position: relative; z-index: 1; }
      .sc-paper-preview { background-color: var(--bg-paper) !important; color: var(--text-paper) !important; transition: background-color 0.3s ease; }
      
      .sc-line.sc-slugline {
        padding: var(--padding-v-slug) var(--padding-h-slug);
        background-color: var(--bg-slug);
        margin-top: var(--mt-slug);
        margin-bottom: var(--mb-slug);
        font-family: var(--font-slug);
        font-size: var(--size-slug);
        text-align: var(--align-slug);
        line-height: var(--lh-slug);
        letter-spacing: var(--ls-slug);
        font-weight: var(--weight-slug);
        font-style: var(--style-slug);
        text-decoration: var(--dec-slug);
        color: var(--color-slug);
      }
    `;
  }, [scriptConfig, scratchpadConfig, appTheme, appAccentColor]);

  return null;
};

const AppContent: React.FC = () => {
  console.log('[probe] AppContent mounted, supabase user =', useProject ? 'n/a' : 'n/a');
  const { currentUser, currentProjectId, undo, redo, isInitialLoading, saveProject, saveProjectAs, loadProject, closeProject, setAppTheme, filePath, setFilePath, supabaseUser, isCloudMode, logout, selectProject, deleteProject, projectList, userRole, updateUserRole } = useProject();
  const [currentView, setCurrentView] = useState<ViewMode>('board');
  const [openBeatIds, setOpenBeatIds] = useState<number[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() => getRecentFiles());
  const [refreshKey, setRefreshKey] = useState(0);
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
    if (!userRole || userRole.length === 0) return;
    if (userRole.includes('director') || userRole.includes('producer') || userRole.includes('ad')) return;

    const allowed = new Set<string>();
    if (userRole.includes('writer')) {
      allowed.add('board');
      allowed.add('script');
      allowed.add('casting');
    }
    if (userRole.includes('cinematographer')) {
      allowed.add('board');
      allowed.add('shotlist');
      allowed.add('storyboard');
      allowed.add('schedule');
    }

    if (!allowed.has(currentView)) {
      setCurrentView('board');
    }
  }, [userRole, currentView]);

  const showAuth = isSupabaseConfigured && !supabaseUser;

  // Open a project file from an absolute path (native menu "Open File..." / recent files / welcome screen)
  const openPath = useCallback(async (path: string): Promise<boolean> => {
    try {
      const fs = await getTauriFs();
      if (!fs) return false;
      const content = await fs.readTextFile(path);
      loadProject(JSON.parse(content));
      setFilePath(path);
      setRecentFiles(addRecentFile(path));
      return true;
    } catch (err) {
      console.error("Failed to open project file", err);
      return false;
    }
  }, [loadProject, setFilePath]);

  // Open a project file from disk (native menu "Open File...")
  // Guarded so macOS double-delivered menu events can't stack/reopen the picker.
  const fileDialogOpenRef = useRef(false);
  const handleMenuOpenFile = useCallback(async () => {
    if (fileDialogOpenRef.current) return;
    fileDialogOpenRef.current = true;
    try {
      const dialog = await getTauriDialog();
      if (!dialog) return;
      const selected = await dialog.open({
        filters: [{ name: 'Backstage File', extensions: ['bst', 'json'] }],
        multiple: false,
      });
      if (selected) {
        const ok = await openPath(selected as string);
        if (ok) setShowWelcome(false);
      }
    } catch (err) {
      console.error("Failed to open project file", err);
    } finally {
      fileDialogOpenRef.current = false;
    }
  }, [openPath]);

  // Create a brand new blank script file: prompt for Finder location/name, write it, open it.
  const handleMenuNewFile = useCallback(async () => {
    if (fileDialogOpenRef.current) return;
    fileDialogOpenRef.current = true;
    try {
      const dialog = await getTauriDialog();
      if (!dialog) return;
      const selected = await dialog.save({
        filters: [{ name: 'Backstage File', extensions: ['bst'] }],
        defaultPath: 'Untitled.bst',
      });
      if (!selected) return;
      const fresh: ProjectState = { ...INITIAL_STATE };
      const fs = await getTauriFs();
      if (fs) {
        await fs.writeTextFile(selected, JSON.stringify(fresh, null, 2));
      }
      loadProject(fresh);
      setFilePath(selected);
      setRecentFiles(addRecentFile(selected));
      setShowWelcome(false);
    } catch (err) {
      console.error("Failed to create new project file", err);
    } finally {
      fileDialogOpenRef.current = false;
    }
  }, [loadProject, setFilePath]);

  const handleMenuCheckForUpdates = useCallback(async () => {
    try {
      const dialog = await getTauriDialog();
      if (!dialog) return;
      const { getVersion } = await import('@tauri-apps/api/app');
      const version = await getVersion();
      await dialog.message(`You're up to date! You are running version ${version}.`, {
        title: "Check for Updates",
        kind: "info",
      });
    } catch (err) {
      console.error("Failed to check for updates", err);
    }
  }, []);

  // Native menu bar events (File, View, Theme, App menu)
  const lastMenuEventRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      if (cancelled) return;
      unlisten = await listen('menu-click', async (event: any) => {
        const id = event.payload as string;
        const now = Date.now();
        if (lastMenuEventRef.current.id === id && now - lastMenuEventRef.current.time < 400) return;
        lastMenuEventRef.current = { id, time: now };
        switch (id) {
          case 'new-project': {
            if (isTauri()) await handleMenuNewFile();
            else setShowNewProject(true);
            break;
          }
          case 'save-file': {
            if (filePath) saveProject();
            else await saveProjectAs();
            break;
          }
          case 'save-as-file': {
            if (fileDialogOpenRef.current) break;
            fileDialogOpenRef.current = true;
            try { await saveProjectAs(); } finally { fileDialogOpenRef.current = false; }
            break;
          }
          case 'open-file': await handleMenuOpenFile(); break;
          case 'print-file': setShowPrintPreview(true); break;
          case 'close-project': closeProject(); setShowWelcome(true); break;
          case 'theme-dark': setAppTheme('dark'); break;
          case 'theme-light': setAppTheme('light'); break;
          case 'theme-system': setAppTheme('system'); break;
          case 'check-for-updates': await handleMenuCheckForUpdates(); break;
          default: break;
        }
      });
    })();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [saveProject, saveProjectAs, handleMenuOpenFile, handleMenuNewFile, handleMenuCheckForUpdates, closeProject, setAppTheme, filePath]);

  // Central Inbox State
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [inboxTasks, setInboxTasks] = useState<AppTask[]>(() => {
    try {
      const saved = localStorage.getItem('app_inbox_tasks');
      return saved ? JSON.parse(saved) : DEFAULT_INBOX_TASKS;
    } catch (e) {
      return DEFAULT_INBOX_TASKS;
    }
  });

  // Save tasks to localStorage when updated
  const handleUpdateTask = (updatedTask: AppTask) => {
    setInboxTasks(prev => {
      const next = prev.map(t => t.id === updatedTask.id ? updatedTask : t);
      localStorage.setItem('app_inbox_tasks', JSON.stringify(next));
      return next;
    });
  };

  const handleAddTask = (newTask: AppTask) => {
    setInboxTasks(prev => {
      const next = [newTask, ...prev];
      localStorage.setItem('app_inbox_tasks', JSON.stringify(next));
      return next;
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setInboxTasks(prev => {
      const next = prev.filter(t => t.id !== taskId);
      localStorage.setItem('app_inbox_tasks', JSON.stringify(next));
      return next;
    });
  };

  // Global Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmd = isMac ? e.metaKey : e.ctrlKey;

        if (cmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        if ((cmd && e.key.toLowerCase() === 'y') || (cmd && e.shiftKey && e.key.toLowerCase() === 'z')) {
            e.preventDefault();
            redo();
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [undo, redo]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const handleEditBeat = (id: number) => {
      setOpenBeatIds(prev => {
          if (prev.includes(id)) return [...prev.filter(i => i !== id), id];
          return [...prev, id];
      });
  };

  const handleCloseBeat = (id: number) => {
      setOpenBeatIds(prev => prev.filter(i => i !== id));
  };

  const handleFocusBeat = (id: number) => {
      setOpenBeatIds(prev => {
          if (prev.length === 0 || prev[prev.length - 1] === id) return prev;
          return [...prev.filter(i => i !== id), id];
      });
  };

  if (isInitialLoading) {
      return (
          <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center font-sans">
              <div className="relative mb-8">
                  <div className="w-16 h-16 bg-[#111] border border-white/10 rounded-2xl flex items-center justify-center animate-pulse">
                      <Film className="text-[#f5a623]" size={32} />
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin text-gray-600" size={14} />
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Restoring Session...</span>
              </div>
          </div>
      );
  }

  if (!isOnline && !supabaseUser) {
      return (
          <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center font-sans px-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <Cloud className="text-red-500 animate-pulse" size={32} />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Internet Connection Required</h1>
              <p className="text-sm text-gray-400 max-w-sm mb-6 leading-relaxed">
                  Backstage is currently offline. You can only use the application offline if you have already signed in. Please connect to the internet to sign in and activate offline mode.
              </p>
              <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Loader2 className="animate-spin text-gray-600" size={12} />
                  <span className="text-gray-500">Waiting for network connection...</span>
              </div>
          </div>
      );
  }

  if (showAuth) {
      return (
          <>
              <StyleInjector />
              <AuthScreen />
          </>
      );
  }

  if (userRole === null) {
      return (
          <>
              <StyleInjector />
              <RoleSelectorModal onSelectRoles={(roles) => updateUserRole(roles)} />
          </>
      );
  }

  if (showWelcome) {
      return (
          <WelcomeScreen
              recents={recentFiles}
              onNew={() => {
                  if (isTauri()) handleMenuNewFile();
                  else { setShowNewProject(true); setShowWelcome(false); }
              }}
              onOpen={() => handleMenuOpenFile()}
              onOpenRecent={async (path) => {
                  const ok = await openPath(path);
                  if (ok) setShowWelcome(false);
              }}
              onDismiss={() => setShowWelcome(false)}
              isCloudMode={isCloudMode}
              currentUser={currentUser}
              cloudProjects={projectList}
              onOpenCloudProject={(id) => { selectProject(id); setShowWelcome(false); }}
              onDeleteCloudProject={(id) => { if (supabaseUser) deleteProject(id); }}
              onOpenAuth={() => {}}
          />
      );
  }

  return (
    <>
      <StyleInjector />
      <div className="print:hidden">
        <AppHeader 
            currentView={currentView} 
            onViewChange={setCurrentView}
            onRefresh={handleRefresh}
            onPrint={() => setShowPrintPreview(true)}
            onOpenInbox={() => setIsInboxOpen(true)}
            unreadCount={inboxTasks.filter(t => !t.isRead).length}
            onOpenAuth={() => {}}
            onAskAnything={() => setShowAssistant(true)}
        />
      </div>
      
      <main className={`w-full relative print:hidden print:mt-0 print:h-auto overflow-y-auto overflow-x-hidden h-[calc(100vh-50px)] mt-[50px]`}>
        {currentView === 'board' && <div className="w-full h-full"><BoardView key={`board-${refreshKey}`} onEditBeat={handleEditBeat} /></div>}
        {currentView === 'script' && <ScriptView key={`script-${refreshKey}`} onNavigateToView={(v) => setCurrentView(v)} />}
        {currentView === 'casting' && <div className="w-full h-full"><CastingView key={`casting-${refreshKey}`} onNavigateToView={(v) => setCurrentView(v)} /></div>}
        {currentView === 'characterdesign' && <CharacterDesignView key={`characterdesign-${refreshKey}`} onNavigateToView={(v) => setCurrentView(v)} />}
        {currentView === 'breakdown' && <div className="w-full h-full"><BreakdownView key={`breakdown-${refreshKey}`} /></div>}
        {currentView === 'continuity' && <div className="w-full h-full"><ContinuityView key={`continuity-${refreshKey}`} /></div>}
        {currentView === 'crew' && (
          <div className="w-full h-full">
            <CrewView 
              key={`crew-${refreshKey}`} 
              allTasks={inboxTasks}
              onUpdateTask={handleUpdateTask}
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
            />
          </div>
        )}
        {currentView === 'shotlist' && <div className="w-full h-full"><ShotListView key={`shotlist-${refreshKey}`} onNavigateToStoryboard={() => setCurrentView('storyboard')} /></div>}
        {currentView === 'storyboard' && <div className="w-full h-full"><StoryboardView key={`story-${refreshKey}`} /></div>}
        {currentView === 'schedule' && <div className="w-full h-full"><ScheduleView key={`schedule-${refreshKey}`} /></div>}
        {currentView === 'statistics' && <div className="w-full h-full"><StatisticsView key={`stats-${refreshKey}`} /></div>}
        {currentView === 'backstage' && <div className="w-full h-full"><BackstageView key={`backstage-${refreshKey}`} onNavigateToBoard={() => setCurrentView('board')} /></div>}
        {currentView === 'goals' && <div className="w-full h-full"><GoalView key={`goals-${refreshKey}`} /></div>}
        {currentView === 'inbox' && <div className="w-full h-full"><InboxView key={`inbox-${refreshKey}`} tasks={inboxTasks} onNavigateToView={setCurrentView} onUpdateTask={handleUpdateTask} onAddTask={handleAddTask} onDeleteTask={handleDeleteTask} /></div>}
        {!['board', 'script', 'casting', 'characterdesign', 'characters', 'breakdown', 'continuity', 'crew', 'shotlist', 'storyboard', 'schedule', 'statistics', 'backstage', 'inbox', 'goals'].includes(currentView) && (
          <div className="w-full h-full"><BoardView key={`fallback-${refreshKey}`} onEditBeat={handleEditBeat} /></div>
        )}
      </main>

      {currentView === 'board' && (
        <div className="fixed inset-0 pointer-events-none z-[1000] overflow-hidden">
            {openBeatIds.map((id, index) => (
              <div key={id} className="pointer-events-auto absolute" style={{ zIndex: 1000 + index }}>
                  <EditorModal 
                    beatId={id} 
                    onClose={() => handleCloseBeat(id)} 
                    onFocus={() => handleFocusBeat(id)}
                    initialOffset={index * 30}
                    onViewInScript={() => {
                      handleCloseBeat(id);
                      setCurrentView('script');
                    }}
                  />
              </div>
            ))}
        </div>
      )}

      {showPrintPreview && (
        <PrintPreviewModal onClose={() => setShowPrintPreview(false)} />
      )}

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} />
      )}




      <InboxModal
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
        onNavigateToView={setCurrentView}
        tasks={inboxTasks}
        onUpdateTask={handleUpdateTask}
        onAddTask={handleAddTask}
        onDeleteTask={handleDeleteTask}
      />

      <AIAssistantModal isOpen={showAssistant} onClose={() => setShowAssistant(false)} />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ProjectProvider>
      <AiKeyStatusProvider>
        <AppContent />
      </AiKeyStatusProvider>
    </ProjectProvider>
  );
};

export default App;
