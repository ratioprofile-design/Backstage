import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { 
    Clock, Calendar, AlertTriangle, AlertCircle, CheckCircle2, Camera, Utensils, 
    Truck, Sun, Moon, Zap, Plus, Trash2, ArrowUp, ArrowDown, Download, Copy, Check, 
    Settings, Layers, Film, Sliders, Sparkles, RefreshCw,
    ListFilter, Play, Printer, FileText, X, Eye,
    GripVertical, ChevronDown, ChevronUp, ShieldCheck, MapPin, Search, Filter, Share2, ShieldAlert
} from 'lucide-react';
import { Shot } from '../../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type ScheduleItemType = 'shot' | 'meal' | 'move' | 'lighting' | 'wrap';

export interface ShootDay {
    id: string;
    dayNumber: number; // 1 to 15
    date: string; // YYYY-MM-DD
    crewCallTime: string; // '06:00 AM'
    locationNote?: string;
    items: ScheduleItem[];
}

export interface ScheduleBlock {
    id: string;
    scheduleNumber: number; // 1, 2, 3...
    name: string; // "1st Schedule", "2nd Schedule", "3rd Schedule"
    startDate: string; // YYYY-MM-DD
    totalDaysCount: number; // 15
    days: ShootDay[];
    activeDayId: string;
}

const getTodayYMD = (): string => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const addDaysToYMD = (dateStr: string, daysToAdd: number): string => {
    if (!dateStr) return getTodayYMD();
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        return getTodayYMD();
    }
    const d = new Date(parts[0], parts[1] - 1, parts[2] + daysToAdd);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const formatShortDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return dateStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getOrdinalName = (num: number): string => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return `${num}st Schedule`;
    if (j === 2 && k !== 12) return `${num}nd Schedule`;
    if (j === 3 && k !== 13) return `${num}rd Schedule`;
    return `${num}th Schedule`;
};

const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return 'Set Date';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts.map(p => parseInt(p, 10));
    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

export interface ScheduleItem {
    id: string;
    type: ScheduleItemType;
    sceneNo?: string;
    shotNo?: string;
    title: string;
    description: string;
    location?: string;
    cameraLens?: string;
    angle?: string;
    movement?: string;
    durationMins: number;

    // Explicit Keys (INT/EXT, DAY/NIGHT, SPX/CGI/VFX)
    envKey?: 'INT' | 'EXT' | 'INT/EXT';
    timeKey?: 'DAY' | 'NIGHT' | 'MAGIC HR';
    fxKey?: 'SPX' | 'CGI' | 'VFX' | 'STUNT' | 'NONE';

    // Dynamically calculated fields
    startTime?: string;
    endTime?: string;
    startMinFromCall?: number;
    endMinFromCall?: number;
    setupNumber?: number;
    cumulativeMins?: number;
    isOvertime?: boolean;
}

// --- HELPER TIME UTILITIES ---
const timeToMins = (timeStr: string): number => {
    if (!timeStr) return 360; // Default 06:00 AM
    const clean = timeStr.trim().toUpperCase();
    
    let hours = 0;
    let mins = 0;
    
    const isPM = clean.includes('PM');
    const isAM = clean.includes('AM');
    const digitsOnly = clean.replace(/[^0-9:]/g, '');
    const parts = digitsOnly.split(':');

    if (parts.length >= 1) hours = parseInt(parts[0], 10) || 0;
    if (parts.length >= 2) mins = parseInt(parts[1], 10) || 0;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    return hours * 60 + mins;
};

const minsToTime = (totalMins: number): string => {
    const minsInDay = ((totalMins % 1440) + 1440) % 1440;
    let hours = Math.floor(minsInDay / 60);
    const mins = minsInDay % 60;
    const period = hours >= 12 ? 'PM' : 'AM';

    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;

    const hh = hours.toString().padStart(2, '0');
    const mm = mins.toString().padStart(2, '0');
    return `${hh}:${mm} ${period}`;
};

const formatDurationHM = (totalMins: number): string => {
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

// --- COLOR KEY BADGES ENGINE (INT/EXT, DAY/NIGHT, SFX/CGI/SPX) ---
export interface TagBadge {
    label: string;
    type: 'intext' | 'time' | 'fx';
    className: string;
    pdfClassName?: string;
    icon?: 'sun' | 'moon' | 'zap';
}

export const getItemTags = (item: ScheduleItem, beats: any[] = [], generatedShots: Shot[] = []): TagBadge[] => {
    const tags: TagBadge[] = [];

    const cleanScene = (item.sceneNo || '').trim();
    const matchedBeat = beats.find(b => 
        String(b.sceneNumber || '').trim() === cleanScene || String(b.id || '') === cleanScene
    );

    const cleanShot = (item.shotNo || '').trim().toLowerCase();
    const matchedShot = generatedShots.find(s => 
        String(s.scene || '').trim() === cleanScene && (
            String(s.id || '').toLowerCase() === cleanShot ||
            String(s.shotSize || '').toLowerCase() === cleanShot
        )
    );

    const fullText = [
        item.title || '',
        item.description || '',
        item.location || '',
        matchedBeat?.slug?.raw || '',
        matchedBeat?.slug?.prefix || '',
        matchedBeat?.slug?.time || '',
        matchedBeat?.slug?.location || '',
        matchedShot?.notes || '',
        (matchedShot as any)?.vfx || '',
        (matchedShot as any)?.sfx || ''
    ].join(' ').toUpperCase();

    // 1. INT / EXT Color Keys
    if (item.envKey) {
        if (item.envKey === 'INT/EXT') {
            tags.push({
                label: 'INT/EXT',
                type: 'intext',
                className: 'bg-cyan-950/90 text-cyan-300 border border-cyan-700/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]',
                pdfClassName: 'bg-cyan-100 text-cyan-900 border border-cyan-400 font-bold px-1 py-0.2 rounded text-[9px]'
            });
        } else if (item.envKey === 'EXT') {
            tags.push({
                label: 'EXT.',
                type: 'intext',
                className: 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]',
                pdfClassName: 'bg-emerald-100 text-emerald-900 border border-emerald-400 font-bold px-1 py-0.2 rounded text-[9px]'
            });
        } else {
            tags.push({
                label: 'INT.',
                type: 'intext',
                className: 'bg-indigo-950/90 text-indigo-300 border border-indigo-700/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]',
                pdfClassName: 'bg-indigo-100 text-indigo-900 border border-indigo-400 font-bold px-1 py-0.2 rounded text-[9px]'
            });
        }
    } else if (fullText.includes('INT./EXT.') || fullText.includes('EXT./INT.')) {
        tags.push({
            label: 'INT/EXT',
            type: 'intext',
            className: 'bg-cyan-950/90 text-cyan-300 border border-cyan-700/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]',
            pdfClassName: 'bg-cyan-100 text-cyan-900 border border-cyan-400 font-bold px-1 py-0.2 rounded text-[9px]'
        });
    } else if (fullText.includes('EXT.') || fullText.includes('EXT ') || matchedBeat?.slug?.prefix?.toUpperCase().includes('EXT')) {
        tags.push({
            label: 'EXT.',
            type: 'intext',
            className: 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]',
            pdfClassName: 'bg-emerald-100 text-emerald-900 border border-emerald-400 font-bold px-1 py-0.2 rounded text-[9px]'
        });
    } else if (fullText.includes('INT.') || fullText.includes('INT ') || matchedBeat?.slug?.prefix?.toUpperCase().includes('INT') || item.type === 'shot') {
        tags.push({
            label: 'INT.',
            type: 'intext',
            className: 'bg-indigo-950/90 text-indigo-300 border border-indigo-700/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]',
            pdfClassName: 'bg-indigo-100 text-indigo-900 border border-indigo-400 font-bold px-1 py-0.2 rounded text-[9px]'
        });
    }

    // 2. DAY / NIGHT Color Keys
    if (item.timeKey) {
        if (item.timeKey === 'NIGHT') {
            tags.push({
                label: 'NIGHT',
                type: 'time',
                icon: 'moon',
                className: 'bg-purple-950/90 text-purple-300 border border-purple-600/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1',
                pdfClassName: 'bg-purple-100 text-purple-900 border border-purple-400 font-bold px-1 py-0.2 rounded text-[9px]'
            });
        } else if (item.timeKey === 'MAGIC HR') {
            tags.push({
                label: 'MAGIC HR',
                type: 'time',
                icon: 'sun',
                className: 'bg-rose-950/90 text-rose-300 border border-rose-600/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1',
                pdfClassName: 'bg-rose-100 text-rose-900 border border-rose-400 font-bold px-1 py-0.2 rounded text-[9px]'
            });
        } else {
            tags.push({
                label: 'DAY',
                type: 'time',
                icon: 'sun',
                className: 'bg-amber-950/90 text-amber-300 border border-amber-600/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1',
                pdfClassName: 'bg-amber-100 text-amber-900 border border-amber-400 font-bold px-1 py-0.2 rounded text-[9px]'
            });
        }
    } else if (fullText.includes('NIGHT') || matchedBeat?.slug?.time?.toUpperCase().includes('NIGHT')) {
        tags.push({
            label: 'NIGHT',
            type: 'time',
            icon: 'moon',
            className: 'bg-purple-950/90 text-purple-300 border border-purple-600/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1',
            pdfClassName: 'bg-purple-100 text-purple-900 border border-purple-400 font-bold px-1 py-0.2 rounded text-[9px]'
        });
    } else if (fullText.includes('DUSK') || fullText.includes('DAWN') || fullText.includes('SUNSET') || fullText.includes('MAGIC HOUR')) {
        tags.push({
            label: 'MAGIC HR',
            type: 'time',
            icon: 'sun',
            className: 'bg-rose-950/90 text-rose-300 border border-rose-600/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1',
            pdfClassName: 'bg-rose-100 text-rose-900 border border-rose-400 font-bold px-1 py-0.2 rounded text-[9px]'
        });
    } else if (fullText.includes('DAY') || matchedBeat?.slug?.time?.toUpperCase().includes('DAY') || item.type === 'shot') {
        tags.push({
            label: 'DAY',
            type: 'time',
            icon: 'sun',
            className: 'bg-amber-950/90 text-amber-300 border border-amber-600/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1',
            pdfClassName: 'bg-amber-100 text-amber-900 border border-amber-400 font-bold px-1 py-0.2 rounded text-[9px]'
        });
    }

    // 3. SFX / VFX / CGI / SPX Color Keys
    if (item.fxKey && item.fxKey !== 'NONE') {
        let fxClass = 'bg-fuchsia-950/90 text-fuchsia-300 border border-fuchsia-600/60';
        if (item.fxKey === 'CGI') fxClass = 'bg-pink-950/90 text-pink-300 border border-pink-600/60';
        if (item.fxKey === 'VFX') fxClass = 'bg-violet-950/90 text-violet-300 border border-violet-600/60';
        if (item.fxKey === 'STUNT') fxClass = 'bg-red-950/90 text-red-300 border border-red-600/60';

        tags.push({
            label: item.fxKey,
            type: 'fx',
            icon: 'zap',
            className: `${fxClass} font-mono font-black px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 shadow-sm`,
            pdfClassName: 'bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-400 font-bold px-1 py-0.2 rounded text-[9px]'
        });
    } else if (!item.fxKey) {
        const isFx = fullText.includes('SFX') || 
                     fullText.includes('VFX') || 
                     fullText.includes('CGI') || 
                     fullText.includes('SPX') || 
                     fullText.includes('STUNT') || 
                     fullText.includes('GREENSCREEN') || 
                     fullText.includes('EXPLOSION') || 
                     fullText.includes('PRACTICAL') || 
                     Boolean((matchedShot as any)?.vfx) || 
                     Boolean((matchedShot as any)?.sfx);

        if (isFx) {
            let fxLabel = 'SFX';
            if (fullText.includes('CGI')) fxLabel = 'CGI';
            else if (fullText.includes('SPX')) fxLabel = 'SPX';
            else if (fullText.includes('VFX')) fxLabel = 'VFX';
            else if (fullText.includes('STUNT')) fxLabel = 'STUNT';

            tags.push({
                label: fxLabel,
                type: 'fx',
                icon: 'zap',
                className: 'bg-fuchsia-950/90 text-fuchsia-300 border border-fuchsia-600/60 font-mono font-black px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 shadow-sm',
                pdfClassName: 'bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-400 font-bold px-1 py-0.2 rounded text-[9px]'
            });
        }
    }

    return tags;
};

