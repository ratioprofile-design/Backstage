
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

export type ViewMode = 'board' | 'script' | 'characters' | 'casting' | 'characterdesign' | 'breakdown' | 'crew' | 'shotlist' | 'storyboard' | 'schedule' | 'statistics' | 'backstage' | 'goals' | 'inbox' | 'continuity' | 'locations';

export interface ContinuityItem {
  id: string;
  sceneId: string;
  sceneNumber: string;
  sceneTitle: string;
  shootingDay?: string;
  category: 'costume' | 'makeup' | 'prop' | 'art_set' | 'sfx' | 'hair';
  characterId?: string;
  characterName?: string;
  actorName?: string;
  characterAvatar?: string;
  itemTitle: string;
  description: string;
  damageLevel?: 'None' | 'Minor' | 'Moderate' | 'Severe' | 'Destroyed';
  bloodLevel?: 'None' | 'Light Drops' | 'Active Bleeding' | 'Dried Blood' | 'Heavy Coverage';
  handOrientation?: 'Left Hand' | 'Right Hand' | 'Both Hands' | 'N/A';
  fillPercent?: number;
  timecodeOrShot?: string;
  photoUrl?: string;
  referencePhotos?: string[];
  status: 'Verified' | 'Pending Review' | 'Mismatched Warning' | 'Approved';
  supervisorNotes?: string;
  updatedAt: string;
  isCustom?: boolean;
}

export interface TaskModificationHistory {
  id: string;
  timestamp: string;
  author: string;
  authorRole?: string;
  avatarUrl?: string;
  changeType: 'created' | 'status_change' | 'priority_change' | 'assignment' | 'comment' | 'edited';
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  comment?: string;
}

export interface AppTask {
  id: string;
  title: string;
  departmentId: string;
  departmentName?: string;
  owner: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  deadline: string;
  status: 'To Do' | 'In Progress' | 'Review' | 'Completed';
  relatedScene?: string;
  targetView?: ViewMode;
  notes?: string;
  history: TaskModificationHistory[];
  isRead?: boolean;
}

export type BoardLayer = 'beats' | 'groups' | 'connections' | 'annotations' | 'text';

export interface ArtistOption {
  id: string;
  name: string;
  rank: number; // 1 = Option 1, 2 = Option 2, etc.
  status: 'idea' | 'in_talks' | 'audition_requested' | 'self_tape_received' | 'callback' | 'chemistry_read' | 'offer_sent' | 'contract_signed' | 'on_board' | 'passed' | 'hold';
  photoUrl?: string;
  photos?: string[];
  imdbUrl?: string;
  auditionDate?: string;
  callbackDate?: string;
  availability?: {
    from?: string;
    to?: string;
    availableFrom?: string; // YYYY-MM-DD
    availableTo?: string;   // YYYY-MM-DD
    blackoutNotes?: string;
    isConfirmedAvailable?: boolean;
    isConfirmed?: boolean;
  };
  contact?: {
    agency?: string;
    agentName?: string;
    agentPhone?: string;
    agentEmail?: string;
    email?: string;
    phone?: string;
    managerName?: string;
    managerPhone?: string;
  };
  dealTerms?: {
    feeQuote?: string;
    feeType?: 'weekly' | 'flat' | 'daily';
    sagTier?: string;
    billingGuarantee?: string;
    travelPerDiem?: string;
    riderNotes?: string;
  };
  feeQuote?: string; // legacy support
  auditionUrl?: string; // legacy support
  rating?: number; // 1 to 5 star rating
  notes?: string;
  offerDate?: string;
}

