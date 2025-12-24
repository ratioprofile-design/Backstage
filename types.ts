
export interface Slugline {
  prefix: string;
  location: string;
  time: string;
}

export interface ShotComposition {
  framing?: string; // Centered / Rule of Thirds
  headroom?: string; // Tight / Loose
  lookingRoom?: string; // Open Right / Left
  cameraHeight?: string; // Eye Level / Low
  horizon?: string; // Tilted / Level
  depth?: string; // Fore/Mid/Back layers
}

export interface ShotLighting {
  style?: string; // Low-key / High-key
  keyLight?: string; // Source & Side
  fillRatio?: string; // 1:8, 1:2
  backlight?: string; // Rim light / None
  colorTemp?: string; // 3200K / 5600K
  shadows?: string; // Hard / Soft
  mood?: string; // Keywords
}

export interface ShotArt {
  setDressing?: string;
  props?: string;
  costume?: string;
  palette?: string;
  texture?: string;
  weather?: string;
}

export interface ShotBlocking {
  characterId?: string; // Name
  startPos?: string;
  endPos?: string;
  movement?: string;
  eyeLine?: string;
  gesture?: string;
  emotion?: string;
}

export interface Shot {
  id: string; // Unique ID for keying
  shotSize: string;
  angle: string;
  description: string;
  subject: string;
  imageUrl?: string | null;
  imageHistory?: string[]; // Array of base64 strings for previous iterations
  scene?: string | number;
  
  // Advanced Attributes
  composition?: ShotComposition;
  lighting?: ShotLighting;
  art?: ShotArt;
  blocking?: ShotBlocking;
}

export type BeatStatus = 'not-ready' | 'ready';

export interface BeatVersion {
  id: string;
  timestamp: number;
  title: string;
  summary?: string;
  content: string;
}

export interface Beat {
  id: number;
  x: number;
  y: number;
  title: string; // Beat Name
  sceneNumber?: string; // Manual override for scene number (e.g. "1A")
  summary?: string; // Scene Summary
  slug: Slugline;
  content: string; // HTML content for the script body
  color?: string; // Grouping/Chain color
  tint?: string; // Card background tint
  shots?: Shot[]; // Array of storyboard shots for this scene
  status?: BeatStatus; // Readiness status
  versions?: BeatVersion[]; // History of changes
}

export interface Connection {
  from: number;
  to: number;
}

export interface Annotation {
  id: number;
  type: 'pencil' | 'line' | 'arrow' | 'rect' | 'circle' | 'eraser' | 'text' | 'image';
  color: string;
  d?: string; // path data
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  cx?: number;
  cy?: number;
  rx?: number;
  text?: string; // Content for text annotations
  fontSize?: number;
  imageUrl?: string; // Content for image annotations
}

export interface Group {
  id: number;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface CharacterRelationship {
  target: string; // Name of the other character
  type: string; // e.g. 'Ally', 'Enemy', 'Family'
  description?: string;
}

export interface CharacterData {
  name: string;
  physiology: string;
  sociology: string;
  psychology: string;
  backstory: string; // New Field
  relationships: CharacterRelationship[]; // New Field
  age: number;
  gender: string;
  ethnicity?: string; // Added field
  hair: string;
  eyes: string;
  build: string;
  occupation: string;
  archetype: string;
  images: string[];
  // Optional container for template ideas (Ghost Text)
  templateDefaults?: {
    physiology?: string;
    sociology?: string;
    psychology?: string;
    backstory?: string;
    occupation?: string;
    archetype?: string;
    age?: number;
    gender?: string;
    ethnicity?: string;
    hair?: string;
    eyes?: string;
    build?: string;
  };
}

export interface TextStyleConfig {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  highlightColor: string | null; // Hex code or null
}

export interface ScriptElementConfig {
  marginLeft: number; // percentage
  width: number; // percentage
  marginTop: number; // rem
  marginBottom: number; // rem
  fontSize: number; // px
  fontFamily: string; // Font Family
  textAlign: string; // 'left' | 'center' | 'right' | 'justify'
  lineHeight: number; // multiplier
  letterSpacing: number; // px
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string; // Hex color for text
  highlightColor: string | null; // Background color
  useMusicDecorations?: boolean; // For Lyrics: add ♫ symbols
}

export interface SluglineConfig {
  fontSize: number; // px
  fontFamily: string; // Font Family
  textAlign: string;
  lineHeight: number;
  letterSpacing: number; // px
  paddingVertical: number; // px
  paddingHorizontal: number; // px
  paddingEnabled: boolean; // toggle for box look
  sceneNumberFontSize: number; // px
  marginTop: number; // rem
  marginBottom: number; // rem
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  highlightColor: string | null;
}

export interface BlockBoundsConfig {
  enabled: boolean;
  mode: 'active' | 'all'; // 'active' = only current paragraph, 'all' = x-ray mode
  color: string; // Hex Color
  opacity: number; // 0 to 100
  outlineStyle: 'none' | 'dashed' | 'dotted' | 'solid';
  funMode: 'none' | 'blueprint' | 'cyber' | 'glass';
}

export interface ScriptConfig {
  paperTheme: 'white' | 'dark' | 'sepia' | 'red'; // New global theme setting
  action: ScriptElementConfig;
  character: ScriptElementConfig;
  dialogue: ScriptElementConfig;
  parenthetical: ScriptElementConfig;
  transition: ScriptElementConfig;
  shot: ScriptElementConfig;
  lyrics: ScriptElementConfig;
  slugline: SluglineConfig;
  blockBounds: BlockBoundsConfig; // Global layout visualization settings
}

export interface StoryboardConfig {
  style: string; // e.g. "Charcoal Sketch", "Photorealistic"
  aspectRatio: string; // e.g. "16:9", "4:3"
  imageModel?: string; // Model ID for image generation
  textModel?: string; // Model ID for shot list analysis
}

export interface PrintSettings {
  paperSize: 'letter' | 'a4';
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  showPageNumbers: boolean;
  sceneNumbers: boolean;
  
