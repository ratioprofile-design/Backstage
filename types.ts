
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
  isInvited?: boolean;
  invitedBy?: string;
}

export type ViewMode = 'board' | 'excalidraw' | 'script' | 'characters' | 'casting' | 'characterdesign' | 'breakdown' | 'crew' | 'shotlist' | 'storyboard' | 'schedule' | 'statistics' | 'backstage' | 'goals' | 'inbox' | 'continuity' | 'locations' | 'dood' | 'documents' | 'callsheet';

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

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
  value?: string; // e.g., "TN 09 BK 7721" or "2023 Toyota Fortuner" or "Matte Black" or "Front Bumper Dent"
  category?: string; // 'numberplate' | 'modelYear' | 'color' | 'damage' | etc.
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
  subtasks?: TaskSubtask[];
  sourceBreakdownItem?: string;
  sourceCategory?: string;
  details?: Record<string, string>;
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
  navLayout?: 'horizontal' | 'vertical';

  // Board Layers
  boardLayerOrder: BoardLayer[];

  // Writer's Page Lock: prevents crew from editing the Character Design page
  characterDesignLocked?: boolean;
  collaborators?: any[];
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
  grokKey: string | null;
  setGrokKey: (key: string | null) => void;
  
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
  setCollaborators: (collabs: any[]) => void;

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
  navLayout: 'horizontal' | 'vertical';
  setNavLayout: (layout: 'horizontal' | 'vertical') => void;

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

export type BreakdownCategory =
  | 'CAST'
  | 'EXTRAS'
  | 'STUNTS'
  | 'VEHICLES'
  | 'PROPS'
  | 'SFX'
  | 'WARDROBE'
  | 'MAKEUP'
  | 'ANIMALS'
  | 'SOUND'
  | 'SET_DRESSING'
  | 'GREENERY'
  | 'SPECIAL_EQUIPMENT'
  | 'LIGHTING_GRIP'
  | 'SAFETY';

export interface CategoryMeta {
  key: BreakdownCategory;
  nameEn: string;
  nameTa: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconName: string;
}

export const CATEGORY_REGISTRY: Record<BreakdownCategory, CategoryMeta> = {
  CAST: {
    key: 'CAST',
    nameEn: 'Cast / Speaking',
    nameTa: 'நடிகர்கள்',
    color: '#f87171',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    iconName: 'UserCheck',
  },
  EXTRAS: {
    key: 'EXTRAS',
    nameEn: 'Extras / Atmosphere',
    nameTa: 'துணை நடிகர்கள் / கூட்டம்',
    color: '#fde047',
    bgColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: '#eab308',
    iconName: 'Users',
  },
  STUNTS: {
    key: 'STUNTS',
    nameEn: 'Stunts & Action',
    nameTa: 'சண்டைப் பயிற்சி / ஆக்ஷன்',
    color: '#fb923c',
    bgColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: '#f97316',
    iconName: 'Flame',
  },
  VEHICLES: {
    key: 'VEHICLES',
    nameEn: 'Vehicles / Picture Cars',
    nameTa: 'வாகனங்கள் / கார்கள்',
    color: '#f472b6',
    bgColor: 'rgba(236, 72, 153, 0.15)',
    borderColor: '#ec4899',
    iconName: 'Car',
  },
  PROPS: {
    key: 'PROPS',
    nameEn: 'Props / Hand Props',
    nameTa: 'பொருட்கள் (Props)',
    color: '#c084fc',
    bgColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: '#a855f7',
    iconName: 'Package',
  },
  SFX: {
    key: 'SFX',
    nameEn: 'Special Effects (SFX)',
    nameTa: 'சிறப்பு விளைவுகள் (SFX)',
    color: '#60a5fa',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3b82f6',
    iconName: 'Sparkles',
  },
  WARDROBE: {
    key: 'WARDROBE',
    nameEn: 'Costumes / Wardrobe',
    nameTa: 'உடைகள் / ஆடை வடிவமைப்பு',
    color: '#fbbf24',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
    iconName: 'Shirt',
  },
  MAKEUP: {
    key: 'MAKEUP',
    nameEn: 'Makeup & Hair / Prosthetics',
    nameTa: 'ஒப்பனை & சிகை அலங்காரம்',
    color: '#d97706',
    bgColor: 'rgba(217, 119, 6, 0.15)',
    borderColor: '#d97706',
    iconName: 'Palette',
  },
  ANIMALS: {
    key: 'ANIMALS',
    nameEn: 'Animals & Handlers',
    nameTa: 'விலங்குகள் & கையாளுபவர்கள்',
    color: '#a3e635',
    bgColor: 'rgba(132, 204, 22, 0.15)',
    borderColor: '#84cc16',
    iconName: 'Cat',
  },
  SOUND: {
    key: 'SOUND',
    nameEn: 'Sound & Music Playback',
    nameTa: 'ஒலி & இசை குறிப்புகள்',
    color: '#2dd4bf',
    bgColor: 'rgba(20, 184, 166, 0.15)',
    borderColor: '#14b8a6',
    iconName: 'Volume2',
  },
  SET_DRESSING: {
    key: 'SET_DRESSING',
    nameEn: 'Set Dressing',
    nameTa: 'அரங்கு அலங்காரம் (Set Dressing)',
    color: '#e879f9',
    bgColor: 'rgba(217, 70, 239, 0.15)',
    borderColor: '#d946ef',
    iconName: 'Home',
  },
  GREENERY: {
    key: 'GREENERY',
    nameEn: 'Greenery & Plants',
    nameTa: 'தாவரங்கள் & பசுமை',
    color: '#4ade80',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22c55e',
    iconName: 'TreePine',
  },
  SPECIAL_EQUIPMENT: {
    key: 'SPECIAL_EQUIPMENT',
    nameEn: 'Camera & Special Rigs',
    nameTa: 'கேமரா & சிறப்பு கருவிகள் (Gimbal/Crane)',
    color: '#38bdf8',
    bgColor: 'rgba(14, 165, 233, 0.15)',
    borderColor: '#0ea5e9',
    iconName: 'Camera',
  },
  LIGHTING_GRIP: {
    key: 'LIGHTING_GRIP',
    nameEn: 'Lighting & Grip',
    nameTa: 'விளக்குகள் & கிரிப் (Lighting)',
    color: '#facc15',
    bgColor: 'rgba(250, 204, 21, 0.15)',
    borderColor: '#facc15',
    iconName: 'Zap',
  },
  SAFETY: {
    key: 'SAFETY',
    nameEn: 'Safety, Permits & Hazards',
    nameTa: 'பாதுகாப்பு & அனுமதி நெறிகள்',
    color: '#f43f5e',
    bgColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: '#f43f5e',
    iconName: 'AlertTriangle',
  },
};