// Fix: Defined the missing CharacterData interface to resolve errors in multiple files.
export interface CharacterData {
  id: string;
  name: string;
  age: number;
  gender: string;
  ethnicity: string;
  hair: string;
  eyes: string;
  build: string;
  occupation: string;
  archetype: string;
  physiology: string;
  sociology: string;
  psychology: string;
  backstory: string;
  images: string[];
  aiImages?: string[];
  relationships: { target: string; type: string; description: string }[];
  aliases?: string[];
  isImplicit?: boolean;
  templateDefaults?: any;
  artists?: ArtistOption[];
  confirmedArtistId?: string;
  billingTier?: 'lead' | 'supporting' | 'day_player' | 'extra' | 'voiceover' | 'stunt';
  playingAge?: string;
  height?: string;
  accent?: string;
  specialSkills?: string;
  wardrobeNotes?: string;
  billingNumber?: number;
}

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
  openrouterKey: string;
  generalAiModel: string;

  // Analytics
  dailyStats: Record<string, number>; // YYYY-MM-DD -> Word Count
  sessionStartCount: number; // Word count at start of today's session
  lastSessionDate: string; // YYYY-MM-DD

  // App Customization
  appTheme?: 'dark' | 'light' | 'system';
  appAccentColor?: string;
  appLanguage?: 'english' | 'tamil' | 'spanish' | 'french' | 'german' | 'hindi';

  // Board Layers
  boardLayerOrder: BoardLayer[];

  // Writer's Page Lock: prevents crew from editing the Character Design page
  characterDesignLocked?: boolean;
}

export interface ProjectContextType extends ProjectState {
  // Auth & Project Management
  currentUser: string | null;
  currentProjectId: string | null;
  projectList: ProjectMetadata[];
  schemaError: string | null;
  isCloudMode: boolean;
  supabaseUser: any;
  isSaving: boolean;
  isInitialLoading: boolean;
  cloudOffline: boolean;
  userRole: ('writer' | 'director' | 'producer' | 'ad' | 'cinematographer')[] | null;
  updateUserRole: (roles: ('writer' | 'director' | 'producer' | 'ad' | 'cinematographer')[]) => Promise<void>;
  
  // File System Handles (Final Draft Mode)
  fileHandle: any | null; 
  filePath: string | null;
  setFilePath: (path: string | null) => void;
  
  login: (username: string) => void;
  logout: () => void;
  selectProject: (id: string, opts?: { silent?: boolean }) => void;
  createProject: (name: string) => void;
  deleteProject: (id: string) => void;
  closeProject: () => void;
  clearSchemaError: () => void;

  // Change Tracking
  hasUnsavedChanges: boolean;

  setActiveBoardId: (id: number) => void;

  // State Setters (Operate on the currently loaded project)
  setBeats: (beats: Beat[] | ((prev: Beat[]) => Beat[])) => void;
  setGroups: (groups: Group[] | ((prev: Group[]) => Group[])) => void;
  setConnections: (conns: Connection[] | ((prev: Connection[]) => Connection[])) => void;
  setAnnotations: (annos: Annotation[] | ((prev: Annotation[]) => Annotation[])) => void;
  setCharacterData: (data: Record<string, CharacterData> | ((prev: Record<string, CharacterData>) => Record<string, CharacterData>)) => void;
  
  // Scratchpad
  setScratchpad: (content: string) => void;
  setGlobalNotes: (notes: Note[]) => void;

  // Shot Management Helpers
  setGeneratedShots: (shots: Shot[] | ((prev: Shot[]) => Shot[])) => void;
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
  saveProjectAs: () => Promise<void>;
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
  
  // App Customization Setters
  setAppTheme: (theme: 'dark' | 'light' | 'system') => void;
  setAppAccentColor: (color: string) => void;
  setAppLanguage: (lang: 'english' | 'tamil' | 'spanish' | 'french' | 'german' | 'hindi') => void;

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
  setOpenrouterKey: (key: string) => void;
  setGeneralAiModel: (model: string) => void;

  // Board Layers
  setBoardLayerOrder: (order: BoardLayer[]) => void;
  setCharacterDesignLocked: (locked: boolean) => void;

  // ID Management
  setNextId: (val: number | ((prev: number) => number)) => void;

  // HISTORY
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  captureSnapshot: () => void;

  // Auto Scenes Generator
  autoGenerate5Scenes: () => void;
  autoGenerateScenes: (count: 5 | 20 | 50) => void;
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

export interface LanguageConfig {
  action: string;
  character: string;
  dialogue: string;
  parenthetical: string;
  transition: string;
  shot: string;
  lyrics: string;
  slugline: string;
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
  languageConfig: LanguageConfig; // Mapping elements to languages
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

