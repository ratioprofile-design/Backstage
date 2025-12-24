
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ProjectState, Beat, Connection, Annotation, Shot, CharacterData, ScriptConfig, StoryboardConfig, Group, WritingGoal, ProjectMetadata, BoardLayer, GoogleDriveConfig } from '../types';
import { INITIAL_STATE } from '../constants';
import { initializeGapi, requestAccessToken, findDriveFile, createDriveFile, updateDriveFile } from '../services/googleDrive';

interface ProjectContextType extends ProjectState {
  // Auth & Project Management
  currentUser: string | null;
  currentProjectId: string | null;
  projectList: ProjectMetadata[];
  login: (username: string) => void;
  logout: () => void;
  selectProject: (id: string) => void;
  createProject: (name: string) => void;
  deleteProject: (id: string) => void;
  closeProject: () => void;

  // State Setters (Operate on the currently loaded project)
  setBeats: (beats: Beat[] | ((prev: Beat[]) => Beat[])) => void;
  setGroups: (groups: Group[] | ((prev: Group[]) => Group[])) => void;
  setConnections: (conns: Connection[] | ((prev: Connection[]) => Connection[])) => void;
  setAnnotations: (annos: Annotation[] | ((prev: Annotation[]) => Annotation[])) => void;
  setCharacterData: (data: Record<string, CharacterData> | ((prev: Record<string, CharacterData>) => Record<string, CharacterData>)) => void;
  setGeneratedShots: (shots: Shot[] | ((prev: Shot[]) => Shot[])) => void;
  
  // Shot Management Helpers
  updateGeneratedShot: (id: string, updates: Partial<Shot>) => void;
  addGeneratedShot: (index: number) => void;
  removeGeneratedShot: (id: string) => void;
  moveGeneratedShot: (fromIndex: number, toIndex: number) => void;
  
  setPan: (x: number, y: number) => void;
  setScale: (s: number) => void;
  updateBeat: (id: number, updates: Partial<Beat>) => void;
  addBeat: (x: number, y: number) => number; // Returns new ID
  
  // Group Management
  addGroup: (group: Omit<Group, 'id'>) => void;
  updateGroup: (id: number, updates: Partial<Group>) => void;
  removeGroup: (id: number) => void;

  loadProject: (data: ProjectState) => void;
  saveProject: () => void;
  // Tamil Utils
  setTamilMode: (enabled: boolean) => void;
  setTamilFontScale: (scale: number) => void;
  setTamilFontFamily: (font: string) => void;
  learnTamilWord: (english: string, tamil: string) => void;
  // OS Input Utils
  setOsInputMode: (enabled: boolean) => void;
  setOsInputShortcut: (key: string) => void;
  // Script Layout
  setScriptConfig: (config: ScriptConfig) => void;
  setScriptViewMode: (mode: 'continuous' | 'page') => void;
  // Storyboard Configuration
  setStoryboardConfig: (config: StoryboardConfig) => void;
  setStoryboardFeatureEnabled: (enabled: boolean) => void;
  
  // Goals
  setWritingGoal: (goal: WritingGoal) => void;

  // Google Drive
  setGoogleDriveConfig: (config: GoogleDriveConfig) => void;
  connectToDrive: () => Promise<void>;
  backupToDrive: (force?: boolean) => Promise<void>;
  isDriveSyncing: boolean;
  isDriveConnecting: boolean; // New state exposed

