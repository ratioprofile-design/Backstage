
import { ProjectState, CharacterData } from './types';

export const STORYLINE_COLORS = [
  '#e67e22', '#3498db', '#9b59b6', '#2ecc71', '#e74c3c', 
  '#1abc9c', '#f1c40f', '#e84393', '#d35400', '#8e44ad'
];

export const SHOT_SIZES = [
  'EXTREME WIDE (EWS)',
  'WIDE (WS)',
  'FULL SHOT (FS)',
  'MEDIUM WIDE (MWS)',
  'COWBOY SHOT',
  'MEDIUM (MS)',
  'MEDIUM CLOSE-UP (MCU)',
  'CLOSE-UP (CU)',
  'EXTREME CLOSE-UP (ECU)',
  'INSERT'
];

export const SHOT_ANGLES = [
  'EYE LEVEL',
  'LOW ANGLE',
  'HIGH ANGLE',
  'BIRD\'S EYE / OVERHEAD',
  'WORM\'S EYE',
  'DUTCH ANGLE',
  'OVER THE SHOULDER (OTS)',
  'POINT OF VIEW (POV)',
  'PROFILE'
];

// --- STORYBOARD ADVANCED OPTIONS ---

export const SB_FRAMING = ['Centered', 'Rule of Thirds', 'Golden Spiral', 'Quadrants', 'Symmetry', 'Frame within Frame'];
export const SB_HEADROOM = ['Standard', 'Tight', 'Extreme Headroom (Negative Space)', 'Cut-off'];
export const SB_LOOKING = ['Open Right', 'Open Left', 'Short Sighted', 'Center Locked'];
export const SB_CAM_HEIGHT = ['Eye Level', 'Waist Level', 'Knee Level', 'Ground Level', 'Overhead'];
export const SB_HORIZON = ['Level', 'Slight Tilt', 'Extreme Dutch Tilt'];
export const SB_DEPTH = ['Flat', 'Deep Focus', 'Shallow Focus (Bokeh)', 'Layered (Fore/Mid/Back)'];

export const SB_LIGHTING_STYLE = ['Natural', 'High-Key', 'Low-Key', 'Chiaroscuro', 'Silhouette', 'Rembrandt', 'Neon / Practical'];
export const SB_KEY_LIGHT = ['Soft Left', 'Soft Right', 'Hard Left', 'Hard Right', 'Top Down', 'Under Lighting'];
export const SB_FILL_RATIO = ['1:1 (Flat)', '1:2 (Standard)', '1:8 (Dramatic)', '1:32 (Silhouette)'];
export const SB_BACKLIGHT = ['None', 'Rim Light (Separation)', 'Halo', 'Lens Flare'];
export const SB_COLOR_TEMP = ['Warm (3200K)', 'Neutral (5600K)', 'Cool/Blue (7000K)', 'Mixed'];
export const SB_SHADOWS = ['Soft/Diffused', 'Hard/Sharp', 'Long', 'No Shadows'];

export const SB_MOVEMENT = ['Static', 'Walks Forward', 'Walks Away', 'Runs', 'Turns Head', 'Falls', 'Stands Up', 'Sits Down'];
export const SB_EYELINE = ['Direct to Camera', 'Just Off Camera', 'Looking Up', 'Looking Down', 'Looking Left', 'Looking Right'];

// ------------------------------------