// --- POPULATE SCENE & SHOT DETAILS FROM SHOT DIVISION / SCRIPT BEATS ---
const populateFromShotDivision = (
    newSceneNo: string,
    newShotNo: string,
    generatedShots: Shot[],
    beats: any[],
    defaultShotMins: number
): Partial<ScheduleItem> => {
    const updates: Partial<ScheduleItem> = {
        sceneNo: newSceneNo,
        shotNo: newShotNo,
    };

    const cleanScene = (newSceneNo || '').trim();
    const cleanShot = (newShotNo || '').trim().toLowerCase();

    // 1. Look for matching Shot in Shot Division
    let matchedShot: Shot | undefined;
    if (cleanShot) {
        matchedShot = generatedShots.find(s => 
            String(s.scene || '').trim() === cleanScene && (
                String(s.id || '').toLowerCase() === cleanShot ||
                String(s.shotSize || '').toLowerCase() === cleanShot ||
                `${s.shotSize || ''}-${s.id || ''}`.toLowerCase().includes(cleanShot)
            )
        ) || generatedShots.find(s => 
            String(s.id || '').toLowerCase() === cleanShot ||
            String(s.shotSize || '').toLowerCase() === cleanShot
        );
    }

    if (!matchedShot && cleanScene) {
        matchedShot = generatedShots.find(s => String(s.scene || '').trim() === cleanScene);
    }

    // 2. Look for matching Scene Beat
    let matchedBeat = beats.find(b => 
        String(b.sceneNumber || '').trim() === cleanScene || String(b.id || '') === cleanScene
    );

    if (matchedShot) {
        if (!matchedBeat && matchedShot.scene) {
            matchedBeat = beats.find(b => 
                String(b.sceneNumber || '').trim() === String(matchedShot?.scene).trim() || 
                String(b.id || '') === String(matchedShot?.scene)
            );
        }

        const loc = matchedBeat?.slug?.location || (matchedShot as any).location || '';
        if (loc) updates.location = loc;

        const size = matchedShot.shotSize || 'WIDE';
        const subj = matchedShot.subject || matchedShot.angle || `SCENE ${cleanScene || '1'} ACTION`;
        updates.title = `${size} SHOT - ${subj}`;
        
        // Populate scene description & summary!
        const sceneSummary = matchedBeat?.summary || (matchedBeat?.text ? matchedBeat.text.substring(0, 160) : '');
        const shotDesc = matchedShot.description || matchedShot.notes || '';

        if (sceneSummary && shotDesc) {
            updates.description = `${sceneSummary} • ${shotDesc}`;
        } else if (sceneSummary) {
            updates.description = sceneSummary;
        } else {
            updates.description = shotDesc || `Coverage setup for Scene ${cleanScene || '1'}`;
        }

        if (matchedShot.lens) updates.cameraLens = matchedShot.lens;
        if (matchedShot.angle) updates.angle = matchedShot.angle;
        if (matchedShot.movement) updates.movement = matchedShot.movement;
        if (matchedShot.durationSec) {
            updates.durationMins = Math.max(5, Math.ceil(matchedShot.durationSec * 2.5));
        } else {
            updates.durationMins = defaultShotMins;
        }
    } else if (matchedBeat) {
        const loc = matchedBeat.slug?.location || 'MAIN SET';
        updates.location = loc;
        const prefix = matchedBeat.slug?.prefix || 'INT.';
        const timeOfDay = matchedBeat.slug?.time || 'DAY';
        updates.title = `SCENE ${cleanScene} - ${prefix} ${loc} (${timeOfDay})`;

        const sceneSummary = matchedBeat.summary || (matchedBeat.text ? matchedBeat.text.substring(0, 160) : 'Master scene action and dialogue coverage');
        updates.description = `Scene ${cleanScene} (${matchedBeat.slug?.raw || `${prefix} ${loc} - ${timeOfDay}`}): ${sceneSummary}`;

        updates.cameraLens = '35mm Prime';
        updates.angle = 'Eye Level';
        updates.movement = 'Static';
        updates.durationMins = defaultShotMins;
    }

    return updates;
};

// --- BUILD INITIAL SCHEDULE FROM SHOTS/BEATS ---
const buildInitialSchedule = (generatedShots: Shot[] = [], beats: any[] = [], defaultShotMins: number = 15): ScheduleItem[] => {
    const newItems: ScheduleItem[] = [];

    // Add Crew Arrival / Pre-light block
    newItems.push({
        id: `init-prelight-${Date.now()}`,
        type: 'lighting',
        title: 'Crew Arrival & Camera Pre-Light',
        description: 'Unload gear, set up video village, lighting check & actor block',
        durationMins: 30,
        location: beats[0]?.slug?.location || 'LOCATION 1'
    });

    let currentLoc = beats[0]?.slug?.location || '';
    let minsAccumulator = 30;
    let mealAdded = false;

    if (generatedShots && generatedShots.length > 0) {
        generatedShots.forEach((shot, index) => {
            const shotScene = shot.scene || '1';
            const relatedBeat = beats.find(b => b?.sceneNumber === shotScene || (b?.id !== undefined && String(b.id) === shotScene));
            const shotLoc = relatedBeat?.slug?.location || currentLoc || 'LOCATION 1';

            // Insert Company Move if location changed
            if (currentLoc && shotLoc !== currentLoc && index > 0) {
                newItems.push({
                    id: `move-${index}-${Date.now()}`,
                    type: 'move',
                    title: `Company Move to ${shotLoc.toUpperCase()}`,
                    description: `Pack unit gear, transport cast/crew from ${currentLoc} to ${shotLoc}`,
                    durationMins: 30,
                    location: shotLoc
                });
                minsAccumulator += 30;
                currentLoc = shotLoc;
            } else if (!currentLoc) {
                currentLoc = shotLoc;
            }

            // Check for Mandatory Meal Break around ~5.5 hours (330 mins) from Call
            if (!mealAdded && minsAccumulator >= 300) {
                newItems.push({
                    id: `meal-${Date.now()}`,
                    type: 'meal',
                    title: 'Mandatory Crew Meal Break (Lunch)',
                    description: '60-minute hot meal break for all departments. Catering setup.',
                    durationMins: 60,
                    location: currentLoc
                });
                minsAccumulator += 60;
                mealAdded = true;
            }

            // Add Shot Item
            newItems.push({
                id: shot.id || `shot-item-${index}-${Date.now()}`,
                type: 'shot',
                sceneNo: String(shot.scene || '1'),
                shotNo: shot.shotSize ? `${shot.shotSize.substring(0, 2)}-${index + 1}` : `S-${index + 1}`,
                title: `${shot.shotSize || 'WIDE'} SHOT - ${shot.subject || shot.angle || 'SCENE ACTION'}`,
                description: shot.description || 'Standard coverage setup and performance take.',
                location: shotLoc,
                cameraLens: (shot as any).cameraLens || shot.lens || '35mm Prime',
                angle: shot.angle || 'Eye Level',
                movement: shot.movement || 'Static',
                durationMins: shot.durationSec ? Math.max(10, Math.ceil(shot.durationSec * 2.5)) : defaultShotMins
            });

            minsAccumulator += defaultShotMins;
        });
    } else if (beats && beats.length > 0) {
        // Fallback: build schedule from Script Scene Beats
        beats.forEach((beat, bIdx) => {
            const loc = beat.slug?.location || 'MAIN SET';
            if (currentLoc && loc !== currentLoc) {
                newItems.push({
                    id: `move-beat-${bIdx}`,
                    type: 'move',
                    title: `Company Move to ${loc.toUpperCase()}`,
                    description: `Relocate equipment & cast to ${loc}`,
                    durationMins: 25,
                    location: loc
                });
                minsAccumulator += 25;
                currentLoc = loc;
            } else {
                currentLoc = loc;
            }

            if (!mealAdded && minsAccumulator >= 300) {
                newItems.push({
                    id: `meal-${Date.now()}`,
                    type: 'meal',
                    title: 'Mandatory Crew Meal Break (Lunch)',
                    description: '60-minute hot meal break for cast and crew.',
                    durationMins: 60,
                    location: currentLoc
                });
                minsAccumulator += 60;
                mealAdded = true;
            }

            // Add coverage shots per scene
            const sceneNum = beat.sceneNumber || (bIdx + 1).toString();
            newItems.push({
                id: `shot-master-${bIdx}`,
                type: 'shot',
                sceneNo: sceneNum,
                shotNo: `1A`,
                title: `Master Establishing Shot`,
                description: `${beat.slug?.prefix || 'INT.'} ${loc} - ${beat.slug?.time || 'DAY'}`,
                location: loc,
                cameraLens: '24mm Wide',
                angle: 'Eye Level',
                movement: 'Static',
                durationMins: 20
            });

            newItems.push({
                id: `shot-close-${bIdx}`,
                type: 'shot',
                sceneNo: sceneNum,
                shotNo: `1B`,
                title: `Medium Close-Up Coverage`,
                description: `Primary character dialog performance & coverage`,
                location: loc,
                cameraLens: '50mm Prime',
                angle: 'Eye Level',
                movement: 'Pan/Tilt',
                durationMins: 15
            });

            minsAccumulator += 35;
        });
    } else {
        // Default sample template
        newItems.push({
            id: 'sample-1',
            type: 'shot',
            sceneNo: '1',
            shotNo: '1A',
            title: 'EXT. STREET - WIDE ESTABLISHING',
            description: 'Hero vehicle arrives on street scene',
            location: 'CITY STREET',
            cameraLens: '24mm Wide',
            angle: 'Low Angle',
            movement: 'Tracking Dolly',
            durationMins: 20
        });
        newItems.push({
            id: 'sample-2',
            type: 'shot',
            sceneNo: '1',
            shotNo: '1B',
            title: 'INT. CAR - MEDIUM CLOSE UP',
            description: 'Protagonist reacts to incoming radio call',
            location: 'CITY STREET',
            cameraLens: '50mm Prime',
            angle: 'Eye Level',
            movement: 'Handheld',
            durationMins: 15
        });
        newItems.push({
            id: 'sample-meal',
            type: 'meal',
            title: 'Mandatory Crew Meal Break',
            description: '60-minute catered lunch break',
            durationMins: 60,
            location: 'CATERING TENT'
        });
        newItems.push({
            id: 'sample-3',
            type: 'shot',
            sceneNo: '2',
            shotNo: '2A',
            title: 'INT. DINER - MASTER COVERAGE',
            description: 'Full conversation at corner booth table',
            location: 'DINER',
            cameraLens: '35mm Prime',
            angle: 'High Angle',
            movement: 'Steadicam',
            durationMins: 25
        });
    }

    // Add Tail-Lights Wrap block
    newItems.push({
        id: `wrap-${Date.now()}`,
        type: 'wrap',
        title: 'Tail-Lights Wrap & Gear De-Rig',
        description: 'Pack camera packages, sound logs backup, wrap cast & tail-lights departure',
        durationMins: 20,
        location: currentLoc || 'MAIN SET'
    });

    return newItems;
};

