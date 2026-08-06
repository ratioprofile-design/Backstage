import React, { useMemo, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    AreaChart, Area, PieChart, Pie, Cell, ComposedChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
    BarChart3, Users, MapPin, Camera, Package, Clock, FileText, 
    Sparkles, ShieldCheck, Flame, Sun, Moon, Layers,
    Video, Compass, Zap, Hash, ArrowUpRight, CheckCircle2, AlertCircle, Eye, RefreshCw,
    Grid, Network, Cpu, Activity, Image as ImageIcon, Film, Sliders, GitCommit, HardDrive, Terminal,
    BrainCircuit, Check, Share2, Workflow, Info, AlertTriangle
} from 'lucide-react';
import { BreakdownData, CharacterData, Shot } from '../../types';

// --- COLOR PALETTES FOR CHARTS ---
const CHARACTERS_PALETTE = ['#f5a623', '#3b82f6', '#ec4899', '#10b981', '#a855f7', '#f97316', '#06b6d4', '#eab308'];
const ENVIRONMENT_PALETTE = {
    int: '#3b82f6', // Blue
    ext: '#f5a623', // Amber/Orange
    intext: '#a855f7' // Purple
};
const TIME_PALETTE = {
    day: '#f5a623',
    night: '#6366f1',
    other: '#10b981'
};

// --- HELPER FUNCTIONS ---
const parseScriptSceneDetails = (html: string) => {
    if (!html) return { totalWords: 0, dialogueWords: 0, actionWords: 0, charactersSpoken: new Set<string>(), lineCount: 0 };

    const temp = document.createElement('div');
    temp.innerHTML = html;

    let totalWords = 0;
    let dialogueWords = 0;
    let actionWords = 0;
    let lineCount = 0;
    const charactersSpoken = new Set<string>();

    const lines = temp.querySelectorAll('.sc-line, div, p');
    
    if (lines.length > 0) {
        lines.forEach(line => {
            const text = (line.textContent || '').trim();
            if (!text) return;
            lineCount++;
            const words = text.split(/\s+/).filter(w => w.length > 0);
            const wordCount = words.length;
            totalWords += wordCount;

            const isCharHeader = line.classList.contains('sc-character') || (text === text.toUpperCase() && text.length < 30 && !text.startsWith('INT') && !text.startsWith('EXT'));
            const isDialogue = line.classList.contains('sc-dialogue') || line.classList.contains('sc-parenthetical');

            if (isCharHeader) {
                const charName = text.replace(/\s*\(.*\)$/, '').trim().toUpperCase();
                if (charName && charName.length > 1) {
                    charactersSpoken.add(charName);
                }
            } else if (isDialogue) {
                dialogueWords += wordCount;
            } else {
                actionWords += wordCount;
            }
        });
    } else {
        const rawText = temp.textContent || '';
        const words = rawText.trim().split(/\s+/).filter(w => w.length > 0);
        totalWords = words.length;
        actionWords = totalWords;
    }

    return { totalWords, dialogueWords, actionWords, charactersSpoken, lineCount };
};

type TabType = 'beats' | 'script' | 'characters' | 'breakdown' | 'shotdivision' | 'storyboard' | 'nerdy';

