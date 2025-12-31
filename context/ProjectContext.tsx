
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  ProjectState, ProjectContextType, Beat, Group, Connection, Annotation, 
  CharacterData, Shot, Note, ScriptConfig, ScratchpadConfig, StoryboardConfig, 
  WritingGoal, GoogleDriveConfig, ProjectMetadata, BeatStatus, BeatVersion,
  BoardLayer, CloudHealth
} from '../types';
import { INITIAL_STATE } from '../constants';
import { initializeGapi, requestAccessToken, createDriveFile, updateDriveFile, findDriveFile } from '../services/googleDrive';
import { updateGeminiConfig } from '../services/gemini';
import { supabase, isSupabaseConfigured, saveProjectToCloud, fetchCloudProjects, fetchProjectData, deleteCloudProject, signOut, getCurrentSession, checkDatabaseHealth } from '../services/supabase';

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

const countWords = (html: string) => {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    if (text.length === 0) return 0;
    return text.split(/\s+/).filter(w => w.length > 0).length;
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('currentUser'));
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(localStorage.getItem('currentProjectId'));
  const [projectList, setProjectList] = useState<ProjectMetadata[]>([]);
  const [cloudHealth, setCloudHealth] = useState<CloudHealth>('unknown');

  // Project Data States
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
  const [scale, setScaleState] = useState(INITIAL_STATE.scale);
  const [nextId, setNextId] = useState(INITIAL_STATE.nextId);
  const [nextAnnoId, setNextAnnoId] = useState(INITIAL_STATE.nextAnnoId);
  const [isTamilMode, setTamilMode] = useState(INITIAL_STATE.isTamilMode);
  const [tamilFontScale, setTamilFontScale] = useState(INITIAL_STATE.tamilFontScale);
  const [tamilFontFamily, setTamilFontFamily] = useState(INITIAL_STATE.tamilFontFamily);
  const [userDictionary, setUserDictionary] = useState(INITIAL_STATE.userDictionary);
  const [isOsInputMode, setOsInputMode] = useState(INITIAL_STATE.isOsInputMode);
  const [osInputShortcut, setOsInputShortcut] = useState(INITIAL_STATE.osInputShortcut);
  const [scriptConfig, setScriptConfigState] = useState<ScriptConfig>(INITIAL_STATE.scriptConfig);
  const [scriptViewMode, setScriptViewModeState] = useState<'continuous' | 'page'>(INITIAL_STATE.scriptViewMode);
  const [scratchpadConfig, setScratchpadConfigState] = useState<ScratchpadConfig>(INITIAL_STATE.scratchpadConfig);
  const [storyboardConfig, setStoryboardConfigState] = useState<StoryboardConfig>(INITIAL_STATE.storyboardConfig);
  const [isStoryboardFeatureEnabled, setStoryboardFeatureEnabledState] = useState(INITIAL_STATE.isStoryboardFeatureEnabled);
  const [breakdownLanguage, setBreakdownLanguageState] = useState<'english' | 'tamil'>(INITIAL_STATE.breakdownLanguage);
  const [breakdownLockedOnly, setBreakdownLockedOnlyState] = useState(INITIAL_STATE.breakdownLockedOnly);
  const [isPdfDropEnabled, setPdfDropEnabledState] = useState(INITIAL_STATE.isPdfDropEnabled);
  const [isRedoEnabled, setRedoEnabledState] = useState(INITIAL_STATE.isRedoEnabled);
  const [writingGoal, setWritingGoalState] = useState<WritingGoal>(INITIAL_STATE.writingGoal);
  const [googleDriveConfig, setGoogleDriveConfigState] = useState<GoogleDriveConfig>(INITIAL_STATE.googleDriveConfig);
  const [geminiApiKey, setGeminiApiKeyState] = useState(INITIAL_STATE.geminiApiKey);
  const [stabilityApiKey, setStabilityApiKeyState] = useState(INITIAL_STATE.stabilityApiKey);
  const [dailyStats, setDailyStats] = useState(INITIAL_STATE.dailyStats);
  const [sessionStartCount, setSessionStartCount] = useState(INITIAL_STATE.sessionStartCount);
  const [lastSessionDate, setLastSessionDate] = useState(INITIAL_STATE.lastSessionDate);
  const [boardLayerOrder, setBoardLayerOrderState] = useState<BoardLayer[]>(INITIAL_STATE.boardLayerOrder);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);

  // History State Refs
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoing = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCloudHealth = useCallback(async () => {
      const res = await checkDatabaseHealth();
      if (res.ok) setCloudHealth('ready');
      else if (res.code === 'PGRST205') setCloudHealth('missing-table');
      else setCloudHealth('error');
  }, []);

  // Sync Supabase Auth Session
  useEffect(() => {
    if (!supabase) return;
    
    getCurrentSession().then(session => {
        if (session?.user) {
            const userId = session.user.id;
            setCurrentUser(userId);
            localStorage.setItem('currentUser', userId);
            refreshCloudHealth();
        }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setCurrentUser(session.user.id);
        localStorage.setItem('currentUser', session.user.id);
        refreshCloudHealth();
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshCloudHealth]);

  // Fetch Project List from Local + Cloud
  const refreshProjectList = useCallback(async (id: string) => {
    let list: ProjectMetadata[] = [];
    const localStored = localStorage.getItem('projectList');
    if (localStored) list = JSON.parse(localStored);

    if (id) {
      try {
        const cloudProjects = await fetchCloudProjects(id);
        const mapped: ProjectMetadata[] = cloudProjects.map(p => ({
          id: p.id,
          name: p.name,
          lastModified: new Date(p.updated_at).getTime(),
          created: new Date(p.updated_at).getTime()
        }));

        const merged = [...mapped];
        list.forEach(lp => {
           if (!merged.find(mp => mp.id === lp.id)) merged.push(lp);
        });
        list = merged;
      } catch (e) {
        console.warn("Cloud fetch failed, using local list", e);
      }
    }
    setProjectList(list);
    localStorage.setItem('projectList', JSON.stringify(list));
  }, []);

  useEffect(() => {
    if (currentUser) refreshProjectList(currentUser);
  }, [currentUser, refreshProjectList]);

  // Capture State Snapshot for Undo/Redo
  const captureSnapshot = useCallback(() => {
      if (isUndoing.current) return;
      const snapshot = JSON.stringify({
          beats, groups, connections, annotations, characterData, generatedShots, 
          scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId,
          isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
          isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
          scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
          breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
          writingGoal, googleDriveConfig, geminiApiKey, stabilityApiKey, 
          dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder
      });
      if (historyIndexRef.current >= 0 && historyRef.current[historyIndexRef.current] === snapshot) return;
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(snapshot);
      if (newHistory.length > 50) newHistory.shift();
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      setHasUnsavedChanges(true);
  }, [
      beats, groups, connections, annotations, characterData, generatedShots, 
      scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
      isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
      scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
      writingGoal, googleDriveConfig, geminiApiKey, stabilityApiKey, 
      dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder
  ]);

  const login = (id: string) => {
      localStorage.setItem('currentUser', id);
      setCurrentUser(id);
  };

  const logout = async () => {
      if (supabase) await signOut();
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentProjectId');
      setCurrentUser(null);
      setCurrentProjectId(null);
  };

  // Helper to apply project data to state
  const applyProjectData = useCallback((data: ProjectState) => {
      const merged = { ...INITIAL_STATE, ...data };
      setBeats(merged.beats); setGroups(merged.groups); setConnections(merged.connections);
      setAnnotations(merged.annotations); setCharacterData(merged.characterData);
      setGeneratedShots(merged.generatedShots); setScratchpad(merged.scratchpad);
      setGlobalNotes(merged.globalNotes); setPanX(merged.panX); setPanY(merged.panY);
      setScaleState(merged.scale); setNextId(merged.nextId); setNextAnnoId(merged.nextAnnoId);
      setTamilMode(merged.isTamilMode); setTamilFontScale(merged.tamilFontScale);
      setTamilFontFamily(merged.tamilFontFamily); setUserDictionary(merged.userDictionary);
      setOsInputMode(merged.isOsInputMode); setOsInputShortcut(merged.osInputShortcut);
      setScriptConfigState(merged.scriptConfig); setScriptViewModeState(merged.scriptViewMode);
      setScratchpadConfigState(merged.scratchpadConfig); setStoryboardConfigState(merged.storyboardConfig);
      setStoryboardFeatureEnabledState(merged.isStoryboardFeatureEnabled);
      setBreakdownLanguageState(merged.breakdownLanguage); setBreakdownLockedOnlyState(merged.breakdownLockedOnly ?? INITIAL_STATE.breakdownLockedOnly);
      setPdfDropEnabledState(merged.isPdfDropEnabled); setRedoEnabledState(merged.isRedoEnabled ?? false);
      setWritingGoalState(merged.writingGoal); setGoogleDriveConfigState(merged.googleDriveConfig);
      setGeminiApiKeyState(merged.geminiApiKey); setStabilityApiKeyState(merged.stabilityApiKey);
      setDailyStats(merged.dailyStats); setSessionStartCount(merged.sessionStartCount);
      setLastSessionDate(merged.lastSessionDate); setBoardLayerOrderState(merged.boardLayerOrder);
      if (merged.geminiApiKey) updateGeminiConfig(merged.geminiApiKey);
  }, []);

  const loadProject = useCallback((data: ProjectState) => {
      applyProjectData(data);
      historyRef.current = []; historyIndexRef.current = -1; setHasUnsavedChanges(false);
  }, [applyProjectData]);

  const saveProject = useCallback(async () => {
      if (!currentProjectId || !currentUser) return;
      const projectData: ProjectState = {
          beats, groups, connections, annotations, characterData, generatedShots, 
          scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId,
          isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
          isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
          scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
          breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
          writingGoal, googleDriveConfig, geminiApiKey, stabilityApiKey, 
          dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder
      };
      
      // Always save to local storage first
      localStorage.setItem(`project_data_${currentProjectId}`, JSON.stringify(projectData));
      
      const name = projectList.find(p => p.id === currentProjectId)?.name || 'Untitled';
      await saveProjectToCloud(currentProjectId, name, currentUser, projectData);
      setHasUnsavedChanges(false);
  }, [currentProjectId, currentUser, projectList, beats, groups, connections, annotations, characterData, generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled, breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, googleDriveConfig, geminiApiKey, stabilityApiKey, dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder]);

  // AUTO-SYNC EFFECT: Saves changes every 5 seconds if typing has stopped
  useEffect(() => {
    if (hasUnsavedChanges && currentProjectId) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        saveProject();
      }, 5000);
    }
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [hasUnsavedChanges, currentProjectId, saveProject]);

  const selectProject = async (id: string) => {
      // 1. Try cloud first
      let data: ProjectState | null = await fetchProjectData(id);
      
      // 2. If no cloud data, check local storage
      if (!data) {
          const local = localStorage.getItem(`project_data_${id}`);
          if (local) {
              try {
                  data = JSON.parse(local);
              } catch (e) {
                  console.error("Failed to parse local project data", e);
              }
          }
      }

      if (data) {
          loadProject(data);
      } else {
          // Reset to initial state if no data found anywhere
          loadProject(INITIAL_STATE);
      }
      
      setCurrentProjectId(id);
      localStorage.setItem('currentProjectId', id);
  };

  const createProject = async (name: string) => {
      const id = generateId(); 
      const newProject: ProjectMetadata = {
          id, name, created: Date.now(), lastModified: Date.now()
      };
      
      // Update metadata list
      const updatedList = [...projectList, newProject];
      setProjectList(updatedList);
      localStorage.setItem('projectList', JSON.stringify(updatedList));
      
      const projectData = { ...INITIAL_STATE };
      
      // CRITICAL: Save to Local Storage immediately before selecting
      localStorage.setItem(`project_data_${id}`, JSON.stringify(projectData));
      
      // Try cloud save in background
      if (currentUser) {
          saveProjectToCloud(id, name, currentUser, projectData);
      }
      
      await selectProject(id);
  };

  const deleteProject = async (id: string) => {
      const updatedList = projectList.filter(p => p.id !== id);
      setProjectList(updatedList);
      localStorage.setItem('projectList', JSON.stringify(updatedList));
      localStorage.removeItem(`project_data_${id}`);
      
      await deleteCloudProject(id);
      if (currentProjectId === id) {
          setCurrentProjectId(null);
          localStorage.removeItem('currentProjectId');
      }
  };

  const undo = useCallback(() => {
      if (historyIndexRef.current > 0) {
          isUndoing.current = true;
          historyIndexRef.current--;
          applyProjectData(JSON.parse(historyRef.current[historyIndexRef.current]));
          setTimeout(() => { isUndoing.current = false; }, 100);
      }
  }, [applyProjectData]);

  const redo = useCallback(() => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
          isUndoing.current = true;
          historyIndexRef.current++;
          applyProjectData(JSON.parse(historyRef.current[historyIndexRef.current]));
          setTimeout(() => { isUndoing.current = false; }, 100);
      }
  }, [applyProjectData]);

  const updateGeneratedShot = useCallback((id: string, updates: Partial<Shot>) => {
    setGeneratedShots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    captureSnapshot();
  }, [captureSnapshot]);

  const addGeneratedShot = useCallback((index: number) => {
    const newShot: Shot = {
      id: generateId(),
      shotSize: 'WIDE',
      angle: 'EYE LEVEL',
      description: '',
      subject: '',
      imageUrl: null,
      imageHistory: []
    };
    setGeneratedShots(prev => {
      const next = [...prev];
      next.splice(index, 0, newShot);
      return next;
    });
    captureSnapshot();
  }, [captureSnapshot]);

  const removeGeneratedShot = useCallback((id: string) => {
    setGeneratedShots(prev => prev.filter(s => s.id !== id));
    captureSnapshot();
  }, [captureSnapshot]);

  const moveGeneratedShot = useCallback((fromIndex: number, toIndex: number) => {
    setGeneratedShots(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    captureSnapshot();
  }, [captureSnapshot]);

  const downloadProject = useCallback(() => {
    const projectData: ProjectState = {
      beats, groups, connections, annotations, characterData, generatedShots,
      scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
      isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
      scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled,
      writingGoal, googleDriveConfig, geminiApiKey, stabilityApiKey,
      dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const name = projectList.find(p => p.id === currentProjectId)?.name || 'Untitled';
    link.href = url;
    link.download = `${name.replace(/\s+/g, '_')}.bst`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [beats, groups, connections, annotations, characterData, generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled, breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, googleDriveConfig, geminiApiKey, stabilityApiKey, dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, projectList, currentProjectId]);

  const value: ProjectContextType = {
      beats, groups, connections, annotations, characterData, generatedShots,
      scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
      isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
      scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
      writingGoal, googleDriveConfig, geminiApiKey, stabilityApiKey, dailyStats, 
      sessionStartCount, lastSessionDate, boardLayerOrder, currentUser, currentProjectId, 
      projectList, cloudHealth, refreshCloudHealth, hasUnsavedChanges, isDriveSyncing, isDriveConnecting,
      login, logout, selectProject, createProject, deleteProject, closeProject: () => { setCurrentProjectId(null); },
      setBeats, setGroups, setConnections, setAnnotations, setCharacterData, 
      setGeneratedShots, setScratchpad, setGlobalNotes, updateGeneratedShot, 
      addGeneratedShot, removeGeneratedShot, moveGeneratedShot, 
      setPan: (x, y) => { setPanX(x); setPanY(y); },
      setScale: (s) => setScaleState(s),
      updateBeat: (id, updates) => {
          setBeats(prev => {
              const target = prev.find(b => b.id === id);
              if (target && updates.content !== undefined) {
                  const delta = countWords(updates.content) - countWords(target.content);
                  const today = new Date().toISOString().split('T')[0];
                  setDailyStats(curr => ({ ...curr, [today]: (curr[today] || 0) + delta }));
              }
              return prev.map(b => b.id === id ? { ...b, ...updates } : b);
          });
          captureSnapshot();
      },
      addBeat: (x, y) => {
          const id = nextId; setNextId(p => p + 1);
          setBeats(prev => [...prev, { id, x, y, title: '', slug: { prefix: '', location: '', time: '' }, content: '<div class="sc-line sc-action"><br></div>', color: '#444', shots: [], status: 'not-ready', versions: [], notes: [] }]);
          captureSnapshot(); return id;
      },
      addGroup: (g) => { const id = nextId; setNextId(p => p + 1); setGroups(p => [...p, { ...g, id }]); captureSnapshot(); },
      updateGroup: (id, u) => { setGroups(p => p.map(g => g.id === id ? { ...g, ...u } : g)); captureSnapshot(); },
      removeGroup: (id) => { setGroups(p => p.filter(g => g.id !== id)); captureSnapshot(); },
      loadProject, saveProject, setTamilMode, setTamilFontScale, setTamilFontFamily, 
      learnTamilWord: (e, t) => setUserDictionary(p => ({ ...p, [e.toLowerCase()]: Array.from(new Set([t, ...(p[e.toLowerCase()] || [])])) })),
      setOsInputMode, setOsInputShortcut, 
      setScriptConfig: (c) => { setScriptConfigState(c); captureSnapshot(); }, 
      setScriptViewMode: (m) => setScriptViewModeState(m), 
      setScratchpadConfig: (c) => { setScratchpadConfigState(c); captureSnapshot(); }, 
      setStoryboardConfig: (c) => setStoryboardConfigState(c), 
      setStoryboardFeatureEnabled: (enabled) => setStoryboardFeatureEnabledState(enabled), 
      setBreakdownLanguage: (lang) => setBreakdownLanguageState(lang), 
      setBreakdownLockedOnly: (enabled) => { setBreakdownLockedOnlyState(enabled); captureSnapshot(); }, 
      setPdfDropEnabled: (enabled) => setPdfDropEnabledState(enabled), 
      setRedoEnabled: (enabled) => { setRedoEnabledState(enabled); captureSnapshot(); },
      setWritingGoal: (g) => setWritingGoalState(g), 
      setGoogleDriveConfig: (c) => setGoogleDriveConfigState(c), 
      connectToDrive: async (k, c) => {},
      disconnectFromDrive: () => {},
      backupToDrive: async () => {},
      setGeminiApiKey: (k) => setGeminiApiKeyState(k), 
      setStabilityApiKey: (k) => setStabilityApiKeyState(k), 
      setBoardLayerOrder: (o) => setBoardLayerOrderState(o),
      undo, redo, canUndo: historyIndexRef.current > 0, canRedo: historyIndexRef.current < historyRef.current.length - 1, captureSnapshot,
      downloadProject
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};