// Helper to build 15 Shoot Days for a Schedule Block (e.g. 1st Schedule)
const build15ShootDaysForBlock = (
    startDate: string,
    totalDaysCount: number = 15,
    generatedShots: Shot[] = [],
    beats: any[] = [],
    defaultShotMins: number = 15
): ShootDay[] => {
    const days: ShootDay[] = [];
    const hasShots = generatedShots && generatedShots.length > 0;
    const shotsPerDay = hasShots ? Math.max(1, Math.ceil(generatedShots.length / totalDaysCount)) : 0;

    for (let i = 0; i < totalDaysCount; i++) {
        const dayNum = i + 1;
        const dayDate = addDaysToYMD(startDate, i);
        const dayId = `day-${dayNum}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        let dayShots: Shot[] = [];
        if (hasShots) {
            const startIdx = i * shotsPerDay;
            dayShots = generatedShots.slice(startIdx, startIdx + shotsPerDay);
        }

        const items = buildInitialSchedule(dayShots, beats, defaultShotMins);

        days.push({
            id: dayId,
            dayNumber: dayNum,
            date: dayDate,
            crewCallTime: '06:00 AM',
            locationNote: (dayShots[0] as any)?.location || beats[0]?.slug?.location || 'MAIN LOCATION',
            items: items
        });
    }

    return days;
};

const ScheduleView: React.FC = () => {
    const project = useProject() || {};
    const generatedShots = project.generatedShots || [];
    const beats = project.beats || [];
    const scriptConfig = project.scriptConfig || { noteFont: 'Courier New' };
    const projectList = project.projectList || [];
    const currentProjectId = project.currentProjectId;
    const currentProjectName = projectList.find((p: any) => p.id === currentProjectId)?.name || 'Untitled Feature Film';

    // Master Anchor & Setup Config
    const [defaultShotMins, setDefaultShotMins] = useState<number>(15);
    const [filterCategory, setFilterCategory] = useState<'all' | 'shots' | 'logistics'>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
    const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const pdfPrintRef = useRef<HTMLDivElement>(null);

    // Schedule Blocks State (e.g. 1st Schedule, 2nd Schedule) each containing 1-15 Shoot Days
    const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>(() => {
        const todayStr = getTodayYMD();
        const initialDays = build15ShootDaysForBlock(todayStr, 15, generatedShots, beats, 15);
        return [
            {
                id: 'block-1',
                scheduleNumber: 1,
                name: '1st Schedule',
                startDate: todayStr,
                totalDaysCount: 15,
                days: initialDays,
                activeDayId: initialDays[0].id
            }
        ];
    });

    const [activeBlockId, setActiveBlockId] = useState<string>('block-1');

    // Active Schedule Block computed reference
    const activeBlock = useMemo(() => {
        return scheduleBlocks.find(b => b.id === activeBlockId) || scheduleBlocks[0];
    }, [scheduleBlocks, activeBlockId]);

    // Active Shoot Day computed reference
    const activeDay = useMemo(() => {
        return activeBlock.days.find(d => d.id === activeBlock.activeDayId) || activeBlock.days[0] || {
            id: 'day-1',
            dayNumber: 1,
            date: getTodayYMD(),
            crewCallTime: '06:00 AM',
            items: []
        };
    }, [activeBlock]);

    const items = activeDay.items || [];
    const crewCallTime = activeDay.crewCallTime || '06:00 AM';

    const setCrewCallTime = (timeStr: string) => {
        setScheduleBlocks(prev => prev.map(block => {
            if (block.id === activeBlock.id) {
                const updatedDays = block.days.map(d => d.id === activeDay.id ? { ...d, crewCallTime: timeStr } : d);
                return { ...block, days: updatedDays };
            }
            return block;
        }));
    };

    const setItems = (actionOrItems: ScheduleItem[] | ((prev: ScheduleItem[]) => ScheduleItem[])) => {
        setScheduleBlocks(prev => prev.map(block => {
            if (block.id === activeBlock.id) {
                const updatedDays = block.days.map(d => {
                    if (d.id === activeDay.id) {
                        const nextItems = typeof actionOrItems === 'function' ? actionOrItems(d.items) : actionOrItems;
                        return { ...d, items: nextItems };
                    }
                    return d;
                });
                return { ...block, days: updatedDays };
            }
            return block;
        }));
    };

    // --- SCHEDULE & DAY MANAGEMENT HANDLERS ---
    const handleSelectShootDay = (dayId: string) => {
        setScheduleBlocks(prev => prev.map(block => block.id === activeBlock.id ? { ...block, activeDayId: dayId } : block));
    };

    const handleAddShootDay = () => {
        const nextDayNum = activeBlock.days.length + 1;
        const lastDay = activeBlock.days[activeBlock.days.length - 1];
        const nextDateStr = lastDay ? addDaysToYMD(lastDay.date, 1) : getTodayYMD();
        const newDayId = `day-${nextDayNum}-${Date.now()}`;

        const newDay: ShootDay = {
            id: newDayId,
            dayNumber: nextDayNum,
            date: nextDateStr,
            crewCallTime: '06:00 AM',
            locationNote: 'LOCATION',
            items: buildInitialSchedule([], beats, defaultShotMins)
        };

        setScheduleBlocks(prev => prev.map(block => {
            if (block.id === activeBlock.id) {
                return {
                    ...block,
                    totalDaysCount: block.totalDaysCount + 1,
                    days: [...block.days, newDay],
                    activeDayId: newDayId
                };
            }
            return block;
        }));
    };

    const handlePopulate15DaySchedule = () => {
        const freshDays = build15ShootDaysForBlock(activeBlock.startDate, 15, generatedShots, beats, defaultShotMins);
        setScheduleBlocks(prev => prev.map(block => {
            if (block.id === activeBlock.id) {
                return {
                    ...block,
                    totalDaysCount: 15,
                    days: freshDays,
                    activeDayId: freshDays[0].id
                };
            }
            return block;
        }));
    };

    const handleAddScheduleBlock = () => {
        const nextBlockNum = scheduleBlocks.length + 1;
        const nextName = getOrdinalName(nextBlockNum);
        const lastBlock = scheduleBlocks[scheduleBlocks.length - 1];
        const lastDay = lastBlock?.days[lastBlock.days.length - 1];
        const newStartDate = lastDay ? addDaysToYMD(lastDay.date, 1) : getTodayYMD();

        const newDays = build15ShootDaysForBlock(newStartDate, 15, generatedShots, beats, defaultShotMins);
        const newBlockId = `block-${Date.now()}`;

        const newBlock: ScheduleBlock = {
            id: newBlockId,
            scheduleNumber: nextBlockNum,
            name: nextName,
            startDate: newStartDate,
            totalDaysCount: 15,
            days: newDays,
            activeDayId: newDays[0].id
        };

        setScheduleBlocks(prev => [...prev, newBlock]);
        setActiveBlockId(newBlockId);
    };

    const handleUpdateActiveBlockName = (name: string) => {
        setScheduleBlocks(prev => prev.map(b => b.id === activeBlock.id ? { ...b, name } : b));
    };

    const handleUpdateActiveBlockStartDate = (startDate: string) => {
        setScheduleBlocks(prev => prev.map(b => {
            if (b.id === activeBlock.id) {
                const shiftDays = b.days.map((d, idx) => ({
                    ...d,
                    date: addDaysToYMD(startDate, idx)
                }));
                return { ...b, startDate, days: shiftDays };
            }
            return b;
        }));
    };

    const handleUpdateActiveDayDate = (newDate: string) => {
        setScheduleBlocks(prev => prev.map(b => {
            if (b.id === activeBlock.id) {
                const updatedDays = b.days.map(d => d.id === activeDay.id ? { ...d, date: newDate } : d);
                return { ...b, days: updatedDays };
            }
            return b;
        }));
    };

    const handleDeleteShootDay = (dayId: string) => {
        if (activeBlock.days.length <= 1) return;
        const remaining = activeBlock.days.filter(d => d.id !== dayId);
        const renumbered = remaining.map((d, idx) => ({ ...d, dayNumber: idx + 1 }));
        setScheduleBlocks(prev => prev.map(b => {
            if (b.id === activeBlock.id) {
                return {
                    ...b,
                    totalDaysCount: renumbered.length,
                    days: renumbered,
                    activeDayId: activeBlock.activeDayId === dayId ? renumbered[0].id : activeBlock.activeDayId
                };
            }
            return b;
        }));
    };

    const handleDeleteScheduleBlock = (blockId: string) => {
        if (scheduleBlocks.length <= 1) return;
        const remaining = scheduleBlocks.filter(b => b.id !== blockId);
        setScheduleBlocks(remaining);
        if (activeBlockId === blockId) {
            setActiveBlockId(remaining[0].id);
        }
    };

    // Re-sync initial schedule for active schedule
    const generateInitialSchedule = () => {
        setItems(buildInitialSchedule(generatedShots, beats, defaultShotMins));
    };

    useEffect(() => {
        if (items.length === 0) {
            generateInitialSchedule();
        }
    }, [items.length]);

    // --- CASCADING TIME & CAMERA SETUP ENGINE ---
    const cascadedData = useMemo(() => {
        const crewCallMins = timeToMins(crewCallTime);
        let currentMins = crewCallMins;
        let setupCount = 0;
        let lastShotSpec: { location?: string; cameraLens?: string; angle?: string; movement?: string } | null = null;
        let firstShotCallTime = '';
        let hasMealBreak = false;
        let firstMealStartMins = -1;

        const calculatedItems: ScheduleItem[] = items.map((item) => {
            const startMins = currentMins;
            const endMins = currentMins + item.durationMins;
            const startMinFromCall = startMins - crewCallMins;
            const endMinFromCall = endMins - crewCallMins;

            currentMins = endMins;

            let setupNum: number | undefined = undefined;

            if (item.type === 'shot') {
                if (!firstShotCallTime) {
                    firstShotCallTime = minsToTime(startMins);
                }

                const isSpecChanged = !lastShotSpec || 
                    lastShotSpec.location !== item.location ||
                    lastShotSpec.cameraLens !== item.cameraLens ||
                    lastShotSpec.angle !== item.angle ||
                    lastShotSpec.movement !== item.movement;

                if (isSpecChanged) {
                    setupCount++;
                }

                setupNum = setupCount;
                lastShotSpec = {
                    location: item.location,
                    cameraLens: item.cameraLens,
                    angle: item.angle,
                    movement: item.movement
                };
            }

            if (item.type === 'meal') {
                hasMealBreak = true;
                if (firstMealStartMins === -1) {
                    firstMealStartMins = startMinFromCall;
                }
            }

            return {
                ...item,
                startTime: minsToTime(startMins),
                endTime: minsToTime(endMins),
                startMinFromCall,
                endMinFromCall,
                setupNumber: setupNum,
                cumulativeMins: endMinFromCall,
                isOvertime: endMinFromCall > 720 // > 12.0 Hours
            };
        });

        const totalElapsedMins = currentMins - crewCallMins;
        const totalElapsedHours = Number((totalElapsedMins / 60).toFixed(2));
        const estimatedWrapTime = minsToTime(currentMins);

        // Overtime Status Logic
        let overtimeStatus: 'standard' | 'warning' | 'critical' = 'standard';
        let overtimeLabel = 'STANDARD DAY (≤12.0h)';
        let overtimeColorClass = 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60';

        if (totalElapsedHours > 14.0) {
            overtimeStatus = 'critical';
            overtimeLabel = 'CRITICAL OVERTIME (>14.0h)';
            overtimeColorClass = 'bg-red-950/80 text-red-400 border-red-700/60';
        } else if (totalElapsedHours > 12.0) {
            overtimeStatus = 'warning';
            overtimeLabel = 'OVERTIME WARNING (12.0h - 14.0h)';
            overtimeColorClass = 'bg-amber-950/80 text-amber-400 border-amber-700/60';
        }

        // Meal Break 6-Hour Violation Check
        const mealViolation = !hasMealBreak || (firstMealStartMins > 360);

        const shotCount = calculatedItems.filter(i => i.type === 'shot').length;

        return {
            calculatedItems,
            crewCallTime,
            firstShotCallTime: firstShotCallTime || minsToTime(crewCallMins),
            estimatedWrapTime,
            totalElapsedMins,
            totalElapsedHours,
            overtimeStatus,
            overtimeLabel,
            overtimeColorClass,
            totalSetups: setupCount,
            shotCount,
            mealViolation,
            firstMealStartMins
        };
    }, [items, crewCallTime]);

    // --- ITEM ACTIONS ---
    const handleAddLogisticsItem = (type: ScheduleItemType, afterIndex?: number) => {
        const titles: Record<ScheduleItemType, string> = {
            shot: 'New Camera Shot Coverage',
            meal: 'Department Meal Break (Lunch)',
            move: 'Company Unit Location Move',
            lighting: 'Camera Turnaround & Relight',
            wrap: 'Tail-Lights Wrap'
        };

        const defaultDurations: Record<ScheduleItemType, number> = {
            shot: defaultShotMins,
            meal: 60,
            move: 30,
            lighting: 20,
            wrap: 15
        };

        const newItem: ScheduleItem = {
            id: `item-${Date.now()}`,
            type,
            title: titles[type],
            description: type === 'shot' ? 'Camera coverage setup' : 'Logistics event block',
            durationMins: defaultDurations[type],
            location: 'CURRENT SET'
        };

        const updated = [...items];
        if (afterIndex !== undefined && afterIndex >= 0) {
            updated.splice(afterIndex + 1, 0, newItem);
        } else {
            updated.push(newItem);
        }
        setItems(updated);
    };

    const handleUpdateItem = (id: string, updates: Partial<ScheduleItem>) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // UI Layout & Drag-and-Drop State
    const [showFullStats, setShowFullStats] = useState<boolean>(true);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }
        const updated = [...items];
        const [moved] = updated.splice(draggedIndex, 1);
        updated.splice(targetIndex, 0, moved);
        setItems(updated);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleSelectShotDirectly = (itemId: string, selectedShotId: string) => {
        if (!selectedShotId) return;
        const matchedShot = generatedShots.find(s => String(s.id) === String(selectedShotId));
        if (!matchedShot) return;

        const cleanScene = String(matchedShot.scene || '1').trim();
        const matchedBeat = beats.find(b => 
            String(b.sceneNumber || '').trim() === cleanScene || 
            String(b.id || '') === cleanScene
        );

        const loc = matchedBeat?.slug?.location || (matchedShot as any).location || 'MAIN SET';
        const size = matchedShot.shotSize || 'WIDE';
        const subj = matchedShot.subject || matchedShot.angle || `SCENE ${cleanScene} ACTION`;

        handleUpdateItem(itemId, {
            sceneNo: cleanScene,
            shotNo: matchedShot.shotSize ? `${matchedShot.shotSize.substring(0, 3)}-${matchedShot.id}` : String(matchedShot.id),
            title: `${size} SHOT - ${subj}`,
            description: matchedShot.description || matchedShot.notes || 'Coverage setup from Shot Division',
            location: loc,
            cameraLens: (matchedShot as any).cameraLens || matchedShot.lens || '35mm Prime',
            angle: matchedShot.angle || 'Eye Level',
            movement: matchedShot.movement || 'Static',
            durationMins: matchedShot.durationSec ? Math.max(5, Math.ceil(matchedShot.durationSec * 2.5)) : defaultShotMins
        });
    };

    const handleSceneChange = (id: string, sceneNo: string) => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        const currentShotNo = item.shotNo || '';
        const autoPopulated = populateFromShotDivision(sceneNo, currentShotNo, generatedShots, beats, defaultShotMins);
        handleUpdateItem(id, autoPopulated);
    };

    const handleShotChange = (id: string, shotNo: string) => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        const currentSceneNo = item.sceneNo || '';
        const autoPopulated = populateFromShotDivision(currentSceneNo, shotNo, generatedShots, beats, defaultShotMins);
        handleUpdateItem(id, autoPopulated);
    };

    // --- PDF / PRINT HANDLERS ---
    const handlePrintPdf = () => {
        window.print();
    };

    const handleExportPdfFile = async () => {
        if (!pdfPrintRef.current) return;
        try {
            setIsExportingPdf(true);
            const canvas = await html2canvas(pdfPrintRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            const imgWidth = 297; // A4 landscape width mm
            const pageHeight = 210; // A4 landscape height mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const cleanProjectName = currentProjectName.replace(/[^a-zA-Z0-9_-]/g, '_');
            pdf.save(`${cleanProjectName}_Shooting_Schedule_CallSheet.pdf`);
        } catch (err) {
            console.error('Failed to export PDF file:', err);
        } finally {
            setIsExportingPdf(false);
        }
    };

    const filteredItems = useMemo(() => {
        return cascadedData.calculatedItems.filter(item => {
            if (filterCategory === 'shots' && item.type !== 'shot') return false;
            if (filterCategory === 'logistics' && item.type === 'shot') return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = item.title.toLowerCase().includes(q);
                const matchDesc = item.description.toLowerCase().includes(q);
                const matchLoc = item.location?.toLowerCase().includes(q);
                const matchScene = item.sceneNo?.toLowerCase().includes(q);
                return matchTitle || matchDesc || matchLoc || matchScene;
            }
            return true;
        });
    }, [cascadedData.calculatedItems, filterCategory, searchQuery]);

    // Category styling badges
    const getCategoryBadge = (type: ScheduleItemType) => {
        switch (type) {
            case 'shot':
                return <span className="bg-sky-950/80 text-sky-400 border border-sky-800/60 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Camera size={11} /> Shot</span>;
            case 'meal':
                return <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Utensils size={11} /> Meal</span>;
            case 'move':
                return <span className="bg-purple-950/80 text-purple-400 border border-purple-800/60 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Truck size={11} /> Unit Move</span>;
            case 'lighting':
                return <span className="bg-amber-950/80 text-amber-400 border border-amber-800/60 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Zap size={11} /> Setup</span>;
            case 'wrap':
                return <span className="bg-rose-950/80 text-rose-400 border border-rose-800/60 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><Moon size={11} /> Wrap</span>;
        }
    };

    return (
        <div className="w-full h-full bg-[#0c0c0e] text-gray-200 font-sans flex flex-col overflow-hidden">
            {/* --- TOP HEADER COMMAND BAR --- */}
            <div className="bg-[#121216] border-b border-[#22222a] px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-[#f5a623]/10 border border-[#f5a623]/30 rounded-lg text-[#f5a623]">
                        <Calendar size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-black text-white uppercase tracking-wider">
                                Shooting Day Schedule
                            </h1>
                            <span className="bg-[#1d1d26] text-amber-400 border border-[#2e2e3d] text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                {currentProjectName}
                            </span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium hidden sm:block">
                            Dynamic 1st AD Cascading Time & Camera Setup Engine
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={generateInitialSchedule}
                        className="px-2.5 py-1.5 bg-[#1a1a22] hover:bg-[#242430] text-gray-300 border border-[#2e2e3d] hover:border-[#f5a623] rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        title="Re-sync schedule from project shot list"
                    >
                        <RefreshCw size={13} className="text-[#f5a623]" />
                        <span className="hidden md:inline">Sync Shots</span>
                    </button>

                    <div className="h-4 w-px bg-[#2a2a36] hidden sm:block"></div>

                    {/* Quick Add Actions */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleAddLogisticsItem('shot')}
                            className="px-2.5 py-1.5 bg-[#f5a623] hover:bg-[#e09612] text-black rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow"
                        >
                            <Plus size={14} /> Shot
                        </button>

                        <button
                            onClick={() => handleAddLogisticsItem('meal')}
                            className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all hidden sm:flex"
                        >
                            <Utensils size={13} /> Meal
                        </button>

                        <button
                            onClick={() => handleAddLogisticsItem('move')}
                            className="px-2.5 py-1.5 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-800/60 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all hidden sm:flex"
                        >
                            <Truck size={13} /> Move
                        </button>
                    </div>

                    <div className="h-4 w-px bg-[#2a2a36]"></div>

                    <button
                        onClick={() => setShowPdfModal(true)}
                        className="px-3 py-1.5 bg-[#1d1d28] hover:bg-[#282838] text-[#f5a623] border border-[#f5a623]/40 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
                    >
                        <Printer size={13} /> PDF Call Sheet
                    </button>
                </div>
            </div>

            {/* --- MULTI-SCHEDULE BLOCKS BAR --- */}
            <div className="bg-[#15151c] border-b border-[#242430] px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-sm">
                {/* Schedule Block Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-0.5 max-w-full">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 shrink-0 font-mono">
                        <Layers size={13} className="text-[#f5a623]" /> Schedules:
                    </span>
                    
                    {scheduleBlocks.map((b) => {
                        const isActive = b.id === activeBlock.id;
                        return (
                            <div 
                                key={b.id}
                                onClick={() => setActiveBlockId(b.id)}
                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                                    isActive
                                        ? 'bg-[#222230] text-white border-[#f5a623] shadow-md'
                                        : 'bg-[#121218] text-gray-400 border-[#262634] hover:text-gray-200 hover:border-gray-500'
                                }`}
                            >
                                <div className="flex flex-col text-left leading-tight">
                                    <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#f5a623]' : 'bg-gray-600'}`}></span>
                                        {b.name}
                                    </span>
                                    <span className="text-[10px] font-mono text-amber-400/90 font-normal mt-0.5">
                                        {b.days.length} Shoot Days ({formatShortDate(b.startDate)} - {formatShortDate(b.days[b.days.length - 1]?.date)})
                                    </span>
                                </div>

                                {scheduleBlocks.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteScheduleBlock(b.id);
                                        }}
                                        className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-950/40 rounded transition-all ml-1 cursor-pointer"
                                        title="Delete Schedule Block"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={handleAddScheduleBlock}
                        className="px-3 py-1.5 bg-[#1e1e28] hover:bg-[#282838] text-amber-400 border border-amber-500/30 hover:border-amber-400 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow-xs"
                        title="Add Next Shooting Schedule Stint"
                    >
                        <Plus size={14} /> Add Schedule
                    </button>
                </div>

                {/* Schedule Block Actions & Dates */}
                <div className="flex items-center gap-3 bg-[#0f0f14] border border-[#282836] px-3 py-1.5 rounded-lg text-xs font-mono flex-wrap">
                    <button
                        type="button"
                        onClick={handlePopulate15DaySchedule}
                        className="px-2.5 py-1 bg-[#231e12] hover:bg-[#332b1a] text-amber-300 border border-amber-500/40 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                        title="Auto-populate 1 to 15 Shoot Days with Project Shots"
                    >
                        <Sparkles size={12} className="text-amber-400" />
                        <span>Build 15-Day Stint</span>
                    </button>

                    <div className="h-4 w-px bg-[#282836] hidden sm:block"></div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
                            <Calendar size={12} className="text-amber-400" /> Start:
                        </span>
                        <input
                            type="date"
                            value={activeBlock.startDate}
                            onChange={(e) => handleUpdateActiveBlockStartDate(e.target.value)}
                            className="bg-[#181824] text-amber-300 font-bold px-2 py-0.5 rounded border border-[#333346] focus:border-amber-400 outline-none text-xs cursor-pointer"
                        />
                    </div>
                    
                    <div className="h-4 w-px bg-[#282836]"></div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Name:</span>
                        <input
                            type="text"
                            value={activeBlock.name}
                            onChange={(e) => handleUpdateActiveBlockName(e.target.value)}
                            className="bg-transparent text-white font-bold px-1.5 py-0.5 rounded border-b border-gray-600 focus:border-amber-400 outline-none text-xs w-28"
                            placeholder="e.g. 1st Schedule"
                        />
                    </div>
                </div>
            </div>

            {/* --- SHOOT DAYS SUB-STRIP (DAY 1 TO DAY 15) --- */}
            <div className="bg-[#111116] border-b border-[#202028] px-4 py-2 flex items-center justify-between gap-3 shrink-0 shadow-inner overflow-x-auto custom-scrollbar">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest shrink-0 flex items-center gap-1 mr-2 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                        <Film size={12} /> {activeBlock.name}:
                    </span>

                    <div className="flex items-center gap-1.5">
                        {activeBlock.days.map((day) => {
                            const isSelected = day.id === activeDay.id;
                            const shotCount = day.items.filter(i => i.type === 'shot').length;
                            return (
                                <div
                                    key={day.id}
                                    onClick={() => handleSelectShootDay(day.id)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer shrink-0 border ${
                                        isSelected
                                            ? 'bg-amber-500/20 text-white border-amber-400 shadow-sm font-bold'
                                            : 'bg-[#181820] text-gray-400 border-[#282834] hover:bg-[#20202b] hover:text-gray-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                            isSelected ? 'bg-amber-400 text-black' : 'bg-[#282836] text-gray-300'
                                        }`}>
                                            Day {day.dayNumber}
                                        </span>
                                        <span className="text-[11px] font-semibold text-gray-200">
                                            {formatShortDate(day.date)}
                                        </span>
                                        {shotCount > 0 && (
                                            <span className="text-[10px] text-sky-400 bg-sky-950/60 border border-sky-800/40 px-1.5 py-0.2 rounded font-mono">
                                                {shotCount} shots
                                            </span>
                                        )}
                                    </div>

                                    {activeBlock.days.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteShootDay(day.id);
                                            }}
                                            className="p-0.5 text-gray-500 hover:text-red-400 hover:bg-red-950/40 rounded transition-all ml-0.5 cursor-pointer"
                                            title={`Delete Day ${day.dayNumber}`}
                                        >
                                            <X size={11} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        <button
                            type="button"
                            onClick={handleAddShootDay}
                            className="px-2.5 py-1.5 bg-[#1b1b24] hover:bg-[#262634] text-amber-400 border border-amber-500/30 hover:border-amber-400 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                            title="Add Next Shoot Day"
                        >
                            <Plus size={13} /> Day {activeBlock.days.length + 1}
                        </button>
                    </div>
                </div>

                {/* Day Specific Date Selector */}
                <div className="flex items-center gap-2 bg-[#0a0a0e] border border-[#22222e] px-2.5 py-1 rounded-lg text-xs font-mono shrink-0">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Active Day Date:</span>
                    <input
                        type="date"
                        value={activeDay.date}
                        onChange={(e) => handleUpdateActiveDayDate(e.target.value)}
                        className="bg-transparent text-amber-300 font-bold outline-none text-xs cursor-pointer"
                    />
                </div>
            </div>

            {/* --- KEY METRICS KPI FLOATING BAR --- */}
            <div className="bg-[#14141a] border-b border-[#202028] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 font-mono">
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Crew Call Input */}
                    <div className="flex items-center gap-2 bg-[#0f0f14] border border-[#2a2a36] px-2.5 py-1 rounded-lg">
                        <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
                            <Clock size={12} className="text-[#f5a623]" /> Call:
                        </span>
                        <input
                            type="text"
                            value={crewCallTime}
                            onChange={(e) => setCrewCallTime(e.target.value)}
                            className="bg-transparent text-amber-400 font-bold text-xs w-20 text-center outline-none border-b border-amber-500/30 focus:border-amber-400"
                        />
                    </div>

                    {/* First Shot */}
                    <div className="flex items-center gap-1.5 text-gray-300">
                        <span className="text-[10px] text-gray-500 uppercase font-sans">First Shot:</span>
                        <span className="font-bold text-sky-400">{cascadedData.firstShotCallTime}</span>
                    </div>

                    {/* Est Wrap */}
                    <div className="flex items-center gap-1.5 text-gray-300">
                        <span className="text-[10px] text-gray-500 uppercase font-sans">Est. Wrap:</span>
                        <span className="font-bold text-purple-400">{cascadedData.estimatedWrapTime}</span>
                    </div>

                    {/* Work Window */}
                    <div className="flex items-center gap-1.5 text-gray-300">
                        <span className="text-[10px] text-gray-500 uppercase font-sans">Window:</span>
                        <span className="font-bold text-amber-300">{formatDurationHM(cascadedData.totalElapsedMins)} ({cascadedData.totalElapsedHours}h)</span>
                    </div>

                    {/* Setups Count */}
                    <div className="flex items-center gap-1.5 text-gray-300">
                        <span className="text-[10px] text-gray-500 uppercase font-sans">Setups:</span>
                        <span className="font-bold text-emerald-400">#{cascadedData.totalSetups} ({cascadedData.shotCount} shots)</span>
                    </div>

                    {/* Overtime Status Badge */}
                    <div className={`px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${cascadedData.overtimeColorClass}`}>
                        {cascadedData.overtimeLabel}
                    </div>

                    {/* Union Meal Rule Badge */}
                    {!cascadedData.mealViolation ? (
                        <div className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                            <ShieldCheck size={12} className="text-emerald-400" /> Meal Rule Compliant
                        </div>
                    ) : (
                        <div className="bg-red-950/80 text-red-300 border border-red-700/60 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 animate-pulse">
                            <ShieldAlert size={12} className="text-red-400" /> Union Lunch Violation
                        </div>
                    )}
                </div>

                {/* Timeline Strip Toggle */}
                <button
                    onClick={() => setShowFullStats(!showFullStats)}
                    className="text-[11px] text-gray-400 hover:text-amber-400 flex items-center gap-1 font-bold uppercase transition-all"
                >
                    <Layers size={12} />
                    {showFullStats ? 'Hide Visual Timeline' : 'Show Visual Timeline'}
                    {showFullStats ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
            </div>

            {/* --- CINEMATIC VISUAL TIMELINE PROGRESS BAR --- */}
            {showFullStats && (
                <div className="bg-[#0f0f13] border-b border-[#20202a] px-4 py-2 shrink-0 animate-in slide-in-from-top duration-200">
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 font-mono">
                        <span className="flex items-center gap-1 text-amber-400"><Film size={12} /> Shooting Day Visual Timeline</span>
                        <span>12.0h Union Overtime Threshold Line</span>
                    </div>
                    <div className="relative w-full h-4 bg-[#181822] rounded-md overflow-hidden flex border border-[#2b2b3a] shadow-inner">
                        {/* 12h Overtime Threshold Line */}
                        <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                            style={{ left: `${Math.min(100, (720 / Math.max(720, cascadedData.totalElapsedMins)) * 100)}%` }}
                            title="12-Hour Overtime Mark"
                        />
                        {/* 6h Union Meal Threshold Line */}
                        <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 z-10 border-dashed"
                            style={{ left: `${Math.min(100, (360 / Math.max(720, cascadedData.totalElapsedMins)) * 100)}%` }}
                            title="6-Hour Union Meal Mark"
                        />

                        {cascadedData.calculatedItems.map((item) => {
                            const widthPct = (item.durationMins / Math.max(1, cascadedData.totalElapsedMins)) * 100;
                            let bgColor = 'bg-sky-600/80 hover:bg-sky-500';
                            if (item.type === 'meal') bgColor = 'bg-emerald-600/90 hover:bg-emerald-500';
                            else if (item.type === 'move') bgColor = 'bg-purple-600/90 hover:bg-purple-500';
                            else if (item.type === 'lighting') bgColor = 'bg-amber-600/90 hover:bg-amber-500';
                            else if (item.type === 'wrap') bgColor = 'bg-rose-600/90 hover:bg-rose-500';

                            return (
                                <div
                                    key={item.id}
                                    style={{ width: `${widthPct}%` }}
                                    className={`h-full border-r border-[#0c0c0e] ${bgColor} transition-colors cursor-pointer group relative`}
                                    title={`${item.startTime} - ${item.endTime}: ${item.title} (${item.durationMins}m)`}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* --- UNION LUNCH VIOLATION WARNING BANNER (> 6.0 HOURS) --- */}
            {cascadedData.mealViolation && (
                <div className="bg-gradient-to-r from-red-950/95 via-red-900/90 to-red-950/95 border-b border-red-700/80 px-4 py-2 flex items-center justify-between text-xs text-red-200 font-bold shrink-0 shadow-lg animate-in fade-in duration-200">
                    <div className="flex items-center gap-2.5">
                        <AlertTriangle size={18} className="text-red-400 animate-bounce shrink-0" />
                        <div>
                            {cascadedData.firstMealStartMins > 360 ? (
                                <span>
                                    <strong className="text-white uppercase tracking-wider bg-red-800 px-1.5 py-0.5 rounded mr-1.5">6-Hour Union Meal Violation:</strong> 
                                    Scheduled lunch starts at <span className="text-amber-300 font-mono font-black">{minsToTime(timeToMins(crewCallTime) + cascadedData.firstMealStartMins)}</span> (+{formatDurationHM(cascadedData.firstMealStartMins)} from Call). Exceeds 6.0h limit by <span className="text-amber-300 font-mono font-black">{cascadedData.firstMealStartMins - 360} mins</span>!
                                </span>
                            ) : (
                                <span>
                                    <strong className="text-white uppercase tracking-wider bg-red-800 px-1.5 py-0.5 rounded mr-1.5">Missing Meal Break:</strong> 
                                    No Lunch Break scheduled! Union rules mandate a 60-minute hot meal break within 6.0 hours (360 mins) of Crew Call ({crewCallTime}).
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => handleAddLogisticsItem('meal', 2)}
                        className="px-3.5 py-1 bg-amber-400 hover:bg-amber-300 text-black font-black uppercase text-[10px] rounded-md shadow-md transition-all shrink-0 ml-3"
                    >
                        + Insert Compliant Meal Break
                    </button>
                </div>
            )}

            {/* --- FILTER & SEARCH TOOLBAR + COLOR KEY LEGEND --- */}
            <div className="bg-[#121217] border-b border-[#202028] px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            <ListFilter size={12} /> View:
                        </span>
                        <div className="flex bg-[#191922] rounded-lg p-0.5 border border-[#282836]">
                            <button
                                onClick={() => setFilterCategory('all')}
                                className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${filterCategory === 'all' ? 'bg-[#f5a623] text-black shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                All ({cascadedData.calculatedItems.length})
                            </button>
                            <button
                                onClick={() => setFilterCategory('shots')}
                                className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${filterCategory === 'shots' ? 'bg-[#f5a623] text-black shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                Shots ({cascadedData.shotCount})
                            </button>
                            <button
                                onClick={() => setFilterCategory('logistics')}
                                className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${filterCategory === 'logistics' ? 'bg-[#f5a623] text-black shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                Logistics ({cascadedData.calculatedItems.length - cascadedData.shotCount})
                            </button>
                        </div>
                    </div>

                    {/* COLOR KEY BADGES LEGEND */}
                    <div className="flex items-center gap-1.5 pl-3 border-l border-[#282836] text-[10px]">
                        <span className="text-gray-500 font-bold uppercase tracking-wider text-[9px]">Keys:</span>
                        <span className="bg-indigo-950/90 text-indigo-300 border border-indigo-700/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]">INT.</span>
                        <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]">EXT.</span>
                        <span className="bg-amber-950/90 text-amber-300 border border-amber-600/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5"><Sun size={9}/> DAY</span>
                        <span className="bg-purple-950/90 text-purple-300 border border-purple-600/60 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5"><Moon size={9}/> NIGHT</span>
                        <span className="bg-fuchsia-950/90 text-fuchsia-300 border border-fuchsia-600/60 font-mono font-black px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5"><Zap size={9}/> SFX/CGI</span>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Add Shot directly from Shot Division */}
                    {generatedShots.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                            <Sparkles size={13} className="text-amber-400" />
                            <select
                                onChange={(e) => {
                                    if (!e.target.value) return;
                                    const shot = generatedShots.find(s => String(s.id) === e.target.value);
                                    if (shot) {
                                        handleAddLogisticsItem('shot');
                                        setTimeout(() => {
                                            setItems(prev => {
                                                const copy = [...prev];
                                                const last = copy[copy.length - 1];
                                                if (last) {
                                                    const cleanScene = String(shot.scene || '1');
                                                    last.sceneNo = cleanScene;
                                                    last.shotNo = shot.shotSize ? `${shot.shotSize.substring(0, 3)}-${shot.id}` : String(shot.id);
                                                    last.title = `${shot.shotSize || 'WIDE'} SHOT - ${shot.subject || shot.angle || 'ACTION'}`;
                                                    last.description = shot.description || 'Shot division setup';
                                                    last.cameraLens = (shot as any).cameraLens || shot.lens || '35mm Prime';
                                                    last.angle = shot.angle || 'Eye Level';
                                                    last.movement = shot.movement || 'Static';
                                                    if (shot.durationSec) last.durationMins = Math.max(5, Math.ceil(shot.durationSec * 2.5));
                                                }
                                                return copy;
                                            });
                                        }, 50);
                                    }
                                    e.target.value = '';
                                }}
                                className="bg-[#1a1a24] border border-[#2a2a3a] hover:border-[#f5a623] text-amber-300 text-xs font-bold px-2.5 py-1 rounded-lg outline-none cursor-pointer shadow-sm"
                            >
                                <option value="">+ Add Shot from Script Division...</option>
                                {generatedShots.map((s, idx) => (
                                    <option key={s.id || idx} value={s.id}>
                                        Sc {s.scene || '1'} • {s.shotSize || 'Shot'} - {s.subject || s.description?.substring(0, 25) || 'Coverage'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Search Field */}
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Filter schedule..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-[#181820] border border-[#282836] focus:border-[#f5a623] text-xs text-white pl-8 pr-2.5 py-1 rounded-lg outline-none w-44"
                        />
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-400">
                        <span className="font-bold text-gray-300">Default:</span>
                        <input
                            type="number"
                            value={defaultShotMins}
                            onChange={(e) => setDefaultShotMins(Math.max(5, parseInt(e.target.value, 10) || 15))}
                            className="w-11 bg-[#181820] border border-[#282836] text-center text-white font-mono text-xs font-bold rounded py-0.5 outline-none"
                        />
                        <span>m</span>
                    </div>
                </div>
            </div>

            {/* --- MASTER CHRONOLOGICAL SCHEDULE TABLE WITH DRAG & DROP --- */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4">
                <div className="bg-[#121217] border border-[#20202a] rounded-xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left border-collapse table-auto min-w-[1000px]">
                        <thead>
                            <tr className="bg-[#181820] border-b border-[#252533] text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                <th className="py-3 px-2 w-10 text-center" title="Drag to reorder items">
                                    <span className="flex items-center justify-center gap-0.5"><GripVertical size={12} /></span>
                                </th>
                                <th className="py-3 px-3 w-32">Time Window</th>
                                <th className="py-3 px-3 w-24">Type</th>
                                <th className="py-3 px-3 w-32 text-center">Scene & Shot</th>
                                <th className="py-3 px-2 w-14 text-center">Setup</th>
                                <th className="py-3 px-3 w-40">KEYS (INT/EXT, DAY/NIGHT, FX)</th>
                                <th className="py-3 px-3 min-w-[240px] w-auto">Scene / Event Details</th>
                                <th className="py-3 px-3 w-48">Camera Specs</th>
                                <th className="py-3 px-3 w-44">Location / Set</th>
                                <th className="py-3 px-2 w-20 text-center">Duration</th>
                                <th className="py-3 px-3 w-24 text-right">Cumul.</th>
                                <th className="py-3 px-2 w-10 text-center">Del</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e1e28] text-xs">
                            {filteredItems.map((item, index) => {
                                const isOvertimeRow = (item.endMinFromCall || 0) > 720;
                                const isMealViolationRow = item.type === 'meal' && (item.startMinFromCall || 0) > 360;
                                const realIndex = items.findIndex(i => i.id === item.id);
                                const isBeingDragged = draggedIndex === realIndex;
                                const isDragTarget = dragOverIndex === realIndex && !isBeingDragged;

                                const getItemRowStyle = (type: ScheduleItemType) => {
                                    if (isBeingDragged) return 'opacity-30 bg-amber-950/40 border-l-4 border-l-amber-500';
                                    if (isDragTarget) return 'border-t-2 border-amber-400 bg-amber-500/20 border-l-4 border-l-amber-400';
                                    if (isMealViolationRow) return 'bg-red-950/40 hover:bg-red-900/50 border-l-4 border-l-red-500';
                                    
                                    switch (type) {
                                        case 'meal':
                                            return 'bg-[#062c1b]/80 hover:bg-[#064e3b] border-l-4 border-l-emerald-500 font-medium';
                                        case 'move':
                                            return 'bg-[#2e1065]/70 hover:bg-[#3b0764] border-l-4 border-l-purple-500 font-medium';
                                        case 'lighting':
                                            return 'bg-[#451a03]/70 hover:bg-[#78350f] border-l-4 border-l-amber-500 font-medium';
                                        case 'wrap':
                                            return 'bg-[#4c0519]/70 hover:bg-[#881337] border-l-4 border-l-rose-500 font-medium';
                                        case 'shot':
                                        default:
                                            return 'bg-transparent hover:bg-[#161622] border-l-2 border-l-transparent';
                                    }
                                };

                                return (
                                    <tr 
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, realIndex)}
                                        onDragOver={(e) => handleDragOver(e, realIndex)}
                                        onDrop={(e) => handleDrop(e, realIndex)}
                                        onDragEnd={handleDragEnd}
                                        className={`transition-all border-b border-[#20202e] ${getItemRowStyle(item.type)}`}
                                    >
                                        {/* DRAG HANDLE & ROW NUMBER */}
                                        <td className="py-2.5 px-2 text-center text-gray-500 font-mono select-none">
                                            <div className="flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing hover:text-amber-400 group">
                                                <GripVertical size={14} className="text-gray-500 group-hover:text-amber-400 transition-colors" />
                                                <span className="font-bold text-gray-300 text-[11px]">{index + 1}</span>
                                            </div>
                                        </td>

                                        {/* START & END CASCADED TIMES */}
                                        <td className="py-2.5 px-3 font-mono">
                                            <div className="flex items-center gap-1 font-bold text-white text-[11px]">
                                                <Clock size={11} className="text-[#f5a623]" />
                                                <span>{item.startTime}</span>
                                                <span className="text-gray-600">→</span>
                                                <span>{item.endTime}</span>
                                            </div>
                                            <div className="text-[9px] text-gray-400 mt-0.5 font-sans">
                                                +{item.startMinFromCall}m to +{item.endMinFromCall}m
                                            </div>
                                        </td>

                                        {/* CATEGORY BADGE */}
                                        <td className="py-2.5 px-3">
                                            {getCategoryBadge(item.type)}
                                        </td>

                                        {/* SCENE & SHOT SELECTION / INPUT */}
                                        <td className="py-2.5 px-2 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="flex items-center justify-center gap-1 w-full">
                                                    {/* Scene selector / input */}
                                                    <span className="text-[9px] font-bold text-amber-500 uppercase font-mono">Sc</span>
                                                    <input
                                                        type="text"
                                                        value={item.sceneNo || ''}
                                                        onChange={(e) => handleSceneChange(item.id, e.target.value)}
                                                        placeholder="#"
                                                        className="bg-[#0f0f14] text-amber-400 border border-[#2a2a38] focus:border-[#f5a623] font-mono text-xs font-bold px-1.5 py-0.5 rounded w-11 text-center outline-none"
                                                    />

                                                    {/* Shot selector / input */}
                                                    {item.type === 'shot' && (
                                                        <>
                                                            <span className="text-[9px] font-bold text-sky-400 uppercase font-mono ml-0.5">Sh</span>
                                                            <input
                                                                type="text"
                                                                value={item.shotNo || ''}
                                                                onChange={(e) => handleShotChange(item.id, e.target.value)}
                                                                placeholder="#"
                                                                className="bg-[#0f0f14] text-sky-400 border border-[#2a2a38] focus:border-[#f5a623] font-mono text-xs font-bold px-1.5 py-0.5 rounded w-11 text-center outline-none"
                                                            />
                                                        </>
                                                    )}
                                                </div>

                                                {/* Direct Shot Division Select Option for Shot Rows */}
                                                {item.type === 'shot' && generatedShots.length > 0 && (
                                                    <select
                                                        value=""
                                                        onChange={(e) => handleSelectShotDirectly(item.id, e.target.value)}
                                                        className="w-full bg-[#0d0d12] text-[9px] text-gray-400 hover:text-amber-300 border border-[#252535] rounded px-1 py-0.5 outline-none cursor-pointer truncate"
                                                        title="Auto-fill details from Shot Division"
                                                    >
                                                        <option value="">Auto-fill Shot...</option>
                                                        {generatedShots.map((s, sIdx) => (
                                                            <option key={s.id || sIdx} value={s.id}>
                                                                Sc {s.scene || '1'} • {s.shotSize || 'Shot'} ({s.subject || 'Action'})
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        </td>

                                        {/* SETUP NUMBER AUTO-COUNTER */}
                                        <td className="py-2.5 px-2 text-center font-mono">
                                            {item.setupNumber !== undefined ? (
                                                <span className="bg-[#1b1b26] border border-emerald-800/50 text-emerald-400 font-black px-1.5 py-0.5 rounded-full text-[11px] shadow-sm">
                                                    #{item.setupNumber}
                                                </span>
                                            ) : (
                                                <span className="text-gray-600">-</span>
                                            )}
                                        </td>

                                        {/* KEYS (INT/EXT, DAY/NIGHT, SPX/CGI/VFX) */}
                                        <td className="py-2.5 px-2">
                                            <div className="flex flex-col gap-1 text-[10px] font-mono">
                                                {/* ENV KEY TOGGLE: INT / EXT / INT/EXT */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const activeTag = getItemTags(item, beats, generatedShots).find(t => t.type === 'intext')?.label.replace('.', '');
                                                        const current = item.envKey || (activeTag as any) || 'INT';
                                                        const nextEnv = current === 'INT' ? 'EXT' : current === 'EXT' ? 'INT/EXT' : 'INT';
                                                        handleUpdateItem(item.id, { envKey: nextEnv });
                                                    }}
                                                    className={`px-1.5 py-0.5 rounded font-bold text-left text-[10px] border transition-all flex items-center justify-between cursor-pointer ${
                                                        (item.envKey || getItemTags(item, beats, generatedShots).find(t => t.type === 'intext')?.label) === 'INT/EXT'
                                                            ? 'bg-cyan-950 text-cyan-300 border-cyan-700/80 hover:bg-cyan-900'
                                                            : (item.envKey || getItemTags(item, beats, generatedShots).find(t => t.type === 'intext')?.label)?.includes('EXT')
                                                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700/80 hover:bg-emerald-900'
                                                            : 'bg-indigo-950 text-indigo-300 border-indigo-700/80 hover:bg-indigo-900'
                                                    }`}
                                                    title="Click to toggle INT / EXT / INT/EXT"
                                                >
                                                    <span>{item.envKey ? (item.envKey === 'INT' ? 'INT.' : item.envKey === 'EXT' ? 'EXT.' : 'INT/EXT') : getItemTags(item, beats, generatedShots).find(t => t.type === 'intext')?.label || 'INT.'}</span>
                                                    <span className="text-[8px] text-gray-500 font-sans">▾</span>
                                                </button>

                                                {/* TIME KEY TOGGLE: DAY / NIGHT / MAGIC HR */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const activeTag = getItemTags(item, beats, generatedShots).find(t => t.type === 'time')?.label;
                                                        const current = item.timeKey || (activeTag as any) || 'DAY';
                                                        const nextTime = current === 'DAY' ? 'NIGHT' : current === 'NIGHT' ? 'MAGIC HR' : 'DAY';
                                                        handleUpdateItem(item.id, { timeKey: nextTime });
                                                    }}
                                                    className={`px-1.5 py-0.5 rounded font-bold text-left text-[10px] border transition-all flex items-center justify-between cursor-pointer ${
                                                        (item.timeKey || getItemTags(item, beats, generatedShots).find(t => t.type === 'time')?.label) === 'NIGHT'
                                                            ? 'bg-purple-950 text-purple-300 border-purple-600/80 hover:bg-purple-900'
                                                            : (item.timeKey || getItemTags(item, beats, generatedShots).find(t => t.type === 'time')?.label) === 'MAGIC HR'
                                                            ? 'bg-rose-950 text-rose-300 border-rose-600/80 hover:bg-rose-900'
                                                            : 'bg-amber-950 text-amber-300 border-amber-600/80 hover:bg-amber-900'
                                                    }`}
                                                    title="Click to toggle DAY / NIGHT / MAGIC HR"
                                                >
                                                    <span className="flex items-center gap-1">
                                                        {(item.timeKey || getItemTags(item, beats, generatedShots).find(t => t.type === 'time')?.label) === 'NIGHT' ? <Moon size={9} /> : <Sun size={9} />}
                                                        {item.timeKey || getItemTags(item, beats, generatedShots).find(t => t.type === 'time')?.label || 'DAY'}
                                                    </span>
                                                    <span className="text-[8px] text-gray-500 font-sans">▾</span>
                                                </button>

                                                {/* FX KEY TOGGLE: NONE / SPX / CGI / VFX / STUNT */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const activeTag = getItemTags(item, beats, generatedShots).find(t => t.type === 'fx')?.label;
                                                        const current = item.fxKey || (activeTag as any) || 'NONE';
                                                        const nextFx = current === 'NONE' ? 'SPX' : current === 'SPX' ? 'CGI' : current === 'CGI' ? 'VFX' : current === 'VFX' ? 'STUNT' : 'NONE';
                                                        handleUpdateItem(item.id, { fxKey: nextFx });
                                                    }}
                                                    className={`px-1.5 py-0.5 rounded font-bold text-left text-[10px] border transition-all flex items-center justify-between cursor-pointer ${
                                                        (item.fxKey || getItemTags(item, beats, generatedShots).find(t => t.type === 'fx')?.label) && (item.fxKey || getItemTags(item, beats, generatedShots).find(t => t.type === 'fx')?.label) !== 'NONE'
                                                            ? 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-600/80 hover:bg-fuchsia-900'
                                                            : 'bg-[#0f0f14] text-gray-500 border-[#222230] hover:text-gray-300'
                                                    }`}
                                                    title="Click to toggle FX: SPX / CGI / VFX / STUNT / NONE"
                                                >
                                                    <span className="flex items-center gap-1">
                                                        <Zap size={9} />
                                                        {item.fxKey || getItemTags(item, beats, generatedShots).find(t => t.type === 'fx')?.label || 'NO FX'}
                                                    </span>
                                                    <span className="text-[8px] text-gray-500 font-sans">▾</span>
                                                </button>
                                            </div>
                                        </td>

                                        {/* SCENE / EVENT DETAILS & COLOR KEYS */}
                                        <td className="py-2.5 px-3">
                                            {/* COLOR KEY BADGES */}
                                            {getItemTags(item, beats, generatedShots).length > 0 && (
                                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                    {getItemTags(item, beats, generatedShots).map((tag, tIdx) => (
                                                        <span key={tIdx} className={tag.className}>
                                                            {tag.icon === 'sun' && <Sun size={9} />}
                                                            {tag.icon === 'moon' && <Moon size={9} />}
                                                            {tag.icon === 'zap' && <Zap size={9} />}
                                                            {tag.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <input
                                                type="text"
                                                value={item.title}
                                                onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                                                placeholder="Event or Shot Title"
                                                className="bg-transparent border-b border-transparent hover:border-[#3a3a4c] focus:border-[#f5a623] text-white font-bold outline-none w-full text-xs"
                                            />

                                            {/* SCENE DESCRIPTION & BEAT TEXTAREA */}
                                            <div className="mt-1 flex items-center gap-1 w-full">
                                                <textarea
                                                    rows={1}
                                                    value={item.description || ''}
                                                    onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                                                    placeholder="Add scene notes or script beat..."
                                                    className="w-full bg-transparent text-gray-300 hover:text-white focus:text-white text-[11px] leading-snug outline-none resize-none font-sans placeholder:text-gray-600/70 border-b border-transparent focus:border-amber-500/50 transition-colors p-0"
                                                />
                                            </div>

                                            {/* MEAL DELAY WARNING ON ROW */}
                                            {item.type === 'meal' && (item.startMinFromCall || 0) > 360 && (
                                                <div className="mt-1 bg-red-950/90 border border-red-700 text-red-300 rounded px-2 py-1 text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                                                    <AlertTriangle size={12} className="text-red-400 shrink-0" />
                                                    <span>MEAL VIOLATION: Lunch starts at +{formatDurationHM(item.startMinFromCall || 0)} from Call Time (Exceeds 6.0h limit by {(item.startMinFromCall || 0) - 360}m)!</span>
                                                </div>
                                            )}
                                        </td>

                                        {/* CAMERA SPECS (LENS, ANGLE, MOVEMENT) */}
                                        <td className="py-2.5 px-3">
                                            {item.type === 'shot' ? (
                                                <div className="flex flex-col gap-1 text-[10px] font-mono">
                                                    <div className="flex items-center justify-between gap-1 bg-[#0a0a0f] border border-[#222230] rounded px-1.5 py-0.5">
                                                        <span className="text-gray-500 text-[9px] uppercase font-sans">Lens:</span>
                                                        <input
                                                            type="text"
                                                            value={item.cameraLens || '35mm'}
                                                            onChange={(e) => handleUpdateItem(item.id, { cameraLens: e.target.value })}
                                                            className="bg-transparent text-amber-300 font-bold outline-none text-right w-16"
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between gap-1 bg-[#0a0a0f] border border-[#222230] rounded px-1.5 py-0.5">
                                                        <span className="text-gray-500 text-[9px] uppercase font-sans">Angle:</span>
                                                        <input
                                                            type="text"
                                                            value={item.angle || 'Eye Level'}
                                                            onChange={(e) => handleUpdateItem(item.id, { angle: e.target.value })}
                                                            className="bg-transparent text-sky-300 font-bold outline-none text-right w-20"
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between gap-1 bg-[#0a0a0f] border border-[#222230] rounded px-1.5 py-0.5">
                                                        <span className="text-gray-500 text-[9px] uppercase font-sans">Move:</span>
                                                        <input
                                                            type="text"
                                                            value={item.movement || 'Static'}
                                                            onChange={(e) => handleUpdateItem(item.id, { movement: e.target.value })}
                                                            className="bg-transparent text-purple-300 font-bold outline-none text-right w-20"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 font-mono text-[10px] italic">-</span>
                                            )}
                                        </td>

                                        {/* LOCATION / SET */}
                                        <td className="py-2.5 px-3">
                                            <input
                                                type="text"
                                                value={item.location || ''}
                                                onChange={(e) => handleUpdateItem(item.id, { location: e.target.value })}
                                                className="bg-[#0c0c12] border border-[#222230] hover:border-[#3a3a4c] focus:border-[#f5a623] text-gray-200 text-xs outline-none w-full uppercase font-semibold px-2 py-1 rounded transition-colors"
                                                placeholder="SET LOCATION"
                                            />
                                        </td>

                                        {/* DURATION INPUT */}
                                        <td className="py-2.5 px-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <input
                                                    type="number"
                                                    value={item.durationMins}
                                                    onChange={(e) => handleUpdateItem(item.id, { durationMins: Math.max(1, parseInt(e.target.value, 10) || 5) })}
                                                    className="w-12 bg-[#0f0f14] border border-[#2a2a38] focus:border-[#f5a623] text-center text-white font-mono font-bold py-0.5 rounded outline-none"
                                                />
                                                <span className="text-[10px] text-gray-500 font-sans">m</span>
                                            </div>
                                        </td>

                                        {/* CUMULATIVE SET TIME */}
                                        <td className="py-2.5 px-3 text-right font-mono">
                                            <div className="font-bold text-gray-200">
                                                {formatDurationHM(item.cumulativeMins || 0)}
                                            </div>
                                            <div className="text-[9px] text-gray-500 font-sans">
                                                {((item.cumulativeMins || 0) / 60).toFixed(1)}h total
                                            </div>
                                        </td>

                                        {/* ACTIONS (DOUBLE CLICK DELETE) */}
                                        <td className="py-2.5 px-2 text-center select-none">
                                            <button
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveItem(item.id);
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                }}
                                                className="p-1.5 bg-red-950/20 hover:bg-red-900/60 text-red-400 hover:text-white border border-red-900/40 rounded transition-all flex flex-col items-center justify-center gap-0.5 mx-auto cursor-pointer group"
                                                title="Double-click to delete this card"
                                            >
                                                <Trash2 size={13} className="group-hover:scale-110 transition-transform" />
                                                <span className="text-[8px] font-mono font-bold text-red-400/80 group-hover:text-white uppercase leading-none">2x Del</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="py-12 text-center text-gray-500">
                                        No schedule items found matching your filter criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- PDF PREVIEW & PRINT CALL SHEET MODAL --- */}
            {showPdfModal && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[2000] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
                    <style>{`
                        @media print {
                            @page {
                                size: landscape;
                                margin: 6mm;
                            }
                            body * {
                                visibility: hidden !important;
                            }
                            #printable-callsheet, #printable-callsheet * {
                                visibility: visible !important;
                            }
                            #printable-callsheet {
                                position: absolute !important;
                                left: 0 !important;
                                top: 0 !important;
                                width: 100% !important;
                                margin: 0 !important;
                                padding: 12px !important;
                                background: white !important;
                                color: black !important;
                                box-shadow: none !important;
                                border: none !important;
                            }
                            .no-print {
                                display: none !important;
                            }
                        }
                    `}</style>

                    <div className="bg-[#14141c] border border-[#2a2a3a] rounded-2xl w-full max-w-[1240px] max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
                        {/* MODAL HEADER CONTROLS */}
                        <div className="bg-[#1a1a24] border-b border-[#2a2a38] px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 no-print">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                    <Printer className="text-[#f5a623]" size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                            Daily Call Sheet & Shooting Schedule PDF Preview
                                        </h3>
                                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                                            Landscape A4 Format
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                        Optimized horizontal layout for print and vector PDF export.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <button
                                    onClick={handlePrintPdf}
                                    className="px-4 py-2 bg-[#f5a623] hover:bg-[#e09612] text-black rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md transition-all cursor-pointer"
                                >
                                    <Printer size={15} /> Print / Save as PDF
                                </button>
                                <button
                                    onClick={handleExportPdfFile}
                                    disabled={isExportingPdf}
                                    className="px-4 py-2 bg-[#2a2a38] hover:bg-[#353548] text-white border border-[#3e3e50] rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {isExportingPdf ? <RefreshCw size={14} className="animate-spin text-amber-400" /> : <Download size={14} />}
                                    {isExportingPdf ? 'Generating PDF...' : 'Download PDF File'}
                                </button>
                                <button
                                    onClick={() => setShowPdfModal(false)}
                                    className="p-2 text-gray-400 hover:text-white rounded-lg transition-all cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* MODAL BODY (PRINTABLE CALL SHEET CANVAS - LANDSCAPE WIDESCREEN) */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#0a0a0f] flex justify-center">
                            <div 
                                id="printable-callsheet"
                                ref={pdfPrintRef}
                                className="bg-white text-gray-900 w-full max-w-[1140px] p-7 shadow-2xl rounded-sm border border-gray-300 font-sans text-xs flex flex-col gap-5"
                            >
                                {/* CALL SHEET HEADER */}
                                <div className="border-b-2 border-slate-900 pb-3.5 flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-900 text-amber-400 font-mono font-bold text-[10px] px-2 py-0.5 uppercase tracking-widest rounded">
                                                Official Production Call Sheet
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-500 font-semibold uppercase">
                                                1st AD Logistics Engine
                                            </span>
                                        </div>
                                        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 mt-1">
                                            {currentProjectName}
                                        </h1>
                                        <div className="text-xs text-slate-600 font-semibold mt-0.5">
                                            Shooting Day Schedule & Cascading Time Division Matrix
                                        </div>
                                    </div>
                                    <div className="text-right font-mono border-l-2 border-slate-300 pl-4">
                                        <div className="text-xs font-bold text-slate-900">
                                            DATE: <span className="font-black text-amber-800">{formatDisplayDate(activeDay.date)}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-700 font-bold mt-0.5 uppercase">
                                            {activeBlock.name} • DAY {activeDay.dayNumber} OF {activeBlock.days.length}
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            CALL SHEET #0{activeDay.dayNumber} • MAIN UNIT
                                        </div>
                                    </div>
                                </div>

                                {/* DAY LOGISTICS ANCHOR SUMMARY - 6 HORIZONTAL COLUMNS */}
                                <div className="grid grid-cols-6 gap-2 bg-slate-100 p-3 rounded border border-slate-300 font-mono text-center">
                                    <div className="border-r border-slate-300 pr-1">
                                        <div className="text-[9px] font-bold text-slate-500 uppercase">Crew Call</div>
                                        <div className="text-xs font-black text-slate-900 mt-0.5">{cascadedData.crewCallTime}</div>
                                    </div>
                                    <div className="border-r border-slate-300 pr-1">
                                        <div className="text-[9px] font-bold text-slate-500 uppercase">First Shot</div>
                                        <div className="text-xs font-black text-slate-900 mt-0.5">{cascadedData.firstShotCallTime || '06:30 AM'}</div>
                                    </div>
                                    <div className="border-r border-slate-300 pr-1">
                                        <div className="text-[9px] font-bold text-slate-500 uppercase">Lunch Break</div>
                                        <div className="text-xs font-black text-emerald-800 mt-0.5">
                                            {cascadedData.firstMealStartMins > 0 
                                                ? minsToTime(cascadedData.firstMealStartMins + timeToMins(crewCallTime)) 
                                                : 'SCHEDULED'}
                                        </div>
                                    </div>
                                    <div className="border-r border-slate-300 pr-1">
                                        <div className="text-[9px] font-bold text-slate-500 uppercase">Est. Wrap</div>
                                        <div className="text-xs font-black text-slate-900 mt-0.5">{cascadedData.estimatedWrapTime}</div>
                                    </div>
                                    <div className="border-r border-slate-300 pr-1">
                                        <div className="text-[9px] font-bold text-slate-500 uppercase">Camera Setups</div>
                                        <div className="text-xs font-black text-amber-800 mt-0.5">#{cascadedData.totalSetups} Setups</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-bold text-slate-500 uppercase">Working Window</div>
                                        <div className="text-xs font-black text-slate-900 mt-0.5">{cascadedData.totalElapsedHours.toFixed(1)} hrs</div>
                                    </div>
                                </div>

                                {/* LOCATIONS & KEYS SUMMARY BAR */}
                                <div className="bg-slate-50 p-2.5 border border-slate-200 rounded flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                                            Locations:
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {Array.from(new Set(items.map(i => i.location || 'SET'))).map((loc, idx) => (
                                                <span key={idx} className="bg-white border border-slate-300 text-slate-900 font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 shadow-xs">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>
                                                    {String(loc || 'SET').toUpperCase()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                        <span className="text-slate-500 font-bold uppercase">Keys:</span>
                                        <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold px-1.5 py-0.5 rounded">INT.</span>
                                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-1.5 py-0.5 rounded">EXT.</span>
                                        <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded">DAY</span>
                                        <span className="bg-purple-100 text-purple-900 border border-purple-300 font-bold px-1.5 py-0.5 rounded">NIGHT</span>
                                        <span className="bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-300 font-bold px-1.5 py-0.5 rounded">SFX/VFX</span>
                                    </div>
                                </div>

                                {/* SHOOTING DAY SCHEDULE TABLE (LANDSCAPE WIDE COLUMNS) */}
                                <div>
                                    <div className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2 flex items-center justify-between border-b-2 border-slate-900 pb-1">
                                        <span>Chronological Shooting Schedule</span>
                                        <span className="text-[10px] font-normal text-slate-600 font-mono">
                                            Total Day Window: {formatDurationHM(cascadedData.totalElapsedMins)} ({cascadedData.totalElapsedHours.toFixed(1)} hrs)
                                        </span>
                                    </div>

                                    <table className="w-full text-left border-collapse font-sans">
                                        <thead>
                                            <tr className="bg-slate-200 border-y border-slate-900 text-[10px] font-black uppercase text-slate-900">
                                                <th className="py-2 px-1.5 w-8 text-center">#</th>
                                                <th className="py-2 px-2 w-28">Time Window</th>
                                                <th className="py-2 px-1.5 w-16 text-center">Type</th>
                                                <th className="py-2 px-1.5 w-16 text-center">Sc / Sh</th>
                                                <th className="py-2 px-1.5 w-14 text-center">Setup</th>
                                                <th className="py-2 px-2 w-28">Keys</th>
                                                <th className="py-2 px-2.5">Event / Scene Description</th>
                                                <th className="py-2 px-2 w-36">Optics & Specs</th>
                                                <th className="py-2 px-2 w-28">Location</th>
                                                <th className="py-2 px-2 w-20 text-right">Dur / Cumul</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-300 text-[11px]">
                                            {cascadedData.calculatedItems.map((item, idx) => {
                                                const rowBg = item.type === 'meal' 
                                                    ? 'bg-emerald-50/80 font-bold border-l-4 border-l-emerald-600' 
                                                    : item.type === 'move'
                                                    ? 'bg-purple-50/80 font-bold border-l-4 border-l-purple-600'
                                                    : item.type === 'lighting'
                                                    ? 'bg-amber-50/80 font-bold border-l-4 border-l-amber-600'
                                                    : item.type === 'wrap'
                                                    ? 'bg-rose-50/80 font-bold border-l-4 border-l-rose-600'
                                                    : 'bg-white text-slate-900';

                                                return (
                                                    <tr key={item.id} className={rowBg}>
                                                        <td className="py-2 px-1.5 text-center font-mono font-bold text-slate-700">{idx + 1}</td>
                                                        <td className="py-2 px-2 font-mono font-bold whitespace-nowrap text-slate-900">
                                                            {item.startTime} - {item.endTime}
                                                        </td>
                                                        <td className="py-2 px-1.5 text-center">
                                                            <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                                                                item.type === 'shot' ? 'bg-slate-100 text-slate-800 border border-slate-300' :
                                                                item.type === 'meal' ? 'bg-emerald-200 text-emerald-900 font-black' :
                                                                item.type === 'move' ? 'bg-purple-200 text-purple-900 font-black' :
                                                                item.type === 'lighting' ? 'bg-amber-200 text-amber-900 font-black' :
                                                                'bg-rose-200 text-rose-900 font-black'
                                                            }`}>
                                                                {item.type}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-1.5 text-center font-mono font-bold text-amber-800">
                                                            {item.sceneNo ? `Sc ${item.sceneNo}` : ''}
                                                            {item.shotNo ? ` • ${item.shotNo}` : ''}
                                                        </td>
                                                        <td className="py-2 px-1.5 text-center font-mono font-bold text-slate-900">
                                                            {item.setupNumber !== undefined ? `#${item.setupNumber}` : '-'}
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <div className="flex flex-wrap gap-1">
                                                                {getItemTags(item, beats, generatedShots).map((tag, tIdx) => (
                                                                    <span key={tIdx} className={tag.pdfClassName || tag.className}>
                                                                        {tag.label}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-2.5">
                                                            <div className="font-bold text-slate-900">
                                                                {item.title}
                                                            </div>
                                                            {item.description && (
                                                                <div className="text-[10px] text-slate-700 mt-0.5 leading-tight border-l-2 border-amber-500 pl-1.5 py-0.2">
                                                                    {item.description}
                                                                </div>
                                                            )}
                                                            {item.type === 'meal' && (item.startMinFromCall || 0) > 360 && (
                                                                <div className="text-[9px] font-bold text-red-600 uppercase mt-0.5">
                                                                    ⚠️ Meal Delay Violation (+{formatDurationHM(item.startMinFromCall || 0)} from call)
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-2 font-mono text-[10px] text-slate-800">
                                                            {item.type === 'shot' ? (
                                                                <div>
                                                                    <div className="font-bold">{item.cameraLens || '35mm Prime'}</div>
                                                                    <div className="text-slate-500 text-[9px]">{item.angle || 'Eye Level'} • {item.movement || 'Static'}</div>
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="py-2 px-2 font-semibold uppercase text-slate-900">{item.location || 'SET'}</td>
                                                        <td className="py-2 px-2 text-right font-mono">
                                                            <div className="font-bold text-slate-900">{item.durationMins}m</div>
                                                            <div className="text-[9px] text-slate-500">+{formatDurationHM(item.cumulativeMins || 0)}</div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* CALL SHEET FOOTER & AD NOTES */}
                                <div className="border-t-2 border-slate-900 pt-3 grid grid-cols-3 gap-4 text-[10px] text-slate-700 font-mono">
                                    <div className="bg-slate-50 p-2.5 rounded border border-slate-300">
                                        <div className="font-bold uppercase text-slate-900 mb-1">1st AD & Unit Notes</div>
                                        <div>• Mandatory lunch break within 6.0 hours of Crew Call ({cascadedData.mealViolation ? 'WARNING: MEAL DELAY DETECTED' : 'Compliant'}).</div>
                                        <div>• Report all unit location or camera moves to 1st AD prior to departure.</div>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded border border-slate-300">
                                        <div className="font-bold uppercase text-slate-900 mb-1">Safety & Emergency Channels</div>
                                        <div>• On-Set Medic: Ch 2 | Production Office: 555-0192</div>
                                        <div>• Safety Officer on site at all times during stunt / SFX shots.</div>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded border border-slate-300 text-right flex flex-col justify-between">
                                        <div>
                                            <div className="font-bold uppercase text-slate-900 mb-1">Production Approvals</div>
                                            <div>1st AD Approval: ___________________</div>
                                            <div>Producer Sign-off: _________________</div>
                                        </div>
                                        <div className="text-[9px] text-slate-500 mt-1">
                                            Generated by Backstage Story Sequencer Engine
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleView;
