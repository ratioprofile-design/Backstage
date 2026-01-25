
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  ProjectState, ProjectContextType, Beat, Group, Connection, Annotation, 
  CharacterData, Shot, Note, ScriptConfig, ScratchpadConfig, StoryboardConfig, 
  WritingGoal, ProjectMetadata, BeatStatus, BeatVersion,
  BoardLayer
} from '../types';
import { INITIAL_STATE } from '../constants';
import { supabase, upsertProject, fetchProjectData, fetchUserProjects } from '../services/supabase';

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const countWords = (html: string) => {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    if (text.length === 0) return 0;
    return text.split(/\s+/).filter(w => w.length > 0).length;
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('currentUser'));
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(localStorage.getItem('currentProjectId'));
  const [projectList, setProjectList] = useState<ProjectMetadata[]>([]);

  // Monitor Supabase Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSupabaseUser(session.user);
        setCurrentUser(session.user.email);
        refreshProjectList(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSupabaseUser(session.user);
        setCurrentUser(session.user.email);
        refreshProjectList(session.user.id);
      } else {
        setSupabaseUser(null);
        setCurrentUser(null);
        setProjectList([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProjectList = async (userId: string) => {
    try {
      const dbProjects = await fetchUserProjects(userId);
      const mapped: ProjectMetadata[] = dbProjects.map(p => ({
        id: p.id,
        name: p.name,
        lastModified: new Date(p.updated_at).getTime(),
        created: new Date(p.updated_at).getTime()
      }));
      setProjectList(mapped);
    } catch (err) {
      console.error("Failed to fetch projects from Supabase:", err);
    }
  };

  // Standard Project State
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
  const [stabilityApiKey, setStabilityApiKey] = useState(INITIAL_STATE.stabilityApiKey);
  const [dailyStats, setDailyStats] = useState(INITIAL_STATE.dailyStats);
  const [sessionStartCount, setSessionStartCount] = useState(INITIAL_STATE.sessionStartCount);
  const [lastSessionDate, setLastSessionDate] = useState(INITIAL_STATE.lastSessionDate);
  const [boardLayerOrder, setBoardLayerOrder] = useState<BoardLayer[]>(INITIAL_STATE.boardLayerOrder);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // --- UNDO / REDO ENGINE ---
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isTimeTraveling = useRef(false);

  const captureSnapshot = useCallback(() => {
    if (isTimeTraveling.current) return;

    const currentProjectState = {
      beats, groups, connections, annotations, characterData, generatedShots, 
      scratchpad, globalNotes, panX, panY, scale, activeBoardId,
      isTamilMode, scriptConfig, scriptViewMode, scratchpadConfig,
      storyboardConfig, isStoryboardFeatureEnabled, breakdownLanguage,
      breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal,
      boardLayerOrder, stabilityApiKey, nextId, nextAnnoId
    };

    const snapshot = JSON.stringify(currentProjectState);
    
    // Don't duplicate top of stack
    if (historyIndexRef.current >= 0 && historyRef.current[historyIndexRef.current] === snapshot) return;

    // Prune future if we're branching from the middle
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(snapshot);

    // Limit history stack size
    if (newHistory.length > 50) newHistory.shift();

    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setHasUnsavedChanges(true);
  }, [
    beats, groups, connections, annotations, characterData, generatedShots, 
    scratchpad, globalNotes, panX, panY, scale, activeBoardId,
    isTamilMode, scriptConfig, scriptViewMode, scratchpadConfig,
    storyboardConfig, isStoryboardFeatureEnabled, breakdownLanguage,
    breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal,
    boardLayerOrder, stabilityApiKey, nextId, nextAnnoId
  ]);

  // Debounced auto-snapshot for changes like typing or coordinates
  useEffect(() => {
    const timer = setTimeout(captureSnapshot, 1000);
    return () => clearTimeout(timer);
  }, [
    beats, groups, connections, annotations, characterData, generatedShots, 
    scratchpad, globalNotes, panX, panY, scale, activeBoardId,
    scriptConfig, scriptViewMode, scratchpadConfig,
    storyboardConfig, writingGoal, boardLayerOrder, nextId, nextAnnoId
  ]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      isTimeTraveling.current = true;
      historyIndexRef.current--;
      const snapshot = JSON.parse(historyRef.current[historyIndexRef.current]);
      applyProjectState(snapshot);
      setTimeout(() => { isTimeTraveling.current = false; }, 100);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      isTimeTraveling.current = true;
      historyIndexRef.current++;
      const snapshot = JSON.parse(historyRef.current[historyIndexRef.current]);
      applyProjectState(snapshot);
      setTimeout(() => { isTimeTraveling.current = false; }, 100);
    }
  }, []);

  const applyProjectState = (data: any) => {
    setBeats(data.beats);
    setGroups(data.groups);
    setConnections(data.connections);
    setAnnotations(data.annotations);
    setCharacterData(data.characterData);
    setGeneratedShots(data.generatedShots);
    setScratchpad(data.scratchpad);
    setGlobalNotes(data.globalNotes);
    setPanX(data.panX);
    setPanY(data.panY);
    setScale(data.scale);
    setActiveBoardId(data.activeBoardId);
    setScriptConfig(data.scriptConfig);
    setScriptViewMode(data.scriptViewMode);
    setScratchpadConfig(data.scratchpadConfig);
    setStoryboardConfig(data.storyboardConfig);
    setWritingGoal(data.writingGoal);
    setBoardLayerOrder(data.boardLayerOrder);
    setTamilMode(data.isTamilMode);
    setPdfDropEnabled(data.isPdfDropEnabled);
    setRedoEnabled(data.isRedoEnabled);
    setNextId(data.nextId);
    setNextAnnoId(data.nextAnnoId);
  };

  const login = (username: string) => {
    localStorage.setItem('currentUser', username);
    setCurrentUser(username);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentProjectId');
    setCurrentUser(null);
    setCurrentProjectId(null);
  };

  const createProject = async (name: string) => {
    const id = `proj_${Date.now()}`;
    if (supabaseUser) {
      await upsertProject(id, supabaseUser.id, name, INITIAL_STATE);
      await refreshProjectList(supabaseUser.id);
    } else {
      const newProject: ProjectMetadata = {
        id,
        name,
        created: Date.now(),
        lastModified: Date.now()
      };
      const updatedList = [...projectList, newProject];
      setProjectList(updatedList);
      localStorage.setItem('projectList', JSON.stringify(updatedList));
    }
    selectProject(id);
  };

  const selectProject = async (id: string) => {
    if (supabaseUser) {
      try {
        const data = await fetchProjectData(id);
        loadProject(data);
      } catch (err) {
        console.error("Failed to load project from Supabase:", err);
        loadProject(INITIAL_STATE);
      }
    } else {
      const dataStr = localStorage.getItem(`project_data_${id}`);
      loadProject(dataStr ? JSON.parse(dataStr) : INITIAL_STATE);
    }
    setCurrentProjectId(id);
    localStorage.setItem('currentProjectId', id);
  };

  const deleteProject = async (id: string) => {
    if (supabaseUser) {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (!error) await refreshProjectList(supabaseUser.id);
    } else {
      const updatedList = projectList.filter(p => p.id !== id);
      setProjectList(updatedList);
      localStorage.setItem('projectList', JSON.stringify(updatedList));
      localStorage.removeItem(`project_data_${id}`);
    }
    if (currentProjectId === id) {
      setCurrentProjectId(null);
      localStorage.removeItem('currentProjectId');
    }
  };

  const closeProject = () => {
    setCurrentProjectId(null);
    localStorage.removeItem('currentProjectId');
  };

  const saveProject = useCallback(async () => {
    if (!currentProjectId) return;
    
    const projectData: ProjectState = {
      beats, groups, connections, annotations, characterData, generatedShots, 
      scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
      isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
      scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
      writingGoal, geminiApiKey: '', stabilityApiKey, 
      dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder
    };

    if (supabaseUser) {
      try {
        const project = projectList.find(p => p.id === currentProjectId);
        await upsertProject(currentProjectId, supabaseUser.id, project?.name || 'Untitled', projectData);
      } catch (err) {
        console.error("Supabase Save Error:", err);
      }
    } else {
      localStorage.setItem(`project_data_${currentProjectId}`, JSON.stringify(projectData));
      const updatedList = projectList.map(p => p.id === currentProjectId ? { ...p, lastModified: Date.now() } : p);
      setProjectList(updatedList);
      localStorage.setItem('projectList', JSON.stringify(updatedList));
    }
    
    setHasUnsavedChanges(false);
  }, [
    currentProjectId, projectList, beats, groups, connections, annotations, characterData, 
    generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
    isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut,
    scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
    breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, stabilityApiKey,
    dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, supabaseUser
  ]);

  const downloadProject = useCallback(() => {
    if (!currentProjectId) return;
    const projectData: ProjectState = {
      beats, groups, connections, annotations, characterData, generatedShots, 
      scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
      isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
      scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
      writingGoal, geminiApiKey: '', stabilityApiKey, 
      dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder
    };
    const dataStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const projectName = projectList.find(p => p.id === currentProjectId)?.name || "Untitled";
    const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.href = url;
    link.download = `${safeName}_backup_${new Date().toISOString().slice(0,10)}.bst`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    saveProject();
  }, [
    currentProjectId, projectList, beats, groups, connections, annotations, characterData, 
    generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
    isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut,
    scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
    breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, stabilityApiKey,
    dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, saveProject
  ]);

  const loadProject = (data: ProjectState) => {
    const merged = { ...INITIAL_STATE, ...data };
    const mergedScratchpad = { ...INITIAL_STATE.scratchpadConfig, ...(data.scratchpadConfig || {}) };
    const mergedScriptConfig = { ...INITIAL_STATE.scriptConfig, ...(data.scriptConfig || {}) };
    if (data.scriptConfig) {
      mergedScriptConfig.slugline = { ...INITIAL_STATE.scriptConfig.slugline, ...(data.scriptConfig.slugline || {}) };
      mergedScriptConfig.action = { ...INITIAL_STATE.scriptConfig.action, ...(data.scriptConfig.action || {}) };
      mergedScriptConfig.character = { ...INITIAL_STATE.scriptConfig.character, ...(data.scriptConfig.character || {}) };
      mergedScriptConfig.dialogue = { ...INITIAL_STATE.scriptConfig.dialogue, ...(data.scriptConfig.dialogue || {}) };
      mergedScriptConfig.parenthetical = { ...INITIAL_STATE.scriptConfig.parenthetical, ...(data.scriptConfig.parenthetical || {}) };
      mergedScriptConfig.transition = { ...INITIAL_STATE.scriptConfig.transition, ...(data.scriptConfig.transition || {}) };
      mergedScriptConfig.shot = { ...INITIAL_STATE.scriptConfig.shot, ...(data.scriptConfig.shot || {}) };
      mergedScriptConfig.lyrics = { ...INITIAL_STATE.scriptConfig.lyrics, ...(data.scriptConfig.lyrics || {}) };
      mergedScriptConfig.blockBounds = { ...INITIAL_STATE.scriptConfig.blockBounds, ...(data.scriptConfig.blockBounds || {}) };
      mergedScriptConfig.languageConfig = { ...INITIAL_STATE.scriptConfig.languageConfig, ...(data.scriptConfig.languageConfig || {}) };
    }

    setBeats(merged.beats);
    setGroups(merged.groups);
    setConnections(merged.connections);
    setAnnotations(merged.annotations);
    setCharacterData(merged.characterData);
    setGeneratedShots(merged.generatedShots);
    setScratchpad(merged.scratchpad);
    setGlobalNotes(merged.globalNotes);
    setPanX(merged.panX);
    setPanY(merged.panY);
    setScale(merged.scale);
    setNextId(merged.nextId);
    setNextAnnoId(merged.nextAnnoId);
    setActiveBoardId(merged.activeBoardId ?? 0);
    setTamilMode(merged.isTamilMode);
    setTamilFontScale(merged.tamilFontScale);
    setTamilFontFamily(merged.tamilFontFamily);
    setUserDictionary(merged.userDictionary);
    setOsInputMode(merged.isOsInputMode);
    setOsInputShortcut(merged.osInputShortcut);
    setScriptConfig(mergedScriptConfig);
    setScriptViewMode(merged.scriptViewMode);
    setScratchpadConfig(mergedScratchpad);
    setStoryboardConfig(merged.storyboardConfig);
    setStoryboardFeatureEnabled(merged.isStoryboardFeatureEnabled);
    setBreakdownLanguage(merged.breakdownLanguage);
    setBreakdownLockedOnly(merged.breakdownLockedOnly ?? INITIAL_STATE.breakdownLockedOnly);
    setPdfDropEnabled(merged.isPdfDropEnabled);
    setRedoEnabled(merged.isRedoEnabled ?? false);
    setWritingGoal(merged.writingGoal);
    setStabilityApiKey(merged.stabilityApiKey);
    setDailyStats(merged.dailyStats);
    setSessionStartCount(merged.sessionStartCount);
    setLastSessionDate(merged.lastSessionDate);
    setBoardLayerOrder(merged.boardLayerOrder);
    
    // Clear history on project load
    historyRef.current = [];
    historyIndexRef.current = -1;
    setTimeout(captureSnapshot, 100);
    
    setHasUnsavedChanges(false);
  };

  const setPan = (x: number, y: number) => { setPanX(x); setPanY(y); };
  
  const addBeat = (x: number, y: number) => {
    const id = nextId;
    setNextId(prev => prev + 1);
    const newBeat: Beat = {
      id, x, y, title: '', slug: { prefix: '', location: '', time: '' },
      content: '<div class="sc-line sc-action"><br></div>',
      color: '#444', shots: [], status: 'not-ready', versions: [], notes: [],
      boardId: activeBoardId
    };
    setBeats(prev => [...prev, newBeat]);
    captureSnapshot();
    return id;
  };

  const updateBeat = (id: number, updates: Partial<Beat>) => {
    setBeats(prev => {
      const target = prev.find(b => b.id === id);
      let delta = 0;
      if (target && updates.content !== undefined && updates.content !== target.content) {
        const oldWords = countWords(target.content);
        const newWords = countWords(updates.content);
        delta = newWords - oldWords;
      }
      if (delta !== 0) {
        setTimeout(() => {
          const today = new Date().toISOString().split('T')[0];
          setDailyStats(curr => ({ ...curr, [today]: (curr[today] || 0) + delta }));
        }, 0);
      }
      return prev.map(b => b.id === id ? { ...b, ...updates } : b);
    });
  };

  const reorderBeats = useCallback((draggedId: number, targetId: number, side: 'top' | 'bottom') => {
    setConnections(prev => {
      let newConns = [...prev];
      const incomingToDragged = newConns.filter(c => c.to === draggedId);
      const outgoingFromDragged = newConns.filter(c => c.from === draggedId);
      newConns = newConns.filter(c => c.from !== draggedId && c.to !== draggedId);
      
      if (incomingToDragged.length === 1 && outgoingFromDragged.length === 1) {
        const src = incomingToDragged[0].from;
        const dst = outgoingFromDragged[0].to;
        if (src !== dst) {
          newConns.push({ from: src, to: dst, boardId: activeBoardId });
        }
      }

      if (side === 'top') {
        const incomingToTarget = newConns.filter(c => c.to === targetId);
        newConns = newConns.filter(c => c.to !== targetId);
        incomingToTarget.forEach(c => {
          newConns.push({ from: c.from, to: draggedId, boardId: activeBoardId });
        });
        newConns.push({ from: draggedId, to: targetId, boardId: activeBoardId });
      } else {
        const outgoingFromTarget = newConns.filter(c => c.from === targetId);
        newConns = newConns.filter(c => c.from !== targetId);
        newConns.push({ from: targetId, to: draggedId, boardId: activeBoardId });
        outgoingFromTarget.forEach(c => {
          newConns.push({ from: draggedId, to: c.to, boardId: activeBoardId });
        });
      }
      return newConns;
    });

    setBeats(prev => {
      const tBeat = prev.find(b => b.id === targetId);
      if (tBeat) {
        return prev.map(b => b.id === draggedId ? { ...b, x: tBeat.x + (side === 'top' ? -100 : 100), y: tBeat.y } : b);
      }
      return prev;
    });

    captureSnapshot();
  }, [captureSnapshot, activeBoardId]);

  const addGroup = (group: Omit<Group, 'id'>) => {
    const id = nextId;
    setNextId(prev => prev + 1);
    setGroups(prev => [...prev, { ...group, id, boardId: activeBoardId }]);
    captureSnapshot();
  };

  const updateGroup = (id: number, updates: Partial<Group>) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  const removeGroup = (id: number) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    captureSnapshot();
  };

  const updateGeneratedShot = (id: string, updates: Partial<Shot>) => {
    setGeneratedShots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addGeneratedShot = (index: number) => {
    const newShot: Shot = {
      id: `shot-${Date.now()}`,
      shotSize: 'WIDE', angle: 'EYE LEVEL', description: '', subject: '', scene: '?', imageHistory: []
    };
    const newShots = [...generatedShots];
    newShots.splice(index + 1, 0, newShot);
    setGeneratedShots(newShots);
    captureSnapshot();
  };

  const removeGeneratedShot = (id: string) => {
    setGeneratedShots(prev => prev.filter(s => s.id !== id));
    captureSnapshot();
  };

  const moveGeneratedShot = (fromIndex: number, toIndex: number) => {
    const newShots = [...generatedShots];
    const [moved] = newShots.splice(fromIndex, 1);
    newShots.splice(toIndex, 0, moved);
    setGeneratedShots(newShots);
    captureSnapshot();
  };

  const value: ProjectContextType = {
    beats, groups, connections, annotations, characterData, generatedShots,
    scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId, activeBoardId,
    isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
    isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
    scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
    breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
    writingGoal,
    geminiApiKey: '', stabilityApiKey, dailyStats, sessionStartCount, lastSessionDate,
    boardLayerOrder, currentUser, currentProjectId, projectList, hasUnsavedChanges,
    login, logout, selectProject, createProject, deleteProject, closeProject,
    setBeats, setGroups, setConnections, setAnnotations, setCharacterData, 
    setGeneratedShots, setScratchpad, setGlobalNotes, updateGeneratedShot, 
    addGeneratedShot, removeGeneratedShot, moveGeneratedShot, setPan, setScale, 
    updateBeat, addBeat, reorderBeats, addGroup, updateGroup, removeGroup, loadProject, 
    saveProject, setActiveBoardId, setTamilMode, setTamilFontScale, setTamilFontFamily, 
    learnTamilWord: (english: string, tamil: string) => {
      setUserDictionary(prev => {
        const current = prev[english.toLowerCase()] || [];
        if (!current.includes(tamil)) return { ...prev, [english.toLowerCase()]: [tamil, ...current] };
        return prev;
      });
    }, 
    setOsInputMode, setOsInputShortcut, setScriptConfig, 
    setScriptViewMode, setScratchpadConfig, setStoryboardConfig, 
    setStoryboardFeatureEnabled, setBreakdownLanguage, setBreakdownLockedOnly, 
    setPdfDropEnabled, setRedoEnabled,
    setWritingGoal, setGeminiApiKey: () => {}, setStabilityApiKey, setBoardLayerOrder,
    setNextId,
    undo, redo, canUndo: historyIndexRef.current > 0, canRedo: historyIndexRef.current < historyRef.current.length - 1, captureSnapshot,
    downloadProject
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};
