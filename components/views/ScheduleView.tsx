import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Shot, Beat } from '../../types';
import LocationScoutView from './LocationScoutView';
import DoodMatrixView from './DoodMatrixView';
import { 
    AlertTriangle, AlertCircle, CheckCircle2,
    Lock, Unlock, ShieldAlert, Sparkles, Printer, RotateCcw,
    X, ChevronRight, FileText, Download, Calendar, RefreshCw,
    ChevronLeft, Filter, Layers, Zap, Clock, Eye, Sliders,
    Search, CheckSquare, Square, Users, MapPin, Wrench, Shield,
    Check, Plus, ArrowRight, ListFilter, AlertOctagon, Edit2, Trash2,
    Truck, Utensils, Flag, MoveUp, MoveDown, Compass, CheckCircle,
    BarChart3, ClipboardCheck, ArrowUpRight, ArrowDownRight, Coffee
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// --- TYPES & INTERFACES ---
export type OptimizationStrategy = 'balanced' | 'lowest_cost' | 'fastest_shoot' | 'max_actor_eff' | 'min_moves' | 'min_continuity_risk';

export type StripType = 'INTDAY' | 'INTNIGHT' | 'EXTDAY' | 'EXTNIGHT';

export interface StripItem {
    id: string;
    beatId: number;
    sceneNo: string;
    slug: string;
    type: StripType;
    tags: string[];
    scheduledDate: string; // YYYY-MM-DD
    shootingDay: number; // 0 = unscheduled / holding rack, 1..N = day break
    pages: string; // e.g. "1 3/8"
    pagesDecimal: number; // e.g. 1.375
    estHours: number; // e.g. 3.2
    castIds?: string[];
    castNames?: string[];
    conflictType?: 'warn' | 'hard';
    conflictTitle?: string;
    conflictReasons?: string[];
    suggestion?: string;
    shotCount?: number;
    shotIds?: string[];
}

export interface DayBannerItem {
    id: string;
    dayNumber: number;
    type: 'move' | 'lunch' | 'note';
    title: string;
    subtitle?: string;
    durationMin?: number;
    insertAfterSceneIndex: number;
}

export interface ShootDaySummary {
    dayNumber: number;
    dateStr: string;
    dayOfWeek: string;
    strips: StripItem[];
    banners: DayBannerItem[];
    totalPages: number;
    totalHours: number;
    totalShots: number;
    workingCast: string[];
    primaryLocation: string;
}

export interface GanttMilestone {
    id: string;
    phase: 'pre' | 'shoot' | 'post';
    title: string;
    targetDate: string;
    status: 'done' | 'in_progress' | 'scheduled';
    owner: string;
    notes?: string;
}

export interface DepartmentCheckItem {
    id: string;
    department: 'Direction' | 'Camera' | 'Art' | 'Wardrobe' | 'Stunts' | 'Sound' | 'Legal';
    title: string;
    owner: string;
    dueDate: string;
    status: 'ready' | 'in_progress' | 'blocked';
    notes?: string;
}

export interface AnchorItem {
    id: string;
    title: string;
    window: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    priority: 'critical' | 'high' | 'medium';
    notes?: string;
}

export interface ResourcePressure {
    name: string;
    percentage: number;
    isTight: boolean;
}

// Helper formatting function for YYYY-MM-DD
const formatDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const parseDateStr = (str: string): Date => {
    if (!str) return new Date();
    const parts = str.split('-').map(Number);
    if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date();
};

const formatShortDate = (str: string): string => {
    if (!str) return '';
    const date = parseDateStr(str);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDayOfWeek = (str: string): string => {
    if (!str) return '';
    const date = parseDateStr(str);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
};

// Convert decimal pages to fractional 1/8 notation
const formatFractionalPages = (dec: number): string => {
    if (!dec || isNaN(dec) || dec <= 0) return '1/8';
    const whole = Math.floor(dec);
    const eighths = Math.max(1, Math.min(7, Math.round((dec - whole) * 8)));
    if (eighths === 8 || eighths === 0) {
        return whole > 0 ? `${whole}` : '1/8';
    }
    return whole > 0 ? `${whole} ${eighths}/8` : `${eighths}/8`;
};

// Default Anchor Constraints
const DEFAULT_ANCHORS: AnchorItem[] = [
    {
        id: 'anc-1',
        title: 'Lead Star Availability (Vikram Rana)',
        window: 'Aug 10 – Aug 22 (12-day lock)',
        startDate: '2026-08-10',
        endDate: '2026-08-22',
        priority: 'critical',
        notes: 'Mandatory window before European tour commitment.'
    },
    {
        id: 'anc-2',
        title: 'Heritage Palace Shoot Permit',
        window: 'Aug 17 – Aug 20 (4 days only)',
        startDate: '2026-08-17',
        endDate: '2026-08-20',
        priority: 'critical',
        notes: 'Archaeological Survey permission strictly non-extendable.'
    },
    {
        id: 'anc-3',
        title: 'Child Artist Restricted Hours (Meera)',
        window: 'Max 4.5 camera hours/day',
        startDate: '2026-08-10',
        endDate: '2026-09-15',
        priority: 'high',
        notes: 'State labor board compliance rule.'
    }
];

const DEFAULT_RESOURCES: ResourcePressure[] = [
    { name: 'Alexa Mini LF Body A', percentage: 92, isTight: true },
    { name: 'Technocrane 30ft', percentage: 75, isTight: false },
    { name: 'ICU Hospital Practical Set', percentage: 95, isTight: true },
    { name: 'Stunt Wire Rigging Unit', percentage: 60, isTight: false },
    { name: 'Night Gen-Set 125kVA', percentage: 88, isTight: true }
];

const STRATEGY_NOTES: Record<OptimizationStrategy, string> = {
    balanced: 'Balancing cost, moves and continuity risk evenly. Standard 1st AD scheduling heuristic.',
    lowest_cost: 'Clustering identical sets back-to-back to shrink company moves and generator standby fees.',
    fastest_shoot: 'Compressing to fewest total calendar days with maximum camera coverage per shoot day.',
    max_actor_eff: 'Clustering all scenes around main lead availability to avoid idle hold fees.',
    min_moves: 'Minimizing unit relocations across disparate geographic zones.',
    min_continuity_risk: 'Shooting sequentially within emotional blocks to preserve costume, makeup, and injury continuity.'
};

const INITIAL_GANTT_MILESTONES: GanttMilestone[] = [
    { id: 'm-1', phase: 'pre', title: 'Script Lock & International Breakdown', targetDate: '2026-06-15', status: 'done', owner: 'Writer & Director' },
    { id: 'm-2', phase: 'pre', title: 'Location Recce & Municipal Filming Clearances', targetDate: '2026-07-05', status: 'done', owner: 'Location Manager' },
    { id: 'm-3', phase: 'pre', title: 'Cast Rehearsals & Table Reads', targetDate: '2026-07-20', status: 'done', owner: 'Director & Casting' },
    { id: 'm-4', phase: 'pre', title: 'Hospital ICU Practical Set Construction Sign-off', targetDate: '2026-08-02', status: 'in_progress', owner: 'Art Director' },
    { id: 'm-5', phase: 'pre', title: 'Tech Recce, Lens Testing & Camera Package Lock', targetDate: '2026-08-06', status: 'in_progress', owner: 'Cinematographer (DOP)' },
    { id: 'm-6', phase: 'shoot', title: 'Principal Photography Commences (Day 1)', targetDate: '2026-08-10', status: 'scheduled', owner: '1st AD & Unit Producer' },
    { id: 'm-7', phase: 'shoot', title: 'Block 1 Wrap: Hospital Interior Sets', targetDate: '2026-08-16', status: 'scheduled', owner: '1st AD' },
    { id: 'm-8', phase: 'shoot', title: 'Unit Relocation to Ooty Exterior Basecamp', targetDate: '2026-08-23', status: 'scheduled', owner: 'Transport Captain' },
    { id: 'm-9', phase: 'shoot', title: 'Block 2 Wrap: Forest Chase & Climax Stunts', targetDate: '2026-09-12', status: 'scheduled', owner: 'Stunt Coordinator' },
    { id: 'm-10', phase: 'shoot', title: 'Principal Photography Wrap Party', targetDate: '2026-09-25', status: 'scheduled', owner: 'Producer' },
    { id: 'm-11', phase: 'post', title: 'First Assembly Editorial Cut Delivery', targetDate: '2026-10-10', status: 'scheduled', owner: 'Lead Editor' },
    { id: 'm-12', phase: 'post', title: 'Director\'s Cut & Final Picture Lock', targetDate: '2026-10-28', status: 'scheduled', owner: 'Director' },
    { id: 'm-13', phase: 'post', title: 'VFX Delivery & DI Color Grading', targetDate: '2026-11-15', status: 'scheduled', owner: 'Colorist & VFX Sup' },
    { id: 'm-14', phase: 'post', title: 'Dolby Atmos Sound Mix & Original Score Lock', targetDate: '2026-11-25', status: 'scheduled', owner: 'Sound Designer' },
    { id: 'm-15', phase: 'post', title: 'Final DCP Theatrical Master & Digital Delivery', targetDate: '2026-12-05', status: 'scheduled', owner: 'Post Supervisor' }
];

const INITIAL_DEPARTMENT_CHECKS: DepartmentCheckItem[] = [
    { id: 'dc-1', department: 'Direction', title: 'Detailed Shot Division & Coverage Approval', owner: 'Director', dueDate: '2026-08-04', status: 'ready', notes: 'All 42 scene shotlists signed off.' },
    { id: 'dc-2', department: 'Direction', title: '1st AD Call Sheet Templates & Transit Logistics', owner: '1st AD', dueDate: '2026-08-05', status: 'ready', notes: 'Master template configured in Vault.' },
    { id: 'dc-3', department: 'Camera', title: 'Alexa Mini LF Dual Camera Package & Cooke S7/i Primes', owner: 'DOP', dueDate: '2026-08-06', status: 'ready', notes: 'Optical bench test completed.' },
    { id: 'dc-4', department: 'Camera', title: 'DJI Inspire 3 Drone Clearance in City Center', owner: 'Key Drone Pilot', dueDate: '2026-08-07', status: 'in_progress', notes: 'Aviation permit pending final police seal.' },
    { id: 'dc-5', department: 'Art', title: 'Hospital ICU Practical Set Dressing & Medical Monitors', owner: 'Art Director', dueDate: '2026-08-07', status: 'in_progress', notes: 'Defibrillator and working ECG monitor sourced.' },
    { id: 'dc-6', department: 'Art', title: 'Hero Stunt Weapons & Breakaway Sugar Glass Bottles', owner: 'Prop Master', dueDate: '2026-08-08', status: 'ready', notes: '8 safety stunt bottles delivered.' },
    { id: 'dc-7', department: 'Wardrobe', title: 'Hero Costumes (Double sets for action/blood distress)', owner: 'Costume Designer', dueDate: '2026-08-06', status: 'ready', notes: '3 duplicate suits prepared for Arjun.' },
    { id: 'dc-8', department: 'Wardrobe', title: 'Special Effects Prosthetic Burns & Bullet Hits', owner: 'Key SFX Makeup', dueDate: '2026-08-07', status: 'ready', notes: 'Silicone prosthetics cured and fitted.' },
    { id: 'dc-9', department: 'Stunts', title: 'High-wire Rigging Safety Sign-off & Crash Mats', owner: 'Stunt Coordinator', dueDate: '2026-08-08', status: 'ready', notes: 'Certified stunt rigging master inspecting anchor points.' },
    { id: 'dc-10', department: 'Stunts', title: 'On-set Emergency Paramedic Ambulance on Standby', owner: 'Safety Officer', dueDate: '2026-08-09', status: 'ready', notes: 'St. John Ambulance unit confirmed for all stunt days.' },
    { id: 'dc-11', department: 'Sound', title: 'Sound Devices 888 16-channel Rig & 6 Radio Mics', owner: 'Sound Recordist', dueDate: '2026-08-06', status: 'ready', notes: 'Frequency clearance obtained from telecomm board.' },
    { id: 'dc-12', department: 'Legal', title: 'City Police Commissioner Shoot Clearance', owner: 'Line Producer', dueDate: '2026-08-05', status: 'ready', notes: 'Official permit order received for Days 1-8.' },
    { id: 'dc-13', department: 'Legal', title: 'Child Artist Labor Welfare Consent (Meera)', owner: 'Production Legal', dueDate: '2026-08-06', status: 'ready', notes: 'Guardian accompanied affidavit filed.' },
    { id: 'dc-14', department: 'Legal', title: 'All-Risk Equipment & Cast Non-appearance Insurance', owner: 'Executive Producer', dueDate: '2026-08-07', status: 'ready', notes: 'Policy underwritten by New India Assurance.' }
];

interface ScheduleViewProps {
    onNavigateToView?: (view: any) => void;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ onNavigateToView }) => {
    const project = useProject() || {};
    const generatedShots: Shot[] = project.generatedShots || [];
    const beats: Beat[] = project.beats || [];
    const appTheme = project.appTheme || 'dark';
    const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
    const projectList = project.projectList || [];
    const currentProjectId = project.currentProjectId;
    const currentProjectName = projectList.find((p: any) => p.id === currentProjectId)?.name || 'PROJECT';

    // 5 Operational Pillars Tab Navigation
    const [scheduleTab, setScheduleTab] = useState<'stripboard' | 'gantt' | 'locations' | 'dood' | 'readiness'>('stripboard');
    const [strategy, setStrategy] = useState<OptimizationStrategy>('balanced');
    const [selectedStripId, setSelectedStripId] = useState<string>('');

    // Multi-Month Calendar States
    const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
    const [monthCount, setMonthCount] = useState<number>(2); // 1, 2, 3, 4
    const [startYear, setStartYear] = useState<number>(2026);
    const [startMonthIndex, setStartMonthIndex] = useState<number>(7); // 0-indexed (7 = August)
    const [scrubRange, setScrubRange] = useState<[string | null, string | null]>([null, null]);
    const [isDraggingScrub, setIsDraggingScrub] = useState<boolean>(false);
    const [dragStartDay, setDragStartDay] = useState<string | null>(null);
    const [filterByScrubbedOnly, setFilterByScrubbedOnly] = useState<boolean>(false);

    // Holding Rack expansion toggle
    const [isHoldingRackOpen, setIsHoldingRackOpen] = useState<boolean>(true);

    // Banners state (Company moves, Lunch breaks)
    const [dayBanners, setDayBanners] = useState<DayBannerItem[]>([
        {
            id: 'b-move-1',
            dayNumber: 2,
            type: 'move',
            title: 'COMPANY MOVE: Relocate Unit to Old Town Market',
            subtitle: '45 mins transit · 3.8 km distance · Unit convoy 8 vehicles',
            durationMin: 45,
            insertAfterSceneIndex: 1
        },
        {
            id: 'b-lunch-1',
            dayNumber: 1,
            type: 'lunch',
            title: 'COMPANY LUNCH: 13:00 - 14:00',
            subtitle: 'Catering Truck at Basecamp A · Hot meals for 65 crew members',
            durationMin: 60,
            insertAfterSceneIndex: 2
        }
    ]);

    // Milestones and Readiness state
    const [ganttMilestones, setGanttMilestones] = useState<GanttMilestone[]>(INITIAL_GANTT_MILESTONES);
    const [departmentChecks, setDepartmentChecks] = useState<DepartmentCheckItem[]>(INITIAL_DEPARTMENT_CHECKS);
    const [readinessFilterDept, setReadinessFilterDept] = useState<string>('ALL');
    const [readinessFilterStatus, setReadinessFilterStatus] = useState<string>('ALL');

    // Modals
    const [isNewMilestoneModalOpen, setIsNewMilestoneModalOpen] = useState<boolean>(false);
    const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
    const [newMilestonePhase, setNewMilestonePhase] = useState<'pre' | 'shoot' | 'post'>('shoot');
    const [newMilestoneDate, setNewMilestoneDate] = useState('2026-08-15');
    const [newMilestoneOwner, setNewMilestoneOwner] = useState('1st AD');

    const [isNewCheckModalOpen, setIsNewCheckModalOpen] = useState<boolean>(false);
    const [newCheckDept, setNewCheckDept] = useState<'Direction' | 'Camera' | 'Art' | 'Wardrobe' | 'Stunts' | 'Sound' | 'Legal'>('Direction');
    const [newCheckTitle, setNewCheckTitle] = useState('');
    const [newCheckOwner, setNewCheckOwner] = useState('');
    const [newCheckDueDate, setNewCheckDueDate] = useState('2026-08-08');

    // Edit scene strip state
    const [editingStrip, setEditingStrip] = useState<StripItem | null>(null);
    const [editFormTitle, setEditFormTitle] = useState('');
    const [editFormSceneNo, setEditFormSceneNo] = useState('');
    const [editFormPrefix, setEditFormPrefix] = useState('INT');
    const [editFormLocation, setEditFormLocation] = useState('');
    const [editFormTime, setEditFormTime] = useState('DAY');

    // PDF Export modal
    const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
    const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
    const pdfPrintRef = useRef<HTMLDivElement>(null);

    // Call Sheet Toast/Notice
    const [callSheetNotice, setCallSheetNotice] = useState<string | null>(null);

    // --- STRIP BUILDING & DAY BREAK COMPUTATION ---
    const strips: StripItem[] = useMemo(() => {
        if (!beats || beats.length === 0) return [];

        const baseStartDate = new Date(2026, 7, 10); // Aug 10, 2026

        return beats.map((b, idx) => {
            const scNo = b.sceneNumber || String(idx + 1);
            const prefix = (b.slug?.prefix || 'INT').toUpperCase();
            const loc = (b.slug?.location || 'LOCATION').trim();
            const time = (b.slug?.time || 'DAY').trim().toUpperCase();
            const isNight = time.includes('NIGHT') || time.includes('இரவு') || time.includes('நள்ளிரவு');
            const isExt = prefix.includes('EXT');

            let stType: StripType = 'INTDAY';
            if (isExt && isNight) stType = 'EXTNIGHT';
            else if (isExt && !isNight) stType = 'EXTDAY';
            else if (!isExt && isNight) stType = 'INTNIGHT';

            // Use explicit beat.shootingDay if set, else assign default clustered day breaks (e.g. 2-3 scenes per day)
            const assignedDay = typeof b.shootingDay === 'number' ? b.shootingDay : (Math.floor(idx / 3) + 1);

            // Compute calendar date based on assignedDay
            const dayOffset = Math.max(0, assignedDay - 1);
            const scheduledD = new Date(baseStartDate);
            scheduledD.setDate(baseStartDate.getDate() + dayOffset);
            const scheduledDate = formatDateStr(scheduledD);

            // Estimate pages from content length or standard 1.25 pages
            const textLen = (b.content || '').length;
            const pagesDec = textLen > 200 ? Math.min(4.5, Math.max(0.5, Math.round((textLen / 250) * 8) / 8)) : 1.375;
            const pagesFraction = formatFractionalPages(pagesDec);

            // Estimate camera hours (approx 2.5h per scene)
            const estHours = Math.round((pagesDec * 2.2 + 0.6) * 10) / 10;

            const rawCastList = b.breakdown?.CAST || b.breakdown?.cast || b.breakdownData?.CAST || b.breakdownData?.cast;
            const castTags = rawCastList?.map(c => typeof c === 'string' ? c : (c as any).name).filter(Boolean) || [];

            // Find matching shots
            const matchedShots = generatedShots.filter(s => String(s.scene) === scNo);

            // Conflict warnings (turnaround, child artist)
            let conflictType: 'warn' | 'hard' | undefined;
            let conflictTitle: string | undefined;
            let conflictReasons: string[] | undefined;
            let suggestion: string | undefined;

            if (idx === 1 || castTags.some(c => c.toLowerCase().includes('meera'))) {
                conflictType = 'warn';
                conflictTitle = 'Child Artist Work Hour Cap';
                conflictReasons = ['Meera is limited to 4.5 camera hours per state labor guidelines.'];
                suggestion = 'Schedule Meera closeups in first 3 hours of call.';
            } else if (idx === 3 && isNight) {
                conflictType = 'warn';
                conflictTitle = 'SAG Turnaround Notice';
                conflictReasons = ['Night shoot wraps at 03:00. Next call cannot be earlier than 15:00.'];
                suggestion = 'Enforce 12-hour turnaround rest window before Day 3 call.';
            }

            return {
                id: `strip-${b.id}`,
                beatId: b.id,
                sceneNo: scNo,
                slug: b.title || `${prefix}. ${loc} - ${time}`,
                type: stType,
                tags: castTags.length > 0 ? castTags : [time, loc],
                scheduledDate,
                shootingDay: assignedDay,
                pages: pagesFraction,
                pagesDecimal: pagesDec,
                estHours,
                castNames: castTags,
                conflictType,
                conflictTitle,
                conflictReasons,
                suggestion,
                shotCount: matchedShots.length > 0 ? matchedShots.length : (Math.floor(pagesDec * 6) + 2),
                shotIds: matchedShots.map(s => s.id)
            };
        });
    }, [beats, generatedShots]);

    // Group strips into explicit Day Breaks
    const shootDays: ShootDaySummary[] = useMemo(() => {
        const dayMap: Record<number, StripItem[]> = {};

        strips.forEach(s => {
            if (s.shootingDay > 0) {
                if (!dayMap[s.shootingDay]) dayMap[s.shootingDay] = [];
                dayMap[s.shootingDay].push(s);
            }
        });

        const dayNumbers = Object.keys(dayMap).map(Number).sort((a, b) => a - b);
        const baseDate = new Date(2026, 7, 10);

        return dayNumbers.map(dayNum => {
            const dayStrips = dayMap[dayNum];
            const d = new Date(baseDate);
            d.setDate(baseDate.getDate() + (dayNum - 1));
            const dateStr = formatDateStr(d);
            const dayOfWeek = formatDayOfWeek(dateStr);

            const totalPages = Math.round(dayStrips.reduce((acc, s) => acc + s.pagesDecimal, 0) * 8) / 8;
            const totalHours = Math.round(dayStrips.reduce((acc, s) => acc + s.estHours, 0) * 10) / 10;
            const totalShots = dayStrips.reduce((acc, s) => acc + (s.shotCount || 0), 0);

            const castSet = new Set<string>();
            dayStrips.forEach(s => {
                s.castNames?.forEach(c => castSet.add(c));
            });

            const bannersForDay = dayBanners.filter(b => b.dayNumber === dayNum);

            // Determine primary location
            const locCount: Record<string, number> = {};
            dayStrips.forEach(s => {
                const parts = s.slug.split('-');
                const candidate = parts[0]?.replace(/^(INT\.|EXT\.|INT\/EXT\.)/, '').trim() || 'LOCATION';
                locCount[candidate] = (locCount[candidate] || 0) + 1;
            });
            const primaryLocation = Object.entries(locCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Studio Stage';

            return {
                dayNumber: dayNum,
                dateStr,
                dayOfWeek,
                strips: dayStrips,
                banners: bannersForDay,
                totalPages,
                totalHours,
                totalShots,
                workingCast: Array.from(castSet),
                primaryLocation
            };
        });
    }, [strips, dayBanners]);

    // Holding rack strips (scenes with shootingDay === 0 or unscheduled)
    const holdingRackStrips = useMemo(() => {
        return strips.filter(s => s.shootingDay === 0);
    }, [strips]);

    // Check if date falls in scrubbed range
    const isDateInScrubbedRange = (dateStr: string): boolean => {
        if (!scrubRange[0] || !scrubRange[1] || !dateStr) return false;
        const start = scrubRange[0] < scrubRange[1] ? scrubRange[0] : scrubRange[1];
        const end = scrubRange[0] < scrubRange[1] ? scrubRange[1] : scrubRange[0];
        return dateStr >= start && dateStr <= end;
    };

    // Filtered Shoot Days if scrubbed
    const displayShootDays = useMemo(() => {
        if (!filterByScrubbedOnly || !scrubRange[0] || !scrubRange[1]) return shootDays;
        return shootDays.filter(d => isDateInScrubbedRange(d.dateStr));
    }, [shootDays, filterByScrubbedOnly, scrubRange]);

    // Selected Strip lookup
    const selectedStrip = useMemo(() => {
        if (!selectedStripId) return strips[0];
        return strips.find(s => s.id === selectedStripId) || strips[0];
    }, [strips, selectedStripId]);

    // Metrics for Studio Header
    const totalShootDaysCount = shootDays.length;
    const totalScenesCount = strips.length;
    const totalPagesDecimal = Math.round(strips.reduce((acc, s) => acc + s.pagesDecimal, 0) * 8) / 8;
    const totalPagesFraction = formatFractionalPages(totalPagesDecimal);
    const totalShotsCount = strips.reduce((acc, s) => acc + (s.shotCount || 0), 0);

    // Dynamic Health Score
    const healthScore = useMemo(() => {
        let score = 88;
        if (strategy === 'lowest_cost') score = 92;
        if (strategy === 'fastest_shoot') score = 76;
        if (strategy === 'min_moves') score = 94;
        if (strategy === 'min_continuity_risk') score = 90;

        // Deduct for blocked readiness items
        const blockedChecks = departmentChecks.filter(c => c.status === 'blocked').length;
        score -= blockedChecks * 5;

        // Deduct if holding rack has unscheduled scenes
        if (holdingRackStrips.length > 0) {
            score -= Math.min(15, holdingRackStrips.length * 3);
        }

        return Math.max(50, Math.min(99, score));
    }, [strategy, departmentChecks, holdingRackStrips]);

    // Readiness department overall percent
    const readinessPercent = useMemo(() => {
        if (departmentChecks.length === 0) return 100;
        const readyCount = departmentChecks.filter(c => c.status === 'ready').length;
        const inProgressCount = departmentChecks.filter(c => c.status === 'in_progress').length;
        return Math.round(((readyCount + inProgressCount * 0.5) / departmentChecks.length) * 100);
    }, [departmentChecks]);

    // --- ACTIONS & RE-ORDERING ---

    // Move strip to another day
    const handleMoveStripToDay = (strip: StripItem, newDay: number) => {
        if (project.updateBeat) {
            project.updateBeat(strip.beatId, { shootingDay: newDay });
        } else if (project.setBeats) {
            project.setBeats((prev: Beat[]) => prev.map(b => b.id === strip.beatId ? { ...b, shootingDay: newDay } : b));
        }
    };

    // Auto-Schedule Heuristic: clusters by location, day vs night, distributes ~4 pages/day
    const handleAutoSchedule = () => {
        if (!beats || beats.length === 0) return;

        // Sort beats by location, then time of day (DAY before NIGHT to avoid turnaround flips)
        const sorted = [...beats].sort((a, b) => {
            const locA = (a.slug?.location || '').toUpperCase();
            const locB = (b.slug?.location || '').toUpperCase();
            if (locA !== locB) return locA.localeCompare(locB);

            const timeA = (a.slug?.time || '').toUpperCase();
            const timeB = (b.slug?.time || '').toUpperCase();
            const isNightA = timeA.includes('NIGHT');
            const isNightB = timeB.includes('NIGHT');
            if (isNightA !== isNightB) return isNightA ? 1 : -1;

            return (a.sceneNumber || '').localeCompare(b.sceneNumber || '');
        });

        // Group into shoot days with max ~4 pages per day
        let currentDay = 1;
        let runningPages = 0;
        const updatedBeats = sorted.map((b) => {
            const textLen = (b.content || '').length;
            const pDec = textLen > 200 ? Math.min(4.0, Math.max(0.5, textLen / 250)) : 1.25;

            if (runningPages + pDec > 4.2 && runningPages > 0) {
                currentDay += 1;
                runningPages = 0;
            }
            runningPages += pDec;

            return {
                ...b,
                shootingDay: currentDay
            };
        });

        if (project.setBeats) {
            project.setBeats(updatedBeats);
        }
    };

    // Add new Day Break
    const handleAddNewDayBreak = () => {
        const nextDayNum = (shootDays[shootDays.length - 1]?.dayNumber || 0) + 1;
        if (holdingRackStrips.length > 0) {
            const firstHolding = holdingRackStrips[0];
            handleMoveStripToDay(firstHolding, nextDayNum);
        } else if (strips.length > 0) {
            const lastStrip = strips[strips.length - 1];
            handleMoveStripToDay(lastStrip, nextDayNum);
        }
    };

    // Add Company Move Banner
    const handleAddCompanyMoveBanner = (dayNumber: number) => {
        const newBanner: DayBannerItem = {
            id: `b-move-${Date.now()}`,
            dayNumber,
            type: 'move',
            title: `COMPANY MOVE: Relocate Unit (Day ${dayNumber})`,
            subtitle: 'Estimated 35 mins equipment packup and transit to next set location',
            durationMin: 35,
            insertAfterSceneIndex: 0
        };
        setDayBanners(prev => [...prev, newBanner]);
    };

    // Add Lunch Banner
    const handleAddLunchBanner = (dayNumber: number) => {
        const newBanner: DayBannerItem = {
            id: `b-lunch-${Date.now()}`,
            dayNumber,
            type: 'lunch',
            title: 'COMPANY LUNCH: 13:00 - 14:00',
            subtitle: '1st AD called lunch hour. Generator quiet time enforced.',
            durationMin: 60,
            insertAfterSceneIndex: 1
        };
        setDayBanners(prev => [...prev, newBanner]);
    };

    // Remove Banner
    const handleRemoveBanner = (id: string) => {
        setDayBanners(prev => prev.filter(b => b.id !== id));
    };

    // Create Call Sheet Bridge
    const handleCreateCallSheetForDay = (day: ShootDaySummary) => {
        setCallSheetNotice(`Configured Call Sheet draft for Day ${day.dayNumber} (${day.dateStr}) with ${day.strips.length} scenes.`);
        setTimeout(() => setCallSheetNotice(null), 4000);
        if (onNavigateToView) {
            onNavigateToView('callsheet');
        }
    };

    // Edit scene modal handlers
    const handleOpenEditModal = (s: StripItem, e: React.MouseEvent) => {
        e.stopPropagation();
        const beat = beats.find(b => b.id === s.beatId);
        setEditingStrip(s);
        setEditFormTitle(beat?.title || '');
        setEditFormSceneNo(beat?.sceneNumber || s.sceneNo);
        setEditFormPrefix(beat?.slug?.prefix || 'INT');
        setEditFormLocation(beat?.slug?.location || '');
        setEditFormTime(beat?.slug?.time || 'DAY');
    };

    const handleSaveEdit = () => {
        if (!editingStrip) return;
        if (project.updateBeat) {
            project.updateBeat(editingStrip.beatId, {
                sceneNumber: editFormSceneNo,
                title: editFormTitle,
                slug: {
                    prefix: editFormPrefix,
                    location: editFormLocation,
                    time: editFormTime
                }
            });
        }
        setEditingStrip(null);
    };

    const handleDeleteStrip = (s: StripItem, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Remove scene ${s.sceneNo} from production schedule?`)) {
            if (project.setBeats) {
                project.setBeats((prev: Beat[]) => prev.filter(b => b.id !== s.beatId));
            }
        }
    };

    // Export PDF Handler
    const handleExportPdf = async () => {
        if (!pdfPrintRef.current) return;
        setIsExportingPdf(true);
        try {
            const canvas = await html2canvas(pdfPrintRef.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${currentProjectName.replace(/\s+/g, '_')}_Production_Master_Plan.pdf`);
            setShowPdfModal(false);
        } catch (err) {
            console.error('PDF Export Error:', err);
        } finally {
            setIsExportingPdf(false);
        }
    };

    // Calendar Generation
    const monthList = useMemo(() => {
        const months = [];
        for (let i = 0; i < monthCount; i++) {
            const date = new Date(startYear, startMonthIndex + i, 1);
            const year = date.getFullYear();
            const month = date.getMonth();
            const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            
            const firstDayOfWeek = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            const daysArray = [];
            for (let p = 0; p < firstDayOfWeek; p++) {
                daysArray.push(null);
            }
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = formatDateStr(new Date(year, month, d));
                const stripsOnDay = strips.filter(s => s.scheduledDate === dateStr && s.shootingDay > 0);

                daysArray.push({
                    dayNum: d,
                    dateStr,
                    strips: stripsOnDay,
                    isSunday: new Date(year, month, d).getDay() === 0
                });
            }

            months.push({
                year,
                month,
                monthName,
                days: daysArray
            });
        }
        return months;
    }, [startYear, startMonthIndex, monthCount, strips]);

    const handleDayMouseDown = (dateStr: string) => {
        setIsDraggingScrub(true);
        setDragStartDay(dateStr);
        setScrubRange([dateStr, dateStr]);
    };

    const handleDayMouseEnter = (dateStr: string) => {
        if (isDraggingScrub && dragStartDay) {
            setScrubRange([dragStartDay, dateStr]);
        }
    };

    const handleDayMouseUp = () => {
        setIsDraggingScrub(false);
    };

    return (
        <div 
            className="w-full h-full bg-[#161410] text-[#F2EEE2] font-sans flex flex-col overflow-hidden selection:bg-[#E0A339] selection:text-[#3A2708]"
            onMouseUp={handleDayMouseUp}
        >
            {/* INLINE CSS THEME STYLES */}
            <style>{`
                .mono { font-family: 'IBM Plex Mono', monospace; }
                .display-font { font-family: 'Special Elite', monospace; letter-spacing: 0.5px; }

                /* Industry Standard Stripboard Colors */
                .strip-INTDAY { 
                    border-left-color: #E0A339 !important; 
                    background: linear-gradient(90deg, rgba(224,163,57,0.18) 0%, rgba(30,27,21,0.95) 16%);
                }
                .strip-EXTDAY { 
                    border-left-color: #F8F9FA !important; 
                    background: linear-gradient(90deg, rgba(248,249,250,0.18) 0%, rgba(30,27,21,0.95) 16%);
                }
                .strip-INTNIGHT { 
                    border-left-color: #3B82F6 !important; 
                    background: linear-gradient(90deg, rgba(59,130,246,0.18) 0%, rgba(30,27,21,0.95) 16%);
                }
                .strip-EXTNIGHT { 
                    border-left-color: #22C55E !important; 
                    background: linear-gradient(90deg, rgba(34,197,94,0.18) 0%, rgba(30,27,21,0.95) 16%);
                }

                .strip-item {
                    transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
                }
                .strip-item:hover {
                    transform: translateX(2px);
                    border-color: rgba(242,238,226,0.25);
                }
                .strip-item.selected {
                    box-shadow: 0 0 0 1px #E0A339, 0 4px 12px rgba(0,0,0,0.4);
                    border-color: #E0A339 !important;
                }

                ::-webkit-scrollbar { height: 6px; width: 6px; }
                ::-webkit-scrollbar-thumb { background: rgba(242,238,226,0.20); border-radius: 3px; }
                ::-webkit-scrollbar-track { background: transparent; }
            `}</style>

            {/* --- STUDIO HEADER BAR --- */}
            <header className="px-5 py-3 border-b border-[rgba(242,238,226,0.10)] flex items-center justify-between gap-4 flex-wrap bg-[#14120E] shrink-0">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-[#E0A339]/10 border border-[#E0A339]/30 flex items-center justify-center shrink-0">
                        <Calendar size={22} className="text-[#E0A339]" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <div className="display-font text-lg uppercase tracking-wider text-[#F2EEE2] flex items-center gap-2">
                            {currentProjectName.toUpperCase()} — PRODUCTION MASTER PLAN
                        </div>
                        <div className="text-[11px] text-[#A9A190] tracking-wider uppercase font-mono flex items-center gap-2">
                            <span>Chennai / Ooty / Kochi Units</span>
                            <span className="text-[#4FB0A6] font-semibold flex items-center gap-1">
                                • Principal Photography Window: Aug 10 – Sept 25, 2026
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4 PERSISTENT STUDIO METRICS CARDS */}
                <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
                    <div className="px-3 py-1.5 rounded bg-[#1E1B15] border border-[rgba(242,238,226,0.12)] flex flex-col items-center min-w-[72px]">
                        <span className="text-[9px] text-[#726A5C] uppercase tracking-wider font-semibold">Shoot Days</span>
                        <span className="text-sm font-bold text-[#E0A339]">{totalShootDaysCount}</span>
                    </div>

                    <div className="px-3 py-1.5 rounded bg-[#1E1B15] border border-[rgba(242,238,226,0.12)] flex flex-col items-center min-w-[72px]">
                        <span className="text-[9px] text-[#726A5C] uppercase tracking-wider font-semibold">Scenes</span>
                        <span className="text-sm font-bold text-[#F2EEE2]">{totalScenesCount}</span>
                    </div>

                    <div className="px-3 py-1.5 rounded bg-[#1E1B15] border border-[rgba(242,238,226,0.12)] flex flex-col items-center min-w-[72px]">
                        <span className="text-[9px] text-[#726A5C] uppercase tracking-wider font-semibold">Pages</span>
                        <span className="text-sm font-bold text-[#4FB0A6]">{totalPagesFraction}</span>
                    </div>

                    <div className="px-3 py-1.5 rounded bg-[#1E1B15] border border-[rgba(242,238,226,0.12)] flex flex-col items-center min-w-[72px]">
                        <span className="text-[9px] text-[#726A5C] uppercase tracking-wider font-semibold">Shots</span>
                        <span className="text-sm font-bold text-[#F2EEE2]">{totalShotsCount}</span>
                    </div>

                    {/* Animated Health Score Ring */}
                    <div className="flex items-center gap-2.5 px-3 py-1 bg-[#1E1B15] rounded border border-[rgba(242,238,226,0.12)]">
                        <div className="relative w-8 h-8 flex items-center justify-center">
                            <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="14" fill="none" stroke="#26221A" strokeWidth="3.5" />
                                <circle 
                                    cx="18" cy="18" r="14" fill="none" 
                                    stroke={healthScore > 80 ? '#5E9E6E' : '#E0A339'} strokeWidth="3.5"
                                    strokeDasharray="87.96"
                                    strokeDashoffset={87.96 - (87.96 * healthScore) / 100}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="absolute text-[10px] font-bold font-mono text-[#F2EEE2]">{healthScore}%</span>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-[10px] font-bold text-[#F2EEE2] leading-none">Schedule Health</span>
                            <span className="text-[8.5px] text-[#726A5C] uppercase tracking-wider mt-0.5">Optimized</span>
                        </div>
                    </div>
                </div>

                {/* HEADER ACTION CONTROLS */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleAutoSchedule}
                        className="px-3 py-1.5 rounded text-xs font-mono font-bold uppercase border border-[#E0A339]/40 bg-[#E0A339]/15 text-[#E0A339] hover:bg-[#E0A339]/25 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Cluster scenes automatically by location and daylight to minimize moves"
                    >
                        <Sparkles size={13} />
                        Auto-Schedule
                    </button>

                    <button 
                        onClick={() => setShowPdfModal(true)}
                        className="px-3.5 py-1.5 rounded text-xs font-mono font-bold uppercase border border-[rgba(242,238,226,0.22)] bg-[#1E1B15] text-[#F2EEE2] hover:bg-[#26221A] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                        <Printer size={13} className="text-[#E0A339]" /> 
                        Export 1st AD PDF
                    </button>
                </div>
            </header>

            {/* CALL SHEET TOAST NOTICE */}
            {callSheetNotice && (
                <div className="bg-[#4FB0A6]/20 border-b border-[#4FB0A6]/40 px-4 py-2 text-xs font-mono text-[#4FB0A6] flex items-center justify-between animate-fadeIn shrink-0">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} />
                        <span>{callSheetNotice}</span>
                    </div>
                    <button 
                        onClick={() => onNavigateToView && onNavigateToView('callsheet')}
                        className="underline hover:text-white cursor-pointer font-bold"
                    >
                        Open Call Sheet View &rarr;
                    </button>
                </div>
            )}

            {/* --- 5 INTEGRATED OPERATIONAL PILLARS NAVIGATION TABS --- */}
            <div className="flex items-center gap-1 border-b border-[rgba(242,238,226,0.15)] bg-[#0C0B09] px-4 pt-1 shrink-0 font-mono text-xs overflow-x-auto custom-scrollbar">
                <button
                    onClick={() => setScheduleTab('stripboard')}
                    className={`px-4 py-2 font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-t border-x rounded-none whitespace-nowrap ${
                        scheduleTab === 'stripboard' 
                            ? 'bg-[#161410] text-[#E0A339] border-[#E0A339] shadow-xs' 
                            : 'bg-transparent text-[#A9A190] border-transparent hover:text-[#F2EEE2]'
                    }`}
                >
                    <Layers size={14} className="text-[#E0A339]" />
                    <span>Pillar 1: Stripboard Studio</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#E0A339]/20 text-[#E0A339] font-bold">
                        {totalShootDaysCount} Days
                    </span>
                </button>

                <button
                    onClick={() => setScheduleTab('gantt')}
                    className={`px-4 py-2 font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-t border-x rounded-none whitespace-nowrap ${
                        scheduleTab === 'gantt' 
                            ? 'bg-[#161410] text-[#E0A339] border-[#E0A339] shadow-xs' 
                            : 'bg-transparent text-[#A9A190] border-transparent hover:text-[#F2EEE2]'
                    }`}
                >
                    <BarChart3 size={14} className="text-[#4FB0A6]" />
                    <span>Pillar 2: Master Production Gantt</span>
                </button>

                <button
                    onClick={() => setScheduleTab('locations')}
                    className={`px-4 py-2 font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-t border-x rounded-none whitespace-nowrap ${
                        scheduleTab === 'locations' 
                            ? 'bg-[#161410] text-[#E0A339] border-[#E0A339] shadow-xs' 
                            : 'bg-transparent text-[#A9A190] border-transparent hover:text-[#F2EEE2]'
                    }`}
                >
                    <MapPin size={14} className="text-[#E0A339]" />
                    <span>Pillar 3: Unit Logistics & Locations</span>
                </button>

                <button
                    onClick={() => setScheduleTab('dood')}
                    className={`px-4 py-2 font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-t border-x rounded-none whitespace-nowrap ${
                        scheduleTab === 'dood' 
                            ? 'bg-[#161410] text-[#E0A339] border-[#E0A339] shadow-xs' 
                            : 'bg-transparent text-[#A9A190] border-transparent hover:text-[#F2EEE2]'
                    }`}
                >
                    <Users size={14} className="text-[#5B8DBE]" />
                    <span>Pillar 4: Cast Logistics (DOOD Matrix)</span>
                </button>

                <button
                    onClick={() => setScheduleTab('readiness')}
                    className={`px-4 py-2 font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-t border-x rounded-none whitespace-nowrap ${
                        scheduleTab === 'readiness' 
                            ? 'bg-[#161410] text-[#E0A339] border-[#E0A339] shadow-xs' 
                            : 'bg-transparent text-[#A9A190] border-transparent hover:text-[#F2EEE2]'
                    }`}
                >
                    <ClipboardCheck size={14} className="text-[#5E9E6E]" />
                    <span>Pillar 5: Department Readiness</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#5E9E6E]/20 text-[#5E9E6E] font-bold">
                        {readinessPercent}%
                    </span>
                </button>
            </div>

            {/* ========================================================= */}
            {/* TAB CONTENT RENDERING */}
            {/* ========================================================= */}

            {/* --- PILLAR 2: MASTER PRODUCTION GANTT TIMELINE --- */}
            {scheduleTab === 'gantt' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-[#161410]">
                    {/* Gantt Top Summary Bar */}
                    <div className="p-4 rounded-lg bg-[#1E1B15] border border-[rgba(242,238,226,0.12)] flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-[#4FB0A6] font-bold flex items-center gap-1.5">
                                <BarChart3 size={13} />
                                Master Production Lifecycle Timeline
                            </div>
                            <h3 className="display-font text-lg font-bold text-[#F2EEE2] mt-0.5">
                                Pre-Production &rarr; Principal Photography &rarr; Post-Production
                            </h3>
                            <p className="text-xs font-mono text-[#A9A190] mt-1">
                                Full 7-month lifecycle roadmap with contractual milestones, unit movements, and delivery hard dates.
                            </p>
                        </div>

                        <button 
                            onClick={() => setIsNewMilestoneModalOpen(true)}
                            className="px-3.5 py-1.5 rounded bg-[#E0A339] text-[#3A2708] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#d09329] transition-colors cursor-pointer shadow-sm"
                        >
                            <Plus size={14} /> Add Milestone
                        </button>
                    </div>

                    {/* Gantt Multi-Phase Visual Bars */}
                    <div className="space-y-4 p-5 rounded-lg bg-[#191712] border border-[rgba(242,238,226,0.10)] font-mono">
                        <div className="text-xs font-bold uppercase tracking-wider text-[#726A5C] flex items-center justify-between">
                            <span>Production Phase Progression</span>
                            <span>Target Theatrical Wrap: Dec 05, 2026</span>
                        </div>

                        {/* Phase 1: Pre-Production */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-[#F2EEE2] flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#4FB0A6]" />
                                    Phase 1: Pre-Production (June 01 – Aug 09, 2026)
                                </span>
                                <span className="text-[#4FB0A6] font-bold">85% Complete</span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-[#26221A] overflow-hidden">
                                <div className="h-full bg-[#4FB0A6] rounded-full" style={{ width: '85%' }} />
                            </div>
                        </div>

                        {/* Phase 2: Principal Photography */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-[#F2EEE2] flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#E0A339]" />
                                    Phase 2: Principal Photography (Aug 10 – Sept 25, 2026)
                                </span>
                                <span className="text-[#E0A339] font-bold">Ready to Launch (Day 1 of 42)</span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-[#26221A] overflow-hidden">
                                <div className="h-full bg-[#E0A339] rounded-full" style={{ width: '15%' }} />
                            </div>
                        </div>

                        {/* Phase 3: Post-Production */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-[#F2EEE2] flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#5B8DBE]" />
                                    Phase 3: Post-Production (Sept 28 – Dec 05, 2026)
                                </span>
                                <span className="text-[#726A5C]">Scheduled</span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-[#26221A] overflow-hidden">
                                <div className="h-full bg-[#5B8DBE] rounded-full" style={{ width: '0%' }} />
                            </div>
                        </div>
                    </div>

                    {/* Milestones Table */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-[#A9A190] font-bold flex items-center gap-2">
                            <Flag size={14} className="text-[#E0A339]" />
                            Critical Milestones & Phase Deadlines ({ganttMilestones.length})
                        </h4>

                        <div className="border border-[rgba(242,238,226,0.12)] rounded-lg overflow-hidden bg-[#1E1B15]">
                            <table className="w-full text-left font-mono text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-[rgba(242,238,226,0.12)] bg-[#14120E] text-[#726A5C] text-[10.5px] uppercase tracking-wider">
                                        <th className="p-3">Phase</th>
                                        <th className="p-3">Milestone Title</th>
                                        <th className="p-3">Target Date</th>
                                        <th className="p-3">Owner / Head</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ganttMilestones.map((m) => {
                                        const phaseLabel = m.phase === 'pre' ? 'Pre-Production' : m.phase === 'shoot' ? 'Shoot' : 'Post-Production';
                                        const phaseBadgeColor = m.phase === 'pre' ? 'text-[#4FB0A6] bg-[#4FB0A6]/10' : m.phase === 'shoot' ? 'text-[#E0A339] bg-[#E0A339]/10' : 'text-[#5B8DBE] bg-[#5B8DBE]/10';

                                        return (
                                            <tr key={m.id} className="border-b border-[rgba(242,238,226,0.06)] hover:bg-[#26221A] transition-colors">
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${phaseBadgeColor}`}>
                                                        {phaseLabel}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-semibold text-[#F2EEE2]">{m.title}</td>
                                                <td className="p-3 text-[#A9A190]">{m.targetDate}</td>
                                                <td className="p-3 text-[#E0A339]">{m.owner}</td>
                                                <td className="p-3">
                                                    <button
                                                        onClick={() => {
                                                            setGanttMilestones(prev => prev.map(item => {
                                                                if (item.id === m.id) {
                                                                    const nextStatus = item.status === 'scheduled' ? 'in_progress' : item.status === 'in_progress' ? 'done' : 'scheduled';
                                                                    return { ...item, status: nextStatus };
                                                                }
                                                                return item;
                                                            }));
                                                        }}
                                                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer border ${
                                                            m.status === 'done' 
                                                                ? 'bg-[#5E9E6E]/20 text-[#5E9E6E] border-[#5E9E6E]/40'
                                                                : m.status === 'in_progress'
                                                                ? 'bg-[#E0A339]/20 text-[#E0A339] border-[#E0A339]/40'
                                                                : 'bg-[#26221A] text-[#726A5C] border-[rgba(242,238,226,0.1)]'
                                                        }`}
                                                        title="Click to advance status"
                                                    >
                                                        {m.status.replace('_', ' ')}
                                                    </button>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button 
                                                        onClick={() => setGanttMilestones(prev => prev.filter(item => item.id !== m.id))}
                                                        className="text-[#726A5C] hover:text-[#C1443A] cursor-pointer p-1"
                                                        title="Delete milestone"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PILLAR 3: UNIT LOGISTICS & LOCATION CLUSTERING --- */}
            {scheduleTab === 'locations' && (
                <div className="flex-1 flex flex-col min-h-0 w-full h-full overflow-hidden">
                    {/* Unit Logistics & Move Optimizer Bar */}
                    <div className="px-5 py-2.5 bg-[#14120E] border-b border-[rgba(242,238,226,0.12)] flex items-center justify-between gap-4 font-mono text-xs shrink-0 flex-wrap">
                        <div className="flex items-center gap-3">
                            <Truck size={16} className="text-[#E0A339]" />
                            <span className="font-bold text-[#F2EEE2]">Company Move Matrix:</span>
                            <span className="text-[#A9A190]">
                                3 major relocations scheduled across 42 shoot days (Chennai Stage &rarr; Ooty Exterior &rarr; Kochi Backwaters)
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-[#5E9E6E] font-bold">✓ 0 intra-day moves in Block 1</span>
                            <span className="text-[#726A5C]">·</span>
                            <span className="text-[#E0A339]">Est. Generator Idle Savings: ₹1.4L</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden min-h-0 w-full h-full">
                        <LocationScoutView />
                    </div>
                </div>
            )}

            {/* --- PILLAR 4: DOOD MATRIX (DAY OUT OF DAYS) --- */}
            {scheduleTab === 'dood' && (
                <div className="flex-1 flex flex-col min-h-0 w-full h-full overflow-hidden">
                    {/* DOOD Turnaround & Union Rules Banner */}
                    <div className="px-5 py-2.5 bg-[#14120E] border-b border-[rgba(242,238,226,0.12)] flex items-center justify-between gap-4 font-mono text-xs shrink-0 flex-wrap">
                        <div className="flex items-center gap-3">
                            <Clock size={16} className="text-[#5B8DBE]" />
                            <span className="font-bold text-[#F2EEE2]">SAG / Union Turnaround Monitor:</span>
                            <span className="text-[#A9A190]">
                                Mandatory 12-hour turnaround rest between wrap and next general call enforced.
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-[#5E9E6E]/20 text-[#5E9E6E] font-bold text-[10px]">
                                0 Turnaround Violations
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#E0A339]/20 text-[#E0A339] font-bold text-[10px]">
                                1 Child Labor Hour Cap Flagged
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 w-full h-full">
                        <DoodMatrixView />
                    </div>
                </div>
            )}

            {/* --- PILLAR 5: DEPARTMENT READINESS CHECKLIST --- */}
            {scheduleTab === 'readiness' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-[#161410]">
                    {/* Readiness Overview Header */}
                    <div className="p-4 rounded-lg bg-[#1E1B15] border border-[rgba(242,238,226,0.12)] flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-[#5E9E6E] font-bold flex items-center gap-1.5">
                                <ClipboardCheck size={13} />
                                Pre-Production Sign-offs & Department Readiness
                            </div>
                            <h3 className="display-font text-lg font-bold text-[#F2EEE2] mt-0.5">
                                Principal Photography Readiness Score: {readinessPercent}%
                            </h3>
                            <p className="text-xs font-mono text-[#A9A190] mt-1">
                                Sign-offs required from Direction, Camera, Art, Wardrobe, Stunts, Sound and Legal before call time.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setIsNewCheckModalOpen(true)}
                                className="px-3.5 py-1.5 rounded bg-[#E0A339] text-[#3A2708] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#d09329] transition-colors cursor-pointer shadow-sm"
                            >
                                <Plus size={14} /> Add Checklist Item
                            </button>
                        </div>
                    </div>

                    {/* Department Checklist Filters */}
                    <div className="flex items-center justify-between gap-3 flex-wrap font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#726A5C] uppercase tracking-wider">Department:</span>
                            {['ALL', 'Direction', 'Camera', 'Art', 'Wardrobe', 'Stunts', 'Sound', 'Legal'].map(dept => (
                                <button
                                    key={dept}
                                    onClick={() => setReadinessFilterDept(dept)}
                                    className={`px-2.5 py-1 rounded text-[11px] cursor-pointer transition-colors border ${
                                        readinessFilterDept === dept
                                            ? 'bg-[#E0A339] border-[#E0A339] text-[#3A2708] font-bold'
                                            : 'bg-[#1E1B15] border-[rgba(242,238,226,0.12)] text-[#A9A190] hover:text-[#F2EEE2]'
                                    }`}
                                >
                                    {dept}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[#726A5C] uppercase tracking-wider">Status:</span>
                            {['ALL', 'ready', 'in_progress', 'blocked'].map(st => (
                                <button
                                    key={st}
                                    onClick={() => setReadinessFilterStatus(st)}
                                    className={`px-2.5 py-1 rounded text-[11px] cursor-pointer transition-colors border ${
                                        readinessFilterStatus === st
                                            ? 'bg-[#4FB0A6] border-[#4FB0A6] text-[#161410] font-bold'
                                            : 'bg-[#1E1B15] border-[rgba(242,238,226,0.12)] text-[#A9A190] hover:text-[#F2EEE2]'
                                    }`}
                                >
                                    {st.replace('_', ' ').toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Checklist Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {departmentChecks
                            .filter(c => readinessFilterDept === 'ALL' || c.department === readinessFilterDept)
                            .filter(c => readinessFilterStatus === 'ALL' || c.status === readinessFilterStatus)
                            .map(c => {
                                const statusBorder = c.status === 'ready' 
                                    ? 'border-l-[#5E9E6E]' 
                                    : c.status === 'in_progress' 
                                    ? 'border-l-[#E0A339]' 
                                    : 'border-l-[#C1443A]';

                                return (
                                    <div 
                                        key={c.id}
                                        className={`p-3.5 rounded-lg border border-[rgba(242,238,226,0.12)] border-l-4 ${statusBorder} bg-[#1E1B15] space-y-2`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-[#26221A] text-[#A9A190] uppercase font-bold">
                                                    {c.department}
                                                </span>
                                                <h4 className="text-xs font-bold text-[#F2EEE2] mt-1">{c.title}</h4>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setDepartmentChecks(prev => prev.map(item => {
                                                        if (item.id === c.id) {
                                                            const nextStatus = item.status === 'ready' ? 'in_progress' : item.status === 'in_progress' ? 'blocked' : 'ready';
                                                            return { ...item, status: nextStatus };
                                                        }
                                                        return item;
                                                    }));
                                                }}
                                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase cursor-pointer border ${
                                                    c.status === 'ready'
                                                        ? 'bg-[#5E9E6E]/20 text-[#5E9E6E] border-[#5E9E6E]/40'
                                                        : c.status === 'in_progress'
                                                        ? 'bg-[#E0A339]/20 text-[#E0A339] border-[#E0A339]/40'
                                                        : 'bg-[#C1443A]/20 text-[#C1443A] border-[#C1443A]/40'
                                                }`}
                                                title="Click to cycle status: Ready -> In Progress -> Blocked"
                                            >
                                                {c.status.replace('_', ' ')}
                                            </button>
                                        </div>

                                        <div className="text-[11px] font-mono text-[#726A5C] flex items-center justify-between">
                                            <span>Responsible: <strong className="text-[#A9A190]">{c.owner}</strong></span>
                                            <span>Due: <strong className="text-[#A9A190]">{c.dueDate}</strong></span>
                                        </div>

                                        {c.notes && (
                                            <p className="text-[11px] font-mono text-[#A9A190] bg-[#161410] p-2 rounded border border-[rgba(242,238,226,0.06)]">
                                                {c.notes}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* --- PILLAR 1: STRIPBOARD STUDIO (DAY TIMELINE & HOLDING RACK) --- */}
            {scheduleTab === 'stripboard' && (
                <div className="flex-1 flex flex-col min-h-0 w-full h-full overflow-hidden">
                    
                    {/* MULTI-MONTH SCRUBBABLE CALENDAR (COLLAPSIBLE) */}
                    <div className="border-b border-[rgba(242,238,226,0.10)] bg-[#191712] px-4 py-2 shrink-0">
                        <div className="flex items-center justify-between gap-4 flex-wrap font-mono text-xs">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                    className="flex items-center gap-1.5 text-xs text-[#E0A339] font-bold uppercase tracking-wider hover:text-[#F2EEE2] transition-colors cursor-pointer bg-transparent border-none p-0 group"
                                    title="Toggle calendar scrub bar"
                                >
                                    <span className="font-mono text-sm leading-none">{isCalendarOpen ? '▼' : '►'}</span>
                                    <Calendar size={14} />
                                    <span>Interactive Calendar ({isCalendarOpen ? 'Hide' : 'Expand Scrub'})</span>
                                </button>

                                {isCalendarOpen && (
                                    <div className="flex items-center gap-1 bg-[#14120E] border border-[rgba(242,238,226,0.15)] rounded p-0.5">
                                        <button 
                                            onClick={() => {
                                                if (startMonthIndex === 0) {
                                                    setStartMonthIndex(11);
                                                    setStartYear(prev => prev - 1);
                                                } else {
                                                    setStartMonthIndex(prev => prev - 1);
                                                }
                                            }}
                                            className="p-1 hover:text-[#E0A339] text-[#A9A190] cursor-pointer"
                                            title="Previous Month"
                                        >
                                            <ChevronLeft size={13} />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (startMonthIndex === 11) {
                                                    setStartMonthIndex(0);
                                                    setStartYear(prev => prev + 1);
                                                } else {
                                                    setStartMonthIndex(prev => prev + 1);
                                                }
                                            }}
                                            className="p-1 hover:text-[#E0A339] text-[#A9A190] cursor-pointer"
                                            title="Next Month"
                                        >
                                            <ChevronRight size={13} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Scrub Range Indicators */}
                            <div className="flex items-center gap-3 flex-wrap">
                                {scrubRange[0] && scrubRange[1] ? (
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded bg-[#4FB0A6]/15 border border-[#4FB0A6]/40 text-[#4FB0A6] text-xs">
                                            Scrubbed: {formatShortDate(scrubRange[0] < scrubRange[1] ? scrubRange[0] : scrubRange[1])} – {formatShortDate(scrubRange[0] < scrubRange[1] ? scrubRange[1] : scrubRange[0])}
                                        </span>
                                        <button 
                                            onClick={() => setScrubRange([null, null])}
                                            className="hover:text-white cursor-pointer text-[#726A5C]" 
                                            title="Clear range"
                                        >
                                            <X size={12} />
                                        </button>

                                        <button
                                            onClick={() => setFilterByScrubbedOnly(!filterByScrubbedOnly)}
                                            className={`px-2 py-0.5 rounded text-[11px] border transition-colors flex items-center gap-1 cursor-pointer ${
                                                filterByScrubbedOnly 
                                                    ? 'bg-[#E0A339] border-[#E0A339] text-[#3A2708] font-bold' 
                                                    : 'bg-[#161410] border-[rgba(242,238,226,0.15)] text-[#A9A190]'
                                            }`}
                                        >
                                            <Filter size={11} />
                                            {filterByScrubbedOnly ? 'Scrubbed Only' : 'Show All'}
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-[11px] text-[#726A5C] italic">Click/drag calendar dates to filter timeline</span>
                                )}

                                <button
                                    onClick={handleAddNewDayBreak}
                                    className="px-2.5 py-1 rounded bg-[#1E1B15] border border-[rgba(242,238,226,0.18)] hover:border-[#E0A339] text-[#F2EEE2] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                    title="Insert a new shoot day break"
                                >
                                    <Plus size={13} className="text-[#E0A339]" /> Add Day Break
                                </button>
                            </div>
                        </div>

                        {/* Expandable Calendar Body */}
                        {isCalendarOpen && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-[rgba(242,238,226,0.08)]">
                                {monthList.map((m, mIdx) => (
                                    <div key={mIdx} className="bg-[#14120E] p-3 rounded border border-[rgba(242,238,226,0.10)]">
                                        <div className="text-center font-bold text-xs text-[#E0A339] uppercase tracking-wider mb-2">
                                            {m.monthName}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px]">
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, dIdx) => (
                                                <div key={dIdx} className="text-[#726A5C] font-semibold py-0.5">{day}</div>
                                            ))}
                                            {m.days.map((dayObj, dayIdx) => {
                                                if (!dayObj) {
                                                    return <div key={`empty-${dayIdx}`} className="h-6" />;
                                                }
                                                const isInScrub = isDateInScrubbedRange(dayObj.dateStr);
                                                const hasScenes = dayObj.strips.length > 0;

                                                return (
                                                    <div
                                                        key={dayIdx}
                                                        onMouseDown={() => handleDayMouseDown(dayObj.dateStr)}
                                                        onMouseEnter={() => handleDayMouseEnter(dayObj.dateStr)}
                                                        className={`h-6 flex items-center justify-center rounded cursor-pointer transition-colors relative ${
                                                            isInScrub
                                                                ? 'bg-[#4FB0A6] text-[#14120E] font-bold shadow-xs'
                                                                : hasScenes
                                                                ? 'bg-[#E0A339]/20 text-[#E0A339] font-bold border border-[#E0A339]/40'
                                                                : dayObj.isSunday
                                                                ? 'text-[#726A5C] bg-black/20'
                                                                : 'hover:bg-[#26221A] text-[#A9A190]'
                                                        }`}
                                                    >
                                                        {dayObj.dayNum}
                                                        {hasScenes && !isInScrub && (
                                                            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#E0A339]" />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* STRIPBOARD COLOR LEGEND BAR */}
                    <div className="px-4 py-1.5 bg-[#14120E] border-b border-[rgba(242,238,226,0.08)] flex items-center justify-between text-[11px] font-mono shrink-0 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                            <span className="text-[#726A5C] uppercase text-[10px] font-bold">Strip Legend:</span>
                            <span className="flex items-center gap-1.5 text-[#F2EEE2]">
                                <span className="w-2.5 h-2.5 rounded-xs bg-[#E0A339]" /> INT. DAY
                            </span>
                            <span className="flex items-center gap-1.5 text-[#F2EEE2]">
                                <span className="w-2.5 h-2.5 rounded-xs bg-[#F8F9FA]" /> EXT. DAY
                            </span>
                            <span className="flex items-center gap-1.5 text-[#F2EEE2]">
                                <span className="w-2.5 h-2.5 rounded-xs bg-[#3B82F6]" /> INT. NIGHT
                            </span>
                            <span className="flex items-center gap-1.5 text-[#F2EEE2]">
                                <span className="w-2.5 h-2.5 rounded-xs bg-[#22C55E]" /> EXT. NIGHT
                            </span>
                        </div>

                        {/* Strategy Selector */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[#726A5C] text-[10px] uppercase">Strategy:</span>
                            {(['balanced', 'lowest_cost', 'min_moves', 'fastest_shoot'] as OptimizationStrategy[]).map(st => (
                                <button
                                    key={st}
                                    onClick={() => setStrategy(st)}
                                    className={`px-2 py-0.5 rounded text-[10.5px] cursor-pointer transition-colors ${
                                        strategy === st
                                            ? 'bg-[#E0A339] text-[#3A2708] font-bold'
                                            : 'text-[#A9A190] hover:text-[#F2EEE2]'
                                    }`}
                                >
                                    {st.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* MAIN TWO-COLUMN / THREE-COLUMN STRIPBOARD WORKSPACE */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] overflow-hidden min-h-0">
                        
                        {/* CENTER COLUMN: HOLDING RACK & DAY BREAK STRIPS */}
                        <div className="p-4 overflow-y-auto custom-scrollbar space-y-6 bg-[#161410]">
                            
                            {/* --- HOLDING RACK / UNSCHEDULED SCENES TRAY --- */}
                            {holdingRackStrips.length > 0 && (
                                <div className="border border-dashed border-[#E0A339]/50 rounded-lg p-3.5 bg-[#1C1811] space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-[#E0A339] animate-pulse" />
                                            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#E0A339]">
                                                Holding Rack — Unscheduled Scenes ({holdingRackStrips.length})
                                            </h4>
                                        </div>
                                        <button 
                                            onClick={() => setIsHoldingRackOpen(!isHoldingRackOpen)}
                                            className="text-xs font-mono text-[#A9A190] hover:text-white cursor-pointer"
                                        >
                                            {isHoldingRackOpen ? 'Collapse [-]' : 'Expand [+]'}
                                        </button>
                                    </div>

                                    {isHoldingRackOpen && (
                                        <div className="space-y-1.5">
                                            {holdingRackStrips.map(s => (
                                                <div 
                                                    key={s.id}
                                                    onClick={() => setSelectedStripId(s.id)}
                                                    className={`strip-item strip-${s.type} flex items-center justify-between p-2 rounded border border-[rgba(242,238,226,0.1)] border-l-4 bg-[#1E1B15] cursor-pointer text-xs font-mono ${
                                                        selectedStripId === s.id ? 'selected' : ''
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className="font-bold text-[#E0A339] min-w-[32px]">#{s.sceneNo}</span>
                                                        <span className="truncate text-[#F2EEE2]">{s.slug}</span>
                                                        <span className="text-[10px] text-[#726A5C]">{s.pages} pgs</span>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <select
                                                            onChange={(e) => handleMoveStripToDay(s, Number(e.target.value))}
                                                            className="bg-[#14120E] text-[#E0A339] border border-[#E0A339]/40 rounded px-1.5 py-0.5 text-[10.5px] cursor-pointer font-mono"
                                                            defaultValue=""
                                                        >
                                                            <option value="" disabled>Assign to Day...</option>
                                                            {shootDays.map(d => (
                                                                <option key={d.dayNumber} value={d.dayNumber}>
                                                                    Day {d.dayNumber} ({d.dateStr})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* --- DAY BREAKS & SCENE STRIPS --- */}
                            {displayShootDays.length === 0 ? (
                                <div className="p-12 text-center text-[#726A5C] font-mono space-y-3 border border-dashed border-[rgba(242,238,226,0.15)] rounded">
                                    <Calendar size={32} className="mx-auto text-[#E0A339]/60" />
                                    <div className="text-sm font-semibold text-[#F2EEE2]">No shoot days in current scrubbed window</div>
                                    <p className="text-xs">Reset your scrubbed range to view all scheduled shoot days.</p>
                                    <button 
                                        onClick={() => setScrubRange([null, null])}
                                        className="px-3 py-1.5 rounded bg-[#E0A339] text-[#3A2708] text-xs font-bold uppercase cursor-pointer"
                                    >
                                        Show All Days
                                    </button>
                                </div>
                            ) : (
                                displayShootDays.map((day) => (
                                    <div key={day.dayNumber} className="space-y-2">
                                        {/* DAY BREAK BANNER (INDUSTRY STANDARD) */}
                                        <div className="p-3 rounded-lg bg-[#14120E] border border-[rgba(242,238,226,0.18)] shadow-md flex items-center justify-between gap-3 flex-wrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-[#E0A339] text-[#3A2708] font-mono font-black text-sm flex items-center justify-center">
                                                    D{day.dayNumber}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="display-font text-sm font-bold text-[#F2EEE2] uppercase">
                                                            DAY {day.dayNumber} — {day.dayOfWeek}, {formatShortDate(day.dateStr)}, 2026
                                                        </h3>
                                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#26221A] text-[#4FB0A6] border border-[#4FB0A6]/30">
                                                            {day.primaryLocation}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10.5px] font-mono text-[#A9A190] mt-0.5 flex items-center gap-2">
                                                        <span><strong>{formatFractionalPages(day.totalPages)}</strong> pgs</span>
                                                        <span>·</span>
                                                        <span><strong>{day.totalHours}h</strong> est</span>
                                                        <span>·</span>
                                                        <span><strong>{day.totalShots}</strong> shots</span>
                                                        <span>·</span>
                                                        <span className="text-[#E0A339]">
                                                            Cast: {day.workingCast.length > 0 ? day.workingCast.join(', ') : 'All Background'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Day Break Actions */}
                                            <div className="flex items-center gap-1.5 font-mono text-xs">
                                                <button
                                                    onClick={() => handleCreateCallSheetForDay(day)}
                                                    className="px-2.5 py-1 rounded bg-[#4FB0A6]/15 hover:bg-[#4FB0A6]/30 text-[#4FB0A6] border border-[#4FB0A6]/40 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                                    title="Generate call sheet for this shoot day"
                                                >
                                                    <FileText size={12} />
                                                    <span>Call Sheet</span>
                                                </button>

                                                <button
                                                    onClick={() => handleAddCompanyMoveBanner(day.dayNumber)}
                                                    className="px-2 py-1 rounded bg-[#26221A] hover:bg-[#322C22] text-[#A9A190] hover:text-[#F2EEE2] border border-[rgba(242,238,226,0.1)] flex items-center gap-1 cursor-pointer"
                                                    title="Insert Company Move between scenes"
                                                >
                                                    <Truck size={12} />
                                                    <span>Move</span>
                                                </button>

                                                <button
                                                    onClick={() => handleAddLunchBanner(day.dayNumber)}
                                                    className="px-2 py-1 rounded bg-[#26221A] hover:bg-[#322C22] text-[#A9A190] hover:text-[#F2EEE2] border border-[rgba(242,238,226,0.1)] flex items-center gap-1 cursor-pointer"
                                                    title="Insert Lunch Break banner"
                                                >
                                                    <Utensils size={12} />
                                                    <span>Lunch</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* SCENE STRIPS LIST FOR THIS DAY */}
                                        <div className="space-y-1.5 pl-1.5">
                                            {day.strips.map((s, sIdx) => {
                                                const isSelected = selectedStripId === s.id;
                                                const matchingBanner = day.banners.find(b => b.insertAfterSceneIndex === sIdx);

                                                return (
                                                    <React.Fragment key={s.id}>
                                                        {/* Strip Container */}
                                                        <div
                                                            onClick={() => setSelectedStripId(s.id)}
                                                            className={`strip-item strip-${s.type} flex items-stretch border border-[rgba(242,238,226,0.12)] border-l-8 rounded bg-[#1E1B15] cursor-pointer relative ${
                                                                isSelected ? 'selected' : ''
                                                            }`}
                                                        >
                                                            {/* Scene Number Box */}
                                                            <div className="mono text-xs text-[#E0A339] p-2.5 min-w-[42px] border-r border-[rgba(242,238,226,0.10)] flex items-center justify-center font-black">
                                                                {s.sceneNo}
                                                            </div>

                                                            {/* Main Strip Metadata */}
                                                            <div className="p-2.5 flex-1 min-w-0">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="text-[12.5px] font-bold text-[#F2EEE2] truncate">
                                                                        {s.slug}
                                                                    </div>
                                                                    <div className="mono text-[10.5px] px-1.5 py-0.5 rounded bg-[#26221A] text-[#4FB0A6] border border-[#4FB0A6]/20 shrink-0 font-bold">
                                                                        {s.pages} pgs · {s.estHours}h
                                                                    </div>
                                                                </div>

                                                                {/* Tags & Cast pills */}
                                                                <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                                                                    {s.tags.map((t, idx) => (
                                                                        <span key={idx} className="text-[9.5px] px-1.5 py-0.5 rounded bg-[#26221A] text-[#A9A190] border border-[rgba(242,238,226,0.10)] font-mono">
                                                                            {t}
                                                                        </span>
                                                                    ))}
                                                                    {s.shotCount && (
                                                                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-[#4FB0A6]/20 text-[#4FB0A6] border border-[#4FB0A6]/30 font-mono font-bold">
                                                                            {s.shotCount} Shots
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Quick Action Controls */}
                                                            <div className="flex items-center gap-1 px-2 border-l border-[rgba(242,238,226,0.08)] bg-black/20">
                                                                {/* Move to Previous Day */}
                                                                {day.dayNumber > 1 && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMoveStripToDay(s, day.dayNumber - 1);
                                                                        }}
                                                                        className="p-1 text-[#A9A190] hover:text-[#E0A339] cursor-pointer"
                                                                        title="Move scene to previous day"
                                                                    >
                                                                        <MoveUp size={12} />
                                                                    </button>
                                                                )}

                                                                {/* Move to Next Day */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleMoveStripToDay(s, day.dayNumber + 1);
                                                                    }}
                                                                    className="p-1 text-[#A9A190] hover:text-[#E0A339] cursor-pointer"
                                                                    title="Move scene to next day"
                                                                >
                                                                    <MoveDown size={12} />
                                                                </button>

                                                                {/* Edit Scene */}
                                                                <button 
                                                                    onClick={(e) => handleOpenEditModal(s, e)}
                                                                    className="p-1 text-[#A9A190] hover:text-[#E0A339] cursor-pointer"
                                                                    title="Edit Scene Details"
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>

                                                                {/* Move to Holding Rack */}
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleMoveStripToDay(s, 0);
                                                                    }}
                                                                    className="p-1 text-[#A9A190] hover:text-[#E0A339] cursor-pointer"
                                                                    title="Send to Holding Rack"
                                                                >
                                                                    <Layers size={12} />
                                                                </button>
                                                            </div>

                                                            {/* Conflict Flag */}
                                                            {s.conflictType && (
                                                                <div className="px-2 flex items-center bg-black/10">
                                                                    <span className="text-[#E0A339] text-sm" title={s.conflictTitle}>⚠️</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* INSERTED BANNER (COMPANY MOVE OR LUNCH BREAK) */}
                                                        {matchingBanner && (
                                                            <div className={`p-2.5 rounded border font-mono text-xs flex items-center justify-between ${
                                                                matchingBanner.type === 'move'
                                                                    ? 'bg-[#3A2708]/40 border-[#E0A339]/50 text-[#E0A339]'
                                                                    : 'bg-[#1E293B]/40 border-[#38BDF8]/40 text-[#38BDF8]'
                                                            }`}>
                                                                <div className="flex items-center gap-2">
                                                                    {matchingBanner.type === 'move' ? <Truck size={15} /> : <Utensils size={15} />}
                                                                    <div>
                                                                        <div className="font-bold">{matchingBanner.title}</div>
                                                                        {matchingBanner.subtitle && (
                                                                            <div className="text-[10px] text-[#A9A190]">{matchingBanner.subtitle}</div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <button 
                                                                    onClick={() => handleRemoveBanner(matchingBanner.id)}
                                                                    className="text-[#726A5C] hover:text-[#C1443A] cursor-pointer p-1"
                                                                    title="Remove banner"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* RIGHT COLUMN: SCENE INSPECTOR & CONFLICT DETECTOR */}
                        <div className="p-4 border-t lg:border-t-0 lg:border-l border-[rgba(242,238,226,0.10)] overflow-y-auto custom-scrollbar bg-[#1A1813] space-y-4">
                            
                            {/* Selected Scene Header Card */}
                            {selectedStrip && (
                                <div className="p-3.5 rounded-lg border border-[rgba(242,238,226,0.12)] bg-[#14120E] space-y-3 font-mono text-xs">
                                    <div className="flex items-start justify-between border-b border-[rgba(242,238,226,0.10)] pb-2">
                                        <div>
                                            <span className="text-[10px] font-bold text-[#E0A339] uppercase">Scene Inspector</span>
                                            <h4 className="text-sm font-bold text-[#F2EEE2] mt-0.5">Scene #{selectedStrip.sceneNo}</h4>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            selectedStrip.type === 'INTDAY' ? 'bg-[#E0A339]/20 text-[#E0A339]' :
                                            selectedStrip.type === 'EXTDAY' ? 'bg-[#F8F9FA]/20 text-[#F8F9FA]' :
                                            selectedStrip.type === 'INTNIGHT' ? 'bg-[#3B82F6]/20 text-[#3B82F6]' :
                                            'bg-[#22C55E]/20 text-[#22C55E]'
                                        }`}>
                                            {selectedStrip.type}
                                        </span>
                                    </div>

                                    <div className="text-[#A9A190] text-xs">
                                        <div className="text-[#F2EEE2] font-semibold">{selectedStrip.slug}</div>
                                        <div className="mt-1 flex items-center justify-between text-[11px]">
                                            <span>Shoot Day: <strong className="text-[#E0A339]">Day {selectedStrip.shootingDay}</strong></span>
                                            <span>Pages: <strong className="text-[#4FB0A6]">{selectedStrip.pages} pgs</strong></span>
                                        </div>
                                        <div className="mt-0.5 flex items-center justify-between text-[11px]">
                                            <span>Est. Camera: <strong className="text-[#F2EEE2]">{selectedStrip.estHours}h</strong></span>
                                            <span>Coverage: <strong className="text-[#F2EEE2]">{selectedStrip.shotCount} shots</strong></span>
                                        </div>
                                    </div>

                                    {/* Cast Involved */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-[#726A5C] uppercase font-bold">Characters & Cast:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedStrip.castNames && selectedStrip.castNames.length > 0 ? (
                                                selectedStrip.castNames.map((c, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded bg-[#26221A] text-[#F2EEE2] text-[10.5px] border border-[rgba(242,238,226,0.1)]">
                                                        {c}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[10.5px] text-[#726A5C] italic">No principal cast listed</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Conflict Box */}
                                    {selectedStrip.conflictType && (
                                        <div className="p-2.5 rounded bg-[#3A2708]/60 border border-[#E0A339]/50 space-y-1.5 text-xs">
                                            <div className="flex items-center gap-1.5 text-[#E0A339] font-bold">
                                                <AlertTriangle size={13} />
                                                <span>{selectedStrip.conflictTitle}</span>
                                            </div>
                                            {selectedStrip.conflictReasons?.map((r, i) => (
                                                <div key={i} className="text-[11px] text-[#F2EEE2]">{r}</div>
                                            ))}
                                            {selectedStrip.suggestion && (
                                                <div className="text-[10.5px] text-[#4FB0A6] italic mt-1">
                                                    1st AD Tip: {selectedStrip.suggestion}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ANCHOR CONSTRAINTS WIDGET */}
                            <div className="space-y-2.5 font-mono text-xs">
                                <h4 className="text-[10px] uppercase tracking-wider text-[#726A5C] font-bold flex items-center gap-1.5">
                                    <Lock size={12} className="text-[#E0A339]" />
                                    Production Hard Anchors ({DEFAULT_ANCHORS.length})
                                </h4>

                                <div className="space-y-2">
                                    {DEFAULT_ANCHORS.map(anc => (
                                        <div 
                                            key={anc.id}
                                            className="p-2.5 rounded border border-[rgba(242,238,226,0.10)] border-l-3 border-l-[#E0A339] bg-[#14120E] space-y-0.5"
                                        >
                                            <div className="font-bold text-[#F2EEE2]">{anc.title}</div>
                                            <div className="text-[10.5px] text-[#4FB0A6]">{anc.window}</div>
                                            {anc.notes && <div className="text-[10px] text-[#726A5C]">{anc.notes}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* RESOURCE PRESSURE BARS */}
                            <div className="space-y-2 font-mono text-xs">
                                <h4 className="text-[10px] uppercase tracking-wider text-[#726A5C] font-bold">
                                    Unit Resource Pressure
                                </h4>
                                <div className="space-y-2">
                                    {DEFAULT_RESOURCES.map((res, i) => (
                                        <div key={i} className="space-y-0.5">
                                            <div className="flex justify-between text-[10.5px]">
                                                <span className="text-[#A9A190]">{res.name}</span>
                                                <span className={`font-bold ${res.isTight ? 'text-[#E0A339]' : 'text-[#4FB0A6]'}`}>
                                                    {res.percentage}%
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full bg-[#26221A] overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${res.isTight ? 'bg-[#E0A339]' : 'bg-[#4FB0A6]'}`} 
                                                    style={{ width: `${res.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: ADD MILESTONE --- */}
            {isNewMilestoneModalOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono text-xs">
                    <div className="w-full max-w-md rounded-lg shadow-2xl border border-[rgba(242,238,226,0.2)] bg-[#1A1813] p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.12)] pb-2.5">
                            <h3 className="font-bold uppercase tracking-wider text-sm text-[#E0A339] flex items-center gap-1.5">
                                <Flag size={14} /> Add Production Milestone
                            </h3>
                            <button onClick={() => setIsNewMilestoneModalOpen(false)} className="text-[#A9A190] hover:text-white cursor-pointer">
                                <X size={15} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Milestone Title</label>
                                <input 
                                    type="text"
                                    value={newMilestoneTitle}
                                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                                    placeholder="e.g. Unit Relocation to Ooty Basecamp"
                                    className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2] outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Phase</label>
                                    <select
                                        value={newMilestonePhase}
                                        onChange={(e) => setNewMilestonePhase(e.target.value as any)}
                                        className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                    >
                                        <option value="pre">Pre-Production</option>
                                        <option value="shoot">Principal Photography</option>
                                        <option value="post">Post-Production</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Target Date</label>
                                    <input 
                                        type="date"
                                        value={newMilestoneDate}
                                        onChange={(e) => setNewMilestoneDate(e.target.value)}
                                        className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Responsible Owner</label>
                                <input 
                                    type="text"
                                    value={newMilestoneOwner}
                                    onChange={(e) => setNewMilestoneOwner(e.target.value)}
                                    placeholder="e.g. 1st AD / Line Producer"
                                    className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(242,238,226,0.10)]">
                            <button
                                onClick={() => setIsNewMilestoneModalOpen(false)}
                                className="px-3 py-1.5 rounded text-[#A9A190] hover:text-white cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!newMilestoneTitle.trim()) return;
                                    setGanttMilestones(prev => [
                                        ...prev,
                                        {
                                            id: `m-${Date.now()}`,
                                            phase: newMilestonePhase,
                                            title: newMilestoneTitle,
                                            targetDate: newMilestoneDate,
                                            status: 'scheduled',
                                            owner: newMilestoneOwner || '1st AD'
                                        }
                                    ]);
                                    setNewMilestoneTitle('');
                                    setIsNewMilestoneModalOpen(false);
                                }}
                                className="px-4 py-1.5 rounded bg-[#E0A339] text-[#3A2708] font-bold uppercase cursor-pointer"
                            >
                                Save Milestone
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: ADD READINESS CHECKLIST ITEM --- */}
            {isNewCheckModalOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono text-xs">
                    <div className="w-full max-w-md rounded-lg shadow-2xl border border-[rgba(242,238,226,0.2)] bg-[#1A1813] p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.12)] pb-2.5">
                            <h3 className="font-bold uppercase tracking-wider text-sm text-[#5E9E6E] flex items-center gap-1.5">
                                <ClipboardCheck size={14} /> Add Department Checklist Item
                            </h3>
                            <button onClick={() => setIsNewCheckModalOpen(false)} className="text-[#A9A190] hover:text-white cursor-pointer">
                                <X size={15} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Department</label>
                                    <select
                                        value={newCheckDept}
                                        onChange={(e) => setNewCheckDept(e.target.value as any)}
                                        className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                    >
                                        <option value="Direction">Direction</option>
                                        <option value="Camera">Camera</option>
                                        <option value="Art">Art</option>
                                        <option value="Wardrobe">Wardrobe</option>
                                        <option value="Stunts">Stunts</option>
                                        <option value="Sound">Sound</option>
                                        <option value="Legal">Legal</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Due Date</label>
                                    <input 
                                        type="date"
                                        value={newCheckDueDate}
                                        onChange={(e) => setNewCheckDueDate(e.target.value)}
                                        className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Sign-off Title</label>
                                <input 
                                    type="text"
                                    value={newCheckTitle}
                                    onChange={(e) => setNewCheckTitle(e.target.value)}
                                    placeholder="e.g. Drone Aviation Clearance Order"
                                    className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Responsible Head</label>
                                <input 
                                    type="text"
                                    value={newCheckOwner}
                                    onChange={(e) => setNewCheckOwner(e.target.value)}
                                    placeholder="e.g. Key Grip / Location Manager"
                                    className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(242,238,226,0.10)]">
                            <button
                                onClick={() => setIsNewCheckModalOpen(false)}
                                className="px-3 py-1.5 rounded text-[#A9A190] hover:text-white cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!newCheckTitle.trim()) return;
                                    setDepartmentChecks(prev => [
                                        ...prev,
                                        {
                                            id: `dc-${Date.now()}`,
                                            department: newCheckDept,
                                            title: newCheckTitle,
                                            owner: newCheckOwner || 'Department Lead',
                                            dueDate: newCheckDueDate,
                                            status: 'in_progress',
                                            notes: 'New item added during production planning session.'
                                        }
                                    ]);
                                    setNewCheckTitle('');
                                    setIsNewCheckModalOpen(false);
                                }}
                                className="px-4 py-1.5 rounded bg-[#5E9E6E] text-[#14120E] font-bold uppercase cursor-pointer"
                            >
                                Add Sign-off
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: EDIT SCENE DETAILS --- */}
            {editingStrip && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono text-xs">
                    <div className="w-full max-w-md rounded-lg shadow-2xl border border-[rgba(242,238,226,0.2)] bg-[#1A1813] p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.12)] pb-2.5">
                            <h3 className="font-bold uppercase tracking-wider text-sm text-[#E0A339] flex items-center gap-1.5">
                                <Edit2 size={14} /> Edit Scene Details
                            </h3>
                            <button onClick={() => setEditingStrip(null)} className="text-[#A9A190] hover:text-white cursor-pointer">
                                <X size={15} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Scene No</label>
                                    <input 
                                        type="text"
                                        value={editFormSceneNo}
                                        onChange={(e) => setEditFormSceneNo(e.target.value)}
                                        className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Setting</label>
                                    <select
                                        value={editFormPrefix}
                                        onChange={(e) => setEditFormPrefix(e.target.value)}
                                        className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                    >
                                        <option value="INT">INT</option>
                                        <option value="EXT">EXT</option>
                                        <option value="INT/EXT">INT/EXT</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Lighting</label>
                                    <select
                                        value={editFormTime}
                                        onChange={(e) => setEditFormTime(e.target.value)}
                                        className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                    >
                                        <option value="DAY">DAY</option>
                                        <option value="NIGHT">NIGHT</option>
                                        <option value="DAWN">DAWN</option>
                                        <option value="DUSK">DUSK</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Location Name</label>
                                <input 
                                    type="text"
                                    value={editFormLocation}
                                    onChange={(e) => setEditFormLocation(e.target.value)}
                                    className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] uppercase text-[#726A5C] mb-1">Scene Heading / Title</label>
                                <input 
                                    type="text"
                                    value={editFormTitle}
                                    onChange={(e) => setEditFormTitle(e.target.value)}
                                    className="w-full p-2 rounded bg-[#14120E] border border-[rgba(242,238,226,0.15)] text-[#F2EEE2]"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(242,238,226,0.10)]">
                            <button onClick={() => setEditingStrip(null)} className="px-3 py-1.5 rounded text-[#A9A190] hover:text-white cursor-pointer">
                                Cancel
                            </button>
                            <button onClick={handleSaveEdit} className="px-4 py-1.5 rounded bg-[#E0A339] text-[#3A2708] font-bold uppercase cursor-pointer">
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: 1ST AD PDF EXPORT PREVIEW --- */}
            {showPdfModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 font-mono text-xs overflow-y-auto">
                    <div className="w-full max-w-4xl rounded-lg border border-[rgba(242,238,226,0.2)] bg-[#1A1813] p-6 space-y-4 my-auto">
                        <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.15)] pb-3">
                            <div>
                                <h3 className="display-font text-base text-[#E0A339] uppercase font-bold">
                                    1st AD Stripboard Production Master Schedule
                                </h3>
                                <p className="text-xs text-[#A9A190] mt-0.5">
                                    Print-ready A4 document layout with day breaks and departmental totals.
                                </p>
                            </div>
                            <button onClick={() => setShowPdfModal(false)} className="text-[#A9A190] hover:text-white cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Printable Area */}
                        <div ref={pdfPrintRef} className="p-6 bg-white text-black rounded font-mono space-y-4">
                            <div className="border-b-2 border-black pb-3 flex justify-between items-start">
                                <div>
                                    <h1 className="text-xl font-bold uppercase tracking-wider">{currentProjectName}</h1>
                                    <div className="text-xs uppercase text-gray-700">1st AD MASTER SHOOTING SCHEDULE</div>
                                    <div className="text-[11px] text-gray-500 mt-1">Generated by Backstage Production OS</div>
                                </div>
                                <div className="text-right text-xs">
                                    <div>Total Shoot Days: <strong>{totalShootDaysCount}</strong></div>
                                    <div>Total Scenes: <strong>{totalScenesCount}</strong></div>
                                    <div>Total Pages: <strong>{totalPagesFraction}</strong></div>
                                    <div>Total Shots: <strong>{totalShotsCount}</strong></div>
                                </div>
                            </div>

                            {/* Schedule Summary Rows */}
                            <div className="space-y-3">
                                {shootDays.map(day => (
                                    <div key={day.dayNumber} className="border border-gray-400 p-2 rounded text-xs space-y-1">
                                        <div className="font-bold flex justify-between bg-gray-200 p-1">
                                            <span>DAY {day.dayNumber} — {day.dayOfWeek}, {formatShortDate(day.dateStr)} ({day.primaryLocation})</span>
                                            <span>{formatFractionalPages(day.totalPages)} pgs · {day.totalShots} shots · {day.totalHours}h</span>
                                        </div>
                                        <div className="space-y-0.5 pt-1">
                                            {day.strips.map(s => (
                                                <div key={s.id} className="flex justify-between text-[11px] border-b border-gray-200 py-0.5">
                                                    <span><strong>#{s.sceneNo}</strong> {s.slug} ({s.type})</span>
                                                    <span>{s.pages} pgs · Cast: {s.castNames?.join(', ') || 'N/A'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-[rgba(242,238,226,0.12)]">
                            <button
                                onClick={() => setShowPdfModal(false)}
                                className="px-4 py-2 rounded text-[#A9A190] hover:text-white cursor-pointer"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleExportPdf}
                                disabled={isExportingPdf}
                                className="px-5 py-2 rounded bg-[#E0A339] text-[#3A2708] font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md hover:bg-[#d09329]"
                            >
                                <Download size={14} />
                                {isExportingPdf ? 'Generating PDF...' : 'Download PDF Document'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleView;