export interface BreakdownItem {
  id?: string;
  category?: BreakdownCategory;
  name: string;
  nameTa?: string;
  description?: string;
  descriptionTa?: string;
  count?: number;
  isCustom?: boolean;
  source?: string; // The exact text in the script this was derived from
  departmentId?: string; // Target department ID e.g. 'transportation', 'props', 'costume'
  subtasks?: TaskSubtask[]; // Subtasks associated with this item
  details?: Record<string, string>; // Key-value details (e.g. numberplate, modelYear, color, damage)
  continuityDept?: 'costume' | 'makeup' | 'vehicle' | 'props'; // Target continuity category
}

export interface BreakdownData {
  sound?: (string | BreakdownItem)[];
  props?: (string | BreakdownItem)[];
  costume?: (string | BreakdownItem)[];
  vfx?: (string | BreakdownItem)[];
  practical?: (string | BreakdownItem)[]; // Physical effects (Smoke, Squibs, Stunts)
  cast?: (string | BreakdownItem)[]; // Extras/Non-speaking
  location?: (string | BreakdownItem)[]; // Location notes/Optimal Scenario
  // 15 Standard Production Categories
  CAST?: (string | BreakdownItem)[];
  EXTRAS?: (string | BreakdownItem)[];
  STUNTS?: (string | BreakdownItem)[];
  VEHICLES?: (string | BreakdownItem)[];
  PROPS?: (string | BreakdownItem)[];
  SFX?: (string | BreakdownItem)[];
  WARDROBE?: (string | BreakdownItem)[];
  MAKEUP?: (string | BreakdownItem)[];
  ANIMALS?: (string | BreakdownItem)[];
  SOUND?: (string | BreakdownItem)[];
  SET_DRESSING?: (string | BreakdownItem)[];
  GREENERY?: (string | BreakdownItem)[];
  SPECIAL_EQUIPMENT?: (string | BreakdownItem)[];
  LIGHTING_GRIP?: (string | BreakdownItem)[];
  SAFETY?: (string | BreakdownItem)[];
  // Dynamic list of items
  items?: BreakdownItem[];
}

export type BeatStatus = 'not-ready' | 'ready' | 'idea' | 'outline' | 'draft' | 'revision' | 'polish' | 'locked';

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

