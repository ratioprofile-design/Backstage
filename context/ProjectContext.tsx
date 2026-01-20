
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  ProjectState, ProjectContextType, Beat, Group, Connection, Annotation, 
  CharacterData, Shot, Note, ScriptConfig, ScratchpadConfig, StoryboardConfig, 
  WritingGoal, GoogleDriveConfig, ProjectMetadata, BeatStatus, BeatVersion,
  BoardLayer
} from '../types';
import { INITIAL_STATE } from '../constants';
import { initializeGapi, requestAccessToken, createDriveFile, updateDriveFile, findDriveFile } from '../services/googleDrive';
import { updateGeminiConfig } from '../services/gemini';
import { supabase, upsertProject, fetchProjectData, fetchUserProjects } from '../services/supabase';

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const countWords = (html: string) => {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    if (text.length === 0) return 0;
    return text.split(/\s+/).filter(w => w.length > 0).length;
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth State (Enhanced for Supabase)
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
        created: new Date(p.updated_at).getTime() // Rough estimate
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
  const [googleDriveConfig, setGoogleDriveConfig] = useState<GoogleDriveConfig>(INITIAL_STATE.googleDriveConfig);
  const [geminiApiKey, setGeminiApiKey] = useState(INITIAL_STATE.geminiApiKey);
  const [stabilityApiKey, setStabilityApiKey] = useState(INITIAL_STATE.stabilityApiKey);
  const [dailyStats, setDailyStats] = useState(INITIAL_STATE.dailyStats);
  const [sessionStartCount, setSessionStartCount] = useState(INITIAL_STATE.sessionStartCount);
  const [lastSessionDate, setLastSessionDate] = useState(INITIAL_STATE.lastSessionDate);
  const [boardLayerOrder, setBoardLayerOrder] = useState<BoardLayer[]>(INITIAL_STATE.boardLayerOrder);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);

  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoing = useRef(false);

  const captureSnapshot = useCallback(() => {
      if (isUndoing.current) return;
      const snapshot = JSON.stringify({
          beats, groups, connections, annotations, characterData, generatedShots, 
          scratchpad, globalNotes, 
      });
      if (historyIndexRef.current >= 0 && historyRef.current[historyIndexRef.current] === snapshot) return;
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(snapshot);
      if (newHistory.length > 50) newHistory.shift();
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      setHasUnsavedChanges(true);
  }, [beats, groups, connections, annotations, characterData, generatedShots, scratchpad, globalNotes]);

  const undo = useCallback(() => {
      if (historyIndexRef.current > 0) {
          isUndoing.current = true;
          historyIndexRef.current--;
          const snapshot = JSON.parse(historyRef.current[historyIndexRef.current]);
          setBeats(snapshot.beats);
          setGroups(snapshot.groups);
          setConnections(snapshot.connections);
          setAnnotations(snapshot.annotations);
          setCharacterData(snapshot.characterData);
          setGeneratedShots(snapshot.generatedShots);
          setScratchpad(snapshot.scratchpad);
          setGlobalNotes(snapshot.globalNotes);
          setTimeout(() => { isUndoing.current = false; }, 100);
      }
  }, []);

  const redo = useCallback(() => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
          isUndoing.current = true;
          historyIndexRef.current++;
          const snapshot = JSON.parse(historyRef.current[historyIndexRef.current]);
          setBeats(snapshot.beats);
          setGroups(snapshot.groups);
          setConnections(snapshot.connections);
          setAnnotations(snapshot.annotations);
          setCharacterData(snapshot.characterData);
          setGeneratedShots(snapshot.generatedShots);
          setScratchpad(snapshot.scratchpad);
          setGlobalNotes(snapshot.globalNotes);
          setTimeout(() => { isUndoing.current = false; }, 100);
      }
  }, []);

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
          scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId,
          isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
          isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
          scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
          breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
          writingGoal, googleDriveConfig, geminiApiKey, stabilityApiKey, 
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

      if (googleDriveConfig.enabled && googleDriveConfig.autoBackup) {
          backupToDrive(false);
      }
  }, [
      currentProjectId, projectList, beats, groups, connections, annotations, characterData, 
      generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut,
      scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, googleDriveConfig, geminiApiKey, stabilityApiKey,
      dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder, supabaseUser
  ]);

  const downloadProject = useCallback(() => {
      if (!currentProjectId) return;
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
      generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut,
      scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, googleDriveConfig, geminiApiKey, stabilityApiKey,
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
      setGoogleDriveConfig(merged.googleDriveConfig);
      setGeminiApiKey(merged.geminiApiKey);
      setStabilityApiKey(merged.stabilityApiKey);
      setDailyStats(merged.dailyStats);
      setSessionStartCount(merged.sessionStartCount);
      setLastSessionDate(merged.lastSessionDate);
      setBoardLayerOrder(merged.boardLayerOrder);
      if (merged.geminiApiKey) updateGeminiConfig(merged.geminiApiKey);
      historyRef.current = [];
      historyIndexRef.current = -1;
      setHasUnsavedChanges(false);
  };

  const connectToDrive = async (apiKey?: string, clientId?: string) => {
      if (!apiKey || !clientId) {
          alert("API Key and Client ID required.");
          return;
      }
      setIsDriveConnecting(true);
      try {
          await initializeGapi(apiKey, clientId);
          await requestAccessToken();
          setGoogleDriveConfig(prev => ({ ...prev, enabled: true, apiKey, clientId }));
          alert("Connected to Google Drive!");
      } catch (err) {
          console.error(err);
          alert("Failed to connect to Google Drive: " + err);
      } finally {
          setIsDriveConnecting(false);
      }
  };

  const disconnectFromDrive = () => {
      setGoogleDriveConfig(prev => ({ ...prev, enabled: false, fileId: undefined }));
  };

  const backupToDrive = async (force: boolean = false) => {
      if (!googleDriveConfig.enabled || !currentProjectId) return;
      if (!force && Date.now() - (googleDriveConfig.lastBackup || 0) < 300000) return; 

      setIsDriveSyncing(true);
      try {
          const project = projectList.find(p => p.id === currentProjectId);
          const fileName = `Backstage_Backup_${project?.name || 'Untitled'}.bst`;
          const content = localStorage.getItem(`project_data_${currentProjectId}`) || '{}';
          if (googleDriveConfig.fileId) {
              await updateDriveFile(googleDriveConfig.fileId, content);
          } else {
              const existingId = await findDriveFile(fileName);
              if (existingId) {
                  await updateDriveFile(existingId, content);
                  setGoogleDriveConfig(prev => ({ ...prev, fileId: existingId }));
              } else {
                  const newId = await createDriveFile(fileName, content);
                  setGoogleDriveConfig(prev => ({ ...prev, fileId: newId }));
              }
          }
          setGoogleDriveConfig(prev => ({ ...prev, lastBackup: Date.now() }));
      } catch (err) {
          console.error("Backup failed", err);
      } finally {
          setIsDriveSyncing(false);
      }
  };

  const setPan = (x: number, y: number) => { setPanX(x); setPanY(y); };
  
  const addBeat = (x: number, y: number) => {
      const id = nextId;
      setNextId(prev => prev + 1);
      const newBeat: Beat = {
          id, x, y, title: '', slug: { prefix: '', location: '', time: '' },
          content: '<div class="sc-line sc-action"><br></div>',
          color: '#444', shots: [], status: 'not-ready', versions: [], notes: []
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
      captureSnapshot();
  };

  const reorderBeats = useCallback((draggedId: number, targetId: number, side: 'top' | 'bottom') => {
      setConnections(prev => {
          let newConns = [...prev];
          
          // 1. Surgical edge mutation logic
          // Find what points to dragged and what dragged points to
          const incomingToDragged = newConns.filter(c => c.to === draggedId);
          const outgoingFromDragged = newConns.filter(c => c.from === draggedId);
          
          // Remove old dragged connections
          newConns = newConns.filter(c => c.from !== draggedId && c.to !== draggedId);
          
          // Bridge the old gap (Heal the chain if linear)
          if (incomingToDragged.length === 1 && outgoingFromDragged.length === 1) {
              const src = incomingToDragged[0].from;
              const dst = outgoingFromDragged[0].to;
              if (src !== dst) {
                newConns.push({ from: src, to: dst });
              }
          }

          // 2. Insert into new location
          if (side === 'top') {
              // Insert before targetId
              // Find what points to target currently
              const incomingToTarget = newConns.filter(c => c.to === targetId);
              // Redirect incoming pointers from Target to Dragged
              newConns = newConns.filter(c => c.to !== targetId);
              incomingToTarget.forEach(c => {
                  newConns.push({ from: c.from, to: draggedId });
              });
              // Connect Dragged -> Target
              newConns.push({ from: draggedId, to: targetId });
          } else {
              // Insert after targetId
              // Find what target points to currently
              const outgoingFromTarget = newConns.filter(c => c.from === targetId);
              // Redirect Target's outgoing pointer to Dragged
              newConns = newConns.filter(c => c.from !== targetId);
              newConns.push({ from: targetId, to: draggedId });
              // Redirect Dragged to what Target was pointing to
              outgoingFromTarget.forEach(c => {
                  newConns.push({ from: draggedId, to: c.to });
              });
          }

          return newConns;
      });

      // Spatial nudge: Move the dragged beat's X coordinate to be close to the target for visual logic
      setBeats(prev => {
          const tBeat = prev.find(b => b.id === targetId);
          if (tBeat) {
            return prev.map(b => b.id === draggedId ? { ...b, x: tBeat.x + (side === 'top' ? -100 : 100), y: tBeat.y } : b);
          }
          return prev;
      });

      captureSnapshot();
  }, [captureSnapshot]);

  const addGroup = (group: Omit<Group, 'id'>) => {
      const id = nextId;
      setNextId(prev => prev + 1);
      setGroups(prev => [...prev, { ...group, id }]);
      captureSnapshot();
  };

  const updateGroup = (id: number, updates: Partial<Group>) => {
      setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
      captureSnapshot();
  };

  const removeGroup = (id: number) => {
      setGroups(prev => prev.filter(g => g.id !== id));
      captureSnapshot();
  };

  const updateGeneratedShot = (id: string, updates: Partial<Shot>) => {
      setGeneratedShots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      captureSnapshot();
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

  const learnTamilWord = (english: string, tamil: string) => {
      setUserDictionary(prev => {
          const current = prev[english.toLowerCase()] || [];
          if (!current.includes(tamil)) {
              return { ...prev, [english.toLowerCase()]: [tamil, ...current] };
          }
          return prev;
      });
  };

  const value: ProjectContextType = {
      beats, groups, connections, annotations, characterData, generatedShots,
      scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary,
      isOsInputMode, osInputShortcut, scriptConfig, scriptViewMode,
      scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, 
      writingGoal, googleDriveConfig,
      geminiApiKey, stabilityApiKey, dailyStats, sessionStartCount, lastSessionDate,
      boardLayerOrder, currentUser, currentProjectId, projectList, hasUnsavedChanges,
      isDriveSyncing, isDriveConnecting,
      login, logout, selectProject, createProject, deleteProject, closeProject,
      setBeats, setGroups, setConnections, setAnnotations, setCharacterData, 
      setGeneratedShots, setScratchpad, setGlobalNotes, updateGeneratedShot, 
      addGeneratedShot, removeGeneratedShot, moveGeneratedShot, setPan, setScale, 
      updateBeat, addBeat, reorderBeats, addGroup, updateGroup, removeGroup, loadProject, 
      saveProject, setTamilMode, setTamilFontScale, setTamilFontFamily, 
      learnTamilWord, setOsInputMode, setOsInputShortcut, setScriptConfig, 
      setScriptViewMode, setScratchpadConfig, setStoryboardConfig, 
      setStoryboardFeatureEnabled, setBreakdownLanguage, setBreakdownLockedOnly, 
      setPdfDropEnabled, setRedoEnabled,
      setWritingGoal, setGoogleDriveConfig, connectToDrive, disconnectFromDrive, 
      backupToDrive, setGeminiApiKey, setStabilityApiKey, setBoardLayerOrder,
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
