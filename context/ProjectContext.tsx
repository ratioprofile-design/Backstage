
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect, useSyncExternalStore } from 'react';
import { 
  ProjectState, ProjectContextType, Beat, Group, Connection, Annotation, 
  CharacterData, Shot, Note, ScriptConfig, ScratchpadConfig, StoryboardConfig, 
  WritingGoal, ProjectMetadata, BeatStatus, BeatVersion,
  BoardLayer, TimelineTrack, ThemeAnimationStyle, ArtistOption, CloudSyncStatus
} from '../types';
import { INITIAL_STATE } from '../constants';
import { supabase, upsertProject, fetchProjectData, fetchUserProjects, fetchInvitedProjects, isSupabaseConfigured, renameCloudProject } from '../services/supabase';
import { createAuto5ScenesDataset, createAutoScenesDataset } from '../services/sampleGenerator';
import { isTauri, getTauriFs, getTauriDialog, getTauriWindow } from '../utils/desktop';
import { isCausalityData, parseCausalityProject } from '../services/causalityParser';
import { getProductionDocuments, saveProductionDocuments, mergeProductionDocuments, syncDocumentsWithCloud, loadProductionDocumentsAsync, flushDocumentPersistence, flushCloudSaves } from '../services/documentsStorage';
import { saveProjectToRustDisk, loadProjectFromRustDisk, listRustLocalProjects } from '../services/localRustStorage';
import { saveLargeProject, loadLargeProject, loadLargeDocuments } from '../services/largeStorage';
import { optimizeTalentForCloud } from '../services/imageOptimizer';
import { addRecentFile } from '../utils/recentFiles';
import { SaveQueue, projectIsLocal, savedProjectMetadata, newestProjectSnapshot, shallowEqual } from '../utils/projectPersistence';
import { ProjectConflictError } from '../services/projectSync';
import { createProjectStore } from './projectStore';

const ProjectContext = (typeof window !== 'undefined' && (window as any).__BACKSTAGE_PROJECT_CONTEXT__)
  ? (window as any).__BACKSTAGE_PROJECT_CONTEXT__
  : createContext<ReturnType<typeof createProjectStore> | undefined>(undefined);

if (typeof window !== 'undefined') {
  (window as any).__BACKSTAGE_PROJECT_CONTEXT__ = ProjectContext;
}

// Generate a unique ID for this specific running instance (Web vs Electron)
const INSTANCE_ID = Math.random().toString(36).substring(2, 15);