export interface TimelineTrack {
  id: string;
  label: string;
  type: 'main' | 'subplot' | 'parallel' | 'broll' | 'audio' | 'theme' | string;
  color: string;
  isLocked?: boolean;
  isMuted?: boolean;
  isSolo?: boolean;
  volume?: number;
  height?: number;
  subtrackCount?: number; // 0, 1, or 2 manually created subtracks (max 2)
  subtrackHeights?: { [subtrackIdx: number]: number };
  isExpanded?: boolean;
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
  breakdownData?: BreakdownData; // Alias for pre-production breakdown tags
  status?: BeatStatus; // Readiness status
  versions?: BeatVersion[]; // History of changes
  boardId?: number; // Target Board Page
  w?: number; // Board card width (custom resized)
  h?: number; // Board card height (custom resized)
  trackIndex?: number; // NLE Timeline Track index (0 = V1, 1 = V2, 2 = V3, etc.)
  subtrackIndex?: number; // Subtrack index (0 = Subtrack 1, 1 = Subtrack 2, 2 = Subtrack 3)
  durationWidth?: number; // Visual duration width on timeline (px)
  tension?: number; // Dramatic tension level 0-100%
  characters?: string[]; // Characters featured in this beat
  startTime?: number; // Timeline start position in minutes or beats
  groupId?: number; // Visual or sequence group association
  groupTitle?: string; // Group / Sequence name
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

// --- CINE INTEGRATION TYPES ---
export type RevisionColor = 'WHITE' | 'BLUE' | 'PINK' | 'YELLOW' | 'GREEN' | 'GOLDENROD';

export interface ScriptVersion {
  id: string;
  versionNumber: number;
  versionName: string;
  versionNameTa?: string;
  revisionColor: RevisionColor;
  status: 'DRAFT' | 'REVISED' | 'LOCKED' | 'SHOOTING';
  author: string;
  createdAt: string;
  scriptContent: string;
  sceneCount: number;
  pageCountEighths: number;
  scenes?: any[];
}

export interface DiffResult {
  sceneId: string;
  sceneNumber: string;
  status: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
  titleA?: string;
  titleB?: string;
  textA?: string;
  textB?: string;
  addedItems: any[];
  removedItems: any[];
  pageShiftEighths: number;
}

export type AnnotationType = 'highlight' | 'pen' | 'text' | 'rect' | 'note' | 'comment';

export interface CommentReply {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface DocumentAnnotation {
  id: string;
  documentId: string;
  pageNumber: number;
  type: AnnotationType;
  color: string;
  strokeWidth?: number;
  opacity?: number;
  points?: Array<{ x: number; y: number }>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  author?: string;
  createdAt: string;
  selectedText?: string;
  status?: 'open' | 'resolved';
  replies?: CommentReply[];
}

export type DocumentFormat = 'pdf' | 'docx' | 'image' | 'sheet' | 'text' | 'breakdown' | 'callsheet' | 'lookbook' | 'script' | 'safety' | 'permit' | 'contract' | 'other';

export interface ProductionDocument {
  id: string;
  projectId?: string;
  title: string;
  titleTa?: string;
  category: 'SCRIPT' | 'LOOKBOOK' | 'CALLSHEET' | 'BREAKDOWN' | 'SCHEDULE' | 'STORYBOARD' | 'PERMIT' | 'SAFETY' | 'CONTRACT' | 'OTHER';
  fileName: string;
  fileSize?: string;
  fileType?: DocumentFormat;
  pageCount: number;
  uploadedAt: string;
  pdfDataUrl?: string;
  imageDataUrl?: string;
  htmlContent?: string;
  textContent?: string;
  sheetData?: any[][];
  builtInType?: 'lookbook' | 'callsheet' | 'safety' | 'permit' | 'contract' | 'script' | 'breakdown' | 'schedule' | 'storyboard' | 'excalidraw';
  annotations: DocumentAnnotation[];
  author?: string;
}

export interface CastCallItem {
  id: string;
  castNumber: number;
  characterName: string;
  characterNameTa?: string;
  actorName: string;
  status?: 'SW' | 'W' | 'H' | 'WF' | 'SWF';
  pickupTime: string;
  makeupTime: string;
  onSetTime: string;
  notes?: string;
}

export interface ExtrasCallItem {
  id: string;
  groupName: string;
  count: number;
  callTime: string;
  wardrobeNotes?: string;
}

export interface CallSheet {
  id: string;
  productionTitle: string;
  shootDay: number;
  totalShootDays: number;
  date: string;
  callTime: string;
  breakfastTime?: string;
  estimatedWrap?: string;
  director: string;
  producer: string;
  firstAd: string;
  cinematographer: string;
  productionDesigner?: string;
  stuntCoordinator?: string;
  soundMixer?: string;
  generalCrewCall: string;
  weather: string;
  sunriseSunset: string;
  hospitalName: string;
  hospitalAddress: string;
  hospitalEmergencyPhone: string;
  locationName: string;
  locationAddress: string;
  parkingInstructions: string;
  scheduledScenes: string[];
  castCalls: CastCallItem[];
  extrasCalls?: ExtrasCallItem[];
  stuntSfxNotes?: string;
  cameraNotes?: string;
  cateringNotes?: string;
  tomorrowPreview?: string;
  advancedScheduleNotes: string;
}

