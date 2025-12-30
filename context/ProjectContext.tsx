
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  ProjectState, ProjectContextType, Beat, Group, Connection, Annotation, 
  CharacterData, Shot, Note, ScriptConfig, ScratchpadConfig, StoryboardConfig, 
  WritingGoal, GoogleDriveConfig, ProjectMetadata, BeatStatus, BeatVersion,
  BoardLayer
} from '../types';
import { INITIAL_STATE, NOTE_FONTS } from '../constants';
import { initializeGapi, requestAccessToken, createDriveFile, updateDriveFile, findDriveFile } from '../services/googleDrive';
import { updateGeminiConfig } from '../services/gemini';

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// Helper function
const hexToRgba = (hex: string, opacity: number): string => {
    let c: any;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+opacity/100+')';
    }
    return `rgba(0,0,0,${opacity/100})`;
};

// Helper to count words in HTML string (Robust)
const countWords = (html: string) => {
    // Strip HTML tags, replace &nbsp; and other whitespace chars with standard space
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    if (text.length === 0) return 0;
    return text.split(/\s+/).filter(w => w.length > 0).length;
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('currentUser'));
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(localStorage.getItem('currentProjectId'));
  const [projectList, setProjectList] = useState<ProjectMetadata[]>(() => {
      const stored = localStorage.getItem('projectList');
      return stored ? JSON.parse(stored) : [];
  });

  // Project State (Initialized with INITIAL_STATE)
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
  
  // Configs
  const [isTamilMode, setTamilModeState] = useState(INITIAL_STATE.isTamilMode);
  const [tamilFontScale, setTamilFontScaleState] = useState(INITIAL_STATE.tamilFontScale);
  const [tamilFontFamily, setTamilFontFamilyState] = useState(INITIAL_STATE.tamilFontFamily);
  const [userDictionary, setUserDictionary] = useState(INITIAL_STATE.userDictionary);
  const [isOsInputMode, setOsInputModeState] = useState(INITIAL_STATE.isOsInputMode);
  const [osInputShortcut, setOsInputShortcutState] = useState(INITIAL_STATE.osInputShortcut);
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

  // Volatile State
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);

  // History
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoing = useRef(false);

  // --- ACTIONS ---

  const captureSnapshot = useCallback(() => {
      if (isUndoing.current) return;
      
      const snapshot = JSON.stringify({
          beats, groups, connections, annotations, characterData, generatedShots, 
          scratchpad, globalNotes, 
      });

      // Avoid duplicate consecutive snapshots
      if (historyIndexRef.current >= 0 && historyRef.current[historyIndexRef.current] === snapshot) return;

      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(snapshot);
      
      // Limit history size
      if (newHistory.length > 50) newHistory.shift();
      
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      setHasUnsavedChanges(true);
  }, [beats, groups, connections, annotations, characterData, generatedShots, scratchpad, globalNotes]);

  // Initial Snapshot on Load
  useEffect(() => {
      if (historyRef.current.length === 0 && beats.length > 0) {
          captureSnapshot();
      }
  }, [beats]); 

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

  const logout = () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentProjectId');
      setCurrentUser(null);
      setCurrentProjectId(null);
  };

  const createProject = (name: string) => {
      const newProject: ProjectMetadata = {
          id: `proj_${Date.now()}`,
          name,
          created: Date.now(),
          lastModified: Date.now()
      };
      const updatedList = [...projectList, newProject];
      setProjectList(updatedList);
      localStorage.setItem('projectList', JSON.stringify(updatedList));
      selectProject(newProject.id);
  };

  const selectProject = (id: string) => {
      const dataStr = localStorage.getItem(`project_data_${id}`);
      if (dataStr) {
          loadProject(JSON.parse(dataStr));
      } else {
          loadProject(INITIAL_STATE);
      }
      setCurrentProjectId(id);
      localStorage.setItem('currentProjectId', id);
  };

  const deleteProject = (id: string) => {
      const updatedList = projectList.filter(p => p.id !== id);
      setProjectList(updatedList);
      localStorage.setItem('projectList', JSON.stringify(updatedList));
      localStorage.removeItem(`project_data_${id}`);
      if (currentProjectId === id) {
          setCurrentProjectId(null);
          localStorage.removeItem('currentProjectId');
      }
  };

  const closeProject = () => {
      setCurrentProjectId(null);
      localStorage.removeItem('currentProjectId');
  };

  const saveProject = useCallback(() => {
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

      localStorage.setItem(`project_data_${currentProjectId}`, JSON.stringify(projectData));
      
      // Update metadata
      const updatedList = projectList.map(p => p.id === currentProjectId ? { ...p, lastModified: Date.now() } : p);
      setProjectList(updatedList);
      localStorage.setItem('projectList', JSON.stringify(updatedList));
      
      setHasUnsavedChanges(false);

      // Auto Backup to Drive if enabled
      if (googleDriveConfig.enabled && googleDriveConfig.autoBackup) {
          backupToDrive(false);
      }
  }, [
      currentProjectId, projectList, beats, groups, connections, annotations, characterData, 
      generatedShots, scratchpad, globalNotes, panX, panY, scale, nextId, nextAnnoId,
      isTamilMode, tamilFontScale, tamilFontFamily, userDictionary, isOsInputMode, osInputShortcut,
      scriptConfig, scriptViewMode, scratchpadConfig, storyboardConfig, isStoryboardFeatureEnabled,
      breakdownLanguage, breakdownLockedOnly, isPdfDropEnabled, isRedoEnabled, writingGoal, googleDriveConfig, geminiApiKey, stabilityApiKey,
      dailyStats, sessionStartCount, lastSessionDate, boardLayerOrder
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
      
      saveProject(); // Ensure state is saved to local storage as well
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
      setScaleState(merged.scale);
      setNextId(merged.nextId);
      setNextAnnoId(merged.nextAnnoId);
      setTamilModeState(merged.isTamilMode);
      setTamilFontScaleState(merged.tamilFontScale);
      setTamilFontFamilyState(merged.tamilFontFamily);
      setUserDictionary(merged.userDictionary);
      setOsInputModeState(merged.isOsInputMode);
      setOsInputShortcutState(merged.osInputShortcut);
      setScriptConfigState(merged.scriptConfig);
      setScriptViewModeState(merged.scriptViewMode);
      setScratchpadConfigState(merged.scratchpadConfig);
      setStoryboardConfigState(merged.storyboardConfig);
      setStoryboardFeatureEnabledState(merged.isStoryboardFeatureEnabled);
      setBreakdownLanguageState(merged.breakdownLanguage);
      setBreakdownLockedOnlyState(merged.breakdownLockedOnly ?? INITIAL_STATE.breakdownLockedOnly);
      setPdfDropEnabledState(merged.isPdfDropEnabled);
      setRedoEnabledState(merged.isRedoEnabled ?? false);
      setWritingGoalState(merged.writingGoal);
      setGoogleDriveConfigState(merged.googleDriveConfig);
      setGeminiApiKeyState(merged.geminiApiKey);
      setStabilityApiKeyState(merged.stabilityApiKey);
      setDailyStats(merged.dailyStats);
      setSessionStartCount(merged.sessionStartCount);
      setLastSessionDate(merged.lastSessionDate);
      setBoardLayerOrderState(merged.boardLayerOrder);
      
      // Update global API Key service
      if (merged.geminiApiKey) updateGeminiConfig(merged.geminiApiKey);

      // Reset History
      historyRef.current = [];
      historyIndexRef.current = -1;
      setHasUnsavedChanges(false);
  };

  // --- GOOGLE DRIVE ---
  const connectToDrive = async (apiKey?: string, clientId?: string) => {
      if (!apiKey || !clientId) {
          alert("API Key and Client ID required.");
          return;
      }
      setIsDriveConnecting(true);
      try {
          await initializeGapi(apiKey, clientId);
          await requestAccessToken();
          setGoogleDriveConfigState(prev => ({ ...prev, enabled: true, apiKey, clientId }));
          alert("Connected to Google Drive!");
      } catch (err) {
          console.error(err);
          alert("Failed to connect to Google Drive: " + err);
      } finally {
          setIsDriveConnecting(false);
      }
  };

  const disconnectFromDrive = () => {
      setGoogleDriveConfigState(prev => ({ ...prev, enabled: false, fileId: undefined }));
  };

  const backupToDrive = async (force: boolean = false) => {
      if (!googleDriveConfig.enabled || !currentProjectId) return;
      if (!force && Date.now() - (googleDriveConfig.lastBackup || 0) < 300000) return; // 5 min debounce

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
                  setGoogleDriveConfigState(prev => ({ ...prev, fileId: existingId }));
              } else {
                  const newId = await createDriveFile(fileName, content);
                  setGoogleDriveConfigState(prev => ({ ...prev, fileId: newId }));
              }
          }
          setGoogleDriveConfigState(prev => ({ ...prev, lastBackup: Date.now() }));
      } catch (err) {
          console.error("Backup failed", err);
          if (force) alert("Backup failed. Check console.");
      } finally {
          setIsDriveSyncing(false);
      }
  };

  // --- STATE SETTERS WRAPPERS ---
  const setPan = (x: number, y: number) => { setPanX(x); setPanY(y); };
  const setScale = (s: number) => setScaleState(s);
  
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
          // Calculate stats update if content changed
          const target = prev.find(b => b.id === id);
          let delta = 0;
          
          if (target && updates.content !== undefined && updates.content !== target.content) {
              const oldWords = countWords(target.content);
              const newWords = countWords(updates.content);
              delta = newWords - oldWords;
          }
          
          if (delta !== 0) {
              // Scheduling stats update to avoid side-effect inside reducer
              setTimeout(() => {
                  const today = new Date().toISOString().split('T')[0];
                  setDailyStats(curr => ({
                      ...curr,
                      [today]: (curr[today] || 0) + delta
                  }));
              }, 0);
          }
          
          return prev.map(b => b.id === id ? { ...b, ...updates } : b);
      });
      captureSnapshot();
  };

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

  // Shot Management
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

  // Tamil Utils
  const learnTamilWord = (english: string, tamil: string) => {
      setUserDictionary(prev => {
          const current = prev[english.toLowerCase()] || [];
          if (!current.includes(tamil)) {
              return { ...prev, [english.toLowerCase()]: [tamil, ...current] };
          }
          return prev;
      });
  };

  // --- CSS Variable Injection ---
  useEffect(() => {
    const root = document.documentElement;
    // Default fallback to prevent crash if scriptConfig is undefined
    const config = scriptConfig || INITIAL_STATE.scriptConfig;
    const { action, character, dialogue, parenthetical, transition, shot, lyrics, blockBounds } = config;
    
    const applyStyles = (name: string, cfg: any) => {
        if (!cfg) return;
        let englishFont = cfg.fontFamily ? `"${cfg.fontFamily}"` : '"Courier Prime"';
        const fontStack = `${englishFont}, "TamilDynamic", monospace`;

        root.style.setProperty(`--margin-${name}`, `${cfg.marginLeft}%`);
        root.style.setProperty(`--width-${name}`, `${cfg.width}%`);
        root.style.setProperty(`--mt-${name}`, `${cfg.marginTop}rem`);
        root.style.setProperty(`--mb-${name}`, `${cfg.marginBottom}rem`);
        root.style.setProperty(`--size-${name}`, `${cfg.fontSize || 16}px`);
        root.style.setProperty(`--font-${name}`, fontStack);
        root.style.setProperty(`--align-${name}`, cfg.textAlign || 'left');
        root.style.setProperty(`--lh-${name}`, cfg.lineHeight || 1.0);
        root.style.setProperty(`--ls-${name}`, `${cfg.letterSpacing || 0}px`);
        root.style.setProperty(`--weight-${name}`, cfg.bold ? 'bold' : 'normal');
        root.style.setProperty(`--style-${name}`, cfg.italic ? 'italic' : 'normal');
        root.style.setProperty(`--dec-${name}`, cfg.underline ? 'underline' : 'none');
        root.style.setProperty(`--color-${name}`, cfg.color || 'black');
        root.style.setProperty(`--bg-${name}`, cfg.highlightColor || 'transparent');

        if (cfg.useMusicDecorations) {
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
    
    const boundsEnabled = blockBounds?.enabled ?? false;
    const boundsMode = blockBounds?.mode || 'active'; 
    const boundsColor = blockBounds?.color || '#000000';
    const boundsOpacity = blockBounds?.opacity || 5;
    const boundsOutline = blockBounds?.outlineStyle || 'none';
    const funMode = blockBounds?.funMode || 'none';

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
    
    // Inject Scratchpad Variables
    const sp = scratchpadConfig || INITIAL_STATE.scratchpadConfig;
    
    let bulletChar = '"•"';
    switch(sp.bulletStyle) {
        case 'circle': bulletChar = '"◦"'; break;
        case 'square': bulletChar = '"■"'; break;
        case 'dash': bulletChar = '"—"'; break;
        case 'arrow': bulletChar = '"➤"'; break;
        default: bulletChar = '"•"';
    }

    const scratchCss = `
      :root {
        --sp-h1-color: ${sp.h1Color || '#ffffff'};
        --sp-h2-color: ${sp.h2Color || '#f5a623'};
        --sp-h1-size: ${sp.h1FontSize}px;
        --sp-h2-size: ${sp.h2FontSize}px;
        --sp-bold-color: ${sp.boldColor};
        --sp-italic-color: ${sp.italicColor};
        --sp-h1-deco: ${sp.h1Underline ? 'underline' : 'none'};
        --sp-h2-deco: ${sp.h2Underline ? 'underline' : 'none'};
        --sp-h1-style: ${sp.h1Italic ? 'italic' : 'normal'};
        --sp-h2-style: ${sp.h2Italic ? 'italic' : 'normal'};
        --sp-list-marker: ${sp.listMarkerColor || '#f5a623'};
        --sp-callout-bg: ${sp.calloutBackground || 'rgba(245, 166, 35, 0.05)'};
        --sp-callout-border: ${sp.calloutBorder || '#f5a623'};
        --sp-todo-border: ${sp.todoBorder || '#666'};
        --sp-todo-check: ${sp.todoCheckColor || '#f5a623'};
        --sp-block-margin: ${sp.blockSpacing || 2}px;
        --sp-bullet-char: ${bulletChar};
      }
      .nl-block strong { color: var(--sp-bold-color); }
      .nl-block em { color: var(--sp-italic-color); }
      .nl-h1 { font-size: var(--sp-h1-size) !important; }
      .nl-h2 { font-size: var(--sp-h2-size) !important; }
    `;

    styleTag.innerHTML = `
      @font-face {
        font-family: 'TamilDynamic';
        src: local('${tamilFontFamily || "Vijaya"}');
        size-adjust: ${tamilFontScale || 75}%;
        unicode-range: U+0B80-0BFF;
      }
      ${vizCss}
      ${scratchCss}
    `;

  }, [scriptConfig, tamilFontScale, tamilFontFamily, scratchpadConfig]);

  const setScriptConfig = (config: ScriptConfig) => {
      setScriptConfigState(config);
      captureSnapshot();
  };
  const setScriptViewMode = (mode: 'continuous' | 'page') => setScriptViewModeState(mode);
  const setScratchpadConfig = (config: ScratchpadConfig) => {
      setScratchpadConfigState(config);
      captureSnapshot();
  };
  const setStoryboardConfig = (config: StoryboardConfig) => setStoryboardConfigState(config);
  const setStoryboardFeatureEnabled = (enabled: boolean) => setStoryboardFeatureEnabledState(enabled);
  const setBreakdownLanguage = (lang: 'english' | 'tamil') => setBreakdownLanguageState(lang);
  const setBreakdownLockedOnly = (enabled: boolean) => { setBreakdownLockedOnlyState(enabled); captureSnapshot(); };
  const setPdfDropEnabled = (enabled: boolean) => setPdfDropEnabledState(enabled);
  const setRedoEnabled = (enabled: boolean) => { setRedoEnabledState(enabled); captureSnapshot(); };
  const setWritingGoal = (goal: WritingGoal) => setWritingGoalState(goal);
  const setGoogleDriveConfig = (config: GoogleDriveConfig) => setGoogleDriveConfigState(config);
  const setGeminiApiKey = (key: string) => { setGeminiApiKeyState(key); };
  const setStabilityApiKey = (key: string) => { setStabilityApiKeyState(key); };
  const setBoardLayerOrder = (order: BoardLayer[]) => setBoardLayerOrderState(order);
  const setTamilMode = (enabled: boolean) => setTamilModeState(enabled);
  const setTamilFontScale = (scale: number) => setTamilFontScaleState(scale);
  const setTamilFontFamily = (font: string) => setTamilFontFamilyState(font);
  const setOsInputMode = (enabled: boolean) => setOsInputModeState(enabled);
  const setOsInputShortcut = (key: string) => setOsInputShortcutState(key);

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
      updateBeat, addBeat, addGroup, updateGroup, removeGroup, loadProject, 
      saveProject, setTamilMode, setTamilFontScale, setTamilFontFamily, 
      learnTamilWord, setOsInputMode, setOsInputShortcut, setScriptConfig, 
      setScriptViewMode, setScratchpadConfig, setStoryboardConfig, 
      setStoryboardFeatureEnabled, setBreakdownLanguage, setBreakdownLockedOnly, 
      setPdfDropEnabled, setRedoEnabled,
      setWritingGoal, setGoogleDriveConfig, connectToDrive, disconnectFromDrive, 
      backupToDrive, setGeminiApiKey, setStabilityApiKey, setBoardLayerOrder,
      undo, redo, canUndo: historyIndexRef.current > 0, canRedo: historyIndexRef.current < historyRef.current.length - 1, captureSnapshot,
      downloadProject: downloadProject // Export function
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