export const CHARACTER_GENDERS = ['Male', 'Female', 'Non-Binary', 'Transgender', 'Agender', 'Genderfluid', 'Unknown', 'Android', 'Cyborg', 'Ethereal', 'Beast'];
export const CHARACTER_HAIR = ['Black', 'Brown', 'Dark Brown', 'Blonde', 'Dirty Blonde', 'Platinum Blonde', 'Red', 'Auburn', 'Grey', 'Silver', 'White', 'Bald', 'Shaved', 'Dyed (Green)', 'Dyed (Blue)', 'Dyed (Pink)', 'Multicolored'];
export const CHARACTER_EYES = ['Brown', 'Dark Brown', 'Blue', 'Ice Blue', 'Green', 'Emerald', 'Hazel', 'Amber', 'Grey', 'Black', 'Red', 'Violet', 'Heterochromia', 'Cybernetic', 'White (Blind)', 'Glowing'];
export const CHARACTER_BUILDS = ['Average', 'Athletic', 'Muscular', 'Bodybuilder', 'Slim', 'Skinny', 'Lean', 'Heavy', 'Overweight', 'Obese', 'Petite', 'Tall', 'Giant', 'Stocky', 'Curvy', 'Lanky', 'Robotic', 'Decrepit'];
export const CHARACTER_ARCHETYPES = [
    'Hero', 'Villain', 'Anti-Hero', 'Mentor', 'Sidekick', 
    'Threshold Guardian', 'Herald', 'Shapeshifter', 'Shadow', 'Trickster',
    'The Innocent', 'The Orphan', 'The Warrior', 'The Caregiver', 
    'The Seeker', 'The Lover', 'The Destroyer', 'The Creator', 
    'The Ruler', 'The Magician', 'The Sage', 'The Jester',
    'Femme Fatale', 'The Chosen One', 'The Reluctant Hero'
];
export const CHARACTER_ROLES = ['Protagonist', 'Antagonist', 'Deuteragonist', 'Love Interest', 'Confidant', 'Foil', 'Tertiary', 'Cameo', 'Background', 'Henchman', 'Mastermind'];

export const RELATIONSHIP_TYPES = ['Friend', 'Enemy', 'Rival', 'Sibling', 'Parent', 'Child', 'Spouse', 'Lover', 'Ex-Lover', 'Mentor', 'Student', 'Boss', 'Subordinate', 'Acquaintance', 'Estranged', 'Killer', 'Victim'];

export const AVAILABLE_TAMIL_FONTS = [
    { label: 'Vijaya (Default)', value: 'Vijaya' },
    { label: 'Latha', value: 'Latha' },
    { label: 'Nirmala UI', value: 'Nirmala UI' },
    { label: 'InaiMathi', value: 'InaiMathi' },
    { label: 'Arial Unicode MS', value: 'Arial Unicode MS' },
];

