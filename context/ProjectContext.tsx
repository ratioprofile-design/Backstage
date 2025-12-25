
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ProjectState, Beat, Connection, Annotation, Shot, CharacterData, ScriptConfig, StoryboardConfig, Group, WritingGoal, ProjectMetadata, BoardLayer, GoogleDriveConfig, ProjectContextType } from '../types';
import { INITIAL_STATE } from '../constants';
import { initializeGapi, requestAccessToken, findDriveFile, createDriveFile, updateDriveFile } from '../services/googleDrive';
import { updateGeminiConfig } from '../services/gemini';

const ProjectContext = createContext<ProjectContextType | null>(null);

// Helper to mix hex and opacity
const hexToRgba = (hex: string, opacity: number) => {
    let c: any;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+(opacity/100)+')';
    }
    return `rgba(0,0,0,${opacity/100})`; // Fallback
}

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- AUTH & PROJECT SELECTION STATE ---
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('causality_user') || 'Filmmaker');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<ProjectMetadata[]>([]);

  // --- EDITOR STATE (Loaded for active project) ---
  const [state, setState] = useState<ProjectState>(INITIAL_STATE);
  
  // --- HISTORY STATE ---
  const [history, setHistory] = useState<{past: Partial<ProjectState>[], future: Partial<ProjectState>[]}>({ past: [], future: [] });
  // Ref to access current state inside callbacks without adding 'state' to dependency array (avoids loops)
  const stateRef = useRef(state); 
  useEffect(() => { stateRef.current = state; }, [state]);

  // Change Tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isJustLoaded = useRef(false);

  // Drive State
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);

  // Dirty Flags
  const isCloudDirty = useRef(false);

  // --- HISTORY IMPLEMENTATION ---
  
  // Extracts only the creative content to save memory
  const getSnapshot = (s: ProjectState): Partial<ProjectState> => ({
      beats: s.beats,
      groups: s.groups,
      connections: s.connections,
      annotations: s.annotations,
      characterData: s.characterData,
      generatedShots: s.generatedShots,
      scriptConfig: s.scriptConfig,
      storyboardConfig: s.storyboardConfig,
      writingGoal: s.writingGoal,
      boardLayerOrder: s.boardLayerOrder
  });

  const captureSnapshot = useCallback(() => {
      const snapshot = getSnapshot(stateRef.current);
      setHistory(prev => {
          // Limit history to 50 steps
          const newPast = [...prev.past, snapshot].slice(-50);
          return { past: newPast, future: [] };
      });
  }, []);

  const undo = useCallback(() => {
      setHistory(prev => {
          if (prev.past.length === 0) return prev;
          const previous = prev.past[prev.past.length - 1];
          const newPast = prev.past.slice(0, -1);
          
          // Save current state to future
          const currentSnapshot = getSnapshot(stateRef.current);
          
          // Apply previous state
          setState(curr => ({ ...curr, ...previous }));
          
          return {
              past: newPast,
              future: [currentSnapshot, ...prev.future]
          };
      });
  }, []);

  const redo = useCallback(() => {
      setHistory(prev => {
          if (prev.future.length === 0) return prev;
          const next = prev.future[0];
          const newFuture = prev.future.slice(1);
          
          // Save current state to past
          const currentSnapshot = getSnapshot(stateRef.current);
          
          // Apply next state
          setState(curr => ({ ...curr, ...next }));
          
          return {
              past: [...prev.past, currentSnapshot],
              future: newFuture
          };
      });
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Check for Ctrl+Z or Cmd+Z
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
              if (e.shiftKey) {
                  e.preventDefault();
                  redo();
              } else {
                  e.preventDefault();
                  undo();
              }
          }
          // Check for Ctrl+Y or Cmd+Y (Alternative Redo)
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !e.shiftKey) {
              e.preventDefault();
              redo();
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);


  // --- PROJECT SELECTION HELPER ---
  const selectProject = (id: string) => {
      const storedData = localStorage.getItem(`causality_project_${id}`);
      if (storedData) {
          try {
              const parsed = JSON.parse(storedData);
              const mergedState = {
                  ...INITIAL_STATE,
                  ...parsed,
                  groups: parsed.groups || [],
                  userDictionary: parsed.userDictionary || {},
                  isOsInputMode: parsed.isOsInputMode || false,
                  osInputShortcut: parsed.osInputShortcut || 'NumLock',
                  isStoryboardFeatureEnabled: parsed.isStoryboardFeatureEnabled || true,
                  breakdownLanguage: parsed.breakdownLanguage || 'english',
                  isPdfDropEnabled: parsed.isPdfDropEnabled || false,
                  writingGoal: { ...INITIAL_STATE.writingGoal, ...(parsed.writingGoal || {}) },
                  dailyStats: parsed.dailyStats || {},
                  sessionStartCount: parsed.sessionStartCount || 0,
                  lastSessionDate: parsed.lastSessionDate || new Date().toISOString().split('T')[0],
                  scriptConfig: { 
                      ...INITIAL_STATE.scriptConfig, 
                      ...parsed.scriptConfig,
                      blockBounds: { ...INITIAL_STATE.scriptConfig.blockBounds, ...(parsed.scriptConfig?.blockBounds || {}) },
                      slugline: { ...INITIAL_STATE.scriptConfig.slugline, ...(parsed.scriptConfig?.slugline || {}) },
                      action: { ...INITIAL_STATE.scriptConfig.action, ...(parsed.scriptConfig?.action || {}) },
                      character: { ...INITIAL_STATE.scriptConfig.character, ...(parsed.scriptConfig?.character || {}) },
                      dialogue: { ...INITIAL_STATE.scriptConfig.dialogue, ...(parsed.scriptConfig?.dialogue || {}) },
                      parenthetical: { ...INITIAL_STATE.scriptConfig.parenthetical, ...(parsed.scriptConfig?.parenthetical || {}) },
                      transition: { ...INITIAL_STATE.scriptConfig.transition, ...(parsed.scriptConfig?.transition || {}) }, 
                      shot: { ...INITIAL_STATE.scriptConfig.shot, ...(parsed.scriptConfig?.shot || {}) },
                      lyrics: { ...INITIAL_STATE.scriptConfig.lyrics, ...(parsed.scriptConfig?.lyrics || {}) },
                  },
                  scriptViewMode: parsed.scriptViewMode || 'page',
                  storyboardConfig: { ...INITIAL_STATE.storyboardConfig, ...(parsed.storyboardConfig || {}) },
                  boardLayerOrder: Array.isArray(parsed.boardLayerOrder) && parsed.boardLayerOrder.length > 0 
                      ? parsed.boardLayerOrder 
                      : INITIAL_STATE.boardLayerOrder,
                  tamilFontScale: parsed.tamilFontScale || INITIAL_STATE.tamilFontScale,
                  tamilFontFamily: parsed.tamilFontFamily || INITIAL_STATE.tamilFontFamily,
                  googleDriveConfig: { ...INITIAL_STATE.googleDriveConfig, ...(parsed.googleDriveConfig || {}) },
                  geminiApiKey: parsed.geminiApiKey || '',
                  stabilityApiKey: parsed.stabilityApiKey || ''
              };
              
              isJustLoaded.current = true;
              setState(mergedState);
              setCurrentProjectId(id);
              setHistory({ past: [], future: [] }); // Clear history on load
              isCloudDirty.current = false; 
              setHasUnsavedChanges(false);
          } catch (e) {
              console.error("Failed to load project data", e);
              alert("Error loading project file.");
          }
      } else {
          console.warn("Project data missing, initializing empty.");
          isJustLoaded.current = true;
          setState(INITIAL_STATE);
          setCurrentProjectId(id);
          setHistory({ past: [], future: [] });
          setHasUnsavedChanges(false);
      }
  };

  const createProject = (name: string) => {
      const newId = `proj-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const meta: ProjectMetadata = {
          id: newId,
          name: name,
          created: Date.now(),
          lastModified: Date.now()
      };
      
      const newIndex = [meta, ...projectList];
      setProjectList(newIndex);
      localStorage.setItem('causality_projects_index', JSON.stringify(newIndex));
      
      const newState = { ...INITIAL_STATE };
      localStorage.setItem(`causality_project_${newId}`, JSON.stringify(newState));
      
      selectProject(newId);
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    const storedIndex = localStorage.getItem('causality_projects_index');
    let index: ProjectMetadata[] = storedIndex ? JSON.parse(storedIndex) : [];

    index.sort((a, b) => b.lastModified - a.lastModified);
    setProjectList(index);

    if (!currentProjectId) {
        if (index.length > 0) {
            selectProject(index[0].id);
        } else {
            createProject('My Story');
        }
    }
  }, []);

  // Update Gemini Service whenever key changes in state
  useEffect(() => {
      updateGeminiConfig(state.geminiApiKey);
  }, [state.geminiApiKey]);

  const login = (username: string) => {
      localStorage.setItem('causality_user', username);
      setCurrentUser(username);
  };

  const logout = () => {
      localStorage.removeItem('causality_user');
      setCurrentUser(null);
      setCurrentProjectId(null);
      setState(INITIAL_STATE);
      setHistory({ past: [], future: [] });
  };

  const deleteProject = (id: string) => {
      if (confirm("Are you sure you want to delete this project? This cannot be undone.")) {
          const newIndex = projectList.filter(p => p.id !== id);
          setProjectList(newIndex);
          localStorage.setItem('causality_projects_index', JSON.stringify(newIndex));
          localStorage.removeItem(`causality_project_${id}`);
          
          if (currentProjectId === id) {
              setCurrentProjectId(null);
              setState(INITIAL_STATE);
              setHistory({ past: [], future: [] });
          }
      }
  };

  const closeProject = () => {
      setCurrentProjectId(null);
      setState(INITIAL_STATE); 
      setHistory({ past: [], future: [] });
      isCloudDirty.current = false;
      setHasUnsavedChanges(false);
  };

  // --- LOCAL AUTO-SAVE ---
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentProjectId) return;
    isCloudDirty.current = true;

    if (isJustLoaded.current) {
        isJustLoaded.current = false;
    } else {
        setHasUnsavedChanges(true);
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
        localStorage.setItem(`causality_project_${currentProjectId}`, JSON.stringify(state));
        const updatedList = projectList.map(p => 
            p.id === currentProjectId ? { ...p, lastModified: Date.now() } : p
        );
        localStorage.setItem('causality_projects_index', JSON.stringify(updatedList));
    }, 1000);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [state, currentProjectId]); 

  // --- GOOGLE DRIVE INTEGRATION ---
  
  // Auto-init on load if enabled
  useEffect(() => {
      if (state.googleDriveConfig.enabled && state.googleDriveConfig.apiKey && state.googleDriveConfig.clientId) {
          // Initialize silently for background backups
          initializeGapi(state.googleDriveConfig.apiKey, state.googleDriveConfig.clientId)
              .catch(err => console.warn("Failed to auto-init Google Drive:", err));
      }
  }, [state.googleDriveConfig.enabled]);

  const setGoogleDriveConfig = useCallback((config: GoogleDriveConfig) => setState(prev => ({ ...prev, googleDriveConfig: config })), []);

  const connectToDrive = useCallback(async (apiKeyInput?: string, clientIdInput?: string) => {
    // Use inputs if provided (from Settings form), otherwise fallback to state (reconnection attempt)
    const apiKey = apiKeyInput || state.googleDriveConfig.apiKey;
    const clientId = clientIdInput || state.googleDriveConfig.clientId;

    if (!apiKey || !clientId) {
        alert("Please enter API Key and Client ID first.");
        return;
    }
    
    setIsDriveConnecting(true);
    try {
        await initializeGapi(apiKey, clientId);
        await requestAccessToken();
        
        // Only save to state ON SUCCESS
        setState(prev => ({ 
            ...prev, 
            googleDriveConfig: { 
                ...prev.googleDriveConfig, 
                apiKey, 
                clientId, 
                enabled: true 
            } 
        }));
        alert("Connected to Google Drive successfully!");
    } catch (err: any) {
        console.error("Drive connection error:", err);
        let msg = typeof err === 'string' ? err : (err.message || "Unknown error");
        if (msg.includes("popup_closed_by_user")) {
            msg = "Login popup closed. Please try again.";
        } else if (msg.includes("idpiframe_initialization_failed")) {
            msg = "Cookies disabled or origin mismatch. Allow 3rd party cookies and check Cloud Console origins.";
        }
        alert(`Failed to connect: ${msg}`);
    } finally {
        setIsDriveConnecting(false);
    }
  }, [state.googleDriveConfig]);

  const disconnectFromDrive = useCallback(() => {
      if (confirm("Disconnect Google Drive? Auto-backups will stop.")) {
          setState(prev => ({
              ...prev,
              googleDriveConfig: { ...prev.googleDriveConfig, enabled: false, fileId: undefined }
          }));
      }
  }, []);

  const performDriveUpload = async () => {
      const content = JSON.stringify(state, null, 2);
      const currentProjectMeta = projectList.find(p => p.id === currentProjectId);
      const fileName = `backstage_backup_${currentProjectMeta?.name || 'project'}.json`;

      let fileId = state.googleDriveConfig.fileId;
      if (!fileId) {
          const foundId = await findDriveFile(fileName);
          if (foundId) fileId = foundId;
      }

      if (fileId) {
          await updateDriveFile(fileId, content);
      } else {
          fileId = await createDriveFile(fileName, content);
      }

      setState(prev => ({
          ...prev,
          googleDriveConfig: { ...prev.googleDriveConfig, fileId, lastBackup: Date.now() }
      }));
      
      isCloudDirty.current = false;
  };

  const backupToDrive = useCallback(async (force = false) => {
      if (!state.googleDriveConfig.enabled) return;
      if (!force && !state.googleDriveConfig.autoBackup) return;
      if (!isCloudDirty.current && !force) return;
      if (isDriveSyncing) return;

      setIsDriveSyncing(true);
      try {
          await performDriveUpload();
          if (force) alert("Backup complete!");
      } catch (err: any) {
          console.error("Backup failed", err);
          // Check for 401 Unauthorized (Token Expired)
          if (err.status === 401 || (err.result && err.result.error && err.result.error.code === 401)) {
              console.log("Token expired. Attempting refresh...");
              try {
                  await requestAccessToken(); // Request new token (may trigger popup if needed)
                  console.log("Token refreshed. Retrying upload...");
                  await performDriveUpload();
                  if (force) alert("Backup complete (after auth refresh)!");
              } catch (retryErr) {
                  console.error("Retry failed:", retryErr);
                  if (force) alert("Backup failed: Session expired. Please reconnect.");
              }
          } else {
              if (force) alert("Backup failed. See console.");
          }
      } finally {
          setIsDriveSyncing(false);
      }
  }, [state, currentProjectId, projectList, isDriveSyncing]);

  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (state.googleDriveConfig.enabled && state.googleDriveConfig.autoBackup) {
          interval = setInterval(() => {
              if (isCloudDirty.current) {
                  backupToDrive(false);
              }
          }, 30000); 
      }
      return () => { if (interval) clearInterval(interval); };
  }, [state.googleDriveConfig.enabled, state.googleDriveConfig.autoBackup, backupToDrive]);

  // --- EXIT SAFETY ---
  useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if ((state.googleDriveConfig.enabled && isCloudDirty.current) || hasUnsavedChanges) {
              e.preventDefault();
              e.returnValue = ''; 
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.googleDriveConfig.enabled, hasUnsavedChanges]);


  // --- STATS LOGIC ---
  const statsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!currentProjectId) return;
    if (statsTimeoutRef.current) clearTimeout(statsTimeoutRef.current);

    statsTimeoutRef.current = setTimeout(() => {
        const today = new Date().toISOString().split('T')[0];
        let currentTotalWords = 0;
        state.beats.forEach(b => {
            const div = document.createElement('div');
            div.innerHTML = b.content;
            currentTotalWords += (div.textContent || '').trim().split(/\s+/).filter(w => w.length > 0).length;
        });

        setState(prev => {
            const isNewDay = prev.lastSessionDate !== today;
            let startCount = prev.sessionStartCount;
            if (isNewDay) startCount = currentTotalWords;
            const netWordsToday = Math.max(0, currentTotalWords - startCount);
            
            if (prev.dailyStats[today] === netWordsToday && prev.lastSessionDate === today) return prev;

            return {
                ...prev,
                lastSessionDate: today,
                sessionStartCount: startCount,
                dailyStats: { ...prev.dailyStats, [today]: netWordsToday }
            };
        });
    }, 2000);
    return () => { if (statsTimeoutRef.current) clearTimeout(statsTimeoutRef.current); };
  }, [state.beats, currentProjectId]);

  // --- CSS Variable Injection ---
  useEffect(() => {
    const root = document.documentElement;
    const { action, character, dialogue, parenthetical, transition, shot, lyrics, blockBounds } = state.scriptConfig;
    
    const applyStyles = (name: string, config: any) => {
        let englishFont = config.fontFamily ? `"${config.fontFamily}"` : '"Courier Prime"';
        const fontStack = `${englishFont}, "TamilDynamic", monospace`;

        root.style.setProperty(`--margin-${name}`, `${config.marginLeft}%`);
        root.style.setProperty(`--width-${name}`, `${config.width}%`);
        root.style.setProperty(`--mt-${name}`, `${config.marginTop}rem`);
        root.style.setProperty(`--mb-${name}`, `${config.marginBottom}rem`);
        root.style.setProperty(`--size-${name}`, `${config.fontSize || 16}px`);
        root.style.setProperty(`--font-${name}`, fontStack);
        root.style.setProperty(`--align-${name}`, config.textAlign || 'left');
        root.style.setProperty(`--lh-${name}`, config.lineHeight || 1.0);
        root.style.setProperty(`--ls-${name}`, `${config.letterSpacing || 0}px`);
        root.style.setProperty(`--weight-${name}`, config.bold ? 'bold' : 'normal');
        root.style.setProperty(`--style-${name}`, config.italic ? 'italic' : 'normal');
        root.style.setProperty(`--dec-${name}`, config.underline ? 'underline' : 'none');
        root.style.setProperty(`--color-${name}`, config.color || 'black');
        root.style.setProperty(`--bg-${name}`, config.highlightColor || 'transparent');

        if (config.useMusicDecorations) {
            root.style.setProperty(`--prefix-${name}`, '"♫ "');
            root.style.setProperty(`--suffix-${name}`, '" ♫"');
        } else {
            root.style.setProperty(`--prefix-${name}`, '""');
            root.style.setProperty(`--suffix-${name}`, '""');
        }
    };
    applyStyles('action', action);
    applyStyles('character', character);
    applyStyles('dialogue', dialogue);
    applyStyles('parenthetical', parenthetical);
    applyStyles('transition', transition);
    applyStyles('shot', shot || INITIAL_STATE.scriptConfig.shot);
    applyStyles('lyrics', lyrics || INITIAL_STATE.scriptConfig.lyrics);

    const styleId = 'dynamic-font-defs';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }
    
    const boundsEnabled = blockBounds.enabled;
    const boundsMode = blockBounds.mode || 'active'; 
    const boundsColor = blockBounds.color || '#000000';
    const boundsOpacity = blockBounds.opacity || 5;
    const boundsOutline = blockBounds.outlineStyle || 'none';
    const funMode = blockBounds.funMode || 'none';

    const bgVal = hexToRgba(boundsColor, boundsOpacity);
    const fillShadow = `inset 0 0 0 9999px ${bgVal}`;
    let outlineVal = 'none';
    if (boundsOutline !== 'none') {
        outlineVal = `1px ${boundsOutline} ${hexToRgba(boundsColor, 40)}`;
    }

    let extraCss = '';
    let boxShadowVal = fillShadow;

    if (funMode === 'cyber') {
        extraCss = `border: 1px solid ${boundsColor};`;
        boxShadowVal = `${fillShadow}, 0 0 10px ${hexToRgba(boundsColor, 30)}, inset 0 0 10px ${hexToRgba(boundsColor, 10)}`;
    } else if (funMode === 'glass') {
        extraCss = `backdrop-filter: blur(2px); border: 1px solid rgba(255,255,255,0.2);`;
        boxShadowVal = `${fillShadow}, 0 4px 10px rgba(0,0,0,0.1)`;
    } else if (funMode === 'blueprint') {
        extraCss = `background-image: linear-gradient(${hexToRgba(boundsColor, 20)} 1px, transparent 1px), linear-gradient(90deg, ${hexToRgba(boundsColor, 20)} 1px, transparent 1px); background-size: 10px 10px; border: 1px dashed ${boundsColor};`;
    }

    const selector = boundsEnabled 
        ? (boundsMode === 'active' ? '.sc-line.sc-active-block' : '.sc-line')
        : '.dummy-selector-unused';

    const vizCss = `
      ${selector} {
          box-shadow: ${boxShadowVal} !important;
          outline: ${outlineVal};
          ${extraCss}
          border-radius: 4px;
          transition: box-shadow 0.2s, outline 0.2s, background-color 0.2s;
      }
    `;

    styleTag.innerHTML = `
      @font-face {
        font-family: 'TamilDynamic';
        src: local('${state.tamilFontFamily || "Vijaya"}');
        size-adjust: ${state.tamilFontScale || 75}%;
        unicode-range: U+0B80-0BFF;
      }
      ${vizCss}
    `;

  }, [state.scriptConfig, state.tamilFontScale, state.tamilFontFamily]);

  const setGeminiApiKey = useCallback((key: string) => {
      setState(prev => ({ ...prev, geminiApiKey: key }));
  }, []);

  const setStabilityApiKey = useCallback((key: string) => {
      setState(prev => ({ ...prev, stabilityApiKey: key }));
  }, []);
  
  const setBreakdownLanguage = useCallback((lang: 'english' | 'tamil') => {
      setState(prev => ({ ...prev, breakdownLanguage: lang }));
  }, []);

  const setPdfDropEnabled = useCallback((enabled: boolean) => {
      setState(prev => ({ ...prev, isPdfDropEnabled: enabled }));
  }, []);

  // --- WRAPPED SETTERS (WITH HISTORY SNAPSHOT) ---
  
  const setBeats = useCallback((beatsOrFn: any) => {
    setState(prev => ({ ...prev, beats: typeof beatsOrFn === 'function' ? beatsOrFn(prev.beats) : beatsOrFn }));
  }, []);

  const setGroups = useCallback((groupsOrFn: any) => {
    setState(prev => ({ ...prev, groups: typeof groupsOrFn === 'function' ? groupsOrFn(prev.groups) : groupsOrFn }));
  }, []);

  const setConnections = useCallback((connsOrFn: any) => {
    captureSnapshot(); 
    setState(prev => ({ ...prev, connections: typeof connsOrFn === 'function' ? connsOrFn(prev.connections) : connsOrFn }));
  }, [captureSnapshot]);

  const setAnnotations = useCallback((annosOrFn: any) => {
    setState(prev => ({ ...prev, annotations: typeof annosOrFn === 'function' ? annosOrFn(prev.annotations) : annosOrFn }));
  }, []);

  const setCharacterData = useCallback((dataOrFn: any) => {
    captureSnapshot();
    setState(prev => ({ ...prev, characterData: typeof dataOrFn === 'function' ? dataOrFn(prev.characterData) : dataOrFn }));
  }, [captureSnapshot]);

  const setGeneratedShots = useCallback((shotsOrFn: any) => {
    captureSnapshot();
    setState(prev => ({ ...prev, generatedShots: typeof shotsOrFn === 'function' ? shotsOrFn(prev.generatedShots) : shotsOrFn }));
  }, [captureSnapshot]);

  // --- ACTIONS ---
  
  const updateGeneratedShot = useCallback((id: string, updates: Partial<Shot>) => {
    captureSnapshot();
    setState(prev => ({ ...prev, generatedShots: prev.generatedShots.map(s => s.id === id ? { ...s, ...updates } : s) }));
  }, [captureSnapshot]);

  const addGeneratedShot = useCallback((index: number) => {
    captureSnapshot();
    setState(prev => {
        const prevShot = prev.generatedShots[index];
        const newShot: Shot = { id: `manual-${Date.now()}`, shotSize: 'WIDE (WS)', angle: 'EYE LEVEL', description: '', subject: '', imageUrl: null, scene: prevShot ? prevShot.scene : '?' };
        const newShots = [...prev.generatedShots];
        newShots.splice(index + 1, 0, newShot);
        return { ...prev, generatedShots: newShots };
    });
  }, [captureSnapshot]);

  const removeGeneratedShot = useCallback((id: string) => {
      captureSnapshot();
      setState(prev => ({ ...prev, generatedShots: prev.generatedShots.filter(s => s.id !== id) }));
  }, [captureSnapshot]);

  const moveGeneratedShot = useCallback((fromIndex: number, toIndex: number) => {
      captureSnapshot();
      setState(prev => {
          const shots = [...prev.generatedShots];
          if (toIndex < 0 || toIndex >= shots.length) return prev;
          const [movedShot] = shots.splice(fromIndex, 1);
          shots.splice(toIndex, 0, movedShot);
          return { ...prev, generatedShots: shots };
      });
  }, [captureSnapshot]);

  const setPan = useCallback((x: number, y: number) => { setState(prev => ({ ...prev, panX: x, panY: y })); }, []);
  const setScale = useCallback((s: number) => { setState(prev => ({ ...prev, scale: s })); }, []);
  
  const updateBeat = useCallback((id: number, updates: Partial<Beat>) => {
    captureSnapshot();
    setState(prev => ({ ...prev, beats: prev.beats.map(b => b.id === id ? { ...b, ...updates } : b) }));
  }, [captureSnapshot]);
  
  const addBeat = useCallback((x: number, y: number) => {
    captureSnapshot();
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    setState(prev => ({
      ...prev,
      beats: [...prev.beats, { 
        id: newId, 
        x, 
        y, 
        title: '', 
        summary: '', 
        slug: { prefix: '', location: '', time: '' },
        content: '<div class="sc-line sc-action"><br></div>', 
        color: '#444', 
        shots: [], 
        status: 'not-ready', 
        versions: [] 
      }],
      nextId: prev.nextId + 1 
    }));
    return newId;
  }, [captureSnapshot]);

  const addGroup = useCallback((group: Omit<Group, 'id'>) => {
    captureSnapshot();
    setState(prev => ({ ...prev, groups: [...prev.groups, { ...group, id: Date.now() + Math.floor(Math.random() * 1000) }] }));
  }, [captureSnapshot]);

  const updateGroup = useCallback((id: number, updates: Partial<Group>) => {
    captureSnapshot();
    setState(prev => ({ ...prev, groups: prev.groups.map(g => g.id === id ? { ...g, ...updates } : g) }));
  }, [captureSnapshot]);

  const removeGroup = useCallback((id: number) => {
    captureSnapshot();
    setState(prev => ({ ...prev, groups: prev.groups.filter(g => g.id !== id) }));
  }, [captureSnapshot]);
  
  const loadProject = useCallback((data: ProjectState) => {
    const mergedState = { 
        ...INITIAL_STATE, 
        ...data, 
        groups: data.groups || [], 
        userDictionary: data.userDictionary || {}, 
        isOsInputMode: data.isOsInputMode || false, 
        osInputShortcut: data.osInputShortcut || 'NumLock', 
        isStoryboardFeatureEnabled: data.isStoryboardFeatureEnabled || false,
        breakdownLanguage: data.breakdownLanguage || 'english',
        isPdfDropEnabled: data.isPdfDropEnabled || false,
        writingGoal: { ...INITIAL_STATE.writingGoal, ...data.writingGoal }, 
        dailyStats: data.dailyStats || {}, 
        sessionStartCount: data.sessionStartCount || 0, 
        lastSessionDate: data.lastSessionDate || new Date().toISOString().split('T')[0], 
        scriptConfig: { 
            ...INITIAL_STATE.scriptConfig, 
            ...data.scriptConfig,
            blockBounds: { ...INITIAL_STATE.scriptConfig.blockBounds, ...(data.scriptConfig?.blockBounds || {}) },
            slugline: { ...INITIAL_STATE.scriptConfig.slugline, ...(data.scriptConfig?.slugline || {}) }, 
            action: { ...INITIAL_STATE.scriptConfig.action, ...(data.scriptConfig?.action || {}) }, 
            character: { ...INITIAL_STATE.scriptConfig.character, ...(data.scriptConfig?.character || {}) }, 
            dialogue: { ...INITIAL_STATE.scriptConfig.dialogue, ...(data.scriptConfig?.dialogue || {}) }, 
            parenthetical: { ...INITIAL_STATE.scriptConfig.parenthetical, ...(data.scriptConfig?.parenthetical || {}) }, 
            transition: { ...INITIAL_STATE.scriptConfig.transition, ...(data.scriptConfig?.transition || {}) }, 
            shot: { ...INITIAL_STATE.scriptConfig.shot, ...(data.scriptConfig?.shot || {}) },
            lyrics: { ...INITIAL_STATE.scriptConfig.lyrics, ...(data.scriptConfig?.lyrics || {}) },
        }, 
        scriptViewMode: data.scriptViewMode || 'page',
        storyboardConfig: { ...INITIAL_STATE.storyboardConfig, ...(data.storyboardConfig || {}) },
        boardLayerOrder: Array.isArray(data.boardLayerOrder) && data.boardLayerOrder.length > 0 
            ? data.boardLayerOrder 
            : INITIAL_STATE.boardLayerOrder,
        tamilFontScale: data.tamilFontScale || INITIAL_STATE.tamilFontScale,
        tamilFontFamily: data.tamilFontFamily || INITIAL_STATE.tamilFontFamily,
        googleDriveConfig: { ...INITIAL_STATE.googleDriveConfig, ...(data.googleDriveConfig || {}) },
        geminiApiKey: data.geminiApiKey || '',
        stabilityApiKey: data.stabilityApiKey || ''
    };
    
    isJustLoaded.current = true;
    setState(mergedState);
    setHistory({ past: [], future: [] }); // Reset history on new load
    setHasUnsavedChanges(false);
  }, []);

  const saveProject = useCallback(() => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `causality_project_${new Date().toISOString().slice(0,10)}.bst`;
    a.click();
    URL.revokeObjectURL(url);
    setHasUnsavedChanges(false);
  }, [state]);

  const setTamilMode = useCallback((enabled: boolean) => setState(prev => ({ ...prev, isTamilMode: enabled })), []);
  const setTamilFontScale = useCallback((scale: number) => setState(prev => ({ ...prev, tamilFontScale: scale })), []);
  const setTamilFontFamily = useCallback((font: string) => setState(prev => ({ ...prev, tamilFontFamily: font })), []);
  const setOsInputMode = useCallback((enabled: boolean) => setState(prev => ({ ...prev, isOsInputMode: enabled })), []);
  const setOsInputShortcut = useCallback((key: string) => setState(prev => ({ ...prev, osInputShortcut: key })), []);
  const learnTamilWord = useCallback((english: string, tamil: string) => {
    setState(prev => {
      const lowerEng = english.toLowerCase();
      const currentList = prev.userDictionary[lowerEng] || [];
      const filtered = currentList.filter(w => w !== tamil);
      return { ...prev, userDictionary: { ...prev.userDictionary, [lowerEng]: [tamil, ...filtered] } };
    });
  }, []);
  const setScriptConfig = useCallback((config: ScriptConfig) => {
      captureSnapshot();
      setState(prev => ({ ...prev, scriptConfig: config }));
  }, [captureSnapshot]);
  
  const setScriptViewMode = useCallback((mode: 'continuous' | 'page') => setState(prev => ({ ...prev, scriptViewMode: mode })), []);
  
  const setStoryboardConfig = useCallback((config: StoryboardConfig) => {
      captureSnapshot();
      setState(prev => ({ ...prev, storyboardConfig: config }));
  }, [captureSnapshot]);
  
  const setStoryboardFeatureEnabled = useCallback((enabled: boolean) => setState(prev => ({ ...prev, isStoryboardFeatureEnabled: enabled })), []);
  const setWritingGoal = useCallback((goal: WritingGoal) => setState(prev => ({ ...prev, writingGoal: goal })), []);
  const setBoardLayerOrder = useCallback((order: BoardLayer[]) => setState(prev => ({ ...prev, boardLayerOrder: order })), []);

  return (
    <ProjectContext.Provider value={{
      ...state,
      currentUser, currentProjectId, projectList, 
      login, logout, selectProject, createProject, deleteProject, closeProject,
      hasUnsavedChanges,
      setBeats, setGroups, setConnections, setAnnotations, setCharacterData, setGeneratedShots,
      updateGeneratedShot, addGeneratedShot, removeGeneratedShot, moveGeneratedShot,
      setPan, setScale, updateBeat, addBeat, addGroup, updateGroup, removeGroup, loadProject, saveProject,
      setTamilMode, setTamilFontScale, setTamilFontFamily, learnTamilWord, setOsInputMode, setOsInputShortcut, setScriptConfig, setScriptViewMode,
      setStoryboardConfig, setStoryboardFeatureEnabled, setWritingGoal,
      setBoardLayerOrder,
      setGoogleDriveConfig, connectToDrive, disconnectFromDrive, backupToDrive, isDriveSyncing, isDriveConnecting,
      
      // AI Keys
      setGeminiApiKey,
      setStabilityApiKey,
      setBreakdownLanguage,
      
      // Features
      setPdfDropEnabled,

      // History Exports
      undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0, captureSnapshot
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProject must be used within ProjectProvider");
  return context;
};
