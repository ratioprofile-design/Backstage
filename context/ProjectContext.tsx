
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
import { getProductionDocuments, saveProductionDocuments, mergeProductionDocuments, syncDocumentsWithCloud } from '../services/documentsStorage';
import { saveLargeProject, loadLargeProject, loadLargeDocuments } from '../services/largeStorage';
import { optimizeTalentForCloud } from '../services/imageOptimizer';

const ProjectContext = (typeof window !== 'undefined' && (window as any).__BACKSTAGE_PROJECT_CONTEXT__)
  ? (window as any).__BACKSTAGE_PROJECT_CONTEXT__
  : createContext<ProjectContextType | undefined>(undefined);

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
  // Auth State
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('currentUser') || 'Default User');
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => localStorage.getItem('currentProjectId') || 'empty-project');
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
        localStorage.setItem('user_role', JSON.stringify(parsed));
      }
    }
  }, [supabaseUser]);

  const updateUserRole = useCallback(async (roles: ('writer' | 'director' | 'producer' | 'ad' | 'cinematographer')[]) => {
    setUserRole(roles);
    localStorage.setItem('user_role', JSON.stringify(roles));
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
  const [filePath, setFilePath] = useState<string | null>(null);

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
  const isSavingRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const isRemoteUpdateRef = useRef(false); // Flag to prevent remote data from triggering "unsaved changes"
  const isImportingRef = useRef(false); // Flag to prevent window focus from wiping freshly imported projects
  const cloudOfflineRef = useRef(false);
  const realtimeChannelRef = useRef<any>(null);

  // Update refs when state changes
  useEffect(() => { isSavingRef.current = isSaving; }, [isSaving]);
  useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);
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
    return (localStorage.getItem('app_theme_animation') as ThemeAnimationStyle) || INITIAL_STATE.themeAnimationStyle || 'circle';
  });
  const themeAnimationStyleRef = useRef(themeAnimationStyle);
  useEffect(() => { themeAnimationStyleRef.current = themeAnimationStyle; }, [themeAnimationStyle]);

  const setThemeAnimationStyle = useCallback((style: ThemeAnimationStyle) => {
    themeAnimationStyleRef.current = style;
    setThemeAnimationStyleState(style);
    localStorage.setItem('app_theme_animation', style);
    setHasUnsavedChanges(true);
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
      localStorage.setItem('app_zoom_level', String(clamped));
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
    const updateThemeState = () => {
      setAppThemeState(theme);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('app_theme', theme);
      }

      // Synchronize screenplay paperTheme when switching app theme
      // When switching to dark mode, paper style switches to dark mode
      // When switching to light mode, paper style switches to white
      const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const targetPaper: 'dark' | 'white' = isDark ? 'dark' : 'white';

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('user_pref_paper_theme', targetPaper);
      }

      setScriptConfig(prev => ({
        ...prev,
        paperTheme: targetPaper,
      }));

      // Synchronously update document classes so snapshot captures the new state
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

      setHasUnsavedChanges(true);
    };

    // Check if View Transition API is supported and user hasn't requested reduced motion
    const canViewTransition =
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      typeof (document as any).startViewTransition === 'function' &&
      typeof window !== 'undefined' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canViewTransition) {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.add('theme-transitioning');
        setTimeout(() => {
          document.documentElement.classList.remove('theme-transitioning');
        }, 500);
      }
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

      const style = themeAnimationStyleRef.current || 'circle';
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
        duration: 460,
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
          duration: 440,
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
          duration: 440,
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
          duration: 460,
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
          duration: 480,
          easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
          pseudoElement: '::view-transition-new(root)'
        };
      } else if (style === 'dissolve') {
        keyframes = {
          opacity: [0, 1],
          transform: ['scale(0.98)', 'scale(1)']
        };
        animOptions = {
          duration: 360,
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
    localStorage.setItem('app_accent', color);
    setHasUnsavedChanges(true);
  }, []);

  const setAppLanguage = useCallback((lang: 'english' | 'tamil' | 'spanish' | 'french' | 'german') => {
    setAppLanguageState(lang);
    localStorage.setItem('app_language', lang);
    setHasUnsavedChanges(true);
  }, []);

  // Navigation Layout State ('horizontal' | 'vertical')
  const [navLayout, setNavLayoutState] = useState<'horizontal' | 'vertical'>(() => {
    return (localStorage.getItem('app_nav_layout') as any) || INITIAL_STATE.navLayout || 'vertical';
  });

  const setNavLayout = useCallback((layout: 'horizontal' | 'vertical') => {
    setNavLayoutState(layout);
    localStorage.setItem('app_nav_layout', layout);
    setHasUnsavedChanges(true);
  }, []);

  // Monitor Supabase Auth & OAuth Callbacks
  useEffect(() => {
    console.log('[ctx] auth effect running, isSupabaseConfigured=', isSupabaseConfigured);
    if (!isSupabaseConfigured) {
        setIsInitialLoading(false);
        return;
    }

    let isMounted = true;

    // Safety timeout: release splash screen within 2.5s even if network or auth hangs
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsInitialLoading(false);
      }
    }, 600);

    const initAuth = async () => {
      try {
        // Handle OAuth callback parameters (?code=... or #access_token=...) from Supabase / Google
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          const code = url.searchParams.get('code');
          const errorParam = url.searchParams.get('error') || url.searchParams.get('error_description');

          if (errorParam) {
            console.warn('[ctx] OAuth error in URL:', errorParam);
            url.searchParams.delete('error');
            url.searchParams.delete('error_description');
            url.searchParams.delete('error_code');
            window.history.replaceState({}, document.title, url.pathname + (url.search ? '?' + url.searchParams.toString() : ''));
          } else if (code) {
            console.log('[ctx] Exchanging OAuth code for session...');
            try {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (error) {
                console.warn('[ctx] exchangeCodeForSession failed:', error.message);
              } else if (data?.session) {
                console.log('[ctx] OAuth exchange succeeded for:', data.session.user.email);
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

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        clearTimeout(safetyTimer);
        if (!isMounted) return;
        
        if (session) {
          setSupabaseUser(session.user);
          setCurrentUser(session.user.email || 'Cloud User');
          localStorage.setItem('currentUser', session.user.email || 'Cloud User');
          setCloudOffline(false);
          refreshProjectList(session.user.id, session.user.email || undefined).catch(e => console.warn('[ctx] refreshProjectList failed:', e));
        } else {
          const savedUser = localStorage.getItem('currentUser');
          if (savedUser) {
            setCurrentUser(savedUser);
          }
        }
      } catch (err) {
        clearTimeout(safetyTimer);
        if (!isMounted) return;
        console.warn('[ctx] getSession error, falling back to offline mode:', err);
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
          setCurrentUser(savedUser);
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
        localStorage.setItem('currentUser', session.user.email || 'Cloud User');
        setCloudOffline(false);
        refreshProjectList(session.user.id, session.user.email || undefined).catch(e => console.warn('[ctx] refreshProjectList failed:', e));
      } else {
        setSupabaseUser(null);
        if (_event === 'SIGNED_OUT') {
          setCurrentUser(null);
          localStorage.removeItem('currentUser');
          setProjectList([]);
        } else {
          const savedUser = localStorage.getItem('currentUser');
          if (savedUser) {
            setCurrentUser(savedUser);
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

  const applyProjectState = useCallback((data: any, options?: { projectName?: string; targetProjectId?: string }) => {
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

    isRemoteUpdateRef.current = true; // Block auto-save trigger
    
    const finalTracks = importedTracks || cleanData.tracks;

    // Remove legacy un-namespaced tracks key to prevent cross-project contamination
    try {
      localStorage.removeItem('backstage_daw_tracks');
    } catch (e) {}

    // If this is an imported Causality project or an explicit new project import, register in projectList and switch active ID
    if (isCausality || options?.projectName) {
      const newProjId = `proj_${Date.now()}`;
      const projName = options?.projectName || (cleanData as any).projectName || 'Imported Causality Story';
      const newMeta: ProjectMetadata = {
        id: newProjId,
        name: projName,
        created: Date.now(),
        lastModified: Date.now()
      };

      setCurrentProjectId(newProjId);
      localStorage.setItem('currentProjectId', newProjId);
      
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

      try {
        localStorage.setItem(`project_data_${newProjId}`, JSON.stringify(cleanData));
      } catch (e) {}

      setProjectList(prev => {
        const updated = [newMeta, ...prev.filter(p => p.id !== newProjId)];
        localStorage.setItem('projectList', JSON.stringify(updated));
        return updated;
      });

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
      if (typeof localStorage !== 'undefined') localStorage.setItem('app_theme', cleanData.appTheme);
    }
    if (cleanData.appAccentColor) setAppAccentColorState(cleanData.appAccentColor);
    if (cleanData.appLanguage) setAppLanguageState(cleanData.appLanguage);
    if (cleanData.themeAnimationStyle) {
      setThemeAnimationStyleState(cleanData.themeAnimationStyle);
      localStorage.setItem('app_theme_animation', cleanData.themeAnimationStyle);
    }
    if (cleanData.navLayout) {
      setNavLayoutState(cleanData.navLayout);
      localStorage.setItem('app_nav_layout', cleanData.navLayout);
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
    
    // Reset the flag after a timeout to allow state to settle
    setTimeout(() => { 
      isRemoteUpdateRef.current = false; 
      isImportingRef.current = false;
      setHasUnsavedChanges(false); 
    }, 1000);
  }, [currentProjectId]);

  // REALTIME SUBSCRIPTION FOR INSTANT UPDATES
  useEffect(() => {
    if (!isSupabaseConfigured || !currentProjectId || !supabaseUser) return;

    // Stable listener that doesn't close/reopen on every state change
    const channel = supabase
      .channel(`project_changes_${currentProjectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${currentProjectId}`
        },
        (payload: any) => {
          const newData = payload.new?.data;
          if (!newData) return;

          // 1. Ignore if WE are the ones who sent this update
          if (newData.lastInstanceId === INSTANCE_ID) return;

          // Always merge documents across collaborators non-destructively
          if (Array.isArray(newData.documents) && newData.documents.length > 0) {
            const currentDocs = getProductionDocuments(currentProjectId);
            const merged = mergeProductionDocuments(currentDocs, newData.documents);
            saveProductionDocuments(merged, currentProjectId, true);
          }

          // 2. Only pull remote changes if we don't have local unsaved work
          // or if we are idle. This prevents "writing over" current progress.
          if (!hasUnsavedChangesRef.current && !isSavingRef.current) {
            console.log("Remote sync: Updating local state with latest from database.");
            applyProjectState(newData);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'project_updated' },
        (payload: any) => {
          const broadcastData = payload.payload?.data || payload.data;
          const remoteInstance = payload.payload?.lastInstanceId || payload.lastInstanceId;
          if (!broadcastData || remoteInstance === INSTANCE_ID) return;

          // Always merge documents across collaborators non-destructively
          if (Array.isArray(broadcastData.documents) && broadcastData.documents.length > 0) {
            const currentDocs = getProductionDocuments(currentProjectId);
            const merged = mergeProductionDocuments(currentDocs, broadcastData.documents);
            saveProductionDocuments(merged, currentProjectId, true);
          }

          if (!hasUnsavedChangesRef.current && !isSavingRef.current) {
            console.log("Realtime broadcast: Updating local state from collaborator.");
            applyProjectState(broadcastData);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'project_renamed' },
        (payload: any) => {
          const data = payload.payload || payload.data || payload;
          if (data?.id && data?.newName) {
            if (currentProjectId === data.id) {
              setCurrentProjectName(data.newName);
              try {
                localStorage.setItem(`project_name_${data.id}`, data.newName);
              } catch (e) {}
            }
            setProjectList(prev => {
              const updated = prev.map(p => p.id === data.id ? { ...p, name: data.newName, lastModified: Date.now() } : p);
              try { localStorage.setItem('projectList', JSON.stringify(updated)); } catch (e) {}
              return updated;
            });
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    // Periodic fallback polling to guarantee sync between collaborators (every 8s)
    const pollInterval = setInterval(async () => {
      if (hasUnsavedChangesRef.current || isSavingRef.current) return;
      try {
        const remote = await fetchProjectData(currentProjectId);
        if (remote && remote.lastInstanceId && remote.lastInstanceId !== INSTANCE_ID) {
          applyProjectState(remote);
        }
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

      // 2. Background non-blocking migration of any unsaved local offline projects to Supabase.
      // We NEVER block the UI, sign-in, or project loading on this bulk upload!
      const localListRaw = localStorage.getItem('projectList');
      if (localListRaw) {
        queueMicrotask(async () => {
          try {
            const localList = JSON.parse(localListRaw) as ProjectMetadata[];
            if (localList.length > 0) {
              for (const localProj of localList) {
                const localDataRaw = localStorage.getItem(`project_data_${localProj.id}`);
                const localData = localDataRaw ? JSON.parse(localDataRaw) : INITIAL_STATE;
                await upsertProject(localProj.id, userId, localProj.name, localData);
                localStorage.removeItem(`project_data_${localProj.id}`);
              }
              localStorage.removeItem('projectList');
            }
          } catch (syncErr) {
            console.warn("[sync] Background unsynced projects migration failed:", syncErr);
          }
        });
      }

      // 3. Concurrently fetch owned projects and invited projects in parallel!
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

      setProjectList(combined);
      try {
        localStorage.setItem(`cached_cloud_projects_${userId}`, JSON.stringify(combined));
      } catch {}

      // 4. Cross-device sync / hydration:
      // Respect if user closed project or is on welcome screen!
      const isClosed = typeof localStorage !== 'undefined' && localStorage.getItem('backstage_project_closed') === 'true';
      if (combined.length > 0 && selectProjectRef.current && !isClosed) {
        const curId = currentProjectId || (typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') : null);
        const isValidCurrent = curId && curId !== 'empty-project' && combined.some(p => p.id === curId);

        if (isValidCurrent && curId) {
          // Hydrate active project state from cloud silently
          await selectProjectRef.current(curId, { silent: true });
        } else if (!curId || curId === 'empty-project') {
          // Auto-select latest cloud project silently so we never freeze the screen with a spinner!
          const targetProj = combined[0];
          await selectProjectRef.current(targetProj.id, { silent: true });
        }
      }
    } catch (err: any) {
      if (err.code === '42P01') setSchemaError("TABLE_MISSING");
      else if (err.code === '42703' || err.message?.includes('data')) setSchemaError("COLUMN_MISSING");
    }
  };

  // --- UNDO / REDO ENGINE ---
  const historyRef = useRef<string[]>([]);
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
    const snapshot = JSON.stringify(currentProjectState);
    if (historyIndexRef.current >= 0 && historyRef.current[historyIndexRef.current] === snapshot) return;
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(snapshot);
    if (newHistory.length > 50) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setHasUnsavedChanges(true);
  }, [
    beats, groups, connections, annotations, characterData, generatedShots, 
    scratchpad, globalNotes, activeBoardId,
    isTamilMode, scriptConfig, scriptViewMode, scratchpadConfig,
    storyboardConfig, isStoryboardFeatureEnabled, breakdownLanguage,
    breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal,
    boardLayerOrder, nextId, nextAnnoId,
    dailyStats, sessionStartCount, lastSessionDate
  ]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      isTimeTraveling.current = true;
      historyIndexRef.current--;
      applyProjectState(JSON.parse(historyRef.current[historyIndexRef.current]));
      setTimeout(() => { isTimeTraveling.current = false; }, 100);
    }
  }, [applyProjectState]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      isTimeTraveling.current = true;
      historyIndexRef.current++;
      applyProjectState(JSON.parse(historyRef.current[historyIndexRef.current]));
      setTimeout(() => { isTimeTraveling.current = false; }, 100);
    }
  }, [applyProjectState]);

  const login = (username: string) => {
    localStorage.setItem('currentUser', username);
    setCurrentUser(username);
  };

  const logout = async () => {
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
    localStorage.removeItem('currentProjectId');
    try {
      localStorage.setItem('backstage_project_closed', 'true');
    } catch {}
    setFileHandle(null);
    setFilePath(null);
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
    localStorage.setItem(`project_name_${id}`, name);

    if (supabaseUser) {
      try {
        await upsertProject(id, supabaseUser.id, name, emptyState);
        await refreshProjectList(supabaseUser.id);
      } catch (err: any) {
        if (err.code === '42P01') setSchemaError("TABLE_MISSING");
        else if (err.code === '42703' || err.message?.includes('data')) setSchemaError("COLUMN_MISSING");
        return;
      }
    } else {
      const newProject: ProjectMetadata = { id, name, created: Date.now(), lastModified: Date.now() };
      setProjectList(prev => {
        const updated = [newProject, ...prev];
        localStorage.setItem('projectList', JSON.stringify(updated));
        return updated;
      });
      localStorage.setItem(`project_data_${id}`, JSON.stringify(emptyState));
    }
    selectProject(id);
  };

  const selectProject = async (id: string, opts?: { silent?: boolean }) => {
    setFileHandle(null);
    let resolvedName = '';
    let isInvitedProj = false;

    if (!opts?.silent) {
      setIsProjectLoading(true);
      const existingInList = projectList.find(p => p.id === id);
      const knownName = existingInList?.name || localStorage.getItem(`project_name_${id}`) || 'Screenplay';
      setProjectLoadingMessage(`Syncing "${knownName}" from Backstage Cloud...`);
    }

    try {
      if (supabaseUser) {
        try {
          const data = await fetchProjectData(id);
          const cleanData = data || INITIAL_STATE;
          
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
          else if (!opts?.silent) applyProjectState(INITIAL_STATE);
        }
      } else {
        let localState = null;
        try {
          const dataStr = localStorage.getItem(`project_data_${id}`);
          if (dataStr) localState = JSON.parse(dataStr);
        } catch (e) {}

        if (!localState) {
          try {
            const idbState = await loadLargeProject(id);
            if (idbState) localState = idbState;
          } catch (e) {}
        }

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

  // Sync on window focus (cloud mode only — the local window is the sole writer otherwise,
  // and re-fetching can overwrite in-progress work with stale storage/file data)
  useEffect(() => {
      const handleFocus = () => {
          if (isImportingRef.current) return;
          if (supabaseUser && currentProjectId && !hasUnsavedChangesRef.current && !isSavingRef.current) {
              selectProject(currentProjectId, { silent: true });
          }
      };
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
  }, [supabaseUser, currentProjectId, selectProject]);

  const deleteProject = async (id: string) => {
    if (supabaseUser) {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (!error) await refreshProjectList(supabaseUser.id);
    } else {
      setProjectList(prev => {
        const updated = prev.filter(p => p.id !== id);
        localStorage.setItem('projectList', JSON.stringify(updated));
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
        localStorage.setItem('projectList', JSON.stringify(updated));
        return updated;
      });
      localStorage.setItem(`project_name_${id}`, trimmed);
    }

    if (currentProjectId === id) {
      setCurrentProjectName(trimmed);
      localStorage.setItem(`project_name_${id}`, trimmed);
    }
    return true;
  };

  const saveProject = useCallback(async () => {
    if (isRemoteUpdateRef.current) return;
    setIsSaving(true);
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
        const idbDocs = await loadLargeDocuments(currentProjectId);
        if (idbDocs && Array.isArray(idbDocs) && idbDocs.length > 0) {
          currentDocs = mergeProductionDocuments(currentDocs, idbDocs);
        }
      } catch (e) {}
    }

    const projectData: ProjectState & { lastInstanceId?: string; documents?: any[] } = {
      beats, groups, connections, annotations, characterData, generatedShots, 
      scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
      isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
      scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
      writingGoal, geminiApiKey: '', openrouterKey, generalAiModel, 
      dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder,
      characterDesignLocked,
      collaborators,
      talentPool,
      appTheme,
      themeAnimationStyle,
      documents: currentDocs,
      lastInstanceId: INSTANCE_ID // Tag the update with this instance ID
    };
    let saved = false;
    let cloudFailed = false;

    // 1. Unlimited Local Database (IndexedDB) & Disk Backup
    // Always persist to local IndexedDB and disk first so nothing is EVER lost regardless of cloud status
    const idbSaved = await saveLargeProject(currentProjectId || 'empty-project', projectData);
    if (idbSaved) saved = true;

    try {
      fetch('/api/talent/backup-disk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      }).catch(() => {});
    } catch (e) {}

    // 2. Cloud (when signed in to Supabase)
    let cloudErrorDetail: string | null = null;
    if (supabaseUser) {
      try {
        setCloudSyncStatus(prev => ({
          ...prev,
          progress: 55,
          message: 'Optimizing headshots for Supabase...'
        }));
        // Deduplicate and sanitize cloud documents so cloud payload is under 3.5MB:
        // 1. If pdfDataUrl exists, drop duplicate originalFileDataUrl
        // 2. If image, drop raw camera originalFileDataUrl and keep thumbnailDataUrl + optimized imageDataUrl
        // 3. Keep thumbnailDataUrl always intact for instant visual rendering across laptops
        const MAX_INLINE_BINARY_CHARS = 2800000;
        const sanitizedCloudDocs = (currentDocs || []).map((doc: any) => {
          if (!doc) return doc;
          const clean = { ...doc };
          if (clean.pdfDataUrl) clean.originalFileDataUrl = undefined;
          if (clean.fileType === 'image') clean.originalFileDataUrl = undefined;
          if (clean.convertedDocxDataUrl && clean.convertedDocxDataUrl === clean.originalFileDataUrl) clean.originalFileDataUrl = undefined;
          if (clean.pdfDataUrl && !clean.pdfDataUrl.startsWith('http') && clean.pdfDataUrl.length > MAX_INLINE_BINARY_CHARS) clean.pdfDataUrl = undefined;
          if (clean.originalFileDataUrl && !clean.originalFileDataUrl.startsWith('http') && clean.originalFileDataUrl.length > MAX_INLINE_BINARY_CHARS) clean.originalFileDataUrl = undefined;
          if (clean.convertedDocxDataUrl && !clean.convertedDocxDataUrl.startsWith('http') && clean.convertedDocxDataUrl.length > MAX_INLINE_BINARY_CHARS) clean.convertedDocxDataUrl = undefined;
          if (clean.imageDataUrl && !clean.imageDataUrl.startsWith('http') && clean.imageDataUrl.length > 800000) clean.imageDataUrl = clean.thumbnailDataUrl || undefined;
          if (!clean.thumbnailDataUrl && clean.imageDataUrl && clean.imageDataUrl.length < 50000) clean.thumbnailDataUrl = clean.imageDataUrl;
          if (clean.htmlContent && clean.htmlContent.length > 30000 && clean.htmlContent.includes('Sign in - Google Accounts')) clean.htmlContent = '<p>Production Spreadsheet Data</p>';
          return clean;
        });

        const cloudPayload = {
          ...projectData,
          talentPool: projectData.talentPool || talentPool,
          documents: sanitizedCloudDocs
        };

        // Broadcast IMMEDIATELY to active collaborators on the project channel
        if (realtimeChannelRef.current) {
          try {
            realtimeChannelRef.current.send({
              type: 'broadcast',
              event: 'project_updated',
              payload: {
                lastInstanceId: INSTANCE_ID,
                data: cloudPayload
              }
            });
          } catch (e) {}
        }

        setCloudSyncStatus(prev => ({
          ...prev,
          progress: 80,
          message: 'Uploading to Supabase Cloud...'
        }));
        const project = projectList.find(p => p.id === currentProjectId);
        await upsertProject(currentProjectId, supabaseUser.id, project?.name || 'Untitled', cloudPayload);
        saved = true;
      } catch (err: any) {
        cloudFailed = true;
        cloudErrorDetail = err?.message || 'Gateway Timeout / Restarting';
        console.error("Cloud save failed (Supabase may be restarting or unreachable):", err);
      }
    }

    // 3. Fallback for Desktop/File handles or small localStorage mirrors
    if (isTauri() && filePath) {
      try {
        const fs = await getTauriFs();
        if (fs) {
          await fs.writeTextFile(filePath, JSON.stringify(projectData, null, 2));
          saved = true;
        }
      } catch (err) {}
    }
    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(projectData, null, 2));
        await writable.close();
        saved = true;
      } catch (err) {}
    }
    if (currentProjectId) {
      try {
        localStorage.setItem(`project_data_${currentProjectId}`, JSON.stringify(projectData));
      } catch (err) {
        // Expected to throw if over 5MB; IndexedDB above has already safely stored it
      }
    }

    setCloudOffline(cloudFailed);
    if (saved) {
      setHasUnsavedChanges(false);
      if (currentProjectId) {
        const curName = currentProjectName || localStorage.getItem(`project_name_${currentProjectId}`) || 'Current Screenplay';
        setProjectList(prev => {
          const existing = prev.find(p => p.id === currentProjectId);
          const updatedMeta: ProjectMetadata = {
            id: currentProjectId,
            name: curName,
            lastModified: Date.now(),
            created: existing?.created || Date.now()
          };
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
          message: '⚠️ All actors saved locally to disk. Supabase project is paused (521) — restore at supabase.com',
          lastSyncedAt: new Date()
        });
      } else {
        setCloudSyncStatus({
          isUploading: false,
          progress: 100,
          status: supabaseUser ? 'synced' : 'local_only',
          message: supabaseUser 
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
    setTimeout(() => setIsSaving(false), 200);
  }, [
    currentProjectId, projectList, beats, groups, connections, annotations, characterData, 
    generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
    isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut,
    scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
    breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, openrouterKey, generalAiModel,
    dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, characterDesignLocked, supabaseUser, fileHandle, filePath,
    talentPool, collaborators
  ]);

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
      writingGoal, geminiApiKey: '', openrouterKey, generalAiModel, 
      dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder,
      characterDesignLocked,
      themeAnimationStyle,
      lastInstanceId: INSTANCE_ID // Tag the update with this instance ID
    };
    if (isTauri()) {
      try {
        const dialog = await getTauriDialog();
        const project = projectList.find(p => p.id === currentProjectId);
        const fileName = `${(project?.name || 'Untitled').replace(/\s+/g, '_').toLowerCase()}.bst`;
        if (dialog) {
          const selected = await dialog.save({
            filters: [{ name: 'Backstage File', extensions: ['bst'] }],
            defaultPath: fileName
          });
          if (selected) {
            setFilePath(selected);
            const fs = await getTauriFs();
            if (fs) {
              await fs.writeTextFile(selected, JSON.stringify(projectData, null, 2));
            }
            setHasUnsavedChanges(false);
            addRecentFile(selected, fileName.replace(/\.bst$/i, ''));
            if (currentProjectId) {
              localStorage.setItem(`project_data_${currentProjectId}`, JSON.stringify(projectData));
            }
            localStorage.setItem('backstage_last_session', JSON.stringify(projectData));
          }
        }
      } catch (err) {
        console.error("Tauri saveAs error", err);
      }
    } else {
      try {
        const project = projectList.find(p => p.id === currentProjectId);
        const fileName = `${(project?.name || 'Untitled').replace(/\s+/g, '_').toLowerCase()}.bst`;
        // @ts-ignore
        const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Backstage File', accept: { 'application/json': ['.bst'] } }] });
        setFileHandle(handle);
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(projectData, null, 2));
        await writable.close();
        setHasUnsavedChanges(false);
        addRecentFile(handle.name, fileName.replace(/\.bst$/i, ''));
        if (currentProjectId) {
          localStorage.setItem(`project_data_${currentProjectId}`, JSON.stringify(projectData));
        }
        localStorage.setItem('backstage_last_session', JSON.stringify(projectData));
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
    if (hasUnsavedChanges && !isRemoteUpdateRef.current) {
      const timer = setTimeout(() => { saveProject(); }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, saveProject]);

  const downloadProject = useCallback(() => {
    if (!currentProjectId) return;
    const projectData = { beats, groups, connections, annotations, characterData, generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId, isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled, breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, geminiApiKey: '', openrouterKey, generalAiModel, dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, characterDesignLocked };
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
    beats, groups, connections, annotations, characterData, generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId, isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,     breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, geminiApiKey: '', openrouterKey, setOpenrouterKey, generalAiModel, setGeneralAiModel, dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, characterDesignLocked, setCharacterDesignLocked: setCharacterDesignLockedWrapped, appTheme, appAccentColor, appLanguage, currentUser, currentProjectId, projectList, hasUnsavedChanges, schemaError, isSaving, fileHandle, filePath, setFilePath, isInitialLoading, isProjectLoading, projectLoadingMessage, isCloudMode: !!supabaseUser, supabaseUser, cloudOffline, login, logout, selectProject, createProject, deleteProject, renameProject, closeProject, clearSchemaError: () => { setSchemaError(null); if (supabaseUser) refreshProjectList(supabaseUser.id); }, setBeats: setBeatsWrapped, setGroups: setGroupsWrapped, setConnections: setConnectionsWrapped, setAnnotations: setAnnotationsWrapped, setCharacterData: setCharacterDataWrapped, setGeneratedShots, setScratchpad: setScratchpadWrapped, setGlobalNotes: setGlobalNotesWrapped, updateGeneratedShot: (id, u) => { setGeneratedShots(p => p.map(s => s.id === id ? { ...s, ...u } : s)); setHasUnsavedChanges(true); }, addGeneratedShot: (i) => { const n = { id: `shot-${Date.now()}`, shotSize: 'WIDE', angle: 'EYE LEVEL', description: '', subject: '', scene: '?', imageHistory: [] }; const s = [...generatedShots]; s.splice(i + 1, 0, n); setGeneratedShots(s); captureSnapshot(); }, removeGeneratedShot: (id) => { setGeneratedShots(p => p.filter(s => s.id !== id)); captureSnapshot(); }, moveGeneratedShot: (f, t) => { const s = [...generatedShots]; const [m] = s.splice(f, 1); s.splice(t, 0, m); setGeneratedShots(s); captureSnapshot(); }, setPan: (x, y) => { setPanX(x); setPanY(y); }, setScale, updateBeat, addBeat, reorderBeats, addGroup: (g) => { const id = nextId; setNextId(p => p + 1); setGroups(p => [...p, { ...g, id, boardId: activeBoardId }]); captureSnapshot(); }, updateGroup: (id, u) => { setGroups(p => p.map(g => g.id === id ? { ...g, ...u } : g)); setHasUnsavedChanges(true); }, removeGroup: (id) => { setGroups(p => p.filter(g => g.id !== id)); captureSnapshot(); }, loadProject: applyProjectState, saveProject, saveProjectAs, setActiveBoardId, setTamilMode, setTamilFontScale, setTamilFontFamily: setTamilFontFamilyWrapped, learnTamilWord: (e, t) => { setUserDictionary(p => { const c = p[e.toLowerCase()] || []; if (!c.includes(t)) return { ...p, [e.toLowerCase()]: [t, ...c] }; return p; }); }, setOsInputMode, setOsInputShortcut, setScriptConfig: setScriptConfigWrapped, setScriptViewMode, setScratchpadConfig, setStoryboardConfig, setStoryboardFeatureEnabled, setAppTheme, setAppAccentColor, setAppLanguage, setBreakdownLanguage, setBreakdownLockedOnly, setPdfDropEnabled, setRedoEnabled, setWritingGoal, setGeminiApiKey: () => {}, setBoardLayerOrder, setNextId, undo, redo, canUndo: historyIndexRef.current > 0, canRedo: historyIndexRef.current < historyRef.current.length - 1, captureSnapshot, downloadProject, autoGenerate5Scenes, autoGenerateScenes,
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
    isCurrentProjectShared: Boolean(projectList.find(p => p.id === currentProjectId)?.isInvited),
    setHasUnsavedChanges
  };

  if (typeof window !== 'undefined') {
    (window as any).__BACKSTAGE_PROJECT_CONTEXT_VALUE__ = value;
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

const noop = () => {};
const fallbackProjectContextValue: ProjectContextType = {
  ...INITIAL_STATE,
  currentUser: 'Default User',
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
  logout: async () => {},
  selectProject: async () => {},
  createProject: async () => {},
  deleteProject: async () => {},
  renameProject: async () => false,
  closeProject: noop,
  clearSchemaError: noop,
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

export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    if (typeof window !== 'undefined' && (window as any).__BACKSTAGE_PROJECT_CONTEXT_VALUE__) {
      return (window as any).__BACKSTAGE_PROJECT_CONTEXT_VALUE__;
    }
    console.warn('[ProjectContext] useProject called outside of ProjectProvider or during HMR transition. Using fallback state.');
    return fallbackProjectContextValue;
  }
  return context;
};