const countWords = (html: string) => {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    if (text.length === 0) return 0;
    return text.split(/\s+/).filter(w => w.length > 0).length;
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth State: Auto-discover session if Supabase has stored tokens in localStorage
  const getStoredSupabaseUser = () => {
    if (typeof localStorage === 'undefined') return null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            const user = parsed?.user || parsed?.currentSession?.user;
            if (user) return user;
          }
        }
      }
    } catch {}
    return null;
  };

  const initialSupabaseUser = getStoredSupabaseUser();
  const [supabaseUser, setSupabaseUser] = useState<any>(initialSupabaseUser);
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (initialSupabaseUser?.email) return initialSupabaseUser.email;
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem('currentUser');
    if (stored && stored !== 'Default User') return stored;
    try { localStorage.removeItem('currentUser'); } catch {}
    return null;
  });
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(() => localStorage.getItem('currentProjectId') || 'empty-project');
  const activeProjectRef = useRef(currentProjectId);
  const setCurrentProjectId = useCallback((id: string | null) => {
    activeProjectRef.current = id;
    setCurrentProjectIdState(id);
  }, []);
  const editRevisionRef = useRef(0);
  const hasUnsavedChangesRef = useRef(false);
  const saveQueue = useRef(new SaveQueue());
  const latestSaveRef = useRef<() => Promise<void>>(async () => {});
  const cloudVersionsRef = useRef(new Map<string, string>());
  const cloudConflictRef = useRef(new Set<string>());
  const projectSelectionRef = useRef(0);
  const historyNeedsResetRef = useRef(true);
  const [saveRetry, setSaveRetry] = useState(0);

  const [currentProjectName, setCurrentProjectName] = useState<string>(() => {
    const curId = typeof localStorage !== 'undefined' ? (localStorage.getItem('currentProjectId') || 'empty-project') : 'empty-project';
    return typeof localStorage !== 'undefined' ? (localStorage.getItem(`project_name_${curId}`) || '') : '';
  });
  const [projectList, setProjectList] = useState<ProjectMetadata[]>(() => {
    try {
      const raw = localStorage.getItem('projectList');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    // Auto-discover existing local projects/scripts if projectList is empty
    const discovered: ProjectMetadata[] = [];
    const curId = typeof localStorage !== 'undefined' ? (localStorage.getItem('currentProjectId') || 'empty-project') : 'empty-project';
    const curName = typeof localStorage !== 'undefined' ? (localStorage.getItem(`project_name_${curId}`) || 'My Screenplay') : 'My Screenplay';
    discovered.push({
      id: curId,
      name: curName,
      created: Date.now(),
      lastModified: Date.now()
    });

    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('project_name_')) {
            const pId = key.replace('project_name_', '');
            if (pId && pId !== curId && !discovered.some(p => p.id === pId)) {
              const pName = localStorage.getItem(key) || 'Untitled Screenplay';
              discovered.push({
                id: pId,
                name: pName,
                created: Date.now() - 86400000,
                lastModified: Date.now() - 3600000
              });
            }
          }
        }
      } catch (e) {}
    }
    return discovered;
  });
  const [hasUnsavedChanges, setDirtyState] = useState(false);
  const setHasUnsavedChanges = useCallback((dirty: boolean) => {
    if (dirty) editRevisionRef.current++;
    hasUnsavedChangesRef.current = dirty;
    setDirtyState(dirty);
  }, []);
  const [isSaving, setIsSavingState] = useState(false);
  const isSavingRef = useRef(false);
  const setIsSaving = (saving: boolean) => { isSavingRef.current = saving; setIsSavingState(saving); };
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [projectLoadingMessage, setProjectLoadingMessage] = useState<string>('');
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [cloudOffline, setCloudOffline] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>({
    isUploading: false,
    progress: 100,
    status: 'idle',
    message: 'Synced',
    lastSyncedAt: null,
  });
  const [userRole, setUserRole] = useState<('writer' | 'director' | 'producer' | 'ad' | 'cinematographer')[] | null>(() => {
    const raw = localStorage.getItem('user_role');
    if (!raw) return ['writer'];
    try {
      return JSON.parse(raw);
    } catch {
      return [raw as any];
    }
  });

  useEffect(() => {
    if (supabaseUser) {
      const role = supabaseUser.user_metadata?.role;
      if (role) {
        const parsed = Array.isArray(role) ? role : [role];
        setUserRole(parsed);
        try { localStorage.setItem('user_role', JSON.stringify(parsed)); } catch {}
      }
    }
  }, [supabaseUser]);

  const updateUserRole = useCallback(async (roles: ('writer' | 'director' | 'producer' | 'ad' | 'cinematographer')[]) => {
    setUserRole(roles);
    try { localStorage.setItem('user_role', JSON.stringify(roles)); } catch {}
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.updateUser({
          data: { role: roles }
        });
      }
    }
  }, [supabaseUser]);

  
  const [fileHandle, setFileHandle] = useState<any | null>(null);
  const fileHandleRef = useRef<any>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const filePathRef = useRef<string | null>(null);
  const initialHydrationDoneRef = useRef(false);
  const isExplicitLogoutRef = useRef(false);

  const setFilePathWrapped = useCallback((path: string | null) => {
    filePathRef.current = path;
    setFilePath(path);
  }, []);

  const setFileHandleWrapped = useCallback((handle: any) => {
    fileHandleRef.current = handle;
    setFileHandle(handle);
  }, []);

  // Intercept window close in Tauri if there are unsaved changes
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    
    async function setupCloseIntercept() {
      const tauriWin = await getTauriWindow();
      const tauriDialog = await getTauriDialog();
      if (tauriWin && tauriDialog) {
        const currentWindow = tauriWin.getCurrentWindow() as any;
        unlisten = await currentWindow.onCloseRequest(async (event: any) => {
          if (hasUnsavedChangesRef.current) {
            event.preventDefault();
            const confirmClose = await tauriDialog.ask(
              "You have unsaved changes. Are you sure you want to exit?",
              { title: "Unsaved Changes", kind: "warning" }
            );
            if (confirmClose) {
              await currentWindow.destroy();
            }
          }
        });
      }
    }
    
    setupCloseIntercept();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Use refs for sync flags to avoid re-triggering effects
  const isRemoteUpdateRef = useRef(false); // Flag to prevent remote data from triggering "unsaved changes"
  const isImportingRef = useRef(false); // Flag to prevent window focus from wiping freshly imported projects
  const cloudOfflineRef = useRef(false);
  const realtimeChannelRef = useRef<any>(null);

  // Update refs when state changes
  useEffect(() => { cloudOfflineRef.current = cloudOffline; }, [cloudOffline]);

  // --- PROJECT STATE ---
  const [beats, setBeats] = useState<Beat[]>(INITIAL_STATE.beats);
  const [groups, setGroups] = useState<Group[]>(INITIAL_STATE.groups);
  const [connections, setConnections] = useState<Connection[]>(INITIAL_STATE.connections);
  const [annotations, setAnnotations] = useState<Annotation[]>(INITIAL_STATE.annotations);
  const [characterData, setCharacterData] = useState<Record<string, CharacterData>>(INITIAL_STATE.characterData);
  const [generatedShots, setGeneratedShots] = useState<Shot[]>(INITIAL_STATE.generatedShots);
  const [scratchpad, setScratchpad] = useState<string>(INITIAL_STATE.scratchpad);
  const [globalNotes, setGlobalNotes] = useState<Note[]>(INITIAL_STATE.globalNotes);
  const [panX, setPanX] = useState(INITIAL_STATE.panX);
  const [panY, setPanY] = useState(INITIAL_STATE.panY);
  const [scale, setScale] = useState(INITIAL_STATE.scale);
  const [nextId, setNextId] = useState(INITIAL_STATE.nextId);
  const [nextAnnoId, setNextAnnoId] = useState(INITIAL_STATE.nextAnnoId);
  const [activeBoardId, setActiveBoardId] = useState(INITIAL_STATE.activeBoardId);
  const [isTamilMode, setTamilMode] = useState(INITIAL_STATE.isTamilMode);
  const [tamilFontScale, setTamilFontScale] = useState(INITIAL_STATE.tamilFontScale);
  const [tamilFontFamily, setTamilFontFamily] = useState<string>(() => {
    if (typeof localStorage === 'undefined') return INITIAL_STATE.tamilFontFamily;
    return localStorage.getItem('user_pref_tamil_font') || INITIAL_STATE.tamilFontFamily;
  });
  const [userDictionary, setUserDictionary] = useState(INITIAL_STATE.userDictionary);
  const [isOsInputMode, setOsInputMode] = useState(INITIAL_STATE.isOsInputMode);
  const [osInputShortcut, setOsInputShortcut] = useState(INITIAL_STATE.osInputShortcut);
  const [scriptConfig, setScriptConfig] = useState<ScriptConfig>(() => {
    const base = INITIAL_STATE.scriptConfig;
    if (typeof localStorage === 'undefined') return base;
    const userGlobalFont = localStorage.getItem('user_pref_script_font');
    const elements = ['action', 'dialogue', 'character', 'parenthetical', 'transition', 'shot', 'lyrics', 'slugline'] as const;
    const res = { ...base };
    elements.forEach(elm => {
      const pref = localStorage.getItem(`user_pref_font_${elm}`) || userGlobalFont;
      if (pref && (res as any)[elm]) {
        (res as any)[elm] = { ...(res as any)[elm], fontFamily: pref };
      }
    });
    return res;
  });
  const [scriptViewMode, setScriptViewMode] = useState<'continuous' | 'page'>(INITIAL_STATE.scriptViewMode);
  const [scratchpadConfig, setScratchpadConfig] = useState<ScratchpadConfig>(INITIAL_STATE.scratchpadConfig);
  const [storyboardConfig, setStoryboardConfig] = useState<StoryboardConfig>(INITIAL_STATE.storyboardConfig);
  const [isStoryboardFeatureEnabled, setStoryboardFeatureEnabled] = useState(INITIAL_STATE.isStoryboardFeatureEnabled);
  const [breakdownLanguage, setBreakdownLanguage] = useState<'english' | 'tamil'>(INITIAL_STATE.breakdownLanguage);
  const [breakdownLockedOnly, setBreakdownLockedOnly] = useState(INITIAL_STATE.breakdownLockedOnly);
  const [isPdfDropEnabled, setPdfDropEnabled] = useState(INITIAL_STATE.isPdfDropEnabled);
  const [isRedoEnabled, setRedoEnabled] = useState(INITIAL_STATE.isRedoEnabled);
  const [writingGoal, setWritingGoal] = useState<WritingGoal>(INITIAL_STATE.writingGoal);
  const [openrouterKey, setOpenrouterKey] = useState(INITIAL_STATE.openrouterKey);
  const [grokKey, setGrokKey] = useState<string | null>(() => {
    return localStorage.getItem('grok_api_key') || '';
  });
  const [generalAiModel, setGeneralAiModel] = useState(INITIAL_STATE.generalAiModel);
  const [dailyStats, setDailyStats] = useState(INITIAL_STATE.dailyStats);
  const [sessionStartCount, setSessionStartCount] = useState(INITIAL_STATE.sessionStartCount);
  const [lastSessionDate, setLastSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [boardLayerOrder, setBoardLayerOrder] = useState<BoardLayer[]>(INITIAL_STATE.boardLayerOrder);
  const [characterDesignLocked, setCharacterDesignLocked] = useState(INITIAL_STATE.characterDesignLocked);
  const [collaborators, setCollaborators] = useState<any[]>(INITIAL_STATE.collaborators || []);
  const [talentPool, setTalentPool] = useState<ArtistOption[]>(INITIAL_STATE.talentPool || []);

  // App Appearance & Customization State
  const [appTheme, setAppThemeState] = useState<'dark' | 'light' | 'system'>(() => {
    return (localStorage.getItem('app_theme') as any) || INITIAL_STATE.appTheme || 'dark';
  });
  const [appAccentColor, setAppAccentColorState] = useState<string>(() => {
    return localStorage.getItem('app_accent') || INITIAL_STATE.appAccentColor || '#f5a623';
  });
  const [appLanguage, setAppLanguageState] = useState<'english' | 'tamil' | 'spanish' | 'french' | 'german'>(() => {
    const saved = localStorage.getItem('app_language');
    if (saved === 'hindi') return 'english';
    return (saved as any) || INITIAL_STATE.appLanguage || 'english';
  });

  const [themeAnimationStyle, setThemeAnimationStyleState] = useState<ThemeAnimationStyle>(() => {
    return (localStorage.getItem('app_theme_animation') as ThemeAnimationStyle) || INITIAL_STATE.themeAnimationStyle || 'instant';
  });
  const themeAnimationStyleRef = useRef(themeAnimationStyle);
  useEffect(() => { themeAnimationStyleRef.current = themeAnimationStyle; }, [themeAnimationStyle]);

  const setThemeAnimationStyle = useCallback((style: ThemeAnimationStyle) => {
    themeAnimationStyleRef.current = style;
    setThemeAnimationStyleState(style);
    try { localStorage.setItem('app_theme_animation', style); } catch {}
  }, []);

  const [appZoomLevel, setAppZoomLevelState] = useState<number>(() => {
    if (typeof localStorage === 'undefined') return 1.0;
    const saved = localStorage.getItem('app_zoom_level');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 1.5 && parsed !== 0.8) return parsed;
    }
    return INITIAL_STATE.appZoomLevel || 1.0;
  });

  const setAppZoomLevel = useCallback((zoom: number) => {
    const clamped = Math.min(Math.max(zoom, 0.5), 1.5);
    setAppZoomLevelState(clamped);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('app_zoom_level', String(clamped)); } catch {}
      if (clamped === 1.0) {
        document.documentElement.style.fontSize = '';
      } else {
        const basePx = Math.round(16 * clamped * 10) / 10;
        document.documentElement.style.fontSize = `${basePx}px`;
      }
      document.documentElement.style.zoom = '';
    }
    setHasUnsavedChanges(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (appZoomLevel === 1.0) {
        document.documentElement.style.fontSize = '';
      } else {
        const basePx = Math.round(16 * appZoomLevel * 10) / 10;
        document.documentElement.style.fontSize = `${basePx}px`;
      }
      document.documentElement.style.zoom = '';
    }
  }, [appZoomLevel]);

  const setAppTheme = useCallback((theme: 'dark' | 'light' | 'system', event?: any) => {
    const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const targetPaper: 'dark' | 'white' = isDark ? 'dark' : 'white';

    const updateThemeState = () => {
      setAppThemeState(theme);
      if (typeof localStorage !== 'undefined') {
        try { localStorage.setItem('app_theme', theme); } catch {}
        try { localStorage.setItem('user_pref_paper_theme', targetPaper); } catch {}
      }

      setScriptConfig(prev => ({
        ...prev,
        paperTheme: targetPaper,
      }));

      // Synchronously update document classes for immediate repaint
      if (typeof document !== 'undefined') {
        if (isDark) {
          document.documentElement.classList.add('dark-theme');
          document.documentElement.classList.remove('light-theme');
          document.body.classList.add('dark-theme');
          document.body.classList.remove('light-theme');
        } else {
          document.documentElement.classList.add('light-theme');
          document.documentElement.classList.remove('dark-theme');
          document.body.classList.add('light-theme');
          document.body.classList.remove('dark-theme');
        }
      }
    };

    const style = themeAnimationStyleRef.current || 'instant';

    // INSTANT SWITCH (DEFAULT): 0ms latency, zero GPU snapshot pauses, no clip-path delays
    if (style === 'instant') {
      updateThemeState();
      return;
    }

    // Check if View Transition API is supported and user hasn't requested reduced motion
    const canViewTransition =
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      typeof (document as any).startViewTransition === 'function' &&
      typeof window !== 'undefined' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canViewTransition) {
      updateThemeState();
      return;
    }

    try {
      // Determine origin coordinates for ripple / focal wipes
      let x = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
      let y = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;

      if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        x = event.clientX;
        y = event.clientY;
      } else if (event?.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
        const rect = event.currentTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }

      const endRadius = typeof window !== 'undefined'
        ? Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
        : 1000;

      let keyframes: Keyframe[] | PropertyIndexedKeyframes = {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`
        ]
      };
      let animOptions: KeyframeAnimationOptions = {
        duration: 360,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        pseudoElement: '::view-transition-new(root)'
      };

      if (style === 'wipe-right') {
        keyframes = {
          clipPath: [
            'polygon(0 0, 0 0, 0 100%, 0 100%)',
            'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
          ]
        };
        animOptions = {
          duration: 340,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          pseudoElement: '::view-transition-new(root)'
        };
      } else if (style === 'wipe-down') {
        keyframes = {
          clipPath: [
            'polygon(0 0, 100% 0, 100% 0, 0 0)',
            'polygon(0 0, 100% 0, 100% 100%, 0 100%)'
          ]
        };
        animOptions = {
          duration: 340,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          pseudoElement: '::view-transition-new(root)'
        };
      } else if (style === 'diagonal') {
        keyframes = {
          clipPath: [
            'polygon(0 0, 0 0, 0 0)',
            'polygon(0 0, 260% 0, 0 260%)'
          ]
        };
        animOptions = {
          duration: 360,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          pseudoElement: '::view-transition-new(root)'
        };
      } else if (style === 'diamond') {
        const maxD = (typeof window !== 'undefined'
          ? Math.max(x, window.innerWidth - x) + Math.max(y, window.innerHeight - y)
          : 1000) * 1.3;
        keyframes = {
          clipPath: [
            `polygon(${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px)`,
            `polygon(${x}px ${y - maxD}px, ${x + maxD}px ${y}px, ${x}px ${y + maxD}px, ${x - maxD}px ${y}px)`
          ]
        };
        animOptions = {
          duration: 380,
          easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
          pseudoElement: '::view-transition-new(root)'
        };
      } else if (style === 'dissolve') {
        keyframes = {
          opacity: [0, 1],
          transform: ['scale(0.99)', 'scale(1)']
        };
        animOptions = {
          duration: 280,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)'
        };
      }

      const transition = (document as any).startViewTransition(() => {
        updateThemeState();
      });

      transition.ready.then(() => {
        document.documentElement.animate(keyframes, animOptions);
      }).catch((err: any) => {
        console.warn('Theme transition animation warning:', err);
      });
    } catch {
      updateThemeState();
    }
  }, []);

    // Listen for OS theme changes when theme is set to 'system'
  useEffect(() => {
    if (appTheme !== 'system' || typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setScriptConfig(prev => ({
        ...prev,
        paperTheme: e.matches ? 'dark' : 'white',
      }));
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [appTheme]);

  const setAppAccentColor = useCallback((color: string) => {
    setAppAccentColorState(color);
    try { localStorage.setItem('app_accent', color); } catch {}
    setHasUnsavedChanges(true);
  }, []);

  const setAppLanguage = useCallback((lang: 'english' | 'tamil' | 'spanish' | 'french' | 'german') => {
    setAppLanguageState(lang);
    try { localStorage.setItem('app_language', lang); } catch {}
    setHasUnsavedChanges(true);
  }, []);

  // Navigation Layout State ('horizontal' | 'vertical')
  const [navLayout, setNavLayoutState] = useState<'horizontal' | 'vertical'>(() => {
    return (localStorage.getItem('app_nav_layout') as any) || INITIAL_STATE.navLayout || 'vertical';
  });

  const setNavLayout = useCallback((layout: 'horizontal' | 'vertical') => {
    setNavLayoutState(layout);
    try { localStorage.setItem('app_nav_layout', layout); } catch {}
    setHasUnsavedChanges(true);
  }, []);

  // Listen for local-mode login events dispatched by AuthScreen (offline mode)
  useEffect(() => {
    const handleLocalLogin = (e: Event) => {
      const name = (e as CustomEvent).detail?.name || 'Screenwriter';
      try { localStorage.setItem('currentUser', name); } catch {}
      setCurrentUser(name);
    };
    window.addEventListener('backstage:local-login', handleLocalLogin);
    return () => window.removeEventListener('backstage:local-login', handleLocalLogin);
  }, []);


  useEffect(() => {
    console.log('[ctx] auth effect running, isSupabaseConfigured=', isSupabaseConfigured);
    if (!isSupabaseConfigured) {
        setIsInitialLoading(false);
        return;
    }

    let isMounted = true;

    // Fast-boot detection: If no OAuth callback is in the URL, release splash immediately (350ms max safety)
    // Low-spec 2-core i5 laptops must never be stuck waiting on network roundtrips before displaying UI!
    const hasOAuth = typeof window !== 'undefined' && (
      (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error'))) ||
      (window.location.search && (window.location.search.includes('code=') || window.location.search.includes('error=')))
    );

    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsInitialLoading(false);
      }
    }, hasOAuth ? 1800 : 350);

    const initAuth = async () => {
      try {
        if (!hasOAuth) {
          // Unblock workspace immediately so low-spec machines have zero startup freeze
          setIsInitialLoading(false);
        }
        // 1. Handle OAuth callback parameters in hash (#access_token=...&refresh_token=...) from Supabase / Google
        if (typeof window !== 'undefined' && window.location.hash) {
          try {
            const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
            const hashParams = new URLSearchParams(rawHash);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const errorParam = hashParams.get('error') || hashParams.get('error_description');

            if (accessToken && refreshToken) {
              console.log('[ctx] Found OAuth access_token in URL hash, establishing session...');
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (data?.session) {
                console.log('[ctx] Session set from URL hash for:', data.session.user.email);
                setSupabaseUser(data.session.user);
                const userEmail = data.session.user.email || 'Cloud User';
                setCurrentUser(userEmail);
                try { localStorage.setItem('currentUser', userEmail); } catch {}
                setCloudOffline(false);
                refreshProjectList(data.session.user.id, data.session.user.email || undefined).catch(e => console.warn('[ctx] refreshProjectList failed:', e));
              }
              window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            } else if (errorParam) {
              console.warn('[ctx] OAuth hash error:', errorParam);
              window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            }
          } catch (hashErr) {
            console.warn('[ctx] Exception parsing OAuth hash:', hashErr);
          }
        }

        // 2. Handle OAuth callback parameters in query string (?code=...) from PKCE flow
        if (typeof window !== 'undefined' && window.location.search) {
          const url = new URL(window.location.href);
          const code = url.searchParams.get('code');
          const errorParam = url.searchParams.get('error') || url.searchParams.get('error_description');

          if (errorParam) {
            console.warn('[ctx] OAuth error in URL search params:', errorParam);
            url.searchParams.delete('error');
            url.searchParams.delete('error_description');
            url.searchParams.delete('error_code');
            window.history.replaceState({}, document.title, url.pathname + (url.search ? '?' + url.searchParams.toString() : ''));
          } else if (code) {
            console.log('[ctx] Exchanging OAuth code for session...');
            try {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (error) {
                console.warn('[ctx] exchangeCodeForSession notice:', error.message);
              } else if (data?.session) {
                console.log('[ctx] OAuth exchange succeeded for:', data.session.user.email);
                setSupabaseUser(data.session.user);
                const userEmail = data.session.user.email || 'Cloud User';
                setCurrentUser(userEmail);
                try { localStorage.setItem('currentUser', userEmail); } catch {}
                setCloudOffline(false);
                refreshProjectList(data.session.user.id, data.session.user.email || undefined).catch(e => console.warn('[ctx] refreshProjectList failed:', e));
              }
            } catch (exchangeErr) {
              console.warn('[ctx] OAuth exchange exception:', exchangeErr);
            } finally {
              url.searchParams.delete('code');
              url.searchParams.delete('state');
              window.history.replaceState({}, document.title, url.pathname + (url.search ? '?' + url.searchParams.toString() : ''));
            }
          }
        }

        // 3. Retrieve or verify active Supabase session
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        clearTimeout(safetyTimer);
        if (!isMounted) return;
        
        if (session) {
          setSupabaseUser(session.user);
          const userEmail = session.user.email || 'Cloud User';
          setCurrentUser(userEmail);
          try { localStorage.setItem('currentUser', userEmail); } catch {}
          setCloudOffline(false);
          refreshProjectList(session.user.id, session.user.email || undefined).catch(e => console.warn('[ctx] refreshProjectList failed:', e));
        } else {
          // Fallback: check if session object exists in localStorage
          const foundUser = getStoredSupabaseUser();
          if (foundUser?.email) {
            setSupabaseUser(foundUser);
            setCurrentUser(foundUser.email);
            try { localStorage.setItem('currentUser', foundUser.email); } catch {}
            setCloudOffline(false);
            refreshProjectList(foundUser.id, foundUser.email).catch(e => console.warn('[ctx] refreshProjectList fallback failed:', e));
          } else {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser && savedUser !== 'Default User') {
              setCurrentUser(savedUser);
            } else {
              try { localStorage.removeItem('currentUser'); } catch {}
              setCurrentUser(null);
            }
          }
        }
      } catch (err) {
        clearTimeout(safetyTimer);
        if (!isMounted) return;
        console.warn('[ctx] getSession notice, checking storage fallback:', err);
        const foundUser = getStoredSupabaseUser();
        if (foundUser?.email) {
          setSupabaseUser(foundUser);
          setCurrentUser(foundUser.email);
          try { localStorage.setItem('currentUser', foundUser.email); } catch {}
          refreshProjectList(foundUser.id, foundUser.email).catch(() => {});
        } else {
          const savedUser = localStorage.getItem('currentUser');
          if (savedUser && savedUser !== 'Default User') {
            setCurrentUser(savedUser);
          } else {
            try { localStorage.removeItem('currentUser'); } catch {}
            setCurrentUser(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[ctx] onAuthStateChange event=', _event, 'session=', session ? `yes ${session.user.email}` : 'no');
      if (session) {
        setSupabaseUser(session.user);
        setCurrentUser(session.user.email || 'Cloud User');
        try { localStorage.setItem('currentUser', session.user.email || 'Cloud User'); } catch {}
        setCloudOffline(false);
        refreshProjectList(session.user.id, session.user.email || undefined).catch(e => console.warn('[ctx] refreshProjectList failed:', e));
      } else {
        setSupabaseUser(null);
        if (_event === 'SIGNED_OUT') {
          if (isExplicitLogoutRef.current) {
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
            setProjectList([]);
          } else {
            console.warn('[ctx] Background transient SIGNED_OUT detected; preserving local session and workspace');
            setCloudOffline(true);
          }
        } else {
          const savedUser = localStorage.getItem('currentUser');
          if (savedUser && savedUser !== 'Default User') {
            setCurrentUser(savedUser);
          } else {
            setCurrentUser(null);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Real-time Cross-Device Project Sync:
  // Auto-sync project list on window focus (e.g. switching between browser and Tauri app)
  // and listen for global project creation/rename/delete broadcasts across Supabase
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let globalChannel: any = null;

    try {
      globalChannel = supabase.channel('global_projects_sync')
        .on('broadcast', { event: 'project_created' }, (_payload: any) => {
          if (supabaseUser) {
            refreshProjectList(supabaseUser.id, supabaseUser.email);
          } else {
            const found = getStoredSupabaseUser();
            if (found?.id) refreshProjectList(found.id, found.email);
          }
        })
        .on('broadcast', { event: 'project_renamed' }, (_payload: any) => {
          if (supabaseUser) {
            refreshProjectList(supabaseUser.id, supabaseUser.email);
          } else {
            const found = getStoredSupabaseUser();
            if (found?.id) refreshProjectList(found.id, found.email);
          }
        })
        .on('broadcast', { event: 'project_deleted' }, (_payload: any) => {
          if (supabaseUser) {
            refreshProjectList(supabaseUser.id, supabaseUser.email);
          } else {
            const found = getStoredSupabaseUser();
            if (found?.id) refreshProjectList(found.id, found.email);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('[ctx] global_projects_sync channel notice:', e);
    }

    const handleWindowFocus = () => {
      if (filePathRef.current || fileHandleRef.current) return;
      const curProj = projectList.find(p => p.id === currentProjectId);
      if (curProj?.isLocalOnly || curProj?.filePath) return;
      if (supabaseUser) {
        refreshProjectList(supabaseUser.id, supabaseUser.email);
      } else {
        const found = getStoredSupabaseUser();
        if (found?.id) refreshProjectList(found.id, found.email);
      }
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      if (globalChannel) {
        try { supabase.removeChannel(globalChannel); } catch {}
      }
    };
  }, [supabaseUser]);

  const applyProjectState = useCallback((data: any, options?: { projectName?: string; targetProjectId?: string; isLocalOnly?: boolean }) => {
    if (!data) return;

    isImportingRef.current = true;

    const isCausality = isCausalityData(data);
    let processedData = data;
    let importedTracks: TimelineTrack[] | undefined = undefined;

    if (isCausality) {
      const parsed = parseCausalityProject(data);
      if (parsed.success && parsed.projectState) {
        processedData = { ...INITIAL_STATE, ...parsed.projectState };
        importedTracks = parsed.tracks;
      } else {
        isImportingRef.current = false;
        alert(parsed.error || "Failed to parse Causality file. Please verify file format.");
        return;
      }
    } else if (Array.isArray(data.tracks) && data.tracks.length > 0) {
      importedTracks = data.tracks;
    }
    
    // Auto-detect and filter out any preloaded demo datasets (never filter user Causality imports)
    const hasDemoBeats = !isCausality && Array.isArray(processedData.beats) && processedData.beats.some((b: any) => 
      (b.title && (b.title.includes('Cyber-Lab') || b.title.includes('Ikaros'))) ||
      (b.content && (b.content.includes('MAYA') && b.content.includes('KALE') && b.content.includes('Ikaros')))
    );

    const cleanData = hasDemoBeats ? INITIAL_STATE : processedData;

    isRemoteUpdateRef.current = true;
    historyNeedsResetRef.current = true;
    const incomingId = options?.targetProjectId || cleanData._projectId || currentProjectId;
    if (incomingId && cleanData._cloudUpdatedAt) {
      cloudVersionsRef.current.set(incomingId, cleanData._cloudUpdatedAt);
      cloudConflictRef.current.delete(incomingId);
    }
    
    const finalTracks = importedTracks || cleanData.tracks;

    // Remove legacy un-namespaced tracks key to prevent cross-project contamination
    try {
      localStorage.removeItem('backstage_daw_tracks');
    } catch (e) {}

    // If this is an imported Causality project or an explicit new project import, register in projectList and switch active ID
    if (isCausality || options?.projectName || options?.targetProjectId) {
      const newProjId = options?.targetProjectId || `proj_${Date.now()}`;
      const projName = options?.projectName || (cleanData as any).projectName || (cleanData as any).name || (isCausality ? 'Imported Causality Story' : 'Screenplay');
      const isLocal = options?.isLocalOnly !== undefined ? options.isLocalOnly : Boolean(filePathRef.current || fileHandleRef.current || !supabaseUser);
      const newMeta: ProjectMetadata = {
        id: newProjId,
        name: projName,
        created: Date.now(),
        lastModified: Date.now(),
        isLocalOnly: isLocal,
        filePath: filePathRef.current || undefined
      };

      setCurrentProjectId(newProjId);
      try {
        localStorage.setItem('currentProjectId', newProjId);
        localStorage.setItem(`project_name_${newProjId}`, projName);
        localStorage.setItem('backstage_project_closed', 'false');
      } catch {}
      
      if (Array.isArray(finalTracks) && finalTracks.length > 0) {
        try {
          localStorage.setItem(`backstage_daw_tracks_${newProjId}`, JSON.stringify(finalTracks));
        } catch (e) {}
      }

      if (Array.isArray(cleanData.causalityLanes) && cleanData.causalityLanes.length > 0) {
        try {
          localStorage.setItem(`causality_lanes_${newProjId}`, JSON.stringify(cleanData.causalityLanes));
        } catch (e) {}
      }

      if (Array.isArray(cleanData.causalityGroups) && cleanData.causalityGroups.length > 0) {
        try {
          localStorage.setItem(`causality_groups_${newProjId}`, JSON.stringify(cleanData.causalityGroups));
        } catch (e) {}
      }

      if (Array.isArray(cleanData.sectionBreaks) && cleanData.sectionBreaks.length > 0) {
        try {
          localStorage.setItem(`causality_breaks_${newProjId}`, JSON.stringify(cleanData.sectionBreaks));
        } catch (e) {}
      }

      // Do NOT dump multi-megabyte project bodies into 5MB localStorage; IndexedDB & Rust disk handle persistence safely
      try {
        localStorage.removeItem(`project_data_${newProjId}`);
      } catch (e) {}

      setProjectList(prev => {
        const updated = [newMeta, ...prev.filter(p => p.id !== newProjId)];
        try { localStorage.setItem('projectList', JSON.stringify(updated)); } catch {}
        return updated;
      });

      if (Array.isArray((cleanData as any).documents) && (cleanData as any).documents.length > 0) {
        saveProductionDocuments((cleanData as any).documents, newProjId, true);
      } else {
        saveProductionDocuments([], newProjId, true);
      }

      // Notify BoardView and other views of the imported project, tracks, and lanes
      window.dispatchEvent(new CustomEvent('project_imported', { 
        detail: { projectId: newProjId, tracks: finalTracks } 
      }));
      window.dispatchEvent(new CustomEvent('daw_tracks_updated', { 
        detail: { projectId: newProjId, tracks: finalTracks } 
      }));
      window.dispatchEvent(new CustomEvent('causality_project_updated', { 
        detail: { projectId: newProjId } 
      }));
    } else if (currentProjectId) {
      if (Array.isArray(finalTracks) && finalTracks.length > 0) {
        try {
          localStorage.setItem(`backstage_daw_tracks_${currentProjectId}`, JSON.stringify(finalTracks));
        } catch (e) {}
      }
      if (Array.isArray(cleanData.causalityLanes) && cleanData.causalityLanes.length > 0) {
        try {
          localStorage.setItem(`causality_lanes_${currentProjectId}`, JSON.stringify(cleanData.causalityLanes));
        } catch (e) {}
      }
      if (Array.isArray(cleanData.causalityGroups) && cleanData.causalityGroups.length > 0) {
        try {
          localStorage.setItem(`causality_groups_${currentProjectId}`, JSON.stringify(cleanData.causalityGroups));
        } catch (e) {}
      }
      if (Array.isArray(cleanData.sectionBreaks) && cleanData.sectionBreaks.length > 0) {
        try {
          localStorage.setItem(`causality_breaks_${currentProjectId}`, JSON.stringify(cleanData.sectionBreaks));
        } catch (e) {}
      }
      window.dispatchEvent(new CustomEvent('project_imported', { 
        detail: { projectId: currentProjectId, tracks: finalTracks } 
      }));
      window.dispatchEvent(new CustomEvent('daw_tracks_updated', { 
        detail: { projectId: currentProjectId, tracks: finalTracks } 
      }));
      window.dispatchEvent(new CustomEvent('causality_project_updated', { 
        detail: { projectId: currentProjectId } 
      }));
    }

    setBeats(Array.isArray(cleanData.beats) ? cleanData.beats : INITIAL_STATE.beats);
    setGroups(Array.isArray(cleanData.groups) ? cleanData.groups : INITIAL_STATE.groups);
    setConnections(Array.isArray(cleanData.connections) ? cleanData.connections : INITIAL_STATE.connections);
    setAnnotations(Array.isArray(cleanData.annotations) ? cleanData.annotations : INITIAL_STATE.annotations);
    setCharacterData(cleanData.characterData && typeof cleanData.characterData === 'object' ? cleanData.characterData : INITIAL_STATE.characterData);
    setGeneratedShots(Array.isArray(cleanData.generatedShots) ? cleanData.generatedShots : INITIAL_STATE.generatedShots);
    setScratchpad(typeof cleanData.scratchpad === 'string' ? cleanData.scratchpad : INITIAL_STATE.scratchpad);
    setGlobalNotes(Array.isArray(cleanData.globalNotes) ? cleanData.globalNotes : INITIAL_STATE.globalNotes);
    setActiveBoardId(cleanData.activeBoardId ?? INITIAL_STATE.activeBoardId);
    
    // Preserve local user's individual font selections when collaborator sync arrives
    const incomingScriptConfig = cleanData.scriptConfig || INITIAL_STATE.scriptConfig;
    const preservedScriptConfig = { ...incomingScriptConfig };
    if (typeof localStorage !== 'undefined') {
      const userGlobalFont = localStorage.getItem('user_pref_script_font');
      const elements = ['action', 'dialogue', 'character', 'parenthetical', 'transition', 'shot', 'lyrics', 'slugline'] as const;
      elements.forEach(elm => {
        const userFont = localStorage.getItem(`user_pref_font_${elm}`) || userGlobalFont;
        if (userFont && preservedScriptConfig[elm]) {
          preservedScriptConfig[elm] = {
            ...preservedScriptConfig[elm],
            fontFamily: userFont
          };
        }
      });
      const userPaper = localStorage.getItem('user_pref_paper_theme');
      if (userPaper && ['white', 'dark', 'sepia', 'red'].includes(userPaper)) {
        preservedScriptConfig.paperTheme = userPaper as any;
      }
    }
    setScriptConfig(preservedScriptConfig);
    setScriptViewMode(cleanData.scriptViewMode || INITIAL_STATE.scriptViewMode);
    setScratchpadConfig(cleanData.scratchpadConfig || INITIAL_STATE.scratchpadConfig);
    setStoryboardConfig(cleanData.storyboardConfig || INITIAL_STATE.storyboardConfig);
    setGeneralAiModel(cleanData.generalAiModel || INITIAL_STATE.generalAiModel);
    setWritingGoal(cleanData.writingGoal || INITIAL_STATE.writingGoal);
    setBoardLayerOrder(cleanData.boardLayerOrder || INITIAL_STATE.boardLayerOrder);
    setTamilMode(cleanData.isTamilMode ?? INITIAL_STATE.isTamilMode);
    const userTamilFont = typeof localStorage !== 'undefined' ? localStorage.getItem('user_pref_tamil_font') : null;
    setTamilFontFamily(userTamilFont || cleanData.tamilFontFamily || INITIAL_STATE.tamilFontFamily);
    setPdfDropEnabled(cleanData.isPdfDropEnabled ?? INITIAL_STATE.isPdfDropEnabled);
    setRedoEnabled(cleanData.isRedoEnabled ?? INITIAL_STATE.isRedoEnabled);
    setNextId(cleanData.nextId ?? INITIAL_STATE.nextId);
    setNextAnnoId(cleanData.nextAnnoId ?? INITIAL_STATE.nextAnnoId);
    setDailyStats(cleanData.dailyStats || INITIAL_STATE.dailyStats);
    setCharacterDesignLocked(cleanData.characterDesignLocked ?? INITIAL_STATE.characterDesignLocked);
    setCollaborators(cleanData.collaborators || INITIAL_STATE.collaborators || []);
    setTalentPool(Array.isArray(cleanData.talentPool) ? cleanData.talentPool : INITIAL_STATE.talentPool || []);
    
    // Preserve local user theme preference so polling/sync never overrides user's chosen theme
    const localUserTheme = typeof localStorage !== 'undefined' ? (localStorage.getItem('app_theme') as 'dark' | 'light' | 'system' | null) : null;
    if (localUserTheme) {
      setAppThemeState(localUserTheme);
    } else if (cleanData.appTheme) {
      setAppThemeState(cleanData.appTheme);
      try { if (typeof localStorage !== 'undefined') localStorage.setItem('app_theme', cleanData.appTheme); } catch {}
    }
    if (cleanData.appAccentColor) setAppAccentColorState(cleanData.appAccentColor);
    if (cleanData.appLanguage) setAppLanguageState(cleanData.appLanguage);
    if (cleanData.themeAnimationStyle) {
      setThemeAnimationStyleState(cleanData.themeAnimationStyle);
      try { localStorage.setItem('app_theme_animation', cleanData.themeAnimationStyle); } catch {}
    }
    if (cleanData.navLayout) {
      setNavLayoutState(cleanData.navLayout);
      try { localStorage.setItem('app_nav_layout', cleanData.navLayout); } catch {}
    }
    if (cleanData.appZoomLevel) {
      setAppZoomLevel(cleanData.appZoomLevel);
    }
    const activeTargetProjId = options?.targetProjectId || (cleanData as any)?._projectId || currentProjectId || undefined;
    if (Array.isArray(cleanData.documents) && activeTargetProjId) {
      const currentDocs = getProductionDocuments(activeTargetProjId);
      const merged = mergeProductionDocuments(currentDocs, cleanData.documents);
      saveProductionDocuments(merged, activeTargetProjId, true);
    }
    
    isRemoteUpdateRef.current = false;
    isImportingRef.current = false;
    setHasUnsavedChanges(false);
  }, [currentProjectId, supabaseUser]);

  // REALTIME SUBSCRIPTION FOR INSTANT UPDATES
  useEffect(() => {
    if (!isSupabaseConfigured || !currentProjectId || !supabaseUser) return;

    // Stable listener that doesn't close/reopen on every state change
    const currentProjMeta = projectList.find(p => p.id === currentProjectId);
    if (filePathRef.current || fileHandleRef.current || currentProjMeta?.isLocalOnly) {
      return;
    }

    const acceptRemote = (data: any) => {
      if (!data || activeProjectRef.current !== currentProjectId || hasUnsavedChangesRef.current || isSavingRef.current) return;
      const version = data._cloudUpdatedAt;
      if (!version || version === cloudVersionsRef.current.get(currentProjectId)) return;
      applyProjectState(data);
    };
    const channel = supabase.channel(`project_changes_${currentProjectId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${currentProjectId}`
      }, (payload: any) => {
        if (payload.new?.data) acceptRemote({ ...payload.new.data, _cloudUpdatedAt: payload.new.updated_at });
      })
      .on('broadcast', { event: 'project_updated' }, (payload: any) => acceptRemote(payload.payload?.data || payload.data))
      .on('broadcast', { event: 'project_renamed' }, (payload: any) => {
        const data = payload.payload || payload.data;
        if (data?.id === currentProjectId && data.newName) {
          setCurrentProjectName(data.newName);
          setProjectList(prev => prev.map(p => p.id === data.id ? { ...p, name: data.newName } : p));
        }
      }).subscribe();

    realtimeChannelRef.current = channel;

    // Periodic fallback polling to guarantee sync between collaborators (every 8s)
    const pollInterval = setInterval(async () => {
      if (!currentProjectId || currentProjectId === 'empty-project') return;
      if (filePathRef.current || fileHandleRef.current) return;
      const curProj = projectList.find(p => p.id === currentProjectId);
      if (curProj?.isLocalOnly || curProj?.filePath) return;
      if (hasUnsavedChangesRef.current || isSavingRef.current) return;
      try {
        const remote = await fetchProjectData(currentProjectId);
        acceptRemote(remote);
      } catch (e) {}
    }, 8000);

    return () => {
      clearInterval(pollInterval);
      realtimeChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [currentProjectId, supabaseUser, applyProjectState]);

  const selectProjectRef = useRef<((id: string, opts?: { silent?: boolean }) => Promise<void>) | null>(null);

  const refreshProjectList = async (userId: string, targetEmail?: string) => {
    try {
      // 1. Instant Cache: immediately render previously loaded cloud projects for this user
      // so the project picker and dashboard appear with zero waiting time (0ms)!
      try {
        const cachedRaw = localStorage.getItem(`cached_cloud_projects_${userId}`);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (Array.isArray(cached) && cached.length > 0) {
            setProjectList(cached);
          }
        }
      } catch {}

      const email = targetEmail || supabaseUser?.email || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentUser') : '') || '';
      const [dbProjects, invited] = await Promise.all([
        fetchUserProjects(userId).catch(() => []),
        email ? fetchInvitedProjects(email).catch(() => []) : Promise.resolve([])
      ]);

      const ownedMapped: ProjectMetadata[] = dbProjects.map(p => ({
        id: p.id,
        name: p.name,
        lastModified: new Date(p.updated_at).getTime(),
        created: new Date(p.updated_at).getTime()
      }));

      const invitedMapped: ProjectMetadata[] = invited.map((inv: any) => ({
        id: inv.id,
        name: `${inv.name} (Invited by ${inv.invitedBy})`,
        lastModified: Date.now(),
        created: Date.now(),
        isInvited: true,
        invitedBy: inv.invitedBy
      }));

      // Combine owned and invited projects, removing any duplicates
      const combined = [...ownedMapped];
      invitedMapped.forEach(p => {
        if (!combined.some(c => c.id === p.id)) {
          combined.push(p);
        }
      });

      // Also include any local-only projects from localStorage that have not yet been synced
      try {
        const localRaw = localStorage.getItem('projectList');
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((lp: any) => {
              if (lp && lp.id) {
                const existingIdx = combined.findIndex(c => c.id === lp.id);
                if (existingIdx >= 0) {
                  if (lp.isLocalOnly || lp.filePath) {
                    combined[existingIdx] = {
                      ...combined[existingIdx],
                      isLocalOnly: true,
                      filePath: lp.filePath || combined[existingIdx].filePath
                    };
                  }
                } else {
                  combined.push({
                    ...lp,
                    isLocalOnly: true,
                    name: lp.name || 'Local Draft'
                  });
                }
              }
            });
          }
        }
      } catch {}

      setProjectList(combined);
      try {
        localStorage.setItem(`cached_cloud_projects_${userId}`, JSON.stringify(combined));
      } catch {}

      // 4. Cross-device sync / hydration:
      // ONLY run on initial startup once! Never auto-select or overwrite if a local file is open or active project exists!
      const isClosed = typeof localStorage !== 'undefined' && localStorage.getItem('backstage_project_closed') === 'true';
      if (!initialHydrationDoneRef.current && combined.length > 0 && selectProjectRef.current && !isClosed) {
        initialHydrationDoneRef.current = true;
        if (filePathRef.current || fileHandleRef.current) return;

        const curId = currentProjectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') : null);
        const curProj = combined.find(p => p.id === curId);

        if (curId && curId !== 'empty-project' && curProj && !curProj.isLocalOnly && !curProj.filePath) {
          await selectProjectRef.current(curId, { silent: true });
        } else if ((!curId || curId === 'empty-project') && !filePathRef.current) {
          const cloudProjects = combined.filter(p => !p.isLocalOnly && !p.filePath);
          if (cloudProjects.length > 0) {
            await selectProjectRef.current(cloudProjects[0].id, { silent: true });
          }
        }
      }
    } catch (err: any) {
      if (err.code === '42P01') setSchemaError("TABLE_MISSING");
      else if (err.code === '42703' || err.message?.includes('data')) setSchemaError("COLUMN_MISSING");
    }
  };

  // --- UNDO / REDO ENGINE ---
  const historyRef = useRef<Record<string, any>[]>([]);
  const historyProjectRef = useRef(currentProjectId);
  const historyIndexRef = useRef<number>(-1);
  const isTimeTraveling = useRef(false);

  // Refs that always hold the latest nextId and activeBoardId for use in stable callbacks
  const nextIdRef = useRef(nextId);
  useEffect(() => { nextIdRef.current = nextId; }, [nextId]);
  const activeBoardIdRef = useRef(activeBoardId);
  useEffect(() => { activeBoardIdRef.current = activeBoardId; }, [activeBoardId]);

  const captureSnapshot = useCallback((overrideState?: Partial<{ beats: Beat[]; connections: Connection[]; groups: Group[]; annotations: Annotation[] }>) => {
    if (isTimeTraveling.current || isRemoteUpdateRef.current) return;
    const currentProjectState = {
      beats: overrideState?.beats ?? beats,
      groups: overrideState?.groups ?? groups,
      connections: overrideState?.connections ?? connections,
      annotations: overrideState?.annotations ?? annotations,
      characterData, generatedShots, 
      scratchpad, globalNotes, activeBoardId,
      isTamilMode, scriptConfig, scriptViewMode, scratchpadConfig,
      storyboardConfig, isStoryboardFeatureEnabled, breakdownLanguage,
      breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal,
      boardLayerOrder, nextId, nextAnnoId,
      dailyStats, sessionStartCount, lastSessionDate
    };
    const snapshot = currentProjectState;
    if (historyProjectRef.current !== currentProjectId || historyNeedsResetRef.current) {
      historyProjectRef.current = currentProjectId;
      historyNeedsResetRef.current = false;
      historyRef.current = [snapshot];
      historyIndexRef.current = 0;
      return;
    }
    if (historyIndexRef.current >= 0 && shallowEqual(historyRef.current[historyIndexRef.current], snapshot)) return;
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(snapshot);
    if (newHistory.length > 50) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
  }, [
    currentProjectId, beats, groups, connections, annotations, characterData, generatedShots, 
    scratchpad, globalNotes, activeBoardId,
    isTamilMode, scriptConfig, scriptViewMode, scratchpadConfig,
    storyboardConfig, isStoryboardFeatureEnabled, breakdownLanguage,
    breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal,
    boardLayerOrder, nextId, nextAnnoId,
    dailyStats, sessionStartCount, lastSessionDate
  ]);

  // Record committed state, including changes made by setters whose callers
  // only capture a checkpoint before editing. A restore skips this effect once.
  useEffect(() => {
    if (isTimeTraveling.current) { isTimeTraveling.current = false; return; }
    const wasReset = historyNeedsResetRef.current || historyProjectRef.current !== currentProjectId;
    captureSnapshot();
    if (!wasReset) setHasUnsavedChanges(true);
  }, [captureSnapshot]);

  const restoreHistory = useCallback((snapshot: Record<string, any>) => {
    isTimeTraveling.current = true;
    setBeats(snapshot.beats); setGroups(snapshot.groups);
    setConnections(snapshot.connections); setAnnotations(snapshot.annotations);
    setCharacterData(snapshot.characterData); setGeneratedShots(snapshot.generatedShots);
    setScratchpad(snapshot.scratchpad); setGlobalNotes(snapshot.globalNotes);
    setActiveBoardId(snapshot.activeBoardId); setTamilMode(snapshot.isTamilMode);
    setScriptConfig(snapshot.scriptConfig); setScriptViewMode(snapshot.scriptViewMode);
    setScratchpadConfig(snapshot.scratchpadConfig); setStoryboardConfig(snapshot.storyboardConfig);
    setStoryboardFeatureEnabled(snapshot.isStoryboardFeatureEnabled);
    setBreakdownLanguage(snapshot.breakdownLanguage); setBreakdownLockedOnly(snapshot.breakdownLockedOnly);
    setPdfDropEnabled(snapshot.isPdfDropEnabled); setRedoEnabled(snapshot.isRedoEnabled);
    setWritingGoal(snapshot.writingGoal); setBoardLayerOrder(snapshot.boardLayerOrder);
    setNextId(snapshot.nextId); setNextAnnoId(snapshot.nextAnnoId);
    setDailyStats(snapshot.dailyStats); setSessionStartCount(snapshot.sessionStartCount);
    setLastSessionDate(snapshot.lastSessionDate);
    setHasUnsavedChanges(true);
  }, []);
  const undo = useCallback(() => {
    if (historyProjectRef.current !== activeProjectRef.current) return;
    if (historyIndexRef.current > 0) restoreHistory(historyRef.current[--historyIndexRef.current]);
  }, [restoreHistory]);
  const redo = useCallback(() => {
    if (historyProjectRef.current !== activeProjectRef.current) return;
    if (historyIndexRef.current < historyRef.current.length - 1) restoreHistory(historyRef.current[++historyIndexRef.current]);
  }, [restoreHistory]);

  const login = (username: string) => {
    try { localStorage.setItem('currentUser', username); } catch {}
    setCurrentUser(username);
  };

  // loginWithSupabase: directly establishes both username & supabaseUser state
  // Use this after a successful supabase auth call instead of login()
  const loginWithSupabase = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const userEmail = session.user.email || 'Cloud User';
        setSupabaseUser(session.user);
        setCurrentUser(userEmail);
        localStorage.setItem('currentUser', userEmail);
        setCloudOffline(false);
        refreshProjectList(session.user.id, session.user.email || undefined).catch(e => console.warn('[ctx] refreshProjectList failed:', e));
        return true;
      }
    } catch (e) {
      console.warn('[ctx] loginWithSupabase getSession error:', e);
    }
    return false;
  };

  const logout = async () => {
    isExplicitLogoutRef.current = true;
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("SignOut error:", err);
      }
    }
    setSupabaseUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentProjectId');
    setCurrentUser(null);
    setCurrentProjectId(null);
    setSchemaError(null);
    setCloudOffline(false);
    setFileHandle(null);
  };

  const closeProject = useCallback(() => {
    setCurrentProjectId(null);
    setCurrentProjectName('');
    localStorage.removeItem('currentProjectId');
    try {
      localStorage.setItem('backstage_project_closed', 'true');
    } catch {}
    setFileHandle(null);
    fileHandleRef.current = null;
    setFilePath(null);
    filePathRef.current = null;
    applyProjectState(INITIAL_STATE);
    setPanX(INITIAL_STATE.panX);
    setPanY(INITIAL_STATE.panY);
    setScale(INITIAL_STATE.scale);
    setHasUnsavedChanges(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('backstage:show-welcome'));
    }
  }, [applyProjectState]);

  const createProject = async (name: string) => {
    setFileHandle(null);
    fileHandleRef.current = null;
    setFilePath(null);
    filePathRef.current = null;
    const id = `proj_${Date.now()}`;
    // Zero-template clean state for brand new project
    const emptyState: ProjectState & { documents: any[] } = {
      ...INITIAL_STATE,
      beats: [],
      groups: [],
      connections: [],
      annotations: [],
      characterData: {},
      generatedShots: [],
      globalNotes: [],
      scratchpad: '',
      talentPool: [],
      documents: [],
      causalityLanes: [],
      causalityGroups: [],
      sectionBreaks: []
    };
    try {
      localStorage.removeItem(`causality_lanes_${id}`);
      localStorage.removeItem(`causality_groups_${id}`);
      localStorage.removeItem(`causality_breaks_${id}`);
      localStorage.removeItem(`backstage_daw_tracks_${id}`);
    } catch (e) {}
    saveProductionDocuments([], id, true);
    setCurrentProjectName(name);
    try { localStorage.setItem(`project_name_${id}`, name); } catch {}

    if (supabaseUser) {
      try {
        cloudVersionsRef.current.set(id, await upsertProject(id, supabaseUser.id, name, emptyState));
        await refreshProjectList(supabaseUser.id, supabaseUser.email);
        try {
          const globalChannel = supabase.channel('global_projects_sync');
          globalChannel.send({
            type: 'broadcast',
            event: 'project_created',
            payload: { id, name, userId: supabaseUser.id, updatedAt: new Date().toISOString() }
          });
        } catch {}
      } catch (err: any) {
        if (err.code === '42P01') setSchemaError("TABLE_MISSING");
        else if (err.code === '42703' || err.message?.includes('data')) setSchemaError("COLUMN_MISSING");
        return;
      }
    } else {
      const newProject: ProjectMetadata = { id, name, created: Date.now(), lastModified: Date.now() };
      setProjectList(prev => {
        const updated = [newProject, ...prev];
        try { localStorage.setItem('projectList', JSON.stringify(updated)); } catch {}
        return updated;
      });
      try { localStorage.removeItem(`project_data_${id}`); } catch {}
    }
    selectProject(id);
  };

  const refreshProjects = useCallback(async () => {
    let target = supabaseUser;
    if (!target) target = getStoredSupabaseUser();
    if (target?.id) {
      await refreshProjectList(target.id, target.email);
    }
  }, [supabaseUser]);

  const publishProjectToCloud = useCallback(async (projectId: string): Promise<boolean> => {
    let targetUser = supabaseUser;
    if (!targetUser) targetUser = getStoredSupabaseUser();
    if (!targetUser?.id) {
      console.warn('[ctx] Cannot publish project to cloud: No authenticated Supabase user');
      return false;
    }

    try {
      let dataToUpload: any = null;
      let pName = 'Screenplay';

      if (projectId === currentProjectId) {
        const currentDocs = getProductionDocuments(projectId);
        dataToUpload = {
          beats, groups, connections, annotations, characterData, generatedShots, 
          scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
          isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
          isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
          scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
          breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
          writingGoal, geminiApiKey: '', openrouterKey: '', generalAiModel, 
          dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder,
          characterDesignLocked, collaborators, talentPool, appTheme, themeAnimationStyle,
          documents: currentDocs
        };
        pName = currentProjectName || localStorage.getItem(`project_name_${projectId}`) || 'Screenplay';
      } else {
        const localRaw = localStorage.getItem(`project_data_${projectId}`);
        dataToUpload = localRaw ? JSON.parse(localRaw) : INITIAL_STATE;
        pName = localStorage.getItem(`project_name_${projectId}`) 
          || projectList.find(p => p.id === projectId)?.name 
          || 'Screenplay';
      }

      cloudVersionsRef.current.set(projectId, await upsertProject(projectId, targetUser.id, pName, dataToUpload, cloudVersionsRef.current.get(projectId))); 
      await refreshProjectList(targetUser.id, targetUser.email);

      // Clean from local storage list
      try {
        const raw = localStorage.getItem('projectList');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updated = list.filter((p: any) => p.id !== projectId);
            localStorage.setItem('projectList', JSON.stringify(updated));
          }
        }
      } catch {}

      // Broadcast to other devices/Tauri
      try {
        const globalChannel = supabase.channel('global_projects_sync');
        globalChannel.send({
          type: 'broadcast',
          event: 'project_created',
          payload: { id: projectId, name: pName, userId: targetUser.id, updatedAt: new Date().toISOString() }
        });
      } catch {}

      return true;
    } catch (err) {
      console.error('[ctx] publishProjectToCloud failed:', err);
      return false;
    }
  }, [
    supabaseUser, currentProjectId, currentProjectName, projectList,
    beats, groups, connections, annotations, characterData, generatedShots, 
    scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
    isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
    isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
    scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
    breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
    writingGoal, openrouterKey, generalAiModel, 
    dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder,
    characterDesignLocked, collaborators, talentPool, appTheme, themeAnimationStyle
  ]);

  const selectProject = async (id: string, opts?: { silent?: boolean }) => {
    let resolvedName = '';
    let isInvitedProj = false;

    const existingInList = projectList.find(p => p.id === id);
    const selection = ++projectSelectionRef.current;
    while (hasUnsavedChangesRef.current) {
      const revision = editRevisionRef.current;
      await latestSaveRef.current();
      if (revision === editRevisionRef.current) break;
    }
    if (selection !== projectSelectionRef.current) return;
    const isLocalProject = projectIsLocal(existingInList, Boolean(supabaseUser));

    setFileHandleWrapped(null);
    setFilePathWrapped(existingInList?.filePath || null);

    if (!opts?.silent) {
      setIsProjectLoading(true);
      const knownName = existingInList?.name || localStorage.getItem(`project_name_${id}`) || 'Screenplay';
      setProjectLoadingMessage(isLocalProject ? `Opening "${knownName}"...` : `Syncing "${knownName}" from Backstage Cloud...`);
    }

    try {
      if (supabaseUser && !isLocalProject) {
        try {
          const data = await fetchProjectData(id);
          if (selection !== projectSelectionRef.current) return;
          if (!data) throw new Error('Cloud project unavailable. Local changes have been preserved.');
          const cleanData = data;
          
          resolvedName = data?._projectName || data?.projectName || data?.name || '';
          isInvitedProj = Boolean(data?._ownerId && data._ownerId !== supabaseUser.id);

          applyProjectState(cleanData, { targetProjectId: id });
          syncDocumentsWithCloud(id, supabaseUser.id).catch(() => {});

          // Auto-register current user as an active collaborator inside project metadata
          const currentEmail = supabaseUser.email?.toLowerCase().trim();
          if (currentEmail) {
            const collabs = Array.isArray(cleanData.collaborators) ? [...cleanData.collaborators] : [];
            if (!collabs.some((c: any) => c.email.toLowerCase() === currentEmail)) {
              collabs.push({
                email: currentEmail,
                name: supabaseUser.user_metadata?.name || currentEmail.split('@')[0],
                role: 'Collaborator',
                editAccess: 'edit',
                allowedPages: ['board', 'script', 'casting', 'storyboard', 'shotlist', 'production']
              });
              setCollaborators(collabs);
            }
          }
        } catch (err: any) {
          if (err.code === '42P01') setSchemaError("TABLE_MISSING");
          else if (err.code === '42703' || err.message?.includes('data')) setSchemaError("COLUMN_MISSING");
          throw err;
        }
      } else {
        const [rustState, idbState] = await Promise.all([loadProjectFromRustDisk(id), loadLargeProject(id)]);
        let legacyState = null;
        try { legacyState = JSON.parse(localStorage.getItem(`project_data_${id}`) || 'null'); } catch {}
        const localState = newestProjectSnapshot(idbState, rustState, legacyState);
        if (selection !== projectSelectionRef.current) return;
        applyProjectState(localState || INITIAL_STATE, { targetProjectId: id });
      }

      if (!resolvedName) {
        const existingInList = projectList.find(p => p.id === id);
        resolvedName = existingInList?.name || localStorage.getItem(`project_name_${id}`) || 'Project';
        isInvitedProj = Boolean(existingInList?.isInvited);
      }

      setCurrentProjectId(id);
      setCurrentProjectName(resolvedName);
      try {
        localStorage.setItem('currentProjectId', id);
        localStorage.setItem('backstage_project_closed', 'false');
      } catch {}
      if (resolvedName) {
        try {
          localStorage.setItem(`project_name_${id}`, resolvedName);
        } catch {}
        setProjectList(prev => {
          const existing = prev.find(p => p.id === id);
          const updatedItem = existing
            ? { ...existing, name: resolvedName, lastModified: Date.now(), isInvited: existing.isInvited ?? isInvitedProj }
            : { id, name: resolvedName, lastModified: Date.now(), created: Date.now(), isInvited: isInvitedProj };
          const nextList = [updatedItem, ...prev.filter(p => p.id !== id)];
          try {
            localStorage.setItem('projectList', JSON.stringify(nextList));
          } catch {}
          return nextList;
        });
      }
    } finally {
      if (!opts?.silent) {
        setIsProjectLoading(false);
        setProjectLoadingMessage('');
      }
    }
  };
  selectProjectRef.current = selectProject;


  // Rust-First Local Projects Discovery: automatically discover and merge projects from disk
  useEffect(() => {
    if (!isTauri()) return;
    listRustLocalProjects().then((rustProjects) => {
      if (rustProjects && rustProjects.length > 0) {
        setProjectList((prev) => {
          const merged = [...prev];
          for (const rp of rustProjects) {
            const exists = merged.some((p) => p.id === rp.id);
            if (!exists) {
              const localName = localStorage.getItem(`project_name_${rp.id}`) || rp.id;
              merged.push({
                id: rp.id,
                name: localName,
                created: rp.updated_at * 1000,
                lastModified: rp.updated_at * 1000,
              });
            }
          }
          return merged;
        });
      }
    }).catch(() => {});
  }, []);

  // Focus-triggered project reload removed to prevent overwriting active local files with stale cloud data

  const deleteProject = async (id: string) => {
    if (supabaseUser) {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (!error) await refreshProjectList(supabaseUser.id);
    } else {
      setProjectList(prev => {
        const updated = prev.filter(p => p.id !== id);
        try { localStorage.setItem('projectList', JSON.stringify(updated)); } catch {}
        return updated;
      });
      localStorage.removeItem(`project_data_${id}`);
    }
    if (currentProjectId === id) {
      setCurrentProjectId(null);
      localStorage.removeItem('currentProjectId');
    }
  };

  const renameProject = async (id: string, newName: string): Promise<boolean> => {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    const target = projectList.find(p => p.id === id);
    if (target?.isInvited) {
      alert("Only the project owner can rename this project.");
      return false;
    }

    if (supabaseUser) {
      const ok = await renameCloudProject(id, supabaseUser.id, trimmed);
      if (!ok) return false;
      await refreshProjectList(supabaseUser.id);
    } else {
      setProjectList(prev => {
        const updated = prev.map(p => p.id === id ? { ...p, name: trimmed, lastModified: Date.now() } : p);
        try { localStorage.setItem('projectList', JSON.stringify(updated)); } catch {}
        return updated;
      });
      try { localStorage.setItem(`project_name_${id}`, trimmed); } catch {}
    }

    if (currentProjectId === id) {
      setCurrentProjectName(trimmed);
      try { localStorage.setItem(`project_name_${id}`, trimmed); } catch {}
    }
    return true;
  };

  const saveProject = useCallback(async () => {
    if (isRemoteUpdateRef.current || !currentProjectId) return;
    const savedRevision = editRevisionRef.current;
    const targetFilePath = filePathRef.current;
    const targetFileHandle = fileHandleRef.current;
    return saveQueue.current.run(async () => {
    setIsSaving(true);
    try {
    setCloudSyncStatus(prev => ({
      isUploading: true,
      progress: 30,
      status: 'uploading',
      message: supabaseUser 
        ? `Syncing ${(talentPool || []).length} actors & photos to Cloud...` 
        : 'Saving locally on this computer...',
      lastSyncedAt: prev.lastSyncedAt
    }));

    let currentDocs = getProductionDocuments(currentProjectId || undefined);
    if (currentProjectId) {
      try {
        const fullDocs = await loadProductionDocumentsAsync(currentProjectId);
        if (fullDocs && Array.isArray(fullDocs) && fullDocs.length > 0) {
          currentDocs = fullDocs;
        }
      } catch (e) {}
    }

    const projectData: ProjectState & { lastInstanceId?: string; documents?: any[]; _savedAt?: number; _cloudUpdatedAt?: string } = {
      _savedAt: Date.now(),
      beats, groups, connections, annotations, characterData, generatedShots, 
      scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
      isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
      scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
      writingGoal, geminiApiKey: '', openrouterKey: '', generalAiModel,
      dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder,
      characterDesignLocked,
      collaborators,
      talentPool,
      appTheme,
      themeAnimationStyle,
      lastInstanceId: INSTANCE_ID // Tag the update with this instance ID
    };
    let saved = false;
    let cloudFailed = false;
    let cloudSucceeded = false;
    await flushDocumentPersistence(currentProjectId);

    // 1. Rust-First Native Disk Storage & Unlimited Local Database
    // Documents are stored separately from the project snapshot.
    try {
      const rustResult = await saveProjectToRustDisk(currentProjectId || 'empty-project', projectData);
      if (rustResult.success) {
        saved = true;
      }
    } catch (e) {}

    // Always persist to local IndexedDB as secondary cache
    const idbSaved = await saveLargeProject(currentProjectId || 'empty-project', projectData);
    if (idbSaved) saved = true;

    // 2. Cloud (when signed in to Supabase and NOT a local-only file)
    let cloudErrorDetail: string | null = null;
    const currentProjMetaForSave = projectList.find(p => p.id === currentProjectId);
    const isLocalFileOnly = Boolean(targetFilePath || targetFileHandle || currentProjMetaForSave?.isLocalOnly);

    if (supabaseUser && !isLocalFileOnly) {
      try {
        setCloudSyncStatus(prev => ({
          ...prev,
          progress: 55,
          message: 'Optimizing headshots for Supabase...'
        }));
        // Documents are saved independently; project autosaves carry no binary collection.
        await flushCloudSaves(currentProjectId);
        const cloudPayload = { ...projectData };
        const project = projectList.find(p => p.id === currentProjectId);
        const version = await upsertProject(currentProjectId, supabaseUser.id, project?.name || 'Untitled', cloudPayload,
          cloudVersionsRef.current.get(currentProjectId) || null);
        cloudVersionsRef.current.set(currentProjectId, version);
        cloudConflictRef.current.delete(currentProjectId);
        cloudSucceeded = true;
        // Announce only acknowledged writes, with the server's version.
        void realtimeChannelRef.current?.send({ type: 'broadcast', event: 'project_updated',
          payload: { data: { ...cloudPayload, _cloudUpdatedAt: version } } });
        saved = true;
      } catch (err: any) {
        cloudFailed = true;
        if (err instanceof ProjectConflictError) cloudConflictRef.current.add(currentProjectId);
        cloudErrorDetail = err?.message || 'Gateway Timeout / Restarting';
        console.error("Cloud save failed (Supabase may be restarting or unreachable):", err);
      }
    }

    // 3. Fallback for Desktop/File handles or small localStorage mirrors
    if (isTauri() && targetFilePath) {
      try {
        const fs = await getTauriFs();
        if (fs) {
          await fs.writeTextFile(targetFilePath, JSON.stringify({ ...projectData, documents: currentDocs }, null, 2));
          saved = true;
        }
      } catch (err) {}
    }
    if (targetFileHandle) {
      try {
        const writable = await targetFileHandle.createWritable();
        await writable.write(JSON.stringify({ ...projectData, documents: currentDocs }, null, 2));
        await writable.close();
        saved = true;
      } catch (err) {}
    }
    if (currentProjectId) {
      try {
        if (!idbSaved) {
          localStorage.setItem(`project_data_${currentProjectId}`, JSON.stringify(projectData));
          saved = true;
        } else localStorage.removeItem(`project_data_${currentProjectId}`);
      } catch (err) {
        // Expected to throw if over 5MB; IndexedDB above has already safely stored it
      }
    }

    setCloudOffline(cloudFailed);
    if (saved) {
      if (activeProjectRef.current === currentProjectId && editRevisionRef.current === savedRevision && !cloudFailed) {
        setHasUnsavedChanges(false);
      }
      if (currentProjectId) {
        const curName = currentProjectName || localStorage.getItem(`project_name_${currentProjectId}`) || 'Current Screenplay';
        setProjectList(prev => {
          const existing = prev.find(p => p.id === currentProjectId);
          const updatedMeta = savedProjectMetadata(existing, currentProjectId, curName);
          const nextList = [updatedMeta, ...prev.filter(p => p.id !== currentProjectId)];
          try {
            localStorage.setItem('projectList', JSON.stringify(nextList));
          } catch (e) {}
          return nextList;
        });
      }
      if (cloudFailed) {
        setCloudSyncStatus({
          isUploading: false,
          progress: 100,
          status: 'error',
          message: cloudErrorDetail || 'Cloud save failed; local changes are pending sync',
          lastSyncedAt: new Date()
        });
      } else {
        setCloudSyncStatus({
          isUploading: false,
          progress: 100,
          status: cloudSucceeded ? 'synced' : 'local_only',
          message: cloudSucceeded 
            ? `Reached Supabase Cloud (${(talentPool || []).length} actors live)` 
            : 'Saved locally on this device (Sign in to sync with Cloud)',
          lastSyncedAt: new Date()
        });
      }
    } else {
      setCloudSyncStatus(prev => ({
        isUploading: false,
        progress: 100,
        status: 'error',
        message: 'Save failed. Check local disk space.',
        lastSyncedAt: prev.lastSyncedAt
      }));
    }
    if (!saved) throw new Error('Project could not be saved. Changes remain pending.');
    } catch (err: any) {
      setCloudSyncStatus(prev => ({ ...prev, isUploading: false, status: 'error', message: err.message || 'Save failed' }));
      throw err;
    } finally {
      setIsSaving(false);
    }
    });
  }, [
    currentProjectId, projectList, beats, groups, connections, annotations, characterData, 
    generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
    isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut,
    scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
    breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, openrouterKey, generalAiModel,
    dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, characterDesignLocked, supabaseUser, fileHandle, filePath,
    talentPool, collaborators, appTheme, themeAnimationStyle, currentProjectName
  ]);
  latestSaveRef.current = saveProject;

  const triggerCloudSync = useCallback(async () => {
    await saveProject();
  }, [saveProject]);

  // When connectivity returns after an offline fallback save, re-push the latest
  // project to the cloud automatically.
  useEffect(() => {
      if (!isSupabaseConfigured || !supabaseUser) return;
      const handleOnline = () => {
          if (cloudOfflineRef.current && currentProjectId) {
              saveProject();
          }
      };
      window.addEventListener('online', handleOnline);
      return () => window.removeEventListener('online', handleOnline);
  }, [supabaseUser, currentProjectId, saveProject]);

  const saveProjectAs = useCallback(async () => {
    const projectData: ProjectState & { lastInstanceId?: string } = {
      beats, groups, connections, annotations, characterData, generatedShots, 
      scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
      isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
      scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
      writingGoal, geminiApiKey: '', openrouterKey: '', generalAiModel,
      dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder,
      characterDesignLocked,
      themeAnimationStyle,
      lastInstanceId: INSTANCE_ID // Tag the update with this instance ID
    };
    if (isTauri()) {
      try {
        const dialog = await getTauriDialog();
        const project = projectList.find(p => p.id === currentProjectId);
        const curName = currentProjectName || project?.name || 'Untitled';
        const defaultFileName = `${curName.replace(/\s+/g, '_').toLowerCase()}.bst`;
        if (dialog) {
          const selected = await dialog.save({
            filters: [{ name: 'Backstage File', extensions: ['bst'] }],
            defaultPath: defaultFileName
          });
          if (selected) {
            const newName = selected.split(/[\/\\]/).pop()?.replace(/\.[^/.]+$/, '') || 'Screenplay';
            const newProjId = `proj_${Date.now()}`;
            
            setFilePath(selected);
            setCurrentProjectId(newProjId);
            try { localStorage.setItem('currentProjectId', newProjId); } catch {}
            setCurrentProjectName(newName);
            try { localStorage.setItem(`project_name_${newProjId}`, newName); } catch {}

            const newMeta: ProjectMetadata = {
              id: newProjId,
              name: newName,
              created: Date.now(),
              lastModified: Date.now(),
              isLocalOnly: true,
              filePath: selected
            };
            setProjectList(prev => {
              const updated = [newMeta, ...prev.filter(p => p.id !== newProjId)];
              try { localStorage.setItem('projectList', JSON.stringify(updated)); } catch {}
              return updated;
            });

            const fs = await getTauriFs();
            if (fs) {
              await fs.writeTextFile(selected, JSON.stringify(projectData, null, 2));
            }
            setHasUnsavedChanges(false);
            addRecentFile(selected, newName);
            try {
              localStorage.setItem('backstage_project_closed', 'false');
              localStorage.removeItem(`project_data_${newProjId}`);
              localStorage.removeItem('backstage_last_session');
            } catch (e) {}

            if (currentProjectId) {
              let existingDocs = getProductionDocuments(currentProjectId);
              try {
                const fullDocs = await loadProductionDocumentsAsync(currentProjectId);
                if (fullDocs && fullDocs.length > 0) {
                  existingDocs = fullDocs;
                }
              } catch (e) {}
              if (existingDocs.length > 0) {
                const cloned = existingDocs.map(d => ({ ...d, projectId: newProjId }));
                saveProductionDocuments(cloned, newProjId, true);
              }
            }

            window.dispatchEvent(new CustomEvent('project_imported', { 
              detail: { projectId: newProjId } 
            }));
          }
        }
      } catch (err) {
        console.error("Tauri saveAs error", err);
      }
    } else {
      try {
        const project = projectList.find(p => p.id === currentProjectId);
        const curName = currentProjectName || project?.name || 'Untitled';
        const defaultFileName = `${curName.replace(/\s+/g, '_').toLowerCase()}.bst`;
        // @ts-ignore
        const handle = await window.showSaveFilePicker({ suggestedName: defaultFileName, types: [{ description: 'Backstage File', accept: { 'application/json': ['.bst'] } }] });
        const newName = handle.name ? handle.name.replace(/\.[^/.]+$/, '') : 'Screenplay';
        const newProjId = `proj_${Date.now()}`;
        
        setFileHandle(handle);
        setCurrentProjectId(newProjId);
        try { localStorage.setItem('currentProjectId', newProjId); } catch {}
        setCurrentProjectName(newName);
        try { localStorage.setItem(`project_name_${newProjId}`, newName); } catch {}

        const newMeta: ProjectMetadata = {
          id: newProjId,
          name: newName,
          created: Date.now(),
          lastModified: Date.now(),
          isLocalOnly: true,
          filePath: handle.name
        };
        setProjectList(prev => {
          const updated = [newMeta, ...prev.filter(p => p.id !== newProjId)];
          try { localStorage.setItem('projectList', JSON.stringify(updated)); } catch {}
          return updated;
        });

        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(projectData, null, 2));
        await writable.close();
        setHasUnsavedChanges(false);
        addRecentFile(handle.name, newName);
        try {
          localStorage.setItem('backstage_project_closed', 'false');
          localStorage.removeItem(`project_data_${newProjId}`);
          localStorage.removeItem('backstage_last_session');
        } catch (e) {}

        if (currentProjectId) {
          let existingDocs = getProductionDocuments(currentProjectId);
          try {
            const fullDocs = await loadProductionDocumentsAsync(currentProjectId);
            if (fullDocs && fullDocs.length > 0) {
              existingDocs = fullDocs;
            }
          } catch (e) {}
          if (existingDocs.length > 0) {
            const cloned = existingDocs.map(d => ({ ...d, projectId: newProjId }));
            saveProductionDocuments(cloned, newProjId, true);
          }
        }

        window.dispatchEvent(new CustomEvent('project_imported', { 
              detail: { projectId: newProjId } 
        }));
      } catch (err) {
        console.error("Web saveAs error", err);
      }
    }
  }, [
    currentProjectId, projectList, beats, groups, connections, annotations, characterData, 
    generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
    isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut,
    scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
    breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, openrouterKey, generalAiModel,
    dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, characterDesignLocked
  ]);

  // Debounced Auto-Save (Faster Sync: 1000ms)
  useEffect(() => {
    if (hasUnsavedChanges && !isRemoteUpdateRef.current && !cloudConflictRef.current.has(currentProjectId || '')) {
      const timer = setTimeout(() => {
        saveProject().catch(err => console.error('Save failed:', err)).finally(() => {
          if (hasUnsavedChangesRef.current) setSaveRetry(n => n + 1);
        });
      }, cloudOffline ? Math.min(30000, 2000 * 2 ** Math.min(saveRetry, 4)) : 1000);
      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, saveProject, saveRetry, cloudOffline, currentProjectId]);

  const downloadProject = useCallback(() => {
    if (!currentProjectId) return;
    const currentDocs = getProductionDocuments(currentProjectId || undefined);
    const projectData = { beats, groups, connections, annotations, characterData, generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId, isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled, breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, geminiApiKey: '', openrouterKey: '', generalAiModel, dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, characterDesignLocked, documents: currentDocs };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(projectList.find(p => p.id === currentProjectId)?.name || "Untitled").replace(/[^a-z0-9]/gi, '_').toLowerCase()}_backup.bst`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    saveProject();
  }, [currentProjectId, projectList, beats, groups, connections, annotations, characterData, generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId, isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled, breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, characterDesignLocked, saveProject]);

  const updateBeat = (id: number, updates: Partial<Beat>) => {
    if (isRemoteUpdateRef.current) return;
    const synchronizedUpdates = { ...updates };
    if (updates.breakdown !== undefined && updates.breakdownData === undefined) {
      synchronizedUpdates.breakdownData = updates.breakdown;
    } else if (updates.breakdownData !== undefined && updates.breakdown === undefined) {
      synchronizedUpdates.breakdown = updates.breakdownData;
    }
    setBeats(prev => {
      const target = prev.find(b => b.id === id);
      let delta = 0;
      if (target && updates.content !== undefined && updates.content !== target.content) {
        delta = countWords(updates.content) - countWords(target.content);
      }
      if (delta !== 0) {
        setTimeout(() => {
          const today = new Date().toISOString().split('T')[0];
          setDailyStats(curr => ({ ...curr, [today]: (curr[today] || 0) + delta }));
        }, 0);
      }
      return prev.map(b => b.id === id ? { ...b, ...synchronizedUpdates } : b);
    });
    setHasUnsavedChanges(true);
  };

  const reorderBeats = useCallback((draggedId: number, targetId: number, side: 'top' | 'bottom') => {
    if (isRemoteUpdateRef.current) return;
    setConnections(prev => {
      let newConns = [...prev];
      const incomingToDragged = newConns.filter(c => c.to === draggedId);
      const outgoingFromDragged = newConns.filter(c => c.from === draggedId);
      newConns = newConns.filter(c => c.from !== draggedId && c.to !== draggedId);
      if (incomingToDragged.length === 1 && outgoingFromDragged.length === 1) {
        const src = incomingToDragged[0].from; const dst = outgoingFromDragged[0].to;
        if (src !== dst) newConns.push({ from: src, to: dst, boardId: activeBoardId });
      }
      if (side === 'top') {
        const incomingToTarget = newConns.filter(c => c.to === targetId);
        newConns = newConns.filter(c => c.to !== targetId);
        incomingToTarget.forEach(c => { newConns.push({ from: c.from, to: draggedId, boardId: activeBoardId }); });
        newConns.push({ from: draggedId, to: targetId, boardId: activeBoardId });
      } else {
        const outgoingFromTarget = newConns.filter(c => c.from === targetId);
        newConns = newConns.filter(c => c.from !== targetId);
        newConns.push({ from: targetId, to: draggedId, boardId: activeBoardId });
        outgoingFromTarget.forEach(c => { newConns.push({ from: draggedId, to: c.to, boardId: activeBoardId }); });
      }
      return newConns;
    });
    setBeats(prev => {
      const tBeat = prev.find(b => b.id === targetId);
      if (tBeat) return prev.map(b => b.id === draggedId ? { ...b, x: tBeat.x + (side === 'top' ? -100 : 100), y: tBeat.y } : b);
      return prev;
    });
    captureSnapshot();
  }, [captureSnapshot, activeBoardId]);

  // addBeat is a stable useCallback (refs ensure nextId/activeBoardId are always fresh
  // even when the callback is captured in long-lived event listener closures)
  const addBeat = useCallback((x: number, y: number) => {
    const id = nextIdRef.current;
    nextIdRef.current++;      // pre-increment so rapid successive calls get unique IDs
    setNextId(id + 1);
    setBeats(p => [...p, { 
      id, 
      x, 
      y, 
      title: '', 
      sceneNumber: undefined,
      slug: { prefix: '', location: '', time: '' }, 
      content: '<div class="sc-line sc-action"><br></div>', 
      color: '#444', 
      shots: [], 
      status: 'not-ready', 
      versions: [], 
      notes: [], 
      boardId: activeBoardIdRef.current 
    }]);
    captureSnapshot();
    return id;
  }, [captureSnapshot]);

  const autoGenerateScenes = useCallback((count: 5 | 20 | 50 = 5) => {
    captureSnapshot();
    const data = createAutoScenesDataset(count, activeBoardId);
    setGroups(prev => [...prev.filter(g => (g.boardId || 0) !== activeBoardId), ...data.groups]);
    setBeats(prev => [...prev.filter(b => (b.boardId || 0) !== activeBoardId), ...data.beats]);
    setAnnotations(prev => [...prev.filter(a => (a.boardId || 0) !== activeBoardId), ...data.annotations]);
    setConnections(prev => [...prev.filter(c => (c.boardId || 0) !== activeBoardId), ...data.connections]);
    setCharacterData(data.characterData);
    setGeneratedShots(data.generatedShots);
    setPanX(-150);
    setPanY(120);
    if (count === 50) {
      setScale(0.25);
    } else if (count === 20) {
      setScale(0.38);
    } else {
      setScale(0.5);
    }
    setHasUnsavedChanges(true);
  }, [captureSnapshot, activeBoardId]);

  const autoGenerate5Scenes = useCallback(() => {
    autoGenerateScenes(5);
  }, [autoGenerateScenes]);

  const setCharacterDataWrapped = useCallback((val: React.SetStateAction<Record<string, CharacterData>>) => {
    if (isRemoteUpdateRef.current) return;
    setCharacterData(val);
    setHasUnsavedChanges(true);
  }, []);

  const setBeatsWrapped = useCallback((val: React.SetStateAction<Beat[]>) => {
    if (isRemoteUpdateRef.current) return;
    setBeats(val);
    setHasUnsavedChanges(true);
  }, []);

  const setGroupsWrapped = useCallback((val: React.SetStateAction<Group[]>) => {
    if (isRemoteUpdateRef.current) return;
    setGroups(val);
    setHasUnsavedChanges(true);
  }, []);

  const setConnectionsWrapped = useCallback((val: React.SetStateAction<Connection[]>) => {
    if (isRemoteUpdateRef.current) return;
    setConnections(val);
    setHasUnsavedChanges(true);
  }, []);

  const setAnnotationsWrapped = useCallback((val: React.SetStateAction<Annotation[]>) => {
    if (isRemoteUpdateRef.current) return;
    setAnnotations(val);
    setHasUnsavedChanges(true);
  }, []);

  const setScratchpadWrapped = useCallback((val: React.SetStateAction<string>) => {
    if (isRemoteUpdateRef.current) return;
    setScratchpad(val);
    setHasUnsavedChanges(true);
  }, []);

  const setGlobalNotesWrapped = useCallback((val: React.SetStateAction<Note[]>) => {
    if (isRemoteUpdateRef.current) return;
    setGlobalNotes(val);
    setHasUnsavedChanges(true);
  }, []);

  const setCharacterDesignLockedWrapped = useCallback((val: boolean) => {
    if (isRemoteUpdateRef.current) return;
    setCharacterDesignLocked(val);
    setHasUnsavedChanges(true);
  }, []);

  const setCollaboratorsWrapped = useCallback((val: React.SetStateAction<any[]>) => {
    if (isRemoteUpdateRef.current) return;
    setCollaborators(val);
    setHasUnsavedChanges(true);
  }, []);

  const setTalentPoolWrapped = useCallback((val: React.SetStateAction<ArtistOption[]>) => {
    if (isRemoteUpdateRef.current) return;
    setTalentPool(val);
    setHasUnsavedChanges(true);
  }, []);

  const setScriptConfigWrapped = useCallback((action: React.SetStateAction<ScriptConfig>) => {
    setScriptConfig(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      try {
        const elements = ['action', 'dialogue', 'character', 'parenthetical', 'transition', 'shot', 'lyrics', 'slugline'] as const;
        elements.forEach(elm => {
          if (next[elm]?.fontFamily) {
            localStorage.setItem(`user_pref_font_${elm}`, next[elm].fontFamily);
            localStorage.setItem('user_pref_script_font', next[elm].fontFamily);
          }
        });
      } catch (e) {}
      return next;
    });
    setHasUnsavedChanges(true);
  }, []);

  const setTamilFontFamilyWrapped = useCallback((action: React.SetStateAction<string>) => {
    setTamilFontFamily(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      try {
        localStorage.setItem('user_pref_tamil_font', next);
      } catch (e) {}
      return next;
    });
    setHasUnsavedChanges(true);
  }, []);

  const addTalentToPool = useCallback((talent: ArtistOption | ArtistOption[]) => {
    const list = Array.isArray(talent) ? talent : [talent];
    if (list.length === 0) return;
    setTalentPool(prev => {
      const normalizeHandle = (h?: string) => (h || '').trim().toLowerCase().replace(/^@/, '');
      const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '');
      const existingHandles = new Set(prev.map(p => normalizeHandle(p.instagramHandle)).filter(Boolean));
      const existingPhones = new Set(prev.map(p => normalizePhone(p.phone || p.contact?.phone)).filter(Boolean));
      const existingIds = new Set(prev.map(p => p.id));

      const deduped: ArtistOption[] = [];
      for (const item of list) {
        const h = normalizeHandle(item.instagramHandle);
        const p = normalizePhone(item.phone || item.contact?.phone);
        if ((h && existingHandles.has(h)) || (p && p.length >= 7 && existingPhones.has(p)) || existingIds.has(item.id)) {
          continue;
        }
        if (h) existingHandles.add(h);
        if (p && p.length >= 7) existingPhones.add(p);
        existingIds.add(item.id);
        deduped.push(item);
      }
      return [...prev, ...deduped];
    });
    setHasUnsavedChanges(true);
  }, []);

  const updateTalentInPool = useCallback((id: string, updates: Partial<ArtistOption>) => {
    setTalentPool(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    setHasUnsavedChanges(true);
  }, []);

  const removeTalentFromPool = useCallback((id: string) => {
    setTalentPool(prev => prev.filter(t => t.id !== id));
    setHasUnsavedChanges(true);
  }, []);

  const shortlistTalentForCharacter = useCallback((talentId: string, characterName: string, status: ArtistOption['status'] = 'idea') => {
    let targetArtist: ArtistOption | undefined;
    setTalentPool(prev => prev.map(t => {
      if (t.id === talentId) {
        const existingShortlisted = t.shortlistedForRoles || [];
        const passed = (t.passedForRoles || []).filter(r => r !== characterName);
        const updated = {
          ...t,
          status,
          passedForRoles: passed,
          shortlistedForRoles: existingShortlisted.includes(characterName) ? existingShortlisted : [...existingShortlisted, characterName]
        };
        targetArtist = updated;
        return updated;
      }
      return t;
    }));

    setCharacterData(prev => {
      const char = prev[characterName];
      if (!char) return prev;
      const existingArtists = char.artists || [];
      const exists = existingArtists.some(a => a.id === talentId || (targetArtist?.instagramHandle && a.instagramHandle?.toLowerCase() === targetArtist.instagramHandle.toLowerCase()));
      if (exists) {
        return {
          ...prev,
          [characterName]: {
            ...char,
            artists: existingArtists.map(a => a.id === talentId ? { ...a, ...targetArtist, status } : a)
          }
        };
      }
      if (!targetArtist) return prev;
      const newArtistOption: ArtistOption = {
        ...targetArtist,
        rank: existingArtists.length + 1,
        status
      };
      return {
        ...prev,
        [characterName]: {
          ...char,
          artists: [...existingArtists, newArtistOption]
        }
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  const passTalentForCharacter = useCallback((talentId: string, characterName: string) => {
    setTalentPool(prev => prev.map(t => {
      if (t.id === talentId) {
        const existingPassed = t.passedForRoles || [];
        const shortlisted = (t.shortlistedForRoles || []).filter(r => r !== characterName);
        return {
          ...t,
          shortlistedForRoles: shortlisted,
          passedForRoles: existingPassed.includes(characterName) ? existingPassed : [...existingPassed, characterName]
        };
      }
      return t;
    }));

    setCharacterData(prev => {
      const char = prev[characterName];
      if (!char || !char.artists) return prev;
      return {
        ...prev,
        [characterName]: {
          ...char,
          artists: char.artists.map(a => a.id === talentId ? { ...a, status: 'passed' } : a)
        }
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  const starTalentForCharacter = useCallback((talentId: string, characterName: string) => {
    shortlistTalentForCharacter(talentId, characterName, 'callback');
    setTalentPool(prev => prev.map(t => {
      if (t.id === talentId) {
        const existingStarred = t.starredForRoles || [];
        return {
          ...t,
          rating: 5,
          starredForRoles: existingStarred.includes(characterName) ? existingStarred : [...existingStarred, characterName]
        };
      }
      return t;
    }));
    setHasUnsavedChanges(true);
  }, [shortlistTalentForCharacter]);

  // Real-time synchronization from Chrome Extension (/api/talent/sync)
  useEffect(() => {
    if (isTauri()) return;
    let isMounted = true;

    const pollSyncQueue = async () => {
      try {
        const res = await fetch('/api/talent/sync');
        if (!res.ok) return;
        const data = await res.json();
        if (data.items && Array.isArray(data.items) && data.items.length > 0 && isMounted) {
          for (const item of data.items) {
            setTalentPool(prev => {
              const normHandle = (item.handle || '').toLowerCase().replace(/^@/, '');
              const normName = (item.name || '').toLowerCase().trim();
              
              const existingIdx = prev.findIndex(t => {
                const tHandle = (t.instagramHandle || '').toLowerCase().replace(/^@/, '');
                const tName = (t.name || '').toLowerCase().trim();
                return (normHandle && tHandle === normHandle) || (normName && tName === normName);
              });

              if (existingIdx !== -1) {
                const updated = [...prev];
                const existing = updated[existingIdx];

                // Merge and deduplicate all headshots / photos
                const existingPhotos = Array.isArray(existing.photos) && existing.photos.length > 0 
                  ? existing.photos 
                  : (existing.photoUrl ? [existing.photoUrl] : []);
                const incomingPhotos = Array.isArray(item.photos) && item.photos.length > 0 
                  ? item.photos 
                  : (item.photoUrl ? [item.photoUrl] : []);
                const mergedPhotos = Array.from(new Set([...existingPhotos, ...incomingPhotos].filter(Boolean)));

                updated[existingIdx] = {
                  ...existing,
                  photoUrl: item.photoUrl || existing.photoUrl,
                  photos: mergedPhotos,
                  instagramHandle: item.handle || existing.instagramHandle,
                  instagramUrl: item.url || existing.instagramUrl,
                  notes: item.bio && !existing.notes?.includes(item.bio)
                    ? `${existing.notes || ''}\n\n${item.bio}`.trim()
                    : (existing.notes || item.bio),
                };
                return updated;
              } else {
                const initialPhotos = Array.isArray(item.photos) && item.photos.length > 0
                  ? item.photos
                  : (item.photoUrl ? [item.photoUrl] : []);

                const newTalent: ArtistOption = {
                  id: `talent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  name: item.name || normHandle || 'Instagram Actor',
                  rank: 1,
                  status: 'idea',
                  photoUrl: item.photoUrl,
                  photos: initialPhotos,
                  instagramHandle: item.handle,
                  instagramUrl: item.url,
                  notes: item.bio,
                  source: 'instagram',
                };
                return [newTalent, ...prev];
              }
            });
            setHasUnsavedChanges(true);
          }
        }
      } catch (e) {}
    };

    const interval = setInterval(pollSyncQueue, 2000);
    window.addEventListener('focus', pollSyncQueue);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', pollSyncQueue);
    };
  }, []);

  const value: ProjectContextType = {
    beats, groups, connections, annotations, characterData, generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId, isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,     breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, geminiApiKey: '', openrouterKey, setOpenrouterKey, generalAiModel, setGeneralAiModel, dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, characterDesignLocked, setCharacterDesignLocked: setCharacterDesignLockedWrapped, appTheme, appAccentColor, appLanguage, currentUser, currentProjectId, projectList, hasUnsavedChanges, schemaError, isSaving, fileHandle, filePath, setFilePath: setFilePathWrapped, isInitialLoading, isProjectLoading, projectLoadingMessage, isCloudMode: !!supabaseUser, supabaseUser, cloudOffline, login, loginWithSupabase, logout, selectProject, createProject, deleteProject, renameProject, closeProject, clearSchemaError: () => { setSchemaError(null); if (supabaseUser) refreshProjectList(supabaseUser.id); }, setBeats: setBeatsWrapped, setGroups: setGroupsWrapped, setConnections: setConnectionsWrapped, setAnnotations: setAnnotationsWrapped, setCharacterData: setCharacterDataWrapped, setGeneratedShots, setScratchpad: setScratchpadWrapped, setGlobalNotes: setGlobalNotesWrapped, updateGeneratedShot: (id, u) => { setGeneratedShots(p => p.map(s => s.id === id ? { ...s, ...u } : s)); setHasUnsavedChanges(true); }, addGeneratedShot: (i) => { const n = { id: `shot-${Date.now()}`, shotSize: 'WIDE', angle: 'EYE LEVEL', description: '', subject: '', scene: '?', imageHistory: [] }; const s = [...generatedShots]; s.splice(i + 1, 0, n); setGeneratedShots(s); captureSnapshot(); }, removeGeneratedShot: (id) => { setGeneratedShots(p => p.filter(s => s.id !== id)); captureSnapshot(); }, moveGeneratedShot: (f, t) => { const s = [...generatedShots]; const [m] = s.splice(f, 1); s.splice(t, 0, m); setGeneratedShots(s); captureSnapshot(); }, setPan: (x, y) => { setPanX(x); setPanY(y); }, setScale, updateBeat, addBeat, reorderBeats, addGroup: (g) => { const id = nextId; setNextId(p => p + 1); setGroups(p => [...p, { ...g, id, boardId: activeBoardId }]); captureSnapshot(); }, updateGroup: (id, u) => { setGroups(p => p.map(g => g.id === id ? { ...g, ...u } : g)); setHasUnsavedChanges(true); }, removeGroup: (id) => { setGroups(p => p.filter(g => g.id !== id)); captureSnapshot(); }, loadProject: applyProjectState, saveProject, saveProjectAs, setActiveBoardId, setTamilMode, setTamilFontScale, setTamilFontFamily: setTamilFontFamilyWrapped, learnTamilWord: (e, t) => { setUserDictionary(p => { const c = p[e.toLowerCase()] || []; if (!c.includes(t)) return { ...p, [e.toLowerCase()]: [t, ...c] }; return p; }); }, setOsInputMode, setOsInputShortcut, setScriptConfig: setScriptConfigWrapped, setScriptViewMode, setScratchpadConfig, setStoryboardConfig, setStoryboardFeatureEnabled, setAppTheme, setAppAccentColor, setAppLanguage, setBreakdownLanguage, setBreakdownLockedOnly, setPdfDropEnabled, setRedoEnabled, setWritingGoal, setGeminiApiKey: () => {}, setBoardLayerOrder, setNextId, undo, redo, canUndo: historyIndexRef.current > 0, canRedo: historyIndexRef.current < historyRef.current.length - 1, captureSnapshot, downloadProject, autoGenerate5Scenes, autoGenerateScenes,
    userRole, updateUserRole, grokKey, setGrokKey,
    collaborators, setCollaborators: setCollaboratorsWrapped,
    talentPool, setTalentPool: setTalentPoolWrapped,
    addTalentToPool, updateTalentInPool, removeTalentFromPool,
    shortlistTalentForCharacter, passTalentForCharacter, starTalentForCharacter,
    navLayout, setNavLayout,
    themeAnimationStyle, setThemeAnimationStyle,
    appZoomLevel, setAppZoomLevel,
    cloudSyncStatus, triggerCloudSync,
    currentProjectName,
    isCurrentProjectShared: Boolean(
      projectList.find(p => p.id === currentProjectId)?.isInvited || 
      (Array.isArray(collaborators) && collaborators.some(c => c.email && c.email.toLowerCase().trim() !== supabaseUser?.email?.toLowerCase().trim()))
    ),
    refreshProjects,
    publishProjectToCloud,
    setHasUnsavedChanges
  };

  if (typeof window !== 'undefined') {
    (window as any).__BACKSTAGE_PROJECT_CONTEXT_VALUE__ = value;
  }

  const storeRef = useRef<ReturnType<typeof createProjectStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createProjectStore(value);
    storeRef.current.update(value, false);
  }
  useLayoutEffect(() => { storeRef.current!.update(value); });
  return <ProjectContext.Provider value={storeRef.current}>{children}</ProjectContext.Provider>;
};

const noop = () => {};
const fallbackProjectContextValue: ProjectContextType = {
  ...INITIAL_STATE,
  currentUser: null,
  currentProjectId: 'empty-project',
  currentProjectName: 'My Screenplay',
  isCurrentProjectShared: false,
  projectList: [],
  schemaError: null,
  isCloudMode: false,
  supabaseUser: null,
  isSaving: false,
  isInitialLoading: false,
  isProjectLoading: false,
  projectLoadingMessage: undefined,
  cloudOffline: true,
  userRole: ['writer'],
  updateUserRole: async () => {},
  grokKey: '',
  setGrokKey: noop,
  collaborators: [],
  setCollaborators: noop,
  talentPool: [],
  setTalentPool: noop,
  addTalentToPool: noop,
  updateTalentInPool: noop,
  removeTalentFromPool: noop,
  shortlistTalentForCharacter: noop,
  passTalentForCharacter: noop,
  starTalentForCharacter: noop,
  navLayout: 'vertical',
  setNavLayout: noop,
  themeAnimationStyle: 'circle',
  setThemeAnimationStyle: noop,
  appZoomLevel: 1.0,
  setAppZoomLevel: noop,
  cloudSyncStatus: {
    isUploading: false,
    progress: 100,
    status: 'synced',
    message: 'Synced',
    lastSyncedAt: null,
  },
  fileHandle: null,
  filePath: null,
  triggerCloudSync: async () => {},
  openrouterKey: '',
  setOpenrouterKey: noop,
  generalAiModel: 'google/gemini-2.0-flash-exp:free',
  setGeneralAiModel: noop,
  characterDesignLocked: false,
  setCharacterDesignLocked: noop,
  hasUnsavedChanges: false,
  setHasUnsavedChanges: noop,
  login: async () => {},
  loginWithSupabase: async () => false,
  logout: async () => {},
  selectProject: async () => {},
  createProject: async () => {},
  deleteProject: async () => {},
  renameProject: async () => false,
  closeProject: noop,
  clearSchemaError: noop,
  refreshProjects: async () => {},
  publishProjectToCloud: async () => false,
  setBeats: noop,
  setGroups: noop,
  setConnections: noop,
  setAnnotations: noop,
  setCharacterData: noop,
  setGeneratedShots: noop,
  setScratchpad: noop,
  setGlobalNotes: noop,
  updateGeneratedShot: noop,
  addGeneratedShot: noop,
  removeGeneratedShot: noop,
  moveGeneratedShot: noop,
  setPan: noop,
  setScale: noop,
  updateBeat: noop,
  addBeat: () => 0,
  reorderBeats: noop,
  addGroup: noop,
  updateGroup: noop,
  removeGroup: noop,
  loadProject: noop,
  saveProject: async () => {},
  saveProjectAs: async () => {},
  setActiveBoardId: noop,
  setTamilMode: noop,
  setTamilFontScale: noop,
  setTamilFontFamily: noop,
  learnTamilWord: noop,
  setOsInputMode: noop,
  setOsInputShortcut: noop,
  setScriptConfig: noop,
  setScriptViewMode: noop,
  setScratchpadConfig: noop,
  setStoryboardConfig: noop,
  setStoryboardFeatureEnabled: noop,
  setAppTheme: noop,
  setAppAccentColor: noop,
  setAppLanguage: noop,
  setBreakdownLanguage: noop,
  setBreakdownLockedOnly: noop,
  setPdfDropEnabled: noop,
  setRedoEnabled: noop,
  setWritingGoal: noop,
  setGeminiApiKey: noop,
  setBoardLayerOrder: noop,
  setNextId: noop,
  undo: noop,
  redo: noop,
  canUndo: false,
  canRedo: false,
  captureSnapshot: noop,
  downloadProject: noop,
  autoGenerate5Scenes: noop,
  autoGenerateScenes: noop,
  setFilePath: noop,
};

export const useProject = (keys?: readonly (keyof ProjectContextType)[]): ProjectContextType => {
  const store = useContext(ProjectContext) as ReturnType<typeof createProjectStore> | undefined;
  const previous = useRef<ProjectContextType | null>(null);
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const getSnapshot = useCallback(() => {
    const next = store?.getSnapshot() || fallbackProjectContextValue;
    const old = previous.current;
    if (old && keysRef.current && keysRef.current.every(key => Object.is(old[key], next[key]))) return old;
    previous.current = next;
    return next;
  }, [store]);
  const subscribe = useCallback((listener: () => void) => store ? store.subscribe(listener) : () => {}, [store]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