const StatisticsView: React.FC = () => {
    const { 
        beats, 
        connections, 
        groups, 
        characterData, 
        generatedShots,
        scriptConfig, 
        scratchpadConfig,
        dailyStats,
        sessionStartCount,
        lastSessionDate,
        writingGoal,
        appTheme
    } = useProject();

    const isLight = appTheme === 'light' || (appTheme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

    const boards = (useProject() as any).boards || [];
    const goals = writingGoal;

    const characterRelationships = useMemo(() => {
        const rels: { id: string; source: string; target: string; type: string; description?: string }[] = [];
        if (characterData) {
            Object.values(characterData).forEach((c: any, cIdx) => {
                if (c && c.relationships && Array.isArray(c.relationships)) {
                    c.relationships.forEach((r: any, rIdx) => {
                        rels.push({
                            id: `rel-${cIdx}-${rIdx}`,
                            source: c.name || 'Unknown',
                            target: r.target || 'Unknown',
                            type: r.type || 'Connected',
                            description: r.description
                        });
                    });
                }
            });
        }
        return rels;
    }, [characterData]);

    const [activeTab, setActiveTab] = useState<TabType>('beats');
    const [selectedStoryFilter, setSelectedStoryFilter] = useState<'all' | 'rendered' | 'pending'>('all');

    // --- COMPREHENSIVE MULTI-MODULE ANALYTICS ENGINE ---
    const analytics = useMemo(() => {
        const sortedBeats = [...beats].sort((a, b) => a.x - b.x);

        // ----------------------------------------------------
        // 1. BOARD & BEAT GRAPH TOPOLOGY METRICS
        // ----------------------------------------------------
        const totalBeats = beats.length;
        let draftBeats = 0;
        let inProgressBeats = 0;
        let readyBeats = 0;
        let totalBeatNotes = 0;
        let totalBeatVersions = 0;
        const actCounts: Record<string, number> = { 'Act 1': 0, 'Act 2A': 0, 'Act 2B': 0, 'Act 3': 0, 'Unassigned': 0 };

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        beats.forEach(b => {
            if (b.status === 'ready') readyBeats++;
            else if (b.status === 'in-progress') inProgressBeats++;
            else draftBeats++;

            if (b.act && actCounts[b.act] !== undefined) {
                actCounts[b.act]++;
            } else {
                actCounts['Unassigned']++;
            }

            if (b.notes) totalBeatNotes += b.notes.length;
            if (b.versions) totalBeatVersions += b.versions.length;

            if (b.x < minX) minX = b.x;
            if (b.x > maxX) maxX = b.x;
            if (b.y < minY) minY = b.y;
            if (b.y > maxY) maxY = b.y;
        });

        const widthExtent = minX !== Infinity ? Math.max(800, maxX - minX + 300) : 0;
        const heightExtent = minY !== Infinity ? Math.max(600, maxY - minY + 200) : 0;
        const canvasFootprintSqPx = Math.round(widthExtent * heightExtent);

        const totalConnections = connections.length;
        const animatedConnections = connections.filter(c => c.animated).length;
        const dottedConnections = connections.filter(c => c.lineStyle === 'dotted' || c.lineStyle === 'dashed').length;

        // Graph Density Formula: Density = 2*E / (N*(N-1))
        const maxPossibleEdges = totalBeats > 1 ? (totalBeats * (totalBeats - 1)) / 2 : 1;
        const graphDensity = totalBeats > 1 ? Number((totalConnections / maxPossibleEdges).toFixed(3)) : 0;
        const avgNodeDegree = totalBeats > 0 ? Number(((totalConnections * 2) / totalBeats).toFixed(2)) : 0;

        // Connected vs Isolated Nodes
        const connectedNodeIds = new Set<string>();
        connections.forEach(c => {
            connectedNodeIds.add(c.sourceId);
            connectedNodeIds.add(c.targetId);
        });
        const isolatedBeatsCount = beats.filter(b => !connectedNodeIds.has(b.id)).length;

        const beatStatusData = [
            { name: 'Ready / Locked', value: readyBeats, color: '#10b981' },
            { name: 'In Progress', value: inProgressBeats, color: '#3b82f6' },
            { name: 'Draft', value: draftBeats, color: '#f5a623' }
        ];

        const actDistributionData = Object.entries(actCounts).map(([act, count]) => ({ name: act, value: count }));

        // ----------------------------------------------------
        // 2. SCRIPT & PACING METRICS
        // ----------------------------------------------------
        let grandTotalWords = 0;
        let grandDialogueWords = 0;
        let grandActionWords = 0;
        let grandTotalLines = 0;
        let intCount = 0;
        let extCount = 0;
        let intExtCount = 0;
        let dayCount = 0;
        let nightCount = 0;
        let otherTimeCount = 0;

        const sceneTimelineData: any[] = [];
        const characterStatsMap = new Map<string, { 
            name: string; 
            dialogueWords: number; 
            scenesAppeared: Set<number>; 
            firstScene: number; 
            lastScene: number;
            color: string;
        }>();

        const locationStatsMap = new Map<string, {
            location: string;
            sceneCount: number;
            totalWords: number;
            estDurationSec: number;
            intCount: number;
            extCount: number;
            dayCount: number;
            nightCount: number;
            scenes: number[];
        }>();

        const departmentCounts: Record<string, number> = {
            cast: 0, props: 0, costume: 0, vfx: 0, practical: 0, sound: 0, location: 0, stunts: 0, vehicles: 0, animals: 0
        };

        const manifestItemsList: { category: string; name: string; scene: string }[] = [];

        let cumulativeSec = 0;

        sortedBeats.forEach((beat, idx) => {
            const sceneNum = beat.sceneNumber || (idx + 1).toString();
            const sceneNumInt = idx + 1;
            const parsed = parseScriptSceneDetails(beat.content || '');

            grandTotalWords += parsed.totalWords;
            grandDialogueWords += parsed.dialogueWords;
            grandActionWords += parsed.actionWords;
            grandTotalLines += parsed.lineCount;

            // Environmental categorization
            const prefix = (beat.slug?.prefix || 'INT.').toUpperCase().trim();
            if (prefix.includes('INT/EXT') || prefix.includes('I/E')) intExtCount++;
            else if (prefix.includes('EXT')) extCount++;
            else intCount++;

            const timeStr = (beat.slug?.time || 'DAY').toUpperCase().trim();
            if (timeStr.includes('NIGHT')) nightCount++;
            else if (timeStr.includes('DAY')) dayCount++;
            else otherTimeCount++;

            // Estimated Scene Duration
            const sceneShots = generatedShots.filter(s => {
                if (!s.scene) return false;
                const cs = s.scene.trim().toLowerCase();
                return cs === sceneNum.toLowerCase() || cs === sceneNumInt.toString();
            });

            let sceneDurationSec = 0;
            if (sceneShots.length > 0 && sceneShots.some(s => s.durationSec)) {
                sceneDurationSec = sceneShots.reduce((acc, curr) => acc + (curr.durationSec || 4), 0);
            } else {
                sceneDurationSec = Math.round(10 + (parsed.dialogueWords / 2.5) + (parsed.actionWords / 1.2));
            }

            cumulativeSec += sceneDurationSec;

            // Location stats aggregation
            const locName = (beat.slug?.location || 'UNNAMED LOCATION').trim().toUpperCase();
            if (!locationStatsMap.has(locName)) {
                locationStatsMap.set(locName, {
                    location: locName,
                    sceneCount: 0,
                    totalWords: 0,
                    estDurationSec: 0,
                    intCount: 0,
                    extCount: 0,
                    dayCount: 0,
                    nightCount: 0,
                    scenes: []
                });
            }
            const locObj = locationStatsMap.get(locName)!;
            locObj.sceneCount++;
            locObj.totalWords += parsed.totalWords;
            locObj.estDurationSec += sceneDurationSec;
            if (prefix.includes('EXT')) locObj.extCount++; else locObj.intCount++;
            if (timeStr.includes('NIGHT')) locObj.nightCount++; else locObj.dayCount++;
            locObj.scenes.push(sceneNumInt);

            // Character Tracking
            const charNamesInScene = new Set<string>();
            parsed.charactersSpoken.forEach(c => charNamesInScene.add(c));
            if (beat.breakdown?.cast) {
                beat.breakdown.cast.forEach(c => {
                    const name = typeof c === 'string' ? c : c.name;
                    if (name) charNamesInScene.add(name.trim().toUpperCase());
                });
            }

            charNamesInScene.forEach(charName => {
                if (!characterStatsMap.has(charName)) {
                    const colorIndex = characterStatsMap.size % CHARACTERS_PALETTE.length;
                    characterStatsMap.set(charName, {
                        name: charName,
                        dialogueWords: 0,
                        scenesAppeared: new Set<number>(),
                        firstScene: sceneNumInt,
                        lastScene: sceneNumInt,
                        color: CHARACTERS_PALETTE[colorIndex]
                    });
                }
                const cObj = characterStatsMap.get(charName)!;
                cObj.scenesAppeared.add(sceneNumInt);
                cObj.lastScene = sceneNumInt;
            });

            parsed.charactersSpoken.forEach(charName => {
                if (characterStatsMap.has(charName)) {
                    characterStatsMap.get(charName)!.dialogueWords += parsed.dialogueWords;
                }
            });

            // Department breakdown items aggregation
            if (beat.breakdown) {
                Object.keys(departmentCounts).forEach(deptKey => {
                    const arr = beat.breakdown![deptKey as keyof BreakdownData];
                    if (Array.isArray(arr)) {
                        departmentCounts[deptKey] = (departmentCounts[deptKey] || 0) + arr.length;
                        arr.forEach(item => {
                            const itemName = typeof item === 'string' ? item : item.name;
                            if (itemName) {
                                manifestItemsList.push({
                                    category: deptKey,
                                    name: itemName,
                                    scene: `SC ${sceneNum}`
                                });
                            }
                        });
                    }
                });
            }

            // Scene Timeline Object
            sceneTimelineData.push({
                sceneIndex: sceneNumInt,
                sceneNumDisplay: `SC ${sceneNum}`,
                heading: `${beat.slug?.prefix || 'INT.'} ${beat.slug?.location || 'LOCATION'} - ${beat.slug?.time || 'DAY'}`,
                totalWords: parsed.totalWords,
                dialogueWords: parsed.dialogueWords,
                actionWords: parsed.actionWords,
                durationSec: sceneDurationSec,
                durationMin: Number((sceneDurationSec / 60).toFixed(1)),
                cumulativeMin: Number((cumulativeSec / 60).toFixed(1)),
                shotCount: sceneShots.length,
                isLocked: beat.status === 'ready',
                characters: Array.from(charNamesInScene)
            });
        });

        // ----------------------------------------------------
        // 3. CHARACTER & RELATIONSHIP METRICS
        // ----------------------------------------------------
        Object.values(characterData).forEach((c: any) => {
            if (c.name) {
                const upper = c.name.trim().toUpperCase();
                if (!characterStatsMap.has(upper)) {
                    const colorIndex = characterStatsMap.size % CHARACTERS_PALETTE.length;
                    characterStatsMap.set(upper, {
                        name: upper,
                        dialogueWords: 0,
                        scenesAppeared: new Set<number>(),
                        firstScene: 0,
                        lastScene: 0,
                        color: c.color || CHARACTERS_PALETTE[colorIndex]
                    });
                }
            }
        });

        const characterList = Array.from(characterStatsMap.values())
            .map(c => ({
                ...c,
                scenesCount: c.scenesAppeared.size,
                scenesAppearedArr: Array.from(c.scenesAppeared).sort((a, b) => a - b),
                percentScreenplay: sortedBeats.length > 0 ? Math.round((c.scenesAppeared.size / sortedBeats.length) * 100) : 0
            }))
            .sort((a, b) => b.scenesCount - a.scenesCount || b.dialogueWords - a.dialogueWords);

        // Character completion score
        let completedBiosCount = 0;
        characterList.forEach(c => {
            const bio = characterData[c.name.toLowerCase()] || characterData[c.name];
            if (bio && (bio.archetype || bio.summary || bio.personality)) completedBiosCount++;
        });

        const characterCompletionPercent = characterList.length > 0 ? Math.round((completedBiosCount / characterList.length) * 100) : 0;

        // Relationships breakdown
        const totalRelationships = characterRelationships.length;
        const relTypesCounts: Record<string, number> = {};
        characterRelationships.forEach(r => {
            const t = r.type || 'General';
            relTypesCounts[t] = (relTypesCounts[t] || 0) + 1;
        });
        const relTypeData = Object.entries(relTypesCounts).map(([name, value]) => ({ name, value }));

        // ----------------------------------------------------
        // 4. BREAKDOWN & DEPARTMENT MANIFEST
        // ----------------------------------------------------
        const totalManifestItems = Object.values(departmentCounts).reduce((a, b) => a + b, 0);
        const departmentChartData = Object.entries(departmentCounts)
            .filter(([_, count]) => count > 0)
            .map(([dept, count]) => ({ name: dept.toUpperCase(), count }));

        const locationList = Array.from(locationStatsMap.values())
            .map(l => ({
                ...l,
                estDurationMin: Number((l.estDurationSec / 60).toFixed(1)),
                percentTotalSec: cumulativeSec > 0 ? Math.round((l.estDurationSec / cumulativeSec) * 100) : 0
            }))
            .sort((a, b) => b.sceneCount - a.sceneCount || b.estDurationSec - a.estDurationSec);

        // ----------------------------------------------------
        // 5. SHOT DIVISION & CAMERA SPECS
        // ----------------------------------------------------
        const totalShots = generatedShots.length;
        const shotSizeCounts: Record<string, number> = {};
        const shotAngleCounts: Record<string, number> = {};
        const shotMovementCounts: Record<string, number> = {};
        const cameraLensCounts: Record<string, number> = {};

        let renderedShotsCount = 0;
        let pendingShotsCount = 0;

        generatedShots.forEach(shot => {
            const size = shot.shotSize || 'Unspecified';
            shotSizeCounts[size] = (shotSizeCounts[size] || 0) + 1;

            const angle = shot.angle || 'Unspecified';
            shotAngleCounts[angle] = (shotAngleCounts[angle] || 0) + 1;

            const mv = shot.movement || 'Static';
            shotMovementCounts[mv] = (shotMovementCounts[mv] || 0) + 1;

            const lens = shot.cameraLens || '35mm Prime';
            cameraLensCounts[lens] = (cameraLensCounts[lens] || 0) + 1;

            if (shot.imageUrl) renderedShotsCount++;
            else pendingShotsCount++;
        });

        const shotSizeData = Object.entries(shotSizeCounts).map(([name, value]) => ({ name, value }));
        const shotAngleData = Object.entries(shotAngleCounts).map(([name, value]) => ({ name, value }));
        const shotMovementData = Object.entries(shotMovementCounts).map(([name, value]) => ({ name, value }));
        const cameraLensData = Object.entries(cameraLensCounts).map(([name, value]) => ({ name, value }));

        const scenesWithShots = new Set<string>();
        generatedShots.forEach(s => {
            if (s.scene) scenesWithShots.add(s.scene.trim().toLowerCase());
        });

        const scenesWithShotsCount = sortedBeats.filter((_, idx) => {
            const sc = (idx + 1).toString();
            return scenesWithShots.has(sc) || scenesWithShots.has(`sc ${sc}`);
        }).length;

        const storyboardCoveragePercent = sortedBeats.length > 0 ? Math.round((scenesWithShotsCount / sortedBeats.length) * 100) : 0;
        const imageRenderPercent = totalShots > 0 ? Math.round((renderedShotsCount / totalShots) * 100) : 0;

        // ----------------------------------------------------
        // 6. NERDY STUFF & PRODUCTION COMPLEXITY INDEX
        // ----------------------------------------------------
        // Empirical Production Complexity Formula (0 - 100)
        const sceneComplexityWeight = sortedBeats.length * 2.0;
        const shotComplexityWeight = totalShots * 1.2;
        const manifestComplexityWeight = totalManifestItems * 0.8;
        const graphComplexityWeight = totalConnections * 2.5;
        const rawComplexityScore = sceneComplexityWeight + shotComplexityWeight + manifestComplexityWeight + graphComplexityWeight;
        const complexityScore = Math.min(100, Math.max(12, Math.round(rawComplexityScore / 2)));

        let complexityTier = 'Indie Minimalist';
        let complexityBadgeColor = 'text-green-400 bg-green-950/60 border-green-800/40';
        if (complexityScore > 75) {
            complexityTier = 'Blockbuster VFX Spec';
            complexityBadgeColor = 'text-purple-400 bg-purple-950/60 border-purple-800/40';
        } else if (complexityScore > 50) {
            complexityTier = 'High-Concept Feature';
            complexityBadgeColor = 'text-blue-400 bg-blue-950/60 border-blue-800/40';
        } else if (complexityScore > 30) {
            complexityTier = 'Mid-Budget Drama';
            complexityBadgeColor = 'text-[#f5a623] bg-amber-950/60 border-amber-800/40';
        }

        // Lexical diversity estimate
        const dialogueVelocityWpm = cumulativeSec > 0 ? Math.round((grandDialogueWords / (cumulativeSec / 60))) : 0;
        const avgWordsPerScene = sortedBeats.length > 0 ? Math.round(grandTotalWords / sortedBeats.length) : 0;
        const estimatedPages = Math.max(1, Math.ceil(grandTotalWords / 250));
        const runtimeFormatted = `${Math.floor(cumulativeSec / 60)}m ${Math.round(cumulativeSec % 60)}s`;

        // Estimated JSON payload memory footprint
        const totalStateObjectsCount = totalBeats + totalConnections + groups.length + totalShots + characterList.length + totalRelationships;
        const estimatedMemoryKb = Math.round((totalStateObjectsCount * 1.8) + (grandTotalWords * 0.008));

        return {
            // Beat Board
            totalBeats,
            readyBeats,
            inProgressBeats,
            draftBeats,
            beatStatusData,
            actDistributionData,
            totalBeatNotes,
            totalBeatVersions,
            totalConnections,
            animatedConnections,
            dottedConnections,
            graphDensity,
            avgNodeDegree,
            isolatedBeatsCount,
            totalGroups: groups.length,
            totalBoards: boards.length,
            canvasFootprintSqPx,
            widthExtent,
            heightExtent,

            // Script & Pacing
            totalScenes: sortedBeats.length,
            grandTotalWords,
            grandDialogueWords,
            grandActionWords,
            grandTotalLines,
            dialoguePercent: grandTotalWords > 0 ? Math.round((grandDialogueWords / grandTotalWords) * 100) : 0,
            actionPercent: grandTotalWords > 0 ? Math.round((grandActionWords / grandTotalWords) * 100) : 0,
            estimatedPages,
            cumulativeSec,
            runtimeFormatted,
            lockedPercent: sortedBeats.length > 0 ? Math.round((readyBeats / sortedBeats.length) * 100) : 0,
            environmentData: [
                { name: 'INT.', value: intCount, color: ENVIRONMENT_PALETTE.int },
                { name: 'EXT.', value: extCount, color: ENVIRONMENT_PALETTE.ext },
                { name: 'INT./EXT.', value: intExtCount, color: ENVIRONMENT_PALETTE.intext }
            ],
            timeData: [
                { name: 'DAY', value: dayCount, color: TIME_PALETTE.day },
                { name: 'NIGHT', value: nightCount, color: TIME_PALETTE.night },
                { name: 'OTHER/DAWN', value: otherTimeCount, color: TIME_PALETTE.other }
            ],
            sceneTimelineData,

            // Characters
            characterList,
            characterCompletionPercent,
            totalRelationships,
            relTypeData,

            // Breakdown
            departmentCounts,
            departmentChartData,
            totalManifestItems,
            manifestItemsList,
            locationList,

            // Shot Division & Storyboard
            totalShots,
            renderedShotsCount,
            pendingShotsCount,
            imageRenderPercent,
            storyboardCoveragePercent,
            scenesWithShotsCount,
            shotSizeData,
            shotAngleData,
            shotMovementData,
            cameraLensData,

            // Nerdy Stuff
            complexityScore,
            complexityTier,
            complexityBadgeColor,
            dialogueVelocityWpm,
            avgWordsPerScene,
            totalStateObjectsCount,
            estimatedMemoryKb
        };
    }, [beats, connections, groups, boards, characterData, characterRelationships, generatedShots, scriptConfig, goals]);

    const fontStyle = {
        fontFamily: scriptConfig.noteFont || 'Courier New, monospace'
    };

    // Filtered Storyboard Shots
    const filteredStoryboardShots = useMemo(() => {
        if (selectedStoryFilter === 'rendered') return generatedShots.filter(s => s.imageUrl);
        if (selectedStoryFilter === 'pending') return generatedShots.filter(s => !s.imageUrl);
        return generatedShots;
    }, [generatedShots, selectedStoryFilter]);

    return (
        <div className={`w-full h-full font-sans flex flex-col overflow-hidden ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-[#0a0a0a] text-gray-200'}`}>
            {/* --- HEADER BAR WITH TAB NAVIGATION --- */}
            <div className={`px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 border-b shadow-md ${isLight ? 'bg-white border-slate-200' : 'bg-[#121212] border-[#262626]'}`}>
                <div>
                    <div className="flex items-center gap-2">
                        <BarChart3 className="text-[#f5a623]" size={22} />
                        <h1 className="text-lg font-black text-white uppercase tracking-wider">
                            Full Production & Script Analytics
                        </h1>
                        <span className="bg-green-950/60 text-green-400 border border-green-700/40 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            Live Engine
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Deep metrics across Beats, Script, Cast, Manifest, Shot Division, Storyboard & Technical Topology.
                    </p>
                </div>

                {/* TAB SWITCHER */}
                <div className="flex items-center bg-[#181818] p-1 rounded-xl border border-[#2e2e2e] shadow-inner gap-1 overflow-x-auto custom-scrollbar">
                    <button 
                        onClick={() => setActiveTab('beats')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                            activeTab === 'beats' ? 'bg-[#f5a623] text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Grid size={14} /> Beats & Graph ({analytics.totalBeats})
                    </button>
                    <button 
                        onClick={() => setActiveTab('script')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                            activeTab === 'script' ? 'bg-[#f5a623] text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Clock size={14} /> Script & Pacing ({analytics.totalScenes} Sc)
                    </button>
                    <button 
                        onClick={() => setActiveTab('characters')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                            activeTab === 'characters' ? 'bg-[#f5a623] text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Users size={14} /> Cast & Arcs ({analytics.characterList.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('breakdown')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                            activeTab === 'breakdown' ? 'bg-[#f5a623] text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Package size={14} /> Breakdown ({analytics.totalManifestItems})
                    </button>
                    <button 
                        onClick={() => setActiveTab('shotdivision')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                            activeTab === 'shotdivision' ? 'bg-[#f5a623] text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Camera size={14} /> Shot Division ({analytics.totalShots})
                    </button>
                    <button 
                        onClick={() => setActiveTab('storyboard')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                            activeTab === 'storyboard' ? 'bg-[#f5a623] text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <ImageIcon size={14} /> Storyboard ({analytics.renderedShotsCount}/{analytics.totalShots})
                    </button>
                    <button 
                        onClick={() => setActiveTab('nerdy')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                            activeTab === 'nerdy' ? 'bg-[#f5a623] text-black shadow-md' : 'text-purple-400 hover:text-white'
                        }`}
                    >
                        <BrainCircuit size={14} /> 🤓 Nerdy Stuff
                    </button>
                </div>
            </div>

            {/* --- TOP HIGH-LEVEL KPI STRIP --- */}
            <div className="bg-[#141414] border-b border-[#222] px-6 py-3.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 shrink-0">
                <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-lg p-2.5 flex items-center gap-3">
                    <div className="p-2 rounded-md bg-[#282828] text-[#f5a623]">
                        <FileText size={18} />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Est. Pages</div>
                        <div className="text-base font-black text-white">{analytics.estimatedPages} <span className="text-[10px] font-normal text-gray-400">Pgs</span></div>
                    </div>
                </div>

                <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-lg p-2.5 flex items-center gap-3">
                    <div className="p-2 rounded-md bg-[#282828] text-blue-400">
                        <Clock size={18} />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Est. Runtime</div>
                        <div className="text-base font-black text-white">{analytics.runtimeFormatted}</div>
                    </div>
                </div>

                <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-lg p-2.5 flex items-center gap-3">
                    <div className="p-2 rounded-md bg-[#282828] text-green-400">
                        <Layers size={18} />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Scenes</div>
                        <div className="text-base font-black text-white">{analytics.totalScenes} <span className="text-[10px] font-normal text-gray-400">({analytics.lockedPercent}% ready)</span></div>
                    </div>
                </div>

                <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-lg p-2.5 flex items-center gap-3">
                    <div className="p-2 rounded-md bg-[#282828] text-purple-400">
                        <Network size={18} />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Graph Edges</div>
                        <div className="text-base font-black text-white">{analytics.totalConnections} <span className="text-[10px] font-normal text-gray-400">Links</span></div>
                    </div>
                </div>

                <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-lg p-2.5 flex items-center gap-3">
                    <div className="p-2 rounded-md bg-[#282828] text-pink-400">
                        <Users size={18} />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cast Count</div>
                        <div className="text-base font-black text-white">{analytics.characterList.length} <span className="text-[10px] font-normal text-gray-400">Roles</span></div>
                    </div>
                </div>

                <div className="bg-[#1c1c1c] border border-[#2d2d2d] rounded-lg p-2.5 flex items-center gap-3">
                    <div className="p-2 rounded-md bg-[#282828] text-amber-400">
                        <BrainCircuit size={18} />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Complexity</div>
                        <div className="text-base font-black text-white">{analytics.complexityScore} <span className="text-[10px] font-normal text-gray-400">/ 100</span></div>
                    </div>
                </div>
            </div>

            {/* --- MAIN SCROLLABLE DASHBOARD CONTENT --- */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                
                {/* ---------------------------------------------------- */}
                {/* TAB 1: BEAT BOARD & GRAPH TOPOLOGY */}
                {/* ---------------------------------------------------- */}
                {activeTab === 'beats' && (
                    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* BEAT STATUS PIE CHART */}
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg flex flex-col justify-between">
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Grid size={16} className="text-[#f5a623]" /> Beat Status Breakdown
                                </h3>
                                <div className="h-48 w-full my-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={analytics.beatStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={4} label>
                                                {analytics.beatStatusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', fontSize: '11px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-1.5 text-xs font-bold border-t border-[#222] pt-3">
                                    <div className="flex justify-between"><span className="text-green-400">Ready / Locked:</span> <span>{analytics.readyBeats}</span></div>
                                    <div className="flex justify-between"><span className="text-blue-400">In Progress:</span> <span>{analytics.inProgressBeats}</span></div>
                                    <div className="flex justify-between"><span className="text-amber-400">Draft:</span> <span>{analytics.draftBeats}</span></div>
                                </div>
                            </div>

                            {/* ACT DISTRIBUTION BAR CHART */}
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg flex flex-col justify-between">
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Layers size={16} className="text-blue-400" /> Act Structure Distribution
                                </h3>
                                <div className="h-48 w-full my-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analytics.actDistributionData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                            <XAxis dataKey="name" stroke="#555" tick={{ fontSize: 9, fill: '#aaa' }} />
                                            <YAxis stroke="#555" tick={{ fontSize: 9, fill: '#aaa' }} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', fontSize: '11px' }} />
                                            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Beats" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="text-[11px] text-gray-400 bg-[#1a1a1a] p-2.5 rounded-lg border border-[#252525]">
                                    <span className="font-bold text-white">Act Ratio: </span>
                                    {analytics.actDistributionData.map(a => `${a.name}: ${a.value}`).join(' | ')}
                                </div>
                            </div>

                            {/* GRAPH TOPOLOGY & SPATIAL FOOTPRINT */}
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg flex flex-col justify-between">
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Network size={16} className="text-purple-400" /> Graph Topology Metrics
                                </h3>
                                <div className="space-y-2.5 my-3">
                                    <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-[#252525] flex justify-between items-center text-xs">
                                        <span className="text-gray-400">Total Graph Connections:</span>
                                        <span className="font-mono font-bold text-purple-400">{analytics.totalConnections} Links</span>
                                    </div>
                                    <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-[#252525] flex justify-between items-center text-xs">
                                        <span className="text-gray-400">Graph Density Factor:</span>
                                        <span className="font-mono font-bold text-amber-400">{analytics.graphDensity}</span>
                                    </div>
                                    <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-[#252525] flex justify-between items-center text-xs">
                                        <span className="text-gray-400">Avg Degree per Node:</span>
                                        <span className="font-mono font-bold text-blue-400">{analytics.avgNodeDegree}</span>
                                    </div>
                                    <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-[#252525] flex justify-between items-center text-xs">
                                        <span className="text-gray-400">Isolated Unlinked Beats:</span>
                                        <span className="font-mono font-bold text-red-400">{analytics.isolatedBeatsCount} Nodes</span>
                                    </div>
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono flex justify-between">
                                    <span>Canvas Extent: {analytics.widthExtent}px × {analytics.heightExtent}px</span>
                                    <span>Footprint: {(analytics.canvasFootprintSqPx / 1000000).toFixed(2)} MPx</span>
                                </div>
                            </div>
                        </div>

                        {/* DETAILED BEAT MATRIX CARDS */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center">
                                <div className="text-2xl font-black text-[#f5a623] mb-1">{analytics.totalBeatNotes}</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Total Beat Sticky Notes</div>
                            </div>
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center">
                                <div className="text-2xl font-black text-blue-400 mb-1">{analytics.totalBeatVersions}</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Total Version Snapshots</div>
                            </div>
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center">
                                <div className="text-2xl font-black text-purple-400 mb-1">{analytics.totalGroups}</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Organized Beat Groups</div>
                            </div>
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center">
                                <div className="text-2xl font-black text-green-400 mb-1">{analytics.animatedConnections}</div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase">Animated Flow Links</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 2: SCRIPT & PACING */}
                {/* ---------------------------------------------------- */}
                {activeTab === 'script' && (
                    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
                        {/* PACING TIMELINE CHART */}
                        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg">
                            <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                        <Clock size={16} className="text-[#f5a623]" /> Screenplay Pacing & Word Density
                                    </h3>
                                    <p className="text-[11px] text-gray-400">
                                        Word breakdown (Dialogue vs Action) and cumulative runtime trajectory.
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f5a623]"></span> Dialogue Words</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#3b82f6]"></span> Action Words</span>
                                    <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#10b981]"></span> Cumul. Runtime (Min)</span>
                                </div>
                            </div>

                            <div className="h-80 w-full pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={analytics.sceneTimelineData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                        <XAxis dataKey="sceneNumDisplay" stroke="#555" tick={{ fontSize: 10, fill: '#888' }} />
                                        <YAxis yAxisId="left" stroke="#555" tick={{ fontSize: 10, fill: '#888' }} label={{ value: 'Words', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{ fontSize: 10, fill: '#10b981' }} label={{ value: 'Cumul. Min', angle: 90, position: 'insideRight', fill: '#10b981', fontSize: 10 }} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                                        />
                                        <Bar yAxisId="left" dataKey="dialogueWords" stackId="a" fill="#f5a623" radius={[0, 0, 0, 0]} />
                                        <Bar yAxisId="left" dataKey="actionWords" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        <Line yAxisId="right" type="monotone" dataKey="cumulativeMin" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981' }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* SPLIT ROW: Dialogue Ratio & Environment/Time */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 flex flex-col justify-between">
                                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Sparkles size={14} className="text-[#f5a623]" /> Dialogue vs Action Balance
                                </h4>
                                <div className="my-4 space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs font-bold mb-1">
                                            <span className="text-[#f5a623]">Spoken Dialogue ({analytics.dialoguePercent}%)</span>
                                            <span className="text-gray-400">{analytics.grandDialogueWords.toLocaleString()} words</span>
                                        </div>
                                        <div className="h-2.5 bg-[#222] rounded-full overflow-hidden">
                                            <div className="h-full bg-[#f5a623]" style={{ width: `${analytics.dialoguePercent}%` }} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs font-bold mb-1">
                                            <span className="text-blue-400">Action & Description ({analytics.actionPercent}%)</span>
                                            <span className="text-gray-400">{analytics.grandActionWords.toLocaleString()} words</span>
                                        </div>
                                        <div className="h-2.5 bg-[#222] rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500" style={{ width: `${analytics.actionPercent}%` }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[11px] text-gray-400 bg-[#1a1a1a] p-3 rounded-lg border border-[#262626]">
                                    <span className="font-bold text-white">Formatted Lines: </span> {analytics.grandTotalLines.toLocaleString()} script lines parsed.
                                </div>
                            </div>

                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
                                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Compass size={14} className="text-blue-400" /> Environment (INT / EXT)
                                </h4>
                                <div className="h-44 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={analytics.environmentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={35} paddingAngle={4} label>
                                                {analytics.environmentData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', fontSize: '11px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
                                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Sun size={14} className="text-[#f5a623]" /> Time of Day (DAY / NIGHT)
                                </h4>
                                <div className="h-44 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={analytics.timeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={35} paddingAngle={4} label>
                                                {analytics.timeData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', fontSize: '11px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* PACING DETAILED TABLE */}
                        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
                            <div className="p-4 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between">
                                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                    Scene-by-Scene Pacing & Coverage Breakdown
                                </h4>
                                <span className="text-[10px] text-gray-400 font-mono">
                                    {analytics.sceneTimelineData.length} Scenes
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-[#111] text-gray-400 uppercase text-[9px] font-bold border-b border-[#222]">
                                            <th className="p-3">Scene</th>
                                            <th className="p-3">Slugline</th>
                                            <th className="p-3 text-center">Dialogue Wds</th>
                                            <th className="p-3 text-center">Action Wds</th>
                                            <th className="p-3 text-center">Est. Duration</th>
                                            <th className="p-3 text-center">Storyboard Shots</th>
                                            <th className="p-3">Cast Featured</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#222]">
                                        {analytics.sceneTimelineData.map((sc) => (
                                            <tr key={sc.sceneIndex} className="hover:bg-[#1a1a1a] transition-colors">
                                                <td className="p-3 font-mono font-bold text-[#f5a623]">{sc.sceneNumDisplay}</td>
                                                <td className="p-3 font-bold text-gray-200" style={fontStyle}>{sc.heading}</td>
                                                <td className="p-3 text-center font-mono text-gray-300">{sc.dialogueWords}</td>
                                                <td className="p-3 text-center font-mono text-gray-300">{sc.actionWords}</td>
                                                <td className="p-3 text-center font-mono text-green-400">{sc.durationMin} min</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                                                        sc.shotCount > 0 ? 'bg-purple-950 text-purple-300 border border-purple-800/40' : 'bg-[#222] text-gray-500'
                                                    }`}>
                                                        {sc.shotCount} shots
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {sc.characters.slice(0, 3).map((c: string) => (
                                                            <span key={c} className="bg-[#222] text-gray-300 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                                                {c}
                                                            </span>
                                                        ))}
                                                        {sc.characters.length > 3 && (
                                                            <span className="text-[9px] text-gray-500">+{sc.characters.length - 3}</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 3: CAST, ARCS & RELATIONSHIPS */}
                {/* ---------------------------------------------------- */}
                {activeTab === 'characters' && (
                    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
                        {/* CHARACTER VOICE COMPARISON */}
                        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                        <Users size={16} className="text-[#f5a623]" /> Cast Dialogue Volume & Screen Time Comparison
                                    </h3>
                                    <p className="text-[11px] text-gray-400">
                                        Total scenes appeared vs dialogue words spoken per character.
                                    </p>
                                </div>
                                <span className="text-[10px] font-bold bg-green-950/60 text-green-400 border border-green-800/40 px-2.5 py-1 rounded-full">
                                    {analytics.characterCompletionPercent}% Bios Completed
                                </span>
                            </div>
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.characterList.slice(0, 10)}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                        <XAxis dataKey="name" stroke="#555" tick={{ fontSize: 10, fill: '#aaa' }} />
                                        <YAxis yAxisId="left" stroke="#f5a623" tick={{ fontSize: 10, fill: '#f5a623' }} label={{ value: 'Dialogue Words', angle: -90, position: 'insideLeft', fill: '#f5a623', fontSize: 10 }} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" tick={{ fontSize: 10, fill: '#3b82f6' }} label={{ value: 'Scenes Appeared', angle: 90, position: 'insideRight', fill: '#3b82f6', fontSize: 10 }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', fontSize: '11px' }} />
                                        <Bar yAxisId="left" dataKey="dialogueWords" fill="#f5a623" radius={[4, 4, 0, 0]} name="Dialogue Words" />
                                        <Bar yAxisId="right" dataKey="scenesCount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Scenes Appeared" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* CHARACTER TIMELINE PRESENCE MATRIX */}
                        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Compass size={16} className="text-purple-400" /> Character Screenplay Arc Matrix
                            </h3>
                            <div className="overflow-x-auto custom-scrollbar my-3">
                                <div className="min-w-max">
                                    <div className="flex border-b border-[#2d2d2d] pb-2 mb-2">
                                        <div className="w-40 shrink-0 text-[10px] font-bold text-gray-400 uppercase">Character</div>
                                        <div className="flex gap-1 flex-1">
                                            {analytics.sceneTimelineData.map(sc => (
                                                <div key={sc.sceneIndex} className="w-8 text-center text-[9px] font-mono font-bold text-gray-500">
                                                    SC{sc.sceneIndex}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        {analytics.characterList.slice(0, 12).map(char => (
                                            <div key={char.name} className="flex items-center hover:bg-[#1a1a1a] p-1 rounded transition-colors">
                                                <div className="w-40 shrink-0 flex items-center gap-2 pr-2">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: char.color }}></span>
                                                    <span className="text-xs font-bold text-gray-200 truncate">{char.name}</span>
                                                </div>
                                                <div className="flex gap-1 flex-1">
                                                    {analytics.sceneTimelineData.map(sc => {
                                                        const isPresent = char.scenesAppeared.has(sc.sceneIndex);
                                                        return (
                                                            <div 
                                                                key={sc.sceneIndex} 
                                                                className={`w-8 h-6 rounded flex items-center justify-center text-[9px] font-bold transition-all ${
                                                                    isPresent ? 'bg-green-600/30 border border-green-500/50 text-green-400 shadow-sm' : 'bg-[#181818] border border-[#222] text-gray-700'
                                                                }`}
                                                            >
                                                                {isPresent ? '•' : ''}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CHARACTER RELATIONSHIPS SUMMARY */}
                        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Share2 size={16} className="text-blue-400" /> Character Relationship Network ({analytics.totalRelationships} Connections)
                            </h3>
                            {analytics.totalRelationships > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 my-3">
                                    {characterRelationships.map(rel => (
                                        <div key={rel.id} className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-3 text-xs">
                                            <div className="flex justify-between items-center font-bold mb-1">
                                                <span className="text-[#f5a623]">{rel.source}</span>
                                                <span className="text-gray-500 font-mono text-[10px]">↔ ({rel.type || 'Linked'})</span>
                                                <span className="text-blue-400">{rel.target}</span>
                                            </div>
                                            {rel.description && <p className="text-[10px] text-gray-400 mt-1">{rel.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500 italic py-2">No custom character relationships defined yet in Character View.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 4: BREAKDOWN & DEPARTMENTS */}
                {/* ---------------------------------------------------- */}
                {activeTab === 'breakdown' && (
                    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
                        {/* DEPARTMENT BREAKDOWN BAR CHART */}
                        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Package size={16} className="text-[#f5a623]" /> Production Manifest Items by Department
                            </h3>
                            <p className="text-[11px] text-gray-400 mb-4">
                                Total logged items across all script scene breakdowns.
                            </p>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.departmentChartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                        <XAxis dataKey="name" stroke="#555" tick={{ fontSize: 10, fill: '#aaa' }} />
                                        <YAxis stroke="#555" tick={{ fontSize: 10, fill: '#aaa' }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', fontSize: '11px' }} />
                                        <Bar dataKey="count" fill="#f5a623" radius={[4, 4, 0, 0]} name="Logged Items" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* MANIFEST ITEMS TABLE */}
                        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
                            <div className="p-4 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between">
                                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                    Logged Manifest Assets ({analytics.manifestItemsList.length})
                                </h4>
                            </div>
                            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-[#111] text-gray-400 uppercase text-[9px] font-bold border-b border-[#222]">
                                            <th className="p-3">Department</th>
                                            <th className="p-3">Asset / Item Name</th>
                                            <th className="p-3 text-right">Scene Occurrence</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#222]">
                                        {analytics.manifestItemsList.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-[#1a1a1a] transition-colors">
                                                <td className="p-3">
                                                    <span className="bg-[#222] text-[#f5a623] px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                                                        {item.category}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-bold text-gray-200">{item.name}</td>
                                                <td className="p-3 text-right font-mono text-purple-400">{item.scene}</td>
                                            </tr>
                                        ))}
                                        {analytics.manifestItemsList.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="p-6 text-center text-gray-500 italic">
                                                    No breakdown items added yet. Tag props, cast, costumes, or VFX in Breakdown View.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 5: SHOT DIVISION */}
                {/* ---------------------------------------------------- */}
                {activeTab === 'shotdivision' && (
                    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* SHOT SIZE CHART */}
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Camera size={16} className="text-[#f5a623]" /> Shot Framing Size Distribution
                                </h3>
                                <div className="h-60 w-full my-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analytics.shotSizeData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                            <XAxis dataKey="name" stroke="#555" tick={{ fontSize: 9, fill: '#aaa' }} />
                                            <YAxis stroke="#555" tick={{ fontSize: 9, fill: '#aaa' }} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', fontSize: '11px' }} />
                                            <Bar dataKey="value" fill="#f5a623" radius={[4, 4, 0, 0]} name="Shots" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* CAMERA ANGLES CHART */}
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Video size={16} className="text-blue-400" /> Camera Angle Breakdown
                                </h3>
                                <div className="h-60 w-full my-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analytics.shotAngleData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                            <XAxis dataKey="name" stroke="#555" tick={{ fontSize: 9, fill: '#aaa' }} />
                                            <YAxis stroke="#555" tick={{ fontSize: 9, fill: '#aaa' }} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', fontSize: '11px' }} />
                                            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Shots" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* CAMERA MOVEMENTS & LENS SPECS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Compass size={16} className="text-purple-400" /> Camera Movement Dynamics
                                </h3>
                                <div className="h-56 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analytics.shotMovementData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                            <XAxis dataKey="name" stroke="#555" tick={{ fontSize: 9, fill: '#aaa' }} />
                                            <YAxis stroke="#555" tick={{ fontSize: 9, fill: '#aaa' }} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', fontSize: '11px' }} />
                                            <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} name="Shots" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 shadow-lg">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Sliders size={16} className="text-green-400" /> Lens & Focal Length Choice
                                </h3>
                                <div className="h-56 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={analytics.cameraLensData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                            <XAxis dataKey="name" stroke="#555" tick={{ fontSize: 9, fill: '#aaa' }} />
                                            <YAxis stroke="#555" tick={{ fontSize: 9, fill: '#aaa' }} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', fontSize: '11px' }} />
                                            <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} name="Shots" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 6: STORYBOARD & VISUAL RENDERS */}
                {/* ---------------------------------------------------- */}
                {activeTab === 'storyboard' && (
                    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
                        {/* RENDERING PROGRESS CARD */}
                        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 flex flex-wrap justify-between items-center gap-4 shadow-lg">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <ImageIcon size={18} className="text-[#f5a623]" /> Storyboard Image Render Progress
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    {analytics.renderedShotsCount} of {analytics.totalShots} shots rendered ({analytics.imageRenderPercent}% Complete)
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setSelectedStoryFilter('all')}
                                    className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${selectedStoryFilter === 'all' ? 'bg-[#f5a623] text-black' : 'bg-[#222] text-gray-400'}`}
                                >
                                    All ({generatedShots.length})
                                </button>
                                <button 
                                    onClick={() => setSelectedStoryFilter('rendered')}
                                    className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${selectedStoryFilter === 'rendered' ? 'bg-green-500 text-black' : 'bg-[#222] text-gray-400'}`}
                                >
                                    Rendered ({analytics.renderedShotsCount})
                                </button>
                                <button 
                                    onClick={() => setSelectedStoryFilter('pending')}
                                    className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${selectedStoryFilter === 'pending' ? 'bg-amber-500 text-black' : 'bg-[#222] text-gray-400'}`}
                                >
                                    Pending ({analytics.pendingShotsCount})
                                </button>
                            </div>
                        </div>

                        {/* STORYBOARD GALLERY GRID */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filteredStoryboardShots.map(shot => (
                                <div key={shot.id} className="bg-[#141414] border border-[#2d2d2d] rounded-xl overflow-hidden hover:border-[#444] transition-all flex flex-col justify-between shadow-sm group">
                                    <div className="aspect-video bg-[#0d0d0d] relative overflow-hidden flex items-center justify-center">
                                        {shot.imageUrl ? (
                                            <img src={shot.imageUrl} alt={`Shot ${shot.shotNumber}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        ) : (
                                            <div className="text-center p-3">
                                                <Camera size={24} className="mx-auto text-gray-600 mb-1" />
                                                <span className="text-[9px] font-mono text-gray-500 uppercase block">Pending Render</span>
                                            </div>
                                        )}
                                        <div className="absolute top-2 left-2 bg-black/80 backdrop-blur text-[#f5a623] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-white/10">
                                            SC {shot.scene || '1'} · #{shot.shotNumber || '1'}
                                        </div>
                                    </div>
                                    <div className="p-2.5 text-xs">
                                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-1">
                                            <span className="text-[#f5a623]">{shot.shotSize || 'Wide'}</span>
                                            <span className="text-blue-400">{shot.angle || 'Eye Level'}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-300 line-clamp-2 leading-snug">
                                            {shot.description || 'No description provided.'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {filteredStoryboardShots.length === 0 && (
                                <div className="col-span-full bg-[#141414] border border-[#2a2a2a] rounded-xl p-8 text-center text-gray-500 italic">
                                    No storyboard shots matching current filter.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 7: 🤓 THE NERDY STUFF & TECHNICAL MATRIX */}
                {/* ---------------------------------------------------- */}
                {activeTab === 'nerdy' && (
                    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
                        {/* NERDY HERO SCORE BANNER */}
                        <div className="bg-gradient-to-r from-[#18120c] via-[#141414] to-[#121820] border border-[#2d2d2d] rounded-2xl p-6 shadow-xl relative overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <BrainCircuit size={24} className="text-[#f5a623]" />
                                        <h3 className="text-base font-black text-white uppercase tracking-wider">
                                            Production Complexity Index & Computational Specs
                                        </h3>
                                    </div>
                                    <p className="text-xs text-gray-400 max-w-2xl">
                                        An empirical algorithmic score calculated from graph topology, shot density, scene count, line dialogue velocity, and breakdown manifest depth.
                                    </p>
                                </div>

                                <div className="flex items-center gap-4 bg-[#0d0d0d]/80 p-3.5 rounded-xl border border-[#222]">
                                    <div className="text-right">
                                        <div className="text-3xl font-black text-[#f5a623]">{analytics.complexityScore} <span className="text-sm font-normal text-gray-500">/ 100</span></div>
                                        <div className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${analytics.complexityBadgeColor} uppercase tracking-wider mt-1 inline-block`}>
                                            {analytics.complexityTier}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TECHNICAL DATA MATRIX GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-2">
                                    <Zap size={14} className="text-[#f5a623]" /> Dialogue Velocity
                                </div>
                                <div className="text-2xl font-black text-white">{analytics.dialogueVelocityWpm} <span className="text-xs font-normal text-gray-400">WPM</span></div>
                                <p className="text-[10px] text-gray-500 mt-1">Average spoken words per minute of screen time.</p>
                            </div>

                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-2">
                                    <Activity size={14} className="text-blue-400" /> Avg Words / Scene
                                </div>
                                <div className="text-2xl font-black text-white">{analytics.avgWordsPerScene} <span className="text-xs font-normal text-gray-400">Words</span></div>
                                <p className="text-[10px] text-gray-500 mt-1">Average screenplay density per scene.</p>
                            </div>

                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-2">
                                    <HardDrive size={14} className="text-purple-400" /> State Memory Footprint
                                </div>
                                <div className="text-2xl font-black text-white">~{analytics.estimatedMemoryKb} <span className="text-xs font-normal text-gray-400">KB</span></div>
                                <p className="text-[10px] text-gray-500 mt-1">Estimated JSON state object size in cache.</p>
                            </div>

                            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-2">
                                    <Cpu size={14} className="text-green-400" /> State Object Nodes
                                </div>
                                <div className="text-2xl font-black text-white">{analytics.totalStateObjectsCount} <span className="text-xs font-normal text-gray-400">Nodes</span></div>
                                <p className="text-[10px] text-gray-500 mt-1">Total active reactive state entities.</p>
                            </div>
                        </div>

                        {/* COMPREHENSIVE NERDY STATISTICS TABLE */}
                        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-lg">
                            <div className="p-4 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between">
                                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Terminal size={16} className="text-[#f5a623]" /> Deep Technical Parameter Matrix
                                </h4>
                                <span className="text-[10px] font-mono text-gray-400">
                                    System Diagnostics
                                </span>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                <div className="space-y-2 bg-[#111] p-3 rounded-lg border border-[#222]">
                                    <div className="text-[10px] font-bold text-[#f5a623] uppercase">Graph & Board Engine</div>
                                    <div className="flex justify-between"><span className="text-gray-500">Total Beats (Vertices N):</span> <span className="text-white">{analytics.totalBeats}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Total Links (Edges E):</span> <span className="text-white">{analytics.totalConnections}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Graph Density Factor:</span> <span className="text-amber-400">{analytics.graphDensity}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Avg Vertex Degree:</span> <span className="text-blue-400">{analytics.avgNodeDegree}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Unconnected Isolated Beats:</span> <span className="text-red-400">{analytics.isolatedBeatsCount}</span></div>
                                </div>

                                <div className="space-y-2 bg-[#111] p-3 rounded-lg border border-[#222]">
                                    <div className="text-[10px] font-bold text-blue-400 uppercase">Screenplay & Text Parsing</div>
                                    <div className="flex justify-between"><span className="text-gray-500">Grand Total Word Count:</span> <span className="text-white">{analytics.grandTotalWords.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Spoken Dialogue Words:</span> <span className="text-[#f5a623]">{analytics.grandDialogueWords.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Action & Description Words:</span> <span className="text-blue-400">{analytics.grandActionWords.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Total Formatted Lines:</span> <span className="text-white">{analytics.grandTotalLines.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Dialogue Ratio:</span> <span className="text-green-400">{analytics.dialoguePercent}%</span></div>
                                </div>

                                <div className="space-y-2 bg-[#111] p-3 rounded-lg border border-[#222]">
                                    <div className="text-[10px] font-bold text-purple-400 uppercase">Shot Division & Camera Specs</div>
                                    <div className="flex justify-between"><span className="text-gray-500">Total Divided Shots:</span> <span className="text-white">{analytics.totalShots}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Shots / Scene Ratio:</span> <span className="text-purple-400">{(analytics.totalShots / (analytics.totalScenes || 1)).toFixed(1)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Storyboard Scene Coverage:</span> <span className="text-green-400">{analytics.storyboardCoveragePercent}%</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">AI Image Render Rate:</span> <span className="text-[#f5a623]">{analytics.imageRenderPercent}%</span></div>
                                </div>

                                <div className="space-y-2 bg-[#111] p-3 rounded-lg border border-[#222]">
                                    <div className="text-[10px] font-bold text-green-400 uppercase">Production Manifest & Cast</div>
                                    <div className="flex justify-between"><span className="text-gray-500">Total Manifest Items:</span> <span className="text-white">{analytics.totalManifestItems}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Total Cast Roles:</span> <span className="text-[#f5a623]">{analytics.characterList.length}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Character Bios Completion:</span> <span className="text-green-400">{analytics.characterCompletionPercent}%</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Relationship Connections:</span> <span className="text-blue-400">{analytics.totalRelationships}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default StatisticsView;
