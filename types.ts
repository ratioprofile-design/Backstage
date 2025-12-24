
export interface Slugline {
  prefix: string;
  location: string;
  time: string;
}

export interface Shot {
  id: string; // Unique ID for keying
  shotSize: string;
  angle: string;
  description: string;
  subject: string;
  imageUrl?: string | null;
  scene?: string | number;
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
  type: 'pencil' | 'line' | 'arrow' | 'rect' | 'circle' | 'eraser' | 'text';
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
  hair: string;
  eyes: string;
  build: string;
  occupation: string;
  archetype: string;
  images: string[];
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