export const AVAILABLE_ENGLISH_FONTS = [
    { label: 'Courier Prime', value: 'Courier Prime' },
    { label: 'Vijaya', value: 'Vijaya' },
    { label: 'Courier New', value: 'Courier New' },
    { label: 'Helvetica Neue', value: 'Helvetica Neue' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Times New Roman', value: 'Times New Roman' },
    { label: 'Georgia', value: 'Georgia' },
];

export const AVAILABLE_IMAGE_MODELS = [
    { label: 'Gemini 2.5 Flash Image (Fast & Cheap)', value: 'gemini-2.5-flash-image' },
    { label: 'Gemini 3 Pro Image (High Quality)', value: 'gemini-3-pro-image-preview' },
    { label: 'Imagen 3 (Premium)', value: 'imagen-3.0-generate-002' },
    { label: 'Stable Diffusion XL (Stability AI)', value: 'stable-diffusion-xl-1024-v1-0' },
    { label: 'SD 1.6 (Stability AI)', value: 'stable-diffusion-v1-6' }
];

export const AVAILABLE_TEXT_MODELS = [
    { label: 'Gemini 3 Flash (Fast)', value: 'gemini-3-flash-preview' },
    { label: 'Gemini 3 Pro (Smart)', value: 'gemini-3-pro-preview' },
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
];

export const VISUAL_STYLES = [
    'Charcoal Sketch',
    'Pencil & Ink (Clean)',
    'Rough Pencil Sketch',
    'Cinematic Photorealistic',
    'Graphic Novel / Comic',
    'Digital Painting (Concept)',
    'Noir / High Contrast B&W',
    'Marker Rendering',
    'Watercolor Illustration',
    'Oil Painting',
    'Anime / Manga',
    'Cyberpunk / Neon',
    '3D Render (Unreal Engine)',
    'Pixel Art'
];

export const LIGHTING_STYLES = [
    'Natural Light', 'Golden Hour', 'Cinematic / Dramatic', 
    'Studio Lighting', 'Rembrandt Lighting', 'Neon / High-Key', 
    'Low-Key / Dark', 'Volumetric Fog', 'Harsh Sunlight'
];

export const NOTE_FONTS = [
    { label: 'Merriweather (Serif)', value: '"Merriweather", serif' },
    { label: 'Inter (Clean)', value: '"Inter", sans-serif' },
    { label: 'Roboto Mono (Code)', value: '"Roboto Mono", monospace' },
];

export const INITIAL_STATE: ProjectState = {
  beats: [
    { 
      id: 0, 
      x: 25000, 
      y: 25000, 
      title: '', 
      summary: '',
      slug: { prefix: '', location: '', time: '' },
      content: '<div class="sc-line sc-action"><br></div>', 
      color: '#444', 
      shots: [], 
      status: 'not-ready', 
      versions: [],
      notes: [] // Init scene notes
    }
  ],
  groups: [],
  connections: [],
  annotations: [],
  characterData: {},
  generatedShots: [],
  
  scratchpad: '', // Legacy string content
  globalNotes: [], // Init global notes

  panX: -24500,
  panY: -24500,
  scale: 1,
  nextId: 1,
  nextAnnoId: 1,
  isTamilMode: false,
  tamilFontScale: 120, // 120% matches Courier Prime 12pt best for Vijaya
  tamilFontFamily: 'Vijaya',
  userDictionary: {},
  isOsInputMode: false,
  osInputShortcut: 'NumLock',
  scriptConfig: {
    // Default to Dark Mode as requested
    paperTheme: 'dark',
    // STANDARD A4 FORMATTING (12pt / 16px base)
    // A4 Width: 8.27in. Margins: Left 1.5, Right 1.0. Printable Width ~ 5.77in.
    // We use percentages relative to that printable area or just standard screenplay CSS rules.
    // Default changed to 13px for body text, 14px for sluglines.
    action: { marginLeft: 0, width: 100, marginTop: 0.2, marginBottom: 1.0, fontSize: 13, fontFamily: 'Courier Prime', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0, bold: false, italic: true, underline: false, color: '#000000', highlightColor: null },
    dialogue: { marginLeft: 20, width: 60, marginTop: 0, marginBottom: 0.2, fontSize: 13, fontFamily: 'Courier Prime', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0, bold: false, italic: false, underline: false, color: '#000000', highlightColor: null },
    character: { marginLeft: 35, width: 40, marginTop: 0.4, marginBottom: 0, fontSize: 13, fontFamily: 'Courier Prime', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0, bold: true, italic: false, underline: false, color: '#000000', highlightColor: null },
    parenthetical: { marginLeft: 28, width: 35, marginTop: 0, marginBottom: 0, fontSize: 13, fontFamily: 'Courier Prime', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0, bold: false, italic: true, underline: false, color: '#000000', highlightColor: null },
    transition: { marginLeft: 70, width: 30, marginTop: 0, marginBottom: 0, fontSize: 13, fontFamily: 'Courier Prime', textAlign: 'right', lineHeight: 1.2, letterSpacing: 0, bold: true, italic: false, underline: false, color: '#000000', highlightColor: null },
    shot: { marginLeft: 0, width: 100, marginTop: 0.1, marginBottom: 0.1, fontSize: 13, fontFamily: 'Courier Prime', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0, bold: true, italic: false, underline: false, color: '#000000', highlightColor: null },
    lyrics: { marginLeft: 25, width: 50, marginTop: 0, marginBottom: 0, fontSize: 13, fontFamily: 'Courier Prime', textAlign: 'center', lineHeight: 1.2, letterSpacing: 0, bold: false, italic: true, underline: false, color: '#000000', highlightColor: null, useMusicDecorations: true },
    slugline: { fontSize: 14, fontFamily: 'Courier Prime', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0, paddingVertical: 4, paddingHorizontal: 8, paddingEnabled: false, sceneNumberFontSize: 16, marginTop: 0, marginBottom: 0.2, bold: true, italic: false, underline: false, color: '#000000', highlightColor: null },
    // GLOBAL BOUNDS / LAYOUT VIZ
    blockBounds: { 
      enabled: true, 
      mode: 'active', 
      color: '#f5a623', 
      opacity: 10, 
      outlineStyle: 'none', 
      funMode: 'none' 
    },
    noteFont: '"Merriweather", serif', // DEFAULT UPDATED
    noteFontSize: 12 // Default 12px
  },
  scriptViewMode: 'continuous', // Default to Continuous
  
  scratchpadConfig: {
    fontFamily: '"Merriweather", serif', // New Default
    fontSize: 12,
    lineHeight: 1.6,
    blockSpacing: 2, 
    enableDragAnimations: true,
    dragScale: 1.02,
    dragOpacity: 0.8,
    glassEffect: false,
    enableMarkdown: true,
    // Defaults for Markdown
    h1Color: '#3b82f6', // Blue
    h2Color: '#22c55e', // Green
    h1Underline: false,
    h2Underline: false,
    h1Italic: true,
    h2Italic: true,
    
    // New Defaults
    h1FontSize: 17,
    h2FontSize: 14,
    boldColor: '#f5a623', // Orange
    italicColor: '#cccccc',
    
    // Bullets
    listMarkerColor: '#3b82f6', // Blue (Numbers)
    listMarkerSize: 120, 
    listMarkerTopOffset: 1, 
    bulletStyle: 'dot',

    // Checkboxes
    checkboxSize: 12,
    checkboxTopOffset: 2,

    calloutBackground: 'rgba(245, 166, 35, 0.05)', // Light Green tint
    calloutBorder: '#22c55e', // Green
    todoBorder: '#3b82f6', // Blue
    todoCheckColor: '#f5a623' // Orange
  },

  storyboardConfig: {
    provider: 'google',
    style: 'Charcoal Sketch',
    aspectRatio: '16:9',
    imageModel: 'gemini-2.5-flash-image', 
    textModel: 'gemini-3-flash-preview'
  },
  isStoryboardFeatureEnabled: true,
  breakdownLanguage: 'english',
  breakdownLockedOnly: true, // Default to true per user request
  isPdfDropEnabled: false, // Default OFF
  isRedoEnabled: false, // Default OFF (per user request)
  writingGoal: {
    isActive: false,
    mode: 'deadline', // 'deadline' or 'habit'
    type: 'pages',
    targetAmount: 120,
    deadline: Date.now() + (30 * 24 * 60 * 60 * 1000), // Default 30 days
    startDate: Date.now(),
    dailyTarget: 500, // Habit mode default
    includeWeekends: true,
    dailyWritingMinutes: 120 // 2 hours default
  },
  googleDriveConfig: {
    clientId: '',
    apiKey: '',
    enabled: false,
    autoBackup: false,
    lastBackup: null
  },
  geminiApiKey: '',
  stabilityApiKey: '',
  dailyStats: {},
  sessionStartCount: 0,
  lastSessionDate: new Date().toISOString().split('T')[0],
  // Order from Bottom (index 0) to Top (index 4)
  // Drawings -> Text -> Connections -> Groups -> Beats
  boardLayerOrder: ['annotations', 'text', 'connections', 'groups', 'beats']
};

export const SCRIPT_FORMATS = [
  { label: 'Action', value: 'action' },
  { label: 'Character', value: 'character' },
  { label: 'Dialogue', value: 'dialogue' },
  { label: 'Parenthetical', value: 'parenthetical' },
  { label: 'Transition', value: 'transition' },
  { label: 'Shot', value: 'shot' },
  { label: 'Lyrics', value: 'lyrics' },
];
