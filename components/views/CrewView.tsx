import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Beat, BreakdownData, ViewMode, AppTask, TaskModificationHistory } from '../../types';

export interface CrewViewProps {
  allTasks?: AppTask[];
  onUpdateTask?: (updatedTask: AppTask) => void;
  onAddTask?: (newTask: AppTask) => void;
  onDeleteTask?: (taskId: string) => void;
}

export interface TwoClickDeleteButtonProps {
  onDelete: () => void;
  className?: string;
  iconSize?: number;
  showText?: boolean;
  buttonText?: string;
  confirmText?: string;
  title?: string;
}

export const TwoClickDeleteButton: React.FC<TwoClickDeleteButtonProps> = ({
  onDelete,
  className = "text-gray-500 hover:text-red-400 p-1 rounded hover:bg-[#252528] transition-colors",
  iconSize = 12,
  showText = false,
  buttonText = "Delete",
  confirmText = "Click again to delete",
  title = "Delete task"
}) => {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (confirming) {
      const timer = setTimeout(() => {
        setConfirming(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [confirming]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirming) {
      onDelete();
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  };

  if (confirming) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-1 rounded text-[10px] animate-pulse flex items-center gap-1 shadow-lg transition-all border border-red-400"
        title="Click a second time to confirm deletion"
      >
        <Trash2 size={iconSize} />
        <span>{confirmText}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      title={`${title} (Click 2 times to delete)`}
    >
      <Trash2 size={iconSize} />
      {showText && <span>{buttonText}</span>}
    </button>
  );
};
import { 
  Users, LayoutDashboard, Calendar, FileText, Contact, BookOpen, 
  Search, Filter, Plus, ChevronRight, CheckCircle2, Clock, AlertTriangle, 
  DollarSign, IndianRupee, Layers, ShieldCheck, Film, Video, Camera, Palette, 
  Shirt, Sparkles, Scissors, Volume2, Music, Sun, Anchor, Zap, MapPin, 
  Package, Home, Hammer, Truck, Utensils, Shield, Flame, Activity, 
  Heart, Baby, Wand2, Eye, Cpu, Radio, Film as FilmIcon, Tv, Megaphone, 
  Check, X, Download, FileSpreadsheet, Printer, Share2, Grid, List, 
  Maximize2, Minimize2, Edit3, Trash2, ExternalLink, ArrowUpRight, 
  ChevronDown, ArrowRight, UserPlus, Phone, Mail, Link2, GitFork, RefreshCw,
  FolderPlus, ChevronUp, AlertCircle, Play, MoreVertical
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ContinuityLook, INITIAL_LOOKS } from './ContinuityView';

// --- TYPES FOR CREW MODULE ---

export type CrewRoleHierarchy = string;

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  departmentId: string;
  phone: string;
  email: string;
  photoUrl?: string;
  availability: 'Available' | 'On Set' | 'Travel' | 'Unavailable' | 'Pre-Production';
  callTime?: string;
  notes?: string;
  assignedScenes?: string[];
}

// --- DEPARTMENT SPECIFIC ROLES MAP ---

export const DEPARTMENT_SPECIFIC_ROLES: Record<string, string[]> = {
  production: [
    'Executive Producer', 'Producer', 'Co-Producer', 'Associate Producer', 'Line Producer',
    'Production Controller', 'Production Manager', 'Unit Production Manager (UPM)',
    'Production Coordinator', 'Production Secretary', 'Production Assistants (PAs)', 'Office Assistants'
  ],
  direction: [
    'Director', 'Co-Director', 'Associate Director', 'First Assistant Director (1st AD)',
    'Second Assistant Director (2nd AD)', 'Third Assistant Director (3rd AD)',
    'Continuity Supervisor / Script Supervisor', 'Direction Assistants'
  ],
  camera: [
    'Director of Photography (DOP)', 'Camera Operator', 'First Assistant Camera (Focus Puller)',
    'Second Assistant Camera (Clapper/Loader)', 'DIT', 'Drone Operator', 'Steadicam Operator', 'Camera Trainees'
  ],
  lighting: [
    'Gaffer', 'Best Boy Electric', 'Lighting Technicians', 'Generator Operator'
  ],
  electric: [
    'Gaffer', 'Best Boy Electric', 'Lighting Technicians', 'Generator Operator'
  ],
  grip: [
    'Key Grip', 'Best Boy Grip', 'Grip Crew', 'Rigging Grip'
  ],
  art: [
    'Production Designer', 'Supervising Art Director', 'Art Director', 'Assistant Art Director',
    'Set Designer', 'Draftsman', 'Prop Master', 'Set Decorator', 'Construction Manager',
    'Carpenter Head', 'Painter Head', 'Graphic Designer', 'Prop Assistants'
  ],
  props: [
    'Prop Master', 'Assistant Prop Master', 'Prop Buyer', 'Prop Assistant'
  ],
  set_decoration: [
    'Set Decorator', 'Leadman', 'Set Dresser', 'Buyer'
  ],
  construction: [
    'Construction Manager', 'Carpenter Head', 'Painter Head', 'Plasterer', 'Rigger'
  ],
  costume: [
    'Costume Designer', 'Assistant Costume Designer', 'Wardrobe Supervisor', 'Dressmen', 'Tailors', 'Laundry'
  ],
  makeup: [
    'Chief Makeup Artist', 'Assistant Makeup Artist', 'Prosthetic Makeup Artist', 'Special Effects Makeup Lead'
  ],
  hair: [
    'Chief Hair Stylist', 'Hair Stylist', 'Wig Specialist', 'Extension Specialist', 'Period Hair Stylist'
  ],
  sound: [
    'Production Sound Mixer', 'Boom Operator', 'Sound Assistant', 'Playback Operator'
  ],
  sfx: [
    'Special Effects Supervisor', 'SFX Technicians'
  ],
  vfx: [
    'VFX Supervisor', 'VFX Producer', 'VFX Coordinator', 'On-Set VFX Supervisor', 'Data Wrangler'
  ],
  stunts: [
    'Stunt Coordinator', 'Fight Choreographer', 'Stunt Performers'
  ],
  action: [
    'Action Coordinator', 'Fight Master', 'Stunt Rigging Lead'
  ],
  choreography: [
    'Choreographer', 'Assistant Choreographer', 'Dance Coordinator'
  ],
  locations: [
    'Location Manager', 'Assistant Location Manager', 'Location Scouts'
  ],
  transportation: [
    'Transport Captain', 'Drivers', 'Vehicle Coordinator'
  ],
  catering: [
    'Catering Manager', 'Catering Crew'
  ],
  editing: [
    'Editor', 'Assistant Editor', 'Colorist', 'Sound Designer', 'Re-recording Mixer',
    'Music Director', 'Composer', 'DI Supervisor', 'QC'
  ],
  post_production: [
    'Post Production Supervisor', 'Editor', 'Assistant Editor', 'Colorist', 'Sound Designer',
    'Re-recording Mixer', 'Music Director', 'Composer', 'DI Supervisor', 'QC'
  ],
  color: [
    'Colorist', 'DI Supervisor', 'Conform Editor'
  ],
  music: [
    'Music Director', 'Composer', 'Music Supervisor', 'Soundtrack Coordinator'
  ],
  continuity: [
    'Script Supervisor', 'Continuity Supervisor', 'Assistant Script Supervisor'
  ],
  security: [
    'Set Security Chief', 'Crowd Control Lead', 'Risk & Safety Officer', 'Fire Safety Lead'
  ],
  publicity: [
    'PRO / Publicist', 'Unit Still Photographer', 'BTS Videographer', 'Media Coordinator'
  ]
};

export interface DepartmentAsset {
  id: string;
  name: string;
  category: string;
  departmentId: string;
  sceneIds: string[];
  quantity: number;
  status: 'In Stock' | 'On Order' | 'In Use' | 'Maintenance' | 'Missing';
  condition: 'Mint' | 'Good' | 'Worn' | 'Damaged';
  assignedTo?: string;
  location?: string;
  notes?: string;
  connectedAssets?: string[];
  connectedDepartments?: string[];
}

export interface DepartmentTask {
  id: string;
  title: string;
  departmentId: string;
  owner: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  deadline: string;
  status: 'To Do' | 'In Progress' | 'Review' | 'Completed';
  relatedScene?: string;
  dependencies?: string[];
}

export interface BudgetItem {
  id: string;
  departmentId: string;
  category: string;
  item: string;
  estimatedCost: number;
  actualCost: number;
  status: 'Approved' | 'Pending' | 'Over Budget' | 'Draft';
  notes?: string;
}

export interface DepartmentApproval {
  id: string;
  departmentId: string;
  title: string;
  requestedBy: string;
  approver: string;
  status: 'Approved' | 'Pending' | 'Revisions Needed' | 'Rejected';
  date: string;
  notes?: string;
}

export interface MeetingWorkspace {
  id: string;
  departmentId: string;
  title: string;
  date: string;
  time: string;
  location: string;
  summary: string;
  scenes: string[];
  assets: string[];
  pendingWork: string[];
  approvals: string[];
  risks: string[];
  openIssues: string[];
  checklist: { id: string; text: string; done: boolean }[];
  discussionPoints: string[];
  aiQuestions: string[];
  meetingNotes: string;
  decisionLog: { id: string; decision: string; decider: string; time: string }[];
  actionItems: { id: string; task: string; owner: string; deadline: string; done: boolean }[];
}

export interface AIProductionInsight {
  id: string;
  type: 'change' | 'continuity' | 'mismatch' | 'unavailability' | 'conflict' | 'weather' | 'budget';
  severity: 'high' | 'medium' | 'low';
  departmentId: string;
  title: string;
  description: string;
  relatedScenes?: string[];
  actionRecommendation: string;
}

// --- 32 DEPARTMENTS METADATA ---

export interface DepartmentMeta {
  id: string;
  name: string;
  hod: string;
  status: 'Active' | 'Pre-Production' | 'In Progress' | 'Ready';
  progress: number;
  color: string;
  accentClass: string;
  bgClass: string;
  borderClass: string;
  icon: any;
  category: string;
}

export const ALL_DEPARTMENTS: DepartmentMeta[] = [
  // CINEMATOGRAPHY
  { id: 'camera', name: 'Camera', hod: 'Tirru ISC', status: 'In Progress', progress: 78, color: '#10b981', accentClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/30', icon: Camera, category: 'Cinematography' },
  { id: 'drone', name: 'Drone & Aerial', hod: 'Drone Pilot SkyCam', status: 'Ready', progress: 88, color: '#06b6d4', accentClass: 'text-cyan-400', bgClass: 'bg-cyan-500/10', borderClass: 'border-cyan-500/30', icon: Radio, category: 'Cinematography' },
  { id: 'lighting', name: 'Lighting / Gaffer', hod: 'Gaffer Murugan', status: 'In Progress', progress: 72, color: '#eab308', accentClass: 'text-yellow-400', bgClass: 'bg-yellow-500/10', borderClass: 'border-yellow-500/30', icon: Sun, category: 'Cinematography' },
  { id: 'grip', name: 'Grip Unit', hod: 'Key Grip Selvam', status: 'In Progress', progress: 76, color: '#64748b', accentClass: 'text-slate-300', bgClass: 'bg-slate-500/10', borderClass: 'border-slate-500/30', icon: Anchor, category: 'Cinematography' },
  { id: 'electric', name: 'Electric / Power', hod: 'Ramu Electrician', status: 'In Progress', progress: 80, color: '#f97316', accentClass: 'text-orange-400', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/30', icon: Zap, category: 'Cinematography' },
  { id: 'dit', name: 'DIT & Data', hod: 'DIT Engineer Nithin', status: 'Ready', progress: 90, color: '#0284c7', accentClass: 'text-sky-400', bgClass: 'bg-sky-500/10', borderClass: 'border-sky-500/30', icon: Cpu, category: 'Cinematography' },

  // DIRECTION & PRODUCTION
  { id: 'direction', name: 'Direction', hod: 'Karthik Subbaraj', status: 'Active', progress: 85, color: '#f5a623', accentClass: 'text-amber-400', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/30', icon: Film, category: 'Direction & Production' },
  { id: 'production', name: 'Production', hod: 'Santhosh Kumar', status: 'Active', progress: 90, color: '#3b82f6', accentClass: 'text-blue-400', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/30', icon: Shield, category: 'Direction & Production' },
  { id: 'locations', name: 'Locations', hod: 'Kannan Recce', status: 'Ready', progress: 95, color: '#14b8a6', accentClass: 'text-teal-400', bgClass: 'bg-teal-500/10', borderClass: 'border-teal-500/30', icon: MapPin, category: 'Direction & Production' },
  { id: 'publicity', name: 'Publicity & PR', hod: 'PRO Diamond Babu', status: 'Pre-Production', progress: 50, color: '#eab308', accentClass: 'text-yellow-400', bgClass: 'bg-yellow-500/10', borderClass: 'border-yellow-500/30', icon: Megaphone, category: 'Direction & Production' },

  // ART & PRODUCTION DESIGN
  { id: 'art', name: 'Art Department', hod: 'Kumar Gangappan', status: 'In Progress', progress: 70, color: '#ec4899', accentClass: 'text-pink-400', bgClass: 'bg-pink-500/10', borderClass: 'border-pink-500/30', icon: Palette, category: 'Art & Production Design' },
  { id: 'props', name: 'Props Unit', hod: 'Prop Master Mani', status: 'In Progress', progress: 68, color: '#ef4444', accentClass: 'text-red-400', bgClass: 'bg-red-500/10', borderClass: 'border-red-500/30', icon: Package, category: 'Art & Production Design' },
  { id: 'set_decoration', name: 'Set Decoration', hod: 'Set Decorator Priya', status: 'In Progress', progress: 74, color: '#d946ef', accentClass: 'text-fuchsia-400', bgClass: 'bg-fuchsia-500/10', borderClass: 'border-fuchsia-500/30', icon: Home, category: 'Art & Production Design' },
  { id: 'construction', name: 'Construction', hod: 'Master Carpenter Velu', status: 'Active', progress: 62, color: '#b45309', accentClass: 'text-amber-600', bgClass: 'bg-amber-700/10', borderClass: 'border-amber-700/30', icon: Hammer, category: 'Art & Production Design' },

  // STYLING & CHARACTER APPEARANCE
  { id: 'costume', name: 'Costume & Wardrobe', hod: 'Anirudh Singh', status: 'In Progress', progress: 82, color: '#a855f7', accentClass: 'text-purple-400', bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/30', icon: Shirt, category: 'Styling & Appearance' },
  { id: 'makeup', name: 'Makeup & Prosthetics', hod: 'Banu M', status: 'Pre-Production', progress: 65, color: '#f43f5e', accentClass: 'text-rose-400', bgClass: 'bg-rose-500/10', borderClass: 'border-rose-500/30', icon: Sparkles, category: 'Styling & Appearance' },
  { id: 'hair', name: 'Hair & Wigs', hod: 'Stella Marie', status: 'Pre-Production', progress: 68, color: '#f43f5e', accentClass: 'text-rose-300', bgClass: 'bg-rose-500/10', borderClass: 'border-rose-500/30', icon: Scissors, category: 'Styling & Appearance' },

  // SOUND & MUSIC
  { id: 'sound', name: 'Sound Department', hod: 'Resul Pookutty', status: 'In Progress', progress: 75, color: '#06b6d4', accentClass: 'text-cyan-400', bgClass: 'bg-cyan-500/10', borderClass: 'border-cyan-500/30', icon: Volume2, category: 'Sound & Music' },
  { id: 'music', name: 'Music & Score', hod: 'Santhosh Narayanan', status: 'Active', progress: 88, color: '#8b5cf6', accentClass: 'text-violet-400', bgClass: 'bg-violet-500/10', borderClass: 'border-violet-500/30', icon: Music, category: 'Sound & Music' },

  // ACTION, STUNTS & SPECIAL UNITS
  { id: 'stunts', name: 'Stunts Unit', hod: 'Stunt Master Supreme', status: 'In Progress', progress: 84, color: '#dc2626', accentClass: 'text-red-500', bgClass: 'bg-red-600/10', borderClass: 'border-red-600/30', icon: Flame, category: 'Action & Stunt Units' },
  { id: 'action', name: 'Action Coordination', hod: 'Action Coordinator Peter', status: 'In Progress', progress: 80, color: '#ea580c', accentClass: 'text-orange-500', bgClass: 'bg-orange-600/10', borderClass: 'border-orange-600/30', icon: Activity, category: 'Action & Stunt Units' },
  { id: 'sfx', name: 'Special Effects (SFX)', hod: 'SFX Specialist Explosives', status: 'In Progress', progress: 75, color: '#ef4444', accentClass: 'text-red-400', bgClass: 'bg-red-500/10', borderClass: 'border-red-500/30', icon: Flame, category: 'Action & Stunt Units' },
  { id: 'choreography', name: 'Choreography', hod: 'Dinesh Master', status: 'Pre-Production', progress: 55, color: '#f43f5e', accentClass: 'text-rose-400', bgClass: 'bg-rose-500/10', borderClass: 'border-rose-500/30', icon: Heart, category: 'Action & Stunt Units' },
  { id: 'animals', name: 'Animals Unit', hod: 'Animal Handler Captain', status: 'Ready', progress: 90, color: '#15803d', accentClass: 'text-green-500', bgClass: 'bg-green-700/10', borderClass: 'border-green-700/30', icon: ShieldCheck, category: 'Action & Stunt Units' },
  { id: 'children', name: 'Child Care & Tutors', hod: 'Child Tutor Mary', status: 'Ready', progress: 95, color: '#38bdf8', accentClass: 'text-sky-300', bgClass: 'bg-sky-400/10', borderClass: 'border-sky-400/30', icon: Baby, category: 'Action & Stunt Units' },

  // POST PRODUCTION & VFX
  { id: 'vfx', name: 'VFX Department', hod: 'VFX Supervisor Srinivas', status: 'In Progress', progress: 68, color: '#6366f1', accentClass: 'text-indigo-400', bgClass: 'bg-indigo-500/10', borderClass: 'border-indigo-500/30', icon: Wand2, category: 'Post Production & VFX' },
  { id: 'editing', name: 'Editing & Post', hod: 'Editor Vivek Harshan', status: 'Pre-Production', progress: 40, color: '#a855f7', accentClass: 'text-purple-400', bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/30', icon: FilmIcon, category: 'Post Production & VFX' },
  { id: 'color', name: 'Color Grading (DI)', hod: 'Colorist Redchillies', status: 'Pre-Production', progress: 35, color: '#ec4899', accentClass: 'text-pink-400', bgClass: 'bg-pink-500/10', borderClass: 'border-pink-500/30', icon: Tv, category: 'Post Production & VFX' },

  // LOGISTICS & SET OPERATIONS
  { id: 'transportation', name: 'Transportation', hod: 'Fleet Manager Rajan', status: 'Ready', progress: 92, color: '#0284c7', accentClass: 'text-sky-400', bgClass: 'bg-sky-500/10', borderClass: 'border-sky-500/30', icon: Truck, category: 'Logistics & Set Operations' },
  { id: 'catering', name: 'Catering & Craft', hod: 'Chef Annapoorna', status: 'Ready', progress: 98, color: '#84cc16', accentClass: 'text-lime-400', bgClass: 'bg-lime-500/10', borderClass: 'border-lime-500/30', icon: Utensils, category: 'Logistics & Set Operations' },
  { id: 'continuity', name: 'Script & Continuity', hod: 'Meena R', status: 'Active', progress: 88, color: '#f5a623', accentClass: 'text-amber-400', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/30', icon: BookOpen, category: 'Logistics & Set Operations' },
  { id: 'security', name: 'Security & Safety', hod: 'Safety Chief Victor', status: 'Ready', progress: 96, color: '#64748b', accentClass: 'text-slate-300', bgClass: 'bg-slate-500/10', borderClass: 'border-slate-500/30', icon: ShieldCheck, category: 'Logistics & Set Operations' },
];

// INITIAL SEED DATA FOR DEMO ENRICHMENT
const INITIAL_CREW_MEMBERS: CrewMember[] = [
  // DIRECTION
  { id: 'cr-1', name: 'Karthik Subbaraj', role: 'Director', departmentId: 'direction', phone: '+91 98400 11223', email: 'karthik@backstage.film', availability: 'On Set', callTime: '06:30 AM', notes: 'Master Shot breakdown ready for Scene 12.' },
  { id: 'cr-2', name: 'Arun Kumar', role: 'First Assistant Director (1st AD)', departmentId: 'direction', phone: '+91 98400 11224', email: 'arun@backstage.film', availability: 'On Set', callTime: '06:00 AM', notes: 'Handling background extra cues & call sheets.' },
  { id: 'cr-2b', name: 'Meena R', role: 'Continuity Supervisor / Script Supervisor', departmentId: 'direction', phone: '+91 98400 11225', email: 'meena@backstage.film', availability: 'On Set', callTime: '06:15 AM', notes: 'Tracking prop & costume continuity across scenes.' },

  // PRODUCTION LEADERSHIP
  { id: 'cr-p1', name: 'Santhosh Kumar', role: 'Line Producer', departmentId: 'production', phone: '+91 98400 10001', email: 'santhosh@backstage.film', availability: 'On Set', callTime: '06:00 AM', notes: 'Overseeing daily budget log & location permits.' },
  { id: 'cr-p2', name: 'Anand K', role: 'Unit Production Manager (UPM)', departmentId: 'production', phone: '+91 98400 10002', email: 'anand@backstage.film', availability: 'On Set', callTime: '05:30 AM' },
  { id: 'cr-p3', name: 'Deepa V', role: 'Production Coordinator', departmentId: 'production', phone: '+91 98400 10003', email: 'deepa@backstage.film', availability: 'Available', callTime: '06:30 AM' },

  // CAMERA
  { id: 'cr-3', name: 'Tirru ISC', role: 'Director of Photography (DOP)', departmentId: 'camera', phone: '+91 98400 22334', email: 'tirru@backstage.film', availability: 'On Set', callTime: '06:15 AM', notes: 'Requested 35mm Anamorphic Lens for EXT Night.' },
  { id: 'cr-4', name: 'Venkatesh', role: 'Camera Operator', departmentId: 'camera', phone: '+91 98400 22335', email: 'venkat@backstage.film', availability: 'Available', callTime: '06:15 AM', notes: 'Checking focus pulling rig & A-cam setup.' },
  { id: 'cr-4b', name: 'Siva M', role: 'First Assistant Camera (Focus Puller)', departmentId: 'camera', phone: '+91 98400 22336', email: 'siva@backstage.film', availability: 'On Set', callTime: '06:15 AM' },

  // LIGHTING & GRIP
  { id: 'cr-l1', name: 'Murugan', role: 'Gaffer', departmentId: 'lighting', phone: '+91 98400 77001', email: 'gaffer@backstage.film', availability: 'On Set', callTime: '05:00 AM' },
  { id: 'cr-g1', name: 'Selvam', role: 'Key Grip', departmentId: 'grip', phone: '+91 98400 77002', email: 'keygrip@backstage.film', availability: 'On Set', callTime: '05:00 AM' },

  // ART & PROPS
  { id: 'cr-5', name: 'Kumar Gangappan', role: 'Production Designer', departmentId: 'art', phone: '+91 98400 33445', email: 'kumar@backstage.film', availability: 'On Set', callTime: '05:30 AM', notes: 'Vintage Police Station set build complete.' },
  { id: 'cr-pr1', name: 'Mani', role: 'Prop Master', departmentId: 'props', phone: '+91 98400 33446', email: 'mani@backstage.film', availability: 'On Set', callTime: '05:30 AM', notes: 'Hero revolver & armory lockbox secured.' },

  // COSTUME & MAKEUP
  { id: 'cr-6', name: 'Anirudh Singh', role: 'Costume Designer', departmentId: 'costume', phone: '+91 98400 44556', email: 'anirudh@backstage.film', availability: 'Pre-Production', callTime: '07:00 AM', notes: 'Hero leather jacket duplicates (3x) ready for stunts.' },
  { id: 'cr-m1', name: 'Banu M', role: 'Chief Makeup Artist', departmentId: 'makeup', phone: '+91 98400 44557', email: 'banu@backstage.film', availability: 'On Set', callTime: '05:00 AM' },
  { id: 'cr-h1', name: 'Stella Marie', role: 'Chief Hair Stylist', departmentId: 'makeup', phone: '+91 98400 44558', email: 'stella@backstage.film', availability: 'On Set', callTime: '05:15 AM' },

  // SOUND & MUSIC
  { id: 'cr-7', name: 'Resul Pookutty', role: 'Production Sound Mixer', departmentId: 'sound', phone: '+91 98400 55667', email: 'resul@backstage.film', availability: 'Available', callTime: '06:45 AM', notes: 'Wild tracks required for Rain Scene 14.' },
  { id: 'cr-mu1', name: 'Santhosh Narayanan', role: 'Music Director', departmentId: 'music', phone: '+91 98400 55668', email: 'sana@backstage.film', availability: 'Pre-Production', callTime: '10:00 AM' },

  // STUNTS & SFX / VFX
  { id: 'cr-8', name: 'Stunt Master Supreme', role: 'Stunt Coordinator', departmentId: 'stunts', phone: '+91 98400 66778', email: 'supreme@backstage.film', availability: 'On Set', callTime: '05:00 AM', notes: 'Rappelling harness inspected.' },
  { id: 'cr-sfx1', name: 'Explosives Specialist', role: 'Special Effects Supervisor', departmentId: 'sfx', phone: '+91 98400 66779', email: 'sfx@backstage.film', availability: 'On Set', callTime: '05:30 AM' },
  { id: 'cr-vfx1', name: 'Srinivas', role: 'VFX Supervisor', departmentId: 'vfx', phone: '+91 98400 66780', email: 'vfx@backstage.film', availability: 'On Set', callTime: '06:30 AM' },

  // POST PRODUCTION
  { id: 'cr-[#ed1]', name: 'Vivek Harshan', role: 'Editor', departmentId: 'editing', phone: '+91 98400 88001', email: 'editor@backstage.film', availability: 'Pre-Production', callTime: '09:00 AM' },
];

const INITIAL_TASKS: DepartmentTask[] = [
  { id: 'tk-1', title: 'Finalize Lens Package for Anamorphic Low-Light Shots', departmentId: 'camera', owner: 'Tirru ISC', priority: 'Critical', deadline: '2026-08-03', status: 'In Progress', relatedScene: 'Scene 12' },
  { id: 'tk-2', title: 'Age Police Station Exterior Brick Wall for Rain Sequence', departmentId: 'art', owner: 'Kumar Gangappan', priority: 'High', deadline: '2026-08-02', status: 'In Progress', relatedScene: 'Scene 14' },
  { id: 'tk-3', title: 'Source 3 Duplicates of Hero Leather Jacket', departmentId: 'costume', owner: 'Anirudh Singh', priority: 'Critical', deadline: '2026-08-01', status: 'Completed', relatedScene: 'Scene 27' },
  { id: 'tk-4', title: 'Obtain Night Shooting Permission from City Traffic Police', departmentId: 'production', owner: 'Santhosh Kumar', priority: 'Critical', deadline: '2026-08-02', status: 'In Progress', relatedScene: 'Scene 18' },
  { id: 'tk-5', title: 'Setup Green Screen Rigging for Car Chase Window Extensions', departmentId: 'vfx', owner: 'Srinivas', priority: 'Medium', deadline: '2026-08-05', status: 'To Do', relatedScene: 'Scene 22' },
];

const INITIAL_BUDGET: BudgetItem[] = [
  { id: 'bg-1', departmentId: 'camera', category: 'Equipment Rental', item: 'ARRI Alexa 35 Package + Anamorphic Lenses', estimatedCost: 450000, actualCost: 480000, status: 'Over Budget', notes: 'Added extra 24mm prime' },
  { id: 'bg-2', departmentId: 'art', category: 'Set Construction', item: 'Police Station Interior Timber & Paints', estimatedCost: 800000, actualCost: 750000, status: 'Approved', notes: 'Under budget by ₹50k' },
  { id: 'bg-3', departmentId: 'costume', category: 'Hero Wardrobe', item: 'Custom Leather Jackets & Stunt Doubles', estimatedCost: 250000, actualCost: 245000, status: 'Approved', notes: '3 duplicates sourced' },
  { id: 'bg-4', departmentId: 'production', category: 'Location Fees', item: 'City Mall Night Closure Permit', estimatedCost: 350000, actualCost: 350000, status: 'Approved' },
];

const INITIAL_AI_INSIGHTS: AIProductionInsight[] = [
  {
    id: 'ai-1',
    type: 'change',
    severity: 'high',
    departmentId: 'costume',
    title: 'Script Change Alert: Scene 12 Rain Transition',
    description: 'Scene 12 was changed from INT Night to EXT Rain in the latest script revision. Hero Wardrobe requires waterproofing and extra dry duplicates.',
    relatedScenes: ['Scene 12'],
    actionRecommendation: 'Confirm 4 dry duplicate jackets with Costume team before call time.'
  },
  {
    id: 'ai-2',
    type: 'continuity',
    severity: 'high',
    departmentId: 'props',
    title: 'Prop Continuity Conflict: Hero Revolver Holster',
    description: 'Hero revolver is unholstered in Scene 12 (Night) but scripted as holstered in Scene 18 (Immediate continuation).',
    relatedScenes: ['Scene 12', 'Scene 18'],
    actionRecommendation: 'Ensure Continuity Supervisor logs holster state before Scene 18 roll.'
  },
  {
    id: 'ai-3',
    type: 'weather',
    severity: 'medium',
    departmentId: 'construction',
    title: 'Weather Warning: Rain Predicted on Build Day',
    description: 'Heavy rain forecasted for tomorrow evening. Outdoor sets in Scene 14 (Alleyway Exterior) risk paint run-off.',
    relatedScenes: ['Scene 14'],
    actionRecommendation: 'Cover Alleyway set with heavy tarpaulin or prioritize interior scenes.'
  },
  {
    id: 'ai-4',
    type: 'budget',
    severity: 'high',
    departmentId: 'camera',
    title: 'Camera Department Budget Overrun Prediction',
    description: 'Adding special drone rigging and high-speed Phantom camera for Stunt Scene 27 projects a 12% budget overrun.',
    relatedScenes: ['Scene 27'],
    actionRecommendation: 'Review camera package sub-rentals or seek Producer approval for ₹80,000 addition.'
  }
];

export interface ProductionTemplateItem {
  id: string;
  title: string;
  category: 'Camera & Lighting' | 'Wardrobe & Art' | 'Sound & Audio' | 'Logistics & Safety' | 'Directing & Continuity' | 'Stunts & SFX';
  departmentId: string;
  departmentName: string;
  desc: string;
  estimatedTime: string;
  usedCount: number;
  lastUsed?: string;
  isCustom?: boolean;
  checklists: { id: string; text: string; completed: boolean }[];
  fields: { id: string; label: string; value: string; placeholder: string; type: 'text' | 'textarea' | 'select'; options?: string[] }[];
}

const INITIAL_PRODUCTION_TEMPLATES: ProductionTemplateItem[] = [
  {
    id: 'tpl-1',
    title: 'Camera Lens & Gear Checklist',
    category: 'Camera & Lighting',
    departmentId: 'camera',
    departmentName: 'Camera & Cinematography',
    desc: 'Anamorphic & spherical lens test sheet, sensor cleaning, focal length inventory, battery count & data cards log.',
    estimatedTime: '20 mins',
    usedCount: 14,
    lastUsed: 'Yesterday',
    checklists: [
      { id: 'c1', text: 'Inspect Front & Rear Element for Dust & Scratches', completed: true },
      { id: 'c2', text: 'Check Focus Ring Torque & Gear Pitch Alignment', completed: true },
      { id: 'c3', text: 'Calibrate Wireless Follow Focus (Teradek / Bartech)', completed: false },
      { id: 'c4', text: 'Format High-Speed CFexpress Cards (A & B Camera)', completed: false },
      { id: 'c5', text: 'Verify Mattebox Trays & ND Filter Sets (.3, .6, .9, 1.2, Polarizer)', completed: true },
      { id: 'c6', text: 'Test Wireless Video Transmitter & Client Monitors', completed: false },
      { id: 'c7', text: 'Check V-Mount Battery Charge Levels & Dual Charger Unit', completed: false }
    ],
    fields: [
      { id: 'f1', label: 'Primary Camera Body', value: 'ARRI Alexa Mini LF / RED V-Raptor', placeholder: 'e.g. ARRI Alexa 35', type: 'text' },
      { id: 'f2', label: 'Lens Package', value: 'Cooke Anamorphic / Zeiss Master Primes', placeholder: 'e.g. Cooke 35mm-100mm', type: 'text' },
      { id: 'f3', label: 'DIT Backup Drive ID', value: 'SSD RAID 10 - 8TB (Drive #02)', placeholder: 'e.g. RAID Drive A', type: 'text' },
      { id: 'f4', label: 'Inspector / 1st AC', value: 'Tirru ISC / Lead Camera Tech', placeholder: '1st AC Name', type: 'text' }
    ]
  },
  {
    id: 'tpl-2',
    title: 'Wardrobe & Costume Continuity Sheet',
    category: 'Wardrobe & Art',
    departmentId: 'costume',
    departmentName: 'Costume & Wardrobe',
    desc: 'Actor measurements, character scene outfit tags, distress levels, duplicate count & laundry logs.',
    estimatedTime: '15 mins',
    usedCount: 9,
    lastUsed: '2 days ago',
    checklists: [
      { id: 'c1', text: 'Confirm Hero Outfit Staging for Main Cast', completed: true },
      { id: 'c2', text: 'Check Duplicate Backup Outfits for Stunt Doubles (Min 3 sets)', completed: false },
      { id: 'c3', text: 'Apply Ageing / Weathering / Mud Stains per Scene Script Beat', completed: true },
      { id: 'c4', text: 'Label Garment Hangers with Character Name & Scene Range', completed: true },
      { id: 'c5', text: 'Log Steamer & Portable Sewing Kit Inventory', completed: false },
      { id: 'c6', text: 'Verify On-Set Dressing Trailer Rack Organization', completed: false }
    ],
    fields: [
      { id: 'f1', label: 'Character / Actor Name', value: 'Hero / Lead Character', placeholder: 'Character Name', type: 'text' },
      { id: 'f2', label: 'Costume Look ID', value: 'Look #03 (EXT Night Fight)', placeholder: 'Look ID', type: 'text' },
      { id: 'f3', label: 'Weathering / Distressing Stage', value: 'Heavy distressing & blood stain stage 2', placeholder: 'Distressing stage', type: 'text' },
      { id: 'f4', label: 'Costume Designer Lead', value: 'Anju Modi / Wardrobe Supervisor', placeholder: 'Designer Name', type: 'text' }
    ]
  },
  {
    id: 'tpl-3',
    title: 'Sound Log & Wireless Frequency Report',
    category: 'Sound & Audio',
    departmentId: 'sound',
    departmentName: 'Sound & Audio',
    desc: 'Boom mic placements, lavalier transmitter frequencies, RF interference log & ambient room tone recordings.',
    estimatedTime: '15 mins',
    usedCount: 12,
    lastUsed: 'Today',
    checklists: [
      { id: 'c1', text: 'Perform Frequency Scan for Wireless Lavalier Mics (470-608 MHz)', completed: true },
      { id: 'c2', text: 'Test Boom Mic Shockmounts & Windjammer Furry Covers', completed: true },
      { id: 'c3', text: 'Record 60 Seconds Clean Ambient Room Tone per Location', completed: false },
      { id: 'c4', text: 'Set Timecode Sync between Sound Recorder & All Camera Bodies', completed: true },
      { id: 'c5', text: 'Sanitize & Hide Skin Mics on Cast Outfits', completed: false },
      { id: 'c6', text: 'Deliver Daily Audio File Logs to DIT / Post Supervisor', completed: false }
    ],
    fields: [
      { id: 'f1', label: 'Audio Recorder Console', value: 'Sound Devices 888 / 32-Track', placeholder: 'Recorder Console', type: 'text' },
      { id: 'f2', label: 'Wireless Mic Channels', value: 'Lectrosonics / Wisycom Dual System', placeholder: 'Wireless Frequencies', type: 'text' },
      { id: 'f3', label: 'Room Tone Scene Tag', value: 'Scene 14 EXT Yard Room Tone', placeholder: 'Scene Tag', type: 'text' },
      { id: 'f4', label: 'Head Sound Mixer', value: 'Resul Pookutty / Audio Supervisor', placeholder: 'Sound Mixer Name', type: 'text' }
    ]
  },
  {
    id: 'tpl-4',
    title: 'HOD Daily Pre-Production Sync Agenda',
    category: 'Logistics & Safety',
    departmentId: 'production',
    departmentName: 'Production & Logistics',
    desc: 'Daily HOD alignment checklist, safety briefing, weather backup plans, call sheet review.',
    estimatedTime: '30 mins',
    usedCount: 22,
    lastUsed: 'Today',
    checklists: [
      { id: 'c1', text: 'Review Script Revisions & Scene Breakdown Page Counts', completed: true },
      { id: 'c2', text: 'Confirm Location Permit Clearances & Parking Area Assignments', completed: true },
      { id: 'c3', text: 'Conduct Stunt & Pyro Risk Assessment Briefing', completed: false },
      { id: 'c4', text: 'Verify Equipment Truck Transit Schedules', completed: true },
      { id: 'c5', text: 'Set Weather Contingency Plan (Cover Set Selection)', completed: false },
      { id: 'c6', text: 'Approve Next Day Call Sheet Draft with First AD', completed: false }
    ],
    fields: [
      { id: 'f1', label: 'Production Shooting Day #', value: 'Day 12 of 45', placeholder: 'Shooting Day #', type: 'text' },
      { id: 'f2', label: 'Cover Set Backup', value: 'INT Studio Floor 2 (Backup)', placeholder: 'Cover Set Name', type: 'text' },
      { id: 'f3', label: 'High Risk Elements', value: 'Pyrotechnic explosion & vehicle stunt', placeholder: 'Risk Elements', type: 'text' },
      { id: 'f4', label: 'Meeting Chair / 1st AD', value: 'Line Producer / First AD', placeholder: 'Chairperson Name', type: 'text' }
    ]
  },
  {
    id: 'tpl-5',
    title: 'Location Risk Assessment & Tech Scout',
    category: 'Logistics & Safety',
    departmentId: 'locations',
    departmentName: 'Locations & Unit',
    desc: 'Generator KVA requirements, noise pollution check, permits, holding areas & transit map.',
    estimatedTime: '25 mins',
    usedCount: 8,
    lastUsed: '3 days ago',
    checklists: [
      { id: 'c1', text: 'Measure Generator Distance & Sound Baffle Requirements', completed: true },
      { id: 'c2', text: 'Check On-Site Main Power Distro Breakout Box Compatibility', completed: false },
      { id: 'c3', text: 'Locate Crew Catering & Actor Holding Trailers Setup Area', completed: true },
      { id: 'c4', text: 'Inspect Emergency Exits & First Aid Access Routes', completed: true },
      { id: 'c5', text: 'Confirm Local Municipal Shooting Permit Sign-offs', completed: false },
      { id: 'c6', text: 'Verify Nearby Ambient Noise Sources (Flight Paths, Construction)', completed: false }
    ],
    fields: [
      { id: 'f1', label: 'Location Name & Address', value: 'Old Mill Heritage Site - EXT Yard', placeholder: 'Location Address', type: 'text' },
      { id: 'f2', label: 'Generator KVA Rating', value: '125 KVA Quiet Diesel Generator', placeholder: 'Generator Capacity', type: 'text' },
      { id: 'f3', label: 'Nearest Emergency Hospital', value: 'St. Jude Emergency Center (2.4 km)', placeholder: 'Hospital Contact', type: 'text' },
      { id: 'f4', label: 'Location Manager Lead', value: 'Santhosh Kumar / Location Head', placeholder: 'Manager Name', type: 'text' }
    ]
  },
  {
    id: 'tpl-6',
    title: 'Art Dept Prop & Set Dressing Log',
    category: 'Wardrobe & Art',
    departmentId: 'art',
    departmentName: 'Art & Production Design',
    desc: 'Hero props inventory, breakaways, patina/ageing, weapon clearance certification.',
    estimatedTime: '20 mins',
    usedCount: 11,
    lastUsed: 'Yesterday',
    checklists: [
      { id: 'c1', text: 'Verify Hero Props in Staging Lockbox', completed: true },
      { id: 'c2', text: 'Check Rubber & Sugar-Glass Breakaway Props Inventory', completed: true },
      { id: 'c3', text: 'Match Set Dressing Furniture Placement to Storyboard Stills', completed: false },
      { id: 'c4', text: 'Verify Fire/Weapon Safety Officer Sign-off on Blank Firing Props', completed: false },
      { id: 'c5', text: 'Log Props Returned to Storage After Scene Wrap', completed: false }
    ],
    fields: [
      { id: 'f1', label: 'Hero Prop Name', value: 'Vintage Brass Pocket Watch', placeholder: 'Prop Name', type: 'text' },
      { id: 'f2', label: 'Duplicates Count', value: '4 identical units (1 hero, 3 stunts)', placeholder: 'Qty', type: 'text' },
      { id: 'f3', label: 'Prop Master / Designer', value: 'Kumar Gangappan / Production Designer', placeholder: 'Prop Master Name', type: 'text' }
    ]
  },
  {
    id: 'tpl-7',
    title: 'Director & Script Supervisor Continuity Sheet',
    category: 'Directing & Continuity',
    departmentId: 'direction',
    departmentName: 'Direction & Script',
    desc: 'Shot takes, lens height/angle, wild tracks needed, actor movement direction notes.',
    estimatedTime: '10 mins',
    usedCount: 19,
    lastUsed: 'Today',
    checklists: [
      { id: 'c1', text: 'Log Circle Takes for Editor Assembly', completed: true },
      { id: 'c2', text: 'Record Lens Focal Length & Distance to Subject', completed: true },
      { id: 'c3', text: 'Check Eyeline Vector Alignment for Reverse OTS Shots', completed: false },
      { id: 'c4', text: 'Note Dialogue Variations or Script Improvisation Notes', completed: true },
      { id: 'c5', text: 'Ensure Props Hand-Match Across Consecutive Takes', completed: false }
    ],
    fields: [
      { id: 'f1', label: 'Scene & Shot #', value: 'Scene 18 / Shot 4B', placeholder: 'Scene/Shot', type: 'text' },
      { id: 'f2', label: 'Lens Height & Angle', value: '4 ft 2 in / Eye-Level 35mm', placeholder: 'Lens Specs', type: 'text' },
      { id: 'f3', label: 'Script Supervisor', value: 'Lead Continuity Supervisor', placeholder: 'Supervisor Name', type: 'text' }
    ]
  },
  {
    id: 'tpl-8',
    title: 'Grip & Electric Rigging Safety Rider',
    category: 'Camera & Lighting',
    departmentId: 'grip',
    departmentName: 'Grip & Electrical',
    desc: 'Truss load calculations, safety cable checks, C-stand sandbagging, high-wind tie downs.',
    estimatedTime: '20 mins',
    usedCount: 7,
    lastUsed: '4 days ago',
    checklists: [
      { id: 'c1', text: 'Sandbag Every Light Stand & C-Stand (Min 2 Bag Ratio)', completed: true },
      { id: 'c2', text: 'Inspect Overhead Truss Clamp Torque & Safety Wire Cable Attachments', completed: true },
      { id: 'c3', text: 'Test SkyPanel / HMI Ballast Weather Proofing & Cable Covers', completed: false },
      { id: 'c4', text: 'Perform Rigging Load Limit Checks for Overhead Diffusion Scrims', completed: false },
      { id: 'c5', text: 'Verify High Wind Anemometer Alerts & Safety Guidelines', completed: true }
    ],
    fields: [
      { id: 'f1', label: 'Rigging Grid Area', value: 'EXT Courtyard Rigging Grid', placeholder: 'Rigging Area', type: 'text' },
      { id: 'f2', label: 'Key Grip Lead', value: 'Head Key Grip / Lead Tech', placeholder: 'Key Grip Name', type: 'text' },
      { id: 'f3', label: 'Gaffer / Chief Lighting', value: 'Gaffer / Chief Electrician', placeholder: 'Gaffer Name', type: 'text' }
    ]
  },
  {
    id: 'tpl-9',
    title: 'Stunts & SFX Explosive Safety Clearance',
    category: 'Stunts & SFX',
    departmentId: 'stunts',
    departmentName: 'Stunts & Special Effects',
    desc: 'Pyrotechnic clearance, stunt double harness checks, fire retardant gel, medical officer sign-off.',
    estimatedTime: '30 mins',
    usedCount: 5,
    lastUsed: '5 days ago',
    checklists: [
      { id: 'c1', text: 'Verify Stunt Harness & High-Fall Airbag Certification', completed: true },
      { id: 'c2', text: 'Inspect Flame-Retardant Gel Application on Stunt Doubles', completed: true },
      { id: 'c3', text: 'Conduct Fire Extinguisher & Fire Marshal Standby Check', completed: false },
      { id: 'c4', text: 'Test Remote Pyrotechnic Detonator Firing Circuits', completed: false },
      { id: 'c5', text: 'Establish 50-Meter Safety Perimeter Clearance Zone', completed: false }
    ],
    fields: [
      { id: 'f1', label: 'Stunt Sequence ID', value: 'EXT Car Chase & Roll Sequence', placeholder: 'Stunt ID', type: 'text' },
      { id: 'f2', label: 'Stunt Coordinator', value: 'Lead Stunt Master', placeholder: 'Coordinator Name', type: 'text' },
      { id: 'f3', label: 'Fire Marshal Permit #', value: 'SFX-PERMIT-2026-88', placeholder: 'Permit #', type: 'text' }
    ]
  }
];

// --- MAIN CREW VIEW COMPONENT ---

// Helper to check if department uses continuity (Costume, Makeup, Vehicles)
const isContinuityApplicableDept = (deptId: string, deptName?: string) => {
  const d = (deptId || '').toLowerCase();
  const n = (deptName || '').toLowerCase();
  return (
    d.includes('costume') || d.includes('wardrobe') || n.includes('costume') || n.includes('wardrobe') ||
    d.includes('makeup') || d.includes('hair') || d.includes('sfx') || n.includes('makeup') || n.includes('hair') || n.includes('sfx') ||
    d.includes('vehicle') || d.includes('transport') || n.includes('vehicle') || n.includes('transport')
  );
};

export const CrewView: React.FC<CrewViewProps> = ({ 
  allTasks, 
  onUpdateTask, 
  onAddTask, 
  onDeleteTask 
}) => {
  const { beats, appTheme } = useProject();
  const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  // Sidebar & Global State
  const [activeSidebarItem, setActiveSidebarItem] = useState<'dashboard' | 'departments' | 'meetings' | 'reports' | 'contacts' | 'templates'>('departments');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('direction');
  const [deptTab, setDeptTab] = useState<'crew' | 'scenes' | 'assets' | 'tasks' | 'budget' | 'continuity'>('crew');

  // Grouped departments by category
  const groupedDepartments = useMemo<Record<string, DepartmentMeta[]>>(() => {
    const groups: Record<string, DepartmentMeta[]> = {};
    ALL_DEPARTMENTS.forEach(d => {
      const cat = d.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    });
    return groups;
  }, []);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  // Continuity Looks State synced with localStorage & ContinuityView
  const [continuityLooks, setContinuityLooks] = useState<ContinuityLook[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('backstage_continuity_looks');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
          console.error(e);
        }
      }
    }
    return INITIAL_LOOKS;
  });

  const continuityLooksRef = useRef(continuityLooks);
  const isInternalContinuityUpdate = useRef(false);

  useEffect(() => {
    continuityLooksRef.current = continuityLooks;
  }, [continuityLooks]);

  // Sync continuityLooks with localStorage and emit window event
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const jsonStr = JSON.stringify(continuityLooks);
      const existingStr = localStorage.getItem('backstage_continuity_looks');
      if (existingStr !== jsonStr) {
        localStorage.setItem('backstage_continuity_looks', jsonStr);
        isInternalContinuityUpdate.current = true;
        window.dispatchEvent(new Event('backstage_continuity_updated'));
      }
    }
  }, [continuityLooks]);

  // Listen for updates from ContinuityView
  useEffect(() => {
    const handleSync = () => {
      if (isInternalContinuityUpdate.current) {
        isInternalContinuityUpdate.current = false;
        return;
      }
      const saved = localStorage.getItem('backstage_continuity_looks');
      if (saved) {
        try {
          if (saved === JSON.stringify(continuityLooksRef.current)) return;
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setContinuityLooks(parsed);
          }
        } catch (e) {}
      }
    };
    window.addEventListener('backstage_continuity_updated', handleSync);
    return () => window.removeEventListener('backstage_continuity_updated', handleSync);
  }, []);

  // Continuity Modal & Form States
  const [showAddLookModal, setShowAddLookModal] = useState(false);
  const [editingLookItem, setEditingLookItem] = useState<ContinuityLook | null>(null);
  const [lookTargetName, setLookTargetName] = useState('');
  const [lookTitle, setLookTitle] = useState('');
  const [lookNumber, setLookNumber] = useState<number>(1);
  const [lookFromScene, setLookFromScene] = useState<number>(1);
  const [lookToScene, setLookToScene] = useState<number>(10);
  const [lookDamageLevel, setLookDamageLevel] = useState<string>('None');
  const [lookBloodLevel, setLookBloodLevel] = useState<string>('None');
  const [lookImageUrl, setLookImageUrl] = useState<string>('');
  const [lookDescription, setLookDescription] = useState<string>('');
  const [lookStatus, setLookStatus] = useState<'Verified' | 'Pending Review' | 'Mismatched Warning' | 'Approved'>('Verified');
  const [lookSearchQuery, setLookSearchQuery] = useState('');
  const [lookFilterStatus, setLookFilterStatus] = useState<string>('all');
  const [selectedImageModalUrl, setSelectedImageModalUrl] = useState<string | null>(null);

  // Search & Filter Global Bar
  const [globalSearch, setGlobalSearch] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dynamic States
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>(INITIAL_CREW_MEMBERS);
  const [tasks, setTasks] = useState<AppTask[]>(INITIAL_TASKS as AppTask[]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(INITIAL_BUDGET);
  const [insights, setInsights] = useState<AIProductionInsight[]>(INITIAL_AI_INSIGHTS);

  // Task Editing Modal State
  const [editingTask, setEditingTask] = useState<AppTask | null>(null);

  // Modals & Drawers
  const [showDependencyGraphAsset, setShowDependencyGraphAsset] = useState<string | null>(null);
  const [showAddCrewModal, setShowAddCrewModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [defaultTaskStatus, setDefaultTaskStatus] = useState<'To Do' | 'In Progress' | 'Review' | 'Completed'>('To Do');
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [taskViewMode, setTaskViewMode] = useState<'table' | 'kanban' | 'calendar' | 'timeline'>('kanban');
  const [reportsViewMode, setReportsViewMode] = useState<'table' | 'board' | 'timeline' | 'gallery'>('table');
  const [selectedReportDept, setSelectedReportDept] = useState<string>('art');

  // Custom states for interactive scenes, assets, and budget features
  const [assignedScenes, setAssignedScenes] = useState<Record<string, string[]>>({
    direction: ['Scene 12', 'Scene 14', 'Scene 27', 'Scene 18', 'Scene 22'],
    production: ['Scene 12', 'Scene 14', 'Scene 27', 'Scene 18', 'Scene 22'],
    camera: ['Scene 12', 'Scene 14', 'Scene 27', 'Scene 18', 'Scene 22'],
    art: ['Scene 14'],
    costume: ['Scene 12', 'Scene 27'],
    vfx: ['Scene 22'],
  });

  const [customAssets, setCustomAssets] = useState<DepartmentAsset[]>([]);
  const [deletedAssetNames, setDeletedAssetNames] = useState<string[]>([]);

  // Asset Form fields
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetCategory, setNewAssetCategory] = useState('');
  const [newAssetQty, setNewAssetQty] = useState<number>(1);
  const [newAssetStatus, setNewAssetStatus] = useState<'In Stock' | 'On Order' | 'In Use' | 'Maintenance' | 'Missing'>('In Stock');
  const [newAssetCondition, setNewAssetCondition] = useState<'Mint' | 'Good' | 'Worn' | 'Damaged'>('Good');
  const [newAssetLocation, setNewAssetLocation] = useState('');

  // Budget Form fields
  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetItem, setNewBudgetItem] = useState('');
  const [newBudgetEstimated, setNewBudgetEstimated] = useState<number>(0);
  const [newBudgetActual, setNewBudgetActual] = useState<number>(0);
  const [newBudgetStatus, setNewBudgetStatus] = useState<'Approved' | 'Pending' | 'Over Budget' | 'Draft'>('Approved');
  const [allocatedBudgets, setAllocatedBudgets] = useState<Record<string, number>>({
    direction: 500000,
    production: 1500000,
    camera: 1000000,
    art: 1200000,
    costume: 400000,
    makeup: 150000,
    props: 200000,
    lighting: 300000,
    grip: 250000,
    vfx: 800000,
    sound: 200000,
  });

  const [scenesFilter, setScenesFilter] = useState<'all' | 'assigned'>('all');

  // Templates View States
  const [templatesList, setTemplatesList] = useState<ProductionTemplateItem[]>(INITIAL_PRODUCTION_TEMPLATES);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('All');
  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [templateDeptFilter, setTemplateDeptFilter] = useState<string>('all');
  
  // Active Fill Template Modal
  const [activeModalTemplate, setActiveModalTemplate] = useState<ProductionTemplateItem | null>(null);
  const [activeModalChecklists, setActiveModalChecklists] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [activeModalFields, setActiveModalFields] = useState<Record<string, string>>({});
  const [newChecklistText, setNewChecklistText] = useState('');
  const [templateInspectorName, setTemplateInspectorName] = useState('');
  const [templateSceneRef, setTemplateSceneRef] = useState('');
  
  // Create Custom Template Modal
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  
  // Toast Banner
  const [templateNotification, setTemplateNotification] = useState<string | null>(null);

  // Filtered Templates memo
  const filteredTemplates = useMemo(() => {
    return templatesList.filter(tpl => {
      const matchesSearch = !templateSearch || 
        tpl.title.toLowerCase().includes(templateSearch.toLowerCase()) || 
        tpl.desc.toLowerCase().includes(templateSearch.toLowerCase()) ||
        tpl.departmentName.toLowerCase().includes(templateSearch.toLowerCase());
      
      const matchesCategory = templateCategoryFilter === 'All' || tpl.category === templateCategoryFilter;
      const matchesDept = templateDeptFilter === 'all' || tpl.departmentId === templateDeptFilter;

      return matchesSearch && matchesCategory && matchesDept;
    });
  }, [templatesList, templateSearch, templateCategoryFilter, templateDeptFilter]);

  // Effective tasks pool: prefers central allTasks from App.tsx, merged with fallback state
  const effectiveTasks = useMemo(() => {
    if (allTasks && allTasks.length > 0) {
      return allTasks;
    }
    return tasks;
  }, [allTasks, tasks]);

  // Selected Department Meta
  const currentDept = useMemo(() => {
    return ALL_DEPARTMENTS.find(d => d.id === selectedDeptId) || ALL_DEPARTMENTS[0];
  }, [selectedDeptId]);

  // Move task function
  const handleMoveTask = (taskId: string, newStatus: 'To Do' | 'In Progress' | 'Review' | 'Completed') => {
    const existing = effectiveTasks.find(t => t.id === taskId);
    if (existing) {
      const updated: AppTask = {
        ...existing,
        status: newStatus,
        history: [
          ...(existing.history || []),
          {
            id: `h-${Date.now()}`,
            timestamp: 'Just now',
            author: existing.owner || 'User',
            changeType: 'status_change',
            fieldChanged: 'Status',
            oldValue: existing.status,
            newValue: newStatus,
            comment: `Status updated to ${newStatus}`
          }
        ]
      };
      if (onUpdateTask) onUpdateTask(updated);
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  // Delete task function
  const handleDeleteTask = (taskId: string) => {
    if (onDeleteTask) onDeleteTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  // Scene Detail Drawer
  const [activeSceneDrawerBeat, setActiveSceneDrawerBeat] = useState<Beat | null>(null);

  // Derived tasks for selected department ensuring every department has active tasks
  const deptTasks = useMemo(() => {
    const filtered = effectiveTasks.filter(t => 
      t.departmentId === selectedDeptId || 
      (t.departmentName && t.departmentName.toLowerCase() === currentDept.name.toLowerCase())
    );
    if (filtered.length > 0) return filtered;

    return [
      { id: `tk-auto-${selectedDeptId}-1`, title: `Screenplay breakdown & requirement analysis for ${currentDept.name}`, departmentId: selectedDeptId, departmentName: currentDept.name, owner: currentDept.hod || 'HOD', priority: 'Critical' as const, deadline: '2026-08-03', status: 'To Do' as const, relatedScene: 'Scene 12', targetView: 'crew' as ViewMode, history: [] },
      { id: `tk-auto-${selectedDeptId}-2`, title: `Coordinate equipment & staffing logistics for EXT Night sequence`, departmentId: selectedDeptId, departmentName: currentDept.name, owner: `Associate (${currentDept.name})`, priority: 'High' as const, deadline: '2026-08-04', status: 'In Progress' as const, relatedScene: 'Scene 14', targetView: 'crew' as ViewMode, history: [] },
      { id: `tk-auto-${selectedDeptId}-3`, title: `Safety & continuity sign-off with Director`, departmentId: selectedDeptId, departmentName: currentDept.name, owner: currentDept.hod || 'HOD', priority: 'Medium' as const, deadline: '2026-08-05', status: 'Review' as const, relatedScene: 'Scene 18', targetView: 'crew' as ViewMode, history: [] },
      { id: `tk-auto-${selectedDeptId}-4`, title: `Pre-production budget allocation & vendor contracts`, departmentId: selectedDeptId, departmentName: currentDept.name, owner: 'Line Producer', priority: 'High' as const, deadline: '2026-08-01', status: 'Completed' as const, targetView: 'crew' as ViewMode, history: [] }
    ];
  }, [effectiveTasks, selectedDeptId, currentDept]);

  // Derived Scenes related to current department
  const safeArray = (arr: any) => (Array.isArray(arr) ? arr : []);

  const deptScenes = useMemo(() => {
    if (!beats || !Array.isArray(beats)) return [];
    return beats.map((b, idx) => {
      const sceneNum = b?.sceneNumber || `SC ${idx + 1}`;
      const prefix = b?.slug?.prefix || 'INT.';
      const locationName = b?.slug?.location || 'LOCATION';
      const timeName = b?.slug?.time || 'DAY';
      const location = `${prefix} ${locationName} - ${timeName}`;
      
      // Auto match breakdown items for current dept
      let relatedAssets: string[] = [];
      if (b?.breakdown) {
        const getNames = (arr: any) => safeArray(arr).map((i: any) => {
          if (!i) return '';
          if (typeof i === 'string') return i;
          return i.name || '';
        }).filter(Boolean);

        if (selectedDeptId === 'props' || selectedDeptId === 'art') {
          relatedAssets = getNames(b.breakdown.props);
        } else if (selectedDeptId === 'costume') {
          relatedAssets = getNames(b.breakdown.costume);
        } else if (selectedDeptId === 'sound' || selectedDeptId === 'music') {
          relatedAssets = getNames(b.breakdown.sound);
        } else if (selectedDeptId === 'vfx') {
          relatedAssets = getNames(b.breakdown.vfx);
        } else if (selectedDeptId === 'sfx' || selectedDeptId === 'stunts') {
          relatedAssets = getNames(b.breakdown.practical);
        } else {
          relatedAssets = getNames(b.breakdown.cast);
        }
      }

      return {
        beat: b,
        sceneNum,
        location,
        isDay: String(b?.slug?.time || 'DAY').toUpperCase().includes('DAY'),
        pages: '1.2 pgs',
        status: b?.status === 'ready' ? 'Ready' : 'In Prep',
        priority: idx % 3 === 0 ? 'Critical' : 'Standard',
        completion: b?.status === 'ready' ? 100 : 65,
        relatedAssets
      };
    });
  }, [beats, selectedDeptId]);

  // Derived Assets across screenplay breakdown matching department
  const baseDeptAssets = useMemo(() => {
    const assetsList: DepartmentAsset[] = [];
    if (beats && Array.isArray(beats)) {
      beats.forEach((b, idx) => {
        const scNum = b?.sceneNumber || `${idx + 1}`;
        if (!b?.breakdown) return;

        const pushAsset = (item: any, category: string) => {
          if (!item) return;
          const name = typeof item === 'string' ? item : item?.name;
          if (!name || typeof name !== 'string') return;

          const existing = assetsList.find(a => a.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            if (!existing.sceneIds.includes(scNum)) existing.sceneIds.push(scNum);
          } else {
            assetsList.push({
              id: `ast-${assetsList.length + 1}`,
              name,
              category,
              departmentId: selectedDeptId,
              sceneIds: [scNum],
              quantity: 1,
              status: 'In Stock',
              condition: 'Good',
              location: b?.slug?.location || 'Prop Storage A',
              connectedAssets: ['Hero Costume', 'Police Vehicle', 'Safety Rigging'],
              connectedDepartments: ['Camera', 'Stunts', 'Sound', 'Costume']
            });
          }
        };

        if (selectedDeptId === 'props' || selectedDeptId === 'art') {
          safeArray(b.breakdown.props).forEach((p: any) => pushAsset(p, 'Prop'));
        } else if (selectedDeptId === 'costume') {
          safeArray(b.breakdown.costume).forEach((c: any) => pushAsset(c, 'Wardrobe'));
        } else if (selectedDeptId === 'sound') {
          safeArray(b.breakdown.sound).forEach((s: any) => pushAsset(s, 'SFX Track'));
        } else if (selectedDeptId === 'vfx') {
          safeArray(b.breakdown.vfx).forEach((v: any) => pushAsset(v, 'CG Asset'));
        } else {
          safeArray(b.breakdown.practical).forEach((pr: any) => pushAsset(pr, 'Practical Effect'));
        }
      });
    }

    if (assetsList.length === 0) {
      // Default fallback assets if breakdown is empty
      return [
        { id: 'ast-def-1', name: 'Hero Gun (Revolver)', category: 'Hero Prop', departmentId: selectedDeptId, sceneIds: ['12', '18', '27'], quantity: 2, status: 'In Stock', condition: 'Mint', location: 'Armory Lockbox', connectedAssets: ['Leather Holster', 'Blood Pack', 'Muzzle Flash'], connectedDepartments: ['Costume', 'Stunts', 'VFX', 'Sound'] },
        { id: 'ast-def-2', name: 'Vintage Police Cruiser', category: 'Vehicle', departmentId: selectedDeptId, sceneIds: ['14', '22'], quantity: 1, status: 'In Use', condition: 'Good', location: 'Lot B', connectedAssets: ['Police Decals', 'Siren Lightbar'], connectedDepartments: ['Transportation', 'Art', 'Lighting'] },
        { id: 'ast-def-3', name: '35mm Anamorphic Prime Lens', category: 'Lens', departmentId: selectedDeptId, sceneIds: ['12', '14', '18'], quantity: 1, status: 'In Stock', condition: 'Mint', location: 'Camera Truck', connectedAssets: ['Matte Box', 'Follow Focus'], connectedDepartments: ['Camera', 'Lighting'] },
      ];
    }

    return assetsList;
  }, [beats, selectedDeptId]);

  const deptAssets = useMemo(() => {
    const base = baseDeptAssets.filter(a => !deletedAssetNames.includes(a.name.toLowerCase()));
    const custom = customAssets.filter(a => a.departmentId === selectedDeptId && !deletedAssetNames.includes(a.name.toLowerCase()));
    return [...base, ...custom];
  }, [baseDeptAssets, customAssets, selectedDeptId, deletedAssetNames]);

  // Derived Crew Roster ensuring all departments have structured personnel with authentic department roles
  const deptCrew = useMemo(() => {
    const filtered = crewMembers.filter(c => c.departmentId === selectedDeptId);
    if (filtered.length > 0) return filtered;

    const specificRoles = DEPARTMENT_SPECIFIC_ROLES[selectedDeptId] || [
      'Department Head', 'First Assistant', 'Technician', 'Department Assistant'
    ];

    return specificRoles.map((role, idx) => ({
      id: `cr-auto-${selectedDeptId}-${idx}`,
      name: idx === 0 ? (currentDept.hod || 'Department Head') : `${currentDept.name} ${role}`,
      role: role,
      departmentId: selectedDeptId,
      phone: `+91 98400 ${12000 + idx + 1}`,
      email: `${role.toLowerCase().replace(/[^a-z0-9]/g, '')}.${selectedDeptId}@backstage.film`,
      availability: idx === 0 ? 'On Set' as const : 'Available' as const,
      callTime: idx === 0 ? '06:00 AM' : '06:30 AM',
      notes: idx === 0 ? `Lead HOD overseeing ${currentDept.name} operations.` : undefined
    }));
  }, [crewMembers, selectedDeptId, currentDept]);

  // Export Report to Excel
  const handleExportExcel = () => {
    const data = deptScenes.map(s => ({
      'Scene Number': s.sceneNum,
      'Location': s.location,
      'Day/Night': s.isDay ? 'DAY' : 'NIGHT',
      'Script Pages': s.pages,
      'Status': s.status,
      'Priority': s.priority,
      'Completion %': `${s.completion}%`,
      'Department Assets': s.relatedAssets.join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${currentDept.name}_Report`);
    XLSX.writeFile(wb, `Backstage_${currentDept.name}_Report.xlsx`);
  };

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden font-sans select-none ${
      isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#111111] text-[#e5e5e5]'
    }`}>
      
      {/* GLOBAL CREW HEADER BAR */}
      <div className={`h-12 border-b px-4 flex items-center justify-between gap-4 z-20 ${
        isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#161618] border-[#262626] text-white'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 border px-3 py-1 rounded-md text-xs font-bold ${
            isLight ? 'bg-amber-500/10 border-amber-500/30 text-amber-700' : 'bg-[#222224] border-[#333] text-[#f5a623]'
          }`}>
            <Users size={16} />
            <span className="uppercase tracking-wider">CREW PRODUCTION HUB</span>
          </div>
          <span className={`text-xs hidden sm:inline ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>| Screenplay-Driven Department Workspaces & AI Intelligence</span>
        </div>

        {/* Global Search Input & Quick Filters */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative w-full">
            <Search size={14} className={`absolute left-3 top-2.5 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
            <input 
              type="text" 
              placeholder="Search Crew Members, Departments, Props, Assets, Meetings, Reports..." 
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className={`w-full border text-xs pl-9 pr-3 py-1.5 rounded-lg outline-none transition-colors ${
                isLight 
                  ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 shadow-sm' 
                  : 'bg-[#0d0d0f] border-[#2a2a2d] text-white focus:border-[#f5a623]'
              }`}
            />
            {globalSearch && (
              <button onClick={() => setGlobalSearch('')} className={`absolute right-2.5 top-2.5 ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-gray-500 hover:text-white'}`}>
                <X size={12} />
              </button>
            )}
          </div>

          <div className={`hidden lg:flex items-center gap-1.5 border p-1 rounded-lg ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1a1e] border-[#2a2a2d]'
          }`}>
            <select 
              value={filterDept} 
              onChange={(e) => setFilterDept(e.target.value)}
              className={`bg-transparent text-[10px] font-bold outline-none cursor-pointer px-1 ${
                isLight ? 'text-slate-700' : 'text-gray-300'
              }`}
            >
              <option value="all">All Depts</option>
              {(Object.entries(groupedDepartments) as [string, DepartmentMeta[]][]).map(([groupName, depts]) => (
                <optgroup key={groupName} label={groupName} className={isLight ? 'bg-white text-amber-700 font-bold' : 'bg-[#111] text-amber-400 font-bold'}>
                  {depts.map(d => (
                    <option key={d.id} value={d.id} className={isLight ? 'bg-white text-slate-800 font-normal' : 'bg-[#111] text-gray-200 font-normal'}>{d.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportExcel}
            className={`flex items-center gap-1.5 border text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              isLight 
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm' 
                : 'bg-[#222] hover:bg-[#2e2e2e] text-gray-300 border-[#333]'
            }`}
            title="Export Department Data to Excel"
          >
            <FileSpreadsheet size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span className="hidden md:inline">Export Excel</span>
          </button>
          <button 
            onClick={() => window.print()}
            className={`flex items-center gap-1.5 border text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              isLight 
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm' 
                : 'bg-[#222] hover:bg-[#2e2e2e] text-gray-300 border-[#333]'
            }`}
            title="Print Production Report"
          >
            <Printer size={14} className="text-blue-600 dark:text-blue-400" />
            <span className="hidden md:inline">Print</span>
          </button>
        </div>
      </div>

      {/* MAIN BODY LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR NAVIGATION */}
        <div className={`w-56 border-r flex flex-col justify-between shrink-0 overflow-y-auto custom-scrollbar ${
          isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-[#141416] border-[#242426]'
        }`}>
          <div className="p-3 space-y-4">
            
            {/* Primary Modules */}
            <div>
              <div className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 mb-2 ${
                isLight ? 'text-slate-400' : 'text-gray-500'
              }`}>Main Navigation</div>
              <div className="space-y-0.5">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                  { id: 'departments', label: 'Departments', icon: Layers, badge: ALL_DEPARTMENTS.length },
                  { id: 'meetings', label: 'Meetings', icon: Calendar, pulse: true },
                  { id: 'reports', label: 'Reports', icon: FileText },
                  { id: 'contacts', label: 'Contacts', icon: Contact },
                  { id: 'templates', label: 'Templates', icon: BookOpen },
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = activeSidebarItem === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSidebarItem(item.id as any)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        isActive
                          ? isLight
                            ? 'bg-amber-500/10 text-amber-800 border border-amber-300 shadow-sm'
                            : 'bg-[#222226] text-[#f5a623] border border-[#f5a623]/30 shadow-sm'
                          : isLight
                            ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            : 'text-gray-400 hover:text-white hover:bg-[#1a1a1d]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                          isLight ? 'bg-slate-200 text-slate-700' : 'bg-[#2a2a2e] text-gray-300'
                        }`}>{item.badge}</span>
                      )}
                      {item.pulse && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Department Quick List Grouped */}
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 mb-2 flex items-center justify-between">
                <span className={isLight ? 'text-slate-400' : 'text-gray-500'}>Workspaces ({ALL_DEPARTMENTS.length})</span>
                <span className="text-[9px] text-amber-600 font-bold">Grouped</span>
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                {(Object.entries(groupedDepartments) as [string, DepartmentMeta[]][]).map(([groupName, depts]) => {
                  const isCollapsed = collapsedGroups[groupName];
                  const hasSelected = depts.some(d => d.id === selectedDeptId);
                  return (
                    <div key={groupName} className="space-y-1">
                      {/* Group Header Button */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupName)}
                        className={`w-full flex items-center justify-between px-2 py-1 text-[10px] font-mono font-bold uppercase rounded transition-all cursor-pointer ${
                          hasSelected 
                            ? isLight 
                              ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30' 
                            : isLight
                              ? 'text-amber-800 bg-slate-100 hover:bg-slate-200/80'
                              : 'text-amber-400/80 hover:text-amber-300 bg-[#1a1a1e] hover:bg-[#222226]'
                        }`}
                      >
                        <span className="truncate flex items-center gap-1">
                          <ChevronDown size={11} className={`transition-transform duration-200 shrink-0 ${isCollapsed ? '-rotate-90 text-gray-500' : 'text-amber-500'}`} />
                          <span className="truncate">{groupName}</span>
                        </span>
                        <span className={`text-[9px] font-mono px-1 py-0.2 rounded border shrink-0 ${
                          isLight ? 'bg-white text-slate-600 border-slate-300' : 'bg-black/40 text-gray-400 border-[#2a2a2e]'
                        }`}>
                          {depts.length}
                        </span>
                      </button>

                      {/* Group Department Items */}
                      {!isCollapsed && (
                        <div className="pl-1 space-y-0.5">
                          {depts.map(d => {
                            const Icon = d.icon;
                            const isSelected = activeSidebarItem === 'departments' && selectedDeptId === d.id;
                            return (
                              <button
                                key={d.id}
                                onClick={() => {
                                  setSelectedDeptId(d.id);
                                  setActiveSidebarItem('departments');
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                                  isSelected 
                                    ? isLight
                                      ? 'bg-slate-200 text-slate-900 font-bold border-l-2 border-amber-500 shadow-sm'
                                      : 'bg-[#28282d] text-white font-bold border-l-2 border-[#f5a623] shadow-sm' 
                                    : isLight
                                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#18181b]'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Icon size={13} className={d.accentClass} />
                                  <span className="truncate">{d.name}</span>
                                </div>
                                <span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{d.progress}%</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* AI Intelligence Footer Badge */}
          <div className={`p-3 border-t ${
            isLight ? 'border-slate-200 bg-slate-50' : 'border-[#242426] bg-[#0d0d0f]'
          }`}>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-[11px] mb-1">
              <Sparkles size={14} />
              <span>Production AI Active</span>
            </div>
            <p className={`text-[10px] leading-tight ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
              Screenplay sync enabled. {insights.length} active warnings detected.
            </p>
          </div>
        </div>

        {/* RIGHT WORKSPACE AREA */}
        <div className={`flex-1 flex flex-col overflow-hidden ${
          isLight ? 'bg-slate-100/70' : 'bg-[#0f0f11]'
        }`}>
          
          {/* VIEW ROUTER */}

          {/* 1. DASHBOARD VIEW */}
          {activeSidebarItem === 'dashboard' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Dashboard Banner */}
              <div className={`border rounded-2xl p-6 relative overflow-hidden shadow-xl ${
                isLight 
                  ? 'bg-gradient-to-r from-amber-500/10 via-amber-100/40 to-slate-100 border-amber-200 text-slate-900' 
                  : 'bg-gradient-to-r from-[#1c1c22] via-[#16161a] to-[#1a1208] border-[#333] text-white'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 relative">
                  <div>
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-mono text-xs uppercase tracking-widest font-bold mb-1">
                      <Film size={16} />
                      <span>Screenplay Single Source of Truth</span>
                    </div>
                    <h1 className="text-2xl font-black tracking-tight">Film Production Crew Command</h1>
                    <p className={`text-xs mt-1 max-w-2xl leading-relaxed ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                      Real-time department synchronization derived from screenplay breakdown. Automatic meeting agenda generation, asset continuity graph, and department reports.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setShowDependencyGraphAsset('Hero Gun')}
                      className={`flex items-center gap-2 border text-amber-700 dark:text-amber-400 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow ${
                        isLight ? 'bg-white hover:bg-slate-50 border-slate-300' : 'bg-[#26262a] hover:bg-[#333] border-[#444]'
                      }`}
                    >
                      <GitFork size={16} />
                      <span>Dependency Graph</span>
                    </button>

                    <button 
                      onClick={() => setActiveSidebarItem('meetings')}
                      className="flex items-center gap-2 bg-[#f5a623] hover:bg-[#e0951a] text-black text-xs font-black px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(245,166,35,0.3)] cursor-pointer"
                    >
                      <Plus size={16} />
                      <span>New Meeting Workspace</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`border rounded-xl p-4 space-y-2 ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#161618] border-[#262628]'
                }`}>
                  <div className={`flex items-center justify-between text-xs font-bold uppercase ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    <span>Departments</span>
                    <Layers size={16} className="text-blue-500" />
                  </div>
                  <div className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>32 Workspaces</div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} /> 100% Operational
                  </div>
                </div>

                <div className={`border rounded-xl p-4 space-y-2 ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#161618] border-[#262628]'
                }`}>
                  <div className={`flex items-center justify-between text-xs font-bold uppercase ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    <span>Active Crew</span>
                    <Users size={16} className="text-amber-500" />
                  </div>
                  <div className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{crewMembers.length + 128} Members</div>
                  <div className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>18 Call Times Set Today</div>
                </div>

                <div className={`border rounded-xl p-4 space-y-2 ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#161618] border-[#262628]'
                }`}>
                  <div className={`flex items-center justify-between text-xs font-bold uppercase ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    <span>Pending Tasks</span>
                    <CheckCircle2 size={16} className="text-purple-500" />
                  </div>
                  <div className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{tasks.length + 14} Tasks</div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">5 Critical Items</div>
                </div>

                <div className={`border rounded-xl p-4 space-y-2 ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#161618] border-[#262628]'
                }`}>
                  <div className={`flex items-center justify-between text-xs font-bold uppercase ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    <span>Production Scenes</span>
                    <Film size={16} className="text-emerald-500" />
                  </div>
                  <div className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{beats.length} Scenes</div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Synced with Breakdown</div>
                </div>
              </div>

              {/* AI INSIGHTS WARNING CARDS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                    <Sparkles size={18} />
                    <span>AI Production Intelligence & Warning Cards</span>
                  </div>
                  <span className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{insights.length} Detected Warnings</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.map(item => (
                    <div key={item.id} className={`border rounded-xl p-4 space-y-3 hover:border-amber-500/50 transition-colors shadow-sm ${
                      isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#17171a] border-[#2e2e33] text-white'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-lg ${item.severity === 'high' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                            <AlertTriangle size={16} />
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-white leading-tight">{item.title}</h4>
                            <span className="text-[10px] font-mono text-gray-400 uppercase">{item.departmentId.toUpperCase()} DEPT</span>
                          </div>
                        </div>
                        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded font-bold ${item.severity === 'high' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                          {item.severity}
                        </span>
                      </div>

                      <p className={`text-xs leading-relaxed p-2.5 rounded-lg border ${
                        isLight ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-[#111113] text-gray-300 border-[#222]'
                      }`}>
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                          <ArrowRight size={12} /> {item.actionRecommendation}
                        </span>
                        <button 
                          onClick={() => {
                            setSelectedDeptId(item.departmentId);
                            setActiveSidebarItem('departments');
                          }}
                          className={`font-bold underline text-[10px] ${
                            isLight ? 'text-slate-500 hover:text-slate-900' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Open Workspace
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Department Workspaces Grid Grouped */}
              <div className="space-y-6">
                <div className="text-sm font-bold flex items-center justify-between">
                  <span className={isLight ? 'text-slate-900' : 'text-white'}>Department Workspaces ({ALL_DEPARTMENTS.length}) Overview</span>
                  <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Grouped by Film Department Categories</span>
                </div>

                <div className="space-y-6">
                  {(Object.entries(groupedDepartments) as [string, DepartmentMeta[]][]).map(([groupName, depts]) => (
                    <div key={groupName} className="space-y-3">
                      <div className={`flex items-center gap-2 border-b pb-2 ${
                        isLight ? 'border-slate-200' : 'border-[#2a2a2d]'
                      }`}>
                        <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">{groupName}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        }`}>
                          {depts.length} Workspaces
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {depts.map(d => {
                          const Icon = d.icon;
                          return (
                            <div 
                              key={d.id}
                              onClick={() => {
                                setSelectedDeptId(d.id);
                                setActiveSidebarItem('departments');
                              }}
                              className={`border rounded-xl p-3.5 cursor-pointer transition-all group space-y-2.5 shadow-sm ${
                                isLight 
                                  ? 'bg-white border-slate-200 hover:border-amber-400 hover:bg-slate-50/80 text-slate-900' 
                                  : 'bg-[#151518] border-[#252528] hover:border-[#f5a623]/50 hover:bg-[#1a1a1e] text-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 truncate">
                                  <div className={`p-2 rounded-lg ${d.bgClass} ${d.borderClass} border shrink-0`}>
                                    <Icon size={16} className={d.accentClass} />
                                  </div>
                                  <div className="truncate">
                                    <div className={`text-xs font-bold transition-colors truncate ${
                                      isLight ? 'text-slate-900 group-hover:text-amber-600' : 'text-white group-hover:text-[#f5a623]'
                                    }`}>{d.name}</div>
                                    <div className={`text-[10px] truncate ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{d.hod}</div>
                                  </div>
                                </div>
                                <ChevronRight size={16} className={`transition-colors shrink-0 ${
                                  isLight ? 'text-slate-400 group-hover:text-slate-800' : 'text-gray-600 group-hover:text-white'
                                }`} />
                              </div>

                              <div className="space-y-1">
                                <div className={`flex justify-between text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                  <span>Progress</span>
                                  <span>{d.progress}%</span>
                                </div>
                                <div className={`w-full h-1.5 rounded-full overflow-hidden ${
                                  isLight ? 'bg-slate-200' : 'bg-[#252528]'
                                }`}>
                                  <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full" style={{ width: `${d.progress}%` }}></div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* 2. DEPARTMENT PAGE WORKSPACE */}
          {activeSidebarItem === 'departments' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* DEPARTMENT HEADER */}
              <div className={`border-b p-5 space-y-4 shrink-0 ${
                isLight ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-[#161619] border-[#26262a] text-white'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  {/* Title & HOD info */}
                  {(() => {
                    const DeptHeaderIcon = currentDept.icon;
                    return (
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${currentDept.bgClass} ${currentDept.borderClass} border`}>
                          <DeptHeaderIcon size={24} className={currentDept.accentClass} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className={`text-xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{currentDept.name} Department Workspace</h2>
                            <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${currentDept.bgClass} ${currentDept.borderClass} ${currentDept.accentClass}`}>
                              {currentDept.status}
                            </span>
                          </div>
                          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            HOD: <strong className={isLight ? 'text-slate-900' : 'text-white'}>{currentDept.hod}</strong> | Category: <span className="text-amber-600 dark:text-amber-400 font-bold">{currentDept.category}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Header Metrics Strip */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <div className={`border px-3 py-1.5 rounded-xl flex items-center gap-2 ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-[#1f1f23] border-[#2d2d32] text-white'
                    }`}>
                      <Film size={14} className="text-emerald-500" />
                      <span className={`font-mono ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Scenes:</span>
                      <span className="font-bold">{beats.length}</span>
                    </div>

                    <div className={`border px-3 py-1.5 rounded-xl flex items-center gap-2 ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-[#1f1f23] border-[#2d2d32] text-white'
                    }`}>
                      <Package size={14} className="text-amber-500" />
                      <span className={`font-mono ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Assets:</span>
                      <span className="font-bold">{deptAssets.length}</span>
                    </div>

                    <div className={`border px-3 py-1.5 rounded-xl flex items-center gap-2 ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-[#1f1f23] border-[#2d2d32] text-white'
                    }`}>
                      <Users size={14} className="text-purple-500" />
                      <span className={`font-mono ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Crew:</span>
                      <span className="font-bold">{crewMembers.filter(c => c.departmentId === selectedDeptId).length || 6}</span>
                    </div>

                    <div className={`border px-3 py-1.5 rounded-xl flex items-center gap-2 ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-[#1f1f23] border-[#2d2d32] text-white'
                    }`}>
                      <Calendar size={14} className="text-blue-500" />
                      <span className={`font-mono ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Next Sync:</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">Today 04:00 PM</span>
                    </div>
                  </div>

                </div>

                {/* CORE TABS STRIP */}
                <div className={`flex items-center gap-1 border-b pb-1 overflow-x-auto custom-scrollbar ${
                  isLight ? 'border-slate-200' : 'border-[#28282c]'
                }`}>
                  {(() => {
                    const isContinuityEligible = isContinuityApplicableDept(selectedDeptId, currentDept?.name);
                    const effectiveTab = (deptTab === 'continuity' && !isContinuityEligible) ? 'crew' : deptTab;
                    return [
                      { id: 'crew', label: 'Crew Roster', icon: Users },
                      { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
                      { id: 'scenes', label: 'Assigned Scenes', icon: Film },
                      { id: 'assets', label: 'Assets', icon: Package },
                      { id: 'budget', label: 'Budget', icon: IndianRupee },
                      ...(isContinuityEligible ? [{ id: 'continuity', label: 'Continuity & Looks', icon: Layers }] : []),
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = effectiveTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setDeptTab(tab.id as any)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isActive 
                              ? isLight 
                                ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-sm' 
                                : 'bg-[#28282d] text-[#f5a623] border border-[#f5a623]/30 shadow' 
                              : isLight
                                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                : 'text-gray-400 hover:text-white hover:bg-[#1a1a1d]'
                          }`}
                        >
                          <Icon size={14} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* DEPARTMENT TAB CONTENT */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

                {/* 1. CREW TAB */}
                {deptTab === 'crew' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Department Crew Roster & Hierarchy</h3>
                      <button 
                        onClick={() => setShowAddCrewModal(true)}
                        className="bg-[#f5a623] hover:bg-[#e0951a] text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow"
                      >
                        <UserPlus size={14} /> Add Crew Member
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {deptCrew.map(member => (
                        <div key={member.id} className={`border rounded-xl p-4 space-y-3 shadow-sm ${
                          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#161618] border-[#262628] text-white'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-amber-600 dark:text-amber-400 ${
                              isLight ? 'bg-amber-50 border-amber-200' : 'bg-[#2a2a2e] border-[#444]'
                            }`}>
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{member.name}</h4>
                              <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 uppercase font-bold">{member.role}</span>
                            </div>
                          </div>

                          <div className={`text-xs space-y-1 font-mono ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                            <div className="flex items-center gap-2"><Phone size={12} className={isLight ? 'text-slate-400' : 'text-gray-500'} /> {member.phone}</div>
                            <div className="flex items-center gap-2"><Mail size={12} className={isLight ? 'text-slate-400' : 'text-gray-500'} /> {member.email}</div>
                            <div className="flex items-center gap-2"><Clock size={12} className={isLight ? 'text-slate-400' : 'text-gray-500'} /> Call Time: <strong className="text-amber-600 dark:text-amber-400">{member.callTime || '06:30 AM'}</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. TASKS TAB (INTERACTIVE KANBAN & WORKSPACE) */}
                {deptTab === 'tasks' && (
                  <div className="space-y-4">
                    {/* Workspace Top Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#161619] border border-[#26262a] p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-amber-400" />
                          <span>{currentDept.name} Tasks Workspace</span>
                        </h3>
                        <span className="text-xs text-gray-500 font-mono bg-[#222] px-2 py-0.5 rounded-full">
                          {deptTasks.length} total
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* View Switcher */}
                        <div className="flex items-center bg-[#202024] p-1 rounded-lg border border-[#333]">
                          {(['kanban', 'table', 'calendar', 'timeline'] as const).map(mode => (
                            <button
                              key={mode}
                              onClick={() => setTaskViewMode(mode)}
                              className={`px-3 py-1 rounded text-[11px] font-bold uppercase transition-all flex items-center gap-1 ${
                                taskViewMode === mode 
                                  ? 'bg-[#f5a623] text-black shadow' 
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              {mode === 'kanban' && <Grid size={12} />}
                              {mode === 'table' && <List size={12} />}
                              {mode === 'calendar' && <Calendar size={12} />}
                              {mode === 'timeline' && <Clock size={12} />}
                              <span>{mode}</span>
                            </button>
                          ))}
                        </div>

                        <button 
                          onClick={() => {
                            setDefaultTaskStatus('To Do');
                            setShowAddTaskModal(true);
                          }}
                          className="bg-[#f5a623] hover:bg-[#e0951a] text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow"
                        >
                          <Plus size={14} /> New Task
                        </button>
                      </div>
                    </div>

                    {/* KANBAN BOARD VIEW */}
                    {taskViewMode === 'kanban' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                        {[
                          { id: 'To Do', label: 'To Do', accent: 'border-t-blue-500', icon: Clock, badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
                          { id: 'In Progress', label: 'In Progress', accent: 'border-t-amber-500', icon: Play, badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
                          { id: 'Review', label: 'Review', accent: 'border-t-purple-500', icon: AlertCircle, badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
                          { id: 'Completed', label: 'Completed', accent: 'border-t-emerald-500', icon: CheckCircle2, badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
                        ].map(col => {
                          const colTasks = deptTasks.filter(t => t.status === col.id);
                          const ColIcon = col.icon;
                          const isHovered = dragOverCol === col.id;

                          return (
                            <div 
                              key={col.id}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverCol(col.id);
                              }}
                              onDragLeave={() => setDragOverCol(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOverCol(null);
                                const taskId = e.dataTransfer.getData('taskId');
                                if (taskId) {
                                  handleMoveTask(taskId, col.id as any);
                                }
                              }}
                              className={`bg-[#141417] border border-[#26262a] border-t-2 ${col.accent} rounded-2xl p-3 flex flex-col gap-3 min-h-[440px] transition-all ${
                                isHovered ? 'bg-[#1e1e24] ring-2 ring-amber-500/50' : ''
                              }`}
                            >
                              {/* Column Header */}
                              <div className="flex items-center justify-between pb-2 border-b border-[#242428]">
                                <div className="flex items-center gap-2">
                                  <ColIcon size={14} className="text-gray-400" />
                                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">{col.label}</h4>
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${col.badge}`}>
                                    {colTasks.length}
                                  </span>
                                </div>
                                <button 
                                  onClick={() => {
                                    setDefaultTaskStatus(col.id as any);
                                    setShowAddTaskModal(true);
                                  }}
                                  className="text-gray-400 hover:text-amber-400 p-1 rounded hover:bg-[#222] transition-colors"
                                  title={`Add task to ${col.label}`}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>

                              {/* Cards List */}
                              <div className="flex-1 space-y-2.5 overflow-y-auto custom-scrollbar pr-0.5">
                                {colTasks.map(task => (
                                  <div
                                    key={task.id}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('taskId', task.id);
                                    }}
                                    onClick={() => setEditingTask(task as AppTask)}
                                    className="bg-[#1a1a1e] border border-[#2a2a2e] hover:border-amber-500/60 rounded-xl p-3.5 space-y-2.5 cursor-pointer shadow-sm hover:shadow-md transition-all group relative"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <h5 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors leading-snug">
                                        {task.title}
                                      </h5>
                                      <span className={`shrink-0 text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border ${
                                        task.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                        task.priority === 'High' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                        task.priority === 'Medium' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                        'bg-gray-500/10 text-gray-400 border-gray-500/30'
                                      }`}>
                                        {task.priority}
                                      </span>
                                    </div>

                                    {task.relatedScene && (
                                      <div className="inline-flex items-center gap-1 bg-[#242428] text-amber-400 text-[10px] font-mono px-2 py-0.5 rounded">
                                        <Film size={10} />
                                        <span>{task.relatedScene}</span>
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-1 border-t border-[#25252a]">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 rounded-full bg-[#2a2a30] text-amber-400 flex items-center justify-center font-bold text-[9px]">
                                          {task.owner ? task.owner.charAt(0) : 'U'}
                                        </div>
                                        <span className="truncate max-w-[90px]">{task.owner}</span>
                                      </div>

                                      <div className="flex items-center gap-1 text-gray-400">
                                        <Clock size={10} />
                                        <span>{task.deadline}</span>
                                      </div>
                                    </div>

                                    {/* Quick Actions & Column Movement Controls */}
                                    <div className="flex items-center justify-between pt-1 text-[10px] gap-1">
                                      <select 
                                        value={task.status}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          handleMoveTask(task.id, e.target.value as any);
                                        }}
                                        className="bg-[#222226] text-gray-300 text-[10px] font-mono rounded px-1.5 py-0.5 border border-[#333] outline-none cursor-pointer hover:border-amber-500"
                                      >
                                        <option value="To Do">To Do</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Review">Review</option>
                                        <option value="Completed">Completed</option>
                                      </select>

                                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        <button 
                                          onClick={() => setEditingTask(task as AppTask)}
                                          className="text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-[#252528] transition-colors flex items-center gap-1 font-mono text-[10px]"
                                          title="Edit task details"
                                        >
                                          <Edit3 size={12} />
                                          <span>Edit</span>
                                        </button>

                                        <TwoClickDeleteButton 
                                          onDelete={() => handleDeleteTask(task.id)}
                                          iconSize={12}
                                          confirmText="Confirm Delete?"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}

                                {colTasks.length === 0 && (
                                  <div className="border border-dashed border-[#2d2d32] rounded-xl p-4 text-center text-gray-500 text-xs my-auto">
                                    Drop task here or click +
                                  </div>
                                )}
                              </div>

                              <button 
                                onClick={() => {
                                  setDefaultTaskStatus(col.id as any);
                                  setShowAddTaskModal(true);
                                }}
                                className="w-full bg-[#1b1b1f] hover:bg-[#222226] text-gray-400 hover:text-amber-400 text-xs font-semibold py-1.5 rounded-xl border border-[#2a2a2e] transition-colors flex items-center justify-center gap-1"
                              >
                                <Plus size={12} /> Add Task
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* TABLE VIEW FOR TASKS */}
                    {taskViewMode === 'table' && (
                      <div className="bg-[#161618] border border-[#262628] rounded-xl overflow-hidden shadow">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#1f1f22] text-gray-400 uppercase font-mono text-[10px] border-b border-[#2d2d30]">
                            <tr>
                              <th className="p-3">Task Title</th>
                              <th className="p-3">Assignee</th>
                              <th className="p-3">Priority</th>
                              <th className="p-3">Deadline</th>
                              <th className="p-3">Related Scene</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#222225] text-gray-300">
                            {deptTasks.map(t => (
                              <tr key={t.id} className="hover:bg-[#1c1c20] transition-colors cursor-pointer" onClick={() => setEditingTask(t as AppTask)}>
                                <td className="p-3 font-semibold text-white">{t.title}</td>
                                <td className="p-3 font-mono text-gray-300">{t.owner}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    t.priority === 'Critical' ? 'bg-red-500/10 text-red-400' :
                                    t.priority === 'High' ? 'bg-amber-500/10 text-amber-400' :
                                    'bg-blue-500/10 text-blue-400'
                                  }`}>
                                    {t.priority}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-amber-400">{t.deadline}</td>
                                <td className="p-3 font-mono text-gray-400">{t.relatedScene || 'N/A'}</td>
                                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                  <select 
                                    value={t.status}
                                    onChange={(e) => handleMoveTask(t.id, e.target.value as any)}
                                    className="bg-[#222226] text-amber-400 font-bold text-[10px] rounded px-2 py-1 border border-[#333] outline-none cursor-pointer"
                                  >
                                    <option value="To Do">To Do</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Review">Review</option>
                                    <option value="Completed">Completed</option>
                                  </select>
                                </td>
                                <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    onClick={() => setEditingTask(t as AppTask)}
                                    className="text-amber-400 hover:text-amber-300 p-1 rounded mr-1"
                                    title="Edit task"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <TwoClickDeleteButton 
                                    onDelete={() => handleDeleteTask(t.id)}
                                    iconSize={14}
                                    confirmText="Confirm?"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* CALENDAR VIEW FOR TASKS */}
                    {taskViewMode === 'calendar' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {deptTasks.map(t => (
                          <div key={t.id} className="bg-[#161618] border border-[#262628] p-4 rounded-xl space-y-2">
                            <div className="flex justify-between items-center text-xs text-amber-400 font-mono">
                              <span>Deadline: {t.deadline}</span>
                              <span className="bg-[#222] px-2 py-0.5 rounded text-[10px] text-gray-300">{t.status}</span>
                            </div>
                            <h4 className="text-sm font-bold text-white">{t.title}</h4>
                            <p className="text-xs text-gray-400 font-mono">Owner: {t.owner}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TIMELINE VIEW FOR TASKS */}
                    {taskViewMode === 'timeline' && (
                      <div className="bg-[#161618] border border-[#262628] p-4 rounded-xl space-y-3">
                        {deptTasks.map(t => (
                          <div key={t.id} className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-300 font-mono">
                              <span>{t.title} ({t.owner})</span>
                              <span className="text-amber-400">{t.deadline}</span>
                            </div>
                            <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${
                                t.status === 'Completed' ? 'bg-emerald-500 w-full' :
                                t.status === 'In Progress' ? 'bg-amber-500 w-2/3' :
                                t.status === 'Review' ? 'bg-purple-500 w-4/5' :
                                'bg-blue-500 w-1/4'
                              }`}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                )}

                {/* 3. SCENES TAB */}
                {deptTab === 'scenes' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Screenplay Scenes for {currentDept.name}</h3>
                        <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                          Assign scenes to the department to track specialized scheduling and crew prep.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setScenesFilter('all')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            scenesFilter === 'all'
                              ? 'bg-amber-500 text-black shadow-sm'
                              : (isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-[#1e1e21] text-gray-400 hover:text-white')
                          }`}
                        >
                          All Scenes ({beats.length})
                        </button>
                        <button
                          onClick={() => setScenesFilter('assigned')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            scenesFilter === 'assigned'
                              ? 'bg-amber-500 text-black shadow-sm'
                              : (isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-[#1e1e21] text-gray-400 hover:text-white')
                          }`}
                        >
                          Assigned Only ({(assignedScenes[selectedDeptId] || []).length})
                        </button>
                      </div>
                    </div>

                    <div className={`border rounded-xl overflow-hidden shadow ${isLight ? 'bg-white border-slate-200' : 'bg-[#161618] border-[#262628]'}`}>
                      <table className="w-full text-left text-xs">
                        <thead className={`uppercase font-mono text-[10px] border-b ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#1f1f22] border-[#2d2d30] text-gray-400'
                        }`}>
                          <tr>
                            <th className="p-3 text-center w-12">Assign</th>
                            <th className="p-3">Scene #</th>
                            <th className="p-3">INT / EXT Location</th>
                            <th className="p-3">Time</th>
                            <th className="p-3">Pages</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Priority</th>
                            <th className="p-3">Assets</th>
                            <th className="p-3">Continuity Looks</th>
                            <th className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isLight ? 'divide-slate-105 text-slate-700' : 'divide-[#222225] text-gray-300'}`}>
                          {deptScenes
                            .filter(s => {
                              if (scenesFilter === 'assigned') {
                                return (assignedScenes[selectedDeptId] || []).includes(s.sceneNum);
                              }
                              return true;
                            })
                            .map((s, idx) => {
                              const isAssigned = (assignedScenes[selectedDeptId] || []).includes(s.sceneNum);
                              return (
                                <tr key={idx} className={`transition-colors ${
                                  isLight 
                                    ? `hover:bg-slate-50/50 ${isAssigned ? 'bg-blue-50/20' : ''}` 
                                    : `hover:bg-[#1c1c20] ${isAssigned ? 'bg-blue-900/5' : ''}`
                                }`}>
                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isAssigned}
                                      onChange={() => {
                                        setAssignedScenes(prev => {
                                          const currentList = prev[selectedDeptId] || [];
                                          const newList = currentList.includes(s.sceneNum)
                                            ? currentList.filter(id => id !== s.sceneNum)
                                            : [...currentList, s.sceneNum];
                                          return { ...prev, [selectedDeptId]: newList };
                                        });
                                      }}
                                      className="rounded border-gray-350 dark:border-zinc-700 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                                    />
                                  </td>
                                  <td className="p-3 font-mono font-bold text-amber-500">{s.sceneNum}</td>
                                  <td className={`p-3 font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{s.location}</td>
                                  <td className="p-3 font-mono">{s.isDay ? 'DAY' : 'NIGHT'}</td>
                                  <td className="p-3 font-mono text-gray-400">{s.pages}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      s.status === 'Ready' 
                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-550/20' 
                                        : 'bg-amber-500/10 text-amber-500 border-amber-550/20'
                                    }`}>
                                      {s.status}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      s.priority === 'Critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                    }`}>
                                      {s.priority}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex gap-1 flex-wrap">
                                      {s.relatedAssets.slice(0, 2).map((a, i) => (
                                        <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] ${
                                          isLight ? 'bg-slate-100 text-slate-700' : 'bg-[#26262a] text-gray-300'
                                        }`}>
                                          {a}
                                        </span>
                                      ))}
                                      {s.relatedAssets.length > 2 && <span className="text-[10px] text-gray-500">+{s.relatedAssets.length - 2}</span>}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    {(() => {
                                      const sNum = parseInt(s.sceneNum.replace(/\D/g, ''), 10) || 1;
                                      const matching = continuityLooks.filter(l => sNum >= l.fromScene && sNum <= l.toScene);
                                      if (matching.length === 0) {
                                        return <span className="text-[10px] text-gray-500 font-mono italic">No look logged</span>;
                                      }
                                      return (
                                        <div className="flex gap-1 flex-wrap">
                                          {matching.slice(0, 2).map(m => (
                                            <button
                                              key={m.id}
                                              onClick={() => setDeptTab('continuity')}
                                              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer truncate max-w-[130px]"
                                              title={`${m.targetName}: #${m.lookNumber} ${m.title}`}
                                            >
                                              #{m.lookNumber}: {m.title}
                                            </button>
                                          ))}
                                          {matching.length > 2 && (
                                            <span className="text-[10px] text-amber-400 font-mono">+{matching.length - 2}</span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="p-3 text-right">
                                    <button 
                                      onClick={() => setActiveSceneDrawerBeat(s.beat)}
                                      className="text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 font-bold text-xs underline cursor-pointer"
                                    >
                                      Open Detail
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. ASSETS TAB */}
                {deptTab === 'assets' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Department Assets & Equipment Inventory</h3>
                        <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-505' : 'text-gray-400'}`}>
                          Track and manage inventory items allocated to the {currentDept.name} department.
                        </p>
                      </div>
                      <button 
                        onClick={() => setShowDependencyGraphAsset('Hero Gun')}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 border border-dashed ${
                          isLight 
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300' 
                            : 'bg-[#242428] hover:bg-[#333] text-amber-400 border-[#3d3d42]'
                        }`}
                      >
                        <GitFork size={14} /> Open Dependency Graph
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                      {/* Left: Inventory List Table */}
                      <div className={`lg:col-span-2 p-4 rounded-xl border space-y-4 ${
                        isLight ? 'bg-white border-slate-200' : 'bg-[#161618] border-[#262628]'
                      }`}>
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs uppercase font-mono font-bold text-gray-400">Inventory Ledger</h4>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {deptAssets.reduce((acc, curr) => acc + curr.quantity, 0)} Total Units
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className={`uppercase font-mono text-[10px] border-b ${
                              isLight ? 'bg-slate-50 border-slate-200 text-slate-505' : 'bg-[#1f1f22] border-[#2d2d30] text-gray-500'
                            }`}>
                              <tr>
                                <th className="p-2.5">Asset Item</th>
                                <th className="p-2.5">Category</th>
                                <th className="p-2.5 text-center">Qty</th>
                                <th className="p-2.5">Condition</th>
                                <th className="p-2.5">Status</th>
                                <th className="p-2.5">Location</th>
                                <th className="p-2.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className={`divide-y ${isLight ? 'divide-slate-105 text-slate-700' : 'divide-[#222225] text-gray-300'}`}>
                              {deptAssets.length > 0 ? (
                                deptAssets.map((asset) => (
                                  <tr key={asset.id} className={isLight ? 'hover:bg-slate-50/50' : 'hover:bg-[#1a1a1d]'}>
                                    <td className="p-2.5">
                                      <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{asset.name}</div>
                                      {asset.sceneIds && asset.sceneIds.length > 0 && (
                                        <div className="text-[9px] text-gray-500">Scenes: {asset.sceneIds.join(', ')}</div>
                                      )}
                                    </td>
                                    <td className="p-2.5 font-mono text-[10px] uppercase text-amber-500">{asset.category}</td>
                                    <td className="p-2.5 text-center font-bold font-mono">{asset.quantity}</td>
                                    <td className="p-2.5 font-mono">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        asset.condition === 'Mint'
                                          ? 'text-emerald-500'
                                          : asset.condition === 'Good'
                                            ? 'text-blue-500'
                                            : 'text-amber-500'
                                      }`}>
                                        {asset.condition}
                                      </span>
                                    </td>
                                    <td className="p-2.5">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                        asset.status === 'In Stock' || asset.status === 'Ready' as any
                                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                          : asset.status === 'In Use'
                                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                                      }`}>
                                        {asset.status}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-gray-500 font-mono text-[10px]">{asset.location || 'N/A'}</td>
                                    <td className="p-2.5 text-right">
                                      <button
                                        onClick={() => {
                                          setDeletedAssetNames(prev => [...prev, asset.name.toLowerCase()]);
                                        }}
                                        className="text-red-500 hover:text-red-655 transition-colors p-1 rounded-lg"
                                        title="Delete asset"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={7} className="text-center py-8 text-gray-550 italic">
                                    No assets cataloged for this department yet. Log equipment on the right to start.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right: Add Asset Form */}
                      <div className={`p-4 rounded-xl border flex flex-col gap-4 ${
                        isLight ? 'bg-white border-slate-200' : 'bg-[#161618] border-[#262628]'
                      }`}>
                        <h4 className="text-xs uppercase font-mono font-bold text-gray-400">Log New Equipment Asset</h4>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!newAssetName.trim()) return;
                            const newAsset: DepartmentAsset = {
                              id: `ast-cst-${Date.now()}`,
                              name: newAssetName.trim(),
                              category: newAssetCategory.trim() || 'General',
                              departmentId: selectedDeptId,
                              sceneIds: [],
                              quantity: newAssetQty,
                              status: newAssetStatus,
                              condition: newAssetCondition,
                              location: newAssetLocation.trim() || 'Storage Block A'
                            };
                            setCustomAssets(prev => [...prev, newAsset]);
                            setNewAssetName('');
                            setNewAssetCategory('');
                            setNewAssetQty(1);
                            setNewAssetStatus('In Stock');
                            setNewAssetCondition('Good');
                            setNewAssetLocation('');
                          }}
                          className="space-y-3.5 text-xs font-mono"
                        >
                          <div className="space-y-1">
                            <label className="block text-[10px] uppercase font-bold text-gray-400">Asset Name / Model</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Arri Alexa Prime Lenses"
                              value={newAssetName}
                              onChange={(e) => setNewAssetName(e.target.value)}
                              className={`w-full rounded px-2.5 py-1.5 outline-none border focus:ring-1 focus:ring-amber-500 ${
                                isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0e0e11] border-[#333] text-white'
                              }`}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] uppercase font-bold text-gray-400">Category / Type</label>
                            <input
                              type="text"
                              placeholder="e.g. Wardrobe, Lens, Set Prop"
                              value={newAssetCategory}
                              onChange={(e) => setNewAssetCategory(e.target.value)}
                              className={`w-full rounded px-2.5 py-1.5 outline-none border focus:ring-1 focus:ring-amber-500 ${
                                isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0e0e11] border-[#333] text-white'
                              }`}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-gray-400">Quantity</label>
                              <input
                                type="number"
                                min={1}
                                required
                                value={newAssetQty}
                                onChange={(e) => setNewAssetQty(parseInt(e.target.value, 10) || 1)}
                                className={`w-full rounded px-2.5 py-1.5 outline-none border focus:ring-1 focus:ring-amber-500 ${
                                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0e0e11] border-[#333] text-white'
                                }`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-gray-400">Condition</label>
                              <select
                                value={newAssetCondition}
                                onChange={(e) => setNewAssetCondition(e.target.value as any)}
                                className={`w-full rounded px-2.5 py-1.5 outline-none border focus:ring-1 focus:ring-amber-500 ${
                                  isLight ? 'bg-slate-550 border-slate-300 text-slate-900 focus:bg-white' : 'bg-[#0e0e11] border-[#333] text-white focus:bg-[#08080a]'
                                }`}
                              >
                                <option value="Mint">Mint</option>
                                <option value="Good">Good</option>
                                <option value="Worn">Worn</option>
                                <option value="Damaged">Damaged</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-gray-400">Status</label>
                              <select
                                value={newAssetStatus}
                                onChange={(e) => setNewAssetStatus(e.target.value as any)}
                                className={`w-full rounded px-2.5 py-1.5 outline-none border focus:ring-1 focus:ring-amber-500 ${
                                  isLight ? 'bg-slate-550 border-slate-300 text-slate-900 focus:bg-white' : 'bg-[#0e0e11] border-[#333] text-white focus:bg-[#08080a]'
                                }`}
                              >
                                <option value="In Stock">In Stock</option>
                                <option value="On Order">On Order</option>
                                <option value="In Use">In Use</option>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Missing">Missing</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] uppercase font-bold text-gray-400">Location</label>
                              <input
                                type="text"
                                placeholder="e.g. Stage 3"
                                value={newAssetLocation}
                                onChange={(e) => setNewAssetLocation(e.target.value)}
                                className={`w-full rounded px-2.5 py-1.5 outline-none border focus:ring-1 focus:ring-amber-500 ${
                                  isLight ? 'bg-slate-550 border-slate-300 text-slate-900 focus:bg-white' : 'bg-[#0e0e11] border-[#333] text-white focus:bg-[#08080a]'
                                }`}
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-[#f5a623] hover:bg-[#e0951a] text-black font-black py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                          >
                            <Plus size={14} />
                            <span>Catalog Asset</span>
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. BUDGET TAB */}
                {deptTab === 'budget' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {(() => {
                      const currentDeptBudgetItems = budgetItems.filter(b => b.departmentId === selectedDeptId);
                      const totalAllocated = allocatedBudgets[selectedDeptId] || 100000;
                      const totalEstimated = currentDeptBudgetItems.reduce((sum, item) => sum + item.estimatedCost, 0);
                      const totalSpent = currentDeptBudgetItems.reduce((sum, item) => sum + item.actualCost, 0);
                      const remaining = totalAllocated - totalSpent;
                      const percentSpent = Math.min(100, totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0);

                      return (
                        <>
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                              <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Department Budget & Expenditure</h3>
                              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-505' : 'text-gray-400'}`}>
                                Allocate capital, log actual spends, and track budget utilization for {currentDept.name} department.
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-bold ${isLight ? 'text-slate-500' : 'text-gray-450'}`}>Adjust Allocation Limit:</span>
                              <div className="flex items-center gap-1.5">
                                <span className={isLight ? 'text-slate-900 font-bold' : 'text-white font-bold'}>₹</span>
                                <input
                                  type="number"
                                  value={totalAllocated}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                    setAllocatedBudgets(prev => ({
                                      ...prev,
                                      [selectedDeptId]: val
                                    }));
                                  }}
                                  className={`w-28 rounded-lg px-2.5 py-1 text-xs outline-none border focus:ring-1 focus:ring-amber-500 font-bold font-mono text-center ${
                                    isLight ? 'bg-white border-slate-300 text-slate-805' : 'bg-[#0e0e11] border-[#333] text-white'
                                  }`}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Budget Summary Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                            <div className={`p-4 rounded-xl border transition-colors ${
                              isLight ? 'bg-white border-slate-200' : 'bg-[#161618] border-[#262628]'
                            }`}>
                              <div className="text-[10px] text-gray-500 uppercase font-bold">Allocated Budget Cap</div>
                              <div className={`text-xl font-black mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>₹{totalAllocated.toLocaleString('en-IN')}</div>
                            </div>
                            <div className={`p-4 rounded-xl border transition-colors ${
                              isLight ? 'bg-white border-slate-200' : 'bg-[#161618] border-[#262628]'
                            }`}>
                              <div className="text-[10px] text-gray-500 uppercase font-bold">Total Spent (Actual)</div>
                              <div className={`text-xl font-black mt-1 ${percentSpent > 90 ? 'text-red-500' : 'text-blue-500'}`}>
                                ₹{totalSpent.toLocaleString('en-IN')}
                              </div>
                            </div>
                            <div className={`p-4 rounded-xl border transition-colors ${
                              isLight ? 'bg-white border-slate-200' : 'bg-[#161618] border-[#262628]'
                            }`}>
                              <div className="text-[10px] text-gray-500 uppercase font-bold">Remaining Capital</div>
                              <div className={`text-xl font-black mt-1 ${remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                ₹{remaining.toLocaleString('en-IN')}
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className={`p-4 rounded-xl border space-y-2 transition-colors ${
                            isLight ? 'bg-white border-slate-200' : 'bg-[#161618] border-[#262628]'
                          }`}>
                            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-gray-405">
                              <span>BUDGET UTILIZATION</span>
                              <span>{percentSpent}% USED</span>
                            </div>
                            <div className={`w-full h-3 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-[#1f1f23]'}`}>
                              <div
                                style={{ width: `${percentSpent}%` }}
                                className={`h-full rounded-full transition-all duration-300 ${
                                  percentSpent > 90 ? 'bg-red-500' : percentSpent > 70 ? 'bg-amber-550' : 'bg-blue-500'
                                }`}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Expense list Table */}
                            <div className={`lg:col-span-2 p-4 rounded-xl border space-y-4 ${
                              isLight ? 'bg-white border-slate-200' : 'bg-[#161618] border-[#262628]'
                            }`}>
                              <h4 className="text-xs uppercase font-mono font-bold text-gray-400">Expense Ledger</h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs font-mono">
                                  <thead className={`border-b ${isLight ? 'border-slate-200 text-slate-400' : 'border-[#2d2d30] text-gray-500'}`}>
                                    <tr>
                                      <th className="pb-2">Expense / Line Item</th>
                                      <th className="pb-2">Category</th>
                                      <th className="pb-2 text-right">Estimated</th>
                                      <th className="pb-2 text-right">Actual Spend</th>
                                      <th className="pb-2 text-center">Status</th>
                                      <th className="pb-2 text-right">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className={`divide-y ${isLight ? 'divide-slate-105 text-slate-700' : 'divide-[#222225] text-gray-300'}`}>
                                    {currentDeptBudgetItems.length > 0 ? (
                                      currentDeptBudgetItems.map((item) => (
                                        <tr key={item.id} className={isLight ? 'hover:bg-slate-50/50' : 'hover:bg-[#1a1a1d]'}>
                                          <td className={`py-2.5 font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.item}</td>
                                          <td className="py-2.5 font-semibold text-amber-500 uppercase text-[10px]">{item.category}</td>
                                          <td className="py-2.5 text-right">₹{item.estimatedCost.toLocaleString('en-IN')}</td>
                                          <td className={`py-2.5 text-right font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>₹{item.actualCost.toLocaleString('en-IN')}</td>
                                          <td className="py-2.5 text-center">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                                              item.status === 'Approved'
                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                : item.status === 'Pending'
                                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                  : 'bg-red-500/10 text-red-500 border-red-500/20'
                                            }`}>
                                              {item.status}
                                            </span>
                                          </td>
                                          <td className="py-2.5 text-right">
                                            <button
                                              onClick={() => {
                                                setBudgetItems(prev => prev.filter(i => i.id !== item.id));
                                              }}
                                              className="text-red-505 hover:text-red-750 transition-colors p-1"
                                              title="Delete transaction"
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={6} className="text-center py-8 text-gray-550 italic">
                                          No expense ledger entries logged. Use the form on the right to log costs.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Add Expense Form */}
                            <div className={`p-4 rounded-xl border flex flex-col gap-4 ${
                              isLight ? 'bg-white border-slate-200' : 'bg-[#161618] border-[#262628]'
                            }`}>
                              <h4 className="text-xs uppercase font-mono font-bold text-gray-400">Log New Expense</h4>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (!newBudgetItem.trim()) return;
                                  const newItem: BudgetItem = {
                                    id: `bg-cst-${Date.now()}`,
                                    departmentId: selectedDeptId,
                                    category: newBudgetCategory.trim() || 'General',
                                    item: newBudgetItem.trim(),
                                    estimatedCost: newBudgetEstimated,
                                    actualCost: newBudgetActual,
                                    status: newBudgetStatus
                                  };
                                  setBudgetItems(prev => [...prev, newItem]);
                                  setNewBudgetItem('');
                                  setNewBudgetCategory('');
                                  setNewBudgetEstimated(0);
                                  setNewBudgetActual(0);
                                  setNewBudgetStatus('Approved');
                                }}
                                className="space-y-3.5 text-xs font-mono"
                              >
                                <div className="space-y-1">
                                  <label className="block text-[10px] uppercase font-bold text-gray-400">Expense Item Description</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. Extra lens shipment premium"
                                    value={newBudgetItem}
                                    onChange={(e) => setNewBudgetItem(e.target.value)}
                                    className={`w-full rounded px-2.5 py-1.5 outline-none border focus:ring-1 focus:ring-amber-500 ${
                                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0e0e11] border-[#333] text-white'
                                    }`}
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[10px] uppercase font-bold text-gray-400">Category</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Equipment, Wardrobe, Permits"
                                    value={newBudgetCategory}
                                    onChange={(e) => setNewBudgetCategory(e.target.value)}
                                    className={`w-full rounded px-2.5 py-1.5 outline-none border focus:ring-1 focus:ring-amber-500 ${
                                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0e0e11] border-[#333] text-white'
                                    }`}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-[10px] uppercase font-bold text-gray-400">Estimated Cost (₹)</label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={newBudgetEstimated}
                                      onChange={(e) => setNewBudgetEstimated(parseInt(e.target.value, 10) || 0)}
                                      className={`w-full rounded px-2.5 py-1.5 outline-none border focus:ring-1 focus:ring-amber-500 ${
                                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0e0e11] border-[#333] text-white'
                                      }`}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[10px] uppercase font-bold text-gray-400">Actual Spend (₹)</label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={newBudgetActual}
                                      onChange={(e) => setNewBudgetActual(parseInt(e.target.value, 10) || 0)}
                                      className={`w-full rounded px-2.5 py-1.5 outline-none border focus:ring-1 focus:ring-amber-500 ${
                                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0e0e11] border-[#333] text-white'
                                      }`}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[10px] uppercase font-bold text-gray-400">Approval Status</label>
                                  <select
                                    value={newBudgetStatus}
                                    onChange={(e) => setNewBudgetStatus(e.target.value as any)}
                                    className={`w-full rounded px-2.5 py-1.5 outline-none border focus:ring-1 focus:ring-amber-500 ${
                                      isLight ? 'bg-slate-550 border-slate-300 text-slate-900 focus:bg-white' : 'bg-[#0e0e11] border-[#333] text-white focus:bg-[#08080a]'
                                    }`}
                                  >
                                    <option value="Approved">Approved</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Over Budget">Over Budget</option>
                                    <option value="Draft">Draft</option>
                                  </select>
                                </div>

                                <button
                                  type="submit"
                                  className="w-full bg-[#f5a623] hover:bg-[#e0951a] text-black font-black py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                                >
                                  <Plus size={14} />
                                  <span>Log Expense</span>
                                </button>
                              </form>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
                {/* 6. CONTINUITY & LOOKS INSPECTOR TAB (Only for Costume, Makeup, Vehicles) */}
                {deptTab === 'continuity' && isContinuityApplicableDept(selectedDeptId, currentDept.name) && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {(() => {
                      // Filter looks for active department
                      const deptLooks = continuityLooks.filter(look => {
                        if (look.dept.toLowerCase() === selectedDeptId.toLowerCase()) return true;
                        if ((selectedDeptId === 'costume' || selectedDeptId === 'wardrobe') && look.dept === 'costume') return true;
                        if ((selectedDeptId === 'makeup' || selectedDeptId === 'hair' || selectedDeptId === 'sfx') && look.dept === 'makeup') return true;
                        if ((selectedDeptId === 'props' || selectedDeptId === 'art' || selectedDeptId === 'set_decoration') && look.dept === 'props') return true;
                        if ((selectedDeptId === 'vehicles' || selectedDeptId === 'transport') && look.dept === 'vehicle') return true;
                        return false;
                      });

                      // Scenes for this department
                      const deptScenes = (beats && beats.length > 0)
                        ? beats.map((b, idx) => ({
                            id: b.id || `scene-${idx + 1}`,
                            sceneNum: b.sceneNumber || String(idx + 1),
                            title: b.title || b.summary || `Scene #${idx + 1}`,
                            location: b.location || 'Location Unspecified',
                            status: 'Scheduled'
                          }))
                        : [
                            { id: 'sc-1', sceneNum: '1', title: 'EXT. RAVINE - NIGHT', location: 'Ravine Trail', status: 'Scheduled' },
                            { id: 'sc-2', sceneNum: '2', title: 'INT. COMMAND TENT - NIGHT', location: 'Base Camp', status: 'In Progress' },
                            { id: 'sc-3', sceneNum: '3', title: 'EXT. FOREST OUTSKIRTS - DAY', location: 'Pine Ridge', status: 'Scheduled' },
                          ];

                      // If no looks exist for this department at all:
                      if (deptLooks.length === 0) {
                        return (
                          <div className={`p-8 rounded-2xl border text-center space-y-4 my-2 ${
                            isLight ? 'bg-amber-500/5 border-amber-500/20 text-slate-800' : 'bg-[#181612] border-amber-500/20 text-white'
                          }`}>
                            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto font-bold">
                              <AlertCircle size={24} />
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-base font-bold text-amber-400">
                                Continuity has not been worked out for {currentDept.name} yet.
                              </h3>
                              <p className={`text-xs max-w-lg mx-auto ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                                No continuity looks or scene breakdowns have been logged for this department. Detailed continuity timelines, outfit variations, and FX damage tracking are managed in the main Continuity workspace.
                              </p>
                            </div>
                            <div className="pt-2">
                              <button
                                onClick={() => {
                                  if (typeof window !== 'undefined') {
                                    window.dispatchEvent(new CustomEvent('backstage_navigate_view', { detail: 'continuity' }));
                                  }
                                }}
                                className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs px-4 py-2 rounded-lg transition-all shadow inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Layers size={14} />
                                <span>Go to Dedicated Continuity Page</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          {/* Top Header */}
                          <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-[#28282c]">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                  {currentDept.name} — Scene Continuity Grid
                                </h3>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {deptLooks.length} Active Look{deptLooks.length > 1 ? 's' : ''} Logged
                                </span>
                              </div>
                              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                Compact scene-by-scene visual grid for rapid glance & continuity verification.
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                if (typeof window !== 'undefined') {
                                  window.dispatchEvent(new CustomEvent('backstage_navigate_view', { detail: 'continuity' }));
                                }
                              }}
                              className="bg-[#242428] hover:bg-[#303036] text-gray-200 border border-[#3d3d42] font-semibold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Layers size={13} className="text-amber-400" />
                              <span>Open Main Continuity Studio</span>
                            </button>
                          </div>

                          {/* Scene-by-Scene Compact Grid of Little Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {deptScenes.map((scene) => {
                              const sceneNumInt = parseInt(scene.sceneNum.replace(/\D/g, ''), 10) || 1;
                              const matchingLooks = deptLooks.filter(l => sceneNumInt >= l.fromScene && sceneNumInt <= l.toScene);

                              return (
                                <div
                                  key={scene.id}
                                  className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition-all hover:border-amber-500/40 hover:shadow-lg ${
                                    isLight ? 'bg-white border-slate-200' : 'bg-[#161618] border-[#262628]'
                                  }`}
                                >
                                  <div>
                                    {/* Card Header */}
                                    <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-[#242428]">
                                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono font-bold text-[10px] border border-amber-500/20">
                                        SC #{scene.sceneNum}
                                      </span>
                                      <span className="text-[9px] font-mono text-gray-400 truncate max-w-[100px]" title={scene.location}>
                                        {scene.location}
                                      </span>
                                    </div>

                                    {/* Scene Title */}
                                    <h4 className={`text-xs font-bold mt-1.5 truncate ${isLight ? 'text-slate-900' : 'text-white'}`} title={scene.title}>
                                      {scene.title}
                                    </h4>

                                    {/* Matching Looks or Placeholder */}
                                    <div className="mt-2 space-y-1.5">
                                      {matchingLooks.length > 0 ? (
                                        matchingLooks.map(look => (
                                          <div
                                            key={look.id}
                                            className={`p-2 rounded-lg border space-y-1 ${
                                              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111114] border-[#252528]'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="text-[10px] font-mono font-bold text-amber-400 truncate">
                                                {look.targetName}
                                              </span>
                                              <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-black/40 text-gray-300 border border-[#333] shrink-0">
                                                Look #{look.lookNumber}
                                              </span>
                                            </div>

                                            <div className={`text-[11px] font-bold line-clamp-1 ${isLight ? 'text-slate-800' : 'text-gray-200'}`}>
                                              {look.title}
                                            </div>

                                            {/* Badges */}
                                            <div className="flex items-center gap-1 flex-wrap text-[8px] font-mono">
                                              {look.damageLevel && look.damageLevel !== 'None' ? (
                                                <span className="px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                                                  ⚡ {look.damageLevel}
                                                </span>
                                              ) : (
                                                <span className="px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                                                  Clean
                                                </span>
                                              )}

                                              {look.bloodLevel && look.bloodLevel !== 'None' && (
                                                <span className="px-1 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                                                  🩸 {look.bloodLevel}
                                                </span>
                                              )}
                                            </div>

                                            {look.imageUrl && (
                                              <div
                                                onClick={() => setSelectedImageModalUrl(look.imageUrl || null)}
                                                className="relative h-16 w-full mt-1.5 rounded overflow-hidden border border-[#2a2a2e] cursor-pointer group bg-black"
                                              >
                                                <img
                                                  src={look.imageUrl}
                                                  alt={look.title}
                                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] font-bold">
                                                  View Photo
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="p-2 rounded-lg border border-dashed border-[#28282c] bg-[#111114]/40 text-amber-500/70 text-[10px] italic flex items-center gap-1.5">
                                          <AlertCircle size={11} className="text-amber-500/60 shrink-0" />
                                          <span>Continuity not worked out</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-[9px] font-mono text-gray-500 pt-1.5 border-t border-[#222226] flex items-center justify-between">
                                    <span>Status: {scene.status}</span>
                                    <span className="text-amber-400 font-bold">
                                      {matchingLooks.length > 0 ? `${matchingLooks.length} Look${matchingLooks.length > 1 ? 's' : ''}` : 'No Looks'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* MODAL: IMAGE LIGHTBOX PREVIEW */}
                    {selectedImageModalUrl && (
                      <div
                        onClick={() => setSelectedImageModalUrl(null)}
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
                      >
                        <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-black">
                          <img
                            src={selectedImageModalUrl}
                            alt="Continuity Reference Photo"
                            className="w-full h-full object-contain max-h-[85vh]"
                          />
                          <button
                            onClick={() => setSelectedImageModalUrl(null)}
                            className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full hover:bg-black"
                          >
                            <X size={20} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* 3. MEETINGS WORKSPACE VIEW */}
          {activeSidebarItem === 'meetings' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-white">Production Meetings & HOD Sync</h1>
                  <p className="text-xs text-gray-400 mt-0.5">Auto-generated agendas derived from screenplay updates</p>
                </div>
                <button className="bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
                  <Plus size={16} /> Schedule New Sync
                </button>
              </div>

              <div className="bg-[#161618] border border-[#262628] rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white">Upcoming Department Meetings</h3>
                <div className="space-y-3">
                  {ALL_DEPARTMENTS.slice(0, 5).map(d => {
                    const DeptItemIcon = d.icon;
                    return (
                      <div key={d.id} className="bg-[#1d1d21] p-4 rounded-xl border border-[#2d2d33] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <DeptItemIcon size={20} className={d.accentClass} />
                          <div>
                            <h4 className="text-xs font-bold text-white">{d.name} Department Sync</h4>
                            <span className="text-[10px] text-gray-400 font-mono">HOD: {d.hod}</span>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-amber-400 font-bold bg-[#26262a] px-3 py-1 rounded-lg">
                          Today 04:30 PM
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 4. REPORTS WORKSPACE VIEW */}
          {activeSidebarItem === 'reports' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-black text-white">Department Generated Reports</h1>
                  <p className="text-xs text-gray-400 mt-0.5">Exportable continuity sheets, lens reports, wardrobe manifests, sound logs</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-[#1a1a1d] border border-[#2d2d32] p-1 rounded-lg">
                    {(['table', 'board', 'timeline', 'gallery'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setReportsViewMode(m)}
                        className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                          reportsViewMode === m ? 'bg-[#f5a623] text-black' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={handleExportExcel}
                    className="bg-[#222] hover:bg-[#2e2e2e] text-emerald-400 border border-[#333] text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <FileSpreadsheet size={14} /> Export CSV/XLSX
                  </button>
                </div>
              </div>

              {/* Department Report Selector */}
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                {ALL_DEPARTMENTS.slice(0, 10).map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedReportDept(d.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                      selectedReportDept === d.id ? 'bg-[#f5a623] text-black border-[#f5a623]' : 'bg-[#161618] text-gray-300 border-[#262628] hover:bg-[#222]'
                    }`}
                  >
                    {d.name} Report
                  </button>
                ))}
              </div>

              {/* Report Content Table */}
              <div className="bg-[#161618] border border-[#262628] rounded-2xl overflow-hidden shadow">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1f1f22] text-gray-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Scene #</th>
                      <th className="p-3">Department Category</th>
                      <th className="p-3">Asset Name</th>
                      <th className="p-3">Requirement</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222225] text-gray-300">
                    {deptAssets.map((ast, idx) => (
                      <tr key={idx} className="hover:bg-[#1c1c20]">
                        <td className="p-3 font-mono font-bold text-amber-400">{ast.sceneIds.join(', ')}</td>
                        <td className="p-3 font-mono uppercase text-gray-400">{ast.category}</td>
                        <td className="p-3 font-semibold text-white">{ast.name}</td>
                        <td className="p-3 font-mono">{ast.location}</td>
                        <td className="p-3">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                            {ast.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. CONTACTS WORKSPACE VIEW */}
          {activeSidebarItem === 'contacts' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-white">Full Crew Roster & Contact Book</h1>
                  <p className="text-xs text-gray-400 mt-0.5">Directory across all 32 departments with call times</p>
                </div>
                <button 
                  onClick={() => setShowAddCrewModal(true)}
                  className="bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                >
                  <UserPlus size={16} /> Add New Crew Member
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {crewMembers.map(member => (
                  <div key={member.id} className="bg-[#161618] border border-[#262628] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#2a2a2e] border border-[#444] flex items-center justify-center font-bold text-amber-400">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{member.name}</h4>
                        <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">{member.role} ({member.departmentId.toUpperCase()})</span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-300 space-y-1 font-mono">
                      <div className="flex items-center gap-2"><Phone size={12} className="text-gray-500" /> {member.phone}</div>
                      <div className="flex items-center gap-2"><Mail size={12} className="text-gray-500" /> {member.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. TEMPLATES WORKSPACE VIEW */}
          {activeSidebarItem === 'templates' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Notification Toast */}
              {templateNotification && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-400 shrink-0" />
                    <span>{templateNotification}</span>
                  </div>
                  <button onClick={() => setTemplateNotification(null)} className="text-gray-400 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Header section */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-black text-white flex items-center gap-2">
                    <BookOpen size={22} className="text-amber-400" />
                    Department Pre-Production Templates
                  </h1>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Standardized film checklists, continuity forms, technical riders & auto-task generators
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowCreateTemplateModal(true)}
                    className="bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Plus size={16} /> Create Custom Template
                  </button>
                </div>
              </div>

              {/* Filters & Search Row */}
              <div className="bg-[#161618] border border-[#262628] rounded-2xl p-4 space-y-3">
                <div className="flex flex-col md:flex-row items-center gap-3">
                  {/* Search input */}
                  <div className="relative flex-1 w-full">
                    <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search templates by title, department, or keywords..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="w-full bg-[#0e0e11] border border-[#333] text-white pl-9 pr-3 py-1.5 rounded-xl text-xs outline-none focus:border-[#f5a623]"
                    />
                  </div>

                  {/* Department Filter Dropdown */}
                  <div className="w-full md:w-56 shrink-0">
                    <select
                      value={templateDeptFilter}
                      onChange={(e) => setTemplateDeptFilter(e.target.value)}
                      className="w-full bg-[#0e0e11] border border-[#333] text-white px-3 py-1.5 rounded-xl text-xs outline-none focus:border-[#f5a623]"
                    >
                      <option value="all">All Departments ({ALL_DEPARTMENTS.length})</option>
                      {ALL_DEPARTMENTS.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.hod})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 text-xs">
                  {['All', 'Camera & Lighting', 'Wardrobe & Art', 'Sound & Audio', 'Logistics & Safety', 'Directing & Continuity', 'Stunts & SFX'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setTemplateCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 border ${
                        templateCategoryFilter === cat 
                          ? 'bg-[#f5a623] text-black border-[#f5a623]' 
                          : 'bg-[#1f1f23] text-gray-400 border-[#2a2a2e] hover:text-white hover:bg-[#25252a]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Templates Cards Grid */}
              {filteredTemplates.length === 0 ? (
                <div className="bg-[#161618] border border-[#262628] rounded-2xl p-12 text-center space-y-3">
                  <BookOpen size={36} className="text-gray-600 mx-auto" />
                  <h3 className="text-sm font-bold text-gray-300">No Pre-Production Templates Found</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Try adjusting your category filter or search terms, or create a custom template for your film department.
                  </p>
                  <button
                    onClick={() => { setTemplateSearch(''); setTemplateCategoryFilter('All'); setTemplateDeptFilter('all'); }}
                    className="text-xs text-amber-400 font-bold underline hover:text-amber-300 pt-2"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map(tpl => {
                    const completedCount = tpl.checklists.filter(c => c.completed).length;
                    const totalCount = tpl.checklists.length;
                    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                    return (
                      <div 
                        key={tpl.id} 
                        className="bg-[#161618] border border-[#262628] p-5 rounded-2xl space-y-4 hover:border-amber-500/50 transition-all flex flex-col justify-between group shadow-lg"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                                <BookOpen size={18} />
                              </div>
                              <div>
                                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold tracking-wider block">
                                  {tpl.category}
                                </span>
                                <span className="bg-[#242428] text-gray-300 border border-[#333] px-1.5 py-0.2 rounded text-[9px] font-mono font-bold">
                                  {tpl.departmentName}
                                </span>
                              </div>
                            </div>

                            {tpl.isCustom && (
                              <TwoClickDeleteButton 
                                onDelete={() => {
                                  setTemplatesList(prev => prev.filter(t => t.id !== tpl.id));
                                  setTemplateNotification(`Deleted custom template: ${tpl.title}`);
                                }}
                                iconSize={13}
                                confirmText="Delete?"
                                title="Delete Custom Template"
                              />
                            )}
                          </div>

                          <div>
                            <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                              {tpl.title}
                            </h3>
                            <p className="text-xs text-gray-400 leading-relaxed mt-1 line-clamp-2">
                              {tpl.desc}
                            </p>
                          </div>

                          {/* Progress bar and metadata */}
                          <div className="space-y-1.5 text-[11px] font-mono text-gray-400 bg-[#101012] p-2.5 rounded-xl border border-[#222]">
                            <div className="flex items-center justify-between">
                              <span>Checklist Progress</span>
                              <span className="text-amber-400 font-bold">{completedCount}/{totalCount} ({percent}%)</span>
                            </div>
                            <div className="w-full bg-[#222] h-1.5 rounded-full overflow-hidden">
                              <div className="bg-[#f5a623] h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
                            </div>
                            <div className="flex items-center justify-between text-[10px] pt-1 text-gray-500">
                              <span>Est: {tpl.estimatedTime}</span>
                              <span>Used: {tpl.usedCount} times</span>
                            </div>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="pt-2 border-t border-[#242428] flex items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              setActiveModalTemplate(tpl);
                              setActiveModalChecklists([...tpl.checklists]);
                              const initialF: Record<string, string> = {};
                              tpl.fields.forEach(f => { initialF[f.id] = f.value; });
                              setActiveModalFields(initialF);
                              setTemplateInspectorName(currentDept.hod || 'Department Lead');
                              setTemplateSceneRef('Scene 12');
                            }}
                            className="flex-1 bg-[#242428] hover:bg-[#2d2d32] text-amber-400 border border-amber-500/20 font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1.5"
                          >
                            <Play size={13} /> Use / Fill Form
                          </button>

                          <button
                            onClick={() => {
                              // Quick convert unchecked checklist items to tasks
                              const unchecked = tpl.checklists.filter(c => !c.completed);
                              if (unchecked.length === 0) {
                                setTemplateNotification(`All items in "${tpl.title}" are already completed!`);
                                return;
                              }
                              const newCreatedTasks: AppTask[] = unchecked.map((item, idx) => ({
                                id: `tk-tpl-${Date.now()}-${idx}`,
                                title: `${tpl.title}: ${item.text}`,
                                departmentId: tpl.departmentId,
                                departmentName: tpl.departmentName,
                                owner: currentDept.hod || 'Department Lead',
                                priority: 'High',
                                deadline: '2026-08-10',
                                status: 'To Do',
                                targetView: 'crew',
                                isRead: false,
                                history: [
                                  {
                                    id: `h-${Date.now()}-${idx}`,
                                    timestamp: 'Just now',
                                    author: 'Template Auto-Generator',
                                    changeType: 'created',
                                    comment: `Generated automatically from template: ${tpl.title}`
                                  }
                                ]
                              }));

                              newCreatedTasks.forEach(t => {
                                if (onAddTask) onAddTask(t);
                              });
                              setTasks(prev => [...newCreatedTasks, ...prev]);

                              // Increment used count
                              setTemplatesList(prev => prev.map(t => t.id === tpl.id ? { ...t, usedCount: t.usedCount + 1, lastUsed: 'Just now' } : t));

                              setTemplateNotification(`Created ${newCreatedTasks.length} active tasks for ${tpl.departmentName}!`);
                            }}
                            className="bg-[#1f1f23] hover:bg-[#28282d] text-gray-300 hover:text-white border border-[#333] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                            title="Instantly generate department tasks from checklist"
                          >
                            <Plus size={13} /> Tasks
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

        </div>
      </div>

      {/* DEPENDENCY GRAPH MODAL */}
      {showDependencyGraphAsset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="bg-[#16161a] border border-[#333] rounded-2xl w-full max-w-3xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#2a2a2e] pb-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <GitFork size={20} />
                <span>Interactive Production Dependency Graph: <strong className="text-white">{showDependencyGraphAsset}</strong></span>
              </div>
              <button onClick={() => setShowDependencyGraphAsset(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#0e0e11] border border-[#222] rounded-xl p-6 space-y-6">
              {/* Central Asset Node */}
              <div className="flex justify-center">
                <div className="bg-amber-500/20 border-2 border-[#f5a623] text-amber-400 px-6 py-3 rounded-2xl text-sm font-black tracking-wide shadow-[0_0_20px_rgba(245,166,35,0.3)]">
                  🎯 {showDependencyGraphAsset} (Hero Prop)
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#222]">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase font-mono">Appears in Scenes:</span>
                  <div className="flex gap-2">
                    <span className="bg-[#222] text-white px-3 py-1 rounded-lg text-xs font-mono font-bold">Scene 12</span>
                    <span className="bg-[#222] text-white px-3 py-1 rounded-lg text-xs font-mono font-bold">Scene 18</span>
                    <span className="bg-[#222] text-white px-3 py-1 rounded-lg text-xs font-mono font-bold">Scene 27</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-purple-400 uppercase font-mono">Connected Production Dependencies:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Hero Leather Jacket (Costume)', 'Leather Holster (Props)', 'Police Cruiser #1 (Transport)', 'Blood Pack (SFX)', '9mm Gunshot SFX (Sound)', 'Muzzle Flash (VFX)', 'Stunt Double Team'].map((item, i) => (
                      <span key={i} className="bg-[#1f1f24] border border-[#333] text-gray-300 px-2.5 py-1 rounded-lg text-xs">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={() => setShowDependencyGraphAsset(null)} 
                className="bg-[#28282d] hover:bg-[#333] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
              >
                Close Dependency Graph
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCENE DETAIL DRAWER */}
      {activeSceneDrawerBeat && (
        <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-[#141417] border-l border-[#333] z-[1000] p-6 overflow-y-auto custom-scrollbar shadow-2xl flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[#28282c] pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-amber-400 uppercase">Scene Detail</span>
                <h2 className="text-lg font-black text-white">{activeSceneDrawerBeat.slug?.prefix || 'INT.'} {activeSceneDrawerBeat.slug?.location || 'LOCATION'} - {activeSceneDrawerBeat.slug?.time || 'DAY'}</h2>
              </div>
              <button onClick={() => setActiveSceneDrawerBeat(null)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-gray-400 uppercase font-mono">Screenplay Body:</span>
              <div 
                className="bg-[#0a0a0c] p-4 rounded-xl text-xs text-gray-300 font-mono leading-relaxed border border-[#222]"
                dangerouslySetInnerHTML={{ __html: activeSceneDrawerBeat.content || 'No screenplay content.' }}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#28282c]">
            <button 
              onClick={() => setActiveSceneDrawerBeat(null)}
              className="w-full bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold text-xs py-2.5 rounded-xl transition-colors"
            >
              Done Reading Scene
            </button>
          </div>
        </div>
      )}

      {/* ADD CREW MEMBER MODAL */}
      {showAddCrewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="bg-[#16161a] border border-[#333] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2a2a2e] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus size={16} className="text-amber-400" /> Add Crew Member
              </h3>
              <button onClick={() => setShowAddCrewModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get('name') as string;
              const role = formData.get('role') as CrewRoleHierarchy;
              const phone = formData.get('phone') as string;
              const email = formData.get('email') as string;
              if (name) {
                setCrewMembers(prev => [...prev, {
                  id: `cr-${Date.now()}`,
                  name,
                  role: role || 'Assistant',
                  departmentId: selectedDeptId,
                  phone: phone || '+91 98400 00000',
                  email: email || 'crew@backstage.film',
                  availability: 'Available',
                  callTime: '06:30 AM'
                }]);
                setShowAddCrewModal(false);
              }
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-mono">Full Name</label>
                <input name="name" required placeholder="e.g. Ramesh Kumar" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]" />
              </div>
              <div>
                <label className="block text-gray-400 mb-1 font-mono">Role / Designation ({currentDept.name})</label>
                <select name="role" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]">
                  {(DEPARTMENT_SPECIFIC_ROLES[selectedDeptId] || []).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="Department Head">Department Head</option>
                  <option value="Chief Assistant">Chief Assistant</option>
                  <option value="Assistant">Assistant</option>
                  <option value="Technician">Technician</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 mb-1 font-mono">Phone</label>
                <input name="phone" placeholder="+91 98400 12345" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]" />
              </div>
              <div>
                <label className="block text-gray-400 mb-1 font-mono">Email</label>
                <input name="email" type="email" placeholder="member@backstage.film" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddCrewModal(false)} className="px-3 py-1.5 bg-[#222] text-gray-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-[#f5a623] text-black font-bold rounded-lg">Save Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TASK MODAL */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="bg-[#16161a] border border-[#333] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2a2a2e] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus size={16} className="text-amber-400" /> New Department Task
              </h3>
              <button onClick={() => setShowAddTaskModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const title = formData.get('title') as string;
              const owner = formData.get('owner') as string;
              const priority = (formData.get('priority') as any) || 'High';
              const deadline = (formData.get('deadline') as string) || '2026-08-10';
              const status = (formData.get('status') as any) || defaultTaskStatus;
              if (title) {
                const newTask: AppTask = {
                  id: `tk-${Date.now()}`,
                  title,
                  departmentId: selectedDeptId,
                  departmentName: currentDept.name,
                  owner: owner || currentDept.hod || 'Department Lead',
                  priority,
                  deadline,
                  status,
                  targetView: 'crew',
                  isRead: true,
                  history: [
                    {
                      id: `h-${Date.now()}`,
                      timestamp: 'Just now',
                      author: owner || 'User',
                      changeType: 'created',
                      comment: `Task created for ${currentDept.name} department`
                    }
                  ]
                };
                if (onAddTask) onAddTask(newTask);
                setTasks(prev => [newTask, ...prev]);
                setShowAddTaskModal(false);
              }
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-mono">Task Title</label>
                <input name="title" required placeholder="e.g. Prepare vintage lenses for night scene" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]" />
              </div>
              <div>
                <label className="block text-gray-400 mb-1 font-mono">Assignee / Owner</label>
                <input name="owner" placeholder="e.g. Tirru ISC" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Initial Status</label>
                  <select name="status" defaultValue={defaultTaskStatus} className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]">
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Priority</label>
                  <select name="priority" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]">
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Deadline</label>
                  <input name="deadline" type="date" className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddTaskModal(false)} className="px-3 py-1.5 bg-[#222] text-gray-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-[#f5a623] text-black font-bold rounded-lg">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TASK DETAILS MODAL */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="bg-[#16161a] border border-[#333] rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="flex items-center justify-between border-b border-[#2a2a2e] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 size={16} className="text-amber-400" /> Edit Department Task
              </h3>
              <button onClick={() => setEditingTask(null)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const title = formData.get('title') as string;
              const departmentId = formData.get('departmentId') as string;
              const owner = formData.get('owner') as string;
              const priority = formData.get('priority') as any;
              const status = formData.get('status') as any;
              const deadline = formData.get('deadline') as string;
              const targetView = (formData.get('targetView') as ViewMode) || 'crew';
              const relatedScene = formData.get('relatedScene') as string;
              const notes = formData.get('notes') as string;
              const comment = formData.get('comment') as string;

              const deptObj = ALL_DEPARTMENTS.find(d => d.id === departmentId);

              const newHistoryItem: TaskModificationHistory = comment ? {
                id: `h-${Date.now()}`,
                timestamp: 'Just now',
                author: owner || 'User',
                changeType: 'comment',
                comment
              } : {
                id: `h-${Date.now()}`,
                timestamp: 'Just now',
                author: owner || 'User',
                changeType: 'edited',
                comment: 'Task details updated via Crew page'
              };

              const updatedTask: AppTask = {
                ...editingTask,
                title,
                departmentId,
                departmentName: deptObj?.name || editingTask.departmentName,
                owner,
                priority,
                status,
                deadline,
                targetView,
                relatedScene,
                notes,
                history: [...(editingTask.history || []), newHistoryItem]
              };

              if (onUpdateTask) {
                onUpdateTask(updatedTask);
              }
              setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
              setEditingTask(null);
            }} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-gray-400 mb-1 font-mono font-bold">Task Title</label>
                <input 
                  name="title" 
                  defaultValue={editingTask.title} 
                  required 
                  className="w-full bg-[#0e0e11] border border-[#333] text-white p-2.5 rounded-lg outline-none focus:border-[#f5a623] font-semibold" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Department</label>
                  <select 
                    name="departmentId" 
                    defaultValue={editingTask.departmentId || selectedDeptId} 
                    className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]"
                  >
                    {ALL_DEPARTMENTS.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.hod})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Assignee / Owner</label>
                  <input 
                    name="owner" 
                    defaultValue={editingTask.owner} 
                    placeholder="e.g. Tirru ISC" 
                    className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Status</label>
                  <select 
                    name="status" 
                    defaultValue={editingTask.status} 
                    className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Priority</label>
                  <select 
                    name="priority" 
                    defaultValue={editingTask.priority} 
                    className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Deadline</label>
                  <input 
                    name="deadline" 
                    type="date" 
                    defaultValue={editingTask.deadline} 
                    className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Related Scene</label>
                  <input 
                    name="relatedScene" 
                    defaultValue={editingTask.relatedScene || ''} 
                    placeholder="e.g. Scene 12" 
                    className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]" 
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Target View</label>
                  <select 
                    name="targetView" 
                    defaultValue={editingTask.targetView || 'crew'} 
                    className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]"
                  >
                    <option value="script">Script View</option>
                    <option value="board">Index Card Board</option>
                    <option value="crew">Crew & Department Page</option>
                    <option value="storyboard">Storyboard</option>
                    <option value="shotlist">Shot List</option>
                    <option value="schedule">Schedule & Call Sheet</option>
                    <option value="breakdown">Breakdown</option>
                    <option value="casting">Casting</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-mono">Instructions / Notes</label>
                <textarea 
                  name="notes" 
                  defaultValue={editingTask.notes || ''} 
                  rows={2} 
                  placeholder="Add detailed task notes or requirements..." 
                  className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]" 
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-mono">Add Change / Activity Comment</label>
                <input 
                  name="comment" 
                  placeholder="e.g. Updated lens requirements per Director request" 
                  className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]" 
                />
              </div>

              {/* Modification History preview */}
              {editingTask.history && editingTask.history.length > 0 && (
                <div className="pt-2 border-t border-[#2a2a2e] space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-gray-400 uppercase">Task Activity History</span>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] font-mono text-gray-400 bg-[#0d0d0f] p-2 rounded-lg border border-[#222]">
                    {editingTask.history.map(h => (
                      <div key={h.id} className="flex items-center justify-between">
                        <span className="text-gray-300">• {h.comment || `${h.fieldChanged}: ${h.newValue}`}</span>
                        <span className="text-gray-500 text-[9px]">{h.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-[#2a2a2e]">
                <TwoClickDeleteButton 
                  onDelete={() => {
                    if (onDeleteTask) onDeleteTask(editingTask.id);
                    setTasks(prev => prev.filter(t => t.id !== editingTask.id));
                    setEditingTask(null);
                  }}
                  showText={true}
                  buttonText="Delete Task"
                  confirmText="Click again to delete"
                  iconSize={13}
                  className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg flex items-center gap-1 font-bold text-xs"
                />

                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingTask(null)} className="px-3 py-1.5 bg-[#222] text-gray-300 rounded-lg">Cancel</button>
                  <button type="submit" className="px-4 py-1.5 bg-[#f5a623] text-black font-bold rounded-lg flex items-center gap-1">
                    <Check size={14} /> Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTERACTIVE USE / FILL TEMPLATE MODAL */}
      {activeModalTemplate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="bg-[#16161a] border border-[#333] rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#2a2a2e] pb-4">
              <div>
                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold tracking-wider">
                  {activeModalTemplate.category} • {activeModalTemplate.departmentName}
                </span>
                <h2 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                  <BookOpen size={18} className="text-amber-400" />
                  {activeModalTemplate.title}
                </h2>
                <p className="text-xs text-gray-400 mt-1">{activeModalTemplate.desc}</p>
              </div>
              <button 
                onClick={() => setActiveModalTemplate(null)} 
                className="p-1 text-gray-400 hover:text-white rounded-lg bg-[#222]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Overall Progress Bar */}
            {(() => {
              const done = activeModalChecklists.filter(c => c.completed).length;
              const total = activeModalChecklists.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div className="bg-[#0e0e11] p-3 rounded-xl border border-[#2a2a2e] space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-gray-300 font-bold">Template Completion Progress</span>
                    <span className="text-amber-400 font-bold">{done} of {total} checked ({pct}%)</span>
                  </div>
                  <div className="w-full bg-[#222] h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-400 h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

            {/* Inspector / Location Meta Inputs */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-mono">Inspector / Person Filling Form</label>
                <input
                  type="text"
                  value={templateInspectorName}
                  onChange={(e) => setTemplateInspectorName(e.target.value)}
                  placeholder="e.g. Tirru ISC"
                  className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1 font-mono">Scene / Location Reference</label>
                <input
                  type="text"
                  value={templateSceneRef}
                  onChange={(e) => setTemplateSceneRef(e.target.value)}
                  placeholder="e.g. Scene 12 / EXT Yard"
                  className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]"
                />
              </div>
            </div>

            {/* Dynamic Template Fields */}
            {activeModalTemplate.fields.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-amber-400 uppercase font-mono tracking-wider">Form Log Specifications</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeModalTemplate.fields.map(f => (
                    <div key={f.id} className="space-y-1 text-xs">
                      <label className="block text-gray-400 font-mono">{f.label}</label>
                      <input
                        type="text"
                        value={activeModalFields[f.id] || ''}
                        onChange={(e) => setActiveModalFields(prev => ({ ...prev, [f.id]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623] font-mono text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Checklist */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-400 uppercase font-mono tracking-wider">Required Checklist Items</h4>
                <span className="text-[10px] text-gray-500 font-mono">Click checkbox to toggle status</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar bg-[#0d0d0f] p-3 rounded-xl border border-[#222]">
                {activeModalChecklists.map((c, idx) => (
                  <div 
                    key={c.id} 
                    onClick={() => {
                      setActiveModalChecklists(prev => prev.map((item, i) => i === idx ? { ...item, completed: !item.completed } : item));
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                      c.completed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-[#18181c] border-[#2b2b30] text-gray-200 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-xs">
                      <input
                        type="checkbox"
                        checked={c.completed}
                        onChange={() => {}} // handled by div onClick
                        className="w-4 h-4 accent-[#f5a623] rounded cursor-pointer"
                      />
                      <span className={c.completed ? 'line-through text-gray-400' : 'font-medium'}>{c.text}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalChecklists(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-gray-500 hover:text-red-400 p-1"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {/* Add new checklist item input */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newChecklistText.trim()) {
                        setActiveModalChecklists(prev => [...prev, { id: `c-${Date.now()}`, text: newChecklistText.trim(), completed: false }]);
                        setNewChecklistText('');
                      }
                    }}
                    placeholder="+ Add custom checklist item and press Enter..."
                    className="flex-1 bg-[#141416] border border-[#333] text-white px-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#f5a623]"
                  />
                  <button
                    onClick={() => {
                      if (newChecklistText.trim()) {
                        setActiveModalChecklists(prev => [...prev, { id: `c-${Date.now()}`, text: newChecklistText.trim(), completed: false }]);
                        setNewChecklistText('');
                      }
                    }}
                    className="bg-[#2a2a2e] hover:bg-[#38383e] text-amber-400 px-3 py-1.5 rounded-lg text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#2a2a2e]">
              <button
                type="button"
                onClick={() => {
                  const unchecked = activeModalChecklists.filter(c => !c.completed);
                  if (unchecked.length === 0) {
                    alert('All checklist items are completed! No new tasks needed.');
                    return;
                  }

                  const newTasksCreated: AppTask[] = unchecked.map((item, idx) => ({
                    id: `tk-tpl-${Date.now()}-${idx}`,
                    title: `[${activeModalTemplate.title}] ${item.text}`,
                    departmentId: activeModalTemplate.departmentId,
                    departmentName: activeModalTemplate.departmentName,
                    owner: templateInspectorName || 'Department Lead',
                    priority: 'High',
                    deadline: '2026-08-10',
                    status: 'To Do',
                    relatedScene: templateSceneRef,
                    targetView: 'crew',
                    isRead: false,
                    history: [
                      {
                        id: `h-${Date.now()}-${idx}`,
                        timestamp: 'Just now',
                        author: templateInspectorName || 'User',
                        changeType: 'created',
                        comment: `Generated from template "${activeModalTemplate.title}" for ${templateSceneRef || 'Department'}`
                      }
                    ]
                  }));

                  newTasksCreated.forEach(t => {
                    if (onAddTask) onAddTask(t);
                  });
                  setTasks(prev => [...newTasksCreated, ...prev]);

                  setTemplateNotification(`Successfully converted ${newTasksCreated.length} unchecked items into active department tasks!`);
                }}
                className="w-full sm:w-auto px-3.5 py-2 bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> Convert Unchecked to Crew Tasks
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="px-3.5 py-2 bg-[#222] hover:bg-[#2d2d2d] text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer size={14} /> Print / Export
                </button>

                <button
                  type="button"
                  onClick={() => {
                    // Update template checklist state and usedCount
                    const updatedTpl: ProductionTemplateItem = {
                      ...activeModalTemplate,
                      checklists: activeModalChecklists,
                      usedCount: activeModalTemplate.usedCount + 1,
                      lastUsed: 'Just now'
                    };

                    setTemplatesList(prev => prev.map(t => t.id === updatedTpl.id ? updatedTpl : t));
                    setActiveModalTemplate(null);
                    setTemplateNotification(`Saved form report & updated template "${updatedTpl.title}"!`);
                  }}
                  className="px-4 py-2 bg-[#f5a623] hover:bg-[#e0951a] text-black font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Check size={14} /> Save Filled Report
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CREATE CUSTOM TEMPLATE MODAL */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-6">
          <div className="bg-[#16161a] border border-[#333] rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="flex items-center justify-between border-b border-[#2a2a2e] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus size={16} className="text-amber-400" /> Create Custom Department Template
              </h3>
              <button onClick={() => setShowCreateTemplateModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const title = formData.get('title') as string;
              const category = formData.get('category') as any;
              const departmentId = formData.get('departmentId') as string;
              const desc = formData.get('desc') as string;
              const estimatedTime = (formData.get('estimatedTime') as string) || '15 mins';
              const checklistRaw = formData.get('checklists') as string;

              const deptObj = ALL_DEPARTMENTS.find(d => d.id === departmentId);

              const parsedChecklists = checklistRaw 
                ? checklistRaw.split('\n').filter(line => line.trim().length > 0).map((line, idx) => ({
                    id: `c-${Date.now()}-${idx}`,
                    text: line.trim(),
                    completed: false
                  }))
                : [
                    { id: `c-1`, text: 'Initial Department Safety & Setup Check', completed: false },
                    { id: `c-2`, text: 'Log Equipment & Tool Inventory', completed: false }
                  ];

              const newTpl: ProductionTemplateItem = {
                id: `tpl-${Date.now()}`,
                title,
                category,
                departmentId,
                departmentName: deptObj?.name || 'Department',
                desc: desc || 'Custom film department pre-production checklist template',
                estimatedTime,
                usedCount: 1,
                lastUsed: 'Just now',
                isCustom: true,
                checklists: parsedChecklists,
                fields: [
                  { id: 'f1', label: 'Inspector Name', value: currentDept.hod || 'Department Lead', placeholder: 'Inspector Name', type: 'text' },
                  { id: 'f2', label: 'Scene Reference', value: 'Scene 12', placeholder: 'Scene #', type: 'text' }
                ]
              };

              setTemplatesList(prev => [newTpl, ...prev]);
              setShowCreateTemplateModal(false);
              setTemplateNotification(`Created custom template: ${newTpl.title}`);
            }} className="space-y-4 text-xs">

              <div>
                <label className="block text-gray-400 mb-1 font-mono font-bold">Template Title</label>
                <input
                  name="title"
                  required
                  placeholder="e.g. Special Drone Safety & Permit Checklist"
                  className="w-full bg-[#0e0e11] border border-[#333] text-white p-2.5 rounded-lg outline-none focus:border-[#f5a623] font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Category</label>
                  <select
                    name="category"
                    defaultValue="Camera & Lighting"
                    className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]"
                  >
                    <option value="Camera & Lighting">Camera & Lighting</option>
                    <option value="Wardrobe & Art">Wardrobe & Art</option>
                    <option value="Sound & Audio">Sound & Audio</option>
                    <option value="Logistics & Safety">Logistics & Safety</option>
                    <option value="Directing & Continuity">Directing & Continuity</option>
                    <option value="Stunts & SFX">Stunts & SFX</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-mono">Department</label>
                  <select
                    name="departmentId"
                    defaultValue={selectedDeptId}
                    className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]"
                  >
                    {ALL_DEPARTMENTS.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.hod})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-mono">Description</label>
                <textarea
                  name="desc"
                  rows={2}
                  placeholder="Short description of what this template is used for..."
                  className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623]"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-mono">
                  Checklist Items <span className="text-gray-500 font-normal">(One item per line)</span>
                </label>
                <textarea
                  name="checklists"
                  rows={4}
                  placeholder={"Inspect all battery levels\nConfirm wireless range\nCheck backup SD cards"}
                  className="w-full bg-[#0e0e11] border border-[#333] text-white p-2 rounded-lg outline-none focus:border-[#f5a623] font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#2a2a2e]">
                <button type="button" onClick={() => setShowCreateTemplateModal(false)} className="px-3 py-1.5 bg-[#222] text-gray-300 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#f5a623] text-black font-bold rounded-lg flex items-center gap-1">
                  <Check size={14} /> Create Template
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CrewView;
