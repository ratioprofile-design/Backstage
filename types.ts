
export interface ScratchpadConfig {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  blockSpacing: number; // Spacing between blocks (margin-bottom)
  enableDragAnimations: boolean;
  dragScale: number; // 1.0 to 1.2
  dragOpacity: number; // 0.1 to 1.0
  glassEffect: boolean;
  enableMarkdown: boolean;
  
  // Markdown Styling
  h1Color: string;
  h2Color: string;
  h1Underline: boolean;
  h2Underline: boolean;
  h1Italic: boolean;
  h2Italic: boolean;
  
  // New Sizing & Style
  h1FontSize: number; // px
  h2FontSize: number; // px
  boldColor: string;
  italicColor: string;
  
  // Bullets & Lists
  listMarkerColor: string; 
  listMarkerSize: number; // Percentage (e.g. 100)
  listMarkerTopOffset: number; // Px (e.g. 0)
  bulletStyle: 'dot' | 'circle' | 'square' | 'dash' | 'arrow';

  // Checkboxes
  checkboxSize: number; // px (e.g. 12)
  checkboxTopOffset: number; // px (e.g. 0)

  calloutBackground: string;
  calloutBorder: string;
  todoBorder: string;
  todoCheckColor: string;
}

export interface StoryboardConfig {
  provider: 'google' | 'stability'; // New provider toggle
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

export interface ProjectMetadata {
  id: string;
  name: string;
  lastModified: number;
  created: number;
}

export type ViewMode = 'board' | 'script' | 'characters' | 'breakdown' | 'storyboard' | 'statistics' | 'backstage' | 'goals';

export type BoardLayer = 'beats' | 'groups' | 'connections' | 'annotations' | 'text';

export interface ProjectState {
  beats: Beat[];
  groups: Group[]; // Visual groupings for beats
  connections: Connection[];
  annotations: Annotation[];
  characterData: Record<string, CharacterData>;
  generatedShots: Shot[]; // Global shot list (optional/legacy use)
  
  scratchpad: string; // Legacy: Global scratchpad content
  globalNotes: Note[]; // New: Global sticky notes

  panX: number;
  panY: number;
  scale: number;
  nextId: number;
  nextAnnoId: number;

  activeBoardId: number; // Multi-board support

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
  
  // Scratchpad Configuration
  scratchpadConfig: ScratchpadConfig;

  // Storyboard Configuration
  storyboardConfig: StoryboardConfig;
  isStoryboardFeatureEnabled: boolean;
  
  // Breakdown Configuration
  breakdownLanguage: 'english' | 'tamil';
  breakdownLockedOnly: boolean; // New: Limit analysis to locked scenes

  // Feature Flags
  isPdfDropEnabled: boolean; // New Flag
  isRedoEnabled: boolean; // New Flag

  // Writing Goals
  writingGoal: WritingGoal;
  
  // AI Keys
  geminiApiKey: string;
  stabilityApiKey: string;

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

  setActiveBoardId: (id: number) => void;

  // State Setters (Operate on the currently loaded project)
  setBeats: (beats: Beat[] | ((prev: Beat[]) => Beat[])) => void;
  setGroups: (groups: Group[] | ((prev: Group[]) => Group[])) => void;
  setConnections: (conns: Connection[] | ((prev: Connection[]) => Connection[])) => void;
  setAnnotations: (annos: Annotation[] | ((prev: Annotation[]) => Annotation[])) => void;
  setCharacterData: (data: Record<string, CharacterData> | ((prev: Record<string, CharacterData>) => Record<string, CharacterData>)) => void;
  setGeneratedShots: (shots: Shot[] | ((prev: Shot[]) => Shot[])) => void;
  
  // Scratchpad
  setScratchpad: (content: string) => void;
  setGlobalNotes: (notes: Note[]) => void;

  // Shot Management Helpers
  updateGeneratedShot: (id: string, updates: Partial<Shot>) => void;
  addGeneratedShot: (index: number) => void;
  removeGeneratedShot: (id: string) => void;
  moveGeneratedShot: (fromIndex: number, toIndex: number) => void;
  
  setPan: (x: number, y: number) => void;
  setScale: (s: number) => void;
  updateBeat: (id: number, updates: Partial<Beat>) => void;
  addBeat: (x: number, y: number) => number; // Returns new ID
  reorderBeats: (draggedId: number, targetId: number, side: 'top' | 'bottom') => void;

  // Group Management
  addGroup: (group: Omit<Group, 'id'>) => void;
  updateGroup: (id: number, updates: Partial<Group>) => void;
  removeGroup: (id: number) => void;

  loadProject: (data: ProjectState) => void;
  saveProject: () => void;
  downloadProject: () => void;
  
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
  
  // Scratchpad Configuration
  setScratchpadConfig: (config: ScratchpadConfig) => void;

  // Storyboard Configuration
  setStoryboardConfig: (config: StoryboardConfig) => void;
  setStoryboardFeatureEnabled: (enabled: boolean) => void;
  
  // Breakdown Configuration
  setBreakdownLanguage: (lang: 'english' | 'tamil') => void;
  setBreakdownLockedOnly: (enabled: boolean) => void;