  // Content Filtering
  selectedLocations: string[]; // Empty = All
  selectedCharacters: string[]; // Empty = All

  // Element Styling (Overrides for Print)
  styles: {
    slugline: TextStyleConfig;
    action: TextStyleConfig;
    character: TextStyleConfig;
    dialogue: TextStyleConfig;
    parenthetical: TextStyleConfig;
    transition: TextStyleConfig;
  };
}

export interface WritingGoal {
  isActive: boolean;
  mode: 'deadline' | 'habit'; // Project Goal vs Daily Habit
  type: 'pages' | 'words';
  
  // Deadline Mode
  targetAmount: number;
  deadline: number; // timestamp
  startDate: number; // timestamp
  
  // Habit Mode
  dailyTarget: number; // e.g. 500 words per session

  // Calculator Props
  includeWeekends: boolean;
  dailyWritingMinutes: number; // e.g. 120 for 2 hours
}

export interface GoogleDriveConfig {
  clientId: string;
  apiKey: string;
  enabled: boolean;
  autoBackup: boolean;
  lastBackup: number | null;
  fileId?: string; // ID of the file on Google Drive if it exists
}

export interface ProjectMetadata {
  id: string;
  name: string;
  lastModified: number;
  created: number;
}

export type ViewMode = 'board' | 'script' | 'characters' | 'storyboard' | 'statistics' | 'backstage' | 'goals';

export type BoardLayer = 'beats' | 'groups' | 'connections' | 'annotations' | 'text';

export interface ProjectState {
  beats: Beat[];
  groups: Group[]; // Visual groupings for beats
  connections: Connection[];
  annotations: Annotation[];
  characterData: Record<string, CharacterData>;
  generatedShots: Shot[]; // Global shot list (optional/legacy use)
  panX: number;
  panY: number;
  scale: number;
  nextId: number;
  nextAnnoId: number;
  // Tamil Features
  isTamilMode: boolean;
  tamilFontScale: number; // Percentage (e.g., 75)
  tamilFontFamily: string; // e.g. 'Vijaya'
  userDictionary: Record<string, string[]>;
  // OS Input Features
  isOsInputMode: boolean;
  osInputShortcut: string; // e.g., 'NumLock', 'F1', 'ScrollLock'
  
  // Script Layout Configuration (Global)
  scriptConfig: ScriptConfig;
  scriptViewMode: 'continuous' | 'page'; // New: Visual mode for Script Editor
  
  // Storyboard Configuration
  storyboardConfig: StoryboardConfig;
  isStoryboardFeatureEnabled: boolean;

  // Writing Goals
  writingGoal: WritingGoal;
  
  // Google Drive
  googleDriveConfig: GoogleDriveConfig;

  // Analytics
  dailyStats: Record<string, number>; // YYYY-MM-DD -> Word Count
  sessionStartCount: number; // Word count at start of today's session
  lastSessionDate: string; // YYYY-MM-DD

  // Board Layers
  boardLayerOrder: BoardLayer[];
}

export interface ProjectContextType extends ProjectState {
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

  // Change Tracking
  hasUnsavedChanges: boolean;

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
  connectToDrive: (apiKey?: string, clientId?: string) => Promise<void>;
  disconnectFromDrive: () => void;
  backupToDrive: (force?: boolean) => Promise<void>;
  isDriveSyncing: boolean;
  isDriveConnecting: boolean; 

  // Board Layers
  setBoardLayerOrder: (order: BoardLayer[]) => void;

  // HISTORY
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  captureSnapshot: () => void;
}