  // Shot Division & Attention Tracking
  sourceType?: 'manual' | 'ai-batch' | 'ai-modified';
  lens?: string;
  movement?: string;
  durationSec?: number;
  equipment?: string;
  scriptReference?: string;
  notes?: string;
  reasoning?: string;
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
  w?: number; // Board card width (custom resized)
  h?: number; // Board card height (custom resized)
}

export type ConnectionStyle = 'curve' | 'zigzag';

export interface Connection {
  from: number;
  to: number;
  style?: ConnectionStyle;
  color?: string;
  label?: string;
  boardId?: number;
}

export interface Annotation {
  id: number;
  type: 'pencil' | 'line' | 'arrow' | 'rect' | 'circle' | 'eraser' | 'text' | 'image' | 'audio' | 'bigtext';
  color: string;
  points?: any;
  strokeWidth?: number;
  strokeStyle?: string;
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
  rotation?: number; // Annotation rotation in degrees (drawings)
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

export interface AmenityHotel {
  id: string;
  name: string;
  distance: string;
  address: string;
  phone?: string;
  rating?: number;
  roomsAvailable?: number;
  coordinates?: { lat: number; lng: number };
}

export interface AmenityHospital {
  id: string;
  name: string;
  distance: string;
  address: string;
  phone: string;
  emergencyType: 'Medical' | 'Trauma' | 'ICU Specialist' | 'General';
  coordinates?: { lat: number; lng: number };
}

export interface AmenityToilet {
  id: string;
  name: string;
  distance: string;
  type: 'Vanity Trailer Restroom' | 'Permanent Facility' | 'Mobile Bio-Toilet';
  cleanlinessScore?: string;
  description: string;
}

export interface AmenityChangingDress {
  id: string;
  name: string;
  distance: string;
  type: 'AC Vanity Bus Park' | 'Green Room Suite' | 'Wardrobe Tent';
  capacity: string;
  mirrorsAndSteamers: boolean;
}

export interface AmenityPowerSupply {
  id: string;
  name: string;
  distance: string;
  type: '200kW Silent Diesel Generator' | '3-Phase Grid Connection' | 'Heavy Duty Transformer';
  capacity: string;
  contactPhone?: string;
}

export interface AmenityEmergency {
  id: string;
  name: string;
  type: 'Fire Station' | 'Medical Response & Ambulance' | 'Police Patrol Post' | 'Disaster Control';
  distance: string;
  phone: string;
  address: string;
}

export interface SceneRequirement {
  sceneNumber: string;
  slugline: string;
  timeOfDay: string;
  pageCount?: string;
  synopsis: string;
  actors: { character: string; actorName: string; role: string; notes?: string }[];
  bigSetsAndProps: string[];
  vehicles: string[];
  makeupAndCostumes: string[];
  stuntsAndSfx: string[];
  specialEquipment?: string[];
}

export interface LocationMapping {
  id: string;
  scriptLocation: string; // e.g. "OOTY - PINE FORESTS & LAKES"
  sceneNumbers: string[]; // e.g. ["SCENE 1", "SCENE 4"]
  realLocationName: string; // e.g. "Pine Forest Reserve, Ooty, Tamil Nadu"
  address: string;
  googleMapsUrl?: string;
  coordinates: { lat: number; lng: number };
  status: 'scouted' | 'confirmed' | 'pending_permit' | 'recce_needed';
  contactPerson: string;
  contactPhone: string;
  permitStatus: 'Approved' | 'Pending' | 'Not Required' | 'In Process';
  dailyRate?: string;
  notes?: string;
  
  // Assigned Scenes & Requirements
  assignedScenes: SceneRequirement[];
  
  // Nearby Required Amenities (Logistics Infrastructure)
  nearbyHotels: AmenityHotel[];
  nearbyHospitals: AmenityHospital[];
  nearbyToilets: AmenityToilet[];
  nearbyChangingDress: AmenityChangingDress[];
  nearbyPowerSupply: AmenityPowerSupply[];
  closestEmergency: AmenityEmergency[];
}