  // Board Layers
  setBoardLayerOrder: (order: BoardLayer[]) => void;
}

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
  
  // Drive State
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);

  // Dirty Flags
  // isCloudDirty is true if local changes exist that haven't been pushed to Drive
  const isCloudDirty = useRef(false);

  // --- PROJECT SELECTION HELPER (Hoisted) ---
  const selectProject = (id: string) => {
      const storedData = localStorage.getItem(`causality_project_${id}`);
      if (storedData) {
          try {
              const parsed = JSON.parse(storedData);
              // Merge with INITIAL to ensure new fields exist
              const mergedState = {
                  ...INITIAL_STATE,
                  ...parsed,
                  groups: parsed.groups || [],
                  userDictionary: parsed.userDictionary || {},
                  isOsInputMode: parsed.isOsInputMode || false,
                  osInputShortcut: parsed.osInputShortcut || 'NumLock',
                  isStoryboardFeatureEnabled: parsed.isStoryboardFeatureEnabled || true, // Force enabled on load if needed or respect saved
                  writingGoal: { ...INITIAL_STATE.writingGoal, ...(parsed.writingGoal || {}) },
                  dailyStats: parsed.dailyStats || {},
                  sessionStartCount: parsed.sessionStartCount || 0,
                  lastSessionDate: parsed.lastSessionDate || new Date().toISOString().split('T')[0],
                  scriptConfig: { 
                      ...INITIAL_STATE.scriptConfig, 
                      ...parsed.scriptConfig,
                      // Deep Merge Block Bounds
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
                  googleDriveConfig: { ...INITIAL_STATE.googleDriveConfig, ...(parsed.googleDriveConfig || {}) }
              };
              setState(mergedState);
              setCurrentProjectId(id);
              isCloudDirty.current = false; // Reset dirty flag on load
          } catch (e) {
              console.error("Failed to load project data", e);
              alert("Error loading project file.");
          }
      } else {
          // If ID exists in list but not in storage (corruption?), init empty
          console.warn("Project data missing, initializing empty.");
          setState(INITIAL_STATE);
          setCurrentProjectId(id);
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
      
      // Update Index
      const newIndex = [meta, ...projectList];
      setProjectList(newIndex);
      localStorage.setItem('causality_projects_index', JSON.stringify(newIndex));
      
      // Init State
      const newState = { ...INITIAL_STATE };
      localStorage.setItem(`causality_project_${newId}`, JSON.stringify(newState));
      
      // Select It
      selectProject(newId);
  };

  // --- INITIALIZATION & MIGRATION ---
  useEffect(() => {
    // Load Project Index
    const storedIndex = localStorage.getItem('causality_projects_index');
    let index: ProjectMetadata[] = storedIndex ? JSON.parse(storedIndex) : [];

    // MIGRATION: Check for legacy single-project data
    const legacyData = localStorage.getItem('causality_data');
    const isMigrated = localStorage.getItem('causality_migration_complete');

    if (legacyData && !isMigrated) {
        console.log("Migrating legacy project...");
        const legacyId = `legacy-${Date.now()}`;
        const legacyProject: ProjectMetadata = {
            id: legacyId,
            name: 'Imported Project',
            lastModified: Date.now(),
            created: Date.now()
        };
        // Save legacy data to new key format
        localStorage.setItem(`causality_project_${legacyId}`, legacyData);
        
        // Add to index
        index.push(legacyProject);
        
        // Mark migrated (we don't delete legacy data to be safe, just mark it)
        localStorage.setItem('causality_migration_complete', 'true');
    }

    // Sort by last modified descending
    index.sort((a, b) => b.lastModified - a.lastModified);
    setProjectList(index);

    // AUTO-LOGIN LOGIC
    // If no project selected, check if we can auto-select the latest one
    if (!currentProjectId) {
        if (index.length > 0) {
            // Select most recent
            selectProject(index[0].id);
        } else {
            // Create default if none exists
            createProject('My Story');
        }
    }
  }, []);

  // --- USER AUTH ---
  const login = (username: string) => {
      localStorage.setItem('causality_user', username);
      setCurrentUser(username);
  };

  const logout = () => {
      localStorage.removeItem('causality_user');
      setCurrentUser(null);
      setCurrentProjectId(null);
      setState(INITIAL_STATE);
  };

  // --- PROJECT CRUD ---
  
  const deleteProject = (id: string) => {
      if (confirm("Are you sure you want to delete this project? This cannot be undone.")) {
          const newIndex = projectList.filter(p => p.id !== id);
          setProjectList(newIndex);
          localStorage.setItem('causality_projects_index', JSON.stringify(newIndex));
          localStorage.removeItem(`causality_project_${id}`);
          
          if (currentProjectId === id) {
              setCurrentProjectId(null);
              setState(INITIAL_STATE);
          }
      }
  };

  const closeProject = () => {
      // Check for unsaved changes before closing? 
      // Ideally we should sync, but for now we just clear state
      setCurrentProjectId(null);
      setState(INITIAL_STATE); 
      isCloudDirty.current = false;
  };

  // --- LOCAL AUTO-SAVE (HIGH FREQUENCY) ---
  // Debounce saving to localStorage to avoid disk thrashing
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only save if we have an active project
    if (!currentProjectId) return;

    // Mark as dirty whenever state changes
    isCloudDirty.current = true;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
        // 1. Save Content Locally
        localStorage.setItem(`causality_project_${currentProjectId}`, JSON.stringify(state));
        
        // 2. Update Last Modified in Index
        const updatedList = projectList.map(p => 
            p.id === currentProjectId ? { ...p, lastModified: Date.now() } : p
        );
        localStorage.setItem('causality_projects_index', JSON.stringify(updatedList));
    }, 1000); // 1s debounce

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [state, currentProjectId]); 

  // --- GOOGLE DRIVE INTEGRATION ---
  const setGoogleDriveConfig = useCallback((config: GoogleDriveConfig) => setState(prev => ({ ...prev, googleDriveConfig: config })), []);

  const connectToDrive = useCallback(async () => {
    const { apiKey, clientId } = state.googleDriveConfig;
    if (!apiKey || !clientId) {
        alert("Please enter API Key and Client ID first.");
        return;
    }
    
    setIsDriveConnecting(true);
    try {
        await initializeGapi(apiKey, clientId);
        await requestAccessToken();
        setState(prev => ({ 
            ...prev, 
            googleDriveConfig: { ...prev.googleDriveConfig, enabled: true } 
        }));
        alert("Connected to Google Drive successfully!");
    } catch (err: any) {
        console.error("Drive connection error:", err);
        let msg = "Unknown error";
        if (typeof err === 'string') msg = err;
        else if (err.result && err.result.error && err.result.error.message) msg = err.result.error.message;
        else if (err.error && err.error.message) msg = err.error.message;
        else if (err.message) msg = err.message;
        else if (err.details) msg = err.details;
        else msg = JSON.stringify(err);
        
        alert(`Failed to connect to Google Drive: ${msg}`);
    } finally {
        setIsDriveConnecting(false);
    }
  }, [state.googleDriveConfig]);

  const backupToDrive = useCallback(async (force = false) => {
      // Must be enabled
      if (!state.googleDriveConfig.enabled) return;
      
      // If auto-backup is OFF and this isn't a forced save, do nothing
      if (!force && !state.googleDriveConfig.autoBackup) return;

      // If NOT dirty and NOT forced, do nothing (Optimization)
      if (!isCloudDirty.current && !force) return;

      // Prevent concurrent syncs
      if (isDriveSyncing) return;

      setIsDriveSyncing(true);
      try {
          const content = JSON.stringify(state, null, 2);
          const currentProjectMeta = projectList.find(p => p.id === currentProjectId);
          const fileName = `backstage_backup_${currentProjectMeta?.name || 'project'}.json`;

          let fileId = state.googleDriveConfig.fileId;

          // If we don't have a stored ID, search for it
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
          
          isCloudDirty.current = false; // Reset dirty flag after successful save
          
          if (force) alert("Backup complete!");

      } catch (err) {
          console.error("Backup failed", err);
          if (force) alert("Backup failed. See console.");
      } finally {
          setIsDriveSyncing(false);
      }
  }, [state, currentProjectId, projectList, isDriveSyncing]);

  // --- AUTO-BACKUP TIMER ---
  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      
      if (state.googleDriveConfig.enabled && state.googleDriveConfig.autoBackup) {
          // Check every 30 seconds if we need to backup
          interval = setInterval(() => {
              if (isCloudDirty.current) {
                  backupToDrive(false);
              }
          }, 30000); 
      }

      return () => { if (interval) clearInterval(interval); };
  }, [state.googleDriveConfig.enabled, state.googleDriveConfig.autoBackup, backupToDrive]);

  // --- EXIT SAFETY ---
  // Warn user if they try to close tab while cloud is dirty
  useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if (state.googleDriveConfig.enabled && isCloudDirty.current) {
              e.preventDefault();
              e.returnValue = ''; // Standard for showing confirmation dialog
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.googleDriveConfig.enabled]);


  // --- STATS LOGIC (Merged from previous implementation) ---
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
            
            // Only update if changed to avoid loop
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

  // --- CSS Variable Injection & Tamil Font Scaling ---
  useEffect(() => {
    const root = document.documentElement;
    const { action, character, dialogue, parenthetical, transition, shot, lyrics, blockBounds } = state.scriptConfig;
    
    const applyStyles = (name: string, config: any) => {
        // Use user selected font family (e.g. 'Vijaya' or 'Courier Prime')
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

    // Inject Dynamic Fonts (Tamil Scale)
    const styleId = 'dynamic-font-defs';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }
    
    // --- LAYOUT VIZ GENERATION ---
    const boundsEnabled = blockBounds.enabled;
    const boundsMode = blockBounds.mode || 'active'; // 'active' | 'all'
    const boundsColor = blockBounds.color || '#000000';
    const boundsOpacity = blockBounds.opacity || 5;
    const boundsOutline = blockBounds.outlineStyle || 'none'; // 'none' | 'dashed' | 'dotted' | 'solid'
    const funMode = blockBounds.funMode || 'none';

    // Calculate Background (Use Box Shadow for overlay to preserve text-highlight)
    const bgVal = hexToRgba(boundsColor, boundsOpacity);
    const fillShadow = `inset 0 0 0 9999px ${bgVal}`;
    
    // Calculate Outline
    let outlineVal = 'none';
    if (boundsOutline !== 'none') {
        outlineVal = `1px ${boundsOutline} ${hexToRgba(boundsColor, 40)}`;
    }

    // Fun Mode Extras
    let extraCss = '';
    let boxShadowVal = fillShadow;

    if (funMode === 'cyber') {
        extraCss = `border: 1px solid ${boundsColor};`; // Border instead of outline for cyber
        boxShadowVal = `${fillShadow}, 0 0 10px ${hexToRgba(boundsColor, 30)}, inset 0 0 10px ${hexToRgba(boundsColor, 10)}`;
    } else if (funMode === 'glass') {
        extraCss = `backdrop-filter: blur(2px); border: 1px solid rgba(255,255,255,0.2);`;
        boxShadowVal = `${fillShadow}, 0 4px 10px rgba(0,0,0,0.1)`;
    } else if (funMode === 'blueprint') {
        // Blueprint uses background-image which sits on top of background-color.
        extraCss = `background-image: linear-gradient(${hexToRgba(boundsColor, 20)} 1px, transparent 1px), linear-gradient(90deg, ${hexToRgba(boundsColor, 20)} 1px, transparent 1px); background-size: 10px 10px; border: 1px dashed ${boundsColor};`;
    }

    // Target Selection
    // If Mode is Active: Apply to .sc-active-block
    // If Mode is All: Apply to .sc-line
    const selector = boundsEnabled 
        ? (boundsMode === 'active' ? '.sc-line.sc-active-block' : '.sc-line')
        : '.dummy-selector-unused'; // Effectively disable

    const vizCss = `
      ${selector} {
          /* Use box-shadow instead of background-color to overlay on top of highlights */
          box-shadow: ${boxShadowVal} !important;
          outline: ${outlineVal};
          ${extraCss}
          border-radius: 4px; /* Slight polish */
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
      
      /* Layout Visualization Engine */
      ${vizCss}
    `;

  }, [state.scriptConfig, state.tamilFontScale, state.tamilFontFamily]);

  // --- STATE SETTERS ---
  const setBeats = useCallback((beatsOrFn: any) => {
    setState(prev => ({ ...prev, beats: typeof beatsOrFn === 'function' ? beatsOrFn(prev.beats) : beatsOrFn }));
  }, []);
  const setGroups = useCallback((groupsOrFn: any) => {
    setState(prev => ({ ...prev, groups: typeof groupsOrFn === 'function' ? groupsOrFn(prev.groups) : groupsOrFn }));
  }, []);
  const setConnections = useCallback((connsOrFn: any) => {
    setState(prev => ({ ...prev, connections: typeof connsOrFn === 'function' ? connsOrFn(prev.connections) : connsOrFn }));
  }, []);
  const setAnnotations = useCallback((annosOrFn: any) => {
    setState(prev => ({ ...prev, annotations: typeof annosOrFn === 'function' ? annosOrFn(prev.annotations) : annosOrFn }));
  }, []);
  const setCharacterData = useCallback((dataOrFn: any) => {
    setState(prev => ({ ...prev, characterData: typeof dataOrFn === 'function' ? dataOrFn(prev.characterData) : dataOrFn }));
  }, []);
  const setGeneratedShots = useCallback((shotsOrFn: any) => {
    setState(prev => ({ ...prev, generatedShots: typeof shotsOrFn === 'function' ? shotsOrFn(prev.generatedShots) : shotsOrFn }));
  }, []);

  // --- Helpers ---
  const updateGeneratedShot = useCallback((id: string, updates: Partial<Shot>) => {
    setState(prev => ({ ...prev, generatedShots: prev.generatedShots.map(s => s.id === id ? { ...s, ...updates } : s) }));
  }, []);
  const addGeneratedShot = useCallback((index: number) => {
    setState(prev => {
        const prevShot = prev.generatedShots[index];
        const newShot: Shot = { id: `manual-${Date.now()}`, shotSize: 'WIDE (WS)', angle: 'EYE LEVEL', description: '', subject: '', imageUrl: null, scene: prevShot ? prevShot.scene : '?' };
        const newShots = [...prev.generatedShots];
        newShots.splice(index + 1, 0, newShot);
        return { ...prev, generatedShots: newShots };
    });
  }, []);
  const removeGeneratedShot = useCallback((id: string) => {
      setState(prev => ({ ...prev, generatedShots: prev.generatedShots.filter(s => s.id !== id) }));
  }, []);
  const moveGeneratedShot = useCallback((fromIndex: number, toIndex: number) => {
      setState(prev => {
          const shots = [...prev.generatedShots];
          if (toIndex < 0 || toIndex >= shots.length) return prev;
          const [movedShot] = shots.splice(fromIndex, 1);
          shots.splice(toIndex, 0, movedShot);
          return { ...prev, generatedShots: shots };
      });
  }, []);
  const setPan = useCallback((x: number, y: number) => { setState(prev => ({ ...prev, panX: x, panY: y })); }, []);
  const setScale = useCallback((s: number) => { setState(prev => ({ ...prev, scale: s })); }, []);
  const updateBeat = useCallback((id: number, updates: Partial<Beat>) => {
    setState(prev => ({ ...prev, beats: prev.beats.map(b => b.id === id ? { ...b, ...updates } : b) }));
  }, []);
  
  // NEW BEAT CREATION
  const addBeat = useCallback((x: number, y: number) => {
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    setState(prev => ({
      ...prev,
      beats: [...prev.beats, { 
        id: newId, 
        x, 
        y, 
        title: '', 
        summary: '', 
        slug: { prefix: '', location: '', time: '' }, // Empty default
        content: '<div class="sc-line sc-action"><br></div>', 
        color: '#444', 
        shots: [], 
        status: 'not-ready', 
        versions: [] 
      }],
      nextId: prev.nextId + 1 
    }));
    return newId;
  }, []);

  const addGroup = useCallback((group: Omit<Group, 'id'>) => {
    setState(prev => ({ ...prev, groups: [...prev.groups, { ...group, id: Date.now() + Math.floor(Math.random() * 1000) }] }));
  }, []);
  const updateGroup = useCallback((id: number, updates: Partial<Group>) => {
    setState(prev => ({ ...prev, groups: prev.groups.map(g => g.id === id ? { ...g, ...updates } : g) }));
  }, []);
  const removeGroup = useCallback((id: number) => {
    setState(prev => ({ ...prev, groups: prev.groups.filter(g => g.id !== id) }));
  }, []);
  
  // Direct State load (used by file upload)
  const loadProject = useCallback((data: ProjectState) => {
    // Merge with initial to be safe
    setState({ 
        ...INITIAL_STATE, 
        ...data, 
        groups: data.groups || [], 
        userDictionary: data.userDictionary || {}, 
        isOsInputMode: data.isOsInputMode || false, 
        osInputShortcut: data.osInputShortcut || 'NumLock', 
        isStoryboardFeatureEnabled: data.isStoryboardFeatureEnabled || false, 
        writingGoal: { ...INITIAL_STATE.writingGoal, ...data.writingGoal }, 
        dailyStats: data.dailyStats || {}, 
        sessionStartCount: data.sessionStartCount || 0, 
        lastSessionDate: data.lastSessionDate || new Date().toISOString().split('T')[0], 
        scriptConfig: { 
            ...INITIAL_STATE.scriptConfig, 
            ...data.scriptConfig,
            // Deep merge block bounds
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
        googleDriveConfig: { ...INITIAL_STATE.googleDriveConfig, ...(data.googleDriveConfig || {}) }
    });
  }, []);

  const saveProject = useCallback(() => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Export as .bst (Backstage Story File) custom format
    a.download = `causality_project_${new Date().toISOString().slice(0,10)}.bst`;
    a.click();
    URL.revokeObjectURL(url);
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
  const setScriptConfig = useCallback((config: ScriptConfig) => setState(prev => ({ ...prev, scriptConfig: config })), []);
  const setScriptViewMode = useCallback((mode: 'continuous' | 'page') => setState(prev => ({ ...prev, scriptViewMode: mode })), []);
  const setStoryboardConfig = useCallback((config: StoryboardConfig) => setState(prev => ({ ...prev, storyboardConfig: config })), []);
  const setStoryboardFeatureEnabled = useCallback((enabled: boolean) => setState(prev => ({ ...prev, isStoryboardFeatureEnabled: enabled })), []);
  const setWritingGoal = useCallback((goal: WritingGoal) => setState(prev => ({ ...prev, writingGoal: goal })), []);
  const setBoardLayerOrder = useCallback((order: BoardLayer[]) => setState(prev => ({ ...prev, boardLayerOrder: order })), []);

  return (
    <ProjectContext.Provider value={{
      ...state,
      // New Auth/Project Props
      currentUser, currentProjectId, projectList, 
      login, logout, selectProject, createProject, deleteProject, closeProject,
      // Setters
      setBeats, setGroups, setConnections, setAnnotations, setCharacterData, setGeneratedShots,
      updateGeneratedShot, addGeneratedShot, removeGeneratedShot, moveGeneratedShot,
      setPan, setScale, updateBeat, addBeat, addGroup, updateGroup, removeGroup, loadProject, saveProject,
      setTamilMode, setTamilFontScale, setTamilFontFamily, learnTamilWord, setOsInputMode, setOsInputShortcut, setScriptConfig, setScriptViewMode,
      setStoryboardConfig, setStoryboardFeatureEnabled, setWritingGoal,
      setBoardLayerOrder,
      setGoogleDriveConfig, connectToDrive, backupToDrive, isDriveSyncing, isDriveConnecting
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