  // Features
  setPdfDropEnabled: (enabled: boolean) => void;
  setRedoEnabled: (enabled: boolean) => void;
  
  // Goals
  setWritingGoal: (goal: WritingGoal) => void;

  // AI Keys
  setGeminiApiKey: (key: string) => void;
  setStabilityApiKey: (key: string) => void;

  // Board Layers
  setBoardLayerOrder: (order: BoardLayer[]) => void;

  // HISTORY
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  captureSnapshot: () => void;
}

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

export interface BreakdownItem {
  name: string;
  source?: string; // The exact text in the script this was derived from
}

export interface BreakdownData {
  sound: (string | BreakdownItem)[];
  props: (string | BreakdownItem)[];
  costume: (string | BreakdownItem)[];
  vfx: (string | BreakdownItem)[];
  practical: (string | BreakdownItem)[]; // Physical effects (Smoke, Squibs, Stunts)
  cast: (string | BreakdownItem)[]; // Extras/Non-speaking
  location: (string | BreakdownItem)[]; // Location notes/Optimal Scenario
}

export type BeatStatus = 'not-ready' | 'ready';

export interface BeatVersion {
  id: string;
  timestamp: number;
  title: string;
  summary?: string;
  content: string;
}

export interface Note {
  id: string;
  content: string; // HTML Content
  color: string; // Hex color for sticky note background
  timestamp: number;
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
  scratchpad?: string; // Legacy: Single scratchpad string
  notes?: Note[]; // New: Array of sticky notes
  color?: string; // Grouping/Chain color
  tint?: string; // Card background tint
  shots?: Shot[]; // Array of storyboard shots for this scene
  breakdown?: BreakdownData; // Pre-production breakdown tags
  status?: BeatStatus; // Readiness status
  versions?: BeatVersion[]; // History of changes
  boardId?: number; // Target Board Page
}

export interface Connection {
  from: number;
  to: number;
  boardId?: number;
}

export interface Annotation {
  id: number;
  type: 'pencil' | 'line' | 'arrow' | 'rect' | 'circle' | 'eraser' | 'text' | 'image' | 'audio';
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
  audioUrl?: string; // Content for audio annotations
  boardId?: number;
}

export interface Group {
  id: number;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  boardId?: number;
}

export interface RelationshipEdge {
  targetId: string; // Target Character ID
  targetName: string; // Cached Name
  type: string; // e.g. 'Sibling', 'Rival'
  powerDynamic: number; // -100 (Dominated by) to 100 (Dominates)
  emotion: string; // e.g. 'Guilt', 'Envy'
  notes?: string;
}

export interface CharacterArc {
  startState: string;
  incitingShift: string;
  midpointChange: string;
  lowestPoint: string;
  finalState: string;
}

export interface CharacterData {
  id: string;
  name: string;
  aliases: string[];
  
  // 1. Identity (Hard Anchors)
  role: 'Protagonist' | 'Antagonist' | 'Ally' | 'Foil' | 'Mentor' | 'Extra' | 'Unknown';
  narrativeFunction: string; // "Moral compass", "Chaos agent"
  firstAppearance?: string; // Scene Number or "Ep 1"
  lastAppearance?: string;
  screenTimeWeight: number; // 0-100

  // 2. Psychological Core
  coreDesire: string;
  coreFear: string;
  internalLie: string;
  truth: string; // Realization
  moralAlignment: number; // 0 (Selfish) - 100 (Selfless)
  temperament: string; // 'Calm', 'Volatile', 'Cold'

  // 3. Backstory
  definingEvent: string;
  emotionalScar: string;
  unresolvedRelationship: string;
  socioEconomicOrigin: string;

  // 4. External Characterization
  age: string; // String to allow ranges "30s"
  physicalTraits: string[]; // "Limp", "Scar", "Tall"
  costumeStyle: string;
  colorPalette: string[];
  movementStyle: string;
  signatureProp: string;
  images: string[];

  // 5. Behavioral Patterns
  defaultReaction: string; // Under pressure
  conflictStyle: string; // 'Avoid', 'Attack', 'Manipulate'
  decisionSpeed: 'Impulsive' | 'Deliberate' | 'Frozen' | 'Unknown';
  powerStrategy: string; // 'Intimidation', 'Charm'

  // 6. Dialogue & Voice
  speechRhythm: string;
  vocabularyLevel: string; // 'Street', 'Poetic'
  silenceTendency: 'Talkative' | 'Guarded' | 'Silent' | 'Unknown';
  verbalWeapon: string; // 'Sarcasm', 'Logic'
  catchphrase: string;

  // 7. Relationships (Matrix)
  relationships: RelationshipEdge[];

  // 8. Arc
  arc: CharacterArc;

  // Legacy Fields (For compatibility)
  physiology?: string;
  sociology?: string;
  psychology?: string;
  backstory?: string;
  occupation?: string;
  gender?: string;
  archetype?: string;
  hair?: string;
  eyes?: string;
  build?: string;
  templateDefaults?: any;
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
  noteFont: string; // Font family for scratchpad notes
  noteFontSize: number; // Font size for scratchpad notes
}
