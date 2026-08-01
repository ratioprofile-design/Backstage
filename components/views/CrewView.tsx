import React, { useState, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Beat, BreakdownData } from '../../types';
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
    'Chief Makeup Artist', 'Assistant Makeup Artist', 'Hair Stylist', 'Prosthetic Makeup Artist'
  ],
  hair: [
    'Chief Hair Stylist', 'Assistant Hair Stylist', 'Wig Specialist'
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
  category: 'Key Creative' | 'Technical' | 'Physical Production' | 'Post Production' | 'Publicity & Logistics';
}

export const ALL_DEPARTMENTS: DepartmentMeta[] = [
  { id: 'direction', name: 'Direction', hod: 'Karthik Subbaraj', status: 'Active', progress: 85, color: '#f5a623', accentClass: 'text-amber-400', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/30', icon: Film, category: 'Key Creative' },
  { id: 'production', name: 'Production', hod: 'Santhosh Kumar', status: 'Active', progress: 90, color: '#3b82f6', accentClass: 'text-blue-400', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/30', icon: Shield, category: 'Key Creative' },
  { id: 'camera', name: 'Camera', hod: 'Tirru ISC', status: 'In Progress', progress: 78, color: '#10b981', accentClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/30', icon: Camera, category: 'Technical' },
  { id: 'art', name: 'Art', hod: 'Kumar Gangappan', status: 'In Progress', progress: 70, color: '#ec4899', accentClass: 'text-pink-400', bgClass: 'bg-pink-500/10', borderClass: 'border-pink-500/30', icon: Palette, category: 'Key Creative' },
  { id: 'costume', name: 'Costume', hod: 'Anirudh Singh', status: 'In Progress', progress: 82, color: '#a855f7', accentClass: 'text-purple-400', bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/30', icon: Shirt, category: 'Key Creative' },
  { id: 'makeup', name: 'Makeup', hod: 'Banu M', status: 'Pre-Production', progress: 65, color: '#f43f5e', accentClass: 'text-rose-400', bgClass: 'bg-rose-500/10', borderClass: 'border-rose-500/30', icon: Sparkles, category: 'Key Creative' },
  { id: 'hair', name: 'Hair', hod: 'Stella Marie', status: 'Pre-Production', progress: 60, color: '#fb7185', accentClass: 'text-rose-300', bgClass: 'bg-rose-400/10', borderClass: 'border-rose-400/30', icon: Scissors, category: 'Key Creative' },
  { id: 'sound', name: 'Sound', hod: 'Resul Pookutty', status: 'In Progress', progress: 75, color: '#06b6d4', accentClass: 'text-cyan-400', bgClass: 'bg-cyan-500/10', borderClass: 'border-cyan-500/30', icon: Volume2, category: 'Technical' },
  { id: 'music', name: 'Music', hod: 'Santhosh Narayanan', status: 'Active', progress: 88, color: '#8b5cf6', accentClass: 'text-violet-400', bgClass: 'bg-violet-500/10', borderClass: 'border-violet-500/30', icon: Music, category: 'Key Creative' },
  { id: 'lighting', name: 'Lighting', hod: 'Gaffer Murugan', status: 'In Progress', progress: 72, color: '#eab308', accentClass: 'text-yellow-400', bgClass: 'bg-yellow-500/10', borderClass: 'border-yellow-500/30', icon: Sun, category: 'Technical' },
  { id: 'grip', name: 'Grip', hod: 'Key Grip Selvam', status: 'In Progress', progress: 76, color: '#64748b', accentClass: 'text-slate-300', bgClass: 'bg-slate-500/10', borderClass: 'border-slate-500/30', icon: Anchor, category: 'Technical' },
  { id: 'electric', name: 'Electric', hod: 'Ramu Electrician', status: 'In Progress', progress: 80, color: '#f97316', accentClass: 'text-orange-400', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/30', icon: Zap, category: 'Technical' },
  { id: 'locations', name: 'Locations', hod: 'Kannan Recce', status: 'Ready', progress: 95, color: '#14b8a6', accentClass: 'text-teal-400', bgClass: 'bg-teal-500/10', borderClass: 'border-teal-500/30', icon: MapPin, category: 'Physical Production' },
  { id: 'props', name: 'Props', hod: 'Prop Master Mani', status: 'In Progress', progress: 68, color: '#ef4444', accentClass: 'text-red-400', bgClass: 'bg-red-500/10', borderClass: 'border-red-500/30', icon: Package, category: 'Physical Production' },
  { id: 'set_decoration', name: 'Set Decoration', hod: 'Set Decorator Priya', status: 'In Progress', progress: 74, color: '#d946ef', accentClass: 'text-fuchsia-400', bgClass: 'bg-fuchsia-500/10', borderClass: 'border-fuchsia-500/30', icon: Home, category: 'Physical Production' },
  { id: 'construction', name: 'Construction', hod: 'Master Carpenter Velu', status: 'Active', progress: 62, color: '#b45309', accentClass: 'text-amber-600', bgClass: 'bg-amber-700/10', borderClass: 'border-amber-700/30', icon: Hammer, category: 'Physical Production' },
  { id: 'transportation', name: 'Transportation', hod: 'Fleet Manager Rajan', status: 'Ready', progress: 92, color: '#0284c7', accentClass: 'text-sky-400', bgClass: 'bg-sky-500/10', borderClass: 'border-sky-500/30', icon: Truck, category: 'Physical Production' },
  { id: 'catering', name: 'Catering', hod: 'Chef Annapoorna', status: 'Ready', progress: 98, color: '#84cc16', accentClass: 'text-lime-400', bgClass: 'bg-lime-500/10', borderClass: 'border-lime-500/30', icon: Utensils, category: 'Physical Production' },
  { id: 'stunts', name: 'Stunts', hod: 'Stunt Master Supreme', status: 'In Progress', progress: 84, color: '#dc2626', accentClass: 'text-red-500', bgClass: 'bg-red-600/10', borderClass: 'border-red-600/30', icon: Flame, category: 'Technical' },
  { id: 'action', name: 'Action', hod: 'Action Coordinator Peter', status: 'In Progress', progress: 80, color: '#ea580c', accentClass: 'text-orange-500', bgClass: 'bg-orange-600/10', borderClass: 'border-orange-600/30', icon: Activity, category: 'Technical' },
  { id: 'choreography', name: 'Choreography', hod: 'Dinesh Master', status: 'Pre-Production', progress: 55, color: '#f43f5e', accentClass: 'text-rose-400', bgClass: 'bg-rose-500/10', borderClass: 'border-rose-500/30', icon: Heart, category: 'Key Creative' },
  { id: 'animals', name: 'Animals', hod: 'Animal Handler Captain', status: 'Ready', progress: 90, color: '#15803d', accentClass: 'text-green-500', bgClass: 'bg-green-700/10', borderClass: 'border-green-700/30', icon: ShieldCheck, category: 'Physical Production' },
  { id: 'children', name: 'Children', hod: 'Child Tutor & Guardian Mary', status: 'Ready', progress: 95, color: '#38bdf8', accentClass: 'text-sky-300', bgClass: 'bg-sky-400/10', borderClass: 'border-sky-400/30', icon: Baby, category: 'Physical Production' },
  { id: 'vfx', name: 'VFX', hod: 'VFX Supervisor Srinivas', status: 'In Progress', progress: 68, color: '#6366f1', accentClass: 'text-indigo-400', bgClass: 'bg-indigo-500/10', borderClass: 'border-indigo-500/30', icon: Wand2, category: 'Post Production' },
  { id: 'sfx', name: 'SFX', hod: 'SFX Specialist Explosives', status: 'In Progress', progress: 75, color: '#ef4444', accentClass: 'text-red-400', bgClass: 'bg-red-500/10', borderClass: 'border-red-500/30', icon: Flame, category: 'Technical' },
  { id: 'dit', name: 'DIT', hod: 'DIT Engineer Nithin', status: 'Ready', progress: 90, color: '#0284c7', accentClass: 'text-sky-400', bgClass: 'bg-sky-500/10', borderClass: 'border-sky-500/30', icon: Cpu, category: 'Technical' },
  { id: 'drone', name: 'Drone', hod: 'Drone Pilot SkyCam', status: 'Ready', progress: 88, color: '#06b6d4', accentClass: 'text-cyan-400', bgClass: 'bg-cyan-500/10', borderClass: 'border-cyan-500/30', icon: Radio, category: 'Technical' },
  { id: 'editing', name: 'Editing', hod: 'Editor Vivek Harshan', status: 'Pre-Production', progress: 40, color: '#a855f7', accentClass: 'text-purple-400', bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/30', icon: FilmIcon, category: 'Post Production' },
  { id: 'color', name: 'Color', hod: 'Colorist Redchillies', status: 'Pre-Production', progress: 35, color: '#ec4899', accentClass: 'text-pink-400', bgClass: 'bg-pink-500/10', borderClass: 'border-pink-500/30', icon: Tv, category: 'Post Production' },
  { id: 'publicity', name: 'Publicity', hod: 'PRO Diamond Babu', status: 'Pre-Production', progress: 50, color: '#eab308', accentClass: 'text-yellow-400', bgClass: 'bg-yellow-500/10', borderClass: 'border-yellow-500/30', icon: Megaphone, category: 'Publicity & Logistics' },
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

// --- MAIN CREW VIEW COMPONENT ---

export const CrewView: React.FC = () => {
  const { beats } = useProject();

  // Sidebar & Global State
  const [activeSidebarItem, setActiveSidebarItem] = useState<'dashboard' | 'departments' | 'meetings' | 'reports' | 'contacts' | 'templates'>('departments');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('direction');
  const [deptTab, setDeptTab] = useState<'crew' | 'scenes' | 'assets' | 'tasks' | 'budget'>('crew');

  // Search & Filter Global Bar
  const [globalSearch, setGlobalSearch] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Dynamic States
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>(INITIAL_CREW_MEMBERS);
  const [tasks, setTasks] = useState<DepartmentTask[]>(INITIAL_TASKS);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(INITIAL_BUDGET);
  const [insights, setInsights] = useState<AIProductionInsight[]>(INITIAL_AI_INSIGHTS);

  // Modals & Drawers
  const [showDependencyGraphAsset, setShowDependencyGraphAsset] = useState<string | null>(null);
  const [showAddCrewModal, setShowAddCrewModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [defaultTaskStatus, setDefaultTaskStatus] = useState<'To Do' | 'In Progress' | 'Review' | 'Completed'>('To Do');
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [taskViewMode, setTaskViewMode] = useState<'table' | 'kanban' | 'calendar' | 'timeline'>('kanban');
  const [reportsViewMode, setReportsViewMode] = useState<'table' | 'board' | 'timeline' | 'gallery'>('table');
  const [selectedReportDept, setSelectedReportDept] = useState<string>('art');

  // Move task function
  const handleMoveTask = (taskId: string, newStatus: 'To Do' | 'In Progress' | 'Review' | 'Completed') => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  // Delete task function
  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  // Scene Detail Drawer
  const [activeSceneDrawerBeat, setActiveSceneDrawerBeat] = useState<Beat | null>(null);

  // Selected Department Meta
  const currentDept = useMemo(() => {
    return ALL_DEPARTMENTS.find(d => d.id === selectedDeptId) || ALL_DEPARTMENTS[0];
  }, [selectedDeptId]);

  // Derived tasks for selected department ensuring every department has active tasks in Kanban
  const deptTasks = useMemo(() => {
    const filtered = tasks.filter(t => t.departmentId === selectedDeptId);
    if (filtered.length > 0) return filtered;

    return [
      { id: `tk-auto-${selectedDeptId}-1`, title: `Screenplay breakdown & requirement analysis for ${currentDept.name}`, departmentId: selectedDeptId, owner: currentDept.hod || 'HOD', priority: 'Critical' as const, deadline: '2026-08-03', status: 'To Do' as const, relatedScene: 'Scene 12' },
      { id: `tk-auto-${selectedDeptId}-2`, title: `Coordinate equipment & staffing logistics for EXT Night sequence`, departmentId: selectedDeptId, owner: `Associate (${currentDept.name})`, priority: 'High' as const, deadline: '2026-08-04', status: 'In Progress' as const, relatedScene: 'Scene 14' },
      { id: `tk-auto-${selectedDeptId}-3`, title: `Safety & continuity sign-off with Director`, departmentId: selectedDeptId, owner: currentDept.hod || 'HOD', priority: 'Medium' as const, deadline: '2026-08-05', status: 'Review' as const, relatedScene: 'Scene 18' },
      { id: `tk-auto-${selectedDeptId}-4`, title: `Pre-production budget allocation & vendor contracts`, departmentId: selectedDeptId, owner: 'Line Producer', priority: 'High' as const, deadline: '2026-08-01', status: 'Completed' as const }
    ];
  }, [tasks, selectedDeptId, currentDept]);

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
  const deptAssets = useMemo(() => {
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
    <div className="w-full h-full bg-[#111111] text-[#e5e5e5] flex flex-col overflow-hidden font-sans select-none">
      
      {/* GLOBAL CREW HEADER BAR */}
      <div className="h-12 bg-[#161618] border-b border-[#262626] px-4 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#222224] border border-[#333] px-3 py-1 rounded-md text-xs font-bold text-[#f5a623]">
            <Users size={16} />
            <span className="uppercase tracking-wider">CREW PRODUCTION HUB</span>
          </div>
          <span className="text-xs text-gray-500 hidden sm:inline">| Screenplay-Driven Department Workspaces & AI Intelligence</span>
        </div>

        {/* Global Search Input & Quick Filters */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search Crew Members, Departments, Props, Assets, Meetings, Reports..." 
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full bg-[#0d0d0f] border border-[#2a2a2d] text-xs text-white pl-9 pr-3 py-1.5 rounded-lg outline-none focus:border-[#f5a623] transition-colors"
            />
            {globalSearch && (
              <button onClick={() => setGlobalSearch('')} className="absolute right-2.5 top-2.5 text-gray-500 hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-1.5 bg-[#1a1a1e] border border-[#2a2a2d] p-1 rounded-lg">
            <select 
              value={filterDept} 
              onChange={(e) => setFilterDept(e.target.value)}
              className="bg-transparent text-[10px] font-bold text-gray-300 outline-none cursor-pointer px-1"
            >
              <option value="all">All Depts</option>
              {ALL_DEPARTMENTS.map(d => (
                <option key={d.id} value={d.id} className="bg-[#111]">{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-[#222] hover:bg-[#2e2e2e] text-gray-300 hover:text-white border border-[#333] text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            title="Export Department Data to Excel"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span className="hidden md:inline">Export Excel</span>
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-[#222] hover:bg-[#2e2e2e] text-gray-300 hover:text-white border border-[#333] text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            title="Print Production Report"
          >
            <Printer size={14} className="text-blue-400" />
            <span className="hidden md:inline">Print</span>
          </button>
        </div>
      </div>

      {/* MAIN BODY LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR NAVIGATION */}
        <div className="w-56 bg-[#141416] border-r border-[#242426] flex flex-col justify-between shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-3 space-y-4">
            
            {/* Primary Modules */}
            <div>
              <div className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest px-2 mb-2">Main Navigation</div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveSidebarItem('dashboard')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeSidebarItem === 'dashboard' 
                      ? 'bg-[#222226] text-[#f5a623] border border-[#f5a623]/30 shadow-sm' 
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1d]'
                  }`}
                >
                  <LayoutDashboard size={16} />
                  <span>Dashboard</span>
                </button>

                <button
                  onClick={() => setActiveSidebarItem('departments')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeSidebarItem === 'departments' 
                      ? 'bg-[#222226] text-[#f5a623] border border-[#f5a623]/30 shadow-sm' 
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1d]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers size={16} />
                    <span>Departments</span>
                  </div>
                  <span className="text-[9px] font-mono bg-[#2a2a2e] text-gray-300 px-1.5 py-0.5 rounded-full">{ALL_DEPARTMENTS.length}</span>
                </button>

                <button
                  onClick={() => setActiveSidebarItem('meetings')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeSidebarItem === 'meetings' 
                      ? 'bg-[#222226] text-[#f5a623] border border-[#f5a623]/30 shadow-sm' 
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1d]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar size={16} />
                    <span>Meetings</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                </button>

                <button
                  onClick={() => setActiveSidebarItem('reports')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeSidebarItem === 'reports' 
                      ? 'bg-[#222226] text-[#f5a623] border border-[#f5a623]/30 shadow-sm' 
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1d]'
                  }`}
                >
                  <FileText size={16} />
                  <span>Reports</span>
                </button>

                <button
                  onClick={() => setActiveSidebarItem('contacts')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeSidebarItem === 'contacts' 
                      ? 'bg-[#222226] text-[#f5a623] border border-[#f5a623]/30 shadow-sm' 
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1d]'
                  }`}
                >
                  <Contact size={16} />
                  <span>Contacts</span>
                </button>

                <button
                  onClick={() => setActiveSidebarItem('templates')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeSidebarItem === 'templates' 
                      ? 'bg-[#222226] text-[#f5a623] border border-[#f5a623]/30 shadow-sm' 
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1d]'
                  }`}
                >
                  <BookOpen size={16} />
                  <span>Templates</span>
                </button>
              </div>
            </div>

            {/* Department Quick List */}
            <div>
              <div className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest px-2 mb-2 flex items-center justify-between">
                <span>32 Workspaces</span>
                <span className="text-[9px] text-[#f5a623]">Active</span>
              </div>
              <div className="space-y-0.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {ALL_DEPARTMENTS.map(d => {
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
                          ? 'bg-[#28282d] text-white font-bold border-l-2 border-[#f5a623]' 
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#18181b]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Icon size={14} className={d.accentClass} />
                        <span className="truncate">{d.name}</span>
                      </div>
                      <span className="text-[9px] font-mono text-gray-500">{d.progress}%</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* AI Intelligence Footer Badge */}
          <div className="p-3 border-t border-[#242426] bg-[#0d0d0f]">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px] mb-1">
              <Sparkles size={14} />
              <span>Production AI Active</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight">
              Screenplay sync enabled. {insights.length} active warnings detected.
            </p>
          </div>
        </div>

        {/* RIGHT WORKSPACE AREA */}
        <div className="flex-1 bg-[#0f0f11] flex flex-col overflow-hidden">
          
          {/* VIEW ROUTER */}

          {/* 1. DASHBOARD VIEW */}
          {activeSidebarItem === 'dashboard' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Dashboard Banner */}
              <div className="bg-gradient-to-r from-[#1c1c22] via-[#16161a] to-[#1a1208] border border-[#333] rounded-2xl p-6 relative overflow-hidden shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 relative">
                  <div>
                    <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-widest font-bold mb-1">
                      <Film size={16} />
                      <span>Screenplay Single Source of Truth</span>
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Film Production Crew Command</h1>
                    <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
                      Real-time department synchronization derived from screenplay breakdown. Automatic meeting agenda generation, asset continuity graph, and department reports.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setShowDependencyGraphAsset('Hero Gun')}
                      className="flex items-center gap-2 bg-[#26262a] hover:bg-[#333] border border-[#444] text-amber-400 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow"
                    >
                      <GitFork size={16} />
                      <span>Dependency Graph</span>
                    </button>

                    <button 
                      onClick={() => setActiveSidebarItem('meetings')}
                      className="flex items-center gap-2 bg-[#f5a623] hover:bg-[#e0951a] text-black text-xs font-black px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(245,166,35,0.3)]"
                    >
                      <Plus size={16} />
                      <span>New Meeting Workspace</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#161618] border border-[#262628] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase">
                    <span>Departments</span>
                    <Layers size={16} className="text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-white">32 Workspaces</div>
                  <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} /> 100% Operational
                  </div>
                </div>

                <div className="bg-[#161618] border border-[#262628] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase">
                    <span>Active Crew</span>
                    <Users size={16} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-white">{crewMembers.length + 128} Members</div>
                  <div className="text-[10px] text-gray-400 font-mono">18 Call Times Set Today</div>
                </div>

                <div className="bg-[#161618] border border-[#262628] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase">
                    <span>Pending Tasks</span>
                    <CheckCircle2 size={16} className="text-purple-400" />
                  </div>
                  <div className="text-2xl font-black text-white">{tasks.length + 14} Tasks</div>
                  <div className="text-[10px] text-amber-400 font-bold">5 Critical Items</div>
                </div>

                <div className="bg-[#161618] border border-[#262628] rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase">
                    <span>Production Scenes</span>
                    <Film size={16} className="text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white">{beats.length} Scenes</div>
                  <div className="text-[10px] text-emerald-400 font-bold">Synced with Breakdown</div>
                </div>
              </div>

              {/* AI INSIGHTS WARNING CARDS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Sparkles size={18} />
                    <span>AI Production Intelligence & Warning Cards</span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">{insights.length} Detected Warnings</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.map(item => (
                    <div key={item.id} className="bg-[#17171a] border border-[#2e2e33] rounded-xl p-4 space-y-3 hover:border-amber-500/40 transition-colors">
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

                      <p className="text-xs text-gray-300 leading-relaxed bg-[#111113] p-2.5 rounded-lg border border-[#222]">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <ArrowRight size={12} /> {item.actionRecommendation}
                        </span>
                        <button 
                          onClick={() => {
                            setSelectedDeptId(item.departmentId);
                            setActiveSidebarItem('departments');
                          }}
                          className="text-gray-400 hover:text-white font-bold underline text-[10px]"
                        >
                          Open Workspace
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Department Workspaces Grid */}
              <div className="space-y-3">
                <div className="text-sm font-bold text-white flex items-center justify-between">
                  <span>32 Department Workspaces Overview</span>
                  <span className="text-xs text-gray-500">Click any card to launch workspace</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {ALL_DEPARTMENTS.map(d => {
                    const Icon = d.icon;
                    return (
                      <div 
                        key={d.id}
                        onClick={() => {
                          setSelectedDeptId(d.id);
                          setActiveSidebarItem('departments');
                        }}
                        className="bg-[#151518] border border-[#252528] hover:border-[#f5a623]/50 rounded-xl p-3.5 cursor-pointer transition-all hover:bg-[#1a1a1e] group space-y-2.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${d.bgClass} ${d.borderClass} border`}>
                              <Icon size={16} className={d.accentClass} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white group-hover:text-[#f5a623] transition-colors">{d.name}</div>
                              <div className="text-[10px] text-gray-500">{d.hod}</div>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                            <span>Progress</span>
                            <span>{d.progress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#252528] rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full" style={{ width: `${d.progress}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* 2. DEPARTMENT PAGE WORKSPACE */}
          {activeSidebarItem === 'departments' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* DEPARTMENT HEADER */}
              <div className="bg-[#161619] border-b border-[#26262a] p-5 space-y-4 shrink-0">
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
                            <h2 className="text-xl font-black text-white">{currentDept.name} Department Workspace</h2>
                            <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${currentDept.bgClass} ${currentDept.borderClass} ${currentDept.accentClass}`}>
                              {currentDept.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            HOD: <strong className="text-white">{currentDept.hod}</strong> | Category: <span className="text-amber-400">{currentDept.category}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Header Metrics Strip */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <div className="bg-[#1f1f23] border border-[#2d2d32] px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <Film size={14} className="text-emerald-400" />
                      <span className="text-gray-400 font-mono">Scenes:</span>
                      <span className="font-bold text-white">{beats.length}</span>
                    </div>

                    <div className="bg-[#1f1f23] border border-[#2d2d32] px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <Package size={14} className="text-amber-400" />
                      <span className="text-gray-400 font-mono">Assets:</span>
                      <span className="font-bold text-white">{deptAssets.length}</span>
                    </div>

                    <div className="bg-[#1f1f23] border border-[#2d2d32] px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <Users size={14} className="text-purple-400" />
                      <span className="text-gray-400 font-mono">Crew:</span>
                      <span className="font-bold text-white">{crewMembers.filter(c => c.departmentId === selectedDeptId).length || 6}</span>
                    </div>

                    <div className="bg-[#1f1f23] border border-[#2d2d32] px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <Calendar size={14} className="text-blue-400" />
                      <span className="text-gray-400 font-mono">Next Sync:</span>
                      <span className="font-bold text-amber-400">Today 04:00 PM</span>
                    </div>
                  </div>

                </div>

                {/* 5 CORE TABS STRIP */}
                <div className="flex items-center gap-1 border-b border-[#28282c] pb-1 overflow-x-auto custom-scrollbar">
                  {[
                    { id: 'crew', label: 'Crew Roster', icon: Users },
                    { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
                    { id: 'scenes', label: 'Assigned Scenes', icon: Film },
                    { id: 'assets', label: 'Assets', icon: Package },
                    { id: 'budget', label: 'Budget', icon: IndianRupee },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = deptTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setDeptTab(tab.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                          isActive 
                            ? 'bg-[#28282d] text-[#f5a623] border border-[#f5a623]/30 shadow' 
                            : 'text-gray-400 hover:text-white hover:bg-[#1a1a1d]'
                        }`}
                      >
                        <Icon size={14} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DEPARTMENT TAB CONTENT */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

                {/* 1. CREW TAB */}
                {deptTab === 'crew' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Department Crew Roster & Hierarchy</h3>
                      <button 
                        onClick={() => setShowAddCrewModal(true)}
                        className="bg-[#f5a623] hover:bg-[#e0951a] text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <UserPlus size={14} /> Add Crew Member
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {deptCrew.map(member => (
                        <div key={member.id} className="bg-[#161618] border border-[#262628] rounded-xl p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#2a2a2e] border border-[#444] flex items-center justify-center font-bold text-amber-400">
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white">{member.name}</h4>
                              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">{member.role}</span>
                            </div>
                          </div>

                          <div className="text-xs text-gray-300 space-y-1 font-mono">
                            <div className="flex items-center gap-2"><Phone size={12} className="text-gray-500" /> {member.phone}</div>
                            <div className="flex items-center gap-2"><Mail size={12} className="text-gray-500" /> {member.email}</div>
                            <div className="flex items-center gap-2"><Clock size={12} className="text-gray-500" /> Call Time: <strong className="text-amber-400">{member.callTime || '06:30 AM'}</strong></div>
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
                                    className="bg-[#1a1a1e] border border-[#2a2a2e] hover:border-amber-500/40 rounded-xl p-3.5 space-y-2.5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all group"
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
                                        onChange={(e) => handleMoveTask(task.id, e.target.value as any)}
                                        className="bg-[#222226] text-gray-300 text-[10px] font-mono rounded px-1.5 py-0.5 border border-[#333] outline-none cursor-pointer hover:border-amber-500"
                                      >
                                        <option value="To Do">To Do</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Review">Review</option>
                                        <option value="Completed">Completed</option>
                                      </select>

                                      <button 
                                        onClick={() => handleDeleteTask(task.id)}
                                        className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-[#252528] transition-colors"
                                        title="Delete task"
                                      >
                                        <Trash2 size={12} />
                                      </button>
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
                              <tr key={t.id} className="hover:bg-[#1c1c20] transition-colors">
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
                                <td className="p-3">
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
                                <td className="p-3 text-right">
                                  <button 
                                    onClick={() => handleDeleteTask(t.id)}
                                    className="text-gray-500 hover:text-red-400 p-1 rounded"
                                  >
                                    <Trash2 size={14} />
                                  </button>
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
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Screenplay Scenes for {currentDept.name}</h3>
                      <span className="text-xs text-gray-500 font-mono">{beats.length} Total Scenes</span>
                    </div>

                    <div className="bg-[#161618] border border-[#262628] rounded-xl overflow-hidden shadow">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#1f1f22] text-gray-400 uppercase font-mono text-[10px] border-b border-[#2d2d30]">
                          <tr>
                            <th className="p-3">Scene #</th>
                            <th className="p-3">INT / EXT Location</th>
                            <th className="p-3">Time</th>
                            <th className="p-3">Pages</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Priority</th>
                            <th className="p-3">Assets</th>
                            <th className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#222225] text-gray-300">
                          {deptScenes.map((s, idx) => (
                            <tr key={idx} className="hover:bg-[#1c1c20] transition-colors">
                              <td className="p-3 font-mono font-bold text-amber-400">{s.sceneNum}</td>
                              <td className="p-3 font-semibold text-white">{s.location}</td>
                              <td className="p-3 font-mono">{s.isDay ? 'DAY' : 'NIGHT'}</td>
                              <td className="p-3 font-mono text-gray-400">{s.pages}</td>
                              <td className="p-3">
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {s.status}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.priority === 'Critical' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                  {s.priority}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-1 flex-wrap">
                                  {s.relatedAssets.slice(0, 2).map((a, i) => (
                                    <span key={i} className="bg-[#26262a] text-gray-300 px-1.5 py-0.5 rounded text-[10px]">
                                      {a}
                                    </span>
                                  ))}
                                  {s.relatedAssets.length > 2 && <span className="text-[10px] text-gray-500">+{s.relatedAssets.length - 2}</span>}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <button 
                                  onClick={() => setActiveSceneDrawerBeat(s.beat)}
                                  className="text-amber-400 hover:text-amber-300 font-bold text-xs underline"
                                >
                                  Open Detail
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. ASSETS TAB */}
                {deptTab === 'assets' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Department Assets & Screenplay Mapping</h3>
                      <button 
                        onClick={() => setShowDependencyGraphAsset('Hero Gun')}
                        className="bg-[#242428] hover:bg-[#333] text-amber-400 border border-[#3d3d42] text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <GitFork size={14} /> Open Dependency Graph
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {deptAssets.map(ast => (
                        <div key={ast.id} className="bg-[#161618] border border-[#262628] rounded-xl p-4 space-y-3 hover:border-amber-500/40 transition-colors">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-bold text-white">{ast.name}</h4>
                              <span className="text-[10px] font-mono text-amber-400 uppercase">{ast.category}</span>
                            </div>
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded">
                              {ast.status}
                            </span>
                          </div>

                          <div className="text-xs text-gray-400 space-y-1 font-mono">
                            <div>Appears in Scenes: <strong className="text-white">{ast.sceneIds.join(', ')}</strong></div>
                            <div>Location: <span className="text-gray-300">{ast.location}</span></div>
                            <div>Qty: <strong className="text-white">{ast.quantity}</strong> | Condition: <strong className="text-emerald-400">{ast.condition}</strong></div>
                          </div>

                          <button 
                            onClick={() => setShowDependencyGraphAsset(ast.name)}
                            className="w-full bg-[#202024] hover:bg-[#28282d] text-amber-400 text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                          >
                            <GitFork size={12} /> View Production Dependencies
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. BUDGET TAB */}
                {deptTab === 'budget' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white">Department Budget & Expenditure (₹)</h3>
                    <div className="bg-[#161618] border border-[#262628] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#1f1f22] text-gray-400 uppercase font-mono text-[10px]">
                          <tr>
                            <th className="p-3">Category</th>
                            <th className="p-3">Item</th>
                            <th className="p-3">Estimated</th>
                            <th className="p-3">Actual Spend</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#222225] text-gray-300">
                          {budgetItems.map(b => (
                            <tr key={b.id}>
                              <td className="p-3 font-mono text-amber-400">{b.category}</td>
                              <td className="p-3 font-semibold text-white">{b.item}</td>
                              <td className="p-3 font-mono">₹{b.estimatedCost.toLocaleString('en-IN')}</td>
                              <td className="p-3 font-mono font-bold text-emerald-400">₹{b.actualCost.toLocaleString('en-IN')}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.status === 'Over Budget' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                  {b.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
              <div>
                <h1 className="text-xl font-black text-white">Department Pre-Production Templates</h1>
                <p className="text-xs text-gray-400 mt-0.5">Checklists, continuity forms, and technical riders</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: 'Camera Lens & Gear Checklist', desc: 'Standard anamorphic & spherical lens test sheet' },
                  { title: 'Wardrobe Continuity Sheet', desc: 'Actor measurements, duplicate tags & laundry logs' },
                  { title: 'HOD Daily Sync Agenda', desc: 'Auto-populated meeting questions template' },
                  { title: 'Location Risk Assessment', desc: 'Power, noise, weather & safety clearance checklist' },
                ].map((tpl, i) => (
                  <div key={i} className="bg-[#161618] border border-[#262628] p-5 rounded-2xl space-y-2 hover:border-amber-500/40 transition-colors cursor-pointer">
                    <BookOpen size={20} className="text-amber-400" />
                    <h3 className="text-sm font-bold text-white">{tpl.title}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">{tpl.desc}</p>
                    <button className="text-amber-400 font-bold text-xs pt-2 underline">Use Template</button>
                  </div>
                ))}
              </div>
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
              const priority = formData.get('priority') as any;
              const deadline = formData.get('deadline') as string;
              const status = (formData.get('status') as any) || defaultTaskStatus;
              if (title) {
                setTasks(prev => [...prev, {
                  id: `tk-${Date.now()}`,
                  title,
                  departmentId: selectedDeptId,
                  owner: owner || 'Department Lead',
                  priority: priority || 'High',
                  deadline: deadline || '2026-08-10',
                  status
                }]);
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

    </div>
  );
};

export default CrewView;
