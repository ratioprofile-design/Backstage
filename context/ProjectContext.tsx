
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  ProjectState, ProjectContextType, Beat, Group, Connection, Annotation, 
  CharacterData, Shot, Note, ScriptConfig, ScratchpadConfig, StoryboardConfig, 
  WritingGoal, ProjectMetadata, BeatStatus, BeatVersion,
  BoardLayer
} from '../types';
import { INITIAL_STATE } from '../constants';
import { supabase, upsertProject, fetchProjectData, fetchUserProjects, fetchInvitedProjects, isSupabaseConfigured } from '../services/supabase';
import { createAuto5ScenesDataset, createAutoScenesDataset } from '../services/sampleGenerator';
import { isTauri, getTauriFs, getTauriDialog, getTauriWindow } from '../utils/desktop';
import { addRecentFile } from '../utils/recentFiles';

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

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
  const [projectList, setProjectList] = useState<ProjectMetadata[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [cloudOffline, setCloudOffline] = useState(false);
  const [userRole, setUserRole] = useState<('writer' | 'director' | 'producer' | 'ad' | 'cinematographer')[] | null>(() => {
    const raw = localStorage.getItem('user_role');
    if (!raw) return null;
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
  const cloudOfflineRef = useRef(false);

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
  const [tamilFontFamily, setTamilFontFamily] = useState(INITIAL_STATE.tamilFontFamily);
  const [userDictionary, setUserDictionary] = useState(INITIAL_STATE.userDictionary);
  const [isOsInputMode, setOsInputMode] = useState(INITIAL_STATE.isOsInputMode);
  const [osInputShortcut, setOsInputShortcut] = useState(INITIAL_STATE.osInputShortcut);
  const [scriptConfig, setScriptConfig] = useState<ScriptConfig>(INITIAL_STATE.scriptConfig);
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

  // App Appearance & Customization State
  const [appTheme, setAppThemeState] = useState<'dark' | 'light' | 'system'>(() => {
    return (localStorage.getItem('app_theme') as any) || INITIAL_STATE.appTheme || 'dark';
  });
  const [appAccentColor, setAppAccentColorState] = useState<string>(() => {
    return localStorage.getItem('app_accent') || INITIAL_STATE.appAccentColor || '#f5a623';
  });
  const [appLanguage, setAppLanguageState] = useState<'english' | 'tamil' | 'spanish' | 'french' | 'german' | 'hindi'>(() => {
    return (localStorage.getItem('app_language') as any) || INITIAL_STATE.appLanguage || 'english';
  });

  const setAppTheme = useCallback((theme: 'dark' | 'light' | 'system') => {
    setAppThemeState(theme);
    localStorage.setItem('app_theme', theme);
    setHasUnsavedChanges(true);
  }, []);

  const setAppAccentColor = useCallback((color: string) => {
    setAppAccentColorState(color);
    localStorage.setItem('app_accent', color);
    setHasUnsavedChanges(true);
  }, []);

  const setAppLanguage = useCallback((lang: 'english' | 'tamil' | 'spanish' | 'french' | 'german' | 'hindi') => {
    setAppLanguageState(lang);
    localStorage.setItem('app_language', lang);
    setHasUnsavedChanges(true);
  }, []);

  // Monitor Supabase Auth
  useEffect(() => {
    console.log('[ctx] auth effect running, isSupabaseConfigured=', isSupabaseConfigured);
    if (!isSupabaseConfigured) {
        setIsInitialLoading(false);
        return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[ctx] getSession result:', session ? `session for ${session.user.email}` : 'no session');
      if (session) {
        setSupabaseUser(session.user);
        setCurrentUser(session.user.email || 'Cloud User');
        setCloudOffline(false);
        refreshProjectList(session.user.id);
      }
      setIsInitialLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[ctx] onAuthStateChange event=', _event, 'session=', session ? `yes ${session.user.email}` : 'no');
      if (session) {
        setSupabaseUser(session.user);
        setCurrentUser(session.user.email || 'Cloud User');
        setCloudOffline(false);
        refreshProjectList(session.user.id);
      } else {
        setSupabaseUser(null);
        if (isSupabaseConfigured) {
            setCurrentUser(null);
            setProjectList([]);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const applyProjectState = useCallback((data: any) => {
    if (!data) return;
    
    // Auto-detect and filter out any preloaded demo datasets
    const hasDemoBeats = Array.isArray(data.beats) && data.beats.some((b: any) => 
      (b.title && (b.title.includes('Cyber-Lab') || b.title.includes('மெரினா') || b.title.includes('அபிராமி') || b.title.includes('Ikaros') || b.title.includes('Vane'))) ||
      (b.content && (b.content.includes('MAYA') || b.content.includes('KALE') || b.content.includes('அபிராமி') || b.content.includes('VANE') || b.content.includes('Ikaros')))
    );

    const cleanData = hasDemoBeats ? INITIAL_STATE : data;

    isRemoteUpdateRef.current = true; // Block auto-save trigger
    
    setBeats(Array.isArray(cleanData.beats) ? cleanData.beats : INITIAL_STATE.beats);
    setGroups(Array.isArray(cleanData.groups) ? cleanData.groups : INITIAL_STATE.groups);
    setConnections(Array.isArray(cleanData.connections) ? cleanData.connections : INITIAL_STATE.connections);
    setAnnotations(Array.isArray(cleanData.annotations) ? cleanData.annotations : INITIAL_STATE.annotations);
    setCharacterData(cleanData.characterData && typeof cleanData.characterData === 'object' ? cleanData.characterData : INITIAL_STATE.characterData);
    setGeneratedShots(Array.isArray(cleanData.generatedShots) ? cleanData.generatedShots : INITIAL_STATE.generatedShots);
    setScratchpad(typeof cleanData.scratchpad === 'string' ? cleanData.scratchpad : INITIAL_STATE.scratchpad);
    setGlobalNotes(Array.isArray(cleanData.globalNotes) ? cleanData.globalNotes : INITIAL_STATE.globalNotes);
    setActiveBoardId(cleanData.activeBoardId ?? INITIAL_STATE.activeBoardId);
    setScriptConfig(cleanData.scriptConfig || INITIAL_STATE.scriptConfig);
    setScriptViewMode(cleanData.scriptViewMode || INITIAL_STATE.scriptViewMode);
    setScratchpadConfig(cleanData.scratchpadConfig || INITIAL_STATE.scratchpadConfig);
    setStoryboardConfig(cleanData.storyboardConfig || INITIAL_STATE.storyboardConfig);
    setGeneralAiModel(cleanData.generalAiModel || INITIAL_STATE.generalAiModel);
    setWritingGoal(cleanData.writingGoal || INITIAL_STATE.writingGoal);
    setBoardLayerOrder(cleanData.boardLayerOrder || INITIAL_STATE.boardLayerOrder);
    setTamilMode(cleanData.isTamilMode ?? INITIAL_STATE.isTamilMode);
    setPdfDropEnabled(cleanData.isPdfDropEnabled ?? INITIAL_STATE.isPdfDropEnabled);
    setRedoEnabled(cleanData.isRedoEnabled ?? INITIAL_STATE.isRedoEnabled);
    setNextId(cleanData.nextId ?? INITIAL_STATE.nextId);
    setNextAnnoId(cleanData.nextAnnoId ?? INITIAL_STATE.nextAnnoId);
    setDailyStats(cleanData.dailyStats || INITIAL_STATE.dailyStats);
    setCharacterDesignLocked(cleanData.characterDesignLocked ?? INITIAL_STATE.characterDesignLocked);
    setCollaborators(cleanData.collaborators || INITIAL_STATE.collaborators || []);
    if (cleanData.appTheme) setAppThemeState(cleanData.appTheme);
    if (cleanData.appAccentColor) setAppAccentColorState(cleanData.appAccentColor);
    if (cleanData.appLanguage) setAppLanguageState(cleanData.appLanguage);
    
    // Reset the flag after a brief timeout to allow state to settle
    setTimeout(() => { isRemoteUpdateRef.current = false; setHasUnsavedChanges(false); }, 50);
  }, []);

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

          // 2. Only pull remote changes if we don't have local unsaved work
          // or if we are idle. This prevents "writing over" current progress.
          if (!hasUnsavedChangesRef.current && !isSavingRef.current) {
            console.log("Remote sync: Updating local state with latest from database.");
            applyProjectState(newData);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProjectId, supabaseUser, applyProjectState]);

  const refreshProjectList = async (userId: string) => {
    try {
      const dbProjects = await fetchUserProjects(userId);
      const email = supabaseUser?.email || '';
      const invited = email ? await fetchInvitedProjects(email) : [];

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
    setFileHandle(null);
    setFilePath(null);
    applyProjectState(INITIAL_STATE);
    setPanX(INITIAL_STATE.panX);
    setPanY(INITIAL_STATE.panY);
    setScale(INITIAL_STATE.scale);
    setHasUnsavedChanges(false);
  }, [applyProjectState]);

  const createProject = async (name: string) => {
    const id = `proj_${Date.now()}`;
    if (supabaseUser) {
      try {
          await upsertProject(id, supabaseUser.id, name, INITIAL_STATE);
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
      localStorage.setItem(`project_data_${id}`, JSON.stringify(INITIAL_STATE));
    }
    selectProject(id);
  };

  const selectProject = async (id: string, opts?: { silent?: boolean }) => {
    setFileHandle(null);
    if (supabaseUser) {
      try {
        const data = await fetchProjectData(id);
        const cleanData = data || INITIAL_STATE;
        applyProjectState(cleanData);

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
            setHasUnsavedChanges(true);
          }
        }
      } catch (err: any) {
        if (err.code === '42P01') setSchemaError("TABLE_MISSING");
        else if (err.code === '42703' || err.message?.includes('data')) setSchemaError("COLUMN_MISSING");
        else if (!opts?.silent) applyProjectState(INITIAL_STATE);
      }
    } else {
      const dataStr = localStorage.getItem(`project_data_${id}`);
      applyProjectState(dataStr ? JSON.parse(dataStr) : INITIAL_STATE);
    }
    setCurrentProjectId(id);
    localStorage.setItem('currentProjectId', id);
  };

  // Sync on window focus (cloud mode only — the local window is the sole writer otherwise,
  // and re-fetching can overwrite in-progress work with stale storage/file data)
  useEffect(() => {
      const handleFocus = () => {
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

  const saveProject = useCallback(async () => {
    if (isRemoteUpdateRef.current) return;
    setIsSaving(true);
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
      collaborators,
      lastInstanceId: INSTANCE_ID // Tag the update with this instance ID
    };
    let saved = false;
    let cloudFailed = false;

    // 1. Cloud (only when signed in) — if the network drops, fall through to local
    if (supabaseUser) {
      try {
        const project = projectList.find(p => p.id === currentProjectId);
        await upsertProject(currentProjectId, supabaseUser.id, project?.name || 'Untitled', projectData);
        saved = true;
      } catch (err) {
        cloudFailed = true;
        console.error("Cloud save failed — falling back to local storage", err);
      }
    }

    // 2. Local fallback (offline cloud, or no cloud user) — the opened .bst file
    //    and the localStorage mirror keep the work safe when Supabase is unreachable.
    if (!saved) {
      if (isTauri() && filePath) {
        try {
          const fs = await getTauriFs();
          if (fs) {
            await fs.writeTextFile(filePath, JSON.stringify(projectData, null, 2));
            saved = true;
          }
        } catch (err) {
          console.error("Tauri save error", err);
        }
      }
      if (!saved && fileHandle) {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(projectData, null, 2));
          await writable.close();
          saved = true;
        } catch (err) {
          console.error("File System Access save error", err);
        }
      }
      if (!saved && currentProjectId) {
        try {
          localStorage.setItem(`project_data_${currentProjectId}`, JSON.stringify(projectData));
          saved = true;
        } catch (err) {
          console.error("Local project storage save error", err);
        }
      }
    }

    // 3. Always keep a crash-safe mirror so nothing is ever lost,
    //    even when both cloud and file writes fail.
    try {
      localStorage.setItem('backstage_last_session', JSON.stringify(projectData));
    } catch (err) {
      console.error("localStorage mirror save error", err);
    }

    setCloudOffline(cloudFailed);
    if (saved) setHasUnsavedChanges(false);
    setTimeout(() => setIsSaving(false), 200);
  }, [
    currentProjectId, projectList, beats, groups, connections, annotations, characterData, 
    generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
    isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut,
    scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
    breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, openrouterKey, generalAiModel,
    dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, characterDesignLocked, supabaseUser, fileHandle, filePath
  ]);

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
      return prev.map(b => b.id === id ? { ...b, ...updates } : b);
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

  const value: ProjectContextType = {
    beats, groups, connections, annotations, characterData, generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId, isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,     breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, geminiApiKey: '', openrouterKey, setOpenrouterKey, generalAiModel, setGeneralAiModel, dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, characterDesignLocked, setCharacterDesignLocked: setCharacterDesignLockedWrapped, appTheme, appAccentColor, appLanguage, currentUser, currentProjectId, projectList, hasUnsavedChanges, schemaError, isSaving, fileHandle, filePath, setFilePath,   isInitialLoading, isCloudMode: !!supabaseUser, supabaseUser, cloudOffline, login, logout, selectProject, createProject, deleteProject, closeProject, clearSchemaError: () => { setSchemaError(null); if (supabaseUser) refreshProjectList(supabaseUser.id); }, setBeats: setBeatsWrapped, setGroups: setGroupsWrapped, setConnections: setConnectionsWrapped, setAnnotations: setAnnotationsWrapped, setCharacterData: setCharacterDataWrapped, setGeneratedShots, setScratchpad: setScratchpadWrapped, setGlobalNotes: setGlobalNotesWrapped, updateGeneratedShot: (id, u) => { setGeneratedShots(p => p.map(s => s.id === id ? { ...s, ...u } : s)); setHasUnsavedChanges(true); }, addGeneratedShot: (i) => { const n = { id: `shot-${Date.now()}`, shotSize: 'WIDE', angle: 'EYE LEVEL', description: '', subject: '', scene: '?', imageHistory: [] }; const s = [...generatedShots]; s.splice(i + 1, 0, n); setGeneratedShots(s); captureSnapshot(); }, removeGeneratedShot: (id) => { setGeneratedShots(p => p.filter(s => s.id !== id)); captureSnapshot(); }, moveGeneratedShot: (f, t) => { const s = [...generatedShots]; const [m] = s.splice(f, 1); s.splice(t, 0, m); setGeneratedShots(s); captureSnapshot(); }, setPan: (x, y) => { setPanX(x); setPanY(y); }, setScale, updateBeat, addBeat, reorderBeats, addGroup: (g) => { const id = nextId; setNextId(p => p + 1); setGroups(p => [...p, { ...g, id, boardId: activeBoardId }]); captureSnapshot(); }, updateGroup: (id, u) => { setGroups(p => p.map(g => g.id === id ? { ...g, ...u } : g)); setHasUnsavedChanges(true); }, removeGroup: (id) => { setGroups(p => p.filter(g => g.id !== id)); captureSnapshot(); }, loadProject: applyProjectState, saveProject, saveProjectAs, setActiveBoardId, setTamilMode, setTamilFontScale, setTamilFontFamily, learnTamilWord: (e, t) => { setUserDictionary(p => { const c = p[e.toLowerCase()] || []; if (!c.includes(t)) return { ...p, [e.toLowerCase()]: [t, ...c] }; return p; }); }, setOsInputMode, setOsInputShortcut, setScriptConfig, setScriptViewMode, setScratchpadConfig, setStoryboardConfig, setStoryboardFeatureEnabled, setAppTheme, setAppAccentColor, setAppLanguage, setBreakdownLanguage, setBreakdownLockedOnly, setPdfDropEnabled, setRedoEnabled, setWritingGoal, setGeminiApiKey: () => {}, setBoardLayerOrder, setNextId, undo, redo, canUndo: historyIndexRef.current > 0, canRedo: historyIndexRef.current < historyRef.current.length - 1, captureSnapshot, downloadProject, autoGenerate5Scenes, autoGenerateScenes,
    userRole, updateUserRole, grokKey, setGrokKey,
    collaborators, setCollaborators: setCollaboratorsWrapped
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};
