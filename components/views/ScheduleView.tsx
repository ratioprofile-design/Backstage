import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Shot, Beat } from '../../types';
import LocationScoutView from './LocationScoutView';
import { 
    AlertTriangle, AlertCircle, CheckCircle2,
    Lock, Unlock, ShieldAlert, Sparkles, Printer, RotateCcw,
    X, ChevronRight, FileText, Download, Calendar, RefreshCw,
    ChevronLeft, Filter, Layers, Zap, Clock, Eye, Sliders,
    Search, CheckSquare, Square, Users, MapPin, Wrench, Shield,
    Check, Plus, ArrowRight, ListFilter, AlertOctagon, Edit2, Trash2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// --- TYPES & INTERFACES ---
export type OptimizationStrategy = 'balanced' | 'lowest_cost' | 'fastest_shoot' | 'max_actor_eff' | 'min_moves' | 'min_continuity_risk';

export type StripType = 'INTDAY' | 'INTNIGHT' | 'EXTDAY' | 'EXTNIGHT';

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

export interface StripItem {
    id: string;
    sceneNo: string;
    slug: string;
    type: StripType;
    tags: string[];
    scheduledDate: string; // YYYY-MM-DD
    conflictType?: 'warn' | 'hard';
    conflictTitle?: string;
    conflictReasons?: string[];
    suggestion?: string;
    shotCount?: number;
    shotIds?: string[];
}

export interface BlockGroup {
    id: string;
    title: string;
    meta: string;
    lockState: 'hard' | 'soft' | 'unlocked';
    strips: StripItem[];
}

export interface WhatIfRipple {
    label: string;
    rows: Array<{
        metric: string;
        delta: string;
        status: 'good' | 'bad';
    }>;
}

// Helper formatting function for YYYY-MM-DD
const formatDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const parseDateStr = (str: string): Date => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// Format short date string e.g. "Aug 12"
const formatShortDate = (str: string): string => {
    if (!str) return '';
    const date = parseDateStr(str);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Helper function to build blocks from beats
const buildBlocksFromBeats = (beatsList: Beat[], shotsList: Shot[]): BlockGroup[] => {
    if (!beatsList || beatsList.length === 0) return [];

    const groupsMap: Record<string, StripItem[]> = {};
    beatsList.forEach((b, idx) => {
        const scNo = b.sceneNumber || String(idx + 1);
        const prefix = b.slug?.prefix || 'EXT';
        const loc = (b.slug?.location || 'LOCATION').trim();
        const time = (b.slug?.time || 'DAY').trim();
        const isNight = time.toUpperCase().includes('NIGHT') || time.toUpperCase().includes('இரவு') || time.toUpperCase().includes('நள்ளிரவு');
        const isExt = prefix.toUpperCase().includes('EXT');

        let stType: StripType = 'EXTDAY';
        if (isExt && isNight) stType = 'EXTNIGHT';
        else if (!isExt && isNight) stType = 'INTNIGHT';
        else if (!isExt && !isNight) stType = 'INTDAY';

        const groupKey = `${loc.toUpperCase()} — ${isExt ? 'EXT' : 'INT'}`;
        if (!groupsMap[groupKey]) groupsMap[groupKey] = [];

        // Schedule dates sequentially starting 2026-08-10
        const d = new Date(2026, 7, 10 + Math.floor(idx / 2));
        const scheduledDate = formatDateStr(d);

        const castTags = b.breakdown?.cast?.map(c => typeof c === 'string' ? c : (c as any).name).filter(Boolean) || [];

        groupsMap[groupKey].push({
            id: `strip-${b.id}`,
            sceneNo: scNo,
            slug: b.title || `${loc} (${prefix} ${time})`,
            type: stType,
            tags: castTags.length > 0 ? castTags : [time, prefix],
            scheduledDate,
            shotCount: shotsList.filter(s => String(s.scene) === scNo).length
        });
    });

    return Object.entries(groupsMap).map(([title, strips], gIdx) => ({
        id: `blk-dyn-${gIdx}`,
        title,
        meta: `${strips.length} ${strips.length === 1 ? 'scene' : 'scenes'} · scheduled`,
        lockState: gIdx === 0 ? 'hard' : 'soft',
        strips
    }));
};

const DEFAULT_ANCHORS: AnchorItem[] = [];
const DEFAULT_RESOURCES: ResourcePressure[] = [];

const STRATEGY_NOTES: Record<OptimizationStrategy, string> = {
    balanced: 'Balancing cost, moves and continuity risk evenly. No single metric dominates.',
    lowest_cost: 'Reordering to shrink company moves first.',
    fastest_shoot: 'Compressing to fewest calendar days.',
    max_actor_eff: "Clustering everything around main cast availability.",
    min_moves: 'Minimizing unit relocations across locations.',
    min_continuity_risk: "Prioritizing costume, makeup and injury continuity."
};

const DEFAULT_BLOCKS: BlockGroup[] = [];

const WHAT_IF_RIPPLES: Record<string, WhatIfRipple> = {};

const ScheduleView: React.FC = () => {
    const project = useProject() || {};
    const generatedShots: Shot[] = project.generatedShots || [];
    const beats: Beat[] = project.beats || [];
    const appTheme = project.appTheme || 'dark';
    const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
    const projectList = project.projectList || [];
    const currentProjectId = project.currentProjectId;
    const currentProjectName = projectList.find((p: any) => p.id === currentProjectId)?.name || 'PROJECT';

    // Strategy & UI States
    const [scheduleTab, setScheduleTab] = useState<'stripboard' | 'locations'>('locations');
    const [strategy, setStrategy] = useState<OptimizationStrategy>('balanced');
    const [selectedStripId, setSelectedStripId] = useState<string>('1');
    const [activeWhatIfKey, setActiveWhatIfKey] = useState<string | null>(null);

    // Multi-Month Calendar States
    const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(true);
    const [monthCount, setMonthCount] = useState<number>(2); // 1, 2, 3, 4
    const [startYear, setStartYear] = useState<number>(2026);
    const [startMonthIndex, setStartMonthIndex] = useState<number>(7); // 0-indexed (7 = August)
    
    // Scrubbed Range State [startDateStr, endDateStr] e.g. ["2026-08-10", "2026-08-18"]
    const [scrubRange, setScrubRange] = useState<[string | null, string | null]>(['2026-08-10', '2026-08-18']);
    const [isDraggingScrub, setIsDraggingScrub] = useState<boolean>(false);
    const [dragStartDay, setDragStartDay] = useState<string | null>(null);

    // Filter Mode toggle for scrubbed range: 'all_highlighted' vs 'scrubbed_only'
    const [filterByScrubbedOnly, setFilterByScrubbedOnly] = useState<boolean>(false);

    // Popup Modal State for Scene Selection on Scrubbed Days
    const [isScrubModalOpen, setIsScrubModalOpen] = useState<boolean>(false);
    const [popupSearch, setPopupSearch] = useState<string>('');
    const [popupLocation, setPopupLocation] = useState<string>('ALL');
    const [popupType, setPopupType] = useState<string>('ALL');
    const [popupCast, setPopupCast] = useState<string>('ALL');
    const [popupEquipment, setPopupEquipment] = useState<string>('ALL');
    const [popupStatus, setPopupStatus] = useState<string>('ALL');
    const [selectedSceneIdsForScrub, setSelectedSceneIdsForScrub] = useState<string[]>([]);

    // Edit & Delete strip state
    const [editingStrip, setEditingStrip] = useState<StripItem | null>(null);
    const [editFormTitle, setEditFormTitle] = useState('');
    const [editFormSceneNo, setEditFormSceneNo] = useState('');
    const [editFormPrefix, setEditFormPrefix] = useState('INT');
    const [editFormLocation, setEditFormLocation] = useState('');
    const [editFormTime, setEditFormTime] = useState('DAY');

    const handleOpenEditModal = (s: StripItem, e: React.MouseEvent) => {
        e.stopPropagation();
        const beatId = Number(s.id.replace('strip-', ''));
        const beat = beats.find(b => b.id === beatId);
        
        setEditingStrip(s);
        setEditFormTitle(beat?.title || '');
        setEditFormSceneNo(beat?.sceneNumber || s.sceneNo);
        setEditFormPrefix(beat?.slug?.prefix || 'INT');
        setEditFormLocation(beat?.slug?.location || '');
        setEditFormTime(beat?.slug?.time || 'DAY');
    };

    const handleSaveEdit = () => {
        if (!editingStrip) return;
        const beatId = Number(editingStrip.id.replace('strip-', ''));
        if (project.updateBeat) {
            project.updateBeat(beatId, {
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

    const handleDeleteStrip = (stripId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const beatId = Number(stripId.replace('strip-', ''));
        if (confirm('Are you sure you want to delete this scene?')) {
            if (project.setBeats) {
                project.setBeats((prev: Beat[]) => prev.filter((b: Beat) => b.id !== beatId));
            }
            if (selectedStripId === stripId) {
                setSelectedStripId('');
            }
        }
    };

    // Shot Division Sync Status
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(new Date().toLocaleTimeString());
    const [syncedShotCount, setSyncedShotCount] = useState<number>(generatedShots.length);

    // Master Blocks State - populated from project beats
    const computedBlocks = useMemo(() => buildBlocksFromBeats(beats, generatedShots), [beats, generatedShots]);
    const [blocks, setBlocks] = useState<BlockGroup[]>(computedBlocks);

    const prevComputedRef = useRef(computedBlocks);
    useEffect(() => {
        if (JSON.stringify(prevComputedRef.current) !== JSON.stringify(computedBlocks)) {
            prevComputedRef.current = computedBlocks;
            setBlocks(computedBlocks);
        }
    }, [computedBlocks]);

    // --- SYNC SHOT DIVISION DATA INTO STRIPBOARD ---
    const handleSyncShotDivision = () => {
        if (!generatedShots || generatedShots.length === 0) {
            setBlocks(buildBlocksFromBeats(beats, []));
            setSyncedShotCount(0);
            setLastSyncTime(new Date().toLocaleTimeString());
            return;
        }

        // Group generatedShots by scene number or location
        const sceneMap: Record<string, Shot[]> = {};
        generatedShots.forEach((s) => {
            const scKey = String(s.scene || '1');
            if (!sceneMap[scKey]) sceneMap[scKey] = [];
            sceneMap[scKey].push(s);
        });

        const newBlocks: BlockGroup[] = [];
        let dateCounter = new Date(2026, 7, 10); // Start Aug 10, 2026

        const sceneKeys = Object.keys(sceneMap).sort((a, b) => Number(a) - Number(b));
        
        // Group into Hospital, Exterior, Action, General blocks
        const hospitalStrips: StripItem[] = [];
        const exteriorStrips: StripItem[] = [];
        const actionStrips: StripItem[] = [];
        const generalStrips: StripItem[] = [];

        sceneKeys.forEach((scNum, idx) => {
            const shots = sceneMap[scNum];
            const firstShot = shots[0];
            const descUpper = (firstShot.description || firstShot.subject || '').toUpperCase();
            
            const isNight = descUpper.includes('NIGHT');
            const isExt = descUpper.includes('EXT') || descUpper.includes('OUTDOOR');
            let stType: StripType = 'INTDAY';
            if (isExt && isNight) stType = 'EXTNIGHT';
            else if (isExt) stType = 'EXTDAY';
            else if (isNight) stType = 'INTNIGHT';

            const scheduledDate = formatDateStr(dateCounter);
            dateCounter.setDate(dateCounter.getDate() + 1);

            const tags = Array.from(new Set([
                firstShot.shotSize || 'MEDIUM',
                firstShot.lens || '35mm',
                firstShot.movement || 'Static',
                ...shots.map(st => st.subject).filter(Boolean)
            ])).slice(0, 3);

            const stripItem: StripItem = {
                id: `sync-sc-${scNum}`,
                sceneNo: scNum,
                slug: firstShot.subject || firstShot.description?.substring(0, 35) || `Scene ${scNum} Coverage`,
                type: stType,
                scheduledDate,
                tags,
                shotCount: shots.length,
                shotIds: shots.map(s => s.id)
            };

            if (idx === 1) {
                stripItem.conflictType = 'warn';
                stripItem.conflictTitle = `Scene ${scNum} — child artist hours`;
                stripItem.conflictReasons = ['5h morning camera cap applies to child artist in this setup.'];
                stripItem.suggestion = 'Prioritize closeups in first 3 hours.';
            }

            if (descUpper.includes('HOSPITAL') || descUpper.includes('ICU')) {
                hospitalStrips.push(stripItem);
            } else if (descUpper.includes('NIGHT') || descUpper.includes('FIGHT') || descUpper.includes('CHASE')) {
                actionStrips.push(stripItem);
            } else if (isExt) {
                exteriorStrips.push(stripItem);
            } else {
                generalStrips.push(stripItem);
            }
        });

        // Assemble blocks
        if (hospitalStrips.length > 0) {
            newBlocks.push({
                id: 'blk-hosp-sync',
                title: 'HOSPITAL / INT SETS',
                meta: `${hospitalStrips.length} scenes · hard locked`,
                lockState: 'hard',
                strips: hospitalStrips
            });
        }

        if (exteriorStrips.length > 0) {
            newBlocks.push({
                id: 'blk-[#E0A339]',
                title: 'EXTERIOR LOCATIONS',
                meta: `${exteriorStrips.length} scenes · soft locked`,
                lockState: 'soft',
                strips: exteriorStrips
            });
        }

        if (actionStrips.length > 0) {
            newBlocks.push({
                id: 'blk-action-sync',
                title: 'NIGHT / ACTION STUNTS',
                meta: `${actionStrips.length} scenes · unlocked`,
                lockState: 'unlocked',
                strips: actionStrips
            });
        }

        if (generalStrips.length > 0) {
            newBlocks.push({
                id: 'blk-general-sync',
                title: 'PRINCIPAL PHOTOGRAPHY',
                meta: `${generalStrips.length} scenes`,
                lockState: 'soft',
                strips: generalStrips
            });
        }

        // Fallback if empty groupings
        if (newBlocks.length === 0) {
            newBlocks.push({
                id: 'blk-shotdivision',
                title: 'SHOT DIVISION SCENES',
                meta: `${generatedShots.length} total shots synchronized`,
                lockState: 'soft',
                strips: sceneKeys.map((scNum, i) => {
                    const shots = sceneMap[scNum];
                    return {
                        id: `sc-${scNum}`,
                        sceneNo: scNum,
                        slug: shots[0]?.subject || shots[0]?.description || `Scene ${scNum}`,
                        type: 'INTDAY',
                        scheduledDate: formatDateStr(new Date(2026, 7, 10 + i)),
                        tags: [shots[0]?.shotSize || 'MEDIUM', `${shots.length} shots`]
                    };
                })
            });
        }

        setBlocks(newBlocks);
        setSyncedShotCount(generatedShots.length);
        setLastSyncTime(new Date().toLocaleTimeString());
    };

    // Sync on initial mount or when generatedShots changes
    useEffect(() => {
        if (generatedShots && generatedShots.length > 0) {
            handleSyncShotDivision();
        }
    }, [generatedShots.length]);

    // Check if date falls in scrubbed range
    const isDateInScrubbedRange = (dateStr: string): boolean => {
        if (!scrubRange[0] || !scrubRange[1] || !dateStr) return false;
        const start = scrubRange[0] < scrubRange[1] ? scrubRange[0] : scrubRange[1];
        const end = scrubRange[0] < scrubRange[1] ? scrubRange[1] : scrubRange[0];
        return dateStr >= start && dateStr <= end;
    };

    // Filtered Blocks based on scrubbed dates if filterByScrubbedOnly is true
    const displayBlocks = useMemo(() => {
        if (!filterByScrubbedOnly || !scrubRange[0] || !scrubRange[1]) return blocks;

        return blocks.map(b => ({
            ...b,
            strips: b.strips.filter(s => isDateInScrubbedRange(s.scheduledDate))
        })).filter(b => b.strips.length > 0);
    }, [blocks, filterByScrubbedOnly, scrubRange]);

    // Selected Strip & Conflict lookup
    const selectedStrip = useMemo(() => {
        for (const b of blocks) {
            const found = b.strips.find(s => s.id === selectedStripId);
            if (found) return found;
        }
        return blocks[0]?.strips[0];
    }, [blocks, selectedStripId]);

    // Count scenes in scrubbed range
    const scrubbedSceneCount = useMemo(() => {
        let count = 0;
        blocks.forEach(b => {
            b.strips.forEach(s => {
                if (isDateInScrubbedRange(s.scheduledDate)) count++;
            });
        });
        return count;
    }, [blocks, scrubRange]);

    // Health Score calculation dynamically adjusts if scrubbing active window
    const healthScore = useMemo(() => {
        let score = 78;
        if (strategy === 'lowest_cost') score = 84;
        if (strategy === 'fastest_shoot') score = 69;
        if (strategy === 'max_actor_eff') score = 88;
        if (strategy === 'min_moves') score = 91;
        if (strategy === 'min_continuity_risk') score = 86;

        // If scrubbed window contains hard conflict (Aug 11 Scene 13)
        if (isDateInScrubbedRange('2026-08-11')) {
            score -= 6;
        }
        return Math.max(50, Math.min(99, score));
    }, [strategy, scrubRange]);

    // PDF Call Sheet modal
    const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
    const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
    const pdfPrintRef = useRef<HTMLDivElement>(null);

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
            pdf.save(`${currentProjectName.replace(/\s+/g, '_')}_1stAD_Schedule.pdf`);
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
            // Padding empty slots
            for (let p = 0; p < firstDayOfWeek; p++) {
                daysArray.push(null);
            }
            // Days
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = formatDateStr(new Date(year, month, d));
                
                // Find strips on this date
                const stripsOnDay: StripItem[] = [];
                blocks.forEach(b => {
                    b.strips.forEach(s => {
                        if (s.scheduledDate === dateStr) stripsOnDay.push(s);
                    });
                });

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
    }, [startYear, startMonthIndex, monthCount, blocks]);

    // Calendar Drag & Scrub Handlers
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

    // Quick range presets
    const applyScrubPreset = (range: [string, string] | null) => {
        if (!range) {
            setScrubRange([null, null]);
        } else {
            setScrubRange(range);
        }
    };

    // All flattened strips across blocks for popup filtering & dependency calculations
    const allStrips = useMemo(() => {
        const stripsList: (StripItem & { blockTitle: string })[] = [];
        blocks.forEach(b => {
            b.strips.forEach(s => {
                stripsList.push({ ...s, blockTitle: b.title });
            });
        });
        return stripsList;
    }, [blocks]);

    // Pre-select scene IDs when scrub range changes
    useEffect(() => {
        if (scrubRange[0] && scrubRange[1]) {
            const inRangeIds = allStrips
                .filter(s => isDateInScrubbedRange(s.scheduledDate))
                .map(s => s.id);
            if (inRangeIds.length > 0) {
                setSelectedSceneIdsForScrub(inRangeIds);
            } else {
                setSelectedSceneIdsForScrub(allStrips.slice(0, 4).map(s => s.id));
            }
        }
    }, [scrubRange[0], scrubRange[1], allStrips]);

    // Filtered candidate strips in popup
    const filteredPopupStrips = useMemo(() => {
        return allStrips.filter(s => {
            if (popupSearch.trim()) {
                const q = popupSearch.toLowerCase();
                const matchSc = s.sceneNo.toLowerCase().includes(q);
                const matchSlug = s.slug.toLowerCase().includes(q);
                const matchTags = s.tags.some(t => t.toLowerCase().includes(q));
                const matchBlock = s.blockTitle.toLowerCase().includes(q);
                if (!matchSc && !matchSlug && !matchTags && !matchBlock) return false;
            }

            if (popupLocation !== 'ALL') {
                const locUpper = popupLocation.toUpperCase();
                const slugUpper = s.slug.toUpperCase();
                const blockUpper = s.blockTitle.toUpperCase();
                if (locUpper === 'EXTERIOR' && !s.type.startsWith('EXT')) return false;
                if (locUpper === 'INTERIOR' && !s.type.startsWith('INT')) return false;
                if (locUpper === 'HOSPITAL' && !slugUpper.includes('HOSPITAL') && !blockUpper.includes('HOSPITAL') && !slugUpper.includes('ICU')) return false;
                if (locUpper === 'VILLAGE' && !slugUpper.includes('VILLAGE') && !blockUpper.includes('VILLAGE') && !slugUpper.includes('WELL')) return false;
                if (locUpper === 'PALACE' && !slugUpper.includes('PALACE') && !blockUpper.includes('PALACE')) return false;
                if (locUpper === 'NIGHT' && !s.type.endsWith('NIGHT')) return false;
            }

            if (popupType !== 'ALL' && s.type !== popupType) return false;

            if (popupCast !== 'ALL') {
                const castQuery = popupCast.toLowerCase();
                const matchCast = s.tags.some(t => t.toLowerCase().includes(castQuery)) || s.slug.toLowerCase().includes(castQuery);
                if (!matchCast) return false;
            }

            if (popupEquipment !== 'ALL') {
                const eqQuery = popupEquipment.toLowerCase();
                const matchEq = s.tags.some(t => t.toLowerCase().includes(eqQuery));
                if (!matchEq) return false;
            }

            if (popupStatus === 'SCHEDULED_IN_RANGE') {
                if (!isDateInScrubbedRange(s.scheduledDate)) return false;
            } else if (popupStatus === 'CONFLICTS') {
                if (!s.conflictType) return false;
            }

            return true;
        });
    }, [allStrips, popupSearch, popupLocation, popupType, popupCast, popupEquipment, popupStatus, scrubRange]);

    // Compute Dependencies Summary for selected scenes in scrubbed range
    const scrubbedDependenciesSummary = useMemo(() => {
        if (!scrubRange[0] || !scrubRange[1]) return null;

        const startStr = scrubRange[0] < scrubRange[1] ? scrubRange[0] : scrubRange[1];
        const endStr = scrubRange[0] < scrubRange[1] ? scrubRange[1] : scrubRange[0];
        const startDate = parseDateStr(startStr);
        const endDate = parseDateStr(endStr);
        const diffDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1);

        const selectedStrips = allStrips.filter(s => selectedSceneIdsForScrub.includes(s.id));

        const totalShots = selectedStrips.reduce((acc, s) => acc + (s.shotCount || 8), 0);
        const totalPages = (selectedStrips.length * 1.5).toFixed(1);
        const totalEstHours = (selectedStrips.length * 3.2).toFixed(1);

        const castSet = new Set<string>();
        selectedStrips.forEach(s => {
            s.tags.forEach(t => {
                if (['Arjun', 'Meera', 'Vikram Rana', 'Inspector Rao', 'Dr. Fernandes', 'Nurse Priya'].some(c => t.toLowerCase().includes(c.toLowerCase()))) {
                    castSet.add(t);
                }
            });
            if (s.slug.toLowerCase().includes('arjun') || s.slug.toLowerCase().includes('vikram')) castSet.add('Vikram Rana (Arjun)');
            if (s.slug.toLowerCase().includes('meera')) castSet.add('Meera (Child Artist)');
        });
        if (castSet.size === 0 && selectedStrips.length > 0) {
            // Fallback to tags that are uppercase (often characters) or first few tags
            selectedStrips.flatMap(s => s.tags).slice(0, 3).forEach(t => castSet.add(t));
        }

        const locationSet = new Set<string>();
        selectedStrips.forEach(s => {
            if (s.slug.toUpperCase().includes('ICU') || s.slug.toUpperCase().includes('HOSPITAL')) locationSet.add('Hospital ICU Set (INT)');
            else if (s.slug.toUpperCase().includes('WELL') || s.slug.toUpperCase().includes('VILLAGE')) locationSet.add('Village Square & Well (EXT)');
            else if (s.slug.toUpperCase().includes('PALACE') || s.slug.toUpperCase().includes('CORONATION')) locationSet.add('Heritage Palace Hall (INT)');
            else if (s.slug.toUpperCase().includes('WAREHOUSE') || s.slug.toUpperCase().includes('ROOFTOP')) locationSet.add('Warehouse Industrial Complex (EXT)');
            else locationSet.add(`${s.blockTitle || 'General'} Location`);
        });

        const equipSet = new Set<string>();
        selectedStrips.forEach(s => {
            s.tags.forEach(t => {
                if (['Stunts', 'Drone', 'SFX fire', 'Vehicles', 'Animals', 'Crowd', 'Bandages', '35mm', 'Handheld', 'Gimbal'].some(e => t.toLowerCase().includes(e.toLowerCase()))) {
                    equipSet.add(t);
                }
            });
        });
        if (equipSet.size === 0 && selectedStrips.length > 0) {
            // No hardcoded equipment fallback
        }

        const warnings: string[] = [];
        selectedStrips.forEach(s => {
            if (s.conflictReasons) {
                warnings.push(...s.conflictReasons);
            }
        });

        const relevantAnchors = DEFAULT_ANCHORS.filter(anc => {
            return isDateInScrubbedRange(anc.startDate) || isDateInScrubbedRange(anc.endDate);
        });

        return {
            startStr,
            endStr,
            diffDays,
            selectedCount: selectedStrips.length,
            totalShots,
            totalPages,
            totalEstHours,
            castList: Array.from(castSet),
            locations: Array.from(locationSet),
            equipment: Array.from(equipSet),
            warnings,
            anchors: relevantAnchors,
            selectedStrips
        };
    }, [scrubRange, selectedSceneIdsForScrub, allStrips]);

    // Confirm scene scheduling assignment
    const handleConfirmAssignScenesToRange = () => {
        if (!scrubRange[0] || !scrubRange[1]) {
            setIsScrubModalOpen(false);
            return;
        }

        const start = scrubRange[0] < scrubRange[1] ? scrubRange[0] : scrubRange[1];
        const end = scrubRange[0] < scrubRange[1] ? scrubRange[1] : scrubRange[0];
        
        const startDate = parseDateStr(start);
        const endDate = parseDateStr(end);
        const dates: string[] = [];
        let curr = new Date(startDate);
        while (curr <= endDate) {
            dates.push(formatDateStr(curr));
            curr.setDate(curr.getDate() + 1);
        }

        setBlocks(prevBlocks => {
            let dateIdx = 0;
            return prevBlocks.map(blk => ({
                ...blk,
                strips: blk.strips.map(s => {
                    if (selectedSceneIdsForScrub.includes(s.id)) {
                        const targetDate = dates[dateIdx % dates.length];
                        dateIdx++;
                        return {
                            ...s,
                            scheduledDate: targetDate
                        };
                    }
                    return s;
                })
            }));
        });

        setIsScrubModalOpen(false);
    };

    return (
        <div 
            className="w-full min-h-full lg:h-full bg-[#161410] text-[#F2EEE2] font-sans flex flex-col overflow-y-auto custom-scrollbar selection:bg-[#E0A339] selection:text-[#3A2708]"
            onMouseUp={handleDayMouseUp}
        >
            {/* INLINE THEME STYLES */}
            <style>{`
                .mono { font-family: 'IBM Plex Mono', monospace; }
                .display-font { font-family: 'Special Elite', monospace; letter-spacing: 0.5px; }

                .strip-INTDAY { border-left-color: #F2EEE2 !important; }
                .strip-INTNIGHT { border-left-color: #E8C547 !important; }
                .strip-EXTDAY { border-left-color: #5B8DBE !important; }
                .strip-EXTNIGHT { border-left-color: #5E9E6E !important; }

                .strip-item {
                    transition: transform 0.12s ease, border-color 0.12s ease;
                }
                .strip-item:hover {
                    transform: translateX(3px);
                    border-color: rgba(242,238,226,0.25);
                }
                .strip-item.selected {
                    transform: translateX(3px);
                    box-shadow: 0 0 0 1px #4FB0A6;
                    border-color: #4FB0A6 !important;
                }

                ::-webkit-scrollbar { height: 6px; width: 6px; }
                ::-webkit-scrollbar-thumb { background: rgba(242,238,226,0.22); border-radius: 3px; }
                ::-webkit-scrollbar-track { background: transparent; }
            `}</style>

            {/* --- HEADER --- */}
            <header className="px-6 py-3.5 border-b border-[rgba(242,238,226,0.10)] flex items-center justify-between gap-4 flex-wrap bg-[#161410] shrink-0">
                <div className="flex items-center gap-4">
                    <svg className="w-8 h-8 text-[#E0A339] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M3 8.5 20.5 5l.8 3.9L3.8 12.4z"/>
                        <rect x="3" y="8.5" width="18" height="11" rx="0.5"/>
                        <path d="M6 8.5 8.5 5M11 8.5 13.5 5M16 8.5 18.5 5" strokeWidth="1.4"/>
                    </svg>
                    <div className="flex flex-col gap-0.5">
                        <div className="display-font text-xl uppercase tracking-wider text-[#F2EEE2] flex items-center gap-2">
                            {currentProjectName.toUpperCase()} — STRIPBOARD & SCHEDULE
                        </div>
                        <div className="text-[11px] text-[#726A5C] tracking-[1.5px] uppercase font-mono flex items-center gap-2">
                            42 shoot days · Chennai / Ooty / Kochi
                            <span className="text-[#4FB0A6] flex items-center gap-1 font-semibold">
                                • Synced with Shot Division ({syncedShotCount} Shots)
                            </span>
                        </div>
                    </div>
                </div>

                {/* Header Controls */}
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={handleSyncShotDivision}
                        className="px-3 py-1.5 rounded text-xs font-mono font-semibold uppercase border border-[#4FB0A6]/40 bg-[#4FB0A6]/10 text-[#4FB0A6] hover:bg-[#4FB0A6]/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Re-synchronize strips with Shot Division shots"
                    >
                        <RefreshCw size={13} className="animate-spin-once" />
                        Sync Shot Division
                    </button>

                    <button 
                        onClick={() => setShowPdfModal(true)}
                        className="px-3.5 py-1.5 rounded text-xs font-mono font-bold uppercase border border-[rgba(242,238,226,0.22)] bg-[#1E1B15] text-[#F2EEE2] hover:bg-[#26221A] transition-colors flex items-center gap-2 cursor-pointer"
                    >
                        <Printer size={14} className="text-[#E0A339]" /> Export 1st AD PDF
                    </button>

                    {/* Health Ring */}
                    <div className="flex items-center gap-3 pl-2 border-l border-[rgba(242,238,226,0.10)]">
                        <div className="relative w-10 h-10 flex items-center justify-center">
                            <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 46 46">
                                <circle cx="23" cy="23" r="19" fill="none" stroke="#26221A" strokeWidth="4"/>
                                <circle 
                                    cx="23" cy="23" r="19" fill="none" 
                                    stroke="#E0A339" strokeWidth="4"
                                    strokeDasharray="119.4"
                                    strokeDashoffset={119.4 - (119.4 * healthScore) / 100}
                                    strokeLinecap="round"
                                />
                            </svg>
                        </div>
                        <div>
                            <div className="mono text-xl font-medium text-[#F2EEE2] leading-none">
                                {healthScore}
                            </div>
                            <div className="text-[9.5px] text-[#726A5C] uppercase tracking-[1.5px] mt-0.5">
                                Health
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* --- SCHEDULE SUB-SECTION TABS (PRIORITY 1 & PRIORITY 2) --- */}
            <div className="flex items-center gap-1 border-b border-[rgba(242,238,226,0.15)] bg-[#0A0908] px-4 pt-1.5 shrink-0 font-mono text-xs">
                <button
                    onClick={() => setScheduleTab('locations')}
                    className={`px-4 py-2 font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-t border-x rounded-none ${
                        scheduleTab === 'locations' 
                            ? 'bg-[#14120E] text-[#E0A339] border-[#E0A339] shadow-xs' 
                            : 'bg-transparent text-[#A9A190] border-transparent hover:text-[#F2EEE2]'
                    }`}
                >
                    <MapPin size={14} className="text-[#4FB0A6]" />
                    <span>Priority 1: Planning (Scene Location vs Real Location)</span>
                </button>

                <button
                    onClick={() => setScheduleTab('stripboard')}
                    className={`px-4 py-2 font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-t border-x rounded-none ${
                        scheduleTab === 'stripboard' 
                            ? 'bg-[#14120E] text-[#E0A339] border-[#E0A339] shadow-xs' 
                            : 'bg-transparent text-[#A9A190] border-transparent hover:text-[#F2EEE2]'
                    }`}
                >
                    <Calendar size={14} />
                    <span>Priority 2: Scheduling (Stripboard & Day Timeline)</span>
                </button>
            </div>

            {scheduleTab === 'locations' ? (
                <div className="flex-1 overflow-hidden min-h-0 w-full h-full">
                    <LocationScoutView />
                </div>
            ) : (
                <>
                    {/* --- MULTI-MONTH SCRUBBABLE CALENDAR BAR --- */}
            <div className="border-b border-[rgba(242,238,226,0.10)] bg-[#1A1813] p-4 shrink-0 space-y-3">
                {/* Calendar Header Controls */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                            className="flex items-center gap-1.5 text-xs font-mono text-[#E0A339] font-bold uppercase tracking-wider hover:text-[#F2EEE2] transition-colors cursor-pointer bg-transparent border-none p-0 group"
                            title={isCalendarOpen ? "Click to toggle off calendar" : "Click to expand calendar"}
                        >
                            <span className="font-mono text-sm text-[#E0A339] font-bold leading-none w-3 text-center">
                                {isCalendarOpen ? 'v' : '>'}
                            </span>
                            <Calendar size={15} />
                            <span>Interactive Calendar (Scrubbable Dates)</span>
                            <span className="text-[10px] text-[#726A5C] font-normal normal-case ml-1 group-hover:text-[#A9A190]">
                                ({isCalendarOpen ? 'click to collapse' : 'click to expand'})
                            </span>
                        </button>

                        {/* Month Navigation - shown when calendar open */}
                        {isCalendarOpen && (
                            <div className="flex items-center gap-1 bg-[#161410] border border-[rgba(242,238,226,0.15)] rounded p-0.5">
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
                                    <ChevronLeft size={14} />
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
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Month Count Switcher & Scrubbed Range Pill */}
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Month choice dropdown/pills - shown when open */}
                        {isCalendarOpen && (
                            <div className="flex items-center gap-1.5 text-xs font-mono">
                                <span className="text-[#726A5C] uppercase tracking-wider text-[10px]">View Months:</span>
                                {[1, 2, 3, 4].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setMonthCount(num)}
                                        className={`px-2 py-0.5 rounded text-[11px] cursor-pointer transition-colors border ${
                                            monthCount === num 
                                                ? 'bg-[#E0A339] border-[#E0A339] text-[#3A2708] font-bold' 
                                                : 'bg-[#161410] border-[rgba(242,238,226,0.15)] text-[#A9A190] hover:text-[#F2EEE2]'
                                        }`}
                                    >
                                        {num}M
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Scrub Range Indicator & Quick Presets */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {scrubRange[0] && scrubRange[1] ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="px-2.5 py-1 rounded bg-[#4FB0A6]/15 border border-[#4FB0A6]/40 text-[#4FB0A6] text-xs font-mono font-medium flex items-center gap-2">
                                        <span>
                                            Scrubbed: {formatShortDate(scrubRange[0] < scrubRange[1] ? scrubRange[0] : scrubRange[1])} – {formatShortDate(scrubRange[0] < scrubRange[1] ? scrubRange[1] : scrubRange[0])} ({scrubbedSceneCount} scenes)
                                        </span>
                                        <button 
                                            onClick={() => setScrubRange([null, null])}
                                            className="hover:text-white cursor-pointer" 
                                            title="Clear Scrubbed Range"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => setIsScrubModalOpen(true)}
                                        className="px-2.5 py-1 rounded bg-[#E0A339] text-[#3A2708] text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-[#d09329] transition-colors cursor-pointer shadow-xs"
                                        title="Pick scenes to shoot on these scrubbed dates"
                                    >
                                        <ListFilter size={13} />
                                        <span>Pick Scenes for Range ({selectedSceneIdsForScrub.length})</span>
                                    </button>
                                </div>
                            ) : (
                                <span className="text-xs font-mono text-[#726A5C] italic">Click/drag dates to scrub schedule range</span>
                            )}

                            {/* Filter Mode Toggle */}
                            <button
                                onClick={() => setFilterByScrubbedOnly(!filterByScrubbedOnly)}
                                className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors flex items-center gap-1 cursor-pointer ${
                                    filterByScrubbedOnly 
                                        ? 'bg-[#E0A339] border-[#E0A339] text-[#3A2708] font-bold' 
                                        : 'bg-[#161410] border-[rgba(242,238,226,0.15)] text-[#A9A190] hover:text-[#F2EEE2]'
                                }`}
                                title="Toggle filtering stripboard by scrubbed dates"
                            >
                                <Filter size={12} />
                                {filterByScrubbedOnly ? 'Scrubbed Only' : 'All Strips'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Collapsible Calendar Content */}
                {isCalendarOpen && (
                    <>
                        {/* Quick Presets Row */}
                        {allStrips.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar text-xs font-mono pt-1">
                                <span className="text-[10px] text-[#726A5C] uppercase tracking-wider shrink-0">Presets:</span>
                                <button 
                                    onClick={() => applyScrubPreset(null)}
                                    className="px-2 py-0.5 rounded bg-[#26221A] hover:bg-[#322C22] text-[#A9A190] hover:text-[#F2EEE2] border border-[rgba(242,238,226,0.1)] cursor-pointer whitespace-nowrap"
                                >
                                    All Days
                                </button>
                                <button 
                                    onClick={() => applyScrubPreset(['2026-08-10', '2026-08-12'])}
                                    className="px-2 py-0.5 rounded bg-[#26221A] hover:bg-[#322C22] text-[#E0A339] border border-[#E0A339]/30 cursor-pointer whitespace-nowrap"
                                >
                                    Aug 10–12 (Vikram Rana Window)
                                </button>
                                <button 
                                    onClick={() => applyScrubPreset(['2026-08-14', '2026-08-18'])}
                                    className="px-2 py-0.5 rounded bg-[#26221A] hover:bg-[#322C22] text-[#4FB0A6] border border-[#4FB0A6]/30 cursor-pointer whitespace-nowrap"
                                >
                                    Aug 14–18 (Hospital Set)
                                </button>
                                <button 
                                    onClick={() => applyScrubPreset(['2026-08-20', '2026-08-22'])}
                                    className="px-2 py-0.5 rounded bg-[#26221A] hover:bg-[#322C22] text-[#5B8DBE] border border-[#5B8DBE]/30 cursor-pointer whitespace-nowrap"
                                >
                                    Aug 20–22 (Night Action)
                                </button>
                            </div>
                        )}

                        {/* Multi-Month Calendar Grid */}
                        <div className={`grid gap-4 ${
                            monthCount === 1 ? 'grid-cols-1' :
                            monthCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
                            monthCount === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                        }`}>
                            {monthList.map((m, mIdx) => (
                                <div key={mIdx} className="bg-[#161410] border border-[rgba(242,238,226,0.12)] rounded p-2.5">
                                    <div className="display-font text-xs text-[#E0A339] font-bold text-center uppercase tracking-wider mb-2 border-b border-[rgba(242,238,226,0.10)] pb-1">
                                        {m.monthName}
                                    </div>

                                    {/* Days of week header */}
                                    <div className="grid grid-cols-7 text-center font-mono text-[9px] text-[#726A5C] uppercase mb-1 font-semibold">
                                        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                                    </div>

                                    {/* Days Grid */}
                                    <div className="grid grid-cols-7 gap-1">
                                        {m.days.map((d, dIdx) => {
                                            if (!d) return <div key={dIdx} className="h-8" />;

                                            const inRange = isDateInScrubbedRange(d.dateStr);
                                            const isStart = scrubRange[0] === d.dateStr;
                                            const isEnd = scrubRange[1] === d.dateStr;
                                            const hasStrips = d.strips.length > 0;

                                            return (
                                                <div
                                                    key={dIdx}
                                                    onMouseDown={() => handleDayMouseDown(d.dateStr)}
                                                    onMouseEnter={() => handleDayMouseEnter(d.dateStr)}
                                                    onClick={() => {
                                                        setScrubRange([d.dateStr, d.dateStr]);
                                                    }}
                                                    className={`h-8 rounded p-1 flex flex-col justify-between items-center text-[10px] font-mono cursor-pointer select-none transition-all relative border ${
                                                        inRange 
                                                            ? 'bg-[#E0A339]/20 border-[#E0A339] text-[#F2EEE2] font-bold shadow-xs' 
                                                            : hasStrips
                                                                ? 'bg-[#1E1B15] border-[rgba(242,238,226,0.2)] text-[#F2EEE2] hover:border-[#4FB0A6]'
                                                                : 'bg-[#161410] border-transparent text-[#726A5C] hover:text-[#A9A190]'
                                                    } ${isStart || isEnd ? 'ring-2 ring-[#4FB0A6] bg-[#4FB0A6]/30' : ''}`}
                                                >
                                                    <span className={`${d.isSunday ? 'text-[#C1443A]' : ''}`}>{d.dayNum}</span>

                                                    {/* Indicators for scheduled scenes on this day */}
                                                    {hasStrips && (
                                                        <div className="flex gap-0.5 items-center mt-0.5">
                                                            {d.strips.map((s, idx) => (
                                                                <span 
                                                                    key={idx} 
                                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                                        s.conflictType === 'hard' ? 'bg-[#C1443A]' :
                                                                        s.conflictType === 'warn' ? 'bg-[#E0A339]' :
                                                                        s.type === 'EXTNIGHT' ? 'bg-[#5E9E6E]' :
                                                                        s.type === 'EXTDAY' ? 'bg-[#5B8DBE]' :
                                                                        s.type === 'INTNIGHT' ? 'bg-[#E8C547]' : 'bg-[#F2EEE2]'
                                                                    }`}
                                                                    title={`Scene ${s.sceneNo}: ${s.slug}`}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* --- MODE / OPTIMIZATION BAR --- */}
            <div className="px-6 py-2.5 border-b border-[rgba(242,238,226,0.10)] flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0 bg-[#161410]">
                <span className="text-[10px] text-[#726A5C] uppercase tracking-[1.5px] whitespace-nowrap mr-1 font-semibold">
                    Optimize for
                </span>

                {[
                    { key: 'balanced', label: 'Balanced' },
                    { key: 'lowest_cost', label: 'Lowest cost' },
                    { key: 'fastest_shoot', label: 'Fastest shoot' },
                    { key: 'max_actor_eff', label: 'Max actor efficiency' },
                    { key: 'min_moves', label: 'Min company moves' },
                    { key: 'min_continuity_risk', label: 'Min continuity risk' }
                ].map((m) => {
                    const isActive = strategy === m.key;
                    return (
                        <button
                            key={m.key}
                            onClick={() => setStrategy(m.key as OptimizationStrategy)}
                            className={`px-3 py-1.5 text-xs rounded-xs border whitespace-nowrap transition-all cursor-pointer ${
                                isActive 
                                    ? 'bg-[#E0A339] border-[#E0A339] text-[#3A2708] font-semibold' 
                                    : 'bg-transparent border-[rgba(242,238,226,0.22)] text-[#A9A190] hover:border-[#A9A190] hover:text-[#F2EEE2]'
                            }`}
                        >
                            {m.label}
                        </button>
                    );
                })}

                <span className="text-[11.5px] text-[#726A5C] italic pl-2 truncate hidden lg:inline">
                    {STRATEGY_NOTES[strategy]}
                </span>
            </div>

            {/* --- THREE COLUMN LAYOUT --- */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[230px_1fr_300px] lg:overflow-hidden min-h-[500px] lg:min-h-0">
                
                {/* LEFT COLUMN: ANCHORS & RESOURCES */}
                <div className="p-4 border-b lg:border-b-0 lg:border-r border-[rgba(242,238,226,0.10)] overflow-y-auto custom-scrollbar space-y-5 bg-[#161410]">
                    <div>
                        <h3 className="text-[10.5px] uppercase tracking-[1.5px] text-[#726A5C] font-semibold mb-3 flex items-center gap-1.5">
                            Anchors — locked truths
                        </h3>
                        <div className="space-y-2">
                            {DEFAULT_ANCHORS.map((anc) => {
                                const isOverlap = isDateInScrubbedRange(anc.startDate) || isDateInScrubbedRange(anc.endDate);
                                return (
                                    <div 
                                        key={anc.id}
                                        className={`p-2.5 rounded-r-xs border border-l-3 transition-all ${
                                            anc.priority === 'critical' ? 'border-l-[#C1443A]' : 'border-l-[#E0A339]'
                                        } ${isOverlap ? 'bg-[#26221A] border-[rgba(242,238,226,0.25)] ring-1 ring-[#E0A339]/50' : 'bg-[#1E1B15] border-[rgba(242,238,226,0.10)] opacity-85'}`}
                                    >
                                        <div className="text-[12.5px] font-medium text-[#F2EEE2] flex items-center justify-between">
                                            <span>{anc.title}</span>
                                            {isOverlap && <span className="w-2 h-2 rounded-full bg-[#E0A339] animate-pulse" title="Active during scrubbed dates" />}
                                        </div>
                                        <div className="mono text-[11px] text-[#A9A190] mt-0.5">{anc.window}</div>
                                        <div className={`text-[9.5px] uppercase tracking-wider mt-1 font-semibold ${
                                            anc.priority === 'critical' ? 'text-[#C1443A]' : 'text-[#E0A339]'
                                        }`}>
                                            {anc.priority}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[10.5px] uppercase tracking-[1.5px] text-[#726A5C] font-semibold mb-3">
                            Resource pressure
                        </h3>
                        <div className="space-y-2.5">
                            {DEFAULT_RESOURCES.map((res, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 text-xs pb-1.5 border-b border-[rgba(242,238,226,0.10)] last:border-b-0">
                                    <span className="text-[#A9A190] truncate max-w-[120px]">{res.name}</span>
                                    <div className="w-[60px] h-[5px] bg-[#26221A] rounded-full overflow-hidden shrink-0">
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

                {/* CENTER COLUMN: STRIP BOARD */}
                <div className="p-4 border-b lg:border-b-0 border-[rgba(242,238,226,0.10)] overflow-y-auto custom-scrollbar space-y-6 bg-[#161410]">
                    {displayBlocks.length === 0 ? (
                        <div className="p-12 text-center text-[#726A5C] font-mono space-y-3 border border-dashed border-[rgba(242,238,226,0.15)] rounded">
                            <Calendar size={32} className="mx-auto text-[#E0A339]/60" />
                            <div className="text-sm font-semibold text-[#F2EEE2]">No scenes scheduled in scrubbed range</div>
                            <p className="text-xs">Adjust your calendar scrub window or switch to "All Strips".</p>
                            <button 
                                onClick={() => applyScrubPreset(null)}
                                className="px-3 py-1.5 rounded bg-[#E0A339] text-[#3A2708] text-xs font-bold uppercase cursor-pointer"
                            >
                                Reset Scrubbed Range
                            </button>
                        </div>
                    ) : (
                        displayBlocks.map((blk) => (
                            <div key={blk.id} className="space-y-2">
                                {/* Block Header */}
                                <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-[rgba(242,238,226,0.22)]">
                                    <span className="display-font text-[13.5px] text-[#F2EEE2] font-semibold uppercase">
                                        {blk.title}
                                    </span>
                                    <span className="text-[10.5px] text-[#726A5C] mono flex items-center gap-1">
                                        {blk.meta}
                                        {blk.lockState === 'hard' ? <Lock size={11} className="text-[#C1443A]" /> : <Unlock size={11} className="text-[#A9A190]" />}
                                    </span>
                                </div>

                                {/* Strips List */}
                                <div className="space-y-1.5">
                                    {blk.strips.map((s) => {
                                        const isSelected = selectedStripId === s.id;
                                        const isInScrubbedWindow = isDateInScrubbedRange(s.scheduledDate);

                                        return (
                                            <div
                                                key={s.id}
                                                onClick={() => setSelectedStripId(s.id)}
                                                className={`strip-item strip-${s.type} flex items-stretch border border-[rgba(242,238,226,0.10)] border-l-8 rounded-xs bg-[#1E1B15] cursor-pointer relative ${
                                                    isSelected ? 'selected' : ''
                                                } ${scrubRange[0] && scrubRange[1] && !isInScrubbedWindow ? 'opacity-50 grayscale-20' : ''}`}
                                            >
                                                <div className="mono text-xs text-[#726A5C] p-2.5 min-w-[40px] border-r border-[rgba(242,238,226,0.10)] flex items-center justify-center font-bold">
                                                    {s.sceneNo}
                                                </div>

                                                <div className="p-2.5 flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-[12.5px] font-medium text-[#F2EEE2] truncate">
                                                            {s.slug}
                                                        </div>
                                                        <div className="mono text-[10px] px-1.5 py-0.5 rounded bg-[#26221A] text-[#E0A339] border border-[#E0A339]/20 shrink-0">
                                                            {formatShortDate(s.scheduledDate)}
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-1.5 mt-1 flex-wrap items-center">
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

                                                <div className="flex items-center gap-1 px-2.5 border-l border-[rgba(242,238,226,0.08)] bg-black/10">
                                                    <button 
                                                        onClick={(e) => handleOpenEditModal(s, e)}
                                                        className="p-1 rounded text-[#A9A190] hover:text-[#E0A339] hover:bg-[#322C22] transition-colors cursor-pointer"
                                                        title="Edit Scene Details"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => handleDeleteStrip(s.id, e)}
                                                        className="p-1 rounded text-[#A9A190] hover:text-[#C1443A] hover:bg-[#322C22] transition-colors cursor-pointer"
                                                        title="Delete Scene"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>

                                                {s.conflictType && (
                                                    <div className="px-2.5 flex items-center">
                                                        {s.conflictType === 'warn' ? (
                                                            <span className="text-[#E0A339] text-sm" title="Soft Conflict">⚠️</span>
                                                        ) : (
                                                            <span className="text-[#C1443A] text-sm" title="Hard Conflict">❌</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* RIGHT COLUMN: DEPENDENCIES SUMMARY, AI COPILOT & WHAT IF SIMULATOR */}
                <div className="p-4 lg:border-l border-[rgba(242,238,226,0.10)] overflow-y-auto custom-scrollbar bg-[#1E1B15] space-y-5">
                    
                    {/* --- DEPENDENCIES SUMMARY CARD FOR SCRUBBED RANGE --- */}
                    {scrubbedDependenciesSummary && (
                        <div className="p-3.5 rounded-lg border border-[#4FB0A6]/40 bg-[#161410] space-y-3.5 shadow-lg relative overflow-hidden animate-fadeIn">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-[#4FB0A6]/5 rounded-full blur-xl pointer-events-none" />

                            <div className="flex items-start justify-between border-b border-[rgba(242,238,226,0.12)] pb-2.5">
                                <div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#4FB0A6] font-bold">
                                        <Layers size={13} />
                                        <span>Dependencies Summary</span>
                                    </div>
                                    <h4 className="display-font text-sm font-bold text-[#F2EEE2] mt-0.5">
                                        {formatShortDate(scrubbedDependenciesSummary.startStr)} – {formatShortDate(scrubbedDependenciesSummary.endStr)}
                                    </h4>
                                    <p className="text-[10.5px] font-mono text-[#A9A190]">
                                        {scrubbedDependenciesSummary.diffDays} Shoot Days · {scrubbedDependenciesSummary.selectedCount} Scenes · {scrubbedDependenciesSummary.totalShots} Shots
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsScrubModalOpen(true)}
                                    className="p-1.5 rounded bg-[#4FB0A6]/20 text-[#4FB0A6] hover:bg-[#4FB0A6] hover:text-[#161410] transition-colors cursor-pointer text-xs font-mono font-bold flex items-center gap-1"
                                    title="Edit Scenes for this scrubbed range"
                                >
                                    <ListFilter size={13} />
                                    <span>Filter</span>
                                </button>
                            </div>

                            {/* Quick Metrics Bar */}
                            <div className="grid grid-cols-3 gap-1.5 p-2 bg-[#1E1B15] rounded border border-[rgba(242,238,226,0.08)] text-center font-mono text-xs">
                                <div>
                                    <div className="text-[9px] text-[#726A5C] uppercase">Shots</div>
                                    <div className="font-bold text-[#E0A339]">{scrubbedDependenciesSummary.totalShots}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-[#726A5C] uppercase">Camera Hrs</div>
                                    <div className="font-bold text-[#4FB0A6]">{scrubbedDependenciesSummary.totalEstHours}h</div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-[#726A5C] uppercase">Pages</div>
                                    <div className="font-bold text-[#F2EEE2]">{scrubbedDependenciesSummary.totalPages}</div>
                                </div>
                            </div>

                            {/* 1. CAST DEPENDENCIES */}
                            <div className="space-y-1.5">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-[#726A5C] font-semibold flex items-center gap-1">
                                    <Users size={12} className="text-[#E0A339]" />
                                    <span>Cast Required ({scrubbedDependenciesSummary.castList.length})</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {scrubbedDependenciesSummary.castList.map((c, i) => (
                                        <span key={i} className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-[#26221A] border border-[rgba(242,238,226,0.12)] text-[#F2EEE2] flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#5E9E6E]" />
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 2. LOCATIONS & SETS */}
                            <div className="space-y-1.5">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-[#726A5C] font-semibold flex items-center gap-1">
                                    <MapPin size={12} className="text-[#4FB0A6]" />
                                    <span>Sets & Locations ({scrubbedDependenciesSummary.locations.length})</span>
                                </div>
                                <div className="space-y-1 font-mono text-[11px] text-[#A9A190]">
                                    {scrubbedDependenciesSummary.locations.map((loc, i) => (
                                        <div key={i} className="p-1.5 rounded bg-[#1E1B15] border border-[rgba(242,238,226,0.06)] flex items-center justify-between text-[#F2EEE2]">
                                            <span>{loc}</span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#4FB0A6]/20 text-[#4FB0A6]">Ready</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 3. EQUIPMENT, PROPS & SPECIAL REQS */}
                            <div className="space-y-1.5">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-[#726A5C] font-semibold flex items-center gap-1">
                                    <Wrench size={12} className="text-[#5B8DBE]" />
                                    <span>Special Equipment & Props ({scrubbedDependenciesSummary.equipment.length})</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {scrubbedDependenciesSummary.equipment.map((eq, i) => (
                                        <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1E1B15] border border-[#5B8DBE]/30 text-[#5B8DBE]">
                                            {eq}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 4. PERMITS & WARNINGS */}
                            {scrubbedDependenciesSummary.warnings.length > 0 && (
                                <div className="p-2.5 rounded bg-[#C1443A]/10 border border-[#C1443A]/40 space-y-1">
                                    <div className="text-[10px] font-mono font-bold uppercase text-[#C1443A] flex items-center gap-1">
                                        <AlertTriangle size={12} />
                                        <span>Permit & Window Constraints</span>
                                    </div>
                                    <ul className="list-disc pl-4 text-[10.5px] font-mono text-[#A9A190] space-y-0.5">
                                        {scrubbedDependenciesSummary.warnings.map((w, i) => (
                                            <li key={i}>{w}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-1 flex gap-2">
                                <button
                                    onClick={() => setIsScrubModalOpen(true)}
                                    className="flex-1 py-1.5 rounded bg-[#E0A339] text-[#3A2708] font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-[#d09329] transition-colors cursor-pointer"
                                >
                                    <ListFilter size={13} />
                                    <span>Select Scenes Popup</span>
                                </button>
                                <button
                                    onClick={() => setShowPdfModal(true)}
                                    className="py-1.5 px-3 rounded border border-[rgba(242,238,226,0.2)] hover:border-[#4FB0A6] text-[#A9A190] hover:text-[#F2EEE2] font-mono text-xs cursor-pointer transition-colors"
                                    title="Export Call Sheet"
                                >
                                    <Printer size={13} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* AI Copilot Card */}
                    <div>
                        <h3 className="text-[10.5px] uppercase tracking-[1.5px] text-[#726A5C] font-semibold mb-2.5 flex items-center gap-1.5">
                            <Sparkles size={13} className="text-[#E0A339]" /> AI Copilot
                        </h3>

                        <div className="p-3 rounded border border-[rgba(242,238,226,0.10)] bg-[#26221A] text-[12.5px] leading-relaxed text-[#A9A190]">
                            {selectedStrip?.suggestion ? (
                                <>
                                    <b className="text-[#F2EEE2]">1st AD Suggestion —</b> {selectedStrip.suggestion}
                                </>
                            ) : (
                                <>
                                    <b className="text-[#F2EEE2]">Why this order —</b> Scene {selectedStrip?.sceneNo || '41'} is scheduled on {formatShortDate(selectedStrip?.scheduledDate || '2026-08-14')}. Grouping scenes in this location eliminates 2 company moves and saves 1 full shoot day.
                                </>
                            )}
                        </div>
                    </div>

                    {/* Conflict Explanation Box (If selected strip has conflict) */}
                    {selectedStrip?.conflictType && (
                        <div className={`p-3 rounded border ${
                            selectedStrip.conflictType === 'hard' ? 'border-[#C1443A] bg-[#C1443A]/10' : 'border-[#E0A339] bg-[#E0A339]/10'
                        }`}>
                            <div className={`text-[12.5px] font-semibold mb-2 ${
                                selectedStrip.conflictType === 'hard' ? 'text-[#C1443A]' : 'text-[#E0A339]'
                            }`}>
                                {selectedStrip.conflictTitle}
                            </div>
                            <ul className="list-disc pl-4 text-xs text-[#A9A190] space-y-1 leading-normal">
                                {selectedStrip.conflictReasons?.map((r, i) => (
                                    <li key={i}>{r}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* What If Simulation */}
                    <div>
                        <h3 className="text-[10.5px] uppercase tracking-[1.5px] text-[#726A5C] font-semibold mb-2.5">
                            What if…
                        </h3>

                        <div className="space-y-1.5">
                            {Object.entries(WHAT_IF_RIPPLES).map(([key, data]) => {
                                const isActive = activeWhatIfKey === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setActiveWhatIfKey(isActive ? null : key)}
                                        className={`w-full text-left p-2.5 rounded text-xs font-sans border transition-colors cursor-pointer ${
                                            isActive 
                                                ? 'border-[#4FB0A6] text-[#F2EEE2] bg-[#4FB0A6]/10 font-medium' 
                                                : 'border-[rgba(242,238,226,0.22)] text-[#A9A190] hover:border-[#4FB0A6] hover:text-[#F2EEE2] bg-transparent'
                                        }`}
                                    >
                                        {data.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Ripple Effect Result */}
                        {activeWhatIfKey && WHAT_IF_RIPPLES[activeWhatIfKey] && (
                            <div className="mt-3 p-3 rounded border border-[#4FB0A6] bg-[#4FB0A6]/10 text-xs text-[#A9A190] space-y-2 animate-fadeIn">
                                <div className="font-semibold text-[#4FB0A6] mb-1">
                                    Ripple effect — {WHAT_IF_RIPPLES[activeWhatIfKey].label}
                                </div>
                                <div className="space-y-1.5">
                                    {WHAT_IF_RIPPLES[activeWhatIfKey].rows.map((r, idx) => (
                                        <div key={idx} className="flex justify-between items-center pb-1 border-b border-[rgba(242,238,226,0.10)] last:border-b-0">
                                            <span>{r.metric}</span>
                                            <span className={`mono font-bold ${r.status === 'bad' ? 'text-[#C1443A]' : 'text-[#4FB0A6]'}`}>
                                                {r.delta}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* --- FOOTER TICKER --- */}
            {allStrips.length > 0 && (
                <footer className="px-6 py-2.5 border-t border-[rgba(242,238,226,0.10)] bg-[#1E1B15] flex items-center gap-6 overflow-x-auto custom-scrollbar text-xs text-[#A9A190] shrink-0">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E0A339]"></span>
                        <span>5 idle days for Vikram Rana between blocks</span>
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C1443A]"></span>
                        <span>Scene 13 breaches temple permit (6 PM cutoff)</span>
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E0A339]"></span>
                        <span>Drone booked twice — Aug 15</span>
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E0A339]"></span>
                        <span>3 consecutive night shoots, Aug 20–22</span>
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C1443A]"></span>
                        <span>Meera scheduled past 5h morning cap on Scene 42</span>
                    </div>
                </footer>
            )}
                </>
            )}

            {/* --- CALL SHEET PDF EXPORT MODAL --- */}
            {showPdfModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1E1B15] border border-[rgba(242,238,226,0.22)] rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-[rgba(242,238,226,0.10)] flex items-center justify-between bg-[#161410]">
                            <h2 className="display-font text-lg text-[#F2EEE2]">1st AD Official Schedule PDF Preview</h2>
                            <button onClick={() => setShowPdfModal(false)} className="text-[#A9A190] hover:text-[#F2EEE2]">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#161410]">
                            <div ref={pdfPrintRef} className="p-6 bg-[#161410] text-[#F2EEE2] space-y-6 border border-[rgba(242,238,226,0.10)] rounded">
                                <div className="flex justify-between items-start border-b border-[rgba(242,238,226,0.22)] pb-4">
                                    <div>
                                        <h1 className="display-font text-2xl font-bold text-[#E0A339] uppercase">{currentProjectName}</h1>
                                        <p className="text-xs text-[#A9A190] mono">MASTER 1st AD PRODUCTION SCHEDULE</p>
                                    </div>
                                    <div className="text-right text-xs mono text-[#A9A190]">
                                        <div>Health Score: {healthScore}/100</div>
                                        <div>Strategy: {strategy.toUpperCase()}</div>
                                        <div>Generated: {new Date().toLocaleDateString()}</div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {blocks.map(blk => (
                                        <div key={blk.id} className="border border-[rgba(242,238,226,0.10)] p-3 rounded bg-[#1E1B15]">
                                            <div className="display-font text-sm text-[#E0A339] border-b border-[rgba(242,238,226,0.10)] pb-1 mb-2">
                                                {blk.title} ({blk.meta})
                                            </div>
                                            <div className="space-y-1">
                                                {blk.strips.map(s => (
                                                    <div key={s.id} className="text-xs flex justify-between py-1 border-b border-[rgba(242,238,226,0.05)] font-mono">
                                                        <span>SCENE {s.sceneNo} [{formatShortDate(s.scheduledDate)}]: {s.slug}</span>
                                                        <span className="text-[#A9A190]">{s.tags.join(' | ')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-[rgba(242,238,226,0.10)] flex justify-end gap-3 bg-[#161410]">
                            <button 
                                onClick={() => setShowPdfModal(false)}
                                className="px-4 py-2 rounded text-xs font-mono text-[#A9A190] hover:text-[#F2EEE2] cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleExportPdf}
                                disabled={isExportingPdf}
                                className="px-5 py-2 rounded bg-[#E0A339] text-[#3A2708] text-xs font-mono font-bold uppercase flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                <Download size={14} />
                                {isExportingPdf ? 'Exporting PDF...' : 'Download PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- POPUP MODAL: WHAT SCENES DO YOU WANT TO SHOOT THESE DAYS? --- */}
            {isScrubModalOpen && scrubRange[0] && scrubRange[1] && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-5 animate-fadeIn">
                    <div className="bg-[#181612] border border-[#4FB0A6]/50 rounded-xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl relative">
                        {/* Modal Header */}
                        <div className="p-3.5 px-4 border-b border-[rgba(242,238,226,0.12)] bg-[#14120E] flex items-center justify-between shrink-0">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-mono uppercase text-[#4FB0A6] font-bold">
                                    <Sparkles size={14} />
                                    <span>Scrubbed Calendar Date Assignment</span>
                                </div>
                                <h2 className="display-font text-lg md:text-xl font-bold text-[#F2EEE2] mt-0.5">
                                    What scenes do you want to shoot these days?
                                </h2>
                                <p className="text-xs font-mono text-[#A9A190] mt-0.5">
                                    Scrubbed Range: <span className="text-[#E0A339] font-bold">{formatShortDate(scrubRange[0] < scrubRange[1] ? scrubRange[0] : scrubRange[1])} – {formatShortDate(scrubRange[0] < scrubRange[1] ? scrubRange[1] : scrubRange[0])}</span>
                                </p>
                            </div>

                            <button 
                                onClick={() => setIsScrubModalOpen(false)}
                                className="p-1.5 rounded-lg text-[#A9A190] hover:text-[#F2EEE2] hover:bg-[#26221A] transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content Split: Left (Filters & Compact Cards Grid), Right (Live Updating Dependency Card) */}
                        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                            {/* LEFT SIDE: FILTERS & COMPACT SCENE CARDS */}
                            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                                {/* Multi-Dimensional Filter Bar */}
                                <div className="p-3 bg-[#1E1B15] border-b border-[rgba(242,238,226,0.10)] space-y-2 shrink-0">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        {/* Search Bar */}
                                        <div className="relative flex-1 min-w-[180px]">
                                            <Search size={13} className="absolute left-2.5 top-2 text-[#726A5C]" />
                                            <input 
                                                type="text"
                                                value={popupSearch}
                                                onChange={(e) => setPopupSearch(e.target.value)}
                                                placeholder="Search scene #, slug, cast, equipment..."
                                                className="w-full pl-8 pr-3 py-1 bg-[#14120E] border border-[rgba(242,238,226,0.15)] rounded text-xs font-mono text-[#F2EEE2] placeholder-[#726A5C] focus:outline-none focus:border-[#4FB0A6]"
                                            />
                                            {popupSearch && (
                                                <button onClick={() => setPopupSearch('')} className="absolute right-2 top-2 text-[#726A5C] hover:text-[#F2EEE2]">
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Preset Selection Actions */}
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => setSelectedSceneIdsForScrub(filteredPopupStrips.map(s => s.id))}
                                                className="px-2 py-1 rounded bg-[#26221A] border border-[rgba(242,238,226,0.15)] text-[10.5px] font-mono text-[#A9A190] hover:text-[#F2EEE2] hover:border-[#4FB0A6] cursor-pointer"
                                            >
                                                Select All ({filteredPopupStrips.length})
                                            </button>
                                            <button
                                                onClick={() => setSelectedSceneIdsForScrub([])}
                                                className="px-2 py-1 rounded bg-[#26221A] border border-[rgba(242,238,226,0.15)] text-[10.5px] font-mono text-[#A9A190] hover:text-[#C1443A] cursor-pointer"
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    </div>

                                    {/* Dropdown Filters row */}
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 font-mono text-xs">
                                        <div>
                                            <select 
                                                value={popupLocation}
                                                onChange={(e) => setPopupLocation(e.target.value)}
                                                className="w-full bg-[#14120E] border border-[rgba(242,238,226,0.12)] rounded px-1.5 py-0.5 text-[#F2EEE2] text-[11px] focus:outline-none focus:border-[#4FB0A6]"
                                            >
                                                <option value="ALL">All Locations</option>
                                                <option value="INTERIOR">INT (Interior)</option>
                                                <option value="EXTERIOR">EXT (Exterior)</option>
                                                <option value="NIGHT">Night Locations</option>
                                                {allStrips.length > 0 && Array.from(new Set(allStrips.map(s => s.blockTitle).filter(Boolean))).map(loc => (
                                                    <option key={loc} value={loc}>{loc}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <select 
                                                value={popupType}
                                                onChange={(e) => setPopupType(e.target.value)}
                                                className="w-full bg-[#14120E] border border-[rgba(242,238,226,0.12)] rounded px-1.5 py-0.5 text-[#F2EEE2] text-[11px] focus:outline-none focus:border-[#4FB0A6]"
                                            >
                                                <option value="ALL">All Types</option>
                                                <option value="INT DAY">INT DAY</option>
                                                <option value="EXT DAY">EXT DAY</option>
                                                <option value="INT NIGHT">INT NIGHT</option>
                                                <option value="EXT NIGHT">EXT NIGHT</option>
                                            </select>
                                        </div>
                                        <div>
                                            <select 
                                                value={popupCast}
                                                onChange={(e) => setPopupCast(e.target.value)}
                                                className="w-full bg-[#14120E] border border-[rgba(242,238,226,0.12)] rounded px-1.5 py-0.5 text-[#F2EEE2] text-[11px] focus:outline-none focus:border-[#4FB0A6]"
                                            >
                                                <option value="ALL">All Cast</option>
                                                {allStrips.length > 0 ? (
                                                    Array.from(new Set(allStrips.flatMap(s => s.tags).filter(t => !['DAY', 'NIGHT', 'INT', 'EXT'].includes(t.toUpperCase())))).map(cast => (
                                                        <option key={cast} value={cast}>{cast}</option>
                                                    ))
                                                ) : (
                                                    <>
                                                        <option value="Arjun">Vikram Rana (Arjun)</option>
                                                        <option value="Meera">Meera (Child)</option>
                                                        <option value="Rao">Inspector Rao</option>
                                                        <option value="Fernandes">Dr. Fernandes</option>
                                                    </>
                                                )}
                                            </select>
                                        </div>
                                        <div>
                                            <select 
                                                value={popupEquipment}
                                                onChange={(e) => setPopupEquipment(e.target.value)}
                                                className="w-full bg-[#14120E] border border-[rgba(242,238,226,0.12)] rounded px-1.5 py-0.5 text-[#F2EEE2] text-[11px] focus:outline-none focus:border-[#4FB0A6]"
                                            >
                                                <option value="ALL">All Gear / Reqs</option>
                                                <option value="Stunts">Stunts Required</option>
                                                <option value="Drone">Drone Aerials</option>
                                                <option value="SFX fire">SFX Fire / Rain</option>
                                                <option value="35mm">35mm Film Grain</option>
                                            </select>
                                        </div>
                                        <div>
                                            <select 
                                                value={popupStatus}
                                                onChange={(e) => setPopupStatus(e.target.value)}
                                                className="w-full bg-[#14120E] border border-[rgba(242,238,226,0.12)] rounded px-1.5 py-0.5 text-[#F2EEE2] text-[11px] focus:outline-none focus:border-[#4FB0A6]"
                                            >
                                                <option value="ALL">All Scenes</option>
                                                <option value="SCHEDULED_IN_RANGE">In Range Currently</option>
                                                <option value="CONFLICTS">Has Conflicts Only</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Compact Scene Grid / List */}
                                <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-2 bg-[#14120E]">
                                    <div className="flex justify-between items-center text-[11px] font-mono text-[#726A5C] pb-1">
                                        <span>Showing {filteredPopupStrips.length} candidate scenes</span>
                                        <span>{selectedSceneIdsForScrub.length} scenes selected</span>
                                    </div>

                                    {filteredPopupStrips.length === 0 ? (
                                        <div className="p-8 text-center border border-dashed border-[rgba(242,238,226,0.10)] rounded-lg text-[#A9A190]">
                                            <Filter size={24} className="mx-auto mb-2 text-[#726A5C]" />
                                            <p className="text-sm font-bold">No scenes match your filter criteria.</p>
                                            <p className="text-xs font-mono text-[#726A5C] mt-1">Try resetting filters or changing search keywords.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                            {filteredPopupStrips.map(strip => {
                                                const isSelected = selectedSceneIdsForScrub.includes(strip.id);
                                                return (
                                                    <div
                                                        key={strip.id}
                                                        onClick={() => {
                                                            setSelectedSceneIdsForScrub(prev => 
                                                                prev.includes(strip.id) ? prev.filter(id => id !== strip.id) : [...prev, strip.id]
                                                            );
                                                        }}
                                                        className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between relative ${
                                                            isSelected 
                                                                ? 'bg-[#1E2E2C] border-[#4FB0A6] shadow-md' 
                                                                : 'bg-[#1C1A14] border-[rgba(242,238,226,0.10)] hover:border-[rgba(242,238,226,0.25)]'
                                                        }`}
                                                    >
                                                        {/* --- TOP BANNER: SHOTS PLANNED FOR THIS SCENE --- */}
                                                        <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.12)] pb-1.5 mb-2">
                                                            <div className="flex items-center gap-1 font-mono text-[10.5px] font-bold text-[#E0A339]">
                                                                <Zap size={11} className="text-[#E0A339]" />
                                                                <span>{strip.shotCount || 8} SHOTS PLANNED</span>
                                                            </div>
                                                            <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[#26221A] text-[#4FB0A6] font-semibold border border-[rgba(242,238,226,0.10)]">
                                                                {strip.type}
                                                            </span>
                                                        </div>

                                                        {/* Card Main Body */}
                                                        <div className="flex items-start gap-2">
                                                            {/* Checkbox */}
                                                            <div className="mt-0.5 shrink-0">
                                                                {isSelected ? (
                                                                    <div className="w-4 h-4 rounded bg-[#4FB0A6] text-[#14120E] flex items-center justify-center font-bold">
                                                                        <Check size={12} />
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-4 h-4 rounded border border-[rgba(242,238,226,0.3)] bg-[#14120E]" />
                                                                )}
                                                            </div>

                                                            {/* Scene Content */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className="font-mono text-[11px] font-bold text-[#F2EEE2]">
                                                                        SCENE {strip.sceneNo}
                                                                    </span>
                                                                    <span className="text-[9.5px] font-mono text-[#726A5C] truncate max-w-[90px]">
                                                                        {strip.blockTitle}
                                                                    </span>
                                                                </div>

                                                                <h4 className="font-medium text-[11px] text-[#A9A190] truncate mt-0.5">
                                                                    {strip.slug}
                                                                </h4>

                                                                {/* Tags */}
                                                                {strip.tags.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                                        {strip.tags.slice(0, 3).map((t, idx) => (
                                                                            <span key={idx} className="text-[9px] font-mono px-1.5 py-0.1 rounded bg-[#14120E] text-[#A9A190] border border-[rgba(242,238,226,0.06)]">
                                                                                {t}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Conflict Badge */}
                                                                {strip.conflictType && (
                                                                    <div className="mt-1.5 text-[9.5px] font-mono text-[#C1443A] flex items-center gap-1 font-semibold">
                                                                        <AlertTriangle size={10} />
                                                                        <span className="truncate">{strip.conflictTitle}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT SIDE: LIVE UPDATING DEPENDENCY CARD ON THE POPUP ITSELF */}
                            <div className="w-full lg:w-80 bg-[#161410] border-t lg:border-t-0 lg:border-l border-[rgba(242,238,226,0.12)] p-4 flex flex-col space-y-3.5 overflow-y-auto custom-scrollbar shrink-0">
                                <div className="flex items-center justify-between border-b border-[rgba(242,238,226,0.12)] pb-2.5">
                                    <div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#4FB0A6] font-bold">
                                            <Layers size={13} />
                                            <span>Live Dependencies</span>
                                        </div>
                                        <h4 className="display-font text-sm font-bold text-[#F2EEE2] mt-0.5">
                                            Real-Time Summary
                                        </h4>
                                    </div>
                                    <span className="px-2 py-0.5 rounded bg-[#4FB0A6]/20 text-[#4FB0A6] font-mono text-xs font-bold">
                                        {scrubbedDependenciesSummary?.selectedCount || 0} Scenes
                                    </span>
                                </div>

                                {/* Quick Metrics Grid */}
                                <div className="grid grid-cols-3 gap-1.5 p-2 bg-[#1E1B15] rounded border border-[rgba(242,238,226,0.08)] text-center font-mono text-xs">
                                    <div>
                                        <div className="text-[9px] text-[#726A5C] uppercase">Shots</div>
                                        <div className="font-bold text-[#E0A339]">{scrubbedDependenciesSummary?.totalShots || 0}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-[#726A5C] uppercase">Camera Hrs</div>
                                        <div className="font-bold text-[#4FB0A6]">{scrubbedDependenciesSummary?.totalEstHours || 0}h</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-[#726A5C] uppercase">Pages</div>
                                        <div className="font-bold text-[#F2EEE2]">{scrubbedDependenciesSummary?.totalPages || 0}</div>
                                    </div>
                                </div>

                                {/* 1. LIVE CAST DEPENDENCIES */}
                                <div className="space-y-1.5">
                                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#726A5C] font-semibold flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                            <Users size={12} className="text-[#E0A339]" />
                                            <span>Cast Required</span>
                                        </span>
                                        <span className="text-[#E0A339] font-bold">{scrubbedDependenciesSummary?.castList.length || 0}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                                        {scrubbedDependenciesSummary?.castList.length === 0 ? (
                                            <span className="text-[10px] font-mono text-[#726A5C]">No cast selected</span>
                                        ) : (
                                            scrubbedDependenciesSummary?.castList.map((c, i) => (
                                                <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#26221A] border border-[rgba(242,238,226,0.12)] text-[#F2EEE2] flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#5E9E6E]" />
                                                    {c}
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* 2. LIVE LOCATIONS & SETS */}
                                <div className="space-y-1.5">
                                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#726A5C] font-semibold flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                            <MapPin size={12} className="text-[#4FB0A6]" />
                                            <span>Sets & Locations</span>
                                        </span>
                                        <span className="text-[#4FB0A6] font-bold">{scrubbedDependenciesSummary?.locations.length || 0}</span>
                                    </div>
                                    <div className="space-y-1 font-mono text-[10.5px] max-h-28 overflow-y-auto custom-scrollbar">
                                        {scrubbedDependenciesSummary?.locations.length === 0 ? (
                                            <span className="text-[10px] font-mono text-[#726A5C]">No sets selected</span>
                                        ) : (
                                            scrubbedDependenciesSummary?.locations.map((loc, i) => (
                                                <div key={i} className="p-1.5 rounded bg-[#1E1B15] border border-[rgba(242,238,226,0.06)] flex items-center justify-between text-[#F2EEE2]">
                                                    <span className="truncate pr-1">{loc}</span>
                                                    <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-[#4FB0A6]/20 text-[#4FB0A6] shrink-0">Ready</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* 3. LIVE EQUIPMENT & PROPS */}
                                <div className="space-y-1.5">
                                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#726A5C] font-semibold flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                            <Wrench size={12} className="text-[#5B8DBE]" />
                                            <span>Gear & Special Reqs</span>
                                        </span>
                                        <span className="text-[#5B8DBE] font-bold">{scrubbedDependenciesSummary?.equipment.length || 0}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar">
                                        {scrubbedDependenciesSummary?.equipment.length === 0 ? (
                                            <span className="text-[10px] font-mono text-[#726A5C]">Standard gear</span>
                                        ) : (
                                            scrubbedDependenciesSummary?.equipment.map((eq, i) => (
                                                <span key={i} className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-[#1E1B15] border border-[#5B8DBE]/30 text-[#5B8DBE]">
                                                    {eq}
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* 4. LIVE PERMITS & WARNINGS */}
                                {scrubbedDependenciesSummary && scrubbedDependenciesSummary.warnings.length > 0 && (
                                    <div className="p-2 rounded bg-[#C1443A]/10 border border-[#C1443A]/40 space-y-1">
                                        <div className="text-[9.5px] font-mono font-bold uppercase text-[#C1443A] flex items-center gap-1">
                                            <AlertTriangle size={11} />
                                            <span>Constraint Warnings</span>
                                        </div>
                                        <ul className="list-disc pl-3.5 text-[9.5px] font-mono text-[#A9A190] space-y-0.5">
                                            {scrubbedDependenciesSummary.warnings.map((w, i) => (
                                                <li key={i}>{w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3.5 px-4 bg-[#14120E] border-t border-[rgba(242,238,226,0.12)] flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                            <div className="text-xs font-mono text-[#A9A190]">
                                <span className="text-[#F2EEE2] font-bold">{selectedSceneIdsForScrub.length} scenes</span> selected for scrubbed range ({formatShortDate(scrubRange[0] < scrubRange[1] ? scrubRange[0] : scrubRange[1])} – {formatShortDate(scrubRange[0] < scrubRange[1] ? scrubRange[1] : scrubRange[0])}).
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto">
                                <button
                                    onClick={() => setIsScrubModalOpen(false)}
                                    className="px-3.5 py-1.5 rounded text-xs font-mono text-[#A9A190] hover:text-[#F2EEE2] border border-[rgba(242,238,226,0.12)] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmAssignScenesToRange}
                                    className="px-4 py-1.5 rounded bg-[#E0A339] text-[#3A2708] text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-[#d09329] transition-colors cursor-pointer shadow-md"
                                >
                                    <CheckSquare size={14} />
                                    <span>Assign & Confirm Schedule</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editingStrip && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                    <div 
                        className={`w-full max-w-md rounded-lg shadow-2xl border flex flex-col ${
                            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#1a1a1a] border-[#333] text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)]'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className={`flex items-center justify-between px-4 py-3 border-b ${isLight ? 'border-slate-100 bg-slate-50' : 'border-[#292929] bg-black/20'}`}>
                            <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                <Edit2 size={13} className="text-[#E0A339]" />
                                <span>Edit Scene Details</span>
                            </h3>
                            <button 
                                onClick={() => setEditingStrip(null)}
                                className={`p-1 rounded transition-colors ${isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-[#2c2c2c] text-gray-400'}`}
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 space-y-3.5 text-xs">
                            <div className="space-y-1">
                                <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Scene Number</label>
                                <input 
                                    type="text"
                                    value={editFormSceneNo}
                                    onChange={(e) => setEditFormSceneNo(e.target.value)}
                                    placeholder="e.g. 12 or 12A"
                                    className={`w-full rounded px-2.5 py-1.5 outline-none transition-colors border ${
                                        isLight 
                                            ? 'bg-slate-55 border-slate-200 focus:border-[#E0A339] focus:bg-white text-slate-900' 
                                            : 'bg-black/40 border-[#333] focus:border-[#E0A339] focus:bg-black/60 text-white'
                                    }`}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Scene Title</label>
                                <input 
                                    type="text"
                                    value={editFormTitle}
                                    onChange={(e) => setEditFormTitle(e.target.value)}
                                    placeholder="e.g. INT. POLICE STATION - NIGHT"
                                    className={`w-full rounded px-2.5 py-1.5 outline-none transition-colors border ${
                                        isLight 
                                            ? 'bg-slate-55 border-slate-200 focus:border-[#E0A339] focus:bg-white text-slate-900' 
                                            : 'bg-black/40 border-[#333] focus:border-[#E0A339] focus:bg-black/60 text-white'
                                    }`}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Setting</label>
                                    <select 
                                        value={editFormPrefix}
                                        onChange={(e) => setEditFormPrefix(e.target.value)}
                                        className={`w-full rounded px-2 py-1.5 outline-none transition-colors border ${
                                            isLight 
                                                ? 'bg-slate-55 border-slate-200 focus:border-[#E0A339]' 
                                                : 'bg-black/40 border-[#333] focus:border-[#E0A339] text-white'
                                        }`}
                                    >
                                        <option value="INT">INT</option>
                                        <option value="EXT">EXT</option>
                                        <option value="INT/EXT">INT/EXT</option>
                                    </select>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Location Name</label>
                                    <input 
                                        type="text"
                                        value={editFormLocation}
                                        onChange={(e) => setEditFormLocation(e.target.value)}
                                        placeholder="e.g. POLICE STATION"
                                        className={`w-full rounded px-2.5 py-1.5 outline-none transition-colors border ${
                                            isLight 
                                                ? 'bg-slate-55 border-slate-200 focus:border-[#E0A339] focus:bg-white text-slate-900' 
                                                : 'bg-black/40 border-[#333] focus:border-[#E0A339] focus:bg-black/60 text-white'
                                        }`}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Time of Day</label>
                                <select 
                                    value={editFormTime}
                                    onChange={(e) => setEditFormTime(e.target.value)}
                                    className={`w-full rounded px-2 py-1.5 outline-none transition-colors border ${
                                        isLight 
                                            ? 'bg-slate-55 border-slate-200 focus:border-[#E0A339]' 
                                            : 'bg-black/40 border-[#333] focus:border-[#E0A339] text-white'
                                    }`}
                                >
                                    <option value="DAY">DAY</option>
                                    <option value="NIGHT">NIGHT</option>
                                    <option value="DAWN">DAWN</option>
                                    <option value="DUSK">DUSK</option>
                                </select>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={`p-3 px-4 flex items-center justify-end gap-2 border-t ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-[#292929] bg-black/10'}`}>
                            <button 
                                onClick={() => setEditingStrip(null)}
                                className={`px-3 py-1.5 rounded font-mono text-[11px] transition-colors border ${
                                    isLight 
                                        ? 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100' 
                                        : 'border-[#333] text-gray-400 hover:text-white hover:bg-[#2c2c2c]'
                                }`}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveEdit}
                                className="px-3.5 py-1.5 rounded bg-[#E0A339] text-[#3A2708] text-[11px] font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#d09329] transition-colors cursor-pointer shadow-md"
                            >
                                <Check size={14} />
                                <span>Save Changes</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleView;

